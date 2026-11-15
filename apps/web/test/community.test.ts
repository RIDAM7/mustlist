import { describe, expect, it } from 'vitest';
import {
  canAccept,
  countComments,
  getPerson,
  getProposal,
  getRequest,
  mostWanted,
  requestProposalMeta,
  reviewQueue,
} from '@/lib/community';

describe('community rules', () => {
  it('needs passing checks and 2 approvals, 1 from a maintainer, to accept', () => {
    const proposal = getProposal(17);
    expect(proposal).toBeDefined();
    if (!proposal) return;
    expect(canAccept(proposal)).toBe(false);
    const approved = {
      ...proposal,
      approvals: proposal.approvals.map((a) => ({ ...a, state: 'approved' as const })),
    };
    expect(canAccept(approved)).toBe(true);
    expect(canAccept({ ...approved, checks: 'failing' })).toBe(false);
  });

  it('does not accept two approvals without a maintainer', () => {
    const proposal = getProposal(19);
    expect(proposal && canAccept(proposal)).toBe(false);
  });

  it('ranks most wanted by need and skips re-checks', () => {
    const needs = mostWanted(10).map((r) => r.need);
    expect(needs).toEqual([...needs].sort((a, b) => b - a));
    expect(mostWanted(10).some((r) => r.title.startsWith('Re-check'))).toBe(false);
  });

  it('counts comments with their replies', () => {
    const request = getRequest(42);
    expect(request && countComments(request.comments)).toBe(9);
    expect(request && requestProposalMeta(request)).toBe('No proposal');
  });

  it('never queues your own proposals or ones you approved', () => {
    const queue = reviewQueue('maya-k').map((p) => p.number);
    expect(queue).not.toContain(16);
    expect(queue).not.toContain(17);
  });

  it('turns unknown handles into contributors', () => {
    expect(getPerson('someone-new').role).toBe('contributor');
  });
});
