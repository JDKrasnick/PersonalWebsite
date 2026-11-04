import type { APIRoute } from 'astro';
import { githubActivity } from '../../lib/github-activity';

export const prerender = false;
const cache = new Map<string, { expires: number; data: unknown }>();
const pending = new Map<string, Promise<unknown>>();
let localToken: string | undefined;

async function token() {
  const configured = process.env.GITHUB_ACTIVITY_TOKEN;
  if (configured) return configured;
  if (import.meta.env.DEV) {
    if (localToken) return localToken;
    // Reuse the signed-in CLI locally; never write credentials to public output.
    const { execFile } = await import('node:child_process');
    localToken = await new Promise<string>((resolve, reject) => {
      execFile('gh', ['auth', 'token', '--hostname', 'github.com'], { timeout: 4000, maxBuffer: 8192 }, (error, stdout) => error ? reject(new Error('GitHub unavailable')) : resolve(stdout.trim()));
    });
    return localToken;
  }
  throw new Error('GitHub activity unavailable');
}

export const GET: APIRoute = async ({ url }) => {
  const date = url.searchParams.get('date');
  if (date !== null) {
    const parsed = new Date(`${date}T00:00:00Z`);
    const today = new Date().toISOString().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(+parsed) || parsed.toISOString().slice(0, 10) !== date || date > today || +parsed < Date.now() - 401 * 86400000) {
      return Response.json({ error: 'Choose a day in this contribution calendar.' }, { status: 400 });
    }
  }
  const key = date ?? 'highlights';
  try {
    let entry = cache.get(key);
    if (!entry || entry.expires <= Date.now()) {
      let request = pending.get(key);
      if (!request) {
        request = token().then(value => githubActivity(date, value));
        pending.set(key, request);
      }
      try {
        entry = { data: await request, expires: Date.now() + 15 * 60000 };
        if (cache.size >= 420) cache.delete(cache.keys().next().value!);
        cache.set(key, entry);
      } finally { pending.delete(key); }
    }
    return Response.json(entry.data, { headers: { 'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=3600' } });
  } catch {
    return Response.json({ error: 'GitHub activity could not be loaded. Try again shortly.' }, { status: 503, headers: { 'Cache-Control': 'no-store', 'Retry-After': '30' } });
  }
};
