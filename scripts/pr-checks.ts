/**
 * Checks for pull requests, run by .github/workflows/pr.yml on `pull_request_target`:
 * the workflow runs this file from the BASE branch and reads the pull request's
 * files through the API as data, so a pull request can't change its own checks.
 *
 *   tsx scripts/pr-checks.ts sign-off     every commit is signed off (DCO)
 *   tsx scripts/pr-checks.ts card-guard   changed cards validate, and only maintainers
 *                                         verify cards (status-guard)
 *   tsx scripts/pr-checks.ts labels       kind and topic labels; drops `accepted` when
 *                                         someone other than a maintainer pushes
 */
import { readFileSync } from 'node:fs';
import { parseCard } from '@mustlist/schema';
import {
  type CardInput,
  type Diagnostic,
  checkStatusGuard,
  createCardContext,
  findMarkdownFiles,
  formatGithubAnnotations,
  formatText,
  hasErrors,
  readCards,
  validateCards,
} from '@mustlist/validator';
import { createGitHub, GitHubError, writeSummary } from './lib/github';
import {
  ACCEPTED_LABEL,
  type ChangedFile,
  type CommitInfo,
  type LabelEvent,
  type ReviewInfo,
  acceptedBy,
  approvers,
  contentChanged,
  isCardFile,
  labelsFor,
  parseMaintainers,
  proposerOf,
  unsignedCommits,
} from './lib/pr-policy';

interface PullRequestEvent {
  action: string;
  sender: { login: string };
  pull_request: {
    number: number;
    body: string | null;
    user: { login: string };
    head: { sha: string; ref: string; repo: { full_name: string } | null };
    base: { sha: string; repo: { full_name: string } };
  };
}

const event = JSON.parse(
  readFileSync(process.env['GITHUB_EVENT_PATH'] ?? '', 'utf8'),
) as PullRequestEvent;
const pr = event.pull_request;
const repo = pr.base.repo.full_name;
const headRepo = pr.head.repo?.full_name ?? repo;
const gh = createGitHub();
const maintainers = parseMaintainers(readFileSync('MAINTAINERS', 'utf8'));
/** The proposer: the PR author, or the person the site's app opened it for. */
const author = proposerOf(pr.body, pr.user.login);
const isMaintainer = (login: string) =>
  maintainers.some((handle) => handle.toLowerCase() === login.toLowerCase());
const short = (sha: string) => sha.slice(0, 7);

async function changedFiles(): Promise<ChangedFile[]> {
  const files = await gh.list<{ filename: string; status: string; previous_filename?: string }>(
    `/repos/${repo}/pulls/${pr.number}/files`,
  );
  return files.map((file) => ({
    filename: file.filename,
    status: file.status,
    previousFilename: file.previous_filename,
  }));
}

async function signOff(): Promise<number> {
  const commits = await gh.list<{
    sha: string;
    parents: unknown[];
    author: { login: string } | null;
    commit: { message: string; author: { name: string; email: string } };
  }>(`/repos/${repo}/pulls/${pr.number}/commits`);
  const infos: CommitInfo[] = commits.map((item) => ({
    sha: item.sha,
    message: item.commit.message,
    authorName: item.commit.author.name,
    authorEmail: item.commit.author.email,
    authorLogin: item.author?.login,
    parents: item.parents.length,
  }));
  const problems = unsignedCommits(infos);
  if (problems.length === 0) {
    await writeSummary(`### Sign-off\n\nAll ${infos.length} commit(s) are signed off.`);
    return 0;
  }
  const lines = problems.map(
    ({ commit, reason }) =>
      `- \`${short(commit.sha)}\` ${commit.message.split('\n')[0]}: ${reason}`,
  );
  await writeSummary(
    [
      '### Sign-off',
      '',
      "Every commit needs a `Signed-off-by:` line with the author's name and email (the Developer Certificate of Origin, https://developercertificate.org). Missing on:",
      '',
      ...lines,
      '',
      "Fix: `git commit --amend -s` for the last commit, or `git rebase --signoff main` for all of them, then push with `--force-with-lease`. Commits made in GitHub's web editor and on the Mustlist site are signed off for you.",
    ].join('\n'),
  );
  for (const { commit, reason } of problems) {
    console.log(`::error title=Sign-off::Commit ${short(commit.sha)} has ${reason}.`);
  }
  return 1;
}

