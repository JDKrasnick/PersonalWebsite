export const GITHUB_USER = 'JDKrasnick';
export interface ActivityPR {
  title: string; url: string; repository: string; number: number;
  state: string; date: string; actions: string[];
  comments: number; reviews: number; reactions: number;
  additions: number | null; deletions: number | null; files: number | null;
  reasons: string[]; score: number;
}
export interface DayActivity {
  date: string;
  pullRequests: ActivityPR[];
  commits: { repository: string; count: number; url: string }[];
  reviews: { title: string; repository: string; state: string; url: string }[];
  issues: { title: string; repository: string; url: string }[];
  limited: boolean;
}
interface Repository { nameWithOwner: string; isPrivate: boolean }
interface RawPR {
  title: string; url: string; number: number; state: string; createdAt: string; mergedAt: string | null;
  author: { login: string } | null; mergedBy: { login: string } | null; repository: Repository;
  additions: number; deletions: number; changedFiles: number;
  comments: { totalCount: number }; reviews: { totalCount: number }; reactions: { totalCount: number };
}
interface Connection<T> { nodes: T[]; pageInfo: { hasNextPage: boolean } }
interface Search extends Connection<RawPR> { issueCount: number }
interface Collection {
  pullRequestContributions: Connection<{ pullRequest: RawPR }>;
  pullRequestReviewContributions: Connection<{ pullRequestReview: { url: string; state: string; pullRequest: RawPR } }>;
  issueContributions: Connection<{ issue: { title: string; url: string; repository: Repository } }>;
  commitContributionsByRepository: { repository: Repository; contributions: Connection<{ commitCount: number }> }[];
}

const prFields = `title url number state createdAt mergedAt additions deletions changedFiles
  author { login } mergedBy { login } repository { nameWithOwner isPrivate }
  comments { totalCount } reviews { totalCount } reactions { totalCount }`;
const search = (name: string, query: string, size = 60) => `${name}: search(query: ${JSON.stringify(query)}, type: ISSUE, first: ${size}) {
  issueCount pageInfo { hasNextPage } nodes { ... on PullRequest { ${prFields} } }
}`;

// Each signal saturates. Churn contributes at most one point, so large generated
// diffs cannot overwhelm discussion, community response, or actual review.
export function rankPR(pr: Omit<ActivityPR, 'score' | 'reasons'>): ActivityPR {
  const log = (value: number, cap: number) => Math.log2(1 + Math.min(value, cap));
  const score = log(pr.comments, 30) * 1.6 + log(pr.reactions, 30) * 2.2 + log(pr.reviews, 12) * 1.2
    + Math.min(1, log((pr.additions ?? 0) + (pr.deletions ?? 0), 500) / 9)
    + Math.min(0.75, log(pr.files ?? 0, 20) / 6) + (pr.state === 'MERGED' ? 1 : 0);
  const reasons: string[] = [];
  if (pr.comments >= 3) reasons.push(`${pr.comments} comments`);
  if (pr.reactions >= 2) reasons.push(`${pr.reactions} reactions`);
  if (pr.reviews >= 2) reasons.push(`${pr.reviews} reviews`);
  if ((pr.files ?? 0) >= 8) reasons.push(`${pr.files} files changed`);
  if (!reasons.length) reasons.push(pr.state === 'MERGED' ? 'Merged contribution' : 'Recent contribution');
  return { ...pr, score, reasons: reasons.slice(0, 2) };
}

