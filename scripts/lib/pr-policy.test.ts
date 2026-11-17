import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  acceptedBy,
  approvers,
  type CommitInfo,
  contentChanged,
  labelsFor,
  parseMaintainers,
  proposerOf,
  unsignedCommits,
} from './pr-policy';

const commit = (overrides: Partial<CommitInfo>): CommitInfo => ({
  sha: 'abcdef1234',
  message: 'feat: x\n\nSigned-off-by: Ada <ada@example.com>',
  authorName: 'Ada',
  authorEmail: 'ada@example.com',
  authorLogin: 'ada',
  parents: 1,
  ...overrides,
});

describe('unsignedCommits', () => {
  it('accepts a matching sign-off, whatever the case of the email', () => {
    expect(unsignedCommits([commit({ authorEmail: 'Ada@Example.com' })])).toEqual([]);
  });

  it('flags a missing or mismatched sign-off', () => {
    const problems = unsignedCommits([
      commit({ message: 'feat: x' }),
      commit({ authorEmail: 'other@example.com' }),
    ]);
    expect(problems.map((item) => item.reason)).toEqual([
      'no Signed-off-by line',
      "Signed-off-by email doesn't match the author (other@example.com)",
    ]);
  });

  it('skips merge commits and bots', () => {
    expect(
      unsignedCommits([
        commit({ message: 'Merge branch main', parents: 2 }),
        commit({ message: 'bump', authorLogin: 'dependabot[bot]' }),
      ]),
    ).toEqual([]);
  });
});

describe('approvers', () => {
  it('uses each person’s latest approving or blocking review and ignores the author', () => {
    const reviews = [
      { login: 'a', state: 'CHANGES_REQUESTED', submittedAt: '2026-11-01' },
      { login: 'a', state: 'APPROVED', submittedAt: '2026-11-02' },
      { login: 'a', state: 'COMMENTED', submittedAt: '2026-11-03' },
      { login: 'b', state: 'APPROVED', submittedAt: '2026-11-01' },
      { login: 'b', state: 'DISMISSED', submittedAt: '2026-11-04' },
      { login: 'author', state: 'APPROVED', submittedAt: '2026-11-01' },
    ];
    expect(approvers(reviews, 'Author')).toEqual(['a']);
  });
});

describe('acceptedBy', () => {
  it('returns who added the accepted label, unless it was removed since', () => {
    const labeled = { event: 'labeled', label: { name: 'accepted' }, actor: { login: 'RIDAM7' } };
    const unlabeled = { event: 'unlabeled', label: { name: 'accepted' }, actor: { login: 'bot' } };
    expect(acceptedBy([labeled])).toBe('RIDAM7');
    expect(acceptedBy([labeled, unlabeled])).toBeUndefined();
    expect(
      acceptedBy([{ event: 'labeled', label: { name: 'docs' }, actor: { login: 'x' } }]),
    ).toBeUndefined();
  });
});

describe('labelsFor', () => {
  it('labels kind, topic and proposals sent from the site', () => {
    expect(
      labelsFor(
        [
          { filename: 'cards/auth/nextjs-postgres.md', status: 'added' },
          { filename: 'cards/caching/nextjs-postgres.md', status: 'modified' },
          { filename: 'README.md', status: 'modified' },
          { filename: 'apps/web/app/page.tsx', status: 'modified' },
        ],
        'proposals/ada/auth-nextjs-postgres',
      ),
    ).toEqual([
      'card change',
      'code',
      'docs',
      'from the site',
      'new card',
      'topic: auth',
      'topic: caching',
    ]);
  });
});

describe('contentChanged', () => {
  const draft = readFileSync(new URL('../../fixtures/good/draft.md', import.meta.url), 'utf8');

  it('ignores the version and maintainer-only fields', () => {
    const promoted = draft
      .replace('status: draft', 'status: verified')
      .replace('card_version: 0.1.0', 'card_version: 1.0.0');
    expect(contentChanged(draft, promoted)).toBe(false);
  });

  it('notices frontmatter and body edits', () => {
    expect(
      contentChanged(
        draft,
        draft.replace('## Common mistakes', '## Common mistakes\n\n- New one.'),
      ),
    ).toBe(true);
    expect(contentChanged(draft, draft.replace(/^title: .*/m, 'title: Something else'))).toBe(true);
  });
});

describe('parseMaintainers', () => {
  it('reads handles and skips comments', () => {
    expect(parseMaintainers('# Maintainers\nRIDAM7\n\nalice # topic owner\n')).toEqual([
      'RIDAM7',
      'alice',
    ]);
  });
});

describe('proposerOf', () => {
  it('reads the site marker, else uses the author', () => {
    const body = ['<!-- mustlist-proposer: ada-l -->', 'Proposed by @ada-l'].join('\n');
    expect(proposerOf(body, 'mustlist-library[bot]')).toBe('ada-l');
    expect(proposerOf(null, 'bob')).toBe('bob');
  });
});
