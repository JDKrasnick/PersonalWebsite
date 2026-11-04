import type { APIRoute } from 'astro';
import { editorConfig } from '../../../../scripts/blog-auth.mjs';
import { privateBlogStore } from '../../../../scripts/blog-private-store.mjs';
import { createBlogAuthorHandler } from '../../../../scripts/blog-author.mjs';
export const prerender = false;
export const ALL: APIRoute = ({ request, params }) => {
  const config = editorConfig();
  return createBlogAuthorHandler({ config, store: privateBlogStore(config) })(request, params.action);
};
