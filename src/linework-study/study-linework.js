import * as THREE from "three";
import { throwIfAborted } from "../explorer/network-load.js";
import { groupTreatment, studyPartRole } from "./study-policy.js";

const yieldBrowser = () => new Promise(resolve => setTimeout(resolve, 0));

// Join source line endpoints once, in mesh space. Every segment in a bore,
// outline or connected network gets the same size and center at all angles.
async function findGroups(start, end, offset, count, diagonal, signal) {
  const tolerance = Math.max(diagonal * 1e-7, 1e-8);
  const parents = new Uint32Array(count);
  const sizes = new Uint32Array(count);
  const points = new Map();

  function root(id) {
    while (parents[id] !== id) {
      parents[id] = parents[parents[id]];
      id = parents[id];
    }
    return id;
  }
  function join(a, b) {
    a = root(a); b = root(b);
    if (a === b) return;
    if (sizes[a] < sizes[b]) [a, b] = [b, a];
    parents[b] = a;
    sizes[a] += sizes[b];
  }
  function connect(array, source, id) {
    const x = Math.round(array[source] / tolerance);
    const y = Math.round(array[source + 1] / tolerance);
    const z = Math.round(array[source + 2] / tolerance);
    const key = x + "," + y + "," + z;
    const point = points.get(key);
    if (point) {
      join(id, point.segment);
      point.degree++;
    } else points.set(key, { segment: id, degree: 1 });
  }

  let lastYield = performance.now();
  for (let i = 0; i < count; i++) {
    parents[i] = i; sizes[i] = 1;
    const source = (offset + i) * 3;
    connect(start, source, i);
    connect(end, source, i);
    if ((i & 2047) === 0 && performance.now() - lastYield > 6) {
      await yieldBrowser(); throwIfAborted(signal); lastYield = performance.now();
    }
  }

  const groups = new Map(), membership = new Uint32Array(count);
  for (let i = 0; i < count; i++) {
    const id = root(i), source = (offset + i) * 3;
    membership[i] = id;
    let group = groups.get(id);
    if (!group) {
      group = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity], count: 0, closed: true };
      groups.set(id, group);
    }
    group.count++;
    for (let axis = 0; axis < 3; axis++) {
      group.min[axis] = Math.min(group.min[axis], start[source + axis], end[source + axis]);
      group.max[axis] = Math.max(group.max[axis], start[source + axis], end[source + axis]);
    }
  }
  for (const point of points.values()) if (point.degree !== 2) groups.get(root(point.segment)).closed = false;
  for (const group of groups.values()) {
    group.center = group.min.map((v, axis) => (v + group.max[axis]) * 0.5);
    group.span = Math.hypot(...group.min.map((v, axis) => group.max[axis] - v));
  }
  return { groups, membership };
}

async function prepareGroupAttributes(geometry, meshes, metadata, contour, signal) {
  const start = geometry.getAttribute("segmentStart").array;
  const end = geometry.getAttribute("segmentEnd").array;
  const parts = geometry.getAttribute("partIndex").array;
  const details = new Float32Array(parts.length * 4);
  const floors = new Uint8Array(parts.length);
  const prepared = new Map();
  let groupCount = 0, offset = 0;
  while (offset < parts.length) {
    throwIfAborted(signal);
    const part = parts[offset], mesh = meshes[part];
    let stop = offset + 1;
    while (stop < parts.length && parts[stop] === part) stop++;
    const count = stop - offset, record = metadata.meshes[mesh.name];
    const bounds = metadata.geometries[record.geometryId].bounds;
    const diagonal = Math.hypot(...bounds[1].map((v, axis) => v - bounds[0][axis]));
    // Repeated legs share the same model-local data in both prepared batches.
    const key = record.geometryId + "/" + record.byteOffset + "/" + count + "/" + studyPartRole(mesh.name);
    let channels = prepared.get(key);
    if (!channels) {
      const { groups, membership } = await findGroups(start, end, offset, count, diagonal, signal);
      for (const group of groups.values()) {
        const parameters = groupTreatment({
          span: group.span, partSpan: diagonal, segmentCount: group.count,
          closed: group.closed, role: studyPartRole(mesh.name), contour,
        });
        group.effectiveSpan = parameters.effectiveSpan;
        group.floor = Math.round(255 * parameters.floor);
      }
      channels = { details: new Float32Array(count * 4), floors: new Uint8Array(count), count: groups.size };
      for (let i = 0; i < count; i++) {
        const group = groups.get(membership[i]), target = i * 4;
        channels.details[target] = group.center[0];
        channels.details[target + 1] = group.center[1];
        channels.details[target + 2] = group.center[2];
        channels.details[target + 3] = group.effectiveSpan;
        channels.floors[i] = group.floor;
      }
      prepared.set(key, channels);
    }
    details.set(channels.details, offset * 4);
    floors.set(channels.floors, offset);
    groupCount += channels.count;
    offset = stop;
  }
  return { details, floors, groupCount };
}

