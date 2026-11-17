import 'server-only';
import { parseCard } from '@mustlist/schema';
import { promoteCard, PromoteError } from '@mustlist/schema/promote';
import { REPO } from '../links';
import { fieldMarker, proposerMarker, proposerOf } from '../markers';
import { installationToken } from './app';
import { GitHubWriteError } from './write';

/**
 * Proposals written from the site (D-021 steps C and D), over GitHub's REST API.
 *
 * - Submit: GitHub only lets people open a pull request from a branch they can
 *   write to, so the Mustlist Library app puts the card on a `proposals/<login>/…`
 *   branch and opens the pull request. The commit's author and sign-off are the
 *   contributor's (their GitHub noreply address), and the body names them as the
 *   proposer, which the site and the checks read back.
 * - Accept: the maintainer's own token approves, commits the promotion
 *   (status, reviewers, date, version), adds the `accepted` label and turns on
 *   auto-merge, so the card merges as Verified once the checks pass.
 * - Field comments: a review comment on the field's lines in the card file.
 */

export const ACCEPTED_LABEL = 'accepted';
export const SITE_BRANCH_PREFIX = 'proposals/';
type Method = 'GET' | 'POST' | 'PUT' | 'PATCH';

async function rest<T>(
  token: string,
  method: Method,
  path: string,
  body?: unknown,
  raw = false,
): Promise<T> {
  const response = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: raw ? 'application/vnd.github.raw+json' : 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'mustlist-site',
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: 'no-store',
  });
  if (response.status === 401) throw new GitHubWriteError('GitHub sign-in expired');
  if (!response.ok) {
    const json = (await response.json().catch(() => ({}))) as {
      message?: string;
      errors?: { message?: string }[];
    };
    const detail = json.errors
      ?.map((error) => error.message)
      .filter(Boolean)
      .join('; ');
    throw Object.assign(
      new GitHubWriteError(detail || json.message || `GitHub returned ${response.status}`),
      {
        status: response.status,
      },
    );
  }
  if (response.status === 204) return undefined as T;
  return (raw ? await response.text() : await response.json()) as T;
}

const status = (error: unknown) => (error as { status?: number }).status;
const repoPath = `/repos/${REPO.slug}`;
const encodePath = (path: string) => path.split('/').map(encodeURIComponent).join('/');

export interface Identity {
  login: string;
  name: string;
  email: string;
}

/** The signed-in person, with their GitHub noreply address for commits. */
export async function viewerIdentity(userToken: string): Promise<Identity> {
  const me = await rest<{ login: string; id: number; name: string | null }>(
    userToken,
    'GET',
    '/user',
  );
  return {
    login: me.login,
    name: me.name?.trim() || me.login,
    email: `${me.id}+${me.login}@users.noreply.github.com`,
  };
}

async function fileOnRef(
  token: string,
  path: string,
  ref: string,
): Promise<{ sha: string } | undefined> {
  try {
    return await rest<{ sha: string }>(
      token,
      'GET',
      `${repoPath}/contents/${encodePath(path)}?ref=${encodeURIComponent(ref)}`,
    );
  } catch (error) {
    if (status(error) === 404) return undefined;
    throw error;
  }
}

async function rawOnRef(token: string, path: string, ref: string): Promise<string> {
  return rest<string>(
    token,
    'GET',
    `${repoPath}/contents/${encodePath(path)}?ref=${encodeURIComponent(ref)}`,
    undefined,
    true,
  );
}

const signOff = (who: Identity) => `Signed-off-by: ${who.name} <${who.email}>`;
const toBase64 = (text: string) => Buffer.from(text, 'utf8').toString('base64');

/* ── Submit ─────────────────────────────────────────────── */

export interface SubmitInput {
  cardId: string;
  markdown: string;
  mode: 'new' | 'change';
  /** "New card: Background jobs · Next.js + Postgres" */
  heading: string;
  note: string;
  request: number | null;
}

