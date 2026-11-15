'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import {
  communityNow,
  getPerson,
  getProposal,
  type Approval,
  type Comment,
  type Proposal,
  type Review,
} from '@/lib/community';
import type { ProposalStatus } from '@/lib/status';

/**
 * Local, in-browser state for one proposal: approvals, accept, new reviews and
 * field comments. Nothing is saved (sample mode); build steps B and D send these
 * to GitHub instead.
 */

interface ProposalState {
  proposal: Proposal;
  status: ProposalStatus;
  approvals: Approval[];
  approvedCount: number;
  maintainerApproved: boolean;
  acceptable: boolean;
  accepted: boolean;
  /** Handle that accepted (or approved) locally, for timeline entries. */
  localApprover: string | null;
  localReviews: Review[];
  fieldComments: Record<string, Comment[]>;
  approve: (handle: string) => void;
  accept: (handle: string) => void;
  requestChanges: () => void;
  addReview: (review: Review) => void;
  addFieldComment: (field: string, comment: Comment) => void;
  /** Count shown on the Reviews tab. */
  reviewCount: number;
}

const Context = createContext<ProposalState | null>(null);

export function useProposalState(): ProposalState {
  const value = useContext(Context);
  if (!value) throw new Error('useProposalState needs <ProposalStateProvider>');
  return value;
}

export const nowIso = () => communityNow().toISOString();

function mustGetProposal(number: number): Proposal {
  const proposal = getProposal(number);
  if (!proposal) throw new Error(`Unknown proposal #${number}`);
  return proposal;
}

export function ProposalStateProvider({
  number,
  children,
}: {
  number: number;
  children: ReactNode;
}) {
  const proposal = mustGetProposal(number);
  const [status, setStatus] = useState<ProposalStatus>(proposal.status);
  const [approvals, setApprovals] = useState<Approval[]>(proposal.approvals);
  const [localApprover, setLocalApprover] = useState<string | null>(null);
  const [localReviews, setLocalReviews] = useState<Review[]>([]);
  const [fieldComments, setFieldComments] = useState<Record<string, Comment[]>>({});

  const approve = useCallback((handle: string) => {
    setApprovals((current) => {
      const others = current.filter((a) => a.handle !== handle);
      return [...others, { handle, state: 'approved' }];
    });
    setLocalApprover(handle);
  }, []);

  const accept = useCallback((handle: string) => {
    setStatus('accepted');
    setLocalApprover(handle);
  }, []);

  const requestChanges = useCallback(() => setStatus('changes-requested'), []);

  const addReview = useCallback((review: Review) => {
    setLocalReviews((current) => [review, ...current]);
  }, []);

  const addFieldComment = useCallback((field: string, comment: Comment) => {
    setFieldComments((current) => ({ ...current, [field]: [...(current[field] ?? []), comment] }));
  }, []);

  const value = useMemo<ProposalState>(() => {
    const approved = approvals.filter((a) => a.state === 'approved');
    const maintainerApproved = approved.some((a) => getPerson(a.handle).role === 'maintainer');
    const reviews = [...localReviews, ...proposal.reviews];
    const reviewCount = reviews.reduce((sum, r) => sum + 1 + (r.replies?.length ?? 0), 0);
    return {
      proposal,
      status,
      approvals,
      approvedCount: approved.length,
      maintainerApproved,
      acceptable:
        proposal.checks === 'passing' &&
        approved.length >= 2 &&
        maintainerApproved &&
        status !== 'accepted' &&
        status !== 'closed',
      accepted: status === 'accepted',
      localApprover,
      localReviews,
      fieldComments,
      approve,
      accept,
      requestChanges,
      addReview,
      addFieldComment,
      reviewCount,
    };
  }, [
    proposal,
    status,
    approvals,
    localApprover,
    localReviews,
    fieldComments,
    approve,
    accept,
    requestChanges,
    addReview,
    addFieldComment,
  ]);

  return <Context.Provider value={value}>{children}</Context.Provider>;
}
