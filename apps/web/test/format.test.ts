import { describe, expect, it } from 'vitest';
import {
  addDays,
  compactAge,
  formatDate,
  formatShortDate,
  hostOf,
  relativeTime,
  splitCode,
} from '@/lib/format';

const now = new Date('2026-11-15T12:00:00Z');

describe('dates', () => {
  it('formats plain dates without shifting the day', () => {
    expect(formatDate('2026-11-12')).toBe('12 Nov 2026');
    expect(formatShortDate('2026-05-02')).toBe('2 May');
  });

  it('adds days across years', () => {
    expect(addDays('2026-11-12', 180)).toBe('2027-05-11');
  });

  it('describes ages the way lists show them', () => {
    expect(relativeTime('2026-11-15T10:00:00Z', now)).toBe('2 hours ago');
    expect(relativeTime('2026-11-14T08:00:00Z', now)).toBe('Yesterday');
    expect(relativeTime('2026-11-09T09:12:00Z', now)).toBe('6 days ago');
    expect(relativeTime('2026-11-01T10:00:00Z', now)).toBe('2 weeks ago');
    expect(relativeTime('2026-10-12T10:00:00Z', now)).toBe('1 month ago');
    expect(compactAge('2026-11-13T09:00:00Z', now)).toBe('2d');
    expect(compactAge('2026-11-07T09:00:00Z', now)).toBe('1w');
  });
});

describe('text helpers', () => {
  it('splits backtick code spans', () => {
    expect(splitCode('use `proxy.ts` now')).toEqual([
      { text: 'use ', code: false },
      { text: 'proxy.ts', code: true },
      { text: ' now', code: false },
    ]);
  });

  it('reads the host of a URL and tolerates bad input', () => {
    expect(hostOf('https://docs.stripe.com/webhooks')).toBe('docs.stripe.com');
    expect(hostOf('not a url')).toBe('not a url');
  });
});
