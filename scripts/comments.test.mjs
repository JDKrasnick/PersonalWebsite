import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createCommentsHandler } from './comments.mjs';
import { localComments } from './comments-local.mjs';
import { redisComments, addCommentLua, listCommentsLua } from './comments-redis.mjs';

async function setup(t, moderation = false) {
  const directory = await mkdtemp(join(tmpdir(), 'jd-comments-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  let time = 1_800_000_000_000;
  const state = await localComments(directory);
  const handler = createCommentsHandler({ ...state, getPostIds: async () => ['post-1', 'post-2'], now: () => time, allowModeration: moderation });
  const request = async (method = 'GET', body, { ip = '127.0.0.1', query = 'postId=post-1', headers = {} } = {}) => {
    const response = await handler(new Request(`https://blog.example/api/comments?${query}`, { method, ...(body === undefined ? {} : { body: JSON.stringify(body), headers: { 'Content-Type': 'application/json', ...headers } }), ...(body === undefined ? { headers } : {}) }), ip);
    return { status: response.status, retry: response.headers.get('retry-after'), data: await response.json() };
  };
  const token = async (options) => (await request('GET', undefined, options)).data.token;
  return { directory, state, handler, request, token, advance: ms => { time += ms; }, now: () => time };
}

test('anonymous comments appear on the site without a name or account and survive restart', async t => {
  const app = await setup(t);
  const token = await app.token(); app.advance(2000);
  const posted = await app.request('POST', { name: '', content: 'A useful question about this experiment.', token });
  assert.equal(posted.status, 201); assert.equal(posted.data.name, 'Anonymous');
  const page = await app.request(); assert.equal(page.data.count, 1); assert.equal(page.data.comments[0].content, posted.data.content);
  const restarted = await localComments(app.directory);
  assert.equal(restarted.secret, app.state.secret);
  assert.equal((await restarted.store.list('post-1', '', 'new-reader', app.now())).comments.length, 1);
});

test('spam traps, signed tokens, origin checks, bounds and unpublished posts reject writes', async t => {
  const app = await setup(t); const token = await app.token();
  assert.equal((await app.request('POST', { content: 'Valid text', token })).status, 429);
  app.advance(2000);
  for (const body of [
    { content: 'Valid text', token, website: 'spam.example' },
    { content: 'Valid text', token: 'invalid' },
    { content: 'x'.repeat(40), token },
    { content: 'https://a.test https://b.test https://c.test', token },
    { content: 'x'.repeat(4001), token },
    { content: 'ab', token },
  ]) assert.equal((await app.request('POST', body)).status, 400);
  assert.equal((await app.request('POST', { content: 'Valid text', token }, { ip: '127.0.0.2' })).status, 403);
  assert.equal((await app.request('POST', { content: 'Valid text', token }, { headers: { Origin: 'https://evil.example' } })).status, 403);
  assert.equal((await app.request('GET', undefined, { headers: { 'Sec-Fetch-Site': 'cross-site' } })).status, 403);
  assert.equal((await app.request('POST', { content: 'Valid text', token }, { query: 'postId=unpublished' })).status, 404);
  assert.equal((await app.request('GET', undefined, { query: 'postId=post-1&cursor=bad' })).status, 400);
  app.advance(7_200_000);
  assert.equal((await app.request('POST', { content: 'Valid text', token })).status, 400);
  assert.equal((await app.request()).data.count, 0);
});

test('cooldown, rolling rate limit and cross-client duplicates are durable', async t => {
  const app = await setup(t); let token = await app.token(); app.advance(2000);
  assert.equal((await app.request('POST', { content: 'First thoughtful comment.', token })).status, 201);
  const cooldown = await app.request('POST', { content: 'Second thoughtful comment.', token });
  assert.equal(cooldown.status, 429); assert.equal(cooldown.retry, '30');
  app.advance(30_000);
  assert.equal((await app.request('POST', { content: 'First thoughtful comment.', token })).status, 409);
  assert.equal((await app.request('POST', { content: 'Second thoughtful comment.', token })).status, 201);
  app.advance(30_000);
  assert.equal((await app.request('POST', { content: 'Third thoughtful comment.', token })).status, 201);
  app.advance(30_000);
  assert.equal((await app.request('POST', { content: 'Fourth thoughtful comment.', token })).status, 429);
  token = await app.token({ ip: '192.0.2.1' }); app.advance(2000);
  assert.equal((await app.request('POST', { content: 'FIRST thoughtful comment.', token }, { ip: '192.0.2.1' })).status, 409);
  const restarted = await localComments(app.directory);
  const restartHandler = createCommentsHandler({ ...restarted, getPostIds: async () => ['post-1'], now: app.now });
  const result = await restartHandler(new Request('https://blog.example/api/comments?postId=post-1', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: 'Fourth thoughtful comment.', token: (await app.token()) }) }), '127.0.0.1');
  assert.equal(result.status, 429);
});

