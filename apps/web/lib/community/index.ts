import { isOpenProposal } from '@/lib/status';
import type {
  ActivityEvent,
  Comment,
  CommunityData,
  Person,
  Proposal,
  ProposalSummary,
  Request,
  RequestSummary,
  Role,
} from './types';

export type * from './types';

/**
 * Pure queries over loaded community data. Server components get the data from
 * `loadCommunity()` (./load.ts); client components receive what they need as props.
 */

/* ── People ─────────────────────────────────────────────── */

const ROLE_LABEL: Record<Role, string> = {
  maintainer: 'Maintainer',
  reviewer: 'Reviewer',
  contributor: 'Contributor',
};

export function roleLabel(role: Role): string {
  return ROLE_LABEL[role];
}

/** The design's colours for the sample people; everyone else gets a stable hash. */
const KNOWN_TONES: Record<string, Person['tone']> = {
  ridam7: 1,
  'tomas-r': 2,
  'lena-dev': 3,
  'maya-k': 4,
};

export function toneFor(handle: string): Person['tone'] {
  const known = KNOWN_TONES[handle.toLowerCase()];
  if (known) return known;
  let hash = 0;
  for (const char of handle) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return ((hash % 4) + 1) as Person['tone'];
}

/** Every handle resolves to a person; unknown handles become contributors. */
export function getPerson(people: Person[], handle: string): Person {
  return (
    people.find((person) => person.handle.toLowerCase() === handle.toLowerCase()) ?? {
      handle,
      role: 'contributor',
      topics: [],
      tone: toneFor(handle),
    }
  );
}

/** Badge shown next to a name in threads: maintainers and reviewers only. */
export function personBadge(people: Person[], handle: string): string | undefined {
  const { role } = getPerson(people, handle);
  return role === 'contributor' ? undefined : roleLabel(role);
}

/* ── Requests ───────────────────────────────────────────── */

export function countComments(comments: Comment[]): number {
  return comments.reduce((sum, comment) => sum + 1 + (comment.replies?.length ?? 0), 0);
}

export function getRequest(data: CommunityData, number: number): Request | undefined {
  return data.requests.find((request) => request.number === number);
}

const isActive = (r: Pick<Request, 'status'>) => r.status === 'open' || r.status === 'in-progress';
const isRecheck = (r: Pick<Request, 'title'>) => /^re-?check\b/i.test(r.title);
const byNeed = (a: Request, b: Request) => b.need - a.need;

/** Open and in-progress requests, most wanted first (re-checks are not "wanted"). */
export function mostWanted(data: CommunityData, limit = 4): Request[] {
  return data.requests
    .filter((r) => isActive(r) && !isRecheck(r))
    .sort(byNeed)
    .slice(0, limit);
}

export function requestsForTopic(data: CommunityData, topic: string): Request[] {
  return data.requests.filter((r) => r.topic === topic && isActive(r)).sort(byNeed);
}

export function requestsForStack(data: CommunityData, stack: string): Request[] {
  return data.requests
    .filter((r) => r.stack === stack && isActive(r) && !isRecheck(r))
    .sort(byNeed);
}

/** "No proposal", "1 proposal", "1 proposal in review", "1 accepted" */
export function requestProposalMeta(data: CommunityData, request: Request): string {
  const linked = request.proposals
    .map((number) => getProposal(data, number))
    .filter((p): p is Proposal => Boolean(p));
  const accepted = linked.filter((p) => p.status === 'accepted').length;
  if (request.status === 'resolved') return `${Math.max(accepted, 1)} accepted`;
  if (linked.length === 0) return 'No proposal';
  const plural = linked.length === 1 ? '' : 's';
  if (linked.some((p) => p.status === 'in-review'))
    return `${linked.length} proposal${plural} in review`;
  return `${linked.length} proposal${plural}`;
}

export function toRequestSummary(request: Request): RequestSummary {
  const { comments, body, ...rest } = request;
  void body;
  return { ...rest, replies: countComments(comments) };
}

/* ── Proposals ──────────────────────────────────────────── */

export function listProposals(data: CommunityData): Proposal[] {
  return [...data.proposals].sort((a, b) => b.updated.localeCompare(a.updated));
}

export function getProposal(data: CommunityData, number: number): Proposal | undefined {
  return data.proposals.find((proposal) => proposal.number === number);
}

