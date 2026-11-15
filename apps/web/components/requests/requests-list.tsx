'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { REQUEST_STATUS, type RequestStatus } from '@/lib/status';
import { cn } from '@/lib/utils';
import { RelativeTime } from '../client-bits';
import { Icon } from '../icons';
import { SelectMenu } from '../overlay';
import { EmptyState, KeyHint, NeedBox, Pill } from '../ui';

export interface RequestRow {
  number: number;
  title: string;
  topic: string;
  topicLabel: string;
  stack: string;
  stackLabel: string;
  author: string;
  created: string;
  updated: string;
  status: RequestStatus;
  need: number;
  replies: number;
  proposals: string;
}

type Tab = 'All' | RequestStatus;
const TABS: { id: Tab; label: string }[] = [
  { id: 'open', label: 'Open' },
  { id: 'in-progress', label: 'In progress' },
  { id: 'resolved', label: 'Resolved' },
  { id: 'closed', label: 'Closed' },
  { id: 'All', label: 'All' },
];

type Sort = 'wanted' | 'newest' | 'active';
const SORTS: { value: Sort; label: string }[] = [
  { value: 'wanted', label: 'Most wanted' },
  { value: 'newest', label: 'Newest' },
  { value: 'active', label: 'Active' },
];

/** All open spots, ranked by need (design board 20). J/K move, Enter opens, N new request. */
export function RequestsList({
  rows,
  now,
  notSetUp = false,
  setUpHref,
}: {
  rows: RequestRow[];
  now: string;
  /** GitHub mode, but the repository has no "Requests" discussion category yet. */
  notSetUp?: boolean;
  setUpHref?: string;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('All');
  const [topic, setTopic] = useState('any');
  const [stack, setStack] = useState('any');
  const [sort, setSort] = useState<Sort>('wanted');
  const [cursor, setCursor] = useState(-1);

  const topics = useMemo(
    () =>
      [...new Map(rows.map((r) => [r.topic, r.topicLabel]))].sort((a, b) =>
        a[1].localeCompare(b[1]),
      ),
    [rows],
  );
  const stacks = useMemo(
    () =>
      [...new Map(rows.map((r) => [r.stack, r.stackLabel]))].sort((a, b) =>
        a[1].localeCompare(b[1]),
      ),
    [rows],
  );

  const filtered = rows.filter(
    (r) => (topic === 'any' || r.topic === topic) && (stack === 'any' || r.stack === stack),
  );
  const shown = filtered
    .filter((r) => tab === 'All' || r.status === tab)
    .sort((a, b) =>
      sort === 'wanted'
        ? b.need - a.need
        : sort === 'newest'
          ? b.created.localeCompare(a.created)
          : b.updated.localeCompare(a.updated),
    );
  const count = (id: Tab) => filtered.filter((r) => id === 'All' || r.status === id).length;
  const active = Math.min(cursor, shown.length - 1);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (
        target.closest('input, textarea, [role="dialog"], [role="menu"]') ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey
      ) {
        return;
      }
      if (event.key === 'j') setCursor((c) => Math.min(c + 1, shown.length - 1));
      else if (event.key === 'k') setCursor((c) => Math.max(c - 1, 0));
      else if (event.key === 'Enter' && active >= 0 && shown[active])
        router.push(`/requests/${shown[active].number}`);
      else if (event.key === 'n') router.push('/requests/new');
      else return;
      event.preventDefault();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [shown, active, router]);

  const clear = () => {
    setTab('All');
    setTopic('any');
    setStack('any');
  };

  const emptyTitle =
    tab === 'All'
      ? 'No requests match'
      : `No ${TABS.find((t) => t.id === tab)?.label.toLowerCase()} requests`;

  return (
    <>
      <div className={cn('mt-6 flex flex-wrap items-center gap-2', rows.length === 0 && 'hidden')}>
        <div className="seg" role="tablist" aria-label="Status">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={t.id === tab}
              className={cn('seg-b', t.id === tab && 'seg-on')}
              onClick={() => {
                setTab(t.id);
                setCursor(-1);
              }}
            >
              {t.label} <span className="subtle font-normal">{count(t.id)}</span>
            </button>
          ))}
        </div>
        <SelectMenu
          label="Topic"
          value={topic}
          onChange={setTopic}
          options={[
            { value: 'any', label: 'Any' },
            ...topics.map(([value, label]) => ({ value, label })),
          ]}
        />
        <SelectMenu
          label="Stack"
          value={stack}
          onChange={setStack}
          options={[
            { value: 'any', label: 'Any' },
            ...stacks.map(([value, label]) => ({ value, label })),
          ]}
        />
        <div className="hidden flex-1 md:block" />
        <SelectMenu
          label="Sort"
          value={sort}
          onChange={setSort}
          align="right"
          icon={<Icon name="sort" size="sm" />}
          options={SORTS}
        />
      </div>

      {shown.length > 0 ? (
        <>
          <div className="rows mt-4" role="list">
            {shown.map((r, index) => {
              const pill = REQUEST_STATUS[r.status];
              return (
                <Link
                  key={r.number}
                  href={`/requests/${r.number}`}
                  role="listitem"
                  className={cn('row min-h-[68px]', index === active && 'row-sel')}
                >
                  <NeedBox need={r.need} />
                  <div className="min-w-0 flex-1">
                    <div className="row-title text-[15px]">{r.title}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <Pill {...pill} className="sm:hidden" />
                      <span className="tag tag-topic">{r.topicLabel}</span>
                      <span className="tag">{r.stackLabel}</span>
                      <span className="t-sm subtle ml-1 max-md:hidden">
                        #{r.number} · @{r.author} · <RelativeTime date={r.created} now={now} />
                      </span>
                    </div>
                  </div>
                  <span className="meta w-12 max-md:hidden" aria-label={`${r.replies} replies`}>
                    <Icon name="comment" size="sm" />
                    {r.replies}
                  </span>
                  <span className="meta w-24 max-md:hidden">{r.proposals}</span>
                  <span className="flex justify-end max-sm:hidden md:w-[108px]">
                    <Pill {...pill} />
                  </span>
                </Link>
              );
            })}
          </div>
          <div className="t-xs subtle mt-3 hidden items-center gap-4 md:flex">
            <KeyHint keys={['J', 'K']} label="move" />
            <KeyHint keys={['Enter']} label="open" />
            <KeyHint keys={['N']} label="new request" />
          </div>
        </>
      ) : rows.length === 0 ? (
        <EmptyState
          icon="inbox"
          title={notSetUp ? 'Requests are not open yet' : 'No requests yet'}
          line={
            notSetUp
              ? 'They start once the repository has a "Requests" discussion category.'
              : 'Ask for the first card.'
          }
          className="mt-4"
        >
          {notSetUp && setUpHref ? (
            <a
              href={setUpHref}
              className="btn btn-secondary"
              target="_blank"
              rel="noopener noreferrer"
            >
              Discussions on GitHub
            </a>
          ) : (
            <Link href="/requests/new" className="btn btn-secondary">
              New request
            </Link>
          )}
        </EmptyState>
      ) : (
        <EmptyState
          icon="inbox"
          title={emptyTitle}
          line="Nothing matches these filters."
          className="mt-4"
        >
          <button type="button" className="btn btn-secondary" onClick={clear}>
            Clear filters
          </button>
          <Link href="/requests/new" className="btn btn-ghost">
            New request
          </Link>
        </EmptyState>
      )}
    </>
  );
}
