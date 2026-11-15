'use client';

import Link from 'next/link';
import { useState } from 'react';
import { cn } from '@/lib/utils';

export interface StackTile {
  slug: string;
  name: string;
  parts: { k: string; v: string }[];
  cards: number;
  verified: number;
  requested: number;
  hasCards: boolean;
  href: string;
}

type Group = 'All' | 'Framework' | 'Data store' | 'Infra';
const GROUPS: Group[] = ['All', 'Framework', 'Data store', 'Infra'];

/** Stack tiles with "Group by" (design board 11). */
export function StacksGrid({ tiles, sample }: { tiles: StackTile[]; sample: boolean }) {
  const [group, setGroup] = useState<Group>('All');

  const sections: [string, StackTile[]][] =
    group === 'All'
      ? [['', tiles]]
      : [
          ...new Map(
            tiles.map((tile) => [
              tile.parts.find((p) => p.k === group)?.v ?? `No ${group.toLowerCase()}`,
              [] as StackTile[],
            ]),
          ).keys(),
        ]
          .sort(
            (a, b) =>
              Number(a.startsWith('No ')) - Number(b.startsWith('No ')) || a.localeCompare(b),
          )
          .map((key) => [
            key,
            tiles.filter(
              (tile) =>
                (tile.parts.find((p) => p.k === group)?.v ?? `No ${group.toLowerCase()}`) === key,
            ),
          ]);

  return (
    <>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-6">
        <h1 className="t-h1 max-md:text-[30px] max-md:leading-9">Stacks</h1>
        <div className="seg" role="radiogroup" aria-label="Group by">
          {GROUPS.map((g) => (
            <button
              key={g}
              type="button"
              role="radio"
              aria-checked={g === group}
              className={cn('seg-b', g === group && 'seg-on')}
              onClick={() => setGroup(g)}
            >
              {g}
            </button>
          ))}
        </div>
      </div>
      {sections.map(([label, list]) => (
        <section key={label || 'all'} className="mt-8">
          {label && <h2 className="label mb-3">{label}</h2>}
          <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(min(340px,100%),1fr))]">
            {list.map((tile) => {
              const body = (
                <>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[17px] font-semibold">{tile.name}</span>
                    <span className="mono subtle text-xs">{tile.slug}</span>
                  </div>
                  <div className="t-sm flex flex-col gap-1">
                    {tile.parts.map((part) => (
                      <div key={part.k} className="flex gap-2">
                        <span className="subtle w-20 shrink-0">{part.k}</span>
                        <span>{part.v}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex-1" />
                  <div className="t-sm flex gap-4 border-t pt-3">
                    <span>
                      <span className="strong">{tile.cards}</span>{' '}
                      <span className="subtle">{tile.cards === 1 ? 'card' : 'cards'}</span>
                    </span>
                    {tile.verified > 0 && (
                      <span>
                        <span className="strong">{tile.verified}</span>{' '}
                        <span className="subtle">verified</span>
                      </span>
                    )}
                    <span title={sample ? 'Sample data' : undefined}>
                      <span className="strong">{tile.requested}</span>{' '}
                      <span className="subtle">requested</span>
                    </span>
                  </div>
                </>
              );
              return tile.hasCards ? (
                <Link
                  key={tile.slug}
                  href={tile.href}
                  className="tile flex min-h-[196px] flex-col gap-3.5 p-5"
                >
                  {body}
                </Link>
              ) : (
                <Link
                  key={tile.slug}
                  href={tile.href}
                  className="tile box-dash flex min-h-[196px] flex-col gap-3.5 bg-transparent p-5"
                >
                  {body}
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </>
  );
}
