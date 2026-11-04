export const draftFields = ['title', 'excerpt', 'slug', 'tags', 'image', 'imageAlt', 'content'];
export const draftValues = draft => Object.fromEntries(draftFields.map(key => [key, key === 'tags' && Array.isArray(draft?.tags) ? draft.tags.join(', ') : draft?.[key] || '']));

// A conservative three-way merge: independent fields and non-overlapping text
// edits can be reconciled; overlapping edits always require the author's choice.
function edit(base, value) {
  let start = 0, end = base.length, nextEnd = value.length;
  while (start < end && start < nextEnd && base[start] === value[start]) start++;
  while (end > start && nextEnd > start && base[end - 1] === value[nextEnd - 1]) { end--; nextEnd--; }
  return { start, end, text: value.slice(start, nextEnd) };
}
function mergeText(base, mine, saved) {
  const a = edit(base, mine), b = edit(base, saved);
  // Touching edits may change the meaning of a word or Markdown delimiter.
  if (!(a.end < b.start || b.end < a.start)) return undefined;
  const [first, second] = [a, b].sort((x, y) => x.start - y.start);
  return base.slice(0, first.start) + first.text + base.slice(first.end, second.start) + second.text + base.slice(second.end);
}
export function mergeDraftEdits(baseDraft, mineDraft, savedDraft) {
  const base = draftValues(baseDraft), mine = draftValues(mineDraft), saved = draftValues(savedDraft);
  /** @type {Record<string, string>} */
  const values = {};
  const conflicts = [];
  for (const key of draftFields) {
    if (mine[key] === saved[key] || saved[key] === base[key]) values[key] = mine[key];
    else if (mine[key] === base[key]) values[key] = saved[key];
    else {
      const merged = key === 'content' ? mergeText(base[key], mine[key], saved[key]) : undefined;
      if (merged === undefined) { conflicts.push(key); values[key] = mine[key]; }
      else values[key] = merged;
    }
  }
  return { values, conflicts };
}
export const sameDraftValues = (a, b) => {
  const left = draftValues(a), right = draftValues(b);
  return draftFields.every(key => left[key] === right[key]);
};
