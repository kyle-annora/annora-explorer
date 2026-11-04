// Stops in the 2.5-second HexapodLegReach clip. At one quarter the femur
// has lifted the foot; halfway is its furthest reach, and the end is rest.
export const LEG_POSES = [
  { id: 'lift', label: 'Lift', phaseStart: 0, phaseLabel: 'Lift the foot', progress: 0.25 },
  { id: 'reach', label: 'Reach', phaseStart: .38, phaseLabel: 'Reach outward', progress: 0.5 },
  { id: 'return', label: 'Return', phaseStart: .69, phaseLabel: 'Return to rest', progress: 1 },
];

export function currentLegPhase(progress) {
  return LEG_POSES.findLast(pose => progress >= pose.phaseStart) ?? LEG_POSES[0];
}
