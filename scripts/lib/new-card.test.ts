import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseCard } from '@mustlist/schema';
import { validateCards } from '@mustlist/validator';
import { cardKey, newCardProblems, pickGithubHandle, renderCardTemplate } from './new-card';

const template = readFileSync(new URL('../../templates/card.md', import.meta.url), 'utf8');
const request = {
  topic: 'rate-limiting',
  stack: 'nextjs-postgres',
  authors: ['RIDAM7'],
  draft: false,
};

describe('newCardProblems', () => {
  it('accepts a new topic and stack', () => {
    expect(newCardProblems(request, ['auth/nextjs-postgres'])).toEqual([]);
  });

  it('refuses reserved and invalid slugs', () => {
    expect(newCardProblems({ ...request, topic: 'api' }, [])).toEqual([
      'Topic "api" is reserved by the site.',
    ]);
    expect(newCardProblems({ ...request, stack: 'Next_PG' }, [])[0]).toMatch(
      /must be lowercase kebab-case/,
    );
  });

  it('refuses duplicates, including a reordered stack', () => {
    expect(newCardProblems(request, ['rate-limiting/nextjs-postgres'])[0]).toMatch(
      /already exists/,
    );
    expect(
      newCardProblems({ ...request, stack: 'postgres-nextjs' }, [
        'rate-limiting/nextjs-postgres',
      ])[0],
    ).toMatch(/already exists: cards\/rate-limiting\/nextjs-postgres\.md/);
  });

  it('builds the same key for reordered stacks', () => {
    expect(cardKey('auth', 'postgres-nextjs')).toBe(cardKey('auth', 'nextjs-postgres'));
  });
});

describe('renderCardTemplate', () => {
  it('fills id, topic, stack, status, version and authors', () => {
    const card = parseCard(
      renderCardTemplate(template, request),
      'cards/rate-limiting/nextjs-postgres.md',
    );
    expect(card.parseErrors).toEqual([]);
    expect(card.frontmatter).toMatchObject({
      id: 'rate-limiting/nextjs-postgres',
      topic: 'rate-limiting',
      stack: ['nextjs', 'postgres'],
      status: 'proposed',
      card_version: '0.1.0',
      authors: ['RIDAM7'],
    });
  });

  it('sets draft status with --draft', () => {
    const card = parseCard(
      renderCardTemplate(template, { ...request, draft: true }),
      'cards/a/b.md',
    );
    expect(card.frontmatter).toMatchObject({ status: 'draft' });
  });

  it('produces a card that fails validation until it is filled in', () => {
    const text = renderCardTemplate(template, request);
    const errors = validateCards([
      { filePath: 'cards/rate-limiting/nextjs-postgres.md', text },
    ]).filter((item) => item.severity === 'error');
    expect(errors.length).toBeGreaterThan(0);
    // Only "fill this in" problems, never safety problems in the template itself.
    expect(new Set(errors.map((item) => item.rule))).toEqual(
      new Set(['schema', 'refs', 'sections', 'lens-sections']),
    );
  });
});

describe('pickGithubHandle', () => {
  it('uses the first value that looks like a GitHub handle', () => {
    expect(pickGithubHandle([undefined, 'Ridam Agrawal', 'RIDAM7\n'])).toBe('RIDAM7');
    expect(pickGithubHandle([undefined, 'Two Words'])).toBeUndefined();
  });
});
