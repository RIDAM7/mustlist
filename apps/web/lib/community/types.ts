import type { Lens, VerifyType } from '@mustlist/schema/constants';
import type { CardJSON } from '@mustlist/schema/types';
import type { ChecksState, ProposalStatus, ProposalType, RequestStatus } from '@/lib/status';

/**
 * Community data: requests, proposals, reviews and people. GitHub is the engine
 * (decision D-021): requests are Discussions in the "Requests" category, proposals
 * are pull requests that change cards, reviews are pull request reviews.
 * `load.ts` reads GitHub when a token is set, otherwise the sample in `sample.ts`.
 */

export type CommunitySource = 'github' | 'sample';

/** Everything the community pages need, loaded once and cached (see `load.ts`). */
export interface CommunityData {
  source: CommunitySource;
  /** `owner/name` of the GitHub repository. */
  repo: string;
  /** When the data was read. */
  fetchedAt: string;
  /** "Now" for relative dates: fixed in sample mode so the sample never ages. */
  now: string;
  /** True when GitHub could not be read; the pages then show empty lists. */
  unavailable?: boolean;
  /** False when the repository has no "Requests" discussion category yet. */
  requestsEnabled: boolean;
  people: Person[];
  requests: Request[];
  proposals: Proposal[];
  activity: ActivityEvent[];
  /** Each card's Discussion tab: a Q&A discussion per card id, when one exists. */
  cardThreads?: Record<string, CardThread>;
}

export interface CardThread {
  number: number;
  url: string;
  comments: Comment[];
}

export type Role = 'maintainer' | 'reviewer' | 'contributor';

export interface Person {
  handle: string;
  role: Role;
  /** Topics the person reviews (topic slugs). */
  topics: string[];
  /** Avatar colour, 1-4 (av, av-2, av-3, av-4). */
  tone: 1 | 2 | 3 | 4;
}

export interface Comment {
  id: string;
  author: string;
  /** ISO date or date-time. */
  date: string;
  /** Markdown. */
  body: string;
  replies?: Comment[];
  /** Link to the comment on GitHub. */
  url?: string;
}

export interface Request {
  number: number;
  title: string;
  topic: string;
  stack: string;
  author: string;
  created: string;
  updated: string;
  status: RequestStatus;
  need: number;
  /** Markdown. */
  body: string;
  comments: Comment[];
  /** Linked proposal numbers. */
  proposals: number[];
  /** Related card ids. */
  related: string[];
  /** The discussion on GitHub. */
  url?: string;
}

export interface Approval {
  handle: string;
  state: 'approved' | 'requested';
}

export interface TimelineStep {
  label: string;
  meta: string;
  note?: string;
  state: 'done' | 'warn' | 'next';
}

export interface CheckRun {
  /** Check name as GitHub reports it ("Format", "Typecheck, lint, test, validate, build"). */
  name: string;
  state: ChecksState;
  note: string;
  seconds?: number;
}

/** One row of a field-by-field comparison. Text may contain `code` in backticks. */
export interface DiffRow {
  kind: 'add' | 'del' | 'chg' | 'same';
  /** Small caption above the text: "range", "note 1", "inline-after · trade-offs". */
  caption?: string;
  /** Item id, lens, level and verify type chips. */
  chips?: { id?: string; lens?: Lens; level?: 'must' | 'should'; type?: VerifyType };
  /** Previous value (changed rows). */
  old?: string;
  text: string;
  /** Render values in monospace (ranges, versions). */
  mono?: boolean;
  /** Host shown after a source title. */
  host?: string;
  /** Muted note after a changed value. */
  note?: string;
}

export interface FieldThread {
  /** "secret-rotation · why" */
  field: string;
  comments: Comment[];
  resolvedBy?: string;
}

export interface FieldChange {
  id: string;
  name: string;
  /** Compact counts for the side nav: "+2 ~2". */
  short: string;
  /** Mono hint next to the field name ("stripe"). */
  hint?: string;
  /** "1 added · 1 changed" */
  summary: string;
  rows: DiffRow[];
  thread?: FieldThread;
  /** Field set by maintainers, not open for comments. */
  maintainerOnly?: boolean;
}

export interface ReviewNote {
  /** "lenses.performance · paragraph 1" */
  field: string;
  quote?: string;
  text: string;
  resolved?: string;
}

export interface Review {
  id: string;
  author: string;
  date: string;
  revision?: number;
  verdict: 'approved' | 'changes' | 'comment';
  body: string;
  notes?: ReviewNote[];
  replies?: Comment[];
}

export interface Proposal {
  number: number;
  type: ProposalType;
  title: string;
  topic: string;
  stack: string;
  author: string;
  opened: string;
  updated: string;
  status: ProposalStatus;
  checks: ChecksState;
  revisions: number;
  /** The card this proposal changes (absent for new cards). */
  cardId?: string;
  /** Card version this proposal starts from, and the version it produces. */
  fromVersion?: string;
  toVersion?: string;
  /** Request this proposal resolves. */
  request?: number;
  /** Markdown. */
  summary: string;
  approvals: Approval[];
  timeline: TimelineStep[];
  checkRuns: CheckRun[];
  /** "Revision 3 · 12 Nov, 16:04" */
  checkedAt: string;
  changes: FieldChange[];
  changeTotals?: { fields: number; added: number; changed: number; removed: number };
  reviews: Review[];
  /** The pull request on GitHub. */
  url?: string;
  /** The card as this proposal would publish it (pull request head). */
  previewCard?: CardJSON;
}

/** A proposal without its heavy parts, for lists and search. */
export type ProposalSummary = Pick<
  Proposal,
  | 'number'
  | 'type'
  | 'title'
  | 'topic'
  | 'stack'
  | 'author'
  | 'opened'
  | 'updated'
  | 'status'
  | 'checks'
  | 'approvals'
  | 'cardId'
  | 'request'
  | 'url'
>;

/** A request without its thread, for lists and search. */
export type RequestSummary = Omit<Request, 'comments' | 'body'> & { replies: number };

export type ActivityVerb =
  'opened' | 'requested-changes' | 'accepted' | 'approved' | 'commented' | 'asked';

export interface ActivityEvent {
  actor: string;
  verb: ActivityVerb;
  date: string;
  /** `proposal:17`, `request:42` or `card:auth/nextjs-postgres` */
  target: string;
}
