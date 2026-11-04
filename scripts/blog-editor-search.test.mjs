import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Schema } from '@tiptap/pm/model';
import { EditorState } from '@tiptap/pm/state';
import { textMatches, documentMatches } from '../src/lib/blog-editor-search.js';

test('find treats regex punctuation and replacement text literally', () => {
  assert.deepEqual(textMatches('A [goal]. a [GOAL].', '[goal].'), [{ from: 2, to: 9 }, { from: 12, to: 19 }]);
  assert.equal(textMatches('a A', 'a', true).length, 1);
  assert.deepEqual(textMatches('abc', ''), []);
  assert.deepEqual(textMatches('aaa', 'aa'), [{ from: 0, to: 2 }]);
});

test('rich-text find spans marks but keeps separate paragraphs and inline atoms apart', () => {
  const schema = new Schema({ nodes: { doc: { content: 'paragraph+' }, paragraph: { content: 'inline*', group: 'block' }, text: { group: 'inline' }, image: { inline: true, group: 'inline' } }, marks: { bold: {} } });
  const p = (...children) => schema.node('paragraph', null, children);
  const doc = schema.node('doc', null, [p(schema.text('goal '), schema.text('memory', [schema.mark('bold')])), p(schema.text('goal'), schema.node('image'), schema.text('memory'))]);
  assert.deepEqual(documentMatches(doc, 'goal memory'), [{ from: 1, to: 12 }]);
  assert.equal(documentMatches(doc, 'memorygoal').length, 0);
  const found = documentMatches(doc, 'goal');
  const tr = EditorState.create({ doc }).tr;
  for (const match of found.reverse()) tr.insertText('$target', match.from, match.to);
  assert.equal(tr.doc.textContent, '$target memory$targetmemory');
  assert.ok(tr.doc.firstChild.lastChild.marks.some(mark => mark.type.name === 'bold'));
});
