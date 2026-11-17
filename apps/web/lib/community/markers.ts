/**
 * Hidden markers the site writes into pull requests (HTML comments, invisible
 * on GitHub) and reads back:
 * - `mustlist-proposer`: the person a proposal was opened for. The site's app
 *   opens pull requests for people, because GitHub needs write access to open
 *   one from a branch in this repository.
 * - `mustlist-field`: the card field a review comment is about.
 */

const PROPOSER = /<!-- mustlist-proposer: ([A-Za-z0-9-]{1,39}) -->/;
const FIELD = /^<!-- mustlist-field: ([a-z]+) -->\n?/;

export const proposerMarker = (login: string) => `<!-- mustlist-proposer: ${login} -->`;
export const fieldMarker = (field: string) => `<!-- mustlist-field: ${field} -->`;

/** The proposer named in a pull request body, else its author. */
export function proposerOf(body: string | null | undefined, author: string): string {
  return PROPOSER.exec(body ?? '')?.[1] ?? author;
}

/** The field a review comment is about, and the comment without the marker. */
export function fieldOf(body: string): { field: string | undefined; text: string } {
  const match = FIELD.exec(body);
  return { field: match?.[1], text: match ? body.slice(match[0].length) : body };
}
