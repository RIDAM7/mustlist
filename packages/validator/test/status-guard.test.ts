import { describe, expect, it } from 'vitest';
import type { CardFrontmatter } from '@mustlist/schema';
import {
  checkStatusGuard,
  maintainerChanges,
  type StatusGuardInput,
} from '../src/rules/status-guard';
import { createCardContext } from '../src/validate';
import { fixtureInput } from './helpers';

const data = (relative: string): CardFrontmatter => {
  const parsed = createCardContext(fixtureInput(relative)).data;
  if (!parsed) throw new Error(`${relative} does not parse`);
  return parsed;
};

const draft = data('good/draft.md');
const verified = data('good/verified.md');
const promoted: CardFrontmatter = {
  ...draft,
  status: 'verified',
  card_version: '1.0.0',
  last_verified: '2026-11-17',
  review_level: 'seed',
  reviewers: ['RIDAM7'],
};

const base: StatusGuardInput = {
  filePath: 'cards/example/nextjs-postgres.md',
  before: draft,
  after: draft,
  author: 'someone',
  maintainers: ['RIDAM7'],
  approvers: [],
  acceptedBy: undefined,
  contentChanged: false,
};
const messages = (input: Partial<StatusGuardInput>) =>
  checkStatusGuard({ ...base, ...input }).map((item) => item.message);

describe('maintainerChanges', () => {
  it('lists status, reviewer and date changes, and deleting a reviewed card', () => {
    expect(maintainerChanges(draft, promoted)).toEqual([
      'sets status: verified',
      'changes reviewers',
      'changes review_level',
      'changes last_verified',
    ]);
    expect(maintainerChanges(draft, { ...draft, status: 'proposed' })).toEqual([]);
    expect(maintainerChanges(verified, undefined)).toEqual(['deletes a verified card']);
    expect(maintainerChanges(undefined, { ...promoted })).toContain('sets status: verified');
  });
});

describe('checkStatusGuard', () => {
  it('passes content-only changes from anyone when card_version goes up', () => {
    expect(messages({ after: { ...draft, card_version: '0.2.0' }, contentChanged: true })).toEqual(
      [],
    );
  });

  it('requires card_version to increase when content changes', () => {
    expect(messages({ contentChanged: true })[0]).toMatch(/card_version must increase/);
  });

  it('stops contributors from verifying a card', () => {
    const [message] = messages({ after: promoted, approvers: ['RIDAM7'] });
    expect(message).toMatch(/Only maintainers can do this/);
  });

  it('accepts a promotion when a maintainer accepted and every reviewer approved', () => {
    expect(messages({ after: promoted, approvers: ['ridam7'], acceptedBy: 'RIDAM7' })).toEqual([]);
  });

  it('ignores an accepted label added by someone who is not a maintainer', () => {
    expect(messages({ after: promoted, approvers: ['RIDAM7'], acceptedBy: 'someone' })[0]).toMatch(
      /Only maintainers/,
    );
  });

  it('needs an approval from every listed reviewer', () => {
    const after = {
      ...promoted,
      review_level: 'community' as const,
      reviewers: ['RIDAM7', 'alice'],
    };
    expect(messages({ after, approvers: ['RIDAM7'], acceptedBy: 'RIDAM7' })).toEqual([
      'Every reviewer must approve the pull request; no approval from: alice.',
    ]);
  });

  it('lets a maintainer author count as their own reviewer', () => {
    expect(messages({ after: promoted, author: 'RIDAM7' })).toEqual([]);
  });

  it('needs a maintainer among the reviewers', () => {
    const after = { ...promoted, reviewers: ['alice'] };
    expect(messages({ after, approvers: ['alice'], acceptedBy: 'RIDAM7' })).toEqual([
      'At least one reviewer of a verified card must be a maintainer.',
    ]);
  });

  it('stops contributors from deleting a verified card', () => {
    expect(messages({ before: verified, after: undefined })[0]).toMatch(/deletes a verified card/);
  });
});
