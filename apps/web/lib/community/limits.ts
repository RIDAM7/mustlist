/**
 * Limits on writes the site makes for people. Proposals from the editor are
 * opened by the Mustlist Library app, so the site, not GitHub, has to stop one
 * account from flooding the repository with them.
 */

/** Open proposals one person may have from the site at a time. Revisions don't count. */
export const MAX_OPEN_SITE_PROPOSALS = 3;

/** Every branch the site creates for a person starts with this. */
export const siteBranchPrefix = (login: string) => `proposals/${login.toLowerCase()}/`;

/** The site branch for one person's proposal on one card. */
export const siteBranch = (login: string, cardId: string) =>
  `${siteBranchPrefix(login)}${cardId.replace('/', '-')}`;

/** How many of these open pull requests are this person's proposals from the site. */
export function openSiteProposals(
  pulls: readonly { head: { ref: string } }[],
  login: string,
): number {
  const prefix = siteBranchPrefix(login);
  return pulls.filter((pull) => pull.head.ref.toLowerCase().startsWith(prefix)).length;
}

export const tooManyProposals = (count: number) =>
  `You already have ${count} proposals open from the site, the most at once. Update one of them, or wait until a maintainer accepts or closes one.`;
