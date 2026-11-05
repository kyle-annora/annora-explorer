import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { loadProject } from '../scripts/lib/project-config.mjs';
import { validateSpatialGuide } from '../scripts/lib/spatial-guides.mjs';

const { models } = await loadProject(fileURLToPath(new URL('../', import.meta.url)));
const model = models.find(item => item.manifest.id === 'hexapod');
const source = JSON.parse(await readFile(new URL('../content/models/hexapod/spatial-guide.json', import.meta.url), 'utf8'));
const glb = await readFile(model.assets.model);
const gltf = JSON.parse(glb.subarray(20, 20 + glb.readUInt32LE(12)));
const animations = gltf.animations.map(clip => ({ name:clip.name, rotations:clip.channels.filter(channel => channel.target.path === 'rotation').map(channel => gltf.nodes[channel.target.node].name) }));
function fixture() {
  const guide = structuredClone(source), leg = guide.chapters.find(chapter => chapter.id === 'leg');
  leg.inspectNodeId = 'hex-leg-1'; leg.action.playbackWindow = [.14,.86];
  leg.explanation = {
    title:'Two hinges move the foot.', summary:'The upper and lower joints move in sequence to lift and extend the foot.',
    joints:[
      { node:'HexJoint_leg_1_femur', label:'Upper joint', highlightMesh:'Hex_leg_1_femur_motor_1' },
      { node:'HexJoint_leg_1_tibia', label:'Lower joint', highlightMesh:'Hex_leg_1_tibia_motor_1' }
    ],
    diagram:{ horizontal:[.70710678,0,-.70710678], vertical:[0,1,0] },
    cues:[[0,0],[.32,1],[.5,-1]]
  };
  return { guide, leg };
}
const validate = guide => validateSpatialGuide(guide, model, animations);
const invalid = (edit, match) => { const { guide, leg } = fixture(); edit(leg, guide); assert.throws(() => validate(guide), match); };

test('the authored Hexapod explanation binds to actual GLB joints, in-scope meshes and a valid inspection hierarchy', () => {
  const { guide, leg } = fixture(); assert.equal(validate(guide), guide);
  for (const joint of leg.explanation.joints) {
    assert.ok(animations.find(clip => clip.name === leg.action.clip).rotations.includes(joint.node));
    assert.equal(model.metadata.parts.find(part => part.meshName === joint.highlightMesh).group, 'hex-leg-1');
  }
  assert.ok(model.metadata.groups.find(group => group.id === leg.inspectNodeId));
});

test('optional explanation and playback fields do not become requirements for existing chapters', () => {
  const { guide, leg } = fixture(); delete leg.explanation; delete leg.action.playbackWindow; delete leg.inspectNodeId;
  assert.equal(validate(guide), guide);
});

test('inspection targets are checked against the actual runtime hierarchy and chapter scope', () => {
  invalid(leg => { leg.inspectNodeId = 'not-in-this-revision'; }, /inspection target/);
  invalid(leg => { leg.inspectNodeId = 'hex-body'; }, /out-of-scope inspection target/);
  invalid(leg => { leg.inspectNodeId = ''; }, /inspection target/);
  invalid(leg => { leg.inspectNodeId = { nodeId:'hex-leg-1' }; }, /inspection target/);
  const { guide, leg } = fixture(); leg.inspectNodeId = 'hex-leg-1-femur'; assert.equal(validate(guide), guide, 'authored subassemblies are valid targets');
});

test('playback windows must be increasing normalized motion intervals', () => {
  for (const window of [[.86,.14],[.5,.5],[-.1,.8],[.2,1.1],[0,Infinity],[0,NaN],[0,.5,1],null,'0,1']) {
    invalid(leg => { leg.action.playbackWindow = window; }, /playback window/);
  }
  invalid((_leg, guide) => { guide.chapters.find(c => c.id === 'electronics').action.playbackWindow = [.14,.86]; }, /playback window/);
  invalid((_leg, guide) => { guide.chapters[0].action = { type:'motion', playbackWindow:[0,1] }; }, /playback window/);
  const { guide, leg } = fixture(); leg.action.playbackWindow = [0,1]; assert.equal(validate(guide), guide);
});

