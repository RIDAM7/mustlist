import type { CardJSON } from '@mustlist/schema/types';
import { formatShortDate } from '@/lib/format';
import type { ChecksState, ProposalStatus, ProposalType, RequestStatus } from '@/lib/status';
import { stackSlug, topicSlug } from '@/lib/topics';
import type {
  ActivityEvent,
  Approval,
  CheckRun,
  Comment,
  FieldChange,
  Person,
  Proposal,
  Request,
  Review,
  TimelineStep,
} from '../types';
import { fieldOf, proposerOf } from '../markers';
import { diffCards } from './card-diff';

/**
 * Pure mapping from GitHub GraphQL nodes to Mustlist requests, proposals,
 * people and activity. `fetch.ts` does the network; this file does the meaning.
 */

/* ── GraphQL shapes (only the fields we query) ──────────── */

export interface GhActor {
  login: string;
}

export interface GhComment {
  id: string;
  url: string;
  body: string;
  createdAt: string;
  author: GhActor | null;
  replies?: { nodes: GhComment[] };
}

export interface GhDiscussion {
  number: number;
  title: string;
  body: string;
  url: string;
  createdAt: string;
  updatedAt: string;
  upvoteCount: number;
  closed: boolean;
  stateReason: 'RESOLVED' | 'OUTDATED' | 'DUPLICATE' | 'REOPENED' | null;
  isAnswered: boolean | null;
  author: GhActor | null;
  labels: { nodes: { name: string }[] } | null;
  comments: { totalCount: number; nodes: GhComment[] };
}

export type GhContext =
  | {
      __typename: 'CheckRun';
      name: string;
      status: string;
      conclusion: string | null;
      startedAt: string | null;
      completedAt: string | null;
      title: string | null;
    }
  | { __typename: 'StatusContext'; context: string; state: string; description: string | null };

export interface GhReview {
  id: string;
  author: GhActor | null;
  state: 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED' | 'DISMISSED' | 'PENDING';
  body: string;
  submittedAt: string | null;
  comments: {
    nodes: {
      id?: string;
      path: string;
      line: number | null;
      body: string;
      createdAt?: string;
      author?: GhActor | null;
    }[];
  };
}

export interface GhPullRequest {
  number: number;
  title: string;
  body: string;
  url: string;
  createdAt: string;
  updatedAt: string;
  isDraft: boolean;
  state: 'OPEN' | 'CLOSED' | 'MERGED';
  mergedAt: string | null;
  closedAt: string | null;
  author: GhActor | null;
  mergedBy: GhActor | null;
  reviewDecision: 'APPROVED' | 'CHANGES_REQUESTED' | 'REVIEW_REQUIRED' | null;
  baseRefOid: string;
  headRefOid: string;
  labels: { nodes: { name: string }[] } | null;
  files: { nodes: { path: string; changeType: string }[] } | null;
  commits: {
    totalCount: number;
    nodes: {
      commit: {
        committedDate: string;
        statusCheckRollup: { state: string; contexts: { nodes: GhContext[] } } | null;
      };
    }[];
  };
  reviewRequests: { nodes: { requestedReviewer: { login?: string } | null }[] } | null;
  reviews: { nodes: GhReview[] } | null;
}

/* ── Helpers ────────────────────────────────────────────── */

const login = (actor: GhActor | null) => actor?.login ?? 'ghost';
const labelsOf = (node: { labels: { nodes: { name: string }[] } | null }) =>
  (node.labels?.nodes ?? []).map((label) => label.name.toLowerCase());
/** Removes HTML comments, including nested ones and a comment left open. */
export function stripComments(markdown: string): string {
  let text = markdown;
  for (let previous = ''; previous !== text;) {
    previous = text;
    text = text.replace(/<!--[\s\S]*?-->/g, '');
  }
  // Removing a stray `<!--` can join its neighbours into a new one (`<!<!----`),
  // so repeat this too until nothing changes.
  for (let previous = ''; previous !== text;) {
    previous = text;
    text = text.replace(/<!--/g, '');
  }
  return text.trim();
}

/**
 * Value of a form field in a discussion or pull request body, as GitHub renders
 * forms ("### Label" followed by the answer). `_No response_` counts as empty.
 */
