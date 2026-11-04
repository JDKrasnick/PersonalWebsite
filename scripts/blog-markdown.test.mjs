import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MarkdownManager } from '@tiptap/markdown';
import StarterKit from '@tiptap/starter-kit';
import { TableKit } from '@tiptap/extension-table';
import Image from '@tiptap/extension-image';
import { exampleContent } from './blog-dev.mjs';
import { collectDemos, demoFence, exampleDemo } from '../src/lib/blog-demos.js';
import { renderPublishedMarkdown } from './blog-presentation.mjs';

const markdown = new MarkdownManager({ extensions: [StarterKit.configure({ underline: false }), TableKit, Image] });
for (const [name, source] of [
  ['existing example article, including its table and Python code', exampleContent],
  ['links, emphasis, images and nested lists', '# A technical note\n\n**Bold**, *italic*, and [a link](https://example.com).\n\n![A diagram](https://example.com/diagram.png)\n\n- First item\n  - A nested item\n- Last item\n\n> A quoted observation.'],
  ['code whitespace and fenced language', '## Code\n\n```python\ndef run():\n    x = "a | b"\n    return x\n```\n\nInline `x = 1` stays code.'],
  ['expanded formatting and numbered lists', '### A smaller heading\n\n~~Removed~~ and `inline code`.\n\n> A quoted paragraph.\n\n1. First\n2. Second\n\n---\n\n#### Details\n\nMore text.'],
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

test('article rendering preserves the visual editor’s intentional blank paragraphs', () => {
  for (const source of [
    'First paragraph.\n\nSecond paragraph.',
    'First paragraph.\n\n\n\nSecond paragraph.',
    'First paragraph.\n\n\n\n\n\nSecond paragraph.',
    '## Heading\n\n\n\nFollowing paragraph.',
    'Before.\n\n\n\n- One\n- Two\n\n\n\nAfter.',
    '\n\nBefore.\n\n\n\n',
    '```text\nFirst\n\n\n\nLast\n```\n\n\n\nFollowing paragraph.',
  ]) {
    const expected = markdown.parse(source).content.filter(node => node.type === 'paragraph' && !node.content?.length).length;
    const html = renderPublishedMarkdown(source);
    assert.equal((html.match(/<p><br\s*\/?>\s*<\/p>/g) || []).length, expected, JSON.stringify(source));
  }
});

test('spacing preservation leaves literal code and normal paragraph spacing intact', () => {
  assert.equal(renderPublishedMarkdown('First.\n\nSecond.'), '<p>First.</p>\n<p>Second.</p>\n');
  const html = renderPublishedMarkdown('```text\nFirst\n\n\n\nLast\n```');
  assert.match(html, /First\n\n\n\nLast/);
  assert.ok(!html.includes('<p><br'));
});
