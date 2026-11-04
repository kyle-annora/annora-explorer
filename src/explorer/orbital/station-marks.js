import { BufferGeometry, Color, Float32BufferAttribute, Group, Mesh, PlaneGeometry, ShaderMaterial, Vector2, Vector3 } from 'three';

const inactiveInk = new Color(0x525d59);
const graphite = new Color(0x838b85);
const segments = 240;
const aa = 'max(0.28, fwidth(value) * 0.55)';

function makeMarker(geometry, point, viewport, label) {
  const uniforms = {
    cssViewport: viewport, ink: { value: inactiveInk.clone() }, radius: { value: 4.1 },
    core: { value: 0 }, fade: { value: 0 },
  };
  const material = new ShaderMaterial({
    uniforms, transparent: true, depthTest: true, depthWrite: false, toneMapped: false,
    vertexShader: `
      uniform vec2 cssViewport;
      varying vec2 offsetPx;
      void main() {
        vec4 p = projectionMatrix * modelViewMatrix * vec4(0.,0.,0.,1.);
        offsetPx = position.xy * 22.;
        gl_Position = p;
        gl_Position.xy += offsetPx * 2. * p.w / cssViewport;
      }`,
    fragmentShader: `
      uniform vec3 ink;
      uniform float radius, core, fade;
      varying vec2 offsetPx;
      void main() {
        float value = length(offsetPx), aa = ${aa};
        float edge = 1. - smoothstep(0.8 - aa, 0.8 + aa, abs(value - radius));
        float dotInk = core > 0. ? 1. - smoothstep(core-aa, core+aa, value) : 0.;
        float coverage = max(edge, dotInk) * fade;
        if (coverage < 0.004) discard;
        gl_FragColor = vec4(ink, coverage);
      }`,
  });
  const marker = new Mesh(geometry, material);
  marker.name = label;
  marker.position.copy(point);
  marker.renderOrder = 3;
  marker.frustumCulled = false;
  return marker;
}

function ribbonGeometry(pointAt) {
  const positions = [], tangents = [], sides = [], angles = [], lengths = [], indices = [];
  let distance = 0, previous = null;
  for (let i = 0; i <= segments; i++) {
    const angle = i * 2 * Math.PI / segments;
    const point = pointAt(angle);
    const tangent = pointAt(angle + .0001).sub(pointAt(angle - .0001)).normalize();
    if (previous) distance += previous.distanceTo(point);
    previous = point;
    for (const side of [-1, 1]) {
      positions.push(point.x, point.y, point.z);
      tangents.push(tangent.x, tangent.y, tangent.z);
      sides.push(side); angles.push(angle); lengths.push(distance);
    }
    if (i < segments) {
      const v = i * 2;
      indices.push(v,v+2,v+1,v+1,v+2,v+3);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions,3));
  geometry.setAttribute('direction', new Float32BufferAttribute(tangents,3));
  geometry.setAttribute('sideSign', new Float32BufferAttribute(sides,1));
  geometry.setAttribute('arcAngle', new Float32BufferAttribute(angles,1));
  geometry.setAttribute('arcLength', new Float32BufferAttribute(lengths,1));
  geometry.setIndex(indices);
  return { geometry, length: distance };
}

