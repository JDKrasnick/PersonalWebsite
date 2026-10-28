import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MarkdownManager } from '@tiptap/markdown';
import StarterKit from '@tiptap/starter-kit';
import { TableKit } from '@tiptap/extension-table';
import Image from '@tiptap/extension-image';
import { exampleContent } from './blog-dev.mjs';
import { collectDemos, demoFence, exampleDemo } from '../src/lib/blog-demos.js';

const markdown = new MarkdownManager({ extensions: [StarterKit.configure({ underline: false }), TableKit, Image] });
for (const [name, source] of [
  ['existing example article, including its table and Python code', exampleContent],
  ['links, emphasis, images and nested lists', '# A technical note\n\n**Bold**, *italic*, and [a link](https://example.com).\n\n![A diagram](https://example.com/diagram.png)\n\n- First item\n  - A nested item\n- Last item\n\n> A quoted observation.'],
  ['code whitespace and fenced language', '## Code\n\n```python\ndef run():\n    x = "a | b"\n    return x\n```\n\nInline `x = 1` stays code.'],
]) {
  test(`visual editor preserves ${name} through Markdown serialization`, () => {
    const parsed = markdown.parse(source);
    const serialized = markdown.serialize(parsed);
    assert.deepEqual(markdown.parse(serialized), parsed);
    assert.ok(serialized.trim().length > 0);
  });
}

test('demo JSON stays machine-editable after visual editor round-trips', () => {
  const source = `Before.\n${demoFence(exampleDemo)}\nAfter.\n`;
  const serialized = markdown.serialize(markdown.parse(source));
  assert.deepEqual(collectDemos(serialized), [exampleDemo]);
  assert.ok(serialized.includes('```demo'));
  assert.deepEqual(markdown.parse(serialized), markdown.parse(source));
});
