import { Box3, Group, MathUtils, Raycaster, Vector2, Vector3 } from 'three';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { createStationMarks } from './station-marks.js';

const defaultAccent = '#ff6840';
const radians = MathUtils.degToRad;

function anchorPoint(anchor, metadata) {
  const part = anchor && metadata?.parts.find(p => p.meshName === anchor.meshName);
  if (!part) return null;
  if (!anchor.fraction) return new Vector3(...part.center);
  const [min,max] = part.bounds;
  return new Vector3(...anchor.fraction.map((fraction, i) => MathUtils.lerp(min[i], max[i], fraction)));
}

function createLeader(point, target, length) {
  const geometry = new LineGeometry().setPositions([...point.toArray(), ...target.toArray()]);
  const material = new LineMaterial({
    transparent: true, depthTest: true, depthWrite: false, toneMapped: false,
    linewidth: 1.2, dashed: true, dashSize: length/250, gapSize: length/355,
  });
  const line = new Line2(geometry,material);
  line.name = 'Component leader';
  line.computeLineDistances();
  line.renderOrder = 2;
  line.visible = false;
  return line;
}

function stationGeometry(config, metadata, root, canvas) {
  if (!config?.stations?.length) return null;
  const center = new Vector3(...config.center), axisU = new Vector3(...config.axisU), axisV = new Vector3(...config.axisV);
  const pointAt = phi => center.clone().addScaledVector(axisU,Math.cos(phi)).addScaledVector(axisV,Math.sin(phi));
  const framePoints = Array.from({length:72}, (_,i) => pointAt(radians(i*5)));
  const length = framePoints.reduce((sum,p,i) => sum+p.distanceTo(framePoints[(i+1)%framePoints.length]),0);
  const stations = config.stations.map(record => {
    const phi = radians(record.angle), point = pointAt(phi), target = anchorPoint(record.anchor,metadata);
    const leader = target ? createLeader(point,target,length) : null;
    if (leader) root.add(leader);
    // Neighbouring stations split the intervening arc, even on a dense orbit.
    let before=18, after=18;
    for (const other of config.stations) {
      if (other===record) continue;
      before=Math.min(before, MathUtils.euclideanModulo(record.angle-other.angle,360)/2);
      after=Math.min(after, MathUtils.euclideanModulo(other.angle-record.angle,360)/2);
    }
    const band = Array.from({length:25}, (_,i) => pointAt(phi+radians(MathUtils.lerp(-before,after,i/24))));
    return {id:record.id,label:record.label,point,angleRad:phi,limits:[radians(before),radians(after)],band,leader,exposed:false};
  });
  const marks = createStationMarks({canvas,stations,pointAt});
  root.add(marks.root);
  return {framePoints,stations,marks};
}