function makeRibbon(pointAt, stations, viewport) {
  const {geometry, length} = ribbonGeometry(pointAt);
  const gaps = stations.map(() => new Vector3());
  const uniforms = {
    cssViewport: viewport, gaps: {value:gaps}, pixelRatio: {value:new Vector2(1,1)},
    ink: {value:graphite}, highlight: {value:new Color()}, focusAngle: {value:0},
    hasFocus: {value:0}, focusLimits: {value:new Vector2()}, fade: {value:0}, period: {value:length/72},
  };
  const material = new ShaderMaterial({
    uniforms, transparent: true, depthTest: true, depthWrite: false, toneMapped: false,
    vertexShader: `
      uniform vec2 cssViewport;
      attribute vec3 direction; attribute float sideSign, arcAngle, arcLength;
      varying float lateral, angle, along;
      void main() {
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.);
        vec4 delta = projectionMatrix * modelViewMatrix * vec4(direction,0.);
        vec2 tangent = (delta.xy * p.w - p.xy * delta.w) * cssViewport;
        vec2 across = vec2(-tangent.y,tangent.x) / max(length(tangent),0.00001);
        lateral = sideSign * 1.8;
        angle = arcAngle; along = arcLength;
        gl_Position = p;
        gl_Position.xy += across * lateral * 2. * p.w / cssViewport;
      }`,
    fragmentShader: `
      uniform vec3 gaps[${stations.length}], ink, highlight;
      uniform vec2 pixelRatio, focusLimits;
      uniform float focusAngle, hasFocus, fade, period;
      varying float lateral, angle, along;
      void main() {
        vec2 pixel = gl_FragCoord.xy / pixelRatio;
        float clearance = 10000.;
        for (int i=0; i<${stations.length}; ++i) {
          clearance = min(clearance, distance(pixel,gaps[i].xy) - gaps[i].z);
        }
        float distanceFromFocus = atan(sin(angle-focusAngle),cos(angle-focusAngle));
        float limit = max(0.0001, distanceFromFocus < 0. ? focusLimits.x : focusLimits.y);
        float focus = hasFocus * (1.-smoothstep(max(0.,limit-0.025),limit,abs(distanceFromFocus)));
        float value = abs(lateral), aa = ${aa};
        float halfWidth = mix(0.65,0.88,focus);
        float width = 1. - smoothstep(halfWidth-aa,halfWidth+aa,value);
        float phase = fract(along/period);
        float dashAA = clamp(fwidth(along/period)*0.5,0.008,0.16);
        float dash = 1. - smoothstep(0.32-dashAA,0.32+dashAA,abs(phase-0.5));
        float alpha = width * dash * smoothstep(-0.5,0.5,clearance) * fade;
        gl_FragColor = vec4(mix(ink,highlight,focus),alpha);
      }`,
  });
  const ribbon = new Mesh(geometry, material);
  ribbon.name = 'Chapter orbit';
  ribbon.renderOrder = 2;
  ribbon.frustumCulled = false;
  return ribbon;
}

// Every mark shares the same 3D coordinate as its hit target. Only its printed
// size is a screen measurement; the assembly can occlude the entire station.
export function createStationMarks({ canvas, stations, pointAt }) {
  const root = new Group(), viewport = {value: new Vector2(1,1)};
  const geometry = new PlaneGeometry(1,1), projected = new Vector3();
  for (const station of stations) {
    station.marker = makeMarker(geometry, station.point, viewport, station.label || station.id);
    root.add(station.marker);
  }
  const ribbon = makeRibbon(pointAt, stations, viewport);
  root.add(ribbon);
  function update(camera, alpha, emphasis, activeId, accent) {
    const w = Math.max(1,canvas.clientWidth), h = Math.max(1,canvas.clientHeight);
    viewport.value.set(w,h);
    const u = ribbon.material.uniforms;
    u.pixelRatio.value.set(canvas.width/w,canvas.height/h);
    u.fade.value = alpha * .92;
    u.hasFocus.value = 0;
    u.highlight.value.set(accent);
    for (let i = 0; i < stations.length; i++) {
      const station = stations[i], marker = station.marker, mark = marker.material.uniforms;
      const active = station.id === activeId, focused = station.id === emphasis;
      mark.radius.value = active ? 6.3 : focused ? 5.2 : 4.1;
      mark.core.value = active ? 2.45 : focused ? 1.55 : 0;
      mark.ink.value.copy(active || focused ? u.highlight.value : inactiveInk);
      mark.fade.value = alpha;
      if (focused && marker.visible) {
        u.hasFocus.value = 1;
        u.focusAngle.value = station.angleRad;
        u.focusLimits.value.fromArray(station.limits);
      }
      projected.copy(station.point).project(camera);
      u.gaps.value[i].set((1+projected.x)*w/2,(1+projected.y)*h/2,
        marker.visible ? mark.radius.value + 3.7 : -1);
    }
  }
  return { root, update };
}
