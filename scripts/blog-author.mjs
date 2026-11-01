import { authorError, editorAuthorized, editorConfigured, privateHeaders, readLimitedBody, requireSameOrigin } from './blog-auth.mjs';
import { validateBlogImage } from './blog-upload.mjs';
import { postImage } from '../src/lib/blog-images.js';
import { BLOG_ICONS, defaultPostIcon } from '../src/lib/blog-icons.js';

const text = (value, max, label) => {
  if (typeof value !== 'string' || value.length > max) throw authorError(400, `${label} must be at most ${max} characters.`);
  return value.trim();
};
export function validatePrivateDraft(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw authorError(400, 'Invalid draft.');
  if (body.id !== undefined && (typeof body.id !== 'string' || !/^[a-zA-Z0-9_-]{1,120}$/.test(body.id))) throw authorError(400, 'Invalid draft ID.');
  if (body.id && (!Number.isSafeInteger(body.revision) || body.revision < 1)) throw authorError(400, 'Invalid draft version.');
  const title = text(body.title, 180, 'Title');
  const slug = (text(body.slug, 100, 'URL slug') || title).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 100) || 'untitled';
  const tags = [...new Set(text(body.tags, 200, 'Tags').split(',').map(t => t.trim()).filter(Boolean))];
  if (tags.length > 5 || tags.some(t => t.length > 30)) throw authorError(400, 'Use up to 5 tags, each under 30 characters.');
  const icon = body.icon || defaultPostIcon(tags);
  if (!BLOG_ICONS.some(option => option.value === icon)) throw authorError(400, 'Invalid post icon.');
  let image;
  try { image = postImage(body.image || '', body.imageAlt || ''); } catch (error) { throw authorError(400, error.message); }
  return { ...(body.id ? { id: body.id, revision: body.revision } : {}), title, slug, tags, icon, excerpt: text(body.excerpt, 400, 'Description'), content: text(body.content, 500_000, 'Content'), ...image };
}
export function createBlogAuthorHandler({ config, store, validateImage = validateBlogImage }) {
  return async (request, action) => {
    const json = (status, value) => new Response(JSON.stringify(value), { status, headers: { ...privateHeaders, 'Content-Type': 'application/json' } });
    try {
      if (!editorConfigured(config) || !store) return json(503, { error: 'Private writing is not available yet.' });
      if (!editorAuthorized(request, config)) return json(401, { error: 'Sign in to the private editor to continue.' });
      if (request.method === 'GET') {
        if (action === 'drafts') return json(200, await store.list());
        if (action === 'image') {
          const image = await store.image(new URL(request.url).searchParams.get('name'));
          return new Response(image.stream, { headers: { ...privateHeaders, 'Content-Type': image.contentType } });
        }
        return json(404, { error: 'Not found.' });
      }
      if (request.method !== 'POST') return json(405, { error: 'Method not allowed.' });
      requireSameOrigin(request);
      if (action === 'upload') {
        if (!/^image\/(png|jpeg|webp|gif|avif)(?:;|$)/i.test(request.headers.get('content-type') || '')) throw authorError(415, 'Choose a PNG, JPG, WebP, GIF, or AVIF picture.');
        let filename;
        try { filename = decodeURIComponent(request.headers.get('x-image-name') || 'picture'); } catch { throw authorError(400, 'Invalid picture filename.'); }
        const buffer = await readLimitedBody(request, 4 * 1024 * 1024);
        const image = await validateImage(buffer, filename, 4 * 1024 * 1024);
        return json(200, await store.upload(buffer, image.name, image.contentType));
      }
      if (!['save', 'delete'].includes(action)) return json(404, { error: 'Not found.' });
      if (!request.headers.get('content-type')?.startsWith('application/json')) throw authorError(415, 'Send JSON content.');
      let body;
      try { body = JSON.parse((await readLimitedBody(request, 3_100_000)).toString('utf8')); }
      catch (error) { if (error.status) throw error; throw authorError(400, 'Invalid JSON.'); }
      if (action === 'save') return json(200, await store.save(validatePrivateDraft(body)));
      if (!body || typeof body.id !== 'string' || !Number.isSafeInteger(body.revision)) throw authorError(400, 'Invalid draft version.');
      await store.remove(body.id, body.revision);
      return json(200, { deleted: true });
    } catch (error) {
      return json(error.status || 503, { error: error.status ? error.message : 'Private storage is temporarily unavailable. Your unsaved text is still in this browser.' });
    }
  };
}
