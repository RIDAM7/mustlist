import { REPO_URL } from '@mustlist/schema/constants';

/**
 * Where writes go while sign-in is not built (D-021 step A): every write button
 * opens the matching page on GitHub. Only documented URL shapes are used.
 */

/** Discussion category for requests; `.github/DISCUSSION_TEMPLATE/requests.yml` must match it. */
export const REQUESTS_CATEGORY = 'requests';

/** Discussion category for each card's Discussion tab (one thread per card). */
export const CARD_DISCUSSIONS_CATEGORY = 'q-a';

const [owner = '', name = ''] = new URL(REPO_URL).pathname.split('/').filter(Boolean);

export const REPO = { owner, name, slug: `${owner}/${name}`, url: REPO_URL };

export const githubLinks = {
  /** Start a request: the discussion form for the Requests category. */
  newRequest: `${REPO_URL}/discussions/new?category=${REQUESTS_CATEGORY}`,
  /** Start a discussion about a card. */
  newDiscussion: `${REPO_URL}/discussions/new`,
  /** Start a card's Q&A thread on GitHub (sign-in not set up). */
  newCardDiscussion: (title: string) =>
    `${REPO_URL}/discussions/new?category=${CARD_DISCUSSIONS_CATEGORY}&title=${encodeURIComponent(title)}`,
  discussions: `${REPO_URL}/discussions`,
  pulls: `${REPO_URL}/pulls`,
  /** Open pull requests that ask for the signed-in GitHub user's review. */
  reviewRequested: `${REPO_URL}/pulls?q=${encodeURIComponent('is:pr is:open review-requested:@me')}`,
  /** Create a new card file in the topic folder. */
  newCardFile: (topic: string) => `${REPO_URL}/new/main/cards/${topic}`,
  /** Edit an existing card file. */
  editCardFile: (cardId: string) => `${REPO_URL}/edit/main/cards/${cardId}.md`,
  /** The "Files changed" tab, where reviews and line comments happen. */
  reviewFiles: (pullUrl: string) => `${pullUrl}/files`,
};
