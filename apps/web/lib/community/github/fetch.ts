import { toCardJson } from '@mustlist/build';
import { parseCard, validateFrontmatter } from '@mustlist/schema';
import type { CardJSON } from '@mustlist/schema/types';
import { SITE_URL } from '@/lib/site';
import { toneFor } from '../index';
import { REPO, REQUESTS_CATEGORY } from '../links';
import type { CommunityData, Proposal } from '../types';
import {
  activityFrom,
  cardFileOf,
  linkedRequests,
  mapDiscussion,
  mapPullRequest,
  peopleFrom,
  proposalStatus,
  type GhDiscussion,
  type GhPullRequest,
} from './map';

/**
 * Reads requests (Discussions in the "Requests" category) and proposals (pull
 * requests that change cards) from GitHub's GraphQL API. Server only: it needs
 * a token. Called by `loadCommunity()`, which caches the result.
 */

const ENDPOINT = 'https://api.github.com/graphql';
const MAX_PAGES = 4;

export class GitHubError extends Error {}

async function graphql<T>(
  token: string,
  query: string,
  variables: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'mustlist-site',
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!response.ok) throw new GitHubError(`GitHub GraphQL returned ${response.status}`);
  const json = (await response.json()) as { data?: T | null; errors?: { message: string }[] };
  const messages = (json.errors ?? []).map((e) => e.message).join('; ');
  if (!json.data) throw new GitHubError(messages || 'GitHub GraphQL returned no data');
  // A token without access to one field (for example check runs) still returns the
  // rest of the data, with that field null. Keep the data and log what was refused.
  if (messages) console.warn(`[community] GitHub returned partial data: ${messages}`);
  return json.data;
}

const REPO_QUERY = /* GraphQL */ `
  query Repo($owner: String!, $name: String!) {
    repository(owner: $owner, name: $name) {
      discussionCategories(first: 25) {
        nodes {
          id
          slug
        }
      }
      maintainers: object(expression: "HEAD:MAINTAINERS") {
        ... on Blob {
          text
        }
      }
      codeowners: object(expression: "HEAD:.github/CODEOWNERS") {
        ... on Blob {
          text
        }
      }
    }
  }
`;

const COMMENT_FIELDS = /* GraphQL */ `
  id url body createdAt
  author { login }
`;

export const DISCUSSIONS_QUERY = /* GraphQL */ `
  query Requests($owner: String!, $name: String!, $category: ID!, $after: String) {
    repository(owner: $owner, name: $name) {
      discussions(first: 40, after: $after, categoryId: $category, orderBy: { field: UPDATED_AT, direction: DESC }) {
        pageInfo { hasNextPage endCursor }
        nodes {
          number title body url createdAt updatedAt upvoteCount closed stateReason isAnswered
          author { login }
          labels(first: 10) { nodes { name } }
          comments(first: 50) {
            totalCount
            nodes {
              ${COMMENT_FIELDS}
              replies(first: 30) { nodes { ${COMMENT_FIELDS} } }
            }
          }
        }
      }
    }
  }
`;

const PULLS_QUERY = /* GraphQL */ `
  query Proposals($owner: String!, $name: String!, $after: String) {
    repository(owner: $owner, name: $name) {
      pullRequests(first: 25, after: $after, orderBy: { field: UPDATED_AT, direction: DESC }) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          number
          title
          body
          url
          createdAt
          updatedAt
          isDraft
          state
          mergedAt
          closedAt
          reviewDecision
          baseRefOid
          headRefOid
          author {
            login
          }
          mergedBy {
            login
          }
          labels(first: 10) {
            nodes {
              name
            }
          }
          files(first: 100) {
            nodes {
              path
              changeType
            }
          }
          commits(last: 1) {
            totalCount
            nodes {
              commit {
                committedDate
                statusCheckRollup {
                  state
                  contexts(first: 30) {
                    nodes {
                      __typename
                      ... on CheckRun {
                        name
                        status
                        conclusion
                        startedAt
                        completedAt
                        title
                      }
                      ... on StatusContext {
                        context
                        state
                        description
                      }
                    }
                  }
                }
              }
            }
          }
          reviewRequests(first: 20) {
            nodes {
              requestedReviewer {
                ... on User {
                  login
                }
              }
            }
          }
          reviews(first: 50) {
            nodes {
              id
              state
              body
              submittedAt
              author {
                login
              }
              comments(first: 30) {
                nodes {
                  id
                  path
                  line
                  body
                  createdAt
                  author {
                    login
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`;

interface Page<T> {
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
  nodes: T[];
}

async function paged<T>(load: (after: string | null) => Promise<Page<T>>): Promise<T[]> {
  const all: T[] = [];
  let after: string | null = null;
  for (let page = 0; page < MAX_PAGES; page++) {
    const result: Page<T> = await load(after);
    all.push(...result.nodes);
    if (!result.pageInfo.hasNextPage) break;
    after = result.pageInfo.endCursor;
  }
  return all;
}

