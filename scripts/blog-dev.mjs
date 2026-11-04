import { readFile, mkdir, writeFile, rename } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { readPublishedPosts, writePublishedPost, removePublishedPost, publishedDirectory } from './blog-content.mjs';
import { BLOG_ICONS, defaultPostIcon } from '../src/lib/blog-icons.js';
import { postImage } from '../src/lib/blog-images.js';
import { demoFence, exampleDemo } from '../src/lib/blog-demos.js';
import { MAX_IMAGE_BYTES, saveBlogImage } from './blog-upload.mjs';
import { blogAssistantMiddleware } from './blog-assistant-api.mjs';

export const exampleContent = `A technical experiment is most useful when someone else can follow the reasoning, reproduce the setup, and understand where the result stops applying.

This is an example article to demonstrate the blog. Replace it with your own writing in the editor.

## Try a small experiment

Change the learning rate and watch how it affects gradient descent. Use Step to inspect each update, or Play to animate the sequence.

${demoFence(exampleDemo)}

## Start with a question

Before choosing tools, write down the uncertainty you want to resolve. A narrow question gives the experiment a useful boundary.

> Can a smaller model handle this task reliably enough to justify the latency savings?

That is easier to evaluate than “make the system better.” It tells you what to measure, and what tradeoff you are willing to consider.

## Make the comparison fair

Keep the inputs fixed. Record the model, prompt, parameters, and evaluation criteria before looking at the results.

\`\`\`python
from time import perf_counter

def evaluate(model, cases):
    results = []
    for case in cases:
        started = perf_counter()
        answer = model.run(case.input)
        results.append({
            "passed": case.check(answer),
            "latency": perf_counter() - started,
        })
    return results
\`\`\`

The code is intentionally small. The important part is that every candidate gets the same cases and the same scoring rule.

### Report more than the average

Averages can hide the failures that matter. Inspect the slow tail, group failures by type, and look at concrete examples.

| Measure | What it helps answer |
| --- | --- |
| Task success | Does it solve the actual problem? |
| Median latency | What does a typical run feel like? |
| Tail latency | How bad are the slowest runs? |
| Failure categories | Where should the next experiment focus? |

## Leave a trail

A useful write-up includes enough context to challenge the conclusion:

- The hypothesis and the baseline.
- The exact setup and inputs.
- The measurements, including inconvenient ones.
- The limitations and the next question.

The goal is not to make every experiment sound successful. It is to make the next decision easier.
`;

const fail = (status, message) => Object.assign(new Error(message), { status });
const text = (value, max, label, required = false) => {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) throw fail(400, `${label} ${required ? 'is required and ' : ''}must be at most ${max} characters.`);
  return value.trim();
};
const slugify = value => value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 100);
const versionFields = ['title', 'slug', 'excerpt', 'content', 'tags', 'icon', 'image', 'imageAlt'];
const snapshot = post => ({ ...Object.fromEntries(versionFields.map(key => [key, post[key]])), id: randomUUID(), revision: post.revision, savedAt: post.updatedAt });
const sameVersion = (a, b) => versionFields.every(key => JSON.stringify(a[key]) === JSON.stringify(b[key]));

