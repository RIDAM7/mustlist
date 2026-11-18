// Regression test for CodeQL js/incomplete-multi-character-sanitization (2026-11-19).
import { describe, expect, it } from 'vitest';
import { stripComments } from '@/lib/community/github/map';

describe('stripComments', () => {
  it('removes nested and half-open comments', () => {
    expect(stripComments('a <!-- x --> b')).toBe('a  b');
    expect(stripComments('<!<!-- -->-- hidden --> shown')).toBe('shown');
    expect(stripComments('text <!-- never closed')).toBe('text  never closed');
  });
});
