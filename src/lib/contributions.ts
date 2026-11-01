export interface ContributionDay {
  date: string;
  count: number;
  level: number;
}

// GitHub publishes the calendar and exact counts in its public profile fragment.
// Join by cell ID: the HTML is ordered by weekday, rather than chronologically.
export function parseContributions(html: string): ContributionDay[] {
  const counts = new Map<string, number>();
  for (const match of html.matchAll(/<tool-tip\b([^>]*)>([\s\S]*?)<\/tool-tip>/g)) {
    const id = match[1].match(/\bfor="([^"]+)"/)?.[1];
    const text = match[2].replace(/<[^>]*>/g, '').trim();
    const count = text.match(/^([\d,]+) contributions? on /)?.[1];
    if (id && (count || /^No contributions on /.test(text))) {
      counts.set(id, count ? Number(count.replaceAll(',', '')) : 0);
    }
  }
  const days: ContributionDay[] = [];
  for (const match of html.matchAll(/<td\b([^>]*)>/g)) {
    const attrs = match[1];
    const date = attrs.match(/\bdata-date="(\d{4}-\d{2}-\d{2})"/)?.[1];
    const id = attrs.match(/\bid="([^"]+)"/)?.[1];
    const level = attrs.match(/\bdata-level="([0-4])"/)?.[1];
    if (date && id && level && counts.has(id)) {
      days.push({ date, count: counts.get(id)!, level: Number(level) });
    }
  }
  days.sort((a, b) => a.date.localeCompare(b.date));
  if (days.length < 350 || new Set(days.map(day => day.date)).size !== days.length) {
    throw new Error('GitHub returned an incomplete contribution calendar');
  }
  return days;
}
