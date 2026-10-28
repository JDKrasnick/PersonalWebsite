import { readdir, readFile, mkdir, writeFile, rename, rm, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import matter from 'gray-matter';
import { BLOG_ICONS, defaultPostIcon } from '../src/lib/blog-icons.js';
import { postImage } from '../src/lib/blog-images.js';
import { collectDemos } from '../src/lib/blog-demos.js';

export async function validateDemoAssets(content, publicDirectory = resolve('public')) {
  let demos;
  try { demos = collectDemos(content); } catch (error) { throw Object.assign(error, { status: 400 }); }
  for (const demo of demos) {
    try { if (!(await stat(resolve(publicDirectory, demo.src.slice(1)))).isFile()) throw new Error('Not a file.'); }
    catch { throw Object.assign(new Error(`Demo file not found: public${demo.src}. Add it before preparing the post.`), { status: 400 }); }
  }
  return demos;
}

export const publishedDirectory = resolve('content/blog');
const validId = id => typeof id === 'string' && /^[a-zA-Z0-9_-]{1,120}$/.test(id);
const record = (data, content, filename) => {
  if (!validId(data.id) || typeof data.title !== 'string' || !data.title.trim() || typeof data.slug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(data.slug) || typeof data.excerpt !== 'string' || !Array.isArray(data.tags) || data.tags.some(t => typeof t !== 'string') || !Number.isFinite(Date.parse(data.publishedAt)) || !content.trim()) throw new Error(`Invalid published blog post: ${filename}`);
  const icon = data.icon ?? defaultPostIcon(data.tags);
  if (!BLOG_ICONS.some(option => option.value === icon)) throw new Error(`Invalid post icon: ${filename}`);
  return { id: data.id, title: data.title, slug: data.slug, excerpt: data.excerpt, tags: data.tags, icon, ...postImage(data.image, data.imageAlt), publishedAt: new Date(data.publishedAt).toISOString(), content: content.trim(), ...(data.example ? { example: true } : {}) };
};

export async function readPublishedPosts(directory = publishedDirectory) {
  let files;
  try { files = await readdir(directory); } catch (error) { if (error.code === 'ENOENT') return []; throw error; }
  const posts = await Promise.all(files.filter(file => file.endsWith('.md')).map(async file => {
    const parsed = matter(await readFile(resolve(directory, file), 'utf8'));
    return record(parsed.data, parsed.content, file);
  }));
  if (new Set(posts.map(p => p.id)).size !== posts.length || new Set(posts.map(p => p.slug)).size !== posts.length) throw new Error('Published blog posts must have unique IDs and URL slugs.');
  return posts.sort((a, b) => +new Date(b.publishedAt) - +new Date(a.publishedAt));
}

export async function writePublishedPost(post, directory = publishedDirectory) {
  const { content, ...metadata } = record(post, post.content, post.id);
  await validateDemoAssets(content);
  const others = await readPublishedPosts(directory);
  if (others.some(other => other.id !== post.id && other.slug === post.slug)) throw Object.assign(new Error('That URL is already used by a published post.'), { status: 409 });
  await mkdir(directory, { recursive: true });
  const filename = resolve(directory, `${post.id}.md`);
  const temporary = `${filename}.${randomUUID()}.tmp`;
  await writeFile(temporary, matter.stringify(`${content}\n`, metadata));
  await rename(temporary, filename);
}

export async function removePublishedPost(id, directory = publishedDirectory) {
  if (!validId(id)) throw new Error('Invalid post ID.');
  await rm(resolve(directory, `${id}.md`), { force: true });
}
