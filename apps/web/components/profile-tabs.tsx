'use client';

import Link from 'next/link';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Icon, type IconName } from './icons';
import { EmptyState } from './ui';

interface FeedItem {
  key: string;
  icon: IconName;
  verb: string;
  title: string;
  href: string;
  pill?: { pill: string; label: string };
  when: string;
}

interface CardItem {
  id: string;
  title: string;
  stack: string;
  pill: string;
  status: string;
}

interface ProposalItem {
  number: number;
  title: string;
  pill: string;
  status: string;
}

interface ReviewItem {
  key: string;
  number: number;
  title: string;
  verdict: 'approved' | 'changes' | 'comment';
  when: string;
}

const VERDICT = {
  approved: { label: 'Approved', pill: 'p-success' },
  changes: { label: 'Changes requested', pill: 'p-warning' },
  comment: { label: 'Comment', pill: 'p-outline' },
} as const;

type Tab = 'activity' | 'cards' | 'proposals' | 'reviews';

/** Activity · Cards · Proposals · Reviews, with "Cards authored" alongside. */
export function ProfileTabs({
  feed,
  cards,
  proposals,
  reviews,
}: {
  feed: FeedItem[];
  cards: CardItem[];
  proposals: ProposalItem[];
  reviews: ReviewItem[];
}) {
  const [tab, setTab] = useState<Tab>('activity');
  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'activity', label: 'Activity' },
    { id: 'cards', label: 'Cards', count: cards.length },
    { id: 'proposals', label: 'Proposals', count: proposals.length },
    { id: 'reviews', label: 'Reviews', count: reviews.length },
  ];

  const row = (key: string, icon: IconName, content: React.ReactNode, right: React.ReactNode) => (
    <li
      key={key}
      className="grid min-h-14 grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-3 border-b py-2"
    >
      <span className="flex h-7 w-7 items-center justify-center rounded-md bg-bg-muted text-fg-muted">
        <Icon name={icon} size="sm" />
      </span>
      <div className="t-sm min-w-0">{content}</div>
      <span className="flex items-center gap-3">{right}</span>
    </li>
  );

  return (
    <>
      <div className="tabs mt-10" role="tablist" aria-label="Profile">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={t.id === tab}
            className={cn('tab', t.id === tab && 'tab-on')}
            onClick={() => setTab(t.id)}
          >
            {t.label}
            {t.count !== undefined && <span className="count">{t.count}</span>}
          </button>
        ))}
      </div>
      <div className="mt-6 flex flex-wrap gap-14 max-md:gap-10">
        <div className="min-w-0 max-w-[760px] flex-[999_1_560px]" role="tabpanel">
          {tab === 'activity' &&
            (feed.length ? (
              <ol>
                {feed.map((item) =>
                  row(
                    item.key,
                    item.icon,
                    <>
                      <span className="muted">{item.verb}</span>{' '}
                      <Link href={item.href} className="font-medium hover:underline">
                        {item.title}
                      </Link>
                    </>,
                    <>
                      {item.pill && (
                        <span className={cn('pill max-md:hidden', item.pill.pill)}>
                          {item.pill.label}
                        </span>
                      )}
                      <span className="t-xs subtle w-12 text-right">{item.when}</span>
                    </>,
                  ),
                )}
              </ol>
            ) : (
              <EmptyState icon="clock" title="No activity yet" />
            ))}
          {tab === 'cards' &&
            (cards.length ? (
              <ol>
                {cards.map((card) =>
                  row(
                    card.id,
                    'file',
                    <Link href={`/${card.id}`} className="font-medium hover:underline">
                      {card.title} <span className="subtle font-normal">· {card.stack}</span>
                    </Link>,
                    <span className={cn('pill', card.pill)}>{card.status}</span>,
                  ),
                )}
              </ol>
            ) : (
              <EmptyState icon="file" title="No cards yet" />
            ))}
          {tab === 'proposals' &&
            (proposals.length ? (
              <ol>
                {proposals.map((p) =>
                  row(
                    String(p.number),
                    'pencil',
                    <Link href={`/proposals/${p.number}`} className="font-medium hover:underline">
                      #{p.number} {p.title}
                    </Link>,
                    <span className={cn('pill', p.pill)}>{p.status}</span>,
                  ),
                )}
              </ol>
            ) : (
              <EmptyState icon="pencil" title="No proposals yet" />
            ))}
          {tab === 'reviews' &&
            (reviews.length ? (
              <ol>
                {reviews.map((r) =>
                  row(
                    r.key,
                    r.verdict === 'approved'
                      ? 'check'
                      : r.verdict === 'changes'
                        ? 'alertCircle'
                        : 'comment',
                    <Link
                      href={`/proposals/${r.number}/reviews`}
                      className="font-medium hover:underline"
                    >
                      #{r.number} {r.title}
                    </Link>,
                    <>
                      <span className={cn('pill max-md:hidden', VERDICT[r.verdict].pill)}>
                        {VERDICT[r.verdict].label}
                      </span>
                      <span className="t-xs subtle w-12 text-right">{r.when}</span>
                    </>,
                  ),
                )}
              </ol>
            ) : (
              <EmptyState icon="comment" title="No reviews yet" />
            ))}
        </div>
        <aside className="flex-[1_1_280px]">
          <div className="label mb-3">Cards authored</div>
          {cards.length ? (
            <div className="flex flex-col gap-2">
              {cards.map((card) => (
                <Link key={card.id} href={`/${card.id}`} className="tile px-3.5 py-3">
                  <div className="t-sm font-medium">{card.title}</div>
                  <div className="mt-1 flex justify-between">
                    <span className="t-xs subtle">{card.stack}</span>
                    <span className={cn('pill', card.pill)}>{card.status}</span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="t-sm subtle">None yet</p>
          )}
        </aside>
      </div>
    </>
  );
}
