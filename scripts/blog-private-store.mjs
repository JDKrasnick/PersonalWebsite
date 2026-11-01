import * as defaultBlob from '@vercel/blob';
import { randomUUID } from 'node:crypto';
import { authorError } from './blog-auth.mjs';

const validId = id => typeof id === 'string' && /^[a-zA-Z0-9_-]{1,120}$/.test(id);
const conflict = error => ['BlobPreconditionFailedError', 'BlobAlreadyExistsError'].includes(error?.constructor?.name) || ['BlobPreconditionFailedError', 'BlobAlreadyExistsError'].includes(error?.name) || /already exists/i.test(error?.message || '');

export function privateBlogStore({ token, prefix = 'blog-private/v1', blob = defaultBlob }) {
  if (!/^[a-zA-Z0-9/_-]{1,100}$/.test(prefix)) throw new Error('Invalid private storage prefix.');
  const options = { token, access: 'private' };
  const draftPath = id => {
    if (!validId(id)) throw authorError(400, 'Invalid draft ID.');
    return `${prefix}/drafts/${id}.json`;
  };
  const read = async path => {
    const result = await blob.get(path, { ...options, useCache: false });
    if (!result) return null;
    if (result.statusCode !== 200 || !result.stream) throw new Error('Private storage could not be read.');
    return { value: await new Response(result.stream).json(), etag: result.blob.etag };
  };
  const write = (path, value, prior) => blob.put(path, JSON.stringify(value), {
    ...options, addRandomSuffix: false, allowOverwrite: Boolean(prior), ...(prior ? { ifMatch: prior.etag } : {}), contentType: 'application/json', cacheControlMaxAge: 60,
  });
  return {
    async list() {
      const posts = []; let cursor;
      do {
        const page = await blob.list({ token, prefix: `${prefix}/drafts/`, limit: 100, ...(cursor ? { cursor } : {}) });
        for (const item of page.blobs) {
          const result = await read(item.pathname);
          if (result) posts.push(result.value);
        }
        cursor = page.hasMore ? page.cursor : undefined;
        if (posts.length > 1000) throw authorError(503, 'There are too many drafts to load at once.');
      } while (cursor);
      return posts.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
    },
    async save(input) {
      const id = input.id || randomUUID(); const path = draftPath(id); const prior = await read(path);
      if (input.id && !prior) throw authorError(404, 'This draft no longer exists. Reload the editor.');
      if (prior && input.revision !== prior.value.revision) throw authorError(409, 'This draft changed in another tab. Reload before saving. Your unsaved text is still here.');
      const now = new Date().toISOString();
      const post = { ...prior?.value, ...input, id, revision: (prior?.value.revision || 0) + 1, createdAt: prior?.value.createdAt || now, updatedAt: now, prepared: false };
      try { await write(path, post, prior); }
      catch (error) { if (conflict(error)) throw authorError(409, 'This draft changed in another tab. Reload before saving.'); throw error; }
      return post;
    },
    async remove(id, revision) {
      const prior = await read(draftPath(id));
      if (!prior) throw authorError(404, 'Draft not found.');
      if (revision !== prior.value.revision) throw authorError(409, 'This draft changed in another tab. Reload before deleting.');
      try { await blob.del(draftPath(id), { token, ifMatch: prior.etag }); }
      catch (error) { if (conflict(error)) throw authorError(409, 'This draft changed in another tab. Reload before deleting.'); throw error; }
    },
    async consumeLogin(clientKey, now) {
      const path = `${prefix}/security/sign-in.json`;
      for (let attempt = 0; attempt < 5; attempt++) {
        const prior = await read(path);
        const record = prior && now - prior.value.startedAt < 15 * 60_000 ? prior.value : { startedAt: now, total: 0, clients: {} };
        if (record.total >= 100 || (record.clients[clientKey] || 0) >= 8) throw authorError(429, 'Too many sign-in attempts. Try again in 15 minutes.');
        const next = { ...record, total: record.total + 1, clients: { ...record.clients, [clientKey]: (record.clients[clientKey] || 0) + 1 } };
        try { await write(path, next, prior); return; }
        catch (error) { if (!conflict(error)) throw error; }
      }
      throw authorError(429, 'Sign-in is busy. Try again shortly.');
    },
    async upload(buffer, name, contentType) {
      // The filename includes a content hash, so retrying the same upload is safe.
      await blob.put(`${prefix}/images/${name}`, buffer, { ...options, contentType, addRandomSuffix: false, allowOverwrite: true });
      return { image: `/api/blog/image?name=${encodeURIComponent(name)}` };
    },
    async image(name) {
      if (!/^[a-z0-9-]+-[a-f0-9]{24}\.(png|jpg|webp|gif|avif)$/.test(name || '')) throw authorError(404, 'Picture not found.');
      const result = await blob.get(`${prefix}/images/${name}`, { ...options, useCache: false });
      if (!result || result.statusCode !== 200 || !result.stream || !/^image\/(png|jpeg|webp|gif|avif)$/.test(result.blob.contentType || '')) throw authorError(404, 'Picture not found.');
      return { stream: result.stream, contentType: result.blob.contentType };
    },
  };
}
