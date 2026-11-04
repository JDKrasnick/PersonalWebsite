import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { createBlogAuthorHandler, validatePrivateDraft } from './blog-author.mjs';
import { createEditorSession, editorAuthorized, editorConfigured, editorCookie, hashEditorPassword, readLimitedBody, safeEditorReturn, signInEditor, verifyEditorPassword } from './blog-auth.mjs';
import { privateBlogStore } from './blog-private-store.mjs';

const password = 'test-only-password-not-a-production-secret';
const config = { passwordHash: await hashEditorPassword(password), sessionSecret: 'test-only-session-secret-at-least-32-characters', token: 'test-only-private-blob-token', prefix: 'test-blog' };
const origin = 'https://example.test';
const session = createEditorSession(config);
const cookie = editorCookie(new Request(origin), session).split(';')[0];
const draft = { title: 'Private test marker', slug: 'private-test', excerpt: 'Private description', content: 'Unpublished body', tags: 'Engineering', image: '', imageAlt: '' };
const request = (action, { method = 'GET', body, auth = true, site = origin, headers = {} } = {}) => new Request(`${origin}/api/blog/${action}`, { method, headers: { ...(auth ? { Cookie: cookie } : {}), ...(method === 'POST' ? { Origin: site, 'Content-Type': 'application/json' } : {}), ...headers }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });

function memoryBlob({ compressed = false } = {}) {
  const rows = new Map(); let revision = 0;
  class BlobPreconditionFailedError extends Error {}
  return {
    rows,
    async get(path, options) {
      assert.equal(options.access, 'private'); assert.equal(options.useCache, false);
      const value = rows.get(path);
      const etag = compressed && options.headers?.['Accept-Encoding'] !== 'identity' ? `W/"${value?.etag}"` : value?.etag;
      return value ? { statusCode: 200, stream: new Response(value.data).body, blob: { etag, contentType: value.contentType } } : null;
    },
    async put(path, value, options) {
      assert.equal(options.access, 'private');
      const prior = rows.get(path);
      if (options.ifMatch && options.ifMatch !== prior?.etag || prior && !options.allowOverwrite) throw new BlobPreconditionFailedError();
      rows.set(path, { data: value, etag: String(++revision), contentType: options.contentType });
      return { pathname: path, etag: String(revision) };
    },
    async del(path, options) {
      if (rows.get(path)?.etag !== options.ifMatch) throw new BlobPreconditionFailedError();
      rows.delete(path);
    },
    async list({ prefix }) { return { blobs: [...rows.keys()].filter(path => path.startsWith(prefix)).map(pathname => ({ pathname })), hasMore: false }; },
  };
}
const setup = () => { const blob = memoryBlob(); const store = privateBlogStore({ ...config, blob }); return { blob, store, handler: createBlogAuthorHandler({ config, store }) }; };

test('passwords, session signatures, expiry, and password rotation protect the editor', async () => {
  assert.equal(editorConfigured(config), true);
  assert.equal(await verifyEditorPassword(password, config), true);
  assert.equal(await verifyEditorPassword('wrong password', config), false);
  assert.equal(editorAuthorized(request('drafts'), config), true);
  assert.equal(editorAuthorized(request('drafts', { auth: false }), config), false);
  assert.equal(editorAuthorized(request('drafts', { headers: { Cookie: cookie + 'tampered' } }), config), false);
  assert.equal(editorAuthorized(request('drafts'), config, Date.now() + 8 * 86400_000), false);
  assert.equal(editorAuthorized(request('drafts'), { ...config, passwordHash: await hashEditorPassword(password + '-changed') }), false);
  const header = editorCookie(new Request(origin), session);
  for (const value of ['__Host-jd-blog=', 'HttpOnly', 'Secure', 'SameSite=Strict', 'Path=/']) assert.ok(header.includes(value));
  assert.ok(editorCookie(new Request(origin)).includes('Max-Age=0'));
});

test('sign-in checks origin and password and rejects external return destinations', async () => {
  const { store } = setup();
  const login = (pass, site = origin) => new Request(`${origin}/blog/login`, { method: 'POST', headers: { Origin: site, 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ password: pass, next: 'https://attacker.test/' }) });
  const response = await signInEditor(login(password), config, store, '127.0.0.1');
  assert.equal(response.status, 303); assert.equal(response.headers.get('location'), '/blog/editor');
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.ok(!response.headers.get('set-cookie').includes(password));
  await assert.rejects(signInEditor(login('wrong'), config, store, '127.0.0.1'), { status: 401 });
  await assert.rejects(signInEditor(login(password, 'https://attacker.test'), config, store, '127.0.0.1'), { status: 403 });
  for (const value of ['//attacker.test', 'javascript:alert(1)', '/blog/editor/../../../', '/api/blog/drafts']) assert.equal(safeEditorReturn(value), '/blog/editor');
  assert.equal(safeEditorReturn('/blog/preview?draft=abc'), '/blog/preview?draft=abc');
});

test('login rate limits persist across store instances and reset after the window', async () => {
  const { blob, store } = setup(); const now = Date.now();
  for (let i = 0; i < 8; i++) await store.consumeLogin('same-client', now);
  const freshInstance = privateBlogStore({ ...config, blob });
  await assert.rejects(freshInstance.consumeLogin('same-client', now), { status: 429 });
  await freshInstance.consumeLogin('same-client', now + 15 * 60_000 + 1);
  assert.equal(blob.rows.size, 1);
});

