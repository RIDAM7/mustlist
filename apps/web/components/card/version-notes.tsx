'use client';

import { useSyncExternalStore } from 'react';
import semver from 'semver';
import { hostOf } from '@/lib/format';
import { LABEL_PILL } from '@/lib/status';
import { cn } from '@/lib/utils';
import { Icon } from '../icons';
import { Pill } from '../ui';

export interface VersionEntry {
  package: string;
  range: string;
  /** Sanitized inline HTML per note. */
  notes: string[];
  docs: string;
  context7?: string;
}

/**
 * Version notes with "Your versions" inputs. Typing a version highlights the
 * matching range. Versions are remembered in this browser, across cards.
 */
const KEY = 'mustlist-versions';
const listeners = new Set<() => void>();
let cache: { raw: string | null; value: Record<string, string> } = { raw: null, value: {} };

function read(): Record<string, string> {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    raw = null;
  }
  if (raw !== cache.raw) {
    try {
      cache = { raw, value: raw ? (JSON.parse(raw) as Record<string, string>) : {} };
    } catch {
      cache = { raw, value: {} };
    }
  }
  return cache.value;
}

const EMPTY: Record<string, string> = {};

function write(next: Record<string, string>) {
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    cache = { raw: JSON.stringify(next), value: next };
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function matches(version: string | undefined, range: string): boolean {
  if (!version) return false;
  const exact = semver.valid(version) ?? semver.coerce(version)?.version;
  return exact ? semver.satisfies(exact, range, { includePrerelease: true }) : false;
}

export function VersionNotes({ entries }: { entries: VersionEntry[] }) {
  const mine = useSyncExternalStore(subscribe, read, () => EMPTY);
  const packages = [...new Set(entries.map((entry) => entry.package))];

  const input = (pkg: string, big: boolean) => (
    <label key={pkg} className={cn('verinput', big ? 'h-11' : 'h-8')}>
      <span className={cn(big && 'px-3 text-[13px]')}>{big ? `Your ${pkg}` : pkg}</span>
      <input
        value={mine[pkg] ?? ''}
        onChange={(event) => write({ ...mine, [pkg]: event.target.value.trim() })}
        placeholder="16.0.3"
        inputMode="decimal"
        aria-label={`Your ${pkg} version`}
        className={cn(big ? 'flex-1 px-3 text-sm' : 'w-[72px]')}
      />
    </label>
  );

  return (
    <section id="versions" aria-labelledby="versions-h">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-4 max-md:mb-3">
        <h2 id="versions-h" className="sec-h max-md:text-[18px]">
          Version notes
        </h2>
        <div className="hidden flex-wrap items-center gap-2 md:flex">
          <span className="t-xs subtle">Your versions</span>
          {packages.map((pkg) => input(pkg, false))}
        </div>
      </div>
      <div className="mb-3 flex flex-col gap-2 md:hidden">
        {packages.map((pkg) => input(pkg, true))}
      </div>
      <div className="flex flex-col gap-3">
        {entries.map((entry) => {
          const on = matches(mine[entry.package], entry.range);
          return (
            <div
              key={`${entry.package}@${entry.range}`}
              className={cn('ver max-md:p-4', on && 'ver-on')}
            >
              <div className="mb-3 flex flex-wrap items-center gap-2.5">
                <span className="mono text-[13px] font-semibold">{entry.package}</span>
                <span className="mono text-[13px] text-fg-muted">{entry.range}</span>
                {on && (
                  <Pill
                    {...LABEL_PILL.matches}
                    label={`Matches ${entry.package} ${mine[entry.package]}`}
                  />
                )}
              </div>
              <ul className="flex flex-col gap-1.5">
                {entry.notes.map((note, index) => (
                  <li key={index} className="relative pl-4 text-sm leading-[22px]">
                    <span
                      aria-hidden="true"
                      className="absolute left-[3px] top-[9px] h-1 w-1 rounded-full bg-fg-subtle"
                    />
                    <span className="md-inline" dangerouslySetInnerHTML={{ __html: note }} />
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <a
                  href={entry.docs}
                  className="btn btn-primary btn-sm"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Official docs
                  <Icon name="external" size="sm" />
                </a>
                {entry.context7 && (
                  <a
                    href={entry.context7}
                    className="btn btn-ghost btn-sm"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Context7
                    <Icon name="external" size="sm" />
                  </a>
                )}
                <span className="mono subtle ml-auto text-xs max-md:hidden">
                  {hostOf(entry.docs)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
