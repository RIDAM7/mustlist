import { REPO, REQUESTS_CATEGORY } from '../links';

/**
 * Writes to GitHub as the signed-in person (their GitHub App user token).
 * Server only. Every function throws GitHubWriteError with GitHub's own message
 * when GitHub refuses (no permission, locked discussion, own pull request…).
 */

const ENDPOINT = 'https://api.github.com/graphql';

export class GitHubWriteError extends Error {}

async function gql<T>(
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
    cache: 'no-store',
  });
  if (response.status === 401) throw new GitHubWriteError('GitHub sign-in expired');
  if (!response.ok) throw new GitHubWriteError(`GitHub returned ${response.status}`);
  const json = (await response.json()) as { data?: T; errors?: { message: string }[] };
  if (json.errors?.length) throw new GitHubWriteError(json.errors.map((e) => e.message).join('; '));
  if (!json.data) throw new GitHubWriteError('GitHub returned no data');
  return json.data;
}

const repoVars = { owner: REPO.owner, name: REPO.name };

/** A request (discussion) by number, with the signed-in person's view of it. */
export async function getDiscussion(
  token: string,
  number: number,
): Promise<{ id: string; upvoted: boolean; upvotes: number; closed: boolean; category: string }> {
  const data = await gql<{
    repository: {
      discussion: {
        id: string;
        viewerHasUpvoted: boolean;
        upvoteCount: number;
        closed: boolean;
        category: { slug: string } | null;
      } | null;
    };
  }>(
    token,
    `query($owner: String!, $name: String!, $number: Int!) {
      repository(owner: $owner, name: $name) {
        discussion(number: $number) { id viewerHasUpvoted upvoteCount closed category { slug } }
      }
    }`,
    { ...repoVars, number },
  );
  const discussion = data.repository.discussion;
  if (!discussion) throw new GitHubWriteError(`Request #${number} was not found`);
  return {
    id: discussion.id,
    upvoted: discussion.viewerHasUpvoted,
    upvotes: discussion.upvoteCount,
    closed: discussion.closed,
    category: discussion.category?.slug ?? '',
  };
}

export async function addComment(
  token: string,
  discussionId: string,
  body: string,
  replyToId?: string,
): Promise<{ id: string; url: string; createdAt: string }> {
  const data = await gql<{
    addDiscussionComment: { comment: { id: string; url: string; createdAt: string } };
  }>(
    token,
    `mutation($discussionId: ID!, $body: String!, $replyToId: ID) {
      addDiscussionComment(input: { discussionId: $discussionId, body: $body, replyToId: $replyToId }) {
        comment { id url createdAt }
      }
    }`,
    { discussionId, body, replyToId: replyToId ?? null },
  );
  return data.addDiscussionComment.comment;
}

/** "Need this too" is a discussion upvote. Returns the new count. */
export async function setUpvote(token: string, subjectId: string, on: boolean): Promise<number> {
  const field = on ? 'addUpvote' : 'removeUpvote';
  const data = await gql<Record<string, { subject: { upvoteCount: number } }>>(
    token,
    `mutation($subjectId: ID!) {
      ${field}(input: { subjectId: $subjectId }) { subject { ... on Discussion { upvoteCount } } }
    }`,
    { subjectId },
  );
  return data[field]?.subject.upvoteCount ?? 0;
}

/** The body GitHub's request form writes, so requests from the site read the same way. */
export function requestBody(input: { topic: string; stack: string; what: string }): string {
  return [
    '### Topic',
    '',
    input.topic,
    '',
    '### Stack',
    '',
    input.stack,
    '',
    '### What are you building?',
    '',
    input.what,
    '',
  ].join('\n');
}

/** A new request: a discussion in the Requests category, in the request form's format. */
export async function createRequest(
  token: string,
  input: { title: string; topic: string; stack: string; what: string },
): Promise<{ number: number; url: string }> {
  const repo = await gql<{
    repository: { id: string; discussionCategories: { nodes: { id: string; slug: string }[] } };
  }>(
    token,
    `query($owner: String!, $name: String!) {
      repository(owner: $owner, name: $name) { id discussionCategories(first: 25) { nodes { id slug } } }
    }`,
    repoVars,
  );
  const category = repo.repository.discussionCategories.nodes.find(
    (c) => c.slug === REQUESTS_CATEGORY,
  );
  if (!category) throw new GitHubWriteError('The Requests category is missing on GitHub');
  const body = requestBody(input);
  const data = await gql<{ createDiscussion: { discussion: { number: number; url: string } } }>(
    token,
    `mutation($repositoryId: ID!, $categoryId: ID!, $title: String!, $body: String!) {
      createDiscussion(input: { repositoryId: $repositoryId, categoryId: $categoryId, title: $title, body: $body }) {
        discussion { number url }
      }
    }`,
    { repositoryId: repo.repository.id, categoryId: category.id, title: input.title, body },
  );
  return data.createDiscussion.discussion;
}

export type CloseReason = 'RESOLVED' | 'OUTDATED' | 'DUPLICATE';

export async function closeRequest(
  token: string,
  discussionId: string,
  reason: CloseReason,
): Promise<void> {
  await gql(
    token,
    `mutation($discussionId: ID!, $reason: DiscussionCloseReason!) {
      closeDiscussion(input: { discussionId: $discussionId, reason: $reason }) { discussion { id } }
    }`,
    { discussionId, reason },
  );
}

export async function reopenRequest(token: string, discussionId: string): Promise<void> {
  await gql(
    token,
    `mutation($discussionId: ID!) {
      reopenDiscussion(input: { discussionId: $discussionId }) { discussion { id } }
    }`,
    { discussionId },
  );
}

export type ReviewEvent = 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT';

/** A pull request review on a proposal. */
export async function submitReview(
  token: string,
  number: number,
  event: ReviewEvent,
  body: string,
): Promise<{ url: string; state: string }> {
  const pr = await gql<{ repository: { pullRequest: { id: string } | null } }>(
    token,
    `query($owner: String!, $name: String!, $number: Int!) {
      repository(owner: $owner, name: $name) { pullRequest(number: $number) { id } }
    }`,
    { ...repoVars, number },
  );
  const pullRequestId = pr.repository.pullRequest?.id;
  if (!pullRequestId) throw new GitHubWriteError(`Proposal #${number} was not found`);
  const data = await gql<{
    addPullRequestReview: { pullRequestReview: { url: string; state: string } };
  }>(
    token,
    `mutation($pullRequestId: ID!, $event: PullRequestReviewEvent!, $body: String) {
      addPullRequestReview(input: { pullRequestId: $pullRequestId, event: $event, body: $body }) {
        pullRequestReview { url state }
      }
    }`,
    { pullRequestId, event, body: body || null },
  );
  return data.addPullRequestReview.pullRequestReview;
}
