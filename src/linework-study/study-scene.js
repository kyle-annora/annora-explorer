import { AssemblyScene } from "../explorer/scene.js";
import { abortable, throwIfAborted } from "../explorer/network-load.js";
import { QUALITY_PROFILES } from "../explorer/performance.js";
import { prepareStudyLinework } from "./study-linework.js";
import { studySampling, studyVariant } from "./study-policy.js";

function supportedTargetSamples(renderer) {
  const gl = renderer.getContext();
  if (gl.isContextLost()) return [];
  // EffectComposer uses RGBA16F with a depth attachment.
  const color = gl.getInternalformatParameter(gl.RENDERBUFFER, gl.RGBA16F, gl.SAMPLES) || [];
  const depth = gl.getInternalformatParameter(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, gl.SAMPLES) || [];
  return Array.from(color).filter(value => depth.includes(value));
}

export class StudyScene extends AssemblyScene {
  constructor(...args) {
    super(...args);
    this.studyVariant = "baseline";
    this.sampleSupport = supportedTargetSamples(this.renderer);
    // Each treatment must use its declared pixel budget for the entire trial.
    this.adaptive.observe = () => false;
  }

  async prepareEdges(options = {}) {
    await super.prepareEdges(options);
    throwIfAborted(this.abort.signal);
    if (!this.studyPreparation) {
      const original = this.lineRuntime;
      this.studyPreparation = prepareStudyLinework(original, Array.from(this.meshes.values()), this.edgeMetadata, this.abort.signal)
        .then(runtime => {
          if (this.abort.signal.aborted) {
            runtime.dispose();
            throwIfAborted(this.abort.signal);
          }
          this.lineRuntime = runtime;
          runtime.setDensity(studyVariant(this.studyVariant).density);
          this.invalidate();
        })
        .catch(error => {
          this.studyPreparation = null;
          throw error;
        });
    }
    await abortable(this.studyPreparation, this.abort.signal, options.signal);
  }

  setStudyVariant(id) {
    const treatment = studyVariant(id);
    if (this.disposed) return;
    this.studyVariant = id;
    this.lineRuntime?.setDensity?.(treatment.density);
    this.resizeDrawingBuffer();
    this.invalidate();
    return this.getStudyStats();
  }

  resizeDrawingBuffer() {
    // The parent constructor sizes its Engineering stage before study setup.
    if (!this.studyVariant) return super.resizeDrawingBuffer();
    const width = this.mount.clientWidth, height = this.mount.clientHeight;
    if (this.disposed || !width || !height) return;
    const plan = studySampling({
      variant: this.studyVariant, quality: this.effectiveQuality,
      width, height, devicePixelRatio, supportedSamples: this.sampleSupport,
    });
    const { pixelRatio, samples } = plan;
    for (const target of [this.composer.renderTarget1, this.composer.renderTarget2]) {
      if (target.samples !== samples) {
        target.dispose();
        target.samples = samples;
      }
    }
    const profile = QUALITY_PROFILES[this.effectiveQuality];
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(width, height);
    this.composer.setPixelRatio(pixelRatio);
    this.composer.setSize(width, height);
    this.ao.setSize(Math.round(width * pixelRatio * (profile.aoScale || 0.5)), Math.round(height * pixelRatio * (profile.aoScale || 0.5)));
    this.outline.downSampleRatio = 1 / profile.outlineScale;
    this.outline.setPixelRatio?.(pixelRatio);
    this.outline.setSize(width * pixelRatio, height * pixelRatio);
    this.fxaa.material.uniforms.resolution.value.set(1 / (width * pixelRatio), 1 / (height * pixelRatio));
    this.lineRuntime?.resize(width, height, pixelRatio);
    this.mount.dataset.pixelRatio = String(pixelRatio);
    this.invalidate();
  }

  getStudyStats() {
    const variant = this.studyVariant || "baseline", canvas = this.renderer.domElement;
    const lines = this.lineRuntime?.stats;
    return {
      variant, ...studyVariant(variant),
      quality: this.effectiveQuality,
      pixelRatio: this.renderer.getPixelRatio(), bufferWidth: canvas.width, bufferHeight: canvas.height,
      samples: this.composer.renderTarget1.samples, renderedFrames: this.renderCount || 0,
      drawCalls: this.renderer.info.render.calls,
      creaseSegments: lines?.edgeSegments || 0, contourCandidates: lines?.silhouetteSegments || 0,
      featureGroups: lines?.featureGroups || 0, contourGroups: lines?.contourGroups || 0,
      densityBytes: lines?.densityBytes || 0, detailPreparationMs: lines?.detailPreparationMs || 0,
    };
  }
}
