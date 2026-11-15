'use client';

import Link from 'next/link';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { SelectMenu } from './overlay';

export interface StackCardRow {
  id: string;
  topic: string;
  title: string;
  pill: string;
  status: string;
  statusRank: number;
  version: string;
  verified: string | null;
  verifiedLabel: string;
}

type Sort = 'topic' | 'status' | 'verified';

/** The stack's cards as a sortable table (design board 12). */
export function StackCards({ rows }: { rows: StackCardRow[] }) {
  const [sort, setSort] = useState<Sort>('topic');
  const sorted = [...rows].sort((a, b) =>
    sort === 'topic'
      ? a.topic.localeCompare(b.topic)
      : sort === 'status'
        ? a.statusRank - b.statusRank || a.topic.localeCompare(b.topic)
        : (b.verified ?? '').localeCompare(a.verified ?? ''),
  );
  return (
    <section className="mt-10">
      <div className="mb-3 flex items-center justify-between gap-4">
        <div className="flex items-baseline gap-2">
          <h2 className="sec-h text-[18px]">Cards</h2>
          <span className="count">{rows.length}</span>
        </div>
        <SelectMenu
          label="Sort"
          value={sort}
          onChange={setSort}
          align="right"
          options={[
            { value: 'topic', label: 'Topic' },
            { value: 'status', label: 'Status' },
            { value: 'verified', label: 'Last verified' },
          ]}
        />
      </div>
      <div className="rows">
        <div className="row t-xs subtle hidden min-h-9 bg-bg-subtle font-medium md:flex">
          <span className="w-40">Topic</span>
          <span className="flex-1">Card</span>
          <span className="w-[150px]">Status</span>
          <span className="w-20">Version</span>
          <span className="w-[120px] text-right">Last verified</span>
        </div>
        {sorted.map((row) => (
          <Link
            key={row.id}
            href={`/${row.id}`}
            className="row max-md:flex-wrap max-md:gap-x-3 max-md:gap-y-1"
          >
            <span className="w-40 font-medium max-md:w-auto max-md:flex-1">{row.topic}</span>
            <span className="muted min-w-0 flex-1 max-md:order-3 max-md:basis-full max-md:text-[13px]">
              {row.title}
            </span>
            <span className="w-[150px] max-md:w-auto">
              <span className={cn('pill', row.pill)}>{row.status}</span>
            </span>
            <span className="mono subtle w-20 max-md:hidden">v{row.version}</span>
            <span className="t-sm subtle w-[120px] text-right max-md:hidden">
              {row.verifiedLabel}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
