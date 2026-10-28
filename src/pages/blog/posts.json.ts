import { readPublishedPosts } from '../../../scripts/blog-content.mjs';

export const prerender = true;
export async function GET() {
  return new Response(JSON.stringify(await readPublishedPosts()), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}
