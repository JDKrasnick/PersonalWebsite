import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diffSequence, wordDiff } from '../src/lib/blog-history-diff.js';

for (const [name, before, after] of [
  ['insertion', 'Models are useful.', 'Smaller models are useful.'],
  ['deletion', 'A slow, expensive agent.', 'A fast agent.'],
  ['Unicode', '日本語 🧪 one', '日本語 🧪 two'],
  ['repeated words', 'one two one two', 'one one two two'],
  ['spacing', 'one\n\ntwo', 'one two\n'],
  ['empty before', '', 'new words'],
  ['empty after', 'removed words', ''],
  ['unchanged', 'Keep **formatting**.', 'Keep **formatting**.'],
]) test(`history word diff preserves both versions: ${name}`, () => {
  const diff = wordDiff(before, after);
  assert.equal(diff.filter(part => part.type !== 'added').map(part => part.value).join(''), before);
  assert.equal(diff.filter(part => part.type !== 'removed').map(part => part.value).join(''), after);
  if (before === after) assert.ok(diff.every(part => part.type === 'equal'));
});

test('large rewrites use a bounded fallback without truncation or argument-stack overflow', () => {
  const before = Array.from({ length: 150_000 }, () => 'old');
  const after = Array.from({ length: 150_000 }, () => 'new');
  const diff = diffSequence(before, after);
  assert.equal(diff.filter(part => part.type === 'removed').length, before.length);
  assert.equal(diff.filter(part => part.type === 'added').length, after.length);
});
