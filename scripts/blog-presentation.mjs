import { Marked } from 'marked';
import sanitizeHtml from 'sanitize-html';
import hljs from 'highlight.js/lib/common';
import { preserveArticleSpacing } from '../src/lib/blog-markdown-spacing.js';

const escape = value => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const markdown = new Marked({ gfm: true, renderer: { code({ text, lang }) {
  const language = (lang || '').split(/\s+/)[0];
  return `<pre><code${language ? ` class="language-${escape(language)}"` : ''}>${hljs.getLanguage(language) ? hljs.highlight(text, { language }).value : escape(text)}</code></pre>`;
} } });
export function renderPublishedMarkdown(content) {
  return sanitizeHtml(markdown.parser(preserveArticleSpacing(markdown.lexer(content))), {
    allowedTags: [...sanitizeHtml.defaults.allowedTags, 'img', 'del'],
    allowedAttributes: { a: ['href', 'title'], img: ['src', 'alt', 'title', 'width', 'height'], code: ['class'], span: ['class'], th: ['align', 'colspan', 'rowspan'], td: ['align', 'colspan', 'rowspan'], ol: ['start'] },
    allowedSchemes: ['http', 'https', 'mailto'], allowedSchemesByTag: { img: ['http', 'https'] }, allowProtocolRelative: false,
  });
}
export function blogSitemap(posts) {
  const urls = [{ path: '/' }, { path: '/blog/' }, ...posts.map(post => ({ path: `/blog/${post.slug}/`, date: post.publishedAt }))];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map(item => `<url><loc>https://www.jdkrasnick.com${escape(item.path)}</loc>${item.date ? `<lastmod>${escape(item.date)}</lastmod>` : ''}</url>`).join('')}</urlset>\n`;
}
