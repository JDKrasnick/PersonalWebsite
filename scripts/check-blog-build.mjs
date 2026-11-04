import assert from 'node:assert/strict';
import { readdir, readFile, access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { readPublishedPosts, validateDemoAssets } from './blog-content.mjs';

const output = resolve('.vercel/output/static');
for (const route of ['editor', 'login', 'preview', 'logout']) await assert.rejects(access(resolve(output, `blog/${route}/index.html`)), 'Private writing pages must not be exported as static HTML.');
await assert.rejects(access(resolve(output, '.local/blog.json')), 'Local drafts must never enter the public build.');
const posts = JSON.parse(await readFile(resolve(output, 'blog/posts.json'), 'utf8'));
assert.deepEqual(posts, await readPublishedPosts(), 'Only prepared Markdown files may enter the public feed.');
assert.deepEqual(await readPublishedPosts(resolve('.vercel/output/functions/_render.func/content/blog')), posts, 'Legacy links need the prepared articles packaged with the server.');
for (const post of posts) await validateDemoAssets(post.content, output);
for (const page of ['blog/index.html', ...posts.map(post => `blog/${post.slug}/index.html`)]) {
  const html = await readFile(resolve(output, page), 'utf8');
  assert.ok(!html.includes('href="/blog/editor'), 'Public pages must not link to authoring controls.');
  assert.ok(!html.includes('noindex, nofollow'), 'Published blog pages must be indexable.');
}
const index = await readFile(resolve(output, 'blog/index.html'), 'utf8');
const sitemap = await readFile(resolve(output, 'sitemap.xml'), 'utf8');
assert.ok(sitemap.includes('<loc>https://www.jdkrasnick.com/blog/</loc>'), 'Crawlers must discover the public blog.');
for (const post of posts) {
  const html = await readFile(resolve(output, `blog/${post.slug}/index.html`), 'utf8');
  assert.ok(html.includes(`data-post-id="${post.id}"`) && html.includes('class="prose"'), 'Published article content must be in the initial HTML.');
  assert.ok(index.includes(`/blog/${post.slug}`) && sitemap.includes(`/blog/${post.slug}/</loc>`), 'Every published article must be linked and in the sitemap.');
  assert.ok(html.includes('BlogPosting') && html.includes('rel="canonical"'), 'Articles must include structured data and a canonical URL.');
}
for (const path of ['/blog/editor', '/blog/login', '/blog/preview', '/blog/logout', '/api/blog/']) assert.ok(!sitemap.includes(path), 'Private routes must stay out of the sitemap.');
const assets = await readdir(resolve(output, '_astro'));
for (const file of assets.filter(file => file.endsWith('.js'))) {
  const script = await readFile(resolve(output, '_astro', file), 'utf8');
  for (const privateText of ['BLOG_EDITOR_PASSWORD_HASH', 'BLOG_EDITOR_SESSION_SECRET', 'BLOG_DRAFT_BLOB_TOKEN', 'scrypt$32768$']) assert.ok(!script.includes(privateText), `${privateText} must not ship in public JavaScript.`);
}
const generated = JSON.parse(await readFile('.vercel/output/config.json', 'utf8'));
assert.ok(generated.routes.some(route => route.src?.includes('/api/comments') && route.dest === '_render'), 'The anonymous comments API must be deployed.');
for (const path of ['/blog/editor', '/blog/login', '/blog/preview', '/blog/logout', '/api/blog/']) assert.ok(generated.routes.some(route => route.src?.includes(path) && route.dest === '_render'), `${path} must use authenticated server rendering.`);
const custom = JSON.parse(await readFile('vercel.json', 'utf8'));
const commentRoute = custom.routes.findIndex(route => route.src === '^/api/comments/?$');
assert.ok(commentRoute >= 0 && commentRoute < custom.routes.findIndex(route => route.src === '/(.*)'), 'Comment API routing must precede the homepage fallback.');
for (const path of ['/api/contributions', '/api/github-activity']) {
  assert.ok(generated.routes.some(route => route.src === `^${path}/?$` && route.dest === '_render'), `${path} must be in the server build.`);
  const index = custom.routes.findIndex(route => route.src === `^${path}/?$` && route.dest === '/_render');
  assert.ok(index >= 0 && index < custom.routes.findIndex(route => route.src === '/(.*)'), `${path} must route before the homepage fallback.`);
}
console.log(`Build boundary verified: ${posts.length} prepared post(s), private writing stays server-rendered, no draft files or credentials in public output.`);
