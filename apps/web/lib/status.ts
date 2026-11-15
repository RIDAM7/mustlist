import type { Status } from '@mustlist/schema/constants';

/** Status pills: one colour per state, shown as pills and never as sentences. */
export interface PillStyle {
  label: string;
  pill: string;
}

export const CARD_STATUS: Record<Status, PillStyle> = {
  verified: { label: 'Verified', pill: 'p-success' },
  stale: { label: 'Being re-checked', pill: 'p-warning' },
  proposed: { label: 'Proposed', pill: 'p-neutral' },
  draft: { label: 'Draft', pill: 'p-neutral' },
};

export type RequestStatus = 'open' | 'in-progress' | 'resolved' | 'closed';

export const REQUEST_STATUS: Record<RequestStatus, PillStyle> = {
  open: { label: 'Open', pill: 'p-accent' },
  'in-progress': { label: 'In progress', pill: 'p-warning' },
  resolved: { label: 'Resolved', pill: 'p-success' },
  closed: { label: 'Closed', pill: 'p-neutral' },
};

export type ProposalStatus =
  'draft' | 'in-review' | 'changes-requested' | 'approved' | 'accepted' | 'closed';

export const PROPOSAL_STATUS: Record<ProposalStatus, PillStyle> = {
  draft: { label: 'Draft', pill: 'p-neutral' },
  'in-review': { label: 'In review', pill: 'p-accent' },
  'changes-requested': { label: 'Changes requested', pill: 'p-warning' },
  approved: { label: 'Approved', pill: 'p-success' },
  accepted: { label: 'Accepted', pill: 'p-solid' },
  closed: { label: 'Closed', pill: 'p-neutral' },
};

export type ChecksState = 'passing' | 'failing' | 'running';

export const CHECKS_STATE: Record<ChecksState, PillStyle & { glyph: string }> = {
  passing: { label: 'Passing', pill: 'p-success', glyph: 'ok' },
  failing: { label: 'Failing', pill: 'p-danger', glyph: 'bad' },
  running: { label: 'Running', pill: 'p-accent p-running', glyph: 'run' },
};

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
