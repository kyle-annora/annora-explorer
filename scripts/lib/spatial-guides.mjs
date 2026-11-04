import { readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { loadProject } from './project-config.mjs';

const vector = value => Array.isArray(value) && value.length === 3 && value.every(Number.isFinite);
const text = value => typeof value === 'string' && value.trim() && value.length <= 400;
const boundedPair = value => Array.isArray(value) && value.length === 2 && value.every(Number.isFinite);
const unit = value => Number.isFinite(value) && value >= 0 && value <= 1;

export function validateSpatialGuide(guide, model, animations = []) {
  const require = (test, message) => { if (!test) throw Error(model.manifest.id + ' spatial guide: ' + message); };
  require(guide?.schemaVersion === 1 && guide.modelId === model.manifest.id &&
    guide.modelRevision === model.revision && guide.tourId === model.tour?.id, 'model revision or tour does not match.');
  require(['default', 'opt-in'].includes(guide.entry), 'choose a valid presentation entry.');
  const chapters = guide.chapters;
  require(Array.isArray(chapters) && chapters.length >= 2 && chapters.length <= 12 &&
    chapters[0]?.id === 'overview', 'start with an overview and at least one detail.');
  const ids = new Set(), parts = new Map(model.metadata.parts.map(part => [part.meshName, part]));
  const groups = new Set([...parts.values()].map(p => p.group));
  for (const c of chapters) {
    require(c && /^[a-z][a-z0-9-]{0,49}$/.test(c.id) && !ids.has(c.id) && text(c.label), 'invalid or duplicate chapter.');
    ids.add(c.id);
    require(vector(c.direction) && Math.hypot(...c.direction) > 0, c.id + ' needs a camera direction.');
    if (c.fill) require(boundedPair(c.fill) && c.fill.every(v => v > 0 && v <= 1.5), c.id + ' has invalid camera framing.');
    if (c.hint !== undefined) require(text(c.hint), c.id + ' has an invalid station hint.');
    if (c.fit !== undefined) require(c.fit === 'action', c.id + ' has an unknown fit.');
    if (c.callouts !== undefined) {
      const cues = c.callouts;
      require(Array.isArray(cues) && cues.length > 0 && cues.length <= 12 && cues[0]?.at === 0 &&
        (c.id !== 'overview' || cues.length === 1), c.id + ' needs an opening callout.');
      for (const [i, cue] of cues.entries()) {
        require(cue && unit(cue.at) && (!i || cue.at > cues[i - 1].at) &&
          text(cue.title) && cue.title.length <= 45 && text(cue.text) && cue.text.length <= 135,
          c.id + ' needs ordered callouts with a short title and sentence.');
        const anchor = cue.anchor, part = parts.get(anchor?.meshName);
        require(part && (c.id === 'overview' || c.groups?.includes(part.group)) &&
          (anchor.fraction === undefined || (vector(anchor.fraction) && anchor.fraction.every(unit))),
          c.id + ' has an unknown, out-of-scope or invalid callout anchor.');
      }
    }
    if (c.id === 'overview') continue;
    require(text(c.copy) && c.duration > 0 && Number.isFinite(c.duration) && c.duration <= 30, c.id + ' needs a caption and duration.');
    require(Array.isArray(c.groups) && c.groups.length && c.groups.every(g => groups.has(g)), c.id + ' references unknown part groups.');
    require(Array.isArray(c.phases) && c.phases.length && c.phases[0][0] === 0 &&
      c.phases.every(([at,label],i) => unit(at) && text(label) && (!i || at > c.phases[i-1][0])), c.id + ' has invalid caption timings.');
    const a = c.action;
    const inScope = name => parts.has(name) && c.groups.includes(parts.get(name).group);
    if (a?.type === 'separate') {
      const moved = new Set();
      require(Array.isArray(a.lifts) && a.lifts.length, c.id + ' needs authored separations.');
      for (const lift of a.lifts) {
        require(vector(lift.vector) && Math.hypot(...lift.vector) > 0 && boundedPair(lift.window) &&
          lift.window.every(unit) && lift.window[1] > lift.window[0], c.id + ' has an invalid lift.');
        require(Array.isArray(lift.meshes) && lift.meshes.length, c.id + ' needs named meshes.');
        for (const name of lift.meshes) {
          require(inScope(name) && !moved.has(name), c.id + ' has an unknown, out-of-scope or repeated mesh ' + name);
          moved.add(name);
        }
      }
      if (a.guideMesh) require(moved.has(a.guideMesh) && a.lifts.some(l => l.meshes.includes(a.guideMesh) && l.vector[0] === 0 && l.vector[2] === 0 && l.vector[1] > 0), 'axis marks need a rising mesh.');
    } else {
      const clip = animations.find(x => x.name === a?.clip);
      require(a?.type === 'motion' && a.clip === model.metadata.operation?.clipName && clip, c.id + ' needs an available authored clip.');
      require(Array.isArray(a.joints) && a.joints.length && a.joints.every(name => clip.rotations.includes(name)), c.id + ' references an unanimated joint.');
      if (a.window) require(boundedPair(a.window) && a.window.every(unit) && a.window[0] < a.window[1], c.id + ' has an invalid clip interval.');
      if (a.trace) require(inScope(a.trace), c.id + ' has an unknown trace target.');
    }
  }
  const orbit = guide.orbit;
  require(orbit && [orbit.center, orbit.axisU, orbit.axisV].every(vector), 'invalid orbit vectors.');
  const [a,b,c] = orbit.axisU, [x,y,z] = orbit.axisV;
  require(Math.hypot(b*z-c*y,c*x-a*z,a*y-b*x) > 1e-12, 'orbit axes must span a plane.');
  require(Array.isArray(orbit.stations) && orbit.stations.length === ids.size &&
    new Set(orbit.stations.map(s => s.id)).size === ids.size && orbit.stations[0].id === 'overview', 'each chapter needs one station.');
  const angles = new Set();
  for (const s of orbit.stations) {
    require(ids.has(s.id) && Number.isFinite(s.angle), 'invalid station.');
    const normalized = (s.angle % 360 + 360) % 360;
    require(!angles.has(normalized), 'two stations share a position.'); angles.add(normalized);
    if (s.anchor) require(parts.has(s.anchor.meshName) && (!s.anchor.fraction ||
      (vector(s.anchor.fraction) && s.anchor.fraction.every(unit))), 'station has an unknown anchor.');
  }
  const foot = guide.surface?.footprint;
  if (foot) require(Number.isFinite(foot.span) && foot.span > 0 && Array.isArray(foot.feet) &&
    foot.feet.every(f => parts.has(f.tip) && parts.has(f.hip)), 'footprint references an unknown part.');
  return guide;
}

export async function loadSpatialGuides(models) {
  const guides = [];
  for (const model of models) {
    const dir = path.dirname(model.manifestPath);
    let file;
    try { file = await realpath(path.join(dir, 'spatial-guide.json')); }
    catch (error) { if (error.code === 'ENOENT') continue; throw error; }
    if (path.dirname(file) !== dir) throw Error('Spatial guide must belong to its own model package.');
    const guide = JSON.parse(await readFile(file, 'utf8'));
    const glb = await readFile(model.assets.model);
    const gltf = JSON.parse(glb.subarray(20, 20 + glb.readUInt32LE(12)).toString());
    const animations = (gltf.animations ?? []).map(clip => ({ name: clip.name,
      rotations: clip.channels.filter(c => c.target.path === 'rotation').map(c => gltf.nodes[c.target.node].name) }));
    guides.push(validateSpatialGuide(guide, model, animations));
  }
  return guides;
}

export function spatialGuidesPlugin(root) {
  const id = 'virtual:annora-spatial-guides';
  return {
    name: 'configured-spatial-guides',
    resolveId(value) { return value === id ? '\0' + id : null; },
    async load(value) {
      if (value !== '\0' + id) return null;
      const { models } = await loadProject(root);
      const guides = await loadSpatialGuides(models);
      const configured = new Set(guides.map(guide => guide.modelId));
      for (const model of models) {
        if (configured.has(model.manifest.id)) this.addWatchFile(path.join(path.dirname(model.manifestPath), 'spatial-guide.json'));
      }
      return 'export default ' + JSON.stringify(guides) + ';';
    },
  };
}
