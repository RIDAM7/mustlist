import { describe, expect, it } from 'vitest';
import type { CardJSON } from '@mustlist/schema/types';
import { agentMessage, nextMajors, reviewLabel, shortTitle, topicStatus } from '@/lib/card';

describe('card helpers', () => {
  it('shortens card titles to the feature name', () => {
    expect(shortTitle('Authentication for a Next.js + Postgres app')).toBe('Authentication');
    expect(shortTitle('User file uploads for a Next.js app with Amazon S3')).toBe(
      'User file uploads',
    );
    expect(shortTitle('Caching')).toBe('Caching');
  });

  it('finds the next major version of each package', () => {
    const versions: CardJSON['versions'] = [
      { package: 'next', range: '>=15.0.0 <16.0.0', notes: [], docs: '' },
      { package: 'next', range: '>=16.0.0', notes: [], docs: '' },
      { package: 'stripe', range: '>=23.0.0 <24.0.0', notes: [], docs: '' },
    ];
    expect(nextMajors({ versions })).toEqual(['next@17', 'stripe@24']);
  });

  it('labels the review level', () => {
    expect(reviewLabel({ review_level: null, reviewers: [] })).toBe('Not reviewed');
    expect(reviewLabel({ review_level: 'community', reviewers: ['a', 'b'] })).toBe('Community · 2');
  });

  it('ranks topic status: verified, then re-checked, then draft', () => {
    expect(topicStatus([{ status: 'draft' }, { status: 'verified' }])).toBe('verified');
    expect(topicStatus([{ status: 'draft' }, { status: 'stale' }])).toBe('stale');
    expect(topicStatus([{ status: 'draft' }])).toBe('draft');
  });

  it('warns agents when a card is not reviewed', () => {
    const message = agentMessage({ id: 'auth/x', topic: 'auth', status: 'draft' }, '# card');
    expect(message).toContain('not reviewed yet');
    expect(message.endsWith('# card\n')).toBe(true);
  });
});
