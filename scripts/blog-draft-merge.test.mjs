import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeDraftEdits, sameDraftValues } from '../src/lib/blog-draft-merge.js';
const base = { title: 'A post', excerpt: 'Description', tags: ['Research'], content: 'First paragraph.\n\nMiddle paragraph.\n\nLast paragraph.' };
test('merges independent fields while preserving newer saved text', () => {
  const mine = { ...base, title: 'My title' }, saved = { ...base, content: 'A newer body', revision: 3 };
  const merged = mergeDraftEdits(base, mine, saved);
  assert.deepEqual(merged.conflicts, []);
  assert.equal(merged.values.title, mine.title); assert.equal(merged.values.content, saved.content);
  assert.equal(merged.values.tags, 'Research');
});
test('merges separated edits within the same article', () => {
  const mine = { ...base, content: base.content.replace('First', 'Opening') };
  const saved = { ...base, content: base.content.replace('Last', 'Closing') };
  const merged = mergeDraftEdits(base, mine, saved);
  assert.deepEqual(merged.conflicts, []);
  assert.equal(merged.values.content, base.content.replace('First', 'Opening').replace('Last', 'Closing'));
});
test('identical retries reconcile after a lost save response', () => {
  const mine = { ...base, content: 'Updated body' };
  assert.deepEqual(mergeDraftEdits(base, mine, { ...mine, revision: 8 }).conflicts, []);
  assert.equal(sameDraftValues(mine, { ...mine, revision: 8 }), true);
});
test('overlapping, adjacent, and competing insertions require an explicit choice', () => {
  for (const [body, mine, saved] of [['word', 'Word', 'ward'], ['abc', 'aXbc', 'aYbc'], ['abc', 'aXc', 'abY']]) {
    assert.deepEqual(mergeDraftEdits({ content: body }, { content: mine }, { content: saved }).conflicts, ['content']);
  }
  assert.deepEqual(mergeDraftEdits(base, { ...base, title: 'Mine' }, { ...base, title: 'Saved' }).conflicts, ['title']);
});