export async function submitProposal(
  userToken: string,
  input: SubmitInput,
): Promise<{ number: number; url: string; updated: boolean }> {
  const me = await viewerIdentity(userToken);
  const app = await installationToken();
  const path = `cards/${input.cardId}.md`;
  const branch = `${SITE_BRANCH_PREFIX}${me.login.toLowerCase()}/${input.cardId.replace('/', '-')}`;

  const onMain = await fileOnRef(app, path, 'main');
  if (input.mode === 'new' && onMain) {
    throw new GitHubWriteError(
      `A card for ${input.cardId} already exists. Suggest a change to it instead.`,
    );
  }
  const [open] = await rest<{ number: number; html_url: string }[]>(
    app,
    'GET',
    `${repoPath}/pulls?state=open&head=${encodeURIComponent(`${REPO.owner}:${branch}`)}`,
  );

  if (!open) {
    // A fresh branch from main (reusing the name of an older, closed proposal).
    const main = await rest<{ object: { sha: string } }>(
      app,
      'GET',
      `${repoPath}/git/ref/heads/main`,
    );
    try {
      await rest(app, 'POST', `${repoPath}/git/refs`, {
        ref: `refs/heads/${branch}`,
        sha: main.object.sha,
      });
    } catch (error) {
      if (status(error) !== 422) throw error;
      await rest(app, 'PATCH', `${repoPath}/git/refs/heads/${encodePath(branch)}`, {
        sha: main.object.sha,
        force: true,
      });
    }
  }

  const existing = await fileOnRef(app, path, branch);
  const verb = input.mode === 'new' ? 'propose' : 'update';
  const message = [
    `${input.mode === 'new' ? 'feat' : 'fix'}(cards): ${verb} ${input.cardId}`,
    '',
    ...(input.note ? [input.note, ''] : []),
    `Sent from the Mustlist site by @${me.login}.`,
    '',
    signOff(me),
  ].join('\n');
  await rest(app, 'PUT', `${repoPath}/contents/${encodePath(path)}`, {
    message,
    content: toBase64(input.markdown),
    branch,
    ...(existing ? { sha: existing.sha } : {}),
    author: { name: me.name, email: me.email },
  });

  if (open) return { number: open.number, url: open.html_url, updated: true };

  const body = [
    proposerMarker(me.login),
    `Proposed by @${me.login} on the [Mustlist site](https://ridamagrawal.com/library/proposals).`,
    '',
    '## What this changes',
    '',
    input.note || input.heading,
    ...(input.request ? ['', `Request: #${input.request}`] : []),
    '',
    '## Kind of contribution',
    '',
    `- [${input.mode === 'new' ? 'x' : ' '}] New card`,
    `- [${input.mode === 'change' ? 'x' : ' '}] Improvement or fix`,
    '',
    'The proposer signed off the commit (DCO) and confirmed that they wrote the card and that every link goes to a primary source. Revisions come from the site.',
  ].join('\n');
  const created = await rest<{ number: number; html_url: string }>(
    app,
    'POST',
    `${repoPath}/pulls`,
    {
      title: input.heading,
      head: branch,
      base: 'main',
      body,
    },
  );
  return { number: created.number, url: created.html_url, updated: false };
}

/* ── Accept ─────────────────────────────────────────────── */

interface PullRequest {
  number: number;
  node_id: string;
  state: string;
  draft: boolean;
  merged: boolean;
  title: string;
  body: string | null;
  user: { login: string };
  head: { sha: string; ref: string; repo: { full_name: string } | null };
}

interface Review {
  user: { login: string } | null;
  state: string;
  commit_id: string;
  submitted_at: string;
}

export interface AcceptInput {
  number: number;
  level: 'seed' | 'community';
  /** Today's date, `YYYY-MM-DD`. */
  date: string;
  /** Checks the promoted card against the library; returns problems to show. */
  validate: (path: string, text: string) => string[];
}

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/** Approvers on the given commit: each person's latest approving or blocking review. */
export function approvalsOn(reviews: readonly Review[], sha: string, exclude: string): string[] {
  const latest = new Map<string, Review>();
  for (const review of [...reviews].sort((a, b) => a.submitted_at.localeCompare(b.submitted_at))) {
    if (!review.user || !['APPROVED', 'CHANGES_REQUESTED', 'DISMISSED'].includes(review.state))
      continue;
    latest.set(review.user.login.toLowerCase(), review);
  }
  return [...latest.values()]
    .filter((review) => review.state === 'APPROVED' && review.commit_id === sha)
    .map((review) => review.user?.login ?? '')
    .filter((login) => login && !same(login, exclude));
}