test('parallel submissions cannot bypass limits and public deletion is forbidden', async t => {
  const app = await setup(t); const token = await app.token(); app.advance(2000);
  const results = await Promise.all(Array.from({ length: 12 }, (_, i) => app.request('POST', { content: `Concurrent comment number ${i}.`, token })));
  assert.equal(results.filter(r => r.status === 201).length, 1);
  assert.equal(results.filter(r => r.status === 429).length, 11);
  const id = results.find(r => r.status === 201).data.id;
  assert.equal((await app.request('DELETE', undefined, { query: `postId=post-1&id=${id}` })).status, 405);
  assert.equal((await app.request()).data.count, 1);
});

test('pagination, safe text, local moderation and global discussion limits', async t => {
  const app = await setup(t, true);
  for (let i = 0; i < 35; i++) {
    app.advance(4000);
    await app.state.store.add({ postId: 'post-1', clientKey: `client-${i}`, fingerprint: `body-${i}`, now: app.now(), comment: { id: `${app.now()}:00000000-0000-4000-8000-${String(i).padStart(12, '0')}`, postId: 'post-1', name: '<script>', content: `<img onerror=alert(${i})>`, createdAt: new Date(app.now()).toISOString() } });
  }
  const first = await app.request(); assert.equal(first.data.comments.length, 30); assert.equal(first.data.count, 35);
  const second = await app.request('GET', undefined, { query: `postId=post-1&cursor=${encodeURIComponent(first.data.cursor)}` });
  assert.equal(second.data.comments.length, 5); assert.equal(second.data.cursor, null);
  assert.equal(new Set([...first.data.comments, ...second.data.comments].map(c => c.id)).size, 35);
  assert.equal(first.data.comments[0].name, '<script>');
  const id = first.data.comments[0].id;
  assert.equal((await app.request('DELETE', undefined, { query: `postId=post-1&id=${id}` })).status, 200);
  assert.equal((await app.request()).data.count, 34);
  assert.equal((await app.request('DELETE', undefined, { ip: '192.0.2.1', query: `postId=post-1&id=${id}` })).status, 405);
});

test('unconfigured or failing hosted storage refuses comments rather than losing them', async () => {
  const noStore = createCommentsHandler({ secret: 'x'.repeat(64), getPostIds: async () => ['post-1'] });
  assert.equal((await noStore(new Request('https://blog.example/api/comments?postId=post-1'), '127.0.0.1')).status, 503);
  assert.equal(redisComments({}), null);
  const commands = [];
  const store = redisComments({ url: 'https://redis.example', token: 'server-secret', fetcher: async (_url, options) => {
    assert.equal(options.headers.Authorization, 'Bearer server-secret');
    const args = JSON.parse(options.body); commands.push(args);
    if (args[1] === listCommentsLua) return Response.json({ result: ['0', ''] });
    if (args[1] === addCommentLua) return Response.json({ result: ['rate', '30'] });
    throw new Error('unexpected command');
  } });
  assert.deepEqual(await store.list('post-1', '', 'private-ip-hash'), { count: 0, cursor: null, comments: [] });
  await assert.rejects(store.add({ postId: 'post-1', clientKey: 'private-ip-hash', fingerprint: 'hash', comment: { id: 'id' }, now: Date.now() }), error => error.status === 429 && error.retryAfter === 30);
  assert.equal(commands[1][2], 5);
  const failing = redisComments({ url: 'https://redis.example', token: 'server-secret', fetcher: async () => Response.json({ error: 'unavailable' }, { status: 503 }) });
  await assert.rejects(failing.list('post-1', '', 'hash'));
});

test('daily limits and distributed discussion floods are bounded', async t => {
  const app = await setup(t);
  for (let i = 0; i < 20; i++) {
    const token = await app.token(); app.advance(2000);
    assert.equal((await app.request('POST', { content: `Daily comment number ${i}.`, token })).status, 201);
    app.advance(601_000);
  }
  const token = await app.token(); app.advance(2000);
  assert.equal((await app.request('POST', { content: 'Daily limit should reject this.', token })).status, 429);
  for (let i = 0; i < 20; i++) {
    await app.state.store.add({ postId: 'post-2', clientKey: `flood-${i}`, fingerprint: `flood-${i}`, now: app.now(), comment: { id: `${app.now()}:00000000-0000-4000-8000-${String(i).padStart(12, '0')}`, postId: 'post-2', name: 'Anonymous', content: `Flood comment ${i}`, createdAt: new Date(app.now()).toISOString() } });
  }
  await assert.rejects(app.state.store.add({ postId: 'post-2', clientKey: 'new-client', fingerprint: 'new-fingerprint', now: app.now(), comment: {} }), error => error.status === 429);
});
