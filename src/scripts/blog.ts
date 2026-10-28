import { Marked } from 'marked';
import DOMPurify from 'dompurify';
import hljs from 'highlight.js/lib/common';
import { mountDemos } from './blog-demos';

type Published = { title: string; slug: string; excerpt: string; content: string; tags: string[]; publishedAt: string; icon?: string; image?: string; imageAlt?: string };
type Post = Published & { id: string; example?: boolean; comments?: number };
type Draft = Omit<Published, 'publishedAt'> & { id: string; revision: number; createdAt: string; updatedAt: string; published?: Published; prepared?: boolean; example?: boolean };
type Comment = { id: string; name: string; content: string; createdAt: string };
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const escape = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));
const date = (value: string, short = false) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...(short ? {} : { year: 'numeric' }) });
const words = (content: string) => content.trim().split(/\s+/).filter(Boolean).length;
const readTime = (content: string) => `${Math.max(1, Math.ceil(words(content) / 220))} min read`;
const urlFor = (post: { slug: string }) => `/blog/post?slug=${encodeURIComponent(post.slug)}`;
const arrow = (direction: 'left' | 'right' | 'up-right' = 'right') => `<svg class="arrow-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6" transform="rotate(${direction === 'left' ? 180 : direction === 'up-right' ? -45 : 0} 12 12)" /></svg>`;
const slugify = (value: string) => value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 100);

async function api<T>(path: string, body?: unknown): Promise<T> {
  if (!import.meta.env.DEV && (path !== 'posts' || body !== undefined)) throw new Error('The writing workspace is only available on your computer.');
  const url = import.meta.env.DEV ? `/api/blog/${path}` : '/blog/posts.json';
  const response = await fetch(url, body === undefined ? { cache: 'no-store' } : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('The blog is available in the local development server. Run npm run dev to open your writing workspace.');
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
  return data;
}
function showError(id: string, error: unknown) { $(id).textContent = error instanceof Error ? error.message : 'Something went wrong. Please try again.'; $(id).hidden = false; }
function toast(message: string) { $('toast').textContent = message; $('toast').hidden = false; window.setTimeout(() => { $('toast').hidden = true; }, 3500); }
const markdown = new Marked({ gfm: true, breaks: false, renderer: { code({ text, lang }) {
  const language = (lang || '').split(/\s+/)[0];
  const code = hljs.getLanguage(language) ? hljs.highlight(text, { language }).value : escape(text);
  return `<pre><code${language ? ` class="language-${escape(language)}"` : ''}>${code}</code></pre>`;
} } });
export function renderMarkdown(content: string) { return DOMPurify.sanitize(markdown.parse(content, { async: false }) as string, { USE_PROFILES: { html: true }, FORBID_TAGS: ['style', 'form', 'input', 'button', 'textarea', 'select', 'iframe'], FORBID_ATTR: ['style', 'id', 'name'] }); }
function enhanceCode(root: HTMLElement) {
  root.querySelectorAll('pre').forEach(pre => {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'copy-code'; button.textContent = 'Copy'; button.setAttribute('aria-label', 'Copy code');
    button.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(pre.querySelector('code')?.textContent || ''); button.textContent = 'Copied'; setTimeout(() => { button.textContent = 'Copy'; }, 1800); }
      catch { toast('Could not copy. Select the code and copy it manually.'); }
    });
    pre.append(button);
  });
}
const exampleBadge = (post: { example?: boolean }) => post.example ? '<span class="example-badge">Example article</span>' : '';