function normalize(pr: RawPR, date?: string): ActivityPR | null {
  // Authenticated reads must never disclose private repository activity.
  if (!pr?.repository || pr.repository.isPrivate || !/^https:\/\/github\.com\//.test(pr.url)) return null;
  const actions: string[] = [];
  if (!date) {
    if (pr.author?.login.toLowerCase() === GITHUB_USER.toLowerCase()) actions.push('Authored by JD');
    if (pr.mergedAt && pr.mergedBy?.login.toLowerCase() === GITHUB_USER.toLowerCase()) actions.push('Merged by JD');
    else actions.push(pr.state === 'MERGED' ? 'Merged' : pr.state === 'OPEN' ? 'Open' : 'Closed');
  }
  if (date && pr.createdAt.startsWith(date) && pr.author?.login.toLowerCase() === GITHUB_USER.toLowerCase()) actions.push('Opened');
  if (date && pr.mergedAt?.startsWith(date)) {
    if (pr.mergedBy?.login.toLowerCase() === GITHUB_USER.toLowerCase()) actions.push('Merged by JD');
    else if (pr.author?.login.toLowerCase() === GITHUB_USER.toLowerCase()) actions.push('Merged');
  }
  return rankPR({
    title: pr.title, url: pr.url, repository: pr.repository.nameWithOwner, number: pr.number,
    state: pr.state, date: date ?? pr.mergedAt?.slice(0, 10) ?? pr.createdAt.slice(0, 10), actions,
    comments: pr.comments.totalCount, reviews: pr.reviews.totalCount, reactions: pr.reactions.totalCount,
    additions: pr.additions, deletions: pr.deletions, files: pr.changedFiles,
  });
}

export function selectHighlights(prs: ActivityPR[], limit = 3) {
  const unique = [...new Map(prs.map(pr => [pr.url, pr])).values()].sort((a, b) => b.score - a.score || b.date.localeCompare(a.date));
  const selected: ActivityPR[] = [], repositories = new Set<string>();
  for (const pr of unique) {
    if (!repositories.has(pr.repository)) { selected.push(pr); repositories.add(pr.repository); }
    if (selected.length === limit) break;
  }
  for (const pr of unique) if (selected.length < limit && !selected.includes(pr)) selected.push(pr);
  return selected;
}

export function normalizeDay(date: string, collection: Collection, mergedBy: Search, mergedAuthored: Search): DayActivity {
  const found = [...collection.pullRequestContributions.nodes.map(node => node.pullRequest), ...mergedBy.nodes, ...mergedAuthored.nodes];
  const prs = found.map(pr => normalize(pr, date)).filter((pr): pr is ActivityPR => !!pr && pr.actions.length > 0);
  const pullRequests = [...new Map(prs.map(pr => [pr.url, pr])).values()].sort((a, b) => b.score - a.score);
  const commits = collection.commitContributionsByRepository.filter(entry => !entry.repository.isPrivate).map(entry => ({
    repository: entry.repository.nameWithOwner,
    count: entry.contributions.nodes.reduce((sum, node) => sum + node.commitCount, 0),
    url: `https://github.com/${entry.repository.nameWithOwner}/commits?author=${GITHUB_USER}&since=${date}T00%3A00%3A00Z&until=${date}T23%3A59%3A59Z`,
  })).filter(entry => entry.count > 0);
  const reviews = collection.pullRequestReviewContributions.nodes.filter(node => !node.pullRequestReview.pullRequest.repository.isPrivate).map(({ pullRequestReview: review }) => ({
    title: review.pullRequest.title, repository: review.pullRequest.repository.nameWithOwner, state: review.state, url: review.url,
  }));
  const issues = collection.issueContributions.nodes.filter(node => !node.issue.repository.isPrivate).map(({ issue }) => ({ title: issue.title, repository: issue.repository.nameWithOwner, url: issue.url }));
  return { date, pullRequests, commits, reviews, issues,
    limited: [collection.pullRequestContributions, collection.pullRequestReviewContributions, collection.issueContributions, mergedBy, mergedAuthored, ...collection.commitContributionsByRepository.map(repo => repo.contributions)].some(connection => connection.pageInfo.hasNextPage) || collection.commitContributionsByRepository.length === 100,
  };
}

export async function githubActivity(date: string | null, token: string, fetcher: typeof fetch = fetch) {
  const start = date ? `${date}T00:00:00Z` : '';
  const end = date ? `${date}T23:59:59Z` : '';
  const cutoff = new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10);
  const query = date ? `query {
    user(login: "${GITHUB_USER}") { contributionsCollection(from: "${start}", to: "${end}") {
      pullRequestContributions(first: 100) { pageInfo { hasNextPage } nodes { pullRequest { ${prFields} } } }
      pullRequestReviewContributions(first: 100) { pageInfo { hasNextPage } nodes { pullRequestReview { url state pullRequest { ${prFields} } } } }
      issueContributions(first: 100) { pageInfo { hasNextPage } nodes { issue { title url repository { nameWithOwner isPrivate } } } }
      commitContributionsByRepository(maxRepositories: 100) { repository { nameWithOwner isPrivate } contributions(first: 100) { pageInfo { hasNextPage } nodes { commitCount } } }
    } }
    ${search('mergedBy', `is:pr is:public merged-by:${GITHUB_USER} merged:${date}`, 100)}
    ${search('mergedAuthored', `is:pr is:public author:${GITHUB_USER} merged:${date}`, 100)}
  }` : `query {
    ${search('authored', `is:pr is:public author:${GITHUB_USER} created:>=${cutoff} sort:comments-desc`)}
    ${search('mergedBy', `is:pr is:public merged-by:${GITHUB_USER} merged:>=${cutoff} sort:comments-desc`, 40)}
  }`;
  const response = await fetcher('https://api.github.com/graphql', {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'User-Agent': 'jdkrasnick-portfolio' },
    body: JSON.stringify({ query }), signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error('GitHub activity unavailable');
  const result = await response.json() as {
    errors?: unknown[]; data?: { user: { contributionsCollection: Collection }; mergedBy: Search; mergedAuthored: Search; authored: Search };
  };
  if (result.errors?.length || !result.data) throw new Error('GitHub activity unavailable');
  const data = result.data;
  if (date) return normalizeDay(date, data.user.contributionsCollection, data.mergedBy, data.mergedAuthored);
  const candidates = [...data.authored.nodes, ...data.mergedBy.nodes].map(pr => normalize(pr)).filter((pr): pr is ActivityPR => !!pr);
  return { pullRequests: selectHighlights(candidates), limited: data.authored.pageInfo.hasNextPage || data.mergedBy.pageInfo.hasNextPage };
}
