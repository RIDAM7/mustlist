import { describe, expect, it } from 'vitest';
import {
  allHandles,
  canAccept,
  cardHistory,
  countComments,
  getPerson,
  getProposal,
  getRequest,
  mostWanted,
  requestProposalMeta,
  reviewQueue,
  toProposalSummary,
  toneFor,
} from '@/lib/community';
import { sampleCommunity } from '@/lib/community/sample';

const data = sampleCommunity('RIDAM7/mustlist');

describe('community rules', () => {
  it('needs passing checks and 2 approvals, 1 from a maintainer, to accept', () => {
    const proposal = getProposal(data, 17);
    expect(proposal).toBeDefined();
    if (!proposal) return;
    expect(canAccept(data.people, proposal)).toBe(false);
    const approved = {
      ...proposal,
      approvals: proposal.approvals.map((a) => ({ ...a, state: 'approved' as const })),
    };
    expect(canAccept(data.people, approved)).toBe(true);
    expect(canAccept(data.people, { ...approved, checks: 'failing' })).toBe(false);
  });

  it('does not accept two approvals without a maintainer', () => {
    const proposal = getProposal(data, 19);
    expect(proposal && canAccept(data.people, proposal)).toBe(false);
  });

  it('ranks most wanted by need and skips re-checks', () => {
    const needs = mostWanted(data, 10).map((r) => r.need);
    expect(needs).toEqual([...needs].sort((a, b) => b - a));
    expect(mostWanted(data, 10).some((r) => r.title.startsWith('Re-check'))).toBe(false);
  });

  it('counts comments with their replies', () => {
    const request = getRequest(data, 42);
    expect(request && countComments(request.comments)).toBe(9);
    expect(request && requestProposalMeta(data, request)).toBe('No proposal');
  });

  it('never queues your own proposals or ones you approved', () => {
    const queue = reviewQueue(data.people, data.proposals.map(toProposalSummary), 'maya-k');
    const numbers = queue.map((p) => p.number);
    expect(numbers).not.toContain(16);
    expect(numbers).not.toContain(17);
  });

  it('turns unknown handles into contributors with a stable colour', () => {
    expect(getPerson(data.people, 'someone-new').role).toBe('contributor');
    expect(toneFor('someone-new')).toBe(toneFor('someone-new'));
    expect(toneFor('maya-k')).toBe(4);
  });

  it('hides sample history on real draft cards', () => {
    expect(cardHistory(data, 'auth/nextjs-postgres', 'draft')).toEqual([]);
    expect(cardHistory(data, 'auth/nextjs-postgres', 'verified').map((p) => p.number)).toEqual([
      15,
    ]);
  });

  it('lists everyone who took part', () => {
    expect(allHandles(data)).toEqual(
      expect.arrayContaining(['RIDAM7', 'maya-k', 'tomas-r', 'lena-dev']),
    );
  });
});
