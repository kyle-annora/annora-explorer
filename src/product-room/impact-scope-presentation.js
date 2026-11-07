/** Explicit snapshot input prevents current-project references leaking into history. */
export function impactReferenceRows(snapshot, lineItems = []) {
  return (snapshot?.entries || []).map(entry => {
    const drawing = entry.context?.drawing;
    return {
      ...entry,
      kindLabel: entry.kind === 'question' ? 'Question' : 'Quotation scope',
      decisionLabel: ({confirmed:'New reference confirmed',retained:'Earlier reference retained',omitted:'Excluded from new scope'})[entry.decision] || 'Needs review',
      versionLabel: drawing ? `${drawing.revisionLabel || drawing.revision} · ${drawing.regionLabel}` : 'No replacement reference',
      lines: (entry.lineIds || []).map(id => ({ id, label: lineItems.find(line => line.id === id)?.label || 'Unavailable quotation line' })),
    };
  });
}
