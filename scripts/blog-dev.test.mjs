import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, request as httpRequest } from 'node:http';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { blogDevPlugin } from './blog-dev.mjs';
import { readPublishedPosts } from './blog-content.mjs';
import sharp from 'sharp';

async function start(directory) {
  const routes = [];
  blogDevPlugin({ directory, publishedDirectory: join(directory, 'published'), uploadDirectory: join(directory, 'uploads') }).configureServer({ middlewares: { use(path, handler) { routes.push({ path, handler }); } }, config: { logger: { error() {} } } });
  const server = createServer((req, res) => {
    const route = routes.find(route => req.url.startsWith(`${route.path}/`) || req.url === route.path);
    if (!route) { res.statusCode = 404; res.end(); return; }
    req.url = req.url.slice(route.path.length) || '/';
    void route.handler(req, res, () => { res.statusCode = 404; res.end(); });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = async (path, body, headers = {}) => {
    const response = await fetch(`${base}/api/blog/${path}`, { ...(body === undefined ? {} : { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json', ...headers } }) });
    return { status: response.status, data: await response.json() };
  };
  return { request, base, close: () => new Promise(resolve => server.close(resolve)) };
}

test('local version history survives restarts, preserves restores, and explicitly archives/deletes', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'jd-blog-history-'));
  let app = await start(directory);
  t.after(async () => { await app.close(); await rm(directory, { recursive: true, force: true }); });
  const input = { title: 'History', slug: 'history', excerpt: 'First description', tags: 'AI', content: 'First draft 日本語' };
  let post = (await app.request('save', input)).data;
  const id = post.id;
  post = (await app.request('save', { ...input, id, revision: post.revision })).data;
  assert.equal((await app.request(`history?id=${id}`)).data.length, 1, 'unchanged saves do not duplicate versions');
  const stale = post.revision;
  post = (await app.request('save', { ...input, id, revision: post.revision, title: 'New title', content: 'Second draft' })).data;
  assert.equal((await app.request('save', { ...input, id, revision: stale })).status, 409);
  let history = (await app.request(`history?id=${id}`)).data;
  assert.equal(history.length, 2, 'rejected save adds no history');
  assert.equal(history[0].content, input.content);
  await app.close(); app = await start(directory);
  assert.deepEqual((await app.request(`history?id=${id}`)).data, history);
  const rejectedRestore = await app.request('restore-history', { id, revision: stale, versionId: history[0].id });
  assert.equal(rejectedRestore.status, 409, 'stale restores cannot silently merge another tab text');
  assert.equal((await app.request(`history?id=${id}`)).data.length, 2);
  post = (await app.request('restore-history', { id, versionId: history[0].id, revision: post.revision })).data;
  history = (await app.request(`history?id=${id}`)).data;
  assert.deepEqual(history.map(entry => entry.content), [input.content, 'Second draft', input.content]);
  assert.equal(post.title, input.title);
  assert.ok(history.every(entry => entry.savedAt && entry.id));
  assert.ok(!(await app.request('drafts')).data.some(draft => 'histories' in draft));
  assert.ok(!(await app.request('posts')).data.some(draft => draft.id === id));
  post = (await app.request('publish', { id, revision: post.revision })).data;
  assert.ok((await app.request(`history?id=${id}`)).data.every(entry => !entry.archivedAt), 'preparing is not publishing');
  assert.equal((await app.request('archive-history', { id, revision: stale })).status, 409);
  history = (await app.request('archive-history', { id, revision: post.revision })).data;
  assert.equal(history.length, 3); assert.ok(history.every(entry => entry.archivedAt));
  post = (await app.request('save', { ...input, id, revision: post.revision, content: 'Post-publication update' })).data;
  history = (await app.request('delete-archived-history', { id, revision: post.revision })).data;
  assert.equal(history.length, 1); assert.equal(history[0].content, post.content); assert.ok(!history[0].archivedAt);
  assert.equal((await app.request('drafts')).data.find(draft => draft.id === id).content, post.content);
  await app.request('delete', { id, revision: post.revision });
  assert.equal((await app.request(`history?id=${id}`)).status, 404);
  assert.equal(JSON.parse(await readFile(join(directory, 'blog.json'), 'utf8')).histories[id], undefined);
});

test('legacy history IDs persist; restores are exact, atomic, scoped and reject URL collisions', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'jd-history-legacy-'));
  const legacy = { id: 'legacy', title: 'Legacy article', slug: 'legacy-url', excerpt: 'Original metadata', content: 'Original 日本語 🧪', tags: ['Research'], icon: 'code', image: '/images/legacy.png', imageAlt: 'Original image', revision: 7, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-02T00:00:00.000Z' };
  await writeFile(join(directory, 'blog.json'), JSON.stringify({ posts: [legacy], comments: [] }));
  const app = await start(directory);
  t.after(async () => { await app.close(); await rm(directory, { recursive: true, force: true }); });
  const histories = await Promise.all(Array.from({ length: 6 }, () => app.request('history?id=legacy')));
  const original = histories[0].data[0];
  assert.ok(histories.every(result => result.data[0].id === original.id), 'concurrent first reads give the same durable ID');
  assert.equal(JSON.parse(await readFile(join(directory, 'blog.json'), 'utf8')).histories.legacy[0].id, original.id);
  let post = (await app.request('save', { ...legacy, tags: 'AI', title: 'Changed', slug: 'changed-url', content: 'Changed', icon: 'terminal', image: '', imageAlt: '' })).data;
  assert.ok(post.id);
  const other = (await app.request('save', { title: 'Other', slug: legacy.slug, content: 'Unrelated', excerpt: '', tags: '' })).data;
  assert.equal((await app.request('restore-history', { id: post.id, revision: post.revision, versionId: original.id })).status, 409);
  assert.equal((await app.request('restore-history', { id: other.id, revision: other.revision, versionId: original.id })).status, 404, 'cannot restore a version belonging to another draft');
  await app.request('delete', { id: other.id, revision: other.revision });
  const attempts = await Promise.all(Array.from({ length: 4 }, () => app.request('restore-history', { id: post.id, revision: post.revision, versionId: original.id })));
  assert.equal(attempts.filter(result => result.status === 200).length, 1);
  assert.equal(attempts.filter(result => result.status === 409).length, 3);
  post = attempts.find(result => result.status === 200).data;
  for (const key of ['title', 'slug', 'excerpt', 'content', 'tags', 'icon', 'image', 'imageAlt']) assert.deepEqual(post[key], legacy[key], `restores ${key}`);
  const archived = (await app.request('archive-history', { id: post.id, revision: post.revision })).data;
  await app.request('delete-archived-history', { id: post.id, revision: post.revision });
  assert.equal((await app.request('restore-history', { id: post.id, revision: post.revision, versionId: archived[0].id })).status, 404);
  assert.deepEqual((await app.request('drafts')).data.find(draft => draft.id === post.id), post, 'deleting all archived history keeps the current draft exact');
});

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

test('local image uploads validate, persist, and travel with prepared Markdown', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'jd-blog-upload-'));
  const app = await start(directory);
  t.after(async () => { await app.close(); await rm(directory, { recursive: true, force: true }); });
  const png = await sharp({ create: { width: 20, height: 10, channels: 3, background: '#7c91ff' } }).png().toBuffer();
  const upload = async (buffer = png, headers = {}) => {
    const response = await fetch(`${app.base}/api/blog/upload`, { method: 'POST', headers: { Origin: app.base, 'Content-Type': 'image/png', 'X-Image-Name': encodeURIComponent('../../My illustration.html'), ...headers }, body: buffer });
    return { status: response.status, data: await response.json() };
  };
  const result = await upload();
  assert.equal(result.status, 200);
  assert.match(result.data.image, /^\/blog-images\/uploads\/my-illustration-[a-f0-9]{24}\.png$/);
  assert.deepEqual(await readFile(join(directory, 'uploads', result.data.image.split('/').pop())), png);
  const served = await fetch(`${app.base}${result.data.image}`);
  assert.equal(served.headers.get('content-type'), 'image/png');
  assert.deepEqual(Buffer.from(await served.arrayBuffer()), png, 'uploaded files render immediately without a watcher delay');
  assert.equal((await upload()).data.image, result.data.image, 're-uploading the same file reuses its URL');
  const draft = (await app.request('save', { title: 'Uploaded picture', slug: 'uploaded-picture', excerpt: '', tags: '', image: result.data.image, imageAlt: 'An illustration', content: `Body picture:\n\n![An illustration](${result.data.image})` })).data;
  assert.equal((await app.request('publish', { id: draft.id, revision: draft.revision })).status, 200);
  const prepared = (await readPublishedPosts(join(directory, 'published')))[0];
  assert.equal(prepared.image, result.data.image);
  assert.ok(prepared.content.includes(result.data.image));
  assert.equal((await upload(Buffer.from('<html>not a picture</html>'))).status, 400);
  assert.equal((await upload(png.subarray(0, 45))).status, 400, 'truncated image data is rejected');
  assert.equal((await upload(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'), { 'Content-Type': 'image/svg+xml' })).status, 415);
  assert.equal((await upload(Buffer.alloc(10 * 1024 * 1024 + 1))).status, 413);
  assert.equal((await upload(png, { Origin: 'https://elsewhere.example' })).status, 403);
  assert.equal((await upload(png, { Origin: '' })).status, 403);
  assert.equal((await upload(png, { 'X-Image-Name': '%bad-encoding' })).status, 400);
});
