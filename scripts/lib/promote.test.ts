import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseCard } from '@mustlist/schema';
import { validateCards } from '@mustlist/validator';
import { PromoteError, nextCardVersion, promoteCard, setTopLevelKey } from './promote';

const fixture = (name: string) =>
  readFileSync(new URL(`../../fixtures/${name}`, import.meta.url), 'utf8');

/** The good draft fixture without its reviewer notes, so it can be verified. */
const readyDraft = () =>
  fixture('good/draft.md').replace(/\n## Notes for reviewers\n\n[^\n]+\n/, '\n');

const options = { reviewers: ['RIDAM7'], level: 'seed', date: '2026-11-14' };

describe('nextCardVersion', () => {
  it('goes to 1.0.0 on first verification, patch on re-verification, unchanged after a major', () => {
    expect(nextCardVersion('0.3.1', 'draft')).toBe('1.0.0');
    expect(nextCardVersion('1.2.0', 'verified')).toBe('1.2.1');
    expect(nextCardVersion('1.2.0', 'stale')).toBe('1.2.1');
    expect(nextCardVersion('2.0.0', 'proposed')).toBe('2.0.0');
  });
});

describe('setTopLevelKey', () => {
  it('replaces a key and its indented continuation lines only', () => {
    const yaml = 'a: 1\nreviewers:\n  - one\n  - two\nb: 2';
    expect(setTopLevelKey(yaml, 'reviewers', '[x, y]')).toBe('a: 1\nreviewers: [x, y]\nb: 2');
  });

  it('fails for a missing key', () => {
    expect(() => setTopLevelKey('a: 1', 'status', 'verified')).toThrow(PromoteError);
  });
});

describe('promoteCard', () => {
  it('sets the review fields and changes nothing else', () => {
    const before = readyDraft();
    const result = promoteCard(before, options);
    expect(result).toMatchObject({ fromStatus: 'draft', fromVersion: '0.1.0', toVersion: '1.0.0' });
    expect(parseCard(result.text, 'x.md').frontmatter).toMatchObject({
      status: 'verified',
      card_version: '1.0.0',
      last_verified: '2026-11-14',
      review_level: 'seed',
      reviewers: ['RIDAM7'],
    });
    const changed = result.text
      .split('\n')
      .filter((line, index) => line !== before.split('\n')[index]);
    expect(changed).toEqual([
      'status: verified',
      'card_version: 1.0.0',
      'last_verified: 2026-11-14',
      'review_level: seed',
      'reviewers: [RIDAM7]',
    ]);
  });

  it('produces a card that validates as verified', () => {
    const { text } = promoteCard(readyDraft(), options);
    const verifiedFixture = {
      filePath: 'cards/example/express-postgres.md',
      text: fixture('good/verified.md'),
    };
    const errors = validateCards([
      verifiedFixture,
      { filePath: 'cards/example/nextjs-postgres.md', text },
    ]).filter((item) => item.severity === 'error');
    expect(errors).toEqual([]);
  });

  it('leaves unresolved reviewer notes for the validator to block', () => {
    const { text } = promoteCard(fixture('good/draft.md'), options);
    const rules = validateCards([{ filePath: 'cards/example/nextjs-postgres.md', text }]).map(
      (item) => item.rule,
    );
    expect(rules).toContain('reviewer-notes');
  });

  it('rejects a bad level, too few reviewers and invalid handles', () => {
    expect(() => promoteCard(readyDraft(), { ...options, level: 'gold' })).toThrow(/--level/);
    expect(() => promoteCard(readyDraft(), { ...options, level: 'community' })).toThrow(
      /at least 2/,
    );
    expect(() => promoteCard(readyDraft(), { ...options, reviewers: ['not a handle'] })).toThrow(
      /Not GitHub handles/,
    );
  });
});
