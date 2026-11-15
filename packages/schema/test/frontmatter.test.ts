import { describe, expect, it } from 'vitest';
import { isOfficialDocsUrl } from '../src/config/official-docs-domains';
import { formatPath, validateFrontmatter } from '../src/frontmatter';
import { parseCard } from '../src/parse';
import { readFixture } from './helpers';

function frontmatterOf(fixture: string): Record<string, unknown> {
  const card = parseCard(readFixture(fixture), 'cards/x/y.md');
  return structuredClone(card.frontmatter) as Record<string, unknown>;
}

// `any` keeps the one-line test mutations below readable. The mutated data is
// untrusted input to `validateFrontmatter` anyway, which is what these tests check.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Mutable = Record<string, any>;

/** Deep-clone the draft fixture and apply a change. */
function draftWith(change: (data: Mutable) => void): Record<string, unknown> {
  const data = frontmatterOf('good/draft.md') as Mutable;
  change(data);
  return data;
}

function rulesOf(data: unknown): string[] {
  return validateFrontmatter(data).issues.map((issue) => issue.rule);
}

describe('validateFrontmatter', () => {
  it('accepts the good fixtures', () => {
    expect(validateFrontmatter(frontmatterOf('good/draft.md')).issues).toEqual([]);
    expect(validateFrontmatter(frontmatterOf('good/verified.md')).issues).toEqual([]);
  });

  it('defaults related to an empty list', () => {
    const result = validateFrontmatter(draftWith((d) => delete d['related']));
    expect(result.data?.related).toEqual([]);
  });

  it('explains ids that YAML turned into booleans', () => {
    const card = parseCard(
      readFixture('good/draft.md').replace('{ id: low,', '{ id: true,'),
      'cards/example/nextjs-postgres.md',
    );
    const { issues } = validateFrontmatter(card.frontmatter);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.message).toMatch(
      /must be a string, got boolean true.*YAML reads unquoted yes\/no/,
    );
    expect(issues[0]?.path).toEqual(['decisions', 0, 'options', 0, 'id']);
  });

  it('rejects ids that other YAML tools read as booleans', () => {
    const { issues } = validateFrontmatter(
      draftWith((d) => {
        d['decisions'][0].options[0].id = 'yes';
        d['decisions'][0].default = 'yes';
      }),
    );
    expect(issues.map((issue) => issue.message).join('\n')).toMatch(/"yes" is read as a boolean/);
  });

  it('rejects unknown keys (typos)', () => {
    expect(rulesOf(draftWith((d) => (d['reviewer'] = ['someone'])))).toEqual(['schema']);
  });

  it('enforces list sizes', () => {
    expect(rulesOf(draftWith((d) => d['checklist'].splice(0, 1)))).toEqual(['schema']);
    expect(rulesOf(draftWith((d) => (d['sources'] = d['sources'].slice(0, 1))))).toEqual([
      'schema',
    ]);
  });

  it('tags topic slug problems as "slug"', () => {
    expect(rulesOf(draftWith((d) => (d['topic'] = 'api')))).toEqual(['slug']);
    expect(rulesOf(draftWith((d) => (d['topic'] = 'Not_A_Slug')))).toEqual(['slug']);
  });

  it('tags an over-long summary as "size"', () => {
    expect(rulesOf(draftWith((d) => (d['summary'] = 'x'.repeat(301))))).toEqual(['size']);
  });

  it('tags broken option references as "refs"', () => {
    expect(rulesOf(draftWith((d) => (d['recommended'] = 'missing')))).toEqual(['refs']);
    expect(rulesOf(draftWith((d) => (d['decisions'][0].options[1].points_to = 'missing')))).toEqual(
      ['refs'],
    );
    expect(rulesOf(draftWith((d) => (d['decisions'][0].default = 'missing')))).toEqual(['refs']);
    expect(rulesOf(draftWith((d) => (d['checklist'][1].id = 'validate-input')))).toEqual(['refs']);
  });

  it('tags version entry problems as "versions"', () => {
    const second = {
      package: 'next',
      range: '>=16.2.0',
      notes: ['Note.'],
      docs: 'https://nextjs.org/docs',
    };
    expect(rulesOf(draftWith((d) => d['versions'].push(second)))).toEqual(['versions']);
    expect(rulesOf(draftWith((d) => (d['versions'][0].range = 'latest')))).toEqual(['versions']);
    expect(
      rulesOf(draftWith((d) => (d['versions'][0].docs = 'https://blog.example.com/next'))),
    ).toEqual(['versions']);
    expect(
      rulesOf(draftWith((d) => (d['versions'][0].context7 = 'https://example.com/next'))),
    ).toEqual(['versions']);
  });

  it('requires review data on verified cards', () => {
    const issues = validateFrontmatter(draftWith((d) => (d['status'] = 'verified'))).issues;
    expect(issues.map((issue) => issue.path[0])).toEqual(['last_verified', 'review_level']);
  });

  it('requires enough reviewers for the review level', () => {
    const data = frontmatterOf('good/verified.md') as Record<string, unknown>;
    data['review_level'] = 'community';
    expect(validateFrontmatter(data).issues[0]?.message).toMatch(/at least 2 reviewers/);
  });

  it('checks dates and semver', () => {
    expect(rulesOf(draftWith((d) => (d['card_version'] = 'v1')))).toEqual(['schema']);
    expect(rulesOf(draftWith((d) => (d['last_verified'] = '12/11/2026')))).toEqual(['schema']);
  });
});

describe('isOfficialDocsUrl', () => {
  it('matches allowlisted domains and their subdomains', () => {
    expect(isOfficialDocsUrl('https://nextjs.org/docs')).toBe(true);
    expect(isOfficialDocsUrl('https://docs.stripe.com/webhooks')).toBe(true);
  });

  it('rejects look-alike hosts and invalid URLs', () => {
    expect(isOfficialDocsUrl('https://evilnextjs.org/docs')).toBe(false);
    expect(isOfficialDocsUrl('https://nextjs.org.evil.com/docs')).toBe(false);
    expect(isOfficialDocsUrl('not a url')).toBe(false);
  });

  it('matches a repository entry only on that repository', () => {
    const allow = ['github.com/porsager/postgres'];
    expect(isOfficialDocsUrl('https://github.com/porsager/postgres', allow)).toBe(true);
    expect(
      isOfficialDocsUrl('https://github.com/porsager/postgres/blob/master/README.md', allow),
    ).toBe(true);
    expect(isOfficialDocsUrl('https://github.com/porsager/postgres#connection', allow)).toBe(true);
    expect(isOfficialDocsUrl('https://github.com/porsager/postgres-evil', allow)).toBe(false);
    expect(isOfficialDocsUrl('https://github.com/attacker/postgres', allow)).toBe(false);
    expect(isOfficialDocsUrl('https://github.com/', allow)).toBe(false);
    expect(isOfficialDocsUrl('https://gist.github.com/porsager/postgres', allow)).toBe(false);
  });
});

describe('formatPath', () => {
  it('formats zod paths', () => {
    expect(formatPath(['checklist', 2, 'text'])).toBe('checklist[2].text');
    expect(formatPath([])).toBe('');
  });
});
