import { describe, expect, it } from 'vitest';
import { checkLinks } from '../src/links';
import { RULE_IDS } from '../src/types';
import { createCardContext, validateCards } from '../src/validate';
import { badFixtureRules, fixtureInput, goodInputs } from './helpers';

/** Rules with no fixture: status-guard compares two versions of a card (see status-guard.test.ts). */
const NOT_IMPLEMENTED = ['status-guard'];

describe('good fixtures', () => {
  it('produce no errors and no warnings', () => {
    expect(validateCards(goodInputs())).toEqual([]);
  });
});

describe('bad fixtures', () => {
  it('cover every implemented rule exactly once', () => {
    const expected = RULE_IDS.filter((rule) => !NOT_IMPLEMENTED.includes(rule)).sort();
    expect(badFixtureRules()).toEqual(expected);
  });

  const staticRules = badFixtureRules().filter((rule) => rule !== 'links');

  it.each(staticRules)('fixtures/bad/%s.md fails only with its own rule', (rule) => {
    const bad = fixtureInput(`bad/${rule}.md`);
    const diagnostics = validateCards([...goodInputs(), bad], { only: new Set([bad.filePath]) });
    const errors = diagnostics.filter((item) => item.severity === 'error');
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.map((item) => item.rule)).toEqual(errors.map(() => rule));
  });

  it('fixtures/bad/links.md passes static rules and fails the link check', async () => {
    const bad = fixtureInput('bad/links.md');
    const staticErrors = validateCards([...goodInputs(), bad], {
      only: new Set([bad.filePath]),
    }).filter((item) => item.severity === 'error');
    expect(staticErrors).toEqual([]);

    const stubFetch: typeof fetch = async (input) =>
      new Response(null, { status: String(input).includes('broken') ? 404 : 200 });
    const diagnostics = await checkLinks([createCardContext(bad)], {
      fetch: stubFetch,
      backoffMs: 0,
    });
    expect(diagnostics.map((item) => item.rule)).toEqual(['links']);
    expect(diagnostics[0]?.message).toMatch(/HTTP 404/);
  });
});