export function readFormField(body: string, label: string): string | undefined {
  const lines = body.replace(/\r\n/g, '\n').split('\n');
  const start = lines.findIndex(
    (line) =>
      /^#{2,3}\s/.test(line) &&
      line
        .replace(/^#+\s*/, '')
        .trim()
        .toLowerCase() === label.toLowerCase(),
  );
  if (start < 0) return undefined;
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => /^#{2,3}\s/.test(line));
  const value = stripComments((end < 0 ? rest : rest.slice(0, end)).join('\n'));
  return value && value !== '_No response_' ? value : undefined;
}

/** "Auth · Django + Next.js" -> { topic: 'auth', stack: 'django-nextjs' } */
export function parseRequestTitle(title: string): { topic?: string; stack?: string } {
  const [topic, stack] = title.split(/\s+[·|/-]\s+/);
  return {
    topic: topic ? topicSlug(topic) : undefined,
    stack: stack ? stackSlug(stack) : undefined,
  };
}

/** Request numbers a pull request says it resolves: "Request: #42", "resolves request #42", a discussion URL. */
export function linkedRequests(body: string, known: Set<number>): number[] {
  const found = new Set<number>();
  for (const match of body.matchAll(/discussions\/(\d+)/g)) found.add(Number(match[1]));
  for (const match of body.matchAll(/\b(?:request|resolves|closes|fixes)\b[^#\n]{0,20}#(\d+)/gi)) {
    found.add(Number(match[1]));
  }
  return [...found].filter((n) => known.has(n));
}

const CARD_PATH = /^cards\/([a-z0-9-]+)\/([a-z0-9-]+)\.md$/;

/** The card file a pull request changes, if any. */
export function cardFileOf(
  pr: Pick<GhPullRequest, 'files'>,
): { path: string; topic: string; stack: string; added: boolean } | undefined {
  for (const file of pr.files?.nodes ?? []) {
    const match = CARD_PATH.exec(file.path);
    if (match?.[1] && match[2]) {
      return {
        path: file.path,
        topic: match[1],
        stack: match[2],
        added: file.changeType === 'ADDED',
      };
    }
  }
  return undefined;
}

/* ── People ─────────────────────────────────────────────── */

/**
 * Maintainers come from MAINTAINERS; reviewers from CODEOWNERS lines such as
 * `cards/auth/** @handle`. Everyone else is a contributor.
 */
export function peopleFrom(
  maintainers: string,
  codeowners: string,
  tone: (handle: string) => Person['tone'],
): Person[] {
  const maintainerHandles = maintainers
    .split('\n')
    .map((line) => line.replace(/#.*/, '').trim().split(/\s+/)[0] ?? '')
    .map((handle) => handle.replace(/^@/, ''))
    .filter((handle) => /^[A-Za-z0-9-]+$/.test(handle));

  const topics = new Map<string, Set<string>>();
  for (const raw of codeowners.split('\n')) {
    const line = raw.replace(/#.*/, '').trim();
    if (!line) continue;
    const [pattern = '', ...owners] = line.split(/\s+/);
    const topic = /^\/?cards\/([a-z0-9-]+)\//.exec(pattern)?.[1];
    for (const owner of owners) {
      const handle = owner.replace(/^@/, '');
      if (!/^[A-Za-z0-9-]+$/.test(handle)) continue; // skip teams and emails
      const set = topics.get(handle) ?? new Set<string>();
      if (topic) set.add(topic);
      topics.set(handle, set);
    }
  }

  const people = new Map<string, Person>();
  for (const handle of maintainerHandles) {
    people.set(handle.toLowerCase(), {
      handle,
      role: 'maintainer',
      topics: [...(topics.get(handle) ?? [])],
      tone: tone(handle),
    });
  }
  for (const [handle, set] of topics) {
    if (people.has(handle.toLowerCase()) || set.size === 0) continue;
    people.set(handle.toLowerCase(), {
      handle,
      role: 'reviewer',
      topics: [...set],
      tone: tone(handle),
    });
  }
  return [...people.values()];
}

/* ── Requests ───────────────────────────────────────────── */

export function mapComment(comment: GhComment): Comment {
  return {
    id: comment.id,
    author: login(comment.author),
    date: comment.createdAt,
    body: comment.body,
    url: comment.url,
    replies: (comment.replies?.nodes ?? []).map(mapComment),
  };
}

export interface RequestContext {
  /** Card ids in the library, to link related cards. */
  cardIds: string[];
  /** Proposals that say they resolve each request. */
  proposalsByRequest: Map<number, { number: number; status: ProposalStatus }[]>;
}

export function mapDiscussion(discussion: GhDiscussion, context: RequestContext): Request {
  const fromTitle = parseRequestTitle(discussion.title);
  const topicField = readFormField(discussion.body, 'Topic');
  const stackField = readFormField(discussion.body, 'Stack');
  const topic = topicField ? topicSlug(topicField) : (fromTitle.topic ?? 'other');
  const stack = stackField ? stackSlug(stackField) : (fromTitle.stack ?? 'any');
  const what = readFormField(discussion.body, 'What are you building?');
  const proposals = context.proposalsByRequest.get(discussion.number) ?? [];
  const labels = labelsOf(discussion);

  let status: RequestStatus;
  if (discussion.closed) {
    status = discussion.stateReason === 'RESOLVED' || discussion.isAnswered ? 'resolved' : 'closed';
  } else if (
    labels.includes('in progress') ||
    labels.includes('in-progress') ||
    proposals.some((p) => p.status !== 'closed' && p.status !== 'accepted')
  ) {
    status = 'in-progress';
  } else if (proposals.some((p) => p.status === 'accepted')) {
    status = 'resolved';
  } else {
    status = 'open';
  }

  const comments = discussion.comments.nodes.map(mapComment);
  const lastComment = comments
    .flatMap((c) => [c.date, ...(c.replies ?? []).map((r) => r.date)])
    .sort()
    .at(-1);

  return {
    number: discussion.number,
    title: discussion.title,
    topic,
    stack,
    author: login(discussion.author),
    created: discussion.createdAt,
    updated: [discussion.updatedAt, lastComment ?? ''].sort().at(-1) ?? discussion.updatedAt,
    status,
    need: discussion.upvoteCount,
    body: what ?? stripComments(discussion.body),
    comments,
    proposals: proposals.map((p) => p.number),
    related: context.cardIds.filter((id) => id.startsWith(`${topic}/`)),
    url: discussion.url,
  };
}

/* ── Proposals ──────────────────────────────────────────── */

const TYPE_LABELS: Record<string, ProposalType> = {
  'new-card': 'new-card',
  'new card': 'new-card',
  change: 'change',
  'version-update': 'version-update',
  'version update': 'version-update',
  're-check': 're-check',
  recheck: 're-check',
};

export function proposalStatus(
  pr: Pick<GhPullRequest, 'state' | 'isDraft' | 'reviewDecision'>,
): ProposalStatus {
  if (pr.state === 'MERGED') return 'accepted';
  if (pr.state === 'CLOSED') return 'closed';
  if (pr.isDraft) return 'draft';
  if (pr.reviewDecision === 'CHANGES_REQUESTED') return 'changes-requested';
  if (pr.reviewDecision === 'APPROVED') return 'approved';
  return 'in-review';
}

function checkState(conclusion: string | null, status: string): ChecksState {
  if (status !== 'COMPLETED' || !conclusion) return 'running';
  return ['SUCCESS', 'NEUTRAL', 'SKIPPED'].includes(conclusion) ? 'passing' : 'failing';
}

export function rollupState(state: string | undefined): ChecksState {
  if (state === 'SUCCESS') return 'passing';
  if (state === 'FAILURE' || state === 'ERROR') return 'failing';
  return 'running';
}

function checkRuns(contexts: GhContext[]): CheckRun[] {
  return contexts.map((context) => {
    if (context.__typename === 'StatusContext') {
      return {
        name: context.context,
        state:
          context.state === 'SUCCESS'
            ? 'passing'
            : context.state === 'PENDING' || context.state === 'EXPECTED'
              ? 'running'
              : 'failing',
        note: context.description ?? '',
      };
    }
    const seconds =
      context.startedAt && context.completedAt
        ? Math.max(
            0,
            Math.round((Date.parse(context.completedAt) - Date.parse(context.startedAt)) / 1000),
          )
        : undefined;
    const state = checkState(context.conclusion, context.status);
    return {
      name: context.name,
      state,
      note:
        context.title ??
        (state === 'running' ? 'Running' : (context.conclusion ?? '').toLowerCase()),
      ...(seconds !== undefined ? { seconds } : {}),
    };
  });
}

/** "What this changes" from the pull request template, or the whole body. */
function proposalSummary(body: string): string {
  return readFormField(body, 'What this changes') ?? stripComments(body);
}

/** Who proposed it: the site's app opens pull requests for people and names them in the body. */
const proposerOfPr = (pr: GhPullRequest) => proposerOf(pr.body, login(pr.author));

function approvalsOf(pr: GhPullRequest): Approval[] {
  const latest = new Map<string, GhReview['state']>();
  const proposer = proposerOfPr(pr).toLowerCase();
  for (const review of pr.reviews?.nodes ?? []) {
    if (!review.author || review.state === 'PENDING' || review.state === 'COMMENTED') continue;
    if (review.author.login.toLowerCase() === proposer) continue;
    latest.set(review.author.login, review.state);
  }
  const approvals: Approval[] = [];
  for (const [handle, state] of latest)
    approvals.push({ handle, state: state === 'APPROVED' ? 'approved' : 'requested' });
  for (const request of pr.reviewRequests?.nodes ?? []) {
    const handle = request.requestedReviewer?.login;
    if (handle && !latest.has(handle)) approvals.push({ handle, state: 'requested' });
  }
  return approvals;
}

function reviewsOf(pr: GhPullRequest): Review[] {
  return (pr.reviews?.nodes ?? [])
    .filter(
      (review) =>
        review.state !== 'PENDING' &&
        review.submittedAt &&
        (review.body.trim() || review.comments.nodes.length || review.state !== 'COMMENTED'),
    )
    .map((review): Review => ({
      id: review.id,
      author: login(review.author),
      date: review.submittedAt ?? '',
      verdict:
        review.state === 'APPROVED'
          ? 'approved'
          : review.state === 'CHANGES_REQUESTED'
            ? 'changes'
            : 'comment',
      body: review.body.trim(),
      notes: review.comments.nodes
        .filter((comment) => !fieldOf(comment.body).field)
        .map((comment) => ({
          field: comment.line ? `${comment.path} · line ${comment.line}` : comment.path,
          text: comment.body,
        })),
    }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

function timelineOf(
  pr: GhPullRequest,
  status: ProposalStatus,
  checks: ChecksState,
  revisions: number,
): TimelineStep[] {
  const steps: (TimelineStep & { at: string })[] = [
    {
      label: 'Opened',
      meta: `@${proposerOfPr(pr)} · ${formatShortDate(pr.createdAt)}`,
      state: 'done',
      at: pr.createdAt,
    },
  ];
  for (const review of pr.reviews?.nodes ?? []) {
    if (!review.submittedAt) continue;
    if (review.state === 'APPROVED') {
      steps.push({
        label: 'Approved',
        meta: `@${login(review.author)} · ${formatShortDate(review.submittedAt)}`,
        state: 'done',
        at: review.submittedAt,
      });
    } else if (review.state === 'CHANGES_REQUESTED') {
      const note = review.body.trim().split('\n')[0];
      steps.push({
        label: 'Changes requested',
        meta: `@${login(review.author)} · ${formatShortDate(review.submittedAt)}`,
        ...(note ? { note } : {}),
        state: 'warn',
        at: review.submittedAt,
      });
    }
  }
  const committed = pr.commits.nodes[0]?.commit.committedDate ?? pr.updatedAt;
  if (checks !== 'running') {
    steps.push({
      label: checks === 'passing' ? 'Checks passed' : 'Checks failed',
      meta: `Revision ${revisions} · ${formatShortDate(committed)}`,
      state: checks === 'passing' ? 'done' : 'warn',
      at: committed,
    });
  }
  steps.sort((a, b) => a.at.localeCompare(b.at));
  if (status === 'accepted' && pr.mergedAt) {
    steps.push({
      label: 'Accepted',
      meta: `@${login(pr.mergedBy)} · ${formatShortDate(pr.mergedAt)}`,
      state: 'done',
      at: pr.mergedAt,
    });
  } else if (status === 'closed') {
    steps.push({
      label: 'Closed',
      meta: formatShortDate(pr.closedAt ?? pr.updatedAt),
      state: 'warn',
      at: pr.closedAt ?? '',
    });
  } else if (status === 'draft') {
    steps.push({ label: 'Ready for review', meta: 'Still a draft', state: 'next', at: '' });
  } else {
    steps.push({
      label: 'Accepted',
      meta:
        checks === 'passing'
          ? "Needs a maintainer's approval (seed) or 2 approvals"
          : "Needs passing checks and a maintainer's approval",
      state: 'next',
      at: '',
    });
  }
  return steps.map(({ at, ...step }) => {
    void at;
    return step;
  });
}

/** Review comments the site posted on a field become that field's thread on the Changes tab. */
function withThreads(changes: FieldChange[], pr: GhPullRequest): FieldChange[] {
  const byField = new Map<string, Comment[]>();
  for (const review of pr.reviews?.nodes ?? []) {
    for (const comment of review.comments.nodes) {
      const { field, text } = fieldOf(comment.body);
      if (!field) continue;
      byField.set(field, [
        ...(byField.get(field) ?? []),
        {
          id: comment.id ?? `${review.id}-${field}-${byField.get(field)?.length ?? 0}`,
          author: login(comment.author ?? review.author),
          date: comment.createdAt ?? review.submittedAt ?? '',
          body: text.trim(),
        },
      ]);
    }
  }
  if (byField.size === 0) return changes;
  return changes.map((change) => {
    const comments = byField.get(change.id);
    if (!comments) return change;
    comments.sort((a, b) => a.date.localeCompare(b.date));
    return { ...change, thread: { field: change.name, comments } };
  });
}

export interface ProposalContext {
  /** Card at the pull request base and head (parsed), when they could be read. */
  base?: CardJSON;
  head?: CardJSON;
  /** Request numbers that exist, to validate links in the body. */
  requestNumbers: Set<number>;
}

/** A pull request that changes a card becomes a proposal; any other pull request is skipped. */
export function mapPullRequest(pr: GhPullRequest, context: ProposalContext): Proposal | undefined {
  const file = cardFileOf(pr);
  if (!file) return undefined;
  const status = proposalStatus(pr);
  const lastCommit = pr.commits.nodes[0]?.commit;
  const checks = rollupState(lastCommit?.statusCheckRollup?.state);
  const revisions = pr.commits.totalCount;
  const diff = diffCards(context.base, context.head);

  const labelType = labelsOf(pr)
    .map((label) => TYPE_LABELS[label])
    .find(Boolean);
  const onlyVersions =
    diff.changes.length > 0 && diff.changes.every((c) => c.id === 'versions' || c.id === 'meta');
  const type: ProposalType =
    labelType ??
    (file.added || !context.base
      ? 'new-card'
      : /^re-?check/i.test(pr.title)
        ? 're-check'
        : /^version update/i.test(pr.title) || onlyVersions
          ? 'version-update'
          : 'change');

  const request = linkedRequests(pr.body, context.requestNumbers)[0];

  return {
    number: pr.number,
    type,
    title: pr.title,
    topic: file.topic,
    stack: file.stack,
    author: proposerOfPr(pr),
    opened: pr.createdAt,
    updated: pr.updatedAt,
    status,
    checks,
    revisions,
    cardId: `${file.topic}/${file.stack}`,
    ...(context.base ? { fromVersion: context.base.card_version } : {}),
    ...(context.head ? { toVersion: context.head.card_version } : {}),
    ...(request !== undefined ? { request } : {}),
    summary: proposalSummary(pr.body),
    approvals: approvalsOf(pr),
    timeline: timelineOf(pr, status, checks, revisions),
    checkRuns: checkRuns(lastCommit?.statusCheckRollup?.contexts.nodes ?? []),
    checkedAt: lastCommit?.committedDate ?? pr.updatedAt,
    changes: withThreads(diff.changes, pr),
    changeTotals: diff.totals,
    reviews: reviewsOf(pr),
    url: pr.url,
    ...(context.head ? { previewCard: context.head } : {}),
  };
}

/* ── Activity ───────────────────────────────────────────── */

export function activityFrom(
  discussions: GhDiscussion[],
  pulls: GhPullRequest[],
  proposalNumbers: Set<number>,
): ActivityEvent[] {
  const events: ActivityEvent[] = [];
  for (const d of discussions) {
    events.push({
      actor: login(d.author),
      verb: 'asked',
      date: d.createdAt,
      target: `request:${d.number}`,
    });
    for (const c of d.comments.nodes) {
      events.push({
        actor: login(c.author),
        verb: 'commented',
        date: c.createdAt,
        target: `request:${d.number}`,
      });
      for (const r of c.replies?.nodes ?? []) {
        events.push({
          actor: login(r.author),
          verb: 'commented',
          date: r.createdAt,
          target: `request:${d.number}`,
        });
      }
    }
  }
  for (const pr of pulls) {
    if (!proposalNumbers.has(pr.number)) continue;
    const target = `proposal:${pr.number}`;
    events.push({ actor: proposerOfPr(pr), verb: 'opened', date: pr.createdAt, target });
    for (const review of pr.reviews?.nodes ?? []) {
      if (!review.submittedAt) continue;
      const verb =
        review.state === 'APPROVED'
          ? 'approved'
          : review.state === 'CHANGES_REQUESTED'
            ? 'requested-changes'
            : 'commented';
      events.push({ actor: login(review.author), verb, date: review.submittedAt, target });
    }
    if (pr.mergedAt)
      events.push({ actor: login(pr.mergedBy), verb: 'accepted', date: pr.mergedAt, target });
  }
  return events
    .filter((e) => e.actor !== 'ghost')
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 100);
}
