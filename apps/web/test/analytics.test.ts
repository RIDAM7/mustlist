import { describe, expect, it } from 'vitest';
import { withBasePath } from '@/lib/analytics';

const view = (url: string) => ({ type: 'pageview' as const, url });

describe('withBasePath', () => {
  it('puts /library back on URLs that Next sent without it', () => {
    expect(withBasePath(view('https://ridamagrawal.com/auth/nextjs-postgres')).url).toBe(
      'https://ridamagrawal.com/library/auth/nextjs-postgres',
    );
    expect(withBasePath(view('https://ridamagrawal.com/')).url).toBe(
      'https://ridamagrawal.com/library',
    );
  });

  it('keeps the query string and leaves correct URLs alone', () => {
    expect(withBasePath(view('https://ridamagrawal.com/connect?tab=mcp')).url).toBe(
      'https://ridamagrawal.com/library/connect?tab=mcp',
    );
    const ok = view('https://ridamagrawal.com/library/auth/nextjs-postgres');
    expect(withBasePath(ok)).toBe(ok);
    expect(withBasePath(view('https://ridamagrawal.com/library')).url).toBe(
      'https://ridamagrawal.com/library',
    );
  });

  it('does not treat a lookalike prefix as the basePath', () => {
    expect(withBasePath(view('https://ridamagrawal.com/libraryx')).url).toBe(
      'https://ridamagrawal.com/library/libraryx',
    );
  });

  it('returns events with an unparseable URL unchanged', () => {
    const bad = view('not a url');
    expect(withBasePath(bad)).toBe(bad);
  });
});
