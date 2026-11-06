/** Leave through the workspace's save gate, then reopen its actual reference.
 * The incoming route may describe a newer view than the draft the buyer kept. */
export async function openWorkspaceReference({workspace, modelId, open}) {
  const context = workspace?.getContext?.();
  if (!context || context.modelId !== modelId) return false;
  if (!(await workspace.beforeLeave({view:'explore'}))) return true;
  try {
    const saved = workspace.getContext();
    if (!saved || saved.modelId !== modelId) throw new Error('The inquiry reference changed while it was being saved. Please try again.');
    await open(saved);
    return true;
  } catch (error) {
    workspace.cancelLeave?.();
    throw error;
  }
}