export function blogDevPlugin(options = {}) {
  const filename = resolve(options.directory ?? '.local', 'blog.json');
  const publishedPath = resolve(options.publishedDirectory ?? publishedDirectory);
  const uploadPath = resolve(options.uploadDirectory ?? 'public/blog-images/uploads');
  let queue = Promise.resolve();
  const loadLocal = async () => {
    try { return JSON.parse(await readFile(filename, 'utf8')); }
    catch (error) {
      if (error.code !== 'ENOENT') throw error;
      const now = new Date().toISOString();
      return { posts: [{ id: 'example', title: 'What makes a useful technical experiment?', slug: 'a-useful-technical-experiment', excerpt: 'A question worth asking, a comparison you can trust, and a trail someone else can follow.', tags: ['Engineering', 'Research'], content: exampleContent, createdAt: now, updatedAt: now, revision: 1, example: true, published: { title: 'What makes a useful technical experiment?', slug: 'a-useful-technical-experiment', excerpt: 'A question worth asking, a comparison you can trust, and a trail someone else can follow.', tags: ['Engineering', 'Research'], content: exampleContent, publishedAt: now } }], comments: [] };
    }
  };
  const load = async () => {
    const data = await loadLocal();
    const published = await readPublishedPosts(publishedPath);
    for (const source of published) {
      const { id, example, ...snapshot } = source;
      const existing = data.posts.find(post => post.id === id);
      if (existing) {
        if (!existing.published || ['title', 'slug', 'excerpt', 'content', 'tags', 'icon', 'image', 'imageAlt', 'publishedAt'].some(key => JSON.stringify(existing.published[key]) !== JSON.stringify(snapshot[key]))) {
          if (existing.published && ['title', 'slug', 'excerpt', 'content', 'tags', 'icon', 'image', 'imageAlt'].every(key => JSON.stringify(existing[key]) === JSON.stringify(existing.published[key]))) Object.assign(existing, snapshot);
          existing.revision += 1;
        }
        existing.published = snapshot;
      }
      else data.posts.push({ id, example, ...snapshot, published: snapshot, revision: 1, createdAt: snapshot.publishedAt, updatedAt: snapshot.publishedAt });
    }
    for (const post of data.posts) if (post.published && !post.example && !published.some(source => source.id === post.id)) post.published = null;
    for (const post of data.posts) post.prepared = published.some(source => source.id === post.id);
    return data;
  };
  const save = async data => {
    await mkdir(dirname(filename), { recursive: true });
    const temp = `${filename}.${randomUUID()}.tmp`;
    await writeFile(temp, JSON.stringify(data, null, 2), { mode: 0o600 });
    await rename(temp, filename);
  };
  return {
    name: 'local-blog',
    apply: /** @type {const} */ ('serve'),
    configureServer(server) {
      const assistant = blogAssistantMiddleware(options.assistant ?? {});
      server.middlewares.use('/api/blog/assistant', assistant.middleware);
      server.httpServer?.once('close', assistant.close);
      // Serve new uploads immediately; Vite's public-file watcher can lag behind the POST.
      server.middlewares.use('/blog-images/uploads', async (req, res, next) => {
        const path = new URL(req.url, 'http://localhost').pathname;
        const match = /^\/([a-z0-9-]+-[a-f0-9]{24}\.(png|jpg|webp|gif|avif))$/.exec(path);
        if (!match || !['GET', 'HEAD'].includes(req.method)) return next();
        try {
          const buffer = await readFile(resolve(uploadPath, match[1]));
          res.setHeader('Content-Type', `image/${match[2] === 'jpg' ? 'jpeg' : match[2]}`);
          res.setHeader('Content-Length', buffer.length);
          res.setHeader('X-Content-Type-Options', 'nosniff');
          res.end(req.method === 'HEAD' ? undefined : buffer);
        } catch (error) {
          if (error.code !== 'ENOENT') server.config.logger.error(`[local-blog] ${error.message}`);
          next();
        }
      });
      server.middlewares.use('/blog/editor', (req, res, next) => {
        if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress) || !/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(req.headers.host ?? '')) {
          res.statusCode = 403; res.end('The editor is only available on your computer.'); return;
        }
        next();
      });
      server.middlewares.use('/api/blog', async (req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        const respond = (status, data) => { res.statusCode = status; res.end(JSON.stringify(data)); };
        try {
          const host = req.headers.host ?? '';
          if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress)) throw fail(403, 'Authoring is only available from this computer.');
          if (!/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host)) throw fail(403, 'The blog editor is available on localhost only.');
          if (req.headers.origin && req.headers.origin !== `http://${host}`) throw fail(403, 'Cross-origin requests are not allowed.');
          const url = new URL(req.url, `http://${host}`);
          if (req.method === 'GET') {
            if (url.pathname === '/history') {
              const task = queue.then(async () => {
                const data = await load();
                const post = data.posts.find(p => p.id === url.searchParams.get('id'));
                if (!post) throw fail(404, 'Draft not found.');
                // Give pre-history drafts a durable ID before a restore can select it.
                data.histories ??= {};
                if (!data.histories[post.id]) {
                  data.histories[post.id] = [snapshot(post)];
                  await save(data);
                }
                return data.histories[post.id];
              });
              queue = task.catch(() => {});
              return respond(200, await task);
            }
            await queue;
            const data = await load();
            if (url.pathname === '/posts') return respond(200, data.posts.filter(p => p.published).map(p => ({ id: p.id, example: p.example, ...p.published, comments: data.comments.filter(c => c.postId === p.id).length })));
            if (url.pathname === '/drafts') return respond(200, data.posts);
            throw fail(404, 'Not found.');
          }
          if (req.method !== 'POST') throw fail(405, 'Method not allowed.');
          if (url.pathname === '/upload') {
            if (req.headers.origin !== `http://${host}`) throw fail(403, 'Upload pictures from the localhost editor.');
            if (!/^image\/(png|jpeg|webp|gif|avif)(?:;|$)/i.test(req.headers['content-type'] ?? '')) throw fail(415, 'Use a PNG, JPG, WebP, GIF, or AVIF picture.');
            if (Number(req.headers['content-length']) > MAX_IMAGE_BYTES) throw fail(413, 'Choose a picture under 10 MB.');
            const chunks = [];
            let bytes = 0;
            for await (const chunk of req) {
              bytes += chunk.length;
              if (bytes > MAX_IMAGE_BYTES) throw fail(413, 'Choose a picture under 10 MB.');
              chunks.push(chunk);
            }
            let name;
            try { name = decodeURIComponent(String(req.headers['x-image-name'] ?? 'picture')); }
            catch { throw fail(400, 'The picture filename could not be read. Choose the file again.'); }
            return respond(200, await saveBlogImage(Buffer.concat(chunks), name, uploadPath));
          }
          if (!req.headers['content-type']?.startsWith('application/json')) throw fail(415, 'Send JSON content.');
          const chunks = [];
          let bytes = 0;
          for await (const chunk of req) {
            bytes += chunk.length;
            if (bytes > 3_100_000) throw fail(413, 'This post is too large. Keep it under 500,000 characters.');
            chunks.push(chunk);
          }
          let body;
          try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw fail(400, 'Invalid JSON.'); }
          if (!body || typeof body !== 'object') throw fail(400, 'Invalid request.');
          const task = queue.then(async () => {
            const data = await load();
            let result;
            if (url.pathname === '/save') {
              const existing = data.posts.find(p => p.id === body.id);
              if (body.id && !existing) throw fail(404, 'This draft no longer exists. Reload the editor.');
              if (existing && body.revision !== existing.revision) throw fail(409, 'This post changed in another tab. Reload the editor before saving. Your unsaved text is still here.');
              const title = text(body.title, 180, 'Title');
              const slug = slugify(text(body.slug, 100, 'URL slug') || title) || `untitled-${randomUUID().slice(0, 8)}`;
              if (data.posts.some(p => p.id !== existing?.id && (p.slug === slug || p.published?.slug === slug))) throw fail(409, 'That URL is already used by another post. Choose a different slug.');
              const tags = text(body.tags, 200, 'Tags').split(',').map(t => t.trim()).filter(Boolean);
              if (tags.length > 5 || tags.some(t => t.length > 30)) throw fail(400, 'Use up to 5 tags, each under 30 characters.');
              const icon = body.icon ?? existing?.icon ?? defaultPostIcon(tags);
              if (!BLOG_ICONS.some(option => option.value === icon)) throw fail(400, 'Choose a valid post icon.');
              let picture;
              try { picture = postImage(body.image ?? existing?.image, body.imageAlt ?? existing?.imageAlt); } catch (error) { throw fail(400, error.message); }
              const now = new Date().toISOString();
              const post = { ...existing, id: existing?.id ?? randomUUID(), title, slug, excerpt: text(body.excerpt, 400, 'Description'), content: text(body.content, 500_000, 'Content'), tags: [...new Set(tags)], icon, ...picture, createdAt: existing?.createdAt ?? now, updatedAt: now, revision: (existing?.revision ?? 0) + 1 };
              data.histories ??= {};
              const history = data.histories[post.id] ??= existing ? [snapshot(existing)] : [];
              if (!history.length || !sameVersion(history.at(-1), post)) history.push(snapshot(post));
              if (existing) data.posts[data.posts.indexOf(existing)] = post;
              else data.posts.push(post);
              result = post;
            } else if (url.pathname === '/restore-history') {
              const post = data.posts.find(p => p.id === body.id);
              if (!post) throw fail(404, 'Draft not found.');
              if (body.revision !== post.revision) throw fail(409, 'This draft changed in another tab. Reload the editor and reopen history before restoring.');
              const entry = data.histories?.[post.id]?.find(version => version.id === body.versionId);
              if (!entry) throw fail(404, 'This saved version no longer exists. Reopen history.');
              if (data.posts.some(p => p.id !== post.id && (p.slug === entry.slug || p.published?.slug === entry.slug))) throw fail(409, 'This version uses a URL now taken by another post. Change the other post URL before restoring.');
              if (!sameVersion(data.histories[post.id].at(-1), post)) data.histories[post.id].push(snapshot(post));
              Object.assign(post, Object.fromEntries(versionFields.map(key => [key, entry[key]])), { revision: post.revision + 1, updatedAt: new Date().toISOString() });
              data.histories[post.id].push(snapshot(post));
              result = post;
            } else if (['/archive-history', '/delete-archived-history'].includes(url.pathname)) {
              const post = data.posts.find(p => p.id === body.id);
              if (!post) throw fail(404, 'Draft not found.');
              if (body.revision !== post.revision) throw fail(409, 'This draft changed in another tab. Reload before managing history.');
              data.histories ??= {};
              const history = data.histories[post.id] ??= [snapshot(post)];
              if (url.pathname === '/archive-history') {
                const now = new Date().toISOString();
                for (const entry of history) entry.archivedAt ??= now;
              } else data.histories[post.id] = history.filter(entry => !entry.archivedAt);
              result = data.histories[post.id];
            } else if (['/publish', '/unpublish', '/delete'].includes(url.pathname)) {
              const post = data.posts.find(p => p.id === body.id);
              if (!post) throw fail(404, 'Post not found.');
              if (body.revision !== post.revision) throw fail(409, 'This post changed in another tab. Reload the editor.');
              if (url.pathname === '/delete') {
                await removePublishedPost(post.id, publishedPath);
                data.posts = data.posts.filter(p => p.id !== post.id);
                if (data.histories) delete data.histories[post.id];
                data.comments = data.comments.filter(c => c.postId !== post.id);
                result = { deleted: true };
              } else {
                if (url.pathname === '/publish') {
                  if (!post.title || !post.content) throw fail(400, 'Add a title and some content before publishing.');
                  if (data.posts.some(p => p.id !== post.id && p.published?.slug === post.slug)) throw fail(409, 'That URL is already published.');
                  post.published = { title: post.title, slug: post.slug, excerpt: post.excerpt, content: post.content, tags: post.tags, icon: post.icon ?? defaultPostIcon(post.tags), ...postImage(post.image, post.imageAlt), publishedAt: post.published?.publishedAt ?? new Date().toISOString() };
                  await writePublishedPost({ id: post.id, ...post.published, ...(post.example ? { example: true } : {}) }, publishedPath);
                  post.prepared = true;
                } else {
                  await removePublishedPost(post.id, publishedPath);
                  post.published = null;
                  post.prepared = false;
                }
                post.revision += 1;
                post.updatedAt = new Date().toISOString();
                result = post;
              }
            } else throw fail(404, 'Not found.');
            await save(data);
            return result;
          });
          queue = task.catch(() => {});
          respond(200, await task);
        } catch (error) {
          if (!error.status) server.config.logger.error(`[local-blog] ${error.message}`);
          respond(error.status ?? 500, { error: error.status ? error.message : 'Could not read or save the local blog. Check the server terminal and try again.' });
        }
      });
    },
  };
}
