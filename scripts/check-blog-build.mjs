import assert from 'node:assert/strict';
import { readdir, readFile, access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { readPublishedPosts, validateDemoAssets } from './blog-content.mjs';

const output = resolve('.vercel/output/static');
await assert.rejects(access(resolve(output, 'blog/editor/index.html')), 'The private editor must not be exported.');
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
  for (const privateText of ['/api/blog/', 'Prepare for GitHub', 'post-content', 'Update GitHub file', 'comment-remove']) assert.ok(!script.includes(privateText), `${privateText} must not ship in public JavaScript.`);
}
const generated = JSON.parse(await readFile('.vercel/output/config.json', 'utf8'));
assert.ok(generated.routes.some(route => route.src?.includes('/api/comments') && route.dest === '_render'), 'The anonymous comments API must be deployed.');
assert.ok(!generated.routes.some(route => route.src?.includes('/blog/editor') || route.src?.includes('/api/blog')), 'Author routes must not be deployed.');
const custom = JSON.parse(await readFile('vercel.json', 'utf8'));
const commentRoute = custom.routes.findIndex(route => route.src === '^/api/comments/?$');
assert.ok(commentRoute >= 0 && commentRoute < custom.routes.findIndex(route => route.src === '/(.*)'), 'Comment API routing must precede the homepage fallback.');
console.log(`Build boundary verified: ${posts.length} prepared post(s), no editor or authoring API, public comment API present.`);
