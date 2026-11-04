import { createHmac, randomBytes, scrypt as deriveKey, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(deriveKey);
const SESSION_SECONDS = 7 * 86400;
export const privateHeaders = {
  'Cache-Control': 'private, no-store',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
};
export const authorError = (status, message) => Object.assign(new Error(message), { status });
export const privateRedirect = location => new Response(null, { status: 303, headers: { ...privateHeaders, Location: location } });
const equal = (a, b) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
const mac = (config, value) => createHmac('sha256', config.sessionSecret).update(`${config.passwordHash}:${value}`).digest('base64url');

export function editorConfig(env = process.env) {
  return { passwordHash: env.BLOG_EDITOR_PASSWORD_HASH || '', sessionSecret: env.BLOG_EDITOR_SESSION_SECRET || '', token: env.BLOG_DRAFT_BLOB_TOKEN || '', prefix: env.BLOG_DRAFT_PREFIX || 'blog-private/v1' };
}
export function editorConfigured(config) {
  return /^scrypt\$32768\$[a-f0-9]{32}\$[a-f0-9]{128}$/.test(config.passwordHash) && config.sessionSecret.length >= 32 && config.token.length > 20;
}
export async function hashEditorPassword(password) {
  if (typeof password !== 'string' || password.length < 20 || password.length > 1024) throw new Error('Use a password with at least 20 characters.');
  const salt = randomBytes(16).toString('hex');
  const key = await scrypt(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return `scrypt$32768$${salt}$${key.toString('hex')}`;
}
export async function verifyEditorPassword(password, config) {
  if (!editorConfigured(config) || typeof password !== 'string' || password.length > 1024) return false;
  const [, , salt, expected] = config.passwordHash.split('$');
  const key = await scrypt(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return equal(key.toString('hex'), expected);
}
export function createEditorSession(config, now = Date.now()) {
  const body = `v1.${Math.floor(now / 1000) + SESSION_SECONDS}.${randomBytes(16).toString('hex')}`;
  return `${body}.${mac(config, body)}`;
}
const cookieName = request => new URL(request.url).protocol === 'https:' ? '__Host-jd-blog' : 'jd-blog-local';
export function editorAuthorized(request, config, now = Date.now()) {
  if (!editorConfigured(config)) return false;
  const cookie = (request.headers.get('cookie') || '').split(';').map(s => s.trim()).find(s => s.startsWith(`${cookieName(request)}=`));
  const token = cookie?.slice(cookie.indexOf('=') + 1) || '';
  const match = /^(v1\.(\d{10})\.[a-f0-9]{32})\.([A-Za-z0-9_-]{43})$/.exec(token);
  if (!match || Number(match[2]) <= Math.floor(now / 1000) || Number(match[2]) > Math.floor(now / 1000) + SESSION_SECONDS) return false;
  return equal(match[3], mac(config, match[1]));
}
export function editorCookie(request, token = '') {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `${cookieName(request)}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${token ? SESSION_SECONDS : 0}${secure}`;
}
export function requireSameOrigin(request) {
  if (request.headers.get('origin') !== new URL(request.url).origin) throw authorError(403, 'Open the editor on this website before saving.');
}
export function safeEditorReturn(value) {
  try {
    const url = new URL(value || '/blog/editor', 'https://editor.invalid');
    if (url.origin === 'https://editor.invalid' && ['/blog/editor', '/blog/preview'].includes(url.pathname)) return url.pathname + url.search;
  } catch { /* Use the fixed editor destination. */ }
  return '/blog/editor';
}
export async function readLimitedBody(request, limit) {
  if (Number(request.headers.get('content-length')) > limit) throw authorError(413, 'This request is too large.');
  const reader = request.body?.getReader();
  if (!reader) return Buffer.alloc(0);
  const chunks = []; let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > limit) { await reader.cancel(); throw authorError(413, 'This request is too large.'); }
      chunks.push(Buffer.from(value));
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks);
}
export async function signInEditor(request, config, store, address, now = Date.now()) {
  requireSameOrigin(request);
  if (!editorConfigured(config)) throw authorError(503, 'Private writing is not available yet.');
  if (!request.headers.get('content-type')?.startsWith('application/x-www-form-urlencoded')) throw authorError(415, 'Use the sign-in form.');
  const form = new URLSearchParams((await readLimitedBody(request, 4096)).toString('utf8'));
  const clientKey = createHmac('sha256', config.sessionSecret).update(address || 'unknown').digest('hex');
  await store.consumeLogin(clientKey, now);
  if (!await verifyEditorPassword(form.get('password') || '', config)) throw authorError(401, 'Incorrect password. Try again.');
  return new Response(null, { status: 303, headers: { ...privateHeaders, Location: safeEditorReturn(form.get('next')), 'Set-Cookie': editorCookie(request, createEditorSession(config, now)) } });
}
