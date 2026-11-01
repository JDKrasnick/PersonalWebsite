import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const { outputText } = ts.transpileModule(readFileSync(new URL('../src/lib/github-activity.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
});
const { rankPR, normalizeDay, selectHighlights, githubActivity } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
const date = '2026-10-28';
const connection = nodes => ({ nodes, pageInfo: { hasNextPage: false } });
function raw(overrides = {}) {
  return { title: 'Real PR', url: 'https://github.com/example/repo/pull/1', number: 1, state: 'MERGED',
    createdAt: `${date}T05:00:00Z`, mergedAt: `${date}T10:00:00Z`, author: { login: 'JDKrasnick' }, mergedBy: { login: 'JDKrasnick' },
    repository: { nameWithOwner: 'example/repo', isPrivate: false }, additions: 34, deletions: 8, changedFiles: 3,
    comments: { totalCount: 7 }, reviews: { totalCount: 2 }, reactions: { totalCount: 4 }, ...overrides };
}
function collection(prs = []) {
  return { pullRequestContributions: connection(prs.map(pullRequest => ({ pullRequest }))),
    pullRequestReviewContributions: connection([]), issueContributions: connection([]), commitContributionsByRepository: [] };
}
test('day activity combines authored PRs and merges of others work, without duplicate PRs or private data', () => {
  const mine = raw(), merged = raw({ url: 'https://github.com/example/repo/pull/2', number: 2, createdAt: '2026-09-01T00:00:00Z', author: { login: 'someone-else' } });
  const hidden = raw({ title: 'SECRET', repository: { nameWithOwner: 'private/secret', isPrivate: true } });
  const data = collection([mine, hidden]);
  data.commitContributionsByRepository = [
    { repository: { nameWithOwner: 'example/repo', isPrivate: false }, contributions: connection([{ commitCount: 3 }]) },
    { repository: { nameWithOwner: 'private/secret', isPrivate: true }, contributions: connection([{ commitCount: 19 }]) },
  ];
  data.pullRequestReviewContributions = connection([{ pullRequestReview: { url: mine.url, state: 'APPROVED', pullRequest: mine } }, { pullRequestReview: { url: hidden.url, state: 'APPROVED', pullRequest: hidden } }]);
  data.issueContributions = connection([{ issue: { title: 'SECRET', url: 'https://github.com/private/secret/issues/1', repository: hidden.repository } }]);
  const result = normalizeDay(date, data, connection([mine, merged, hidden]), connection([mine]));
  assert.equal(result.pullRequests.length, 2);
  assert.deepEqual(result.pullRequests.find(pr => pr.number === 1).actions, ['Opened', 'Merged by JD']);
  assert.deepEqual(result.pullRequests.find(pr => pr.number === 2).actions, ['Merged by JD']);
  assert.equal(result.commits[0].count, 3); assert.equal(result.reviews.length, 1);
  assert.equal(result.issues.length, 0); assert.ok(!JSON.stringify(result).includes('SECRET')); assert.ok(!JSON.stringify(result).includes('private/secret'));
});
test('PRs merged on another day are not presented as merges for the selected date', () => {
  const result = normalizeDay(date, collection([raw({ mergedAt: '2026-10-29T10:00:00Z' })]), connection([]), connection([]));
  assert.deepEqual(result.pullRequests[0].actions, ['Opened']);
  const empty = normalizeDay(date, collection([]), connection([raw({ mergedAt: '2026-10-29T10:00:00Z', createdAt: '2026-10-20T00:00:00Z' })]), connection([]));
  assert.equal(empty.pullRequests.length, 0);
});
test('ranking balances discussion, reactions, reviews and code; huge diffs do not dominate', () => {
  const base = { title: 'PR', url: 'https://github.com/example/repo/pull/1', repository: 'example/repo', number: 1, state: 'MERGED', date, actions: [], comments: 0, reactions: 0, reviews: 0, additions: 20, deletions: 0, files: 1 };
  const huge = rankPR({ ...base, additions: 1000000, files: 10000 });
  const discussion = rankPR({ ...base, comments: 5, reactions: 3, reviews: 2 });
  assert.ok(discussion.score > huge.score);
  assert.ok(discussion.reasons.includes('5 comments')); assert.ok(discussion.reasons.includes('3 reactions'));
  assert.equal(rankPR({ ...base, additions: 500 }).score, rankPR({ ...base, additions: 1000000 }).score);
});
test('highlights diversify repositories and deduplicate the same PR across queries', () => {
  const prs = [1, 2, 3, 4].map(number => ({ ...rankPR({ title: `PR ${number}`, url: `https://github.com/example/repo/pull/${number}`, repository: number < 3 ? 'a' : `repo-${number}`, number, state: 'MERGED', date, actions: [], comments: 20 - number, reactions: 0, reviews: 0, additions: 0, deletions: 0, files: 1 }) }));
  const highlights = selectHighlights([...prs, prs[0]]);
  assert.equal(highlights.length, 3); assert.equal(new Set(highlights.map(pr => pr.repository)).size, 3);
});
test('partial or failed GitHub responses are errors, not an invented empty history', async () => {
  const token = 'test-only';
  for (const response of [{ ok: false }, { ok: true, json: async () => ({ errors: [{ message: 'rate limit' }] }) }]) {
    await assert.rejects(githubActivity(date, token, async () => response), /unavailable/);
  }
  let sent;
  await githubActivity(date, token, async (url, options) => {
    sent = JSON.parse(options.body).query;
    return { ok: true, json: async () => ({ data: { user: { contributionsCollection: collection() }, mergedBy: connection([]), mergedAuthored: connection([]) } }) };
  });
  assert.ok(sent.includes(`merged-by:JDKrasnick merged:${date}`)); assert.ok(sent.includes('is:public'));
});
test('pagination is visible as incomplete coverage', () => {
  const data = collection(); data.issueContributions.pageInfo.hasNextPage = true;
  assert.equal(normalizeDay(date, data, connection([]), connection([])).limited, true);
});

test('highlight cards preserve authorship and distinguish merging another persons PR', async () => {
  const mine = raw();
  const someoneElses = raw({ url: 'https://github.com/other/project/pull/9', number: 9, author: { login: 'someone-else' }, repository: { nameWithOwner: 'other/project', isPrivate: false } });
  const result = await githubActivity(null, 'test-only', async () => ({ ok: true, json: async () => ({ data: { authored: connection([mine]), mergedBy: connection([someoneElses]) } }) }));
  assert.deepEqual(result.pullRequests.find(pr => pr.number === 1).actions, ['Authored by JD', 'Merged by JD']);
  assert.deepEqual(result.pullRequests.find(pr => pr.number === 9).actions, ['Merged by JD']);
});
