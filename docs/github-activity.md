# GitHub contribution skyline

The calendar uses GitHub's public contribution fragment. Clicking a day calls
`/api/github-activity?date=YYYY-MM-DD` for authored PRs, PRs merged by JD,
authored PRs merged that day, repository-level commit counts, reviews, and issues.
The selected day opens in a small native auto popover beside the clicked cell,
with no backdrop or modal focus trap. It chooses the available side, stays within
the viewport, and follows the selected cell on scroll and resize. The graph keeps
its width, position, and camera. Clicking elsewhere dismisses the popover without
stealing focus; Escape and the close button also dismiss it. Keyboard focus is indicated in the help text rather
than by a blue border around the whole graph. The Black palette uses neutral
charcoal-to-silver levels. Busiest day displays the actual date (the most recent
date in a tie), with its contribution count in the title. The date-range footer
is omitted; selected-day announcements remain available to screen readers.
The server uses GitHub's GraphQL contribution records rather than the short-lived
events feed, so older calendar dates work too. Only public repositories appear.

Local development reuses the existing `gh` login. In hosted environments, set
the server-only `GITHUB_ACTIVITY_TOKEN` environment variable to a GitHub token
that can read public GraphQL data. No credentials enter the client bundle, API
responses, or checked-in files. Without a hosted token, the calendar still works
and history requests show a retry state. This change does not configure or deploy
production credentials.

Day records and highlights cache for 15 minutes in the server and at the edge.
Concurrent requests for the same date share one upstream request. Requests reject
invalid, future, and out-of-calendar dates. Failed reads are not cached as empty
activity. The client cancels stale requests when switching or closing days.

PR history and ranking appear only in the panel after selecting a day. There is
no standalone PR section or automatic highlights request on the homepage.
The optional no-date API selects notable PRs from up to 60 authored and 40 merged public candidates
from the past year, ordered by discussion in GitHub's search. Ranking uses capped
logarithmic discussion, reaction, and review counts, a small capped contribution
from diff size and changed files, and merge status. The first pass selects one PR
per repository. This is an explainable selection, not a measurement of impact or
an exhaustive all-time ranking. Metrics are current totals, not historical values
at the selected date. The UI displays the actual counts and selection reasons.

GitHub may count contributions without public detail records. Private data is
discarded on the server even when the credential has broader access. Pagination
limits produce an explicit incomplete-coverage note.

References: [GitHub contributionsCollection](https://docs.github.com/en/graphql/reference/objects#contributionscollection)
and [GitHub search](https://docs.github.com/en/search-github/searching-on-github/searching-issues-and-pull-requests).

Validation: `npm run check`, `npm test`, and `npm run build`.
