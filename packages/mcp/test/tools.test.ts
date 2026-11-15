import { describe, expect, it } from 'vitest';
import { cardMarkdown, referenceWrapper } from '../src/format';
import { stackFits, techSlugs, topicsForFeature } from '../src/match';
import {
  getCard,
  getCardText,
  getChecklist,
  getChecklistText,
  matchVersions,
  normaliseVersion,
  reportFeedback,
  searchCards,
} from '../src/tools';
import { testLibrary } from './helpers';

const library = testLibrary();

describe('matching', () => {
  it('normalises stacks from package names, products and compound values', () => {
    expect(techSlugs(['next', 'pg'])).toEqual(['nextjs', 'postgres']);
    expect(techSlugs(['Next.js + PostgreSQL'])).toEqual(['nextjs', 'postgres']);
    expect(techSlugs(['nextjs-postgres'])).toEqual(['nextjs', 'postgres']);
    expect(techSlugs(['@aws-sdk/client-s3', 'Next.js'])).toEqual(['nextjs', 's3']);
  });

  it('needs every technology of the card in the project', () => {
    expect(stackFits('auth/nextjs-postgres', ['nextjs', 'postgres', 'drizzle'])).toBe(true);
    expect(stackFits('auth/nextjs-postgres', ['nextjs'])).toBe(false);
  });

  it('maps feature words to topics, as whole words', () => {
    expect(topicsForFeature('login', library.topics)[0]).toBe('auth');
    expect(topicsForFeature('Stripe webhooks', library.topics)[0]).toBe('payments-webhooks');
    expect(topicsForFeature('rate limiting', library.topics)[0]).toBe('rate-limiting');
    expect(topicsForFeature('file-uploads', library.topics)[0]).toBe('file-uploads');
    expect(topicsForFeature('cachet theme', library.topics)).toEqual([]);
  });
});

describe('search_cards', () => {
  it('finds the auth card for "login", without weak matches', () => {
    const { results } = searchCards(library, { query: 'login' });
    expect(results.map((r) => r.id)).toEqual(['auth/nextjs-postgres']);
    const stripe = searchCards(library, { query: 'stripe webhooks' }).results.map((r) => r.id);
    expect(stripe).toEqual(['payments-webhooks/nextjs-postgres']);
  });

  it('never returns unreviewed cards unless asked', () => {
    const ids = (query: string, includeUnverified?: boolean) =>
      searchCards(library, { query, limit: 10, include_unverified: includeUnverified }).results.map(
        (r) => r.id,
      );
    expect(ids('django auth')).not.toContain('auth/django-postgres');
    expect(ids('full-text search')).not.toContain('search/nextjs-postgres');
    expect(ids('django auth', true)).toContain('auth/django-postgres');
    expect(ids('full-text search', true)).toContain('search/nextjs-postgres');
  });

  it('filters by topic and respects the limit', () => {
    const { results } = searchCards(library, { query: 'postgres', topic: 'caching', limit: 1 });
    expect(results.map((r) => r.id)).toEqual(['caching/nextjs-postgres']);
  });

  it('puts cards that fit the stack first', () => {
    const { results } = searchCards(library, {
      query: 'auth',
      stack: ['django', 'postgres'],
      include_unverified: true,
    });
    expect(results[0]?.id).toBe('auth/django-postgres');
  });
});