export function proposalsForTopic(data: CommunityData, topic: string, open = true): Proposal[] {
  return listProposals(data).filter(
    (p) => p.topic === topic && (!open || isOpenProposal(p.status)),
  );
}

export function proposalsForCard(data: CommunityData, cardId: string): Proposal[] {
  return listProposals(data).filter((p) => p.cardId === cardId);
}

export function approvalCount(proposal: Pick<Proposal, 'approvals'>): number {
  return proposal.approvals.filter((a) => a.state === 'approved').length;
}

/** 2 approvals, at least 1 from a maintainer, and passing checks. */
export function canAccept(
  people: Person[],
  proposal: Proposal,
  approvals = approvalCount(proposal),
): boolean {
  const maintainerApproved = proposal.approvals.some(
    (a) => a.state === 'approved' && getPerson(people, a.handle).role === 'maintainer',
  );
  return proposal.checks === 'passing' && approvals >= 2 && maintainerApproved;
}

export function toProposalSummary(proposal: Proposal): ProposalSummary {
  return {
    number: proposal.number,
    type: proposal.type,
    title: proposal.title,
    topic: proposal.topic,
    stack: proposal.stack,
    author: proposal.author,
    opened: proposal.opened,
    updated: proposal.updated,
    status: proposal.status,
    checks: proposal.checks,
    approvals: proposal.approvals,
    cardId: proposal.cardId,
    request: proposal.request,
    url: proposal.url,
  };
}

/** Proposals waiting for a reviewer: they review the topic (or maintain) and have not approved. */
export function reviewQueue<T extends ProposalSummary>(
  people: Person[],
  proposals: T[],
  handle: string,
): T[] {
  const person = getPerson(people, handle);
  return proposals.filter((p) => {
    if (p.author === handle) return false;
    if (p.status !== 'in-review' && p.status !== 'changes-requested') return false;
    const own = p.approvals.find((a) => a.handle === handle);
    if (own?.state === 'approved') return false;
    return person.role === 'maintainer' || person.topics.includes(p.topic) || Boolean(own);
  });
}

/** Why a proposal sits in someone's queue. */
export function queueReason(people: Person[], proposal: ProposalSummary, handle: string): string {
  const person = getPerson(people, handle);
  if (proposal.status === 'changes-requested') return 'Updated since your review';
  if (person.role === 'maintainer' && approvalCount(proposal) >= 1)
    return 'Maintainer approval needed';
  return `Requested by @${proposal.author}`;
}

/* ── Activity ───────────────────────────────────────────── */

export function listActivity(data: CommunityData): ActivityEvent[] {
  return [...data.activity].sort((a, b) => b.date.localeCompare(a.date));
}

export function activityFor(data: CommunityData, handle: string): ActivityEvent[] {
  return listActivity(data).filter((event) => event.actor.toLowerCase() === handle.toLowerCase());
}

/** Resolve an activity target to a title and a link. */
export function describeTarget(
  data: CommunityData,
  target: string,
): { title: string; href: string } {
  const [kind = '', id = ''] = target.split(':');
  if (kind === 'proposal') {
    const proposal = getProposal(data, Number(id));
    return { title: `#${id} ${proposal?.title ?? ''}`.trim(), href: `/proposals/${id}` };
  }
  if (kind === 'request') {
    const request = getRequest(data, Number(id));
    return { title: `#${id} ${request?.title ?? ''}`.trim(), href: `/requests/${id}` };
  }
  return { title: id, href: `/${id}` };
}

/** Everyone who appears in the data, known people first. */
export function allHandles(data: CommunityData): string[] {
  const handles = new Set(data.people.map((p) => p.handle));
  for (const r of data.requests) {
    handles.add(r.author);
    for (const c of r.comments) {
      handles.add(c.author);
      for (const reply of c.replies ?? []) handles.add(reply.author);
    }
  }
  for (const p of data.proposals) {
    handles.add(p.author);
    for (const review of p.reviews) handles.add(review.author);
  }
  return [...handles].filter((h) => h && h !== 'ghost');
}

/**
 * Accepted proposals for a card, newest first: its History. The sample's accepted
 * proposals describe verified cards, so they are not shown on real draft cards.
 */
export function cardHistory(data: CommunityData, cardId: string, status: string): Proposal[] {
  if (data.source === 'sample' && status === 'draft') return [];
  return proposalsForCard(data, cardId).filter((p) => p.status === 'accepted');
}
