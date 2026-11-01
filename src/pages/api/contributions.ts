import type { APIRoute } from 'astro';
import { parseContributions } from '../../lib/contributions';

export const prerender = false;

export const GET: APIRoute = async () => {
  try {
    const response = await fetch('https://github.com/users/JDKrasnick/contributions', {
      headers: { Accept: 'text/html', 'User-Agent': 'jdkrasnick-portfolio' },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error('GitHub calendar unavailable');
    const days = parseContributions(await response.text());
    return Response.json({ username: 'JDKrasnick', days }, {
      headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' },
    });
  } catch {
    return Response.json({ error: 'GitHub activity is temporarily unavailable.' }, {
      status: 503, headers: { 'Cache-Control': 'no-store' },
    });
  }
};
