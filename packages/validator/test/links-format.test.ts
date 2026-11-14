import { describe, expect, it } from 'vitest';
import { resolveBaseRef } from '../src/files';
import { formatGithubAnnotations, formatJson, formatText } from '../src/format';
import { checkUrl, mapWithConcurrency } from '../src/links';
import type { Diagnostic } from '../src/types';

/** A fetch stub that answers with the given statuses in order and records each call. */
function scriptedFetch(statuses: (number | Error)[]) {
  const calls: string[] = [];
  const stub: typeof fetch = async (input, init) => {
    calls.push(`${init?.method ?? 'GET'} ${String(input)}`);
    const next = statuses.shift() ?? 200;
    if (next instanceof Error) throw next;
    return new Response(null, { status: next });
  };
  return { stub, calls };
}

describe('checkUrl', () => {
  it('accepts 2xx and 3xx', async () => {
    expect(await checkUrl('https://a.example', { fetch: scriptedFetch([301]).stub })).toEqual({
      ok: true,
    });
  });

  it('falls back to GET when HEAD is refused', async () => {
    const { stub, calls } = scriptedFetch([405, 200]);
    expect(await checkUrl('https://a.example', { fetch: stub })).toEqual({ ok: true });
    expect(calls).toEqual(['HEAD https://a.example', 'GET https://a.example']);
  });

  it('retries network errors and 5xx, then succeeds', async () => {
    const { stub, calls } = scriptedFetch([new Error('ECONNRESET'), 503, 200]);
    expect(await checkUrl('https://a.example', { fetch: stub, backoffMs: 0 })).toEqual({
      ok: true,
    });
    expect(calls).toHaveLength(3);
  });

  it('does not retry a 404', async () => {
    const { stub, calls } = scriptedFetch([404, 404]);
    expect(await checkUrl('https://a.example', { fetch: stub, backoffMs: 0 })).toEqual({
      ok: false,
      reason: 'HTTP 404',
    });
    expect(calls).toHaveLength(2); // HEAD, then one GET
  });

  it('gives up after the retries', async () => {
    const { stub } = scriptedFetch([500, 500, 500]);
    const result = await checkUrl('https://a.example', { fetch: stub, retries: 2, backoffMs: 0 });
    expect(result).toEqual({ ok: false, reason: 'HTTP 500' });
  });
});

describe('mapWithConcurrency', () => {
  it('keeps order and never exceeds the limit', async () => {
    let active = 0;
    let peak = 0;
    const results = await mapWithConcurrency([1, 2, 3, 4, 5, 6], 2, async (value) => {
      active++;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active--;
      return value * 10;
    });
    expect(results).toEqual([10, 20, 30, 40, 50, 60]);
    expect(peak).toBe(2);
  });
});

const sample: Diagnostic[] = [
  {
    file: 'cards/a/b.md',
    line: 3,
    rule: 'schema',
    severity: 'error',
    message: 'title is required',
  },
  {
    file: 'cards/a/b.md',
    line: 7,
    rule: 'size',
    severity: 'warning',
    message: 'summary, nearly full',
  },
];

describe('formatters', () => {
  it('prints file:line  rule  message and a summary', () => {
    expect(formatText(sample)).toBe(
      [
        'cards/a/b.md:3  schema  title is required',
        'cards/a/b.md:7  size  warning: summary, nearly full',
        '1 error, 1 warning',
      ].join('\n'),
    );
  });

  it('prints JSON with counts', () => {
    expect(JSON.parse(formatJson(sample))).toMatchObject({ errors: 1, warnings: 1 });
  });

  it('escapes GitHub annotation properties', () => {
    expect(formatGithubAnnotations([sample[1]!])).toBe(
      '::warning file=cards/a/b.md,line=7,title=size::summary, nearly full',
    );
  });
});

describe('resolveBaseRef', () => {
  it('prefers the flag, then MUSTLIST_BASE_REF, then the PR base, then origin/main', () => {
    expect(resolveBaseRef('main', { MUSTLIST_BASE_REF: 'x' })).toBe('main');
    expect(resolveBaseRef(undefined, { MUSTLIST_BASE_REF: 'x', GITHUB_BASE_REF: 'y' })).toBe('x');
    expect(resolveBaseRef(undefined, { GITHUB_BASE_REF: 'develop' })).toBe('origin/develop');
    expect(resolveBaseRef(undefined, {})).toBe('origin/main');
  });
});
