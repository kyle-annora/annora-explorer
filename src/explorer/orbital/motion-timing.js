// Presentation holds wrap the original clip; they never change its joint poses.
export function sampleMotionProgress(progress, playbackWindow = [0, 1]) {
  const [start, end] = playbackWindow;
  return Math.max(0, Math.min(1, (progress - start) / (end - start)));
}

export function activeExplanationJoint(progress, cues = []) {
  return cues.findLast(([at]) => progress >= at)?.[1] ?? -1;
}