test('explanatory highlights cannot name unanimated, duplicate or out-of-scope joints and meshes', () => {
  invalid(leg => { leg.explanation.joints[0].node = 'HexJoint_leg_2_femur'; }, /action joint/);
  invalid(leg => { leg.explanation.joints[1].node = leg.explanation.joints[0].node; }, /repeated/);
  invalid(leg => { leg.explanation.joints[0].highlightMesh = 'missing'; }, /highlight mesh/);
  invalid(leg => { leg.explanation.joints[0].highlightMesh = 'Hex_leg_2_femur_motor_1'; }, /out-of-scope highlight/);
  invalid(leg => { leg.explanation.joints[0].label = ''; }, /unlabelled/);
  invalid(leg => { leg.explanation.joints[0].highlight = leg.explanation.joints[0].highlightMesh; }, /action joint/);
  invalid(leg => { leg.explanation.joints = []; }, /exactly two joints/);
  invalid(leg => { leg.explanation.joints = leg.explanation.joints.slice(0,1); }, /exactly two joints/);
  invalid(leg => { delete leg.action.trace; }, /in-scope foot trace/);
  invalid(leg => { leg.explanation.joints = Array.from({length:7}, () => leg.explanation.joints[0]); }, /exactly two joints/);
});

test('diagram axes must be finite, normalized and orthogonal so the projected mechanism is not skewed', () => {
  for (const axis of [[0,0,0],[2,0,0],[NaN,0,1],[Infinity,0,0],[1,0],[1,0,0,0],null]) {
    invalid(leg => { leg.explanation.diagram.horizontal = axis; }, /finite unit axes/);
  }
  invalid(leg => { leg.explanation.diagram.vertical = [...leg.explanation.diagram.horizontal]; }, /orthogonal/);
  invalid(leg => { leg.explanation.diagram.vertical = [Math.SQRT1_2, Math.SQRT1_2, 0]; }, /orthogonal/);
  invalid(leg => { leg.explanation.diagram.up = [0,1,0]; }, /finite unit axes/);
});

test('joint cues require a zero-time opening, strict progress order and a valid integer highlight index', () => {
  for (const cues of [[],[[.1,0]],[[0,0],[.32,1],[.32,-1]],[[0,0],[.8,1],[.5,-1]],[[0,0],[1.1,1]],[[0,0],[.3,2]],[[0,-2]],[[0,.5]],[[0,0,1]],[[0,0],null]]) {
    invalid(leg => { leg.explanation.cues = cues; }, /joint cues|joint cue/);
  }
  const { guide, leg } = fixture(); leg.explanation.cues = [[0,-1],[.2,0],[.5,1],[1,-1]];
  assert.equal(validate(guide), guide, '-1 intentionally clears the highlight and the final normalized cue may be 1');
});

test('explanation copy is bounded, typo-resistant and available only on motion chapters', () => {
  invalid(leg => { leg.explanation = null; }, /short title and summary/);
  invalid(leg => { leg.explanation.title = 'x'.repeat(71); }, /short title/);
  invalid(leg => { leg.explanation.summary = 'x'.repeat(181); }, /summary/);
  invalid(leg => { leg.explanation.extra = 'silently ignored'; }, /short title/);
  invalid((leg, guide) => { guide.chapters[0].explanation = leg.explanation; }, /needs a motion action/);
  invalid((leg, guide) => { guide.chapters.find(chapter => chapter.id === 'electronics').explanation = leg.explanation; }, /needs a motion action/);
});

test('reference workspace is an optional boolean capability and rejects truthy substitutes', () => {
  for (const value of [true, false]) { const { guide } = fixture(); guide.referenceWorkspace = value; assert.equal(validate(guide), guide); }
  const { guide } = fixture(); delete guide.referenceWorkspace; assert.equal(validate(guide), guide);
  for (const value of ['true', 1, 0, null, {}, []]) {
    invalid((_leg, candidate) => { candidate.referenceWorkspace = value; }, /referenceWorkspace must be a boolean/);
  }
});
