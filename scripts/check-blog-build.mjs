import assert from 'node:assert/strict';
import { readdir, readFile, access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { readPublishedPosts, validateDemoAssets } from './blog-content.mjs';

const output = resolve('.vercel/output/static');
for (const route of ['editor', 'login', 'preview', 'logout']) await assert.rejects(access(resolve(output, `blog/${route}/index.html`)), 'Private writing pages must not be exported as static HTML.');
await assert.rejects(access(resolve(output, '.local/blog.json')), 'Local drafts must never enter the public build.');
const posts = JSON.parse(await readFile(resolve(output, 'blog/posts.json'), 'utf8'));
assert.deepEqual(posts, await readPublishedPosts(), 'Only prepared Markdown files may enter the public feed.');
for (const post of posts) await validateDemoAssets(post.content, output);
for (const page of ['blog/index.html', 'blog/post/index.html']) {
  const html = await readFile(resolve(output, page), 'utf8');
  assert.ok(!html.includes('href="/blog/editor'), 'Public pages must not link to authoring controls.');
  assert.ok(!html.includes('noindex, nofollow'), 'Published blog pages must be indexable.');
}
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
