import type { Lens, VerifyType } from '@mustlist/schema/constants';
import type { ChecksState, ProposalStatus, ProposalType, RequestStatus } from '@/lib/status';

/**
 * Community data: requests, proposals, reviews and people. GitHub is the engine
 * (Discussions, pull requests, reviews; decision D-021). Until that is wired up,
 * the site reads the sample data in ./sample.ts through the getters in ./index.ts.
 */

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
  name: 'Format' | 'Safety' | 'Links';
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
}

export type ActivityVerb =
  'opened' | 'requested-changes' | 'accepted' | 'approved' | 'commented' | 'asked';

export interface ActivityEvent {
  actor: string;
  verb: ActivityVerb;
  date: string;
  /** `proposal:17`, `request:42` or `card:auth/nextjs-postgres` */
  target: string;
}
