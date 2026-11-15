import { describe, expect, it } from 'vitest';
import { highlight, highlightLine } from '@/lib/highlight';

const marked = (line: string, lang: string) =>
  highlightLine(line, lang)
    .filter((token) => token.cls)
    .map((token) => [token.text, token.cls]);

describe('highlightLine', () => {
  it('marks TypeScript keywords and strings', () => {
    expect(marked("const res = await fetch('/api')", 'ts')).toEqual([
      ['const', 'c-kw'],
      ['await', 'c-kw'],
      ["'/api'", 'c-str'],
    ]);
  });

  it('ignores comment markers inside strings', () => {
    expect(marked("const url = 'https://x.dev' // note", 'ts')).toEqual([
      ['const', 'c-kw'],
      ["'https://x.dev'", 'c-str'],
      ['// note', 'c-com'],
    ]);
  });

  it('uses SQL keywords and -- comments', () => {
    expect(marked('PRIMARY KEY (id) -- one per event', 'sql')).toEqual([
      ['PRIMARY', 'c-kw'],
      ['KEY', 'c-kw'],
      ['-- one per event', 'c-com'],
    ]);
  });

  it('keeps every character of the line', () => {
    const line = '  provider     text NOT NULL,';
    expect(
      highlightLine(line, 'sql')
        .map((token) => token.text)
        .join(''),
    ).toBe(line);
  });
});

describe('highlight', () => {
  it('splits a block into lines and drops the final newline', () => {
    expect(highlight('a\nb\n', 'ts')).toHaveLength(2);
  });
});
