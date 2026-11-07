/** Host template: connect your existing viewer without importing its renderer here.
 * Pass this descriptor to createIntegrationController from the distributed kit.js.
 * capture/restore must honor AbortSignal before every asynchronous mutation.
 * The host owns loading, input, animation, geometry and viewer disposal.
 */
export function createHostViewerAdapter({ id, adapterVersion, coordinateFrame, capabilities, capture, restore }) {
  return { version: '1', id, adapterVersion, coordinateFrame, capabilities: { ...capabilities }, capture, restore };
}

// Capture example (adapt actual names/coordinates; do not copy invented values):
// { part: { id: selected.id, title: selected.title }, snapshot: viewer.exportState() }
// Omit part when no part is selected. A capturedView adapter must always supply
// snapshot. It is opaque bounded JSON, not an Annora inspection/view command.
// Declare every capability explicitly: inquiry, selectedPart, capturedView,
// drawingDetail, story. Disabled capabilities must not appear in capture output.