export function createSpatialOrbit({camera, canvas, metadata, orbitConfig, getAccent, onEmphasis}) {
  const root = new Group();
  root.name = 'Orbital chapter navigation'; root.visible = false;
  const geometry = stationGeometry(orbitConfig,metadata,root,canvas);
  const stations = geometry?.stations ?? [], activeId = stations[0]?.id;
  const blockers = [], hits = [];
  const raycaster = new Raycaster(), cursorRay = new Raycaster();
  const ndc = new Vector2(), projected = new Vector3(), forward = new Vector3(), clip = new Vector3();
  const nearestRay = new Vector3(), nearestSegment = new Vector3();
  const previousEye = new Vector3(Infinity,Infinity,Infinity);
  let enabled = false, alpha = 0, reveal = true, settling = false, pickable = false;
  let focusId = null, hoverId = null, lastEmphasis = null, dirty = true;

  function blockersFrom(meshes) {
    blockers.length = 0;
    for (const mesh of meshes) {
      if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
      blockers.push({mesh,box:new Box3()});
    }
    dirty = true;
  }
  function syncBounds() {
    for (const {mesh,box} of blockers) {
      mesh.updateWorldMatrix(true,false);
      box.copy(mesh.geometry.boundingBox).applyMatrix4(mesh.matrixWorld);
    }
  }
  function blocked(point) {
    forward.copy(point).sub(camera.position);
    const distance = forward.length();
    if (distance <= camera.near) return true;
    raycaster.set(camera.position,forward.divideScalar(distance));
    raycaster.near = camera.near;
    raycaster.far = distance-Math.max(camera.near*.05, distance*.00001);
    for (const {mesh,box} of blockers) {
      if (!mesh.visible || !raycaster.ray.intersectBox(box,clip)) continue;
      hits.length = 0; mesh.raycast(raycaster,hits);
      if (hits.length) return true;
    }
    return false;
  }
  function project(point) {
    projected.copy(point).project(camera);
    return Math.abs(projected.x)<=1 && Math.abs(projected.y)<=1 && Math.abs(projected.z)<=1;
  }
  function refreshVisibility(refreshBounds) {
    if (refreshBounds || dirty) syncBounds();
    if (refreshBounds || dirty || !previousEye.equals(camera.position)) {
      for (const station of stations) station.exposed = !blocked(station.point);
      previousEye.copy(camera.position);
      dirty = false;
    }
  }
  function paint() {
    const emphasis = focusId || hoverId;
    if (emphasis !== lastEmphasis) { lastEmphasis = emphasis; onEmphasis?.(emphasis); }
    root.visible = alpha > 0;
    if (!root.visible || !geometry) return;
    camera.updateMatrixWorld();
    const accent = (typeof getAccent==='function' ? getAccent() : getAccent) || defaultAccent;
    for (const station of stations) {
      // A ring clipped around a narrow obstruction can still resemble a
      // clickable point. Drawing and picking must agree about its center.
      station.marker.visible = station.exposed && project(station.point);
      if (station.leader) {
        station.leader.visible = station.marker.visible && emphasis===station.id;
        station.leader.material.color.set(accent);
        station.leader.material.opacity = .55*alpha;
      }
    }
    geometry.marks.update(camera,alpha,emphasis,activeId,accent);
  }
  function setFocus(id) {
    if (focusId===id) return false;
    focusId=id; paint(); return true;
  }
  function setHover(id) {
    if (hoverId===id) return false;
    hoverId=id; paint(); return true;
  }
  function setEnabled(next, immediate=false) {
    enabled=Boolean(next && stations.length);
    pickable=false; reveal=true; dirty=true;
    focusId=hoverId=null;
    if (immediate) alpha=Number(enabled);
    paint();
  }
  function update(dt, moving, allowReveal=!moving) {
    const wasSettling = settling;
    settling=moving; reveal=allowReveal;
    const target=Number(enabled && reveal);
    if (alpha!==target) alpha=MathUtils.clamp(alpha + (target ? 1 : -1)*dt/.22,0,1);
    pickable=enabled && alpha===1 && !settling;
    if (alpha>0) refreshVisibility(moving || wasSettling);
    paint();
  }
  function pick(event) {
    if (!pickable) return null;
    const rect=canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    camera.updateMatrixWorld();
    refreshVisibility(false);
    const x=event.clientX-rect.left,y=event.clientY-rect.top;
    function distanceInPixels(point) {
      if (!project(point)) return Infinity;
      return Math.hypot((1+projected.x)*rect.width/2-x,(1-projected.y)*rect.height/2-y);
    }
    const touch=event.pointerType==='touch';
    let best=null, nearest=touch ? 22 : 13;
    for (const station of stations) {
      if (!station.exposed) continue;
      const distance=distanceInPixels(station.point);
      if (distance<nearest) { best=station.id; nearest=distance; }
    }
    if (best) return best;
    nearest=touch ? 7 : 4;
    ndc.set(x*2/rect.width-1,1-y*2/rect.height);
    cursorRay.setFromCamera(ndc,camera);
    for (const station of stations) {
      if (!station.exposed || !project(station.point)) continue;
      for (let i=1;i<station.band.length;i++) {
        cursorRay.ray.distanceSqToSegment(station.band[i-1],station.band[i],nearestRay,nearestSegment);
        const distance=distanceInPixels(nearestSegment);
        if (distance<nearest && !blocked(nearestSegment)) { best=station.id; nearest=distance; }
      }
    }
    return best;
  }
  return {
    root,framePoints:geometry?.framePoints??[],blockersFrom,setEnabled,setFocus,setHover,update,pick,
    get animating() { return alpha!==Number(enabled && reveal); },
    stats: () => ({
      alpha,hoverId,focusId,
      stations: !pickable ? [] : stations.map(station => {
        const inFrame=project(station.point);
        return {id:station.id,x:(1+projected.x)*canvas.clientWidth/2,y:(1-projected.y)*canvas.clientHeight/2,
          visible:inFrame && station.exposed,occluded:inFrame && !station.exposed};
      }),
    }),
  };
}
