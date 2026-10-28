import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseDemoConfig, collectDemos, demoFence, exampleDemo } from '../src/lib/blog-demos.js';
import { validateDemoAssets, writePublishedPost, readPublishedPosts } from './blog-content.mjs';

test('demo config is small, explicit, and limited to local HTML demos', () => {
  assert.deepEqual(parseDemoConfig(JSON.stringify(exampleDemo)), exampleDemo);
  assert.equal(parseDemoConfig(JSON.stringify({ src: '/blog-demos/nested/example.html', title: ' Example ' })).height, 420);
  for (const src of ['https://example.com/demo.html', '//example.com/demo.html', 'javascript:alert(1)', '/api/blog/drafts', '/blog-demos/../private.html', '/blog-demos/%2e%2e/private.html', '/blog-demos/demo.html?src=external', '/blog-demos/demo.html#x']) assert.throws(() => parseDemoConfig(JSON.stringify({ ...exampleDemo, src })));
  for (const data of ['{invalid', 'null', '[]', JSON.stringify({ ...exampleDemo, height: '420' }), JSON.stringify({ ...exampleDemo, height: 2000 }), JSON.stringify({ ...exampleDemo, title: '' }), JSON.stringify({ ...exampleDemo, sandbox: 'allow-same-origin' })]) assert.throws(() => parseDemoConfig(data));
});

test('only actual demo fences are embedded, including nested Markdown blocks', () => {
  const source = `Before.\n${demoFence(exampleDemo)}\nAfter.\n\n> ${demoFence(exampleDemo).trim().split('\n').join('\n> ')}\n`;
  assert.deepEqual(collectDemos(source), [exampleDemo, exampleDemo]);
  assert.deepEqual(collectDemos('````markdown\n' + demoFence(exampleDemo) + '\n````'), []);
  assert.deepEqual(collectDemos('```javascript\nconsole.log("hello");\n```'), []);
  assert.throws(() => collectDemos('```demo\n{broken json}\n```'));
});

test('demo assets must exist when preparing or building a post, and Markdown round-trips', async t => {
  const root = await mkdtemp(join(tmpdir(), 'blog-demos-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const content = `## Try it\n${demoFence(exampleDemo)}\nBack to the article.`;
  await assert.rejects(validateDemoAssets(content, root), /Demo file not found/);
  await mkdir(join(root, 'blog-demos'));
  await writeFile(join(root, 'blog-demos/gradient-descent.html'), '<!doctype html><title>Demo</title>');
  assert.deepEqual(await validateDemoAssets(content, root), [exampleDemo]);
  const directory = join(root, 'posts');
  await writePublishedPost({ id: 'demo-test', title: 'A demo', slug: 'a-demo', excerpt: '', tags: ['Engineering'], publishedAt: '2026-10-28T00:00:00Z', content }, directory);
  const [post] = await readPublishedPosts(directory);
  assert.equal(post.content, content);
  assert.deepEqual(collectDemos(post.content), [exampleDemo]);
});