export async function acceptProposal(
  userToken: string,
  input: AcceptInput,
): Promise<{ merging: 'auto' | 'merged' | 'waiting'; cardId: string }> {
  const me = await viewerIdentity(userToken);
  const maintainers = (await rawOnRef(userToken, 'MAINTAINERS', 'main'))
    .split('\n')
    .map((line) => line.replace(/#.*/, '').trim())
    .filter(Boolean);
  const isMaintainer = (login: string) => maintainers.some((handle) => same(handle, login));
  if (!isMaintainer(me.login)) throw new GitHubWriteError('Only maintainers can accept proposals.');

  const pr = await rest<PullRequest>(userToken, 'GET', `${repoPath}/pulls/${input.number}`);
  if (pr.state !== 'open') throw new GitHubWriteError('This proposal is not open.');
  if (pr.draft) throw new GitHubWriteError('This proposal is still a draft.');
  if (pr.head.repo?.full_name !== REPO.slug) {
    throw new GitHubWriteError(
      'This proposal comes from a fork. Accept it on GitHub: run pnpm promote on its branch, add the "accepted" label, then merge.',
    );
  }
  const files = await rest<{ filename: string; status: string }[]>(
    userToken,
    'GET',
    `${repoPath}/pulls/${input.number}/files?per_page=100`,
  );
  const cards = files.filter((file) => /^cards\/[a-z0-9-]+\/[a-z0-9-]+\.md$/.test(file.filename));
  const [card] = cards;
  if (!card || cards.length !== 1 || files.length !== 1 || card.status === 'removed') {
    throw new GitHubWriteError(
      'One-click accept works for proposals that change exactly one card. Accept this one on GitHub.',
    );
  }
  const cardId = card.filename.slice('cards/'.length, -'.md'.length);

  const runs = await rest<{
    check_runs: { name: string; status: string; conclusion: string | null }[];
  }>(userToken, 'GET', `${repoPath}/commits/${pr.head.sha}/check-runs?per_page=100`);
  const failing = runs.check_runs.filter(
    (run) =>
      run.status === 'completed' &&
      !['success', 'neutral', 'skipped'].includes(run.conclusion ?? ''),
  );
  if (failing.length > 0) {
    throw new GitHubWriteError(`Checks are failing: ${failing.map((run) => run.name).join(', ')}.`);
  }

  const proposer = proposerOf(pr.body, pr.user.login);
  const reviews = await rest<Review[]>(
    userToken,
    'GET',
    `${repoPath}/pulls/${input.number}/reviews?per_page=100`,
  );
  const approved = approvalsOn(reviews, pr.head.sha, proposer);
  const meIsProposer = same(me.login, proposer);
  const approving =
    meIsProposer || approved.some((login) => same(login, me.login))
      ? approved
      : [...approved, me.login];
  const maintainerApprovals = approving.filter(isMaintainer);
  const proposerCounts = meIsProposer && isMaintainer(proposer);
  if (input.level === 'community' && (approving.length < 2 || maintainerApprovals.length < 1)) {
    throw new GitHubWriteError(
      'Community level needs 2 approvals on the latest revision, 1 from a maintainer.',
    );
  }
  if (maintainerApprovals.length < 1 && !proposerCounts) {
    throw new GitHubWriteError('Accepting needs a maintainer approval.');
  }
  const reviewers = approving.length > 0 ? approving : [me.login];

  // Promote, and check the result before writing anything.
  const text = await rawOnRef(userToken, card.filename, pr.head.sha);
  let promoted: string;
  try {
    promoted = promoteCard(text, { reviewers, level: input.level, date: input.date }).text;
  } catch (error) {
    if (error instanceof PromoteError) throw new GitHubWriteError(error.message);
    throw error;
  }
  const problems = input.validate(card.filename, promoted);
  if (problems.length > 0) {
    throw new GitHubWriteError(
      `The card would not validate as verified: ${problems.slice(0, 3).join(' ')}`,
    );
  }

  if (!meIsProposer && !approved.some((login) => same(login, me.login))) {
    await rest(userToken, 'POST', `${repoPath}/pulls/${input.number}/reviews`, {
      event: 'APPROVE',
      commit_id: pr.head.sha,
      body: '',
    });
  }
  const current = await fileOnRef(userToken, card.filename, pr.head.ref);
  await rest(userToken, 'PUT', `${repoPath}/contents/${encodePath(card.filename)}`, {
    message: [
      `chore(cards): accept ${cardId} (${input.level})`,
      '',
      `Reviewed by: ${reviewers.join(', ')}`,
      '',
      signOff(me),
    ].join('\n'),
    content: toBase64(promoted),
    branch: pr.head.ref,
    sha: current?.sha,
    author: { name: me.name, email: me.email },
  });
  await rest(userToken, 'POST', `/repos/${REPO.slug}/issues/${input.number}/labels`, {
    labels: [ACCEPTED_LABEL],
  });

  // Merge once the checks pass on the promotion commit.
  try {
    await graphql(
      userToken,
      `
        mutation ($id: ID!, $headline: String!) {
          enablePullRequestAutoMerge(
            input: { pullRequestId: $id, mergeMethod: SQUASH, commitHeadline: $headline }
          ) {
            clientMutationId
          }
        }
      `,
      { id: pr.node_id, headline: `${pr.title} (#${pr.number})` },
    );
    return { merging: 'auto', cardId };
  } catch {
    try {
      await rest(userToken, 'PUT', `${repoPath}/pulls/${input.number}/merge`, {
        merge_method: 'squash',
      });
      return { merging: 'merged', cardId };
    } catch {
      return { merging: 'waiting', cardId };
    }
  }
}

async function graphql(
  token: string,
  query: string,
  variables: Record<string, unknown>,
): Promise<void> {
  const response = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'mustlist-site',
    },
    body: JSON.stringify({ query, variables }),
    cache: 'no-store',
  });
  const json = (await response.json()) as { errors?: { message: string }[] };
  if (!response.ok || json.errors?.length) {
    throw new GitHubWriteError(
      json.errors?.map((error) => error.message).join('; ') ?? `GitHub returned ${response.status}`,
    );
  }
}

