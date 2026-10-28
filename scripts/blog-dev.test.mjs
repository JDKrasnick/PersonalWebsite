import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, request as httpRequest } from 'node:http';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { blogDevPlugin } from './blog-dev.mjs';
import { readPublishedPosts } from './blog-content.mjs';

async function start(directory) {
  let middleware;
  blogDevPlugin({ directory, publishedDirectory: join(directory, 'published') }).configureServer({ middlewares: { use(_path, handler) { middleware = handler; } }, config: { logger: { error() {} } } });
  const server = createServer((req, res) => { req.url = req.url.replace(/^\/api\/blog/, ''); void middleware(req, res); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = async (path, body, headers = {}) => {
    const response = await fetch(`${base}/api/blog/${path}`, { ...(body === undefined ? {} : { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json', ...headers } }) });
    return { status: response.status, data: await response.json() };
  };
  return { request, base, close: () => new Promise(resolve => server.close(resolve)) };
}

test('local blog: durable lifecycle, draft isolation, conflicts, validation and request boundaries', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'jd-blog-test-'));
  let app = await start(directory);
  t.after(async () => { await app.close(); await rm(directory, { recursive: true, force: true }); });
  let post;
  await t.test('preserves Unicode when a request splits a multibyte character', async () => {
    const content = 'An experiment — with Unicode 日本語 🧪';
    const payload = Buffer.from(JSON.stringify({ title: 'Unicode', slug: 'unicode-check', excerpt: '', tags: '', content }));
    const split = payload.indexOf(Buffer.from('—')) + 1;
    const result = await new Promise((resolve, reject) => {
      const req = httpRequest(`${app.base}/api/blog/save`, { method: 'POST', headers: { 'Content-Type': 'application/json' } }, res => {
        let data = ''; res.on('data', chunk => { data += chunk; }); res.on('end', () => resolve(JSON.parse(data)));
      });
      req.on('error', reject); req.write(payload.subarray(0, split));
      setTimeout(() => { req.end(payload.subarray(split)); }, 10);
    });
    assert.equal(result.content, content);
    await app.request('delete', { id: result.id, revision: result.revision });
  });
  await t.test('creates a draft without publishing it', async () => {
    const response = await app.request('save', { title: 'Testing agents', slug: 'testing-agents', excerpt: 'An experiment.', tags: 'AI, Research', icon: 'code', image: '/images/experiment.png', imageAlt: 'Experiment results', content: '# Setup\n\nA first version.' });
    assert.equal(response.status, 200); post = response.data;
    assert.equal(post.revision, 1);
    assert.equal((await app.request('posts')).data.some(p => p.id === post.id), false);
  });
  await t.test('drafts can contain unfinished demo config, but preparing requires a valid demo file', async () => {
    const draft = (await app.request('save', { title: 'Demo validation', slug: 'demo-validation', excerpt: '', tags: '', content: '```demo\n{"src":"/blog-demos/missing.html","title":"Missing"}\n```' })).data;
    assert.ok(draft.id);
    assert.equal((await app.request('publish', { id: draft.id, revision: draft.revision })).status, 400);
    assert.equal((await readPublishedPosts(join(directory, 'published'))).some(p => p.id === draft.id), false);
    await app.request('delete', { id: draft.id, revision: draft.revision });
  });
  await t.test('publishes and retains the previous version while editing', async () => {
    post = (await app.request('publish', { id: post.id, revision: post.revision })).data;
    assert.equal(post.published.content, '# Setup\n\nA first version.');
    post = (await app.request('save', { ...post, tags: 'AI, Research', icon: 'research', image: 'https://example.com/revised.png', imageAlt: 'Revised results', content: 'Private second version.' })).data;
    const publicPost = (await app.request('posts')).data.find(p => p.id === post.id);
    assert.equal(publicPost.content, '# Setup\n\nA first version.');
    assert.equal(publicPost.icon, 'code');
    assert.equal(publicPost.image, '/images/experiment.png');
    assert.equal(publicPost.imageAlt, 'Experiment results');
    assert.equal(post.image, 'https://example.com/revised.png');
    assert.equal(post.icon, 'research');
    assert.equal(post.content, 'Private second version.');
  });
  await t.test('rejects stale revisions and duplicate slugs', async () => {
    assert.equal((await app.request('save', { ...post, revision: 1, tags: 'AI' })).status, 409);
    assert.equal((await app.request('save', { title: 'Duplicate', slug: post.slug, excerpt: '', tags: '', content: 'Collision' })).status, 409);
    assert.equal((await app.request('publish', { id: post.id, revision: 1 })).status, 409);
    assert.equal((await app.request('delete', { id: post.id, revision: 1 })).status, 409);
  });
  await t.test('serializes writes and prevents competing lost updates', async () => {
    const results = await Promise.all([app.request('save', { ...post, title: 'Winner A', tags: 'AI' }), app.request('save', { ...post, title: 'Winner B', tags: 'AI' })]);
    assert.deepEqual(results.map(r => r.status).sort(), [200, 409]);
    post = results.find(r => r.status === 200).data;
  });
  await t.test('exports reviewed Markdown only and removes obsolete comment write endpoints', async () => {
    const exported = await readPublishedPosts(join(directory, 'published'));
    assert.equal(exported.find(p => p.id === post.id).content, '# Setup\n\nA first version.');
    assert.equal(exported.find(p => p.id === post.id).image, '/images/experiment.png');
    assert.equal((await app.request('comments', { postId: post.id, name: 'Test', content: 'No bypass' })).status, 404);
    post = (await app.request('unpublish', { id: post.id, revision: post.revision })).data;
    assert.equal((await readPublishedPosts(join(directory, 'published'))).length, 0);
    assert.equal((await app.request('posts')).data.some(p => p.id === post.id), false);
    post = (await app.request('publish', { id: post.id, revision: post.revision })).data;
    assert.equal(post.published.content, 'Private second version.');
    assert.equal(post.published.image, 'https://example.com/revised.png');
  });
  await t.test('survives a service restart with drafts and tracked exports intact', async () => {
    await app.close(); app = await start(directory);
    const stored = JSON.parse(await readFile(join(directory, 'blog.json'), 'utf8'));
    assert.equal(stored.posts.find(p => p.id === post.id).content, 'Private second version.');
    assert.equal((await readPublishedPosts(join(directory, 'published'))).length, 1);
    assert.equal((await app.request('posts')).data.find(p => p.id === post.id).title, post.title);
  });
  await t.test('validates input and rejects external origins, hosts and request formats', async () => {
    assert.equal((await app.request('save', { ...post, tags: '', title: 'x'.repeat(181) })).status, 400);
    assert.equal((await app.request('save', { ...post, tags: 'a,b,c,d,e,f' })).status, 400);
    assert.equal((await app.request('save', { ...post, tags: '', icon: '<svg onload=alert(1)>' })).status, 400);
    for (const image of ['javascript:alert(1)', 'data:image/svg+xml,test', '//example.com/photo.jpg', '/\\evil.test/image', 'http://example.com/image.png']) assert.equal((await app.request('save', { ...post, tags: '', image })).status, 400);
    assert.equal((await app.request('save', { ...post, tags: '', imageAlt: 'x'.repeat(241) })).status, 400);
    assert.equal((await app.request('save', { ...post, tags: '', content: 'x'.repeat(500_001) })).status, 400);
    assert.equal((await app.request('publish', { id: post.id, revision: post.revision }, { Origin: 'https://external.example' })).status, 403);
    assert.equal((await app.request('save', {}, { 'Content-Type': 'text/plain' })).status, 415);
    const externalHostStatus = await new Promise((resolve, reject) => {
      const req = httpRequest(`${app.base}/api/blog/posts`, { headers: { Host: 'external.example' } }, res => { res.resume(); resolve(res.statusCode); });
      req.on('error', reject); req.end();
    });
    assert.equal(externalHostStatus, 403);
    assert.equal((await fetch(`${app.base}/api/blog/posts`, { method: 'DELETE' })).status, 405);
    assert.equal((await fetch(`${app.base}/api/blog/save`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{invalid' })).status, 400);
  });
  await t.test('deletes only the selected draft and its GitHub file', async () => {
    assert.equal((await app.request('delete', { id: post.id, revision: post.revision })).status, 200);
    assert.equal((await readPublishedPosts(join(directory, 'published'))).length, 0);
    assert.equal((await app.request('drafts')).data.some(p => p.id === post.id), false);
    assert.equal((await app.request('posts')).data.some(p => p.id === 'example'), true);
  });
});