describe('get_checklist', () => {
  it('resolves "login" on Next.js + Postgres to the auth card (acceptance)', () => {
    const output = getChecklist(library, { feature: 'login', stack: ['nextjs', 'postgres'] });
    expect(output.card?.id).toBe('auth/nextjs-postgres');
    expect(output.must.length).toBeGreaterThan(0);
    expect(output.decisions.length).toBeGreaterThan(0);
    expect(output.recommended).toBe('library-db-sessions');
    expect(output.next_step).toContain('id=auth/nextjs-postgres');
    expect(output.alternatives).toEqual([]);
  });

  it('returns no card, with the same topic as alternatives, when the stack does not fit', () => {
    const output = getChecklist(library, { feature: 'auth', stack: ['rails', 'mysql'] });
    expect(output.card).toBeNull();
    expect(output.alternatives.map((a) => a.id)).toEqual(['auth/nextjs-postgres']);
    expect(output.must).toEqual([]);
  });

  it('offers the unreviewed card for its stack only when asked', () => {
    const hidden = getChecklist(library, { feature: 'auth', stack: ['django', 'postgres'] });
    expect(hidden.card).toBeNull();
    const shown = getChecklist(library, {
      feature: 'auth',
      stack: ['django', 'postgres'],
      include_unverified: true,
    });
    expect(shown.card?.id).toBe('auth/django-postgres');
  });

  it('never invents a card for an unknown feature', () => {
    const output = getChecklist(library, { feature: 'quantum teleportation' });
    expect(output.card).toBeNull();
    expect(output.next_step).toContain('do not invent');
  });

  it('accepts a card id as the feature', () => {
    expect(getChecklist(library, { feature: 'caching/nextjs-postgres' }).card?.id).toBe(
      'caching/nextjs-postgres',
    );
  });

  it('starts its text with the reference wrapper (acceptance)', () => {
    const output = getChecklist(library, { feature: 'login' });
    expect(getChecklistText(library, output)).toMatch(
      /^\[Reference: Mustlist card auth\/nextjs-postgres v/,
    );
    const none = getChecklist(library, { feature: 'quantum teleportation' });
    expect(getChecklistText(library, none)).toMatch(/^\[Reference: Mustlist search results/);
  });
});

describe('get_card', () => {
  it('returns only the next >=16.0.0 entry for next 16.1.0 (acceptance)', () => {
    const result = getCard(library, { id: 'auth/nextjs-postgres', versions: { next: '16.1.0' } });
    if (!result.ok) throw new Error(result.message);
    expect(result.view.versions.map((v) => `${v.package} ${v.range}`)).toEqual(['next >=16.0.0']);
  });

  it('matches versions written as package.json ranges and keeps unrelated packages', () => {
    const entries = [
      { package: 'next', range: '>=15.0.0 <16.0.0', notes: [], docs: '' },
      { package: 'next', range: '>=16.0.0', notes: [], docs: '' },
      { package: 'stripe', range: '>=23.0.0 <24.0.0', notes: [], docs: '' },
    ];
    expect(matchVersions(entries, { nextjs: '^15.3.1' }).map((e) => e.range)).toEqual([
      '>=15.0.0 <16.0.0',
      '>=23.0.0 <24.0.0',
    ]);
    expect(normaliseVersion('16')).toBe('16.0.0');
    expect(normaliseVersion('~16.1')).toBe('16.1.0');
    expect(normaliseVersion('latest')).toBeUndefined();
  });

  it('refuses unreviewed cards unless asked (acceptance)', () => {
    const hidden = getCard(library, { id: 'auth/django-postgres' });
    expect(hidden.ok).toBe(false);
    expect(getCard(library, { id: 'auth/django-postgres', include_unverified: true }).ok).toBe(
      true,
    );
  });

  it('explains unknown ids instead of guessing', () => {
    const result = getCard(library, { id: 'auth/rails-mysql' });
    expect(result).toMatchObject({ ok: false });
  });

  it('starts with the wrapper and keeps only the requested lenses', () => {
    const result = getCard(library, { id: 'auth/nextjs-postgres', lenses: ['security'] });
    if (!result.ok) throw new Error(result.message);
    const text = getCardText(result, 'markdown');
    expect(text).toMatch(
      /^\[Reference: Mustlist card auth\/nextjs-postgres v\d+\.\d+\.\d+, verified/,
    );
    expect(text).toContain('## Security');
    expect(text).not.toContain('## Cost');
    expect(result.json.checklist.every((item) => item.lens === 'security')).toBe(true);
  });

  it('focuses on the chosen option', () => {
    const result = getCard(library, {
      id: 'auth/nextjs-postgres',
      chosen_option: 'managed-provider',
    });
    if (!result.ok) throw new Error(result.message);
    expect(cardMarkdown(result.view)).toContain('## Chosen option: Managed auth provider');
  });

  it('returns JSON after the wrapper when asked', () => {
    const result = getCard(library, { id: 'caching/nextjs-postgres', format: 'json' });
    if (!result.ok) throw new Error(result.message);
    const [wrapper, json] = getCardText(result, 'json').split('\n\n');
    expect(wrapper).toContain('[Reference: Mustlist card caching/nextjs-postgres');
    expect(JSON.parse(json ?? '').id).toBe('caching/nextjs-postgres');
  });

  it('stays compact: under ~3,300 tokens with every lens, ~2,400 with one lens', () => {
    // About 4 characters per token (an overestimate for URL-heavy text).
    const tokens = (text: string) => text.length / 4;
    for (const card of library.visible()) {
      const all = getCard(library, { id: card.id });
      if (!all.ok) throw new Error(all.message);
      expect(tokens(getCardText(all, 'markdown')), card.id).toBeLessThan(3300);
      const one = getCard(library, {
        id: card.id,
        lenses: ['security'],
        versions: { next: '16.1.0' },
      });
      if (!one.ok) throw new Error(one.message);
      // Version notes for packages the agent didn't pass (here: the AWS SDK) are kept.
      expect(tokens(getCardText(one, 'markdown')), card.id).toBeLessThan(2400);
    }
  });
});

describe('wrapper notes', () => {
  it('warns on stale and unreviewed cards', () => {
    const base = { id: 'a/b', card_version: '1.0.0', last_verified: '2026-01-01' };
    expect(referenceWrapper({ ...base, status: 'stale' })).toContain('being re-checked');
    expect(referenceWrapper({ ...base, status: 'proposed' })).toContain('Not yet reviewed');
    expect(referenceWrapper({ ...base, status: 'verified' })).not.toContain('⚠');
  });
});

describe('report_feedback', () => {
  it('returns a pre-filled issue link and writes nothing', () => {
    const output = reportFeedback(library, {
      id: 'auth/nextjs-postgres',
      outcome: 'outdated',
      note: 'Next 17 renamed proxy.ts',
    });
    if ('error' in output) throw new Error(output.error);
    const url = new URL(output.issue_url);
    expect(url.origin + url.pathname).toBe('https://github.com/RIDAM7/mustlist/issues/new');
    expect(url.searchParams.get('template')).toBe('feedback.yml');
    expect(url.searchParams.get('card-id')).toBe('auth/nextjs-postgres');
    expect(url.searchParams.get('title')).toBe('Feedback (outdated): auth/nextjs-postgres');
    expect(url.searchParams.get('note')).toBe('Outcome: outdated\n\nNext 17 renamed proxy.ts');
    expect(output.message).toContain('Share this link');
  });

  it('rejects unknown cards', () => {
    expect(reportFeedback(library, { id: 'nope/nope', outcome: 'worked' })).toHaveProperty('error');
  });
});
