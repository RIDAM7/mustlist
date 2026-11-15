import { isOpenProposal } from '@/lib/status';
import { ACTIVITY, PEOPLE, PROPOSALS, REQUESTS, SAMPLE_NOW, SAMPLE_VIEWER } from './sample';
import type { ActivityEvent, Comment, Person, Proposal, Request, Role } from './types';

export type * from './types';

/**
 * Read access to community data. Today this serves the sample data; build step A
 * (D-021) swaps these bodies for cached reads of GitHub Discussions and pull
 * requests without changing their signatures.
 */
export const COMMUNITY_SOURCE: 'sample' | 'github' = 'sample';
export const isSampleData = (COMMUNITY_SOURCE as string) === 'sample';

/** "Now" for relative dates in sample mode, so the sample never ages. */
export function communityNow(): Date {
  return isSampleData ? new Date(SAMPLE_NOW) : new Date();
}

export const sampleViewerHandle = SAMPLE_VIEWER;

/* ── People ─────────────────────────────────────────────── */

const ROLE_LABEL: Record<Role, string> = {
  maintainer: 'Maintainer',
  reviewer: 'Reviewer',
  contributor: 'Contributor',
};

export function roleLabel(role: Role): string {
  return ROLE_LABEL[role];
}

function toneFor(handle: string): Person['tone'] {
  let hash = 0;
  for (const char of handle) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return ((hash % 4) + 1) as Person['tone'];
}

/** Every handle resolves to a person; unknown handles become contributors. */
export function getPerson(handle: string): Person {
  return (
    PEOPLE.find((person) => person.handle.toLowerCase() === handle.toLowerCase()) ?? {
      handle,
      role: 'contributor',
      topics: [],
      tone: toneFor(handle),
    }
  );
}

export function listPeople(): Person[] {
  return PEOPLE;
}

/** Badge shown next to a name in threads: maintainers and reviewers only. */
export function personBadge(handle: string): string | undefined {
  const { role } = getPerson(handle);
  return role === 'contributor' ? undefined : roleLabel(role);
}

/* ── Requests ───────────────────────────────────────────── */

export function countComments(comments: Comment[]): number {
  return comments.reduce((sum, comment) => sum + 1 + (comment.replies?.length ?? 0), 0);
}

export function listRequests(): Request[] {
  return REQUESTS;
}

export function getRequest(number: number): Request | undefined {
  return REQUESTS.find((request) => request.number === number);
}

const byNeed = (a: Request, b: Request) => b.need - a.need;

/** Open and in-progress requests, most wanted first. */
export function mostWanted(limit = 4): Request[] {
  return REQUESTS.filter((r) => r.status === 'open' || r.status === 'in-progress')
    .filter((r) => !r.title.startsWith('Re-check'))
    .sort(byNeed)
    .slice(0, limit);
}

export function requestsForTopic(topic: string): Request[] {
  return REQUESTS.filter(
    (r) => r.topic === topic && (r.status === 'open' || r.status === 'in-progress'),
  ).sort(byNeed);
}

export function requestsForStack(stack: string): Request[] {
  return REQUESTS.filter(
    (r) => r.stack === stack && (r.status === 'open' || r.status === 'in-progress'),
  )
    .filter((r) => !r.title.startsWith('Re-check'))
    .sort(byNeed);
}

/** "No proposal", "1 proposal", "1 proposal in review", "1 accepted" */
export function requestProposalMeta(request: Request): string {
  if (request.status === 'resolved') return '1 accepted';
  const linked = request.proposals.map(getProposal).filter((p): p is Proposal => Boolean(p));
  if (linked.length === 0) return 'No proposal';
  if (linked.some((p) => p.status === 'in-review')) {
    return `${linked.length} proposal${linked.length === 1 ? '' : 's'} in review`;
  }
  return `${linked.length} proposal${linked.length === 1 ? '' : 's'}`;
}

/* ── Proposals ──────────────────────────────────────────── */

export function listProposals(): Proposal[] {
  return [...PROPOSALS].sort((a, b) => b.updated.localeCompare(a.updated));
}

export function getProposal(number: number): Proposal | undefined {
  return PROPOSALS.find((proposal) => proposal.number === number);
}

export function proposalsForTopic(topic: string, open = true): Proposal[] {
  return listProposals().filter((p) => p.topic === topic && (!open || isOpenProposal(p.status)));
}

export function proposalsForCard(cardId: string): Proposal[] {
  return listProposals().filter((p) => p.cardId === cardId);
}

export function approvalCount(proposal: Proposal): number {
  return proposal.approvals.filter((a) => a.state === 'approved').length;
}

/** 2 approvals, at least 1 from a maintainer, and passing checks. */
export function canAccept(proposal: Proposal, approvals = approvalCount(proposal)): boolean {
  const maintainerApproved = proposal.approvals.some(
    (a) => a.state === 'approved' && getPerson(a.handle).role === 'maintainer',
  );
  return proposal.checks === 'passing' && approvals >= 2 && maintainerApproved;
}

/** Proposals waiting for a reviewer: they review the topic (or maintain) and have not approved. */
export function reviewQueue(handle: string): Proposal[] {
  const person = getPerson(handle);
  return listProposals().filter((p) => {
    if (p.author === handle) return false;
    if (p.status !== 'in-review' && p.status !== 'changes-requested') return false;
    const own = p.approvals.find((a) => a.handle === handle);
    if (own?.state === 'approved') return false;
    return person.role === 'maintainer' || person.topics.includes(p.topic) || Boolean(own);
  });
}

/** Why a proposal sits in someone's queue. */
export function queueReason(proposal: Proposal, handle: string): string {
  const person = getPerson(handle);
  if (proposal.status === 'changes-requested') return 'Updated since your review';
  if (person.role === 'maintainer' && approvalCount(proposal) >= 1) {
    return 'Maintainer approval needed';
  }
  return `Requested by @${proposal.author}`;
}

/* ── Activity ───────────────────────────────────────────── */

export function listActivity(): ActivityEvent[] {
  return [...ACTIVITY].sort((a, b) => b.date.localeCompare(a.date));
}

export function activityFor(handle: string): ActivityEvent[] {
  return listActivity().filter((event) => event.actor === handle);
}

export function reviewsBy(handle: string): number {
  return PROPOSALS.reduce(
    (sum, p) => sum + p.reviews.filter((review) => review.author === handle).length,
    0,
  );
}

/** Resolve an activity target to a title and a link. */
export function describeTarget(target: string): { title: string; href: string } {
  const [kind = '', id = ''] = target.split(':');
  if (kind === 'proposal') {
    const proposal = getProposal(Number(id));
    return { title: `#${id} ${proposal?.title ?? ''}`.trim(), href: `/proposals/${id}` };
  }
  if (kind === 'request') {
    const request = getRequest(Number(id));
    return { title: `#${id} ${request?.title ?? ''}`.trim(), href: `/requests/${id}` };
  }
  return { title: id, href: `/${id}` };
}
