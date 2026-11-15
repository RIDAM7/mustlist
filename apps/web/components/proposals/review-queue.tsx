'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Avatar, EmptyState } from '@/components/ui';
import { useViewer } from '@/components/viewer';
import {
  approvalCount,
  queueReason,
  reviewQueue,
  type Person,
  type ProposalSummary,
  type Review,
} from '@/lib/community';
import { githubLinks } from '@/lib/community/links';
import { relativeTime } from '@/lib/format';
import { PROPOSAL_STATUS, PROPOSAL_TYPE, isOpenProposal } from '@/lib/status';
import { topicName } from '@/lib/topics';
import { cn } from '@/lib/utils';
import { ChecksMeta } from './bits';

type Tab = 'waiting' | 'reviewed' | 'open';

/** A proposal in the queue, with who reviewed it and how. */
export type QueueItem = ProposalSummary & {
  reviews: { author: string; verdict: Review['verdict'] }[];
};

/** "2 days ago" -> "2 days"; "Yesterday" -> "1 day". */
function waitingFor(date: string, now: string): string {
  const label = relativeTime(date, new Date(now));
  return label === 'Yesterday' ? '1 day' : label.replace(/ ago$/, '');
}

export function ReviewQueue({
  proposals,
  people,
  now,
}: {
  proposals: QueueItem[];
  people: Person[];
  now: string;
}) {
  const { mode, viewer, requireViewer } = useViewer();
  const [tab, setTab] = useState<Tab>('waiting');
  const [topic, setTopic] = useState('All');

  if (!viewer && mode === 'github') {
    return (
      <>
        <h1 className="t-h2 text-[28px] leading-9">Review queue</h1>
        <EmptyState
          icon="queue"
          title="Your queue is on GitHub"
          line="Pull requests that ask for your review. Sign-in here comes next."
          className="mt-6"
        >
          <a
            href={githubLinks.reviewRequested}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary btn-sm"
          >
            Open on GitHub
          </a>
        </EmptyState>
      </>
    );
  }

  if (!viewer) {
    return (
      <>
        <h1 className="t-h2 text-[28px] leading-9">Review queue</h1>
        <EmptyState icon="user" title="Sign in to see your queue" className="mt-6">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => requireViewer('see your queue')}
          >
            Sign in
          </button>
        </EmptyState>
      </>
    );
  }

  const waiting = reviewQueue(people, proposals, viewer.handle);
  const reviewed = proposals.filter((p) => p.reviews.some((r) => r.author === viewer.handle));
  const open = proposals.filter((p) => isOpenProposal(p.status));
  const lists: Record<Tab, QueueItem[]> = { waiting, reviewed, open };
  const current = lists[tab];
  const topics = ['All', ...new Set(current.map((p) => p.topic))];
  const activeTopic = topics.includes(topic) ? topic : 'All';
  const rows = current.filter((p) => activeTopic === 'All' || p.topic === activeTopic);

  const reason = (p: QueueItem) => {
    if (tab === 'waiting') return queueReason(people, p, viewer.handle);
    if (tab === 'reviewed') {
      const own = [...p.reviews].reverse().find((r) => r.author === viewer.handle);
      return own?.verdict === 'approved'
        ? 'You approved'
        : own?.verdict === 'changes'
          ? 'You requested changes'
          : 'You commented';
    }
    return `${approvalCount(p)} of 2 approvals`;
  };

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'waiting', label: 'Waiting for you', count: waiting.length },
    { id: 'reviewed', label: 'Reviewed by you' },
    { id: 'open', label: 'All open' },
  ];

  const yourTopics = viewer.topics.map(topicName);
  if (viewer.role === 'maintainer') yourTopics.push('all topics as maintainer');

  return (
    <>
      <div className="flex items-baseline gap-3">
        <h1 className="t-h2 text-[28px] leading-9">Review queue</h1>
        <span className="count">{waiting.length}</span>
      </div>
      <div className="tabs mt-5" role="tablist" aria-label="Queue">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={item.id === tab}
            className={cn('tab', item.id === tab && 'tab-on')}
            onClick={() => setTab(item.id)}
          >
            {item.label}
            {item.count !== undefined && <span className="count">{item.count}</span>}
          </button>
        ))}
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <span className="t-sm subtle mr-1">Topic</span>
        {topics.map((t) => (
          <button
            key={t}
            type="button"
            className={cn('btn btn-sm h-8', t === activeTopic ? 'btn-pressed' : 'btn-secondary')}
            aria-pressed={t === activeTopic}
            onClick={() => setTopic(t)}
          >
            {t === 'All' ? 'All' : topicName(t)}
          </button>
        ))}
      </div>
      {rows.length > 0 ? (
        <div className="rows mt-4">
          {rows.map((p) => {
            const status = PROPOSAL_STATUS[p.status];
            return (
              <Link
                key={p.number}
                href={`/proposals/${p.number}`}
                className="row min-h-[72px] flex-wrap md:flex-nowrap"
              >
                <Avatar handle={p.author} size="md" />
                <div className="min-w-0 flex-1">
                  <div className="row-title text-[15px]">{p.title}</div>
                  <div className="t-sm subtle mt-0.5 flex flex-wrap items-center gap-1">
                    #{p.number} · @{p.author} ·{' '}
                    <span className="tag h-5">{PROPOSAL_TYPE[p.type]}</span>
                  </div>
                </div>
                <div className="t-sm w-full pl-12 md:w-[220px] md:pl-0">
                  <div className="font-medium">{reason(p)}</div>
                  <div className="t-xs subtle">waiting {waitingFor(p.updated, now)}</div>
                </div>
                <ChecksMeta state={p.checks} className="hidden w-[88px] md:inline-flex" />
                <span className="t-sm hidden w-14 md:block">{approvalCount(p)} of 2</span>
                <span className="hidden w-[140px] justify-end md:flex">
                  <span className={cn('pill', status.pill)}>{status.label}</span>
                </span>
              </Link>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon="checkCircle"
          title={tab === 'waiting' ? 'Nothing waiting for you' : 'Nothing here'}
          line={activeTopic === 'All' ? 'Review queue' : 'in this topic'}
          className="mt-4"
        >
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setTab('open')}>
            All open proposals
          </button>
        </EmptyState>
      )}
      {yourTopics.length > 0 && (
        <p className="t-xs subtle mt-4">Your topics: {yourTopics.join(' · ')}</p>
      )}
    </>
  );
}
