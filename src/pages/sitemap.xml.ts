import { readPublishedPosts } from '../../scripts/blog-content.mjs';
import { blogSitemap } from '../../scripts/blog-presentation.mjs';
export const prerender = true;
export async function GET() {
  return new Response(blogSitemap(await readPublishedPosts()), { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
}