export async function initIndex() {
  let posts: Post[] = [];
  let selected = 'All';
  const toggle = $<HTMLButtonElement>('toggle-search');
  const input = $<HTMLInputElement>('search-posts');
  const setSearchOpen = (open: boolean) => {
    $('archive-sidebar').hidden = !open;
    $('archive-layout').classList.toggle('search-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    if (open) input.focus(); else toggle.focus();
  };
  toggle.addEventListener('click', () => setSearchOpen(toggle.getAttribute('aria-expanded') !== 'true'));
  $('close-search').addEventListener('click', () => setSearchOpen(false));
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && !$('archive-sidebar').hidden) setSearchOpen(false); });
  const clearFilters = () => { selected = 'All'; input.value = ''; renderFilters(); renderList(); };
  $('reset-search').addEventListener('click', () => { clearFilters(); input.focus(); });
  const renderList = () => {
    const query = $<HTMLInputElement>('search-posts').value.toLowerCase().trim();
    const filtered = posts.filter(post => (selected === 'All' || post.tags.includes(selected)) && `${post.title} ${post.excerpt} ${post.tags.join(' ')} ${post.content}`.toLowerCase().includes(query));
    $('post-count').textContent = `${filtered.length} article${filtered.length === 1 ? '' : 's'}`;
    $('filter-count').textContent = $('post-count').textContent;
    const active = Boolean(query || selected !== 'All');
    $('reset-search').hidden = !active;
    toggle.classList.toggle('has-filters', active);
    toggle.setAttribute('aria-label', `Search and filter posts${active ? ' (filters active)' : ''}`);
    $('post-list').innerHTML = filtered.length ? filtered.map(post => `<article class="post-row${post.image ? ' has-picture' : ''}"><time datetime="${escape(post.publishedAt)}">${date(post.publishedAt)}</time><div class="post-row-copy"><h2><a href="${urlFor(post)}">${escape(post.title)}</a></h2>${exampleBadge(post)}</div>${post.image ? `<a class="post-thumbnail" href="${urlFor(post)}" tabindex="-1" aria-hidden="true"><img src="${escape(post.image)}" alt="" width="220" height="144" loading="lazy" /></a>` : ''}</article>`).join('') : `<div class="empty-state"><h3>${posts.length ? 'No articles found.' : 'No posts yet.'}</h3><p>${posts.length ? 'Try another search or topic.' : import.meta.env.DEV ? 'Open the editor to write your first post.' : 'New posts will appear here.'}</p>${posts.length ? '<button class="button button-quiet" id="clear-filters">Clear filters</button>' : import.meta.env.DEV ? `<a class="button button-primary" href="/blog/editor">Write a post ${arrow()}</a>` : ''}</div>`;
    $('post-list').querySelectorAll<HTMLImageElement>('img').forEach(img => img.addEventListener('error', () => { const row = img.closest('.has-picture'); img.closest('.post-thumbnail')?.remove(); row?.classList.remove('has-picture'); }));
    $('clear-filters')?.addEventListener('click', () => { clearFilters(); toggle.focus(); });
  };
  const renderFilters = () => {
    $('tag-filters').innerHTML = ['All', ...new Set(['Engineering', 'Research', ...posts.flatMap(post => post.tags)])].map(tag => `<button type="button" aria-pressed="${selected === tag}" data-tag="${escape(tag)}">${escape(tag === 'All' ? 'All topics' : tag)}</button>`).join('');
    $('tag-filters').querySelectorAll<HTMLButtonElement>('button').forEach(button => button.addEventListener('click', () => { selected = button.dataset.tag!; renderFilters(); renderList(); [...$('tag-filters').querySelectorAll<HTMLButtonElement>('button')].find(item => item.dataset.tag === selected)?.focus(); }));
  };
  try {
    posts = (await api<Post[]>('posts')).sort((a, b) => +new Date(b.publishedAt) - +new Date(a.publishedAt));
    renderFilters(); renderList();
    $('search-posts').addEventListener('input', renderList);
  } catch (error) { $('post-list').innerHTML = ''; showError('blog-error', error); }
}

