import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createEditorSession, editorCookie, hashEditorPassword } from './blog-auth.mjs';

// Test credentials stay in this child process; no storage or account is contacted.
const config = { passwordHash: await hashEditorPassword('compiled-server-test-only-password'), sessionSecret: randomBytes(48).toString('hex'), token: 'unconfigured-build-test-token-not-real' };
process.env.BLOG_EDITOR_PASSWORD_HASH = config.passwordHash;
process.env.BLOG_EDITOR_SESSION_SECRET = config.sessionSecret;
process.env.BLOG_DRAFT_BLOB_TOKEN = config.token;
const root = resolve('.vercel/output/functions/_render.func');
const metadata = JSON.parse(await readFile(resolve(root, '.vc-config.json'), 'utf8'));
process.chdir(root); // Match the deployed function, without access to checkout-only files.
const { default: handler } = await import(pathToFileURL(resolve(root, metadata.handler)).href);
const origin = 'https://www.jdkrasnick.com';
const cookie = editorCookie(new Request(origin), createEditorSession(config)).split(';')[0];
const send = (path, authenticated = false, options = {}) => handler.fetch(new Request(origin + path, { ...options, headers: { 'x-forwarded-for': '127.0.0.1', ...(authenticated ? { Cookie: cookie } : {}), ...options.headers } }));

for (const path of ['/blog/editor', '/blog/preview?draft=private-build-marker']) {
  const response = await send(path);
  assert.equal(response.status, 303);
  assert.ok(response.headers.get('location').startsWith('/blog/login?next='));
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow, noarchive');
  assert.ok(!(await response.text()).includes('data-blog-editor'));
}
for (const path of ['/api/blog/drafts', '/api/blog/image?name=private.png']) {
  const response = await send(path); assert.equal(response.status, 401);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
}
const login = await send('/blog/login');
assert.equal(login.status, 200);
assert.equal(login.headers.get('cache-control'), 'private, no-store');
assert.ok((await login.text()).includes('editor-password'));
const editor = await send('/blog/editor', true); const html = await editor.text();
assert.equal(editor.status, 200); assert.equal(editor.headers.get('cache-control'), 'private, no-store');
assert.ok(html.includes('data-hosted="true"'));
for (const id of ['open-preview', 'editor-preview', 'text-style', 'editor-shortcuts', 'editor-find', 'assistant-image-script']) assert.ok(html.includes(`id="${id}"`), `The owner editor must include ${id}.`);
assert.match(html, /id="publish-post"[^>]*hidden/);
assert.ok(!html.includes(config.passwordHash) && !html.includes(config.sessionSecret));
const override = await send('/api/blog/drafts', false, { headers: { 'x-astro-path': '/blog/editor' } });
assert.equal(override.status, 401, 'Untrusted path headers must not change the routed request or bypass authentication.');
const queryOverride = await send('/api/blog/drafts?x_astro_path=/blog/editor');
assert.equal(queryOverride.status, 401, 'Untrusted path query parameters must not change the routed request.');
const logout = await send('/blog/logout', true, { method: 'POST', headers: { Origin: origin } });
assert.equal(logout.status, 303); assert.ok(logout.headers.get('set-cookie').includes('Max-Age=0'));
const { readPublishedPosts } = await import('./blog-content.mjs');
for (const post of await readPublishedPosts()) {
  const redirect = await send(`/blog/post?slug=${encodeURIComponent(post.slug)}`);
  assert.equal(redirect.status, 301);
  assert.equal(redirect.headers.get('location'), `/blog/${post.slug}/`);
}
console.log('Compiled server verified: guest gates, private response headers, owner-only editor, secure logout, and forged path rejection.');