test('guests cannot read drafts or images, or mutate drafts even with forged routing headers', async () => {
  const { handler, blob } = setup();
  for (const action of ['drafts', 'image', 'save', 'delete', 'upload']) {
    const response = await handler(request(action, { auth: false, ...(action === 'drafts' || action === 'image' ? {} : { method: 'POST', body: draft }), headers: { 'x-astro-path': '/blog/editor' } }), action);
    assert.equal(response.status, 401, action);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow, noarchive');
    assert.ok(!(await response.text()).includes(draft.content));
  }
  assert.equal(blob.rows.size, 0);
  assert.equal((await createBlogAuthorHandler({ config: { ...config, token: '' }, store: null })(request('drafts'), 'drafts')).status, 503);
});

test('private saves survive a new store instance, reject stale tabs, and never publish', async () => {
  const { handler, store, blob } = setup();
  const created = await (await handler(request('save', { method: 'POST', body: draft }), 'save')).json();
  assert.equal(created.revision, 1); assert.equal(created.prepared, false);
  const fresh = privateBlogStore({ ...config, blob });
  assert.equal((await fresh.list())[0].content, draft.content);
  const results = await Promise.allSettled(['First tab', 'Second tab'].map(title => store.save({ ...validatePrivateDraft(draft), id: created.id, revision: 1, title })));
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(results.find(r => r.status === 'rejected').reason.status, 409);
  const post = (await store.list())[0]; assert.equal(post.revision, 2);
  await assert.rejects(store.remove(post.id, 1), { status: 409 });
  for (const action of ['publish', 'unpublish']) assert.equal((await handler(request(action, { method: 'POST', body: { id: post.id, revision: 2 } }), action)).status, 404);
  await store.remove(post.id, 2); assert.deepEqual(await store.list(), []);
});

test('compressible records keep strong ETags for saves, deletes, and login counters', async () => {
  const blob = memoryBlob({ compressed: true });
  const store = privateBlogStore({ ...config, blob });
  let post = await store.save(validatePrivateDraft({ ...draft, content: 'Compressible article text.\n'.repeat(100) }));
  post = await store.save({ ...post, title: 'Updated compressible post' });
  assert.equal(post.revision, 2);
  const results = await Promise.allSettled(['Tab A', 'Tab B'].map(title => store.save({ ...post, title })));
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(results.find(result => result.status === 'rejected').reason.status, 409);
  await store.remove(post.id, 3);
  const now = Date.now();
  for (let attempt = 0; attempt < 8; attempt++) await store.consumeLogin('client', now);
  await assert.rejects(store.consumeLogin('client', now), { status: 429 });
});

test('cross-site writes, invalid versions, traversal, and oversized bodies are rejected', async () => {
  const { handler } = setup();
  assert.equal((await handler(request('save', { method: 'POST', body: draft, site: 'https://attacker.test' }), 'save')).status, 403);
  assert.equal((await handler(request('save', { method: 'POST', body: { ...draft, id: '../../private' } }), 'save')).status, 400);
  assert.equal((await handler(request('save', { method: 'POST', body: { ...draft, content: 'x'.repeat(500_001) } }), 'save')).status, 400);
  assert.equal((await handler(request('save', { method: 'POST', body: { ...draft, tags: 'a,b,c,d,e,f' } }), 'save')).status, 400);
  assert.equal((await handler(request('image?name=../../config'), 'image')).status, 404);
  await assert.rejects(readLimitedBody(new Request(origin, { method: 'POST', body: 'too much' }), 3), { status: 413 });
  assert.equal((await handler(request('save', { method: 'POST', body: draft, headers: { 'Content-Length': '4000000' } }), 'save')).status, 413);
});

test('image bytes are decoded and stored privately; URLs require the same authentication', async () => {
  const { handler, blob } = setup();
  const image = await sharp({ create: { width: 2, height: 2, channels: 3, background: '#123456' } }).png().toBuffer();
  const upload = buffer => new Request(`${origin}/api/blog/upload`, { method: 'POST', headers: { Cookie: cookie, Origin: origin, 'Content-Type': 'image/png', 'X-Image-Name': encodeURIComponent('../private.png') }, body: buffer });
  const response = await handler(upload(image), 'upload'); assert.equal(response.status, 200);
  const data = await response.json(); assert.match(data.image, /^\/api\/blog\/image\?name=private-[a-f0-9]{24}\.png$/);
  assert.equal((await handler(upload(image), 'upload')).status, 200, 'Identical uploads can be retried safely');
  assert.equal(blob.rows.size, 1);
  const picture = await handler(new Request(origin + data.image, { headers: { Cookie: cookie } }), 'image');
  assert.equal(picture.status, 200); assert.equal(picture.headers.get('content-type'), 'image/png');
  assert.deepEqual(Buffer.from(await picture.arrayBuffer()), image);
  assert.equal((await handler(new Request(origin + data.image), 'image')).status, 401);
  assert.equal((await handler(upload(Buffer.from('<svg onload="alert(1)"></svg>')), 'upload')).status, 400);
});

test('storage errors do not expose credentials or internal errors to a browser', async () => {
  const handler = createBlogAuthorHandler({ config, store: { list: () => { throw new Error('private-service-token-do-not-expose'); } } });
  const response = await handler(request('drafts'), 'drafts');
  assert.equal(response.status, 503); assert.ok(!(await response.text()).includes('private-service-token'));
});