function insert(source, anchor, addition) {
  if (!source.includes(anchor)) throw new Error("The production line shader changed. Review its matching density hook.");
  return source.replace(anchor, addition);
}

/** Build an alternative material and share the original camera/width/ink uniforms. */
function densityMaterial(original, contour) {
  const edited = original.clone();
  edited.uniforms = original.uniforms;
  edited.vertexShader = "attribute vec4 studyGroup; attribute float studyFloor; varying float studyVisibility;\n" + insert(
    original.vertexShader,
    "mat4 modelView=viewMatrix*world;",
    `mat4 modelView=viewMatrix*world;
     vec4 groupCenter=modelView*vec4(studyGroup.xyz,1.0);
     float scale=max(length(world[0].xyz),max(length(world[1].xyz),length(world[2].xyz)));
     float pixels=studyGroup.w*scale*projectionMatrix[1][1]*resolution.y/
       max(0.001,-2.0*groupCenter.z*pixelRatio);
     studyVisibility=mix(studyFloor,1.0,smoothstep(${contour ? "1.25,5.25" : "2.0,8.0"},pixels));
     if(studyVisibility<=0.002){gl_Position=vec4(2.0,2.0,2.0,1.0);return;}`,
  );
  edited.fragmentShader = "varying float studyVisibility;\n" + insert(
    original.fragmentShader,
    "gl_FragColor=vec4(stroke,partState.x*backing);",
    "gl_FragColor=vec4(mix(background,stroke,partState.x*backing*studyVisibility),1.0);",
  );
  // Keep the darkest ink on paper (brightest on dark). Overlapping low-priority
  // segments then cannot combine into a solid patch just because they are dense.
  edited.blending = THREE.CustomBlending;
  edited.blendSrc = edited.blendSrcAlpha = THREE.OneFactor;
  edited.blendDst = edited.blendDstAlpha = THREE.OneFactor;
  edited.blendEquation = edited.blendEquationAlpha = THREE.MinEquation;
  return edited;
}

/**
 * Add a reversible material choice to a production pass. Original strokes and
 * depth occluders stay in the same batches and keep their exact source poses.
 */
export async function prepareStudyLinework(runtime, meshes, metadata, signal) {
  const started = performance.now(), sources = runtime.pass.lineScene.children;
  const crease = sources.find(mesh => mesh.renderOrder === 1);
  const contour = sources.find(mesh => mesh.renderOrder === 2);
  if (!crease || !contour) throw new Error("Expected the prepared crease and contour batches.");
  const creaseChannels = await prepareGroupAttributes(crease.geometry, meshes, metadata, false, signal);
  const contourChannels = await prepareGroupAttributes(contour.geometry, meshes, metadata, true, signal);
  throwIfAborted(signal);
  const surfaces = [[crease, creaseChannels], [contour, contourChannels]].map(([mesh, channels]) => {
    mesh.geometry.setAttribute("studyGroup", new THREE.InstancedBufferAttribute(channels.details, 4));
    mesh.geometry.setAttribute("studyFloor", new THREE.InstancedBufferAttribute(channels.floors, 1, true));
    return { mesh, original: mesh.material, edited: densityMaterial(mesh.material, mesh === contour) };
  });
  Object.assign(runtime.stats, {
    featureGroups: creaseChannels.groupCount, contourGroups: contourChannels.groupCount,
    densityBytes: creaseChannels.details.byteLength + creaseChannels.floors.byteLength +
      contourChannels.details.byteLength + contourChannels.floors.byteLength,
    detailPreparationMs: performance.now() - started,
  });
  let density = false;
  function setDensity(enabled) {
    density = Boolean(enabled);
    for (const { mesh, edited, original } of surfaces) mesh.material = density ? edited : original;
  }
  function sync(state) {
    runtime.sync(state);
    if (!density) return;
    const blend = state.displayOptions?.appearance === "dark" ? THREE.MaxEquation : THREE.MinEquation;
    for (const { edited } of surfaces) edited.blendEquation = edited.blendEquationAlpha = blend;
  }
  function dispose() {
    for (const { edited } of surfaces) edited.dispose();
    runtime.dispose();
  }
  return { ...runtime, sync, setDensity, dispose };
}