/* ── Field comments ─────────────────────────────────────── */

/** Frontmatter keys behind each field of the Changes tab. */
const FIELD_KEYS: Record<string, readonly string[]> = {
  basics: ['title', 'summary', 'stack', 'applies_when', 'lenses', 'related'],
  checklist: ['checklist'],
  decisions: ['decisions'],
  options: ['options', 'recommended'],
  versions: ['versions'],
  verify: ['verify'],
  sources: ['sources'],
};

/** Lines (1-based) a field covers in the card file. */
export function fieldLines(text: string, field: string): number[] {
  const card = parseCard(text, 'card.md');
  const totalLines = text.split('\n').length;
  if (field === 'body') {
    return Array.from(
      { length: totalLines - card.bodyStartLine + 1 },
      (_, i) => card.bodyStartLine + i,
    );
  }
  const data = (card.frontmatter ?? {}) as Record<string, unknown>;
  const starts = Object.keys(data)
    .map((key) => ({ key, line: card.lineOf([key]) }))
    .sort((a, b) => a.line - b.line);
  const lines: number[] = [];
  for (const key of FIELD_KEYS[field] ?? []) {
    const index = starts.findIndex((item) => item.key === key);
    if (index === -1) continue;
    const start = starts[index]?.line ?? 1;
    const end = (starts[index + 1]?.line ?? card.bodyStartLine - 1) - 1;
    for (let line = start; line <= end; line++) lines.push(line);
  }
  return lines;
}

/** New-side line numbers that a unified diff patch shows (the lines GitHub lets you comment on). */
export function commentableLines(patch: string | undefined): Set<number> {
  const lines = new Set<number>();
  if (!patch) return lines;
  let line = 0;
  for (const row of patch.split('\n')) {
    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(row);
    if (hunk) {
      line = Number(hunk[1]);
      continue;
    }
    if (row.startsWith('-')) continue;
    if (row.startsWith('+') || row.startsWith(' ')) lines.add(line++);
  }
  return lines;
}

export async function commentOnField(
  userToken: string,
  input: { number: number; field: string; body: string },
): Promise<{ url: string }> {
  const pr = await rest<PullRequest>(userToken, 'GET', `${repoPath}/pulls/${input.number}`);
  const files = await rest<{ filename: string; patch?: string }[]>(
    userToken,
    'GET',
    `${repoPath}/pulls/${input.number}/files?per_page=100`,
  );
  const card = files.find((file) => /^cards\/.+\.md$/.test(file.filename));
  if (!card) throw new GitHubWriteError('This proposal changes no card.');
  const text = await rawOnRef(userToken, card.filename, pr.head.sha);
  const visible = commentableLines(card.patch);
  const line = fieldLines(text, input.field).find((candidate) => visible.has(candidate));
  const body = `${fieldMarker(input.field)}\n${input.body}`;
  const comment = await rest<{ html_url: string }>(
    userToken,
    'POST',
    `${repoPath}/pulls/${input.number}/comments`,
    {
      body,
      commit_id: pr.head.sha,
      path: card.filename,
      ...(line ? { line, side: 'RIGHT' } : { subject_type: 'file' }),
    },
  );
  return { url: comment.html_url };
}