async function cardGuard(): Promise<number> {
  const files = (await changedFiles()).filter(
    (file) =>
      isCardFile(file.filename) || (file.previousFilename && isCardFile(file.previousFilename)),
  );
  if (files.length === 0) {
    await writeSummary('### Card guard\n\nNo cards changed.');
    return 0;
  }

  const [reviews, events] = await Promise.all([
    gh.list<{
      user: { login: string } | null;
      state: string;
      submitted_at: string;
      commit_id: string;
    }>(`/repos/${repo}/pulls/${pr.number}/reviews`),
    gh.list<LabelEvent>(`/repos/${repo}/issues/${pr.number}/events`),
  ]);
  const reviewInfos: ReviewInfo[] = reviews
    .filter((review) => review.user)
    .map((review) => ({
      login: review.user?.login ?? '',
      state: review.state,
      submittedAt: review.submitted_at ?? '',
      commitId: review.commit_id,
    }));
  const approved = approvers(reviewInfos, author);
  const accepted = acceptedBy(events);

  // The base branch's cards, with this pull request's versions swapped in.
  const cwd = process.cwd();
  const project = new Map<string, CardInput>(
    readCards(cwd, findMarkdownFiles(cwd, 'cards')).map((input) => [input.filePath, input]),
  );
  const changed = new Set<string>();
  const guard: Diagnostic[] = [];

  for (const file of files) {
    const beforePath = file.previousFilename ?? file.filename;
    const before =
      file.status === 'added' ? undefined : await gh.file(repo, beforePath, pr.base.sha);
    const after =
      file.status === 'removed' ? undefined : await gh.file(headRepo, file.filename, pr.head.sha);
    if (file.previousFilename) project.delete(file.previousFilename);
    if (after === undefined) project.delete(file.filename);
    else {
      project.set(file.filename, { filePath: file.filename, text: after });
      changed.add(file.filename);
    }

    const beforeData = before
      ? createCardContext({ filePath: beforePath, text: before }).data
      : undefined;
    const afterContext = after
      ? createCardContext({ filePath: file.filename, text: after })
      : undefined;
    if (after && !afterContext?.data) continue; // schema errors are reported by validateCards below
    const parsed = after ? parseCard(after, file.filename) : undefined;
    guard.push(
      ...checkStatusGuard({
        filePath: file.filename,
        before: beforeData,
        after: afterContext?.data,
        author,
        maintainers,
        approvers: approved,
        acceptedBy: accepted,
        contentChanged:
          before !== undefined && after !== undefined && contentChanged(before, after),
        lineOf: (key) => parsed?.lineOf([key]) ?? 1,
      }),
    );
  }

  const diagnostics = [...validateCards([...project.values()], { only: changed }), ...guard];
  const summary = [
    '### Card guard',
    '',
    `Cards: ${files.map((file) => `\`${file.filename}\``).join(', ')}`,
    `Approved by: ${approved.length > 0 ? approved.join(', ') : 'nobody yet'}${accepted ? ` · accepted by ${accepted}` : ''}`,
    '',
    diagnostics.length > 0 ? '```\n' + formatText(diagnostics) + '\n```' : 'Every check passed.',
  ];
  if (changed.size > 1 && !isMaintainer(author)) {
    summary.push('', 'Tip: one card per pull request makes review faster.');
  }
  await writeSummary(summary.join('\n'));
  if (diagnostics.length > 0) console.log(formatGithubAnnotations(diagnostics));
  return hasErrors(diagnostics) ? 1 : 0;
}

async function labels(): Promise<number> {
  const files = await changedFiles();
  const wanted = labelsFor(files, pr.head.ref);
  const existing = new Set(
    (await gh.list<{ name: string }>(`/repos/${repo}/labels`)).map((label) => label.name),
  );
  for (const name of wanted.filter((label) => !existing.has(label))) {
    try {
      await gh.send('POST', `/repos/${repo}/labels`, { name, color: 'ededed' });
    } catch (error) {
      if (!(error instanceof GitHubError && error.status === 422)) throw error; // 422: created meanwhile
    }
  }
  if (wanted.length > 0) {
    await gh.send('POST', `/repos/${repo}/issues/${pr.number}/labels`, { labels: wanted });
  }
  // A push after acceptance needs a fresh look from a maintainer.
  if (event.action === 'synchronize' && !isMaintainer(event.sender.login)) {
    const current = await gh.list<{ name: string }>(`/repos/${repo}/issues/${pr.number}/labels`);
    if (current.some((label) => label.name === ACCEPTED_LABEL)) {
      await gh.send('DELETE', `/repos/${repo}/issues/${pr.number}/labels/${ACCEPTED_LABEL}`);
      console.log(`Removed "${ACCEPTED_LABEL}": ${event.sender.login} pushed after acceptance.`);
    }
  }
  await writeSummary(`### Labels\n\n${wanted.join(', ') || 'none'}`);
  return 0;
}

const checks: Record<string, () => Promise<number>> = {
  'sign-off': signOff,
  'card-guard': cardGuard,
  labels,
};
const name = process.argv[2] ?? '';
const run = checks[name];
if (!run) {
  console.error(`Usage: tsx scripts/pr-checks.ts ${Object.keys(checks).join('|')}`);
  process.exitCode = 2;
} else {
  run().then(
    (code) => {
      process.exitCode = code;
    },
    (error: unknown) => {
      console.error(error);
      process.exitCode = 1;
    },
  );
}
