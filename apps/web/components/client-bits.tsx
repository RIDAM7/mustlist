'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { formatDate, relativeTime } from '@/lib/format';
import { THEME_KEY } from '@/lib/theme';
import { Icon } from './icons';
import { useCopy } from './toast';

/* ── Theme ──────────────────────────────────────────────── */

function effectiveTheme(): 'light' | 'dark' {
  const chosen = document.documentElement.getAttribute('data-theme');
  if (chosen === 'light' || chosen === 'dark') return chosen;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** Sun in dark mode, moon in light mode; both icons render and CSS shows one. */
export function ThemeToggle({ className = 'btn btn-ghost btn-icon' }: { className?: string }) {
  function toggle() {
    const next = effectiveTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // Blocked storage: the choice lasts for this page.
    }
  }
  return (
    <button type="button" className={className} aria-label="Toggle theme" onClick={toggle}>
      <Icon name="sun" className="hidden dark:block" />
      <Icon name="moon" className="block dark:hidden" />
    </button>
  );
}

/* ── Relative time ──────────────────────────────────────── */

const noop = () => () => {};

/**
 * "6 days ago". The server renders the absolute date; the browser swaps in the
 * relative one after hydration, so prerendered pages never show a stale age.
 */
export function RelativeTime({ date, now }: { date: string; now?: string }) {
  const hydrated = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
  const label = hydrated ? relativeTime(date, now ? new Date(now) : new Date()) : formatDate(date);
  return (
    <time dateTime={date} title={formatDate(date)}>
      {label}
    </time>
  );
}

/* ── Code block copy buttons ────────────────────────────── */

/**
 * Code blocks are rendered on the server (lib/markdown.ts) with a
 * `data-copy-code` button. One listener copies the block's text.
 */
export function CodeCopyHandler() {
  const copy = useCopy();
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-copy-code]');
      if (!button) return;
      const block = button.closest('.code');
      const lines = [...(block?.querySelectorAll('.code-l') ?? [])].map(
        (line) => line.lastElementChild?.textContent ?? '',
      );
      void copy(lines.join('\n'));
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [copy]);
  return null;
}

/** A copy button for a fixed string (setup commands, URLs). */
export function CopyButton({
  value,
  label = 'Copy',
  className = 'btn btn-ghost btn-sm',
  message,
  ariaLabel,
}: {
  value: string;
  label?: string;
  className?: string;
  message?: string;
  /** Names what is copied when several Copy buttons share a page. */
  ariaLabel?: string;
}) {
  const copy = useCopy();
  return (
    <button
      type="button"
      className={className}
      aria-label={ariaLabel}
      onClick={() => void copy(value, message)}
    >
      <Icon name="copy" size="sm" />
      {label}
    </button>
  );
}
