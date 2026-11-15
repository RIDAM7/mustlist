'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { RelativeTime } from '@/components/client-bits';
import { SelectMenu } from '@/components/overlay';
import { Avatar, EmptyState } from '@/components/ui';
import { approvalCount, communityNow, listProposals, type Proposal } from '@/lib/community';
import {
  PROPOSAL_STATUS,
  PROPOSAL_TYPE,
  isOpenProposal,
  type ProposalStatus,
  type ProposalType,
} from '@/lib/status';
import { topicName } from '@/lib/topics';
import { cn } from '@/lib/utils';
import { ApprovalBar, ChecksMeta } from './bits';

type Tab = 'Open' | 'In review' | 'Approved' | 'Accepted' | 'All';
const TABS: Tab[] = ['Open', 'In review', 'Approved', 'Accepted', 'All'];
const TAB_STATUS: Partial<Record<Tab, ProposalStatus>> = {
  'In review': 'in-review',
  Approved: 'approved',
  Accepted: 'accepted',
};

type Sort = 'updated' | 'newest';

function inTab(proposal: Proposal, tab: Tab): boolean {
  if (tab === 'All') return true;
  if (tab === 'Open') return isOpenProposal(proposal.status);
  return proposal.status === TAB_STATUS[tab];
}

export function ProposalsList() {
  const all = listProposals();
  const now = communityNow().toISOString();
  const [tab, setTab] = useState<Tab>('Open');
  const [type, setType] = useState<ProposalType | 'all'>('all');
  const [topic, setTopic] = useState<string>('any');
  const [sort, setSort] = useState<Sort>('updated');

  const topics = useMemo(() => [...new Set(all.map((p) => p.topic))].sort(), [all]);
  const matchesFilters = (p: Proposal) =>
    (type === 'all' || p.type === type) && (topic === 'any' || p.topic === topic);

  const rows = all
    .filter((p) => inTab(p, tab) && matchesFilters(p))
    .sort((a, b) =>
      sort === 'updated' ? b.updated.localeCompare(a.updated) : b.opened.localeCompare(a.opened),
    );

  const filtered = type !== 'all' || topic !== 'any' || tab !== 'All';
  const filterLine = [
    `Status: ${tab}`,
    type !== 'all' ? `Type: ${PROPOSAL_TYPE[type]}` : '',
    topic !== 'any' ? `Topic: ${topicName(topic)}` : '',
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <>
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <div className="seg" role="tablist" aria-label="Status">
          {TABS.map((item) => (
            <button
              key={item}
              type="button"
              role="tab"
              aria-selected={item === tab}
              className={cn('seg-b', item === tab && 'seg-on')}
              onClick={() => setTab(item)}
            >
              {item}{' '}
              <span className="subtle font-normal">
                {all.filter((p) => inTab(p, item) && matchesFilters(p)).length}
              </span>
            </button>
          ))}
        </div>
        <SelectMenu
          label="Type"
          value={type}
          onChange={setType}
          options={[
            { value: 'all', label: 'All' },
            ...(Object.keys(PROPOSAL_TYPE) as ProposalType[]).map((value) => ({
              value,
              label: PROPOSAL_TYPE[value],
            })),
          ]}
        />
        <SelectMenu
          label="Topic"
          value={topic}
          onChange={setTopic}
          options={[
            { value: 'any', label: 'Any' },
            ...topics.map((t) => ({ value: t, label: topicName(t) })),
          ]}
        />
        <div className="hidden flex-1 md:block" />
        <SelectMenu
          label="Sort"
          value={sort}
          onChange={setSort}
          align="right"
          options={[
            { value: 'updated', label: 'Recently updated' },
            { value: 'newest', label: 'Newest' },
          ]}
        />
      </div>

      {rows.length === 0 ? (
        <EmptyState icon="pencil" title="No proposals match" line={filterLine} className="mt-4">
          {filtered && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setTab('All');
                setType('all');
                setTopic('any');
              }}
            >
              Clear filters
            </button>
          )}
          <Link href="/propose" className="btn btn-ghost btn-sm">
            New proposal
          </Link>
        </EmptyState>
      ) : (
        <div className="rows mt-4">
          <div className="row t-xs subtle hidden min-h-9 bg-bg-subtle font-medium md:flex">
            <span className="w-[116px]">Type</span>
            <span className="flex-1">Proposal</span>
            <span className="w-[100px]">Checks</span>
            <span className="w-[92px]">Approvals</span>
            <span className="w-[150px] text-right">Status</span>
          </div>
          {rows.map((p) => {
            const status = PROPOSAL_STATUS[p.status];
            const approvals = approvalCount(p);
            return (
              <Link
                key={p.number}
                href={`/proposals/${p.number}`}
                className="row min-h-16 items-start md:items-center"
              >
                <span className="hidden w-[116px] md:block">
                  <span className="tag">{PROPOSAL_TYPE[p.type]}</span>
                </span>
                <div className="min-w-0 flex-1">
                  <div className="row-title text-[15px]">{p.title}</div>
                  <div className="t-sm subtle mt-0.5 flex flex-wrap items-center gap-1.5">
                    <Avatar handle={p.author} size="sm" />#{p.number} · @{p.author} ·{' '}
                    <RelativeTime date={p.updated} now={now} />
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-3 md:hidden">
                    <span className={cn('pill', status.pill)}>{status.label}</span>
                    <ChecksMeta state={p.checks} />
                    <span className="t-sm subtle">{approvals} of 2</span>
                  </div>
                </div>
                <ChecksMeta state={p.checks} className="hidden w-[100px] md:inline-flex" />
                <span className="hidden w-[92px] flex-col gap-1 md:flex">
                  <span className="t-sm">{approvals} of 2</span>
                  <ApprovalBar count={approvals} className="w-14" />
                </span>
                <span className="hidden w-[150px] justify-end md:flex">
                  <span className={cn('pill', status.pill)}>{status.label}</span>
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
