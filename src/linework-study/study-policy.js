import { renderPixelRatio } from "../explorer/performance.js";

export const STUDY_VARIANTS = Object.freeze({
  baseline: Object.freeze({ clarity: false, density: false }),
  clarity: Object.freeze({ clarity: true, density: false }),
  density: Object.freeze({ clarity: false, density: true }),
  combined: Object.freeze({ clarity: true, density: true }),
});

export function studyVariant(id) {
  if (!Object.hasOwn(STUDY_VARIANTS, id)) throw new RangeError("Unknown linework treatment");
  return STUDY_VARIANTS[id];
}

/** Pixel and multisample allocations stay fixed throughout an orbit. */
export function studySampling({ variant, quality, width, height, devicePixelRatio, supportedSamples = [] }) {
  const baseline = renderPixelRatio({ quality, renderStyle: "linework", width, height, devicePixelRatio });
  if (!studyVariant(variant).clarity) return { pixelRatio: baseline, samples: 0 };
  const compact = width <= 600 || height <= 480;
  const budget = quality === "performance" ? 1_600_000 : compact ? 2_000_000 : 4_000_000;
  const desired = Math.min(2.5, Math.max(1.75, devicePixelRatio * 1.2));
  const area = Math.max(1, width * height);
  // Compact clarity normally targets 2M pixels. An explicit Quality baseline
  // can already exceed that target. Retain its resolution while staying within
  // the shared global 4M limit so Clarity never undersamples its control.
  const pixelRatio = Math.max(baseline, Math.min(desired, Math.sqrt(budget / area)));
  // Some mobile implementations only support four samples. Bound the total
  // per-target sample allocation, and fall back to supersampling when needed.
  const sampleBudget = quality === "performance" ? 3_200_000 : compact ? 4_000_000 : 8_000_000;
  const pixels = area * pixelRatio ** 2;
  const samples = [2, 4].find(value => supportedSamples.includes(value) && pixels * value <= sampleBudget + 1) ?? 0;
  return { pixelRatio, samples };
}

// A role belongs to the experiment's Hexapod configuration. The renderer only
// receives scale/floor attributes and can reuse the same shader for every part.
export function studyPartRole(name) {
  if (/^Hex_electronics/i.test(name)) return "electronics";
  if (/_motor_/i.test(name)) return "motor";
  return "structural";
}

export function groupTreatment({ span, partSpan, segmentCount, closed, role, contour }) {
  const relativeSize = span / Math.max(partSpan, 1e-9);
  const roleScale = role === "electronics" ? 2.8 : role === "motor" ? 1.65 : 1;
  // A finely tessellated hole remains one curve. Dense, branching feature
  // networks need a larger on-screen footprint before all their ink is useful.
  const congestion = closed ? 1 : Math.max(1, Math.sqrt(segmentCount / (contour ? 48 : 24)));
  const effectiveSpan = span / (roleScale * congestion);
  const broad = relativeSize > 0.32;
  let floor = 0;
  if (contour && broad) floor = role === "structural" ? 0.83 : role === "motor" ? 0.53 : 0.36;
  else if (!contour && broad && role === "structural") floor = 0.30;
  return { effectiveSpan, floor };
}
