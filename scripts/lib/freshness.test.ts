import { describe, expect, it } from 'vitest';
import type { CardFrontmatter } from '@mustlist/schema';
import { dueForRecheck, majorTitle, newMajors } from './freshness';

const card = (overrides: Partial<CardFrontmatter>): CardFrontmatter =>
  ({
    id: 'auth/nextjs-postgres',
    topic: 'auth',
    status: 'verified',
    last_verified: '2026-11-15',
    versions: [
      { package: 'next', range: '>=16.0.0 <17.0.0', notes: [], docs: 'https://nextjs.org/docs' },
      {
        package: 'postgresql',
        range: '>=14.0.0',
        notes: [],
        docs: 'https://www.postgresql.org/docs/',
      },
    ],
    ...overrides,
  }) as unknown as CardFrontmatter;

describe('dueForRecheck', () => {
  it('picks verified cards older than 180 days', () => {
    const today = new Date('2027-06-01T00:00:00Z');
    const cards = [
      card({ id: 'a/x', last_verified: '2026-11-15' }),
      card({ id: 'b/x', last_verified: '2027-01-15' }),
      card({ id: 'c/x', status: 'draft', last_verified: null }),
    ];
    expect(dueForRecheck(cards, today).map((item) => item.id)).toEqual(['a/x']);
  });
});

describe('newMajors', () => {
  it('flags a major above every range and ignores unbounded ranges and prereleases', () => {
    const latest = new Map([
      ['next', '17.0.1'],
      ['postgresql', '0.0.1'],
    ]);
    const found = newMajors([card({})], latest);
    expect(found).toEqual([
      {
        cardId: 'auth/nextjs-postgres',
        topic: 'auth',
        pkg: 'next',
        latest: '17.0.1',
        ranges: ['>=16.0.0 <17.0.0'],
      },
    ]);
    const [first] = found;
    expect(first && majorTitle(first)).toBe('New major version: next 17 (auth/nextjs-postgres)');
    expect(newMajors([card({})], new Map([['next', '16.4.0']]))).toEqual([]);
    expect(newMajors([card({})], new Map([['next', '17.0.0-canary.1']]))).toEqual([]);
  });

  it('treats a package as covered when any of its ranges matches', () => {
    const covered = card({
      versions: [
        { package: 'next', range: '>=16.0.0 <17.0.0', notes: [], docs: 'https://nextjs.org/docs' },
        { package: 'next', range: '>=17.0.0 <18.0.0', notes: [], docs: 'https://nextjs.org/docs' },
      ] as CardFrontmatter['versions'],
    });
    expect(newMajors([covered], new Map([['next', '17.2.0']]))).toEqual([]);
  });
});
