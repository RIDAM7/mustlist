/**
 * Pure helpers for the pull-request workflow (`scripts/pr-checks.ts`):
 * sign-off (DCO), approvals, the `accepted` label, labels and content changes.
 */
import { parseCard } from '@mustlist/schema';

export const ACCEPTED_LABEL = 'accepted';
/** Branches the website creates for proposals sent from its editor. */
export const SITE_BRANCH_PREFIX = 'proposals/';

const PROPOSER = /<!-- mustlist-proposer: ([A-Za-z0-9-]{1,39}) -->/;

/**
 * Who proposed a pull request. The website's app opens pull requests for people
 * (GitHub needs write access to open one from a branch here) and names them in
 * a body marker; otherwise it is the pull request's author.
 */
export function proposerOf(body: string | null | undefined, author: string): string {
  return PROPOSER.exec(body ?? '')?.[1] ?? author;
}

export interface CommitInfo {
  sha: string;
  message: string;
  authorName: string;
  authorEmail: string;
  /** GitHub login of the author, when GitHub knows it. */
  authorLogin: string | undefined;
  parents: number;
}

const SIGN_OFF = /^Signed-off-by:\s*(.+?)\s*<([^>]+)>\s*$/gim;

/** Commits that lack a `Signed-off-by:` line matching their author's email. Merge and bot commits are skipped. */
export function unsignedCommits(
  commits: readonly CommitInfo[],
): { commit: CommitInfo; reason: string }[] {
  const problems: { commit: CommitInfo; reason: string }[] = [];
  for (const commit of commits) {
    if (commit.parents > 1) continue;
    if (commit.authorLogin?.endsWith('[bot]')) continue;
    const emails = [...commit.message.matchAll(SIGN_OFF)].map((match) =>
      (match[2] ?? '').toLowerCase(),
    );
    if (emails.length === 0) {
      problems.push({ commit, reason: 'no Signed-off-by line' });
    } else if (!emails.includes(commit.authorEmail.toLowerCase())) {
      problems.push({
        commit,
        reason: `Signed-off-by email doesn't match the author (${commit.authorEmail})`,
      });
    }
  }
  return problems;
}

export interface ReviewInfo {
  login: string;
  state: string;
  submittedAt: string;
  commitId?: string;
}

/** Logins whose latest approving or blocking review is an approval (comments don't change it). */
export function approvers(reviews: readonly ReviewInfo[], author: string): string[] {
  const latest = new Map<string, ReviewInfo>();
  const sorted = [...reviews].sort((a, b) => a.submittedAt.localeCompare(b.submittedAt));
  for (const review of sorted) {
    if (!['APPROVED', 'CHANGES_REQUESTED', 'DISMISSED'].includes(review.state)) continue;
    latest.set(review.login.toLowerCase(), review);
  }
  return [...latest.values()]
    .filter((review) => review.state === 'APPROVED')
    .map((review) => review.login)
    .filter((login) => login.toLowerCase() !== author.toLowerCase());
}

export interface LabelEvent {
  event: string;
  label?: { name: string };
  actor?: { login: string } | null;
}

/** Who added the `accepted` label that is on the pull request now, if anyone. */
export function acceptedBy(events: readonly LabelEvent[]): string | undefined {
  let by: string | undefined;
  for (const item of events) {
    if (item.label?.name !== ACCEPTED_LABEL) continue;
    if (item.event === 'labeled') by = item.actor?.login;
    if (item.event === 'unlabeled') by = undefined;
  }
  return by;
}

export interface ChangedFile {
  filename: string;
  status: string;
  previousFilename?: string;
}

const CARD_FILE = /^cards\/([a-z0-9-]+)\/[a-z0-9-]+\.md$/;

export const isCardFile = (path: string) => CARD_FILE.test(path);
export const topicOf = (path: string) => CARD_FILE.exec(path)?.[1];

/** Labels for a pull request from the files it changes. */
export function labelsFor(files: readonly ChangedFile[], headRef: string): string[] {
  const labels = new Set<string>();
  for (const file of files) {
    const topic = topicOf(file.filename);
    if (topic) {
      labels.add(file.status === 'added' ? 'new card' : 'card change');
      labels.add(`topic: ${topic}`);
    } else if (file.filename.startsWith('docs/') || /^[^/]+\.md$/.test(file.filename)) {
      labels.add('docs');
    } else {
      labels.add('code');
    }
  }
  if (headRef.startsWith(SITE_BRANCH_PREFIX)) labels.add('from the site');
  return [...labels].sort();
}

/** Fields that don't count as the card's content. */
const NON_CONTENT_KEYS = ['card_version', 'status', 'reviewers', 'review_level', 'last_verified'];

/** True when anything other than the version and maintainer-only fields differs. */
export function contentChanged(before: string, after: string): boolean {
  const strip = (text: string) => {
    const card = parseCard(text, 'card.md');
    const data = Object.fromEntries(
      Object.entries((card.frontmatter ?? {}) as Record<string, unknown>).filter(
        ([key]) => !NON_CONTENT_KEYS.includes(key),
      ),
    );
    return JSON.stringify(data) + '\n' + card.body.trim();
  };
  return strip(before) !== strip(after);
}

/** The MAINTAINERS file: one GitHub handle per line; `#` starts a comment. */
export function parseMaintainers(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.replace(/#.*/, '').trim())
    .filter(Boolean);
}
