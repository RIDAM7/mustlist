import { describe, expect, it } from 'vitest';
import {
  MAX_OPEN_SITE_PROPOSALS,
  openSiteProposals,
  siteBranch,
  tooManyProposals,
} from '@/lib/community/limits';

const pull = (ref: string) => ({ head: { ref } });

describe('site proposal limits', () => {
  it('names branches per person and card', () => {
    expect(siteBranch('Ada-L', 'auth/nextjs-postgres')).toBe(
      'proposals/ada-l/auth-nextjs-postgres',
    );
  });

  it("counts only that person's open site proposals", () => {
    const pulls = [
      pull('proposals/ada-l/auth-nextjs-postgres'),
      pull('proposals/Ada-L/caching-nextjs-postgres'),
      pull('proposals/ada-lovelace/auth-nextjs-postgres'),
      pull('proposals/bob/auth-nextjs-postgres'),
      pull('fix/typo'),
    ];
    expect(openSiteProposals(pulls, 'ada-l')).toBe(2);
    expect(openSiteProposals(pulls, 'carol')).toBe(0);
  });

  it('allows three at once', () => {
    expect(MAX_OPEN_SITE_PROPOSALS).toBe(3);
    expect(tooManyProposals(3)).toMatch(/3 proposals open/);
  });
});
