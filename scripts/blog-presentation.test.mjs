import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { renderPublishedMarkdown, blogSitemap } from './blog-presentation.mjs';
import { writePublishedPost } from './blog-content.mjs';

test('published Markdown exposes prose, code, tables and images without executable HTML', () => {
  const html = renderPublishedMarkdown('## Goals and memory\n\nReadable **human text**.\n\n```python\nprint("<goal>")\n```\n\n| A | B |\n| --- | --- |\n| x | y |\n\n![Diagram](/blog-images/diagram.png)\n\n<script>alert(1)</script><iframe src="https://example.com"></iframe><img src="javascript:alert(1)" onerror="alert(1)"><a href="jav&#x61;script:alert(1)">unsafe</a>');
  assert.match(html, /<h2>Goals and memory<\/h2>/);
  assert.match(html, /<strong>human text<\/strong>/);
  assert.match(html, /<table>/); assert.match(html, /language-python/);
  assert.match(html, /src="\/blog-images\/diagram.png"/);
  assert.ok(!/<script|<iframe|onerror=|href="javascript:|src="javascript:/i.test(html));
});

test('sitemap lists only homepage, public blog, and supplied published posts', () => {
  const xml = blogSitemap([{ slug: 'a-readable-post', publishedAt: '2026-11-04T00:00:00.000Z' }]);
  assert.match(xml, /<loc>https:\/\/www.jdkrasnick.com\/blog\/<\/loc>/);
  assert.match(xml, /\/blog\/a-readable-post\/<\/loc>/);
  assert.equal((xml.match(/<url>/g) || []).length, 3);
  assert.ok(!/editor|login|preview|\/api\//.test(xml));
});

test('published slugs cannot replace private authoring routes', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'blog-reserved-'));
  try {
    for (const slug of ['index', 'editor', 'login', 'logout', 'preview', 'post', 'type-preview', 'posts']) await assert.rejects(writePublishedPost({ id: 'safe-id', title: 'Title', slug, excerpt: '', tags: [], publishedAt: '2026-11-04T00:00:00Z', content: 'Public body.' }, directory), /Reserved blog URL slug/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
