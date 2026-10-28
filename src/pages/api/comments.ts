import type { APIRoute } from 'astro';
import { createCommentsHandler } from '../../../scripts/comments.mjs';
import { redisComments } from '../../../scripts/comments-redis.mjs';
import matter from 'gray-matter';

export const prerender = false;
const committedPosts = Object.values(import.meta.glob<string>('/content/blog/*.md', { eager: true, query: '?raw', import: 'default' }));
type LocalComments = Awaited<ReturnType<typeof import('../../../scripts/comments-local.mjs').localComments>>;
let localStore: Promise<LocalComments> | undefined;

const handle: APIRoute = async ({ request, clientAddress }) => {
  const remote = redisComments({ url: import.meta.env.UPSTASH_REDIS_REST_URL, token: import.meta.env.UPSTASH_REDIS_REST_TOKEN, namespace: import.meta.env.COMMENTS_NAMESPACE || 'jd-blog-comments' });
  const local = import.meta.env.DEV && !remote ? await (localStore ??= import('../../../scripts/comments-local.mjs').then(module => module.localComments())) : undefined;
  const handler = createCommentsHandler({
    store: remote ?? local?.store,
    secret: import.meta.env.COMMENTS_SECRET || local?.secret,
    allowModeration: import.meta.env.DEV,
    getPostIds: async () => import.meta.env.DEV
      ? (await (await fetch(new URL('/api/blog/posts', request.url))).json()).map((post: { id: string }) => post.id)
      : committedPosts.map(raw => matter(raw).data.id),
  });
  const address = import.meta.env.DEV ? clientAddress : request.headers.get('x-vercel-forwarded-for')?.split(',')[0].trim() || clientAddress;
  return handler(request, address);
};
export const GET = handle;
export const POST = handle;
export const DELETE = handle;
