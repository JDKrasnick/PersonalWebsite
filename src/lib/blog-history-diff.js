// Bound the changed middle so a large rewrite cannot freeze the editor.
export function diffSequence(before, after) {
  let start = 0, oldEnd = before.length, newEnd = after.length;
  while (start < oldEnd && start < newEnd && before[start] === after[start]) start++;
  while (oldEnd > start && newEnd > start && before[oldEnd - 1] === after[newEnd - 1]) { oldEnd--; newEnd--; }
  const result = before.slice(0, start).map(value => ({ type: 'equal', value }));
  const old = before.slice(start, oldEnd), next = after.slice(start, newEnd);
  if (old.length * next.length > 250_000) {
    for (const value of old) result.push({ type: 'removed', value });
    for (const value of next) result.push({ type: 'added', value });
  } else {
    const table = Array.from({ length: old.length + 1 }, () => new Uint32Array(next.length + 1));
    for (let i = old.length - 1; i >= 0; i--) for (let j = next.length - 1; j >= 0; j--) table[i][j] = old[i] === next[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
    let i = 0, j = 0;
    while (i < old.length || j < next.length) {
      if (i < old.length && j < next.length && old[i] === next[j]) { result.push({ type: 'equal', value: old[i++] }); j++; }
      else if (i < old.length && (j === next.length || table[i + 1][j] >= table[i][j + 1])) result.push({ type: 'removed', value: old[i++] });
      else result.push({ type: 'added', value: next[j++] });
    }
  }
  for (let index = oldEnd; index < before.length; index++) result.push({ type: 'equal', value: before[index] });
  return result;
}

export const wordDiff = (before, after) => diffSequence(before.match(/\s+|[\p{L}\p{N}_]+|[^\s\p{L}\p{N}_]/gu) || [], after.match(/\s+|[\p{L}\p{N}_]+|[^\s\p{L}\p{N}_]/gu) || []);