export async function initReader() {
  const params = new URLSearchParams(location.search);
  const draftId = import.meta.env.DEV ? params.get('draft') : null;
  try {
    let post: Post;
    if (draftId) {
      const draft = (await api<Draft[]>('drafts')).find(p => p.id === draftId);
      if (!draft) throw new Error('This draft could not be found. Open the editor to select a post.');
      post = { ...draft, publishedAt: draft.updatedAt };
      $('reader-notice').innerHTML = `Draft preview. This version has not been published. <a href="/blog/editor?id=${encodeURIComponent(draftId)}">Back to editor</a>`;
      $('reader-notice').hidden = false;
    } else {
      const found = (await api<Post[]>('posts')).find(p => p.slug === params.get('slug'));
      if (!found) throw new Error('This article is not published or the link has changed. Return to All writing to find a post.');
      post = found;
    }
    document.title = `${post.title || 'Untitled post'} | JD Krasnick`;
    if (post.example && !draftId) { $('reader-notice').innerHTML = import.meta.env.DEV ? 'This is an example article. Try editing it, or create a post of your own in the <a href="/blog/editor">editor</a>.' : 'This is an example article demonstrating the blog format.'; $('reader-notice').hidden = false; }
    $('article').innerHTML = `<header class="article-header"><h1>${escape(post.title || 'Untitled post')}</h1><div class="post-meta"><span>JD Krasnick</span><span>${date(post.publishedAt)}</span>${exampleBadge(post)}</div></header>${post.image ? `<figure class="article-picture"><img src="${escape(post.image)}" alt="${escape(post.imageAlt || '')}" width="1200" height="675" fetchpriority="high" /></figure>` : ''}<div class="prose">${renderMarkdown(post.content)}</div><div class="article-end"><a href="/blog">${arrow('left')} All writing</a>${import.meta.env.DEV ? `<a href="/blog/editor?id=${encodeURIComponent(post.id)}">${draftId ? 'Continue editing' : 'Edit post'} ${arrow('up-right')}</a>` : ''}</div>`;
    $('article').querySelector<HTMLImageElement>('.article-picture img')?.addEventListener('error', event => { (event.target as HTMLImageElement).closest('figure')?.remove(); });
    mountDemos($('article'));
    enhanceCode($('article'));
    if (draftId) return;
    $('discussion').hidden = false;
    let token = '', cursor: string | null = null, comments: Comment[] = [];
    const commentRequest = async <T>(options?: RequestInit, suffix = ''): Promise<T> => {
      const response = await fetch(`/api/comments?postId=${encodeURIComponent(post.id)}${suffix}`, options);
      if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('Comments are temporarily unavailable. Please try again later.');
      const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Could not load comments. Please try again.'); return data;
    };
    const loadComments = async (older = false) => {
      const page = await commentRequest<{ comments: Comment[]; count: number; cursor: string | null; token: string }>(undefined, older && cursor ? `&cursor=${encodeURIComponent(cursor)}` : '');
      token = page.token; cursor = page.cursor;
      comments = older ? [...comments, ...page.comments.filter(c => !comments.some(existing => existing.id === c.id))] : page.comments;
      $('comment-count').textContent = String(page.count);
      $('comment-list').innerHTML = comments.length ? comments.map(c => `<div class="comment"><div><strong>${escape(c.name)}</strong><time datetime="${escape(c.createdAt)}">${date(c.createdAt)}</time>${import.meta.env.DEV ? `<button type="button" class="text-button comment-remove" data-id="${escape(c.id)}" aria-label="Remove comment by ${escape(c.name)}">Remove</button>` : ''}</div><p>${escape(c.content)}</p></div>`).join('') : '<p class="comment-empty">No comments yet. Start the conversation.</p>';
      $('load-comments').hidden = !cursor;
      $('comment-error').hidden = true; $('retry-comments').hidden = true;
      $<HTMLButtonElement>('submit-comment').disabled = false;
      if (import.meta.env.DEV) $('comment-list').querySelectorAll<HTMLButtonElement>('[data-id]').forEach(button => button.addEventListener('click', async () => {
        if (!confirm('Remove this comment from the discussion?')) return;
        try { await commentRequest({ method: 'DELETE' }, `&id=${encodeURIComponent(button.dataset.id!)}`); await loadComments(); } catch (error) { showError('comment-error', error); }
      }));
    };
    const commentLoadError = (error: unknown) => { showError('comment-error', error); $('retry-comments').hidden = false; };
    try { await loadComments(); } catch (error) { commentLoadError(error); }
    $('retry-comments').addEventListener('click', () => { void loadComments().catch(commentLoadError); });
    $('load-comments').addEventListener('click', async () => { const button = $<HTMLButtonElement>('load-comments'); button.disabled = true; try { await loadComments(true); } catch (error) { commentLoadError(error); } finally { button.disabled = false; } });
    $<HTMLFormElement>('comment-form').addEventListener('submit', async event => {
      event.preventDefault();
      const button = $<HTMLButtonElement>('submit-comment');
      button.disabled = true; button.textContent = 'Posting…'; $('comment-error').hidden = true;
      try {
        await commentRequest({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: $<HTMLInputElement>('comment-name').value, content: $<HTMLTextAreaElement>('comment-content').value, website: $<HTMLInputElement>('comment-website').value, token }) });
        $<HTMLTextAreaElement>('comment-content').value = '';
        await loadComments(); toast('Comment posted.');
      } catch (error) { showError('comment-error', error); $('retry-comments').hidden = false; }
      finally { button.disabled = false; button.innerHTML = `Post comment ${arrow()}`; }
    });
  } catch (error) { $('article').innerHTML = ''; showError('reader-notice', error); }
}

export { $, escape, date, words, readTime, urlFor, arrow, slugify, api, showError, toast, type Draft };
