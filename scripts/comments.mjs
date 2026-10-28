import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

export const COMMENT_LIMITS = { cooldownMs: 30_000, windowMs: 600_000, perWindow: 3, dayMs: 86_400_000, perDay: 20, postWindowMs: 60_000, perPostWindow: 20, pageSize: 30 };
export const commentError = (status, message, retryAfter) => Object.assign(new Error(message), { status, retryAfter });
export const digest = (secret, value) => createHmac('sha256', secret).update(value).digest('hex');
const validCursor = value => /^\d{13}:[a-f0-9-]{36}$/.test(value);

export function validateComment(body) {
  if (!body || typeof body !== 'object') throw commentError(400, 'Invalid comment.');
  if (body.website) throw commentError(400, 'This comment could not be accepted.');
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const content = typeof body.content === 'string' ? body.content.trim() : '';
  if (name.length > 80 || content.length < 3 || content.length > 4000) throw commentError(400, 'Use a name under 80 characters and a comment between 3 and 4,000 characters.');
  if ((content.match(/https?:\/\//gi) || []).length > 2 || /(.)\1{39}/su.test(content) || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(content + name)) throw commentError(400, 'Please remove repeated text, extra links, or control characters from your comment.');
  return { name: name || 'Anonymous', content };
}

export function createCommentsHandler({ store, secret, getPostIds, now = Date.now, allowModeration = false }) {
  return async (request, clientAddress) => {
    const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
    const reply = (status, data, extra = {}) => new Response(JSON.stringify(data), { status, headers: { ...headers, ...extra } });
    try {
      if (!secret || secret.length < 32 || !store) throw commentError(503, 'Comments are temporarily unavailable. Please try again later.');
      if (!clientAddress) throw commentError(503, 'Could not verify this request. Please try again.');
      const url = new URL(request.url);
      const origin = request.headers.get('origin');
      if ((origin && origin !== url.origin) || request.headers.get('sec-fetch-site') === 'cross-site') throw commentError(403, 'Please submit comments from this site.');
      const postId = url.searchParams.get('postId');
      if (!postId || !(await getPostIds()).includes(postId)) throw commentError(404, 'This article is not available for comments.');
      const clientKey = digest(secret, `client:${clientAddress}`);
      const timestamp = now();
      if (request.method === 'GET') {
        const cursor = url.searchParams.get('cursor') || '';
        if (cursor && !validCursor(cursor)) throw commentError(400, 'Invalid comment page.');
        const page = await store.list(postId, cursor, clientKey, timestamp);
        const payload = `${timestamp}.${randomUUID()}`;
        const token = `${payload}.${digest(secret, `${postId}:${clientKey}:${payload}`)}`;
        return reply(200, { ...page, token });
      }
      if (request.method === 'DELETE' && allowModeration && ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(clientAddress)) {
        const id = url.searchParams.get('id') || '';
        if (!validCursor(id)) throw commentError(400, 'Invalid comment.');
        await store.remove(postId, id);
        return reply(200, { removed: true });
      }
      if (request.method !== 'POST') return reply(405, { error: 'Method not allowed.' }, { Allow: 'GET, POST' });
      if (!request.headers.get('content-type')?.startsWith('application/json')) throw commentError(415, 'Please send a JSON comment.');
      if (Number(request.headers.get('content-length')) > 25_000) throw commentError(413, 'This comment is too large.');
      if (!request.body) throw commentError(400, 'Please write a comment.');
      const reader = request.body.getReader(); const chunks = []; let size = 0;
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        size += value.length;
        if (size > 25_000) { await reader.cancel(); throw commentError(413, 'This comment is too large.'); }
        chunks.push(value);
      }
      let body;
      try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw commentError(400, 'Invalid comment.'); }
      const value = validateComment(body);
      const parts = typeof body.token === 'string' ? body.token.split('.') : [];
      if (parts.length !== 3 || !/^\d{13}$/.test(parts[0]) || !/^[a-f0-9-]{36}$/.test(parts[1]) || !/^[a-f0-9]{64}$/.test(parts[2])) throw commentError(400, 'Refresh the comments before posting.');
      const expected = digest(secret, `${postId}:${clientKey}:${parts[0]}.${parts[1]}`);
      if (!timingSafeEqual(Buffer.from(expected), Buffer.from(parts[2]))) throw commentError(403, 'Refresh the comments before posting.');
      const age = timestamp - Number(parts[0]);
      if (age < 2000) throw commentError(429, 'Please take a moment before submitting your comment.', 2);
      if (age > 7_200_000) throw commentError(400, 'Your comment session expired. Refresh the comments and try again.');
      const comment = { id: `${timestamp}:${randomUUID()}`, postId, ...value, createdAt: new Date(timestamp).toISOString() };
      const fingerprint = digest(secret, `${postId}:${value.content.toLowerCase().replace(/\s+/g, ' ')}`);
      await store.add({ postId, clientKey, fingerprint, comment, now: timestamp });
      return reply(201, comment);
    } catch (error) {
      if (!error.status) console.error('[comments] Storage request failed.');
      return reply(error.status ?? 503, { error: error.status ? error.message : 'Comments are temporarily unavailable. Please try again later.' }, error.retryAfter ? { 'Retry-After': String(Math.max(1, Math.ceil(error.retryAfter))) } : {});
    }
  };
}
