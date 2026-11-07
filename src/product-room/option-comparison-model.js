/** Comparison facts retain their authored meaning; absence is never a benefit or a price. */
export function optionComparisonRows(optionSet) {
  const options = optionSet?.options || [];
  const labels = [...new Set(options.flatMap(option => (option.facts || []).map(fact => fact.label)))];
  return labels.map(label => ({
    label,
    values: options.map(option => ({
      optionId: option.id,
      optionTitle: option.title,
      value: option.facts?.find(fact => fact.label === label)?.value ?? 'Not specified',
    })),
  }));
}

/** Never use a newer package to label an older preference. */
export function preferenceReceipt(optionSet, preference) {
  if (!preference) return { title: 'No preference confirmed', available: true };
  if (preference.optionSetId !== optionSet?.id || preference.optionSetVersion !== optionSet?.version)
    return { title: 'Original package reference unavailable', available: false };
  if (preference.choice === 'help-me-decide') return { title: 'Help me decide', available: true };
  const option = optionSet.options?.find(item => item.id === preference.optionId);
  return option
    ? { title: option.title, available: true }
    : { title: 'Original option unavailable', available: false };
}

export function preferenceInput(preference) {
  return { choice: preference?.choice || '', optionId: preference?.optionId || null, notes: preference?.notes || '' };
}

export function optionSourceKey(project) {
  return JSON.stringify([project?.id, project?.revision, project?.approvedOptionSet, project?.optionPreferences]);
}
