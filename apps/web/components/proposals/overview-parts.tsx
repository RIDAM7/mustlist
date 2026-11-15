'use client';

import type { TimelineStep } from '@/lib/community';
import { formatShortDate } from '@/lib/format';
import { Timeline } from './bits';
import { nowIso, useProposalState } from './proposal-state';

/** The proposal timeline, plus anything approved or accepted in this browser. */
export function LiveTimeline() {
  const { proposal, accepted, localApprover, approvals } = useProposalState();
  const today = formatShortDate(nowIso());
  const steps: TimelineStep[] = [...proposal.timeline];
  const pendingIndex = steps.findIndex(
    (step) => step.state === 'next' && step.label === 'Accepted',
  );

  const locallyApproved =
    localApprover !== null &&
    approvals.some((a) => a.handle === localApprover && a.state === 'approved') &&
    !proposal.approvals.some((a) => a.handle === localApprover && a.state === 'approved');

  if (locallyApproved && localApprover) {
    const step: TimelineStep = {
      label: 'Approved',
      meta: `@${localApprover} · ${today}`,
      state: 'done',
    };
    if (pendingIndex >= 0) steps.splice(pendingIndex, 0, step);
    else steps.push(step);
  }
  if (accepted && proposal.status !== 'accepted') {
    const index = steps.findIndex((step) => step.state === 'next' && step.label === 'Accepted');
    const step: TimelineStep = {
      label: 'Accepted',
      meta: `@${localApprover ?? 'maintainer'} · ${today}`,
      state: 'done',
    };
    if (index >= 0) steps[index] = step;
    else steps.push(step);
  }
  return <Timeline steps={steps} />;
}
