// Regression tests for CodeQL warnings fixed on 2026-11-19 (the website's one is in
// apps/web/test/strip-comments.test.ts).
import { describe, expect, it } from 'vitest';
import { normaliseSiteUrl } from '@mustlist/schema/site';
import { trimSlashes } from '../../packages/mcp/src/library';
import { cell } from '../../packages/cli/src/init';

describe('cell (js/incomplete-sanitization)', () => {
  it('escapes backslashes before pipes, so a table cell cannot be split', () => {
    expect(cell('a | b')).toBe('a \\| b');
    expect(cell('a \\| b')).toBe('a \\\\\\| b');
    expect(cell('two\n  lines')).toBe('two lines');
  });
});

describe('trailing slashes (js/polynomial-redos)', () => {
  it('normalises site URLs in linear time', () => {
    expect(normaliseSiteUrl('https://example.com///')).toBe('https://example.com');
    const started = Date.now();
    normaliseSiteUrl(`https://example.com${'/'.repeat(50_000)}x`);
    expect(Date.now() - started).toBeLessThan(200);
  });

  it('trims slashes around card ids', () => {
    expect(trimSlashes('/auth/nextjs-postgres/')).toBe('auth/nextjs-postgres');
    expect(trimSlashes('///')).toBe('');
    expect(trimSlashes('auth/nextjs-postgres')).toBe('auth/nextjs-postgres');
  });
});
