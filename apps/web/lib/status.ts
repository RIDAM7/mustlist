import type { Status } from '@mustlist/schema/constants';
import type { MarkName } from '@/components/mark';

/**
 * Status pills: one colour and one mark per state, shown as pills and never as
 * sentences. The mark names the idea (a tick is a yes, an eye is waiting on
 * reviewers) and keeps it wherever that idea appears.
 */
export interface PillStyle {
  label: string;
  pill: string;
  /** The mark before the label; left out when the pill is a caption, not a state. */
  glyph?: MarkName;
}

export const CARD_STATUS: Record<Status, PillStyle> = {
  verified: { label: 'Verified', pill: 'p-success', glyph: 'tick' },
  stale: { label: 'Being re-checked', pill: 'p-warning', glyph: 'refresh' },
  proposed: { label: 'Proposed', pill: 'p-accent', glyph: 'eye' },
  draft: { label: 'Draft', pill: 'p-outline', glyph: 'dashed-ring' },
};

export type RequestStatus = 'open' | 'in-progress' | 'resolved' | 'closed';

export const REQUEST_STATUS: Record<RequestStatus, PillStyle> = {
  open: { label: 'Open', pill: 'p-accent', glyph: 'ring' },
  'in-progress': { label: 'In progress', pill: 'p-warning', glyph: 'half-ring' },
  resolved: { label: 'Resolved', pill: 'p-success', glyph: 'tick-disc' },
  closed: { label: 'Closed', pill: 'p-neutral', glyph: 'slash-ring' },
};

export type ProposalStatus =
  'draft' | 'in-review' | 'changes-requested' | 'approved' | 'accepted' | 'closed';

export const PROPOSAL_STATUS: Record<ProposalStatus, PillStyle> = {
  draft: { label: 'Draft', pill: 'p-outline', glyph: 'dashed-ring' },
  'in-review': { label: 'In review', pill: 'p-accent', glyph: 'eye' },
  'changes-requested': { label: 'Changes requested', pill: 'p-warning', glyph: 'back-arrow' },
  approved: { label: 'Approved', pill: 'p-success', glyph: 'tick' },
  accepted: { label: 'Accepted', pill: 'p-solid', glyph: 'double-tick' },
  closed: { label: 'Closed', pill: 'p-neutral', glyph: 'slash-ring' },
};

export type ChecksState = 'passing' | 'failing' | 'running';

/** `tone` colours a check row or the Checks column: ok, bad or run. */
export const CHECKS_STATE: Record<ChecksState, PillStyle & { tone: string }> = {
  passing: { label: 'Passing', pill: 'p-success', glyph: 'tick', tone: 'ok' },
  failing: { label: 'Failing', pill: 'p-danger', glyph: 'cross', tone: 'bad' },
  running: { label: 'Running', pill: 'p-accent p-running', glyph: 'spinner', tone: 'run' },
};

export type ReviewVerdict = 'approved' | 'changes' | 'comment';

export const REVIEW_VERDICT: Record<ReviewVerdict, PillStyle> = {
  approved: { label: 'Approved', pill: 'p-success', glyph: 'tick' },
  changes: { label: 'Changes requested', pill: 'p-warning', glyph: 'back-arrow' },
  comment: { label: 'Comment', pill: 'p-outline', glyph: 'bubble' },
};

/** Label pills: a mark only when the label makes a claim. */
export const LABEL_PILL = {
  recommended: { label: 'Recommended', pill: 'p-rec', glyph: 'star' },
  fits: { label: 'Fits your answers', pill: 'p-accent', glyph: 'target' },
  matches: { label: 'Matches', pill: 'p-accent', glyph: 'target' },
  notInLibrary: { label: 'Not in library', pill: 'p-outline', glyph: 'ring' },
  sampleData: { label: 'Sample data', pill: 'p-neutral' },
  githubUnavailable: { label: 'GitHub unavailable', pill: 'p-warning p-bare' },
} satisfies Record<string, PillStyle>;

const ALL_PILLS: PillStyle[] = [
  ...Object.values(CARD_STATUS),
  ...Object.values(REQUEST_STATUS),
  ...Object.values(PROPOSAL_STATUS),
  ...Object.values(CHECKS_STATE),
  ...Object.values(REVIEW_VERDICT),
  ...Object.values(LABEL_PILL),
];

/** One label means one idea, so the same label always takes the same mark. */
const MARK_BY_LABEL = new Map<string, MarkName>(
  ALL_PILLS.flatMap((p) => (p.glyph ? [[p.label, p.glyph] as const] : [])),
);

/** The mark for a pill label, for pills built from data that carries only the label. */
export const markForLabel = (label: string): MarkName | undefined => MARK_BY_LABEL.get(label);

export type ProposalType = 'new-card' | 'change' | 'version-update' | 're-check';

export const PROPOSAL_TYPE: Record<ProposalType, string> = {
  'new-card': 'New card',
  change: 'Change',
  'version-update': 'Version update',
  're-check': 'Re-check',
};

/** Requests and proposals that still need work. */
export const isOpenProposal = (status: ProposalStatus) =>
  status !== 'accepted' && status !== 'closed';
