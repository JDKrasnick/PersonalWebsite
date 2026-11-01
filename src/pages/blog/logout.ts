import type { APIRoute } from 'astro';
import { editorCookie, privateHeaders, requireSameOrigin } from '../../../scripts/blog-auth.mjs';
export const prerender = false;
export const POST: APIRoute = ({ request }) => {
  try { requireSameOrigin(request); }
  catch { return new Response('Open the editor on this website first.', { status: 403, headers: privateHeaders }); }
  return new Response(null, { status: 303, headers: { ...privateHeaders, 'Set-Cookie': editorCookie(request), Location: '/blog/login' } });
};