/** Card files at each pull request's base and head, in one query. */
async function readCards(
  token: string,
  pulls: GhPullRequest[],
): Promise<Map<string, CardJSON | undefined>> {
  const wanted: { key: string; expression: string; path: string }[] = [];
  for (const pr of pulls) {
    const file = cardFileOf(pr);
    if (!file) continue;
    wanted.push({
      key: `b${pr.number}`,
      expression: `${pr.baseRefOid}:${file.path}`,
      path: file.path,
    });
    wanted.push({
      key: `h${pr.number}`,
      expression: `${pr.headRefOid}:${file.path}`,
      path: file.path,
    });
  }
  const cards = new Map<string, CardJSON | undefined>();
  for (let i = 0; i < wanted.length; i += 40) {
    const batch = wanted.slice(i, i + 40);
    const fields = batch
      .map((w, n) => `f${n}: object(expression: $e${n}) { ... on Blob { text } }`)
      .join('\n');
    const params = batch.map((_, n) => `$e${n}: String!`).join(', ');
    const query = `query Cards($owner: String!, $name: String!, ${params}) { repository(owner: $owner, name: $name) { ${fields} } }`;
    const variables: Record<string, unknown> = { owner: REPO.owner, name: REPO.name };
    batch.forEach((w, n) => (variables[`e${n}`] = w.expression));
    const data = await graphql<{ repository: Record<string, { text?: string } | null> }>(
      token,
      query,
      variables,
    );
    batch.forEach((w, n) => cards.set(w.key, toCard(data.repository[`f${n}`]?.text, w.path)));
  }
  return cards;
}

/** Card markdown -> CardJSON, or undefined when the file is missing or invalid. */
export function toCard(text: string | undefined, path: string): CardJSON | undefined {
  if (!text) return undefined;
  const parsed = parseCard(text, path);
  if (parsed.parseErrors.length) return undefined;
  const { data } = validateFrontmatter(parsed.frontmatter);
  return data ? toCardJson(parsed, data, SITE_URL) : undefined;
}

export async function fetchCommunity({
  token,
  cardIds,
}: {
  token: string;
  cardIds: string[];
}): Promise<CommunityData> {
  const vars = { owner: REPO.owner, name: REPO.name };
  const repo = await graphql<{
    repository: {
      discussionCategories: { nodes: { id: string; slug: string }[] };
      maintainers: { text?: string } | null;
      codeowners: { text?: string } | null;
    };
  }>(token, REPO_QUERY, vars);

  const category = repo.repository.discussionCategories.nodes.find(
    (c) => c.slug === REQUESTS_CATEGORY,
  );
  const people = peopleFrom(
    repo.repository.maintainers?.text ?? '',
    repo.repository.codeowners?.text ?? '',
    toneFor,
  );

  const [discussions, allPulls] = await Promise.all([
    category
      ? paged<GhDiscussion>(async (after) => {
          const data = await graphql<{ repository: { discussions: Page<GhDiscussion> } }>(
            token,
            DISCUSSIONS_QUERY,
            {
              ...vars,
              category: category.id,
              after,
            },
          );
          return data.repository.discussions;
        })
      : Promise.resolve([]),
    paged<GhPullRequest>(async (after) => {
      const data = await graphql<{ repository: { pullRequests: Page<GhPullRequest> } }>(
        token,
        PULLS_QUERY,
        {
          ...vars,
          after,
        },
      );
      return data.repository.pullRequests;
    }),
  ]);

  const pulls = allPulls.filter((pr) => cardFileOf(pr));
  const cards = await readCards(token, pulls);
  const requestNumbers = new Set(discussions.map((d) => d.number));

  const proposals = pulls
    .map((pr) =>
      mapPullRequest(pr, {
        base: cards.get(`b${pr.number}`),
        head: cards.get(`h${pr.number}`),
        requestNumbers,
      }),
    )
    .filter((p): p is Proposal => Boolean(p));

  const proposalsByRequest = new Map<
    number,
    { number: number; status: ReturnType<typeof proposalStatus> }[]
  >();
  for (const pr of pulls) {
    for (const n of linkedRequests(pr.body, requestNumbers)) {
      proposalsByRequest.set(n, [
        ...(proposalsByRequest.get(n) ?? []),
        { number: pr.number, status: proposalStatus(pr) },
      ]);
    }
  }

  const now = new Date().toISOString();
  return {
    source: 'github',
    repo: REPO.slug,
    fetchedAt: now,
    now,
    requestsEnabled: Boolean(category),
    people,
    requests: discussions.map((d) => mapDiscussion(d, { cardIds, proposalsByRequest })),
    proposals,
    activity: activityFrom(discussions, pulls, new Set(proposals.map((p) => p.number))),
  };
}
