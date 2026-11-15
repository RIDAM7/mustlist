import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { CardJSON } from '@mustlist/schema/types';
import { diffCards } from '@/lib/community/github/card-diff';
import {
  activityFrom,
  cardFileOf,
  linkedRequests,
  mapDiscussion,
  mapPullRequest,
  parseRequestTitle,
  peopleFrom,
  proposalStatus,
  readFormField,
  type GhDiscussion,
  type GhPullRequest,
} from '@/lib/community/github/map';
import { verifySignature } from '@/lib/community/github/webhook';
import { requestBody } from '@/lib/community/github/write';
import { stackTitle } from '@mustlist/schema/site';
import { topicName } from '@/lib/topics';
import { toneFor } from '@/lib/community';

const card = (overrides: Partial<CardJSON> = {}): CardJSON => ({
  id: 'auth/nextjs-postgres',
  title: 'Authentication for a Next.js + Postgres app',
  topic: 'auth',
  stack: ['nextjs', 'postgres'],
  summary: 'Use a maintained library.',
  status: 'verified',
  card_version: '1.0.0',
  last_verified: '2026-05-02',
  review_level: 'community',
  authors: ['RIDAM7'],
  reviewers: ['RIDAM7', 'maya-k'],
  url: '',
  markdown_url: '',
  applies_when: { app_types: ['web-app'], not_for: [] },
  related: [],
  checklist: [
    { id: 'hash', lens: 'security', level: 'must', text: 'Hash passwords with Argon2id.' },
    { id: 'cookie', lens: 'security', level: 'must', text: 'Use HttpOnly cookies.' },
  ],
  decisions: [],
  options: [
    { id: 'lib', name: 'Library', best_fit_when: ['Own your data'], avoid_when: [], tradeoffs: [] },
  ],
  recommended: 'lib',
  versions: [
    {
      package: 'stripe',
      range: '>=20.0.0 <21.0.0',
      notes: ['Use constructEvent.'],
      docs: 'https://docs.stripe.com/webhooks',
    },
  ],
  verify: [{ id: 'flags', lens: 'security', type: 'integration', check: 'Cookie flags are set.' }],
  sources: [
    { title: 'OWASP', url: 'https://cheatsheetseries.owasp.org/a' },
    { title: 'Stripe', url: 'https://docs.stripe.com/webhooks' },
  ],
  body: { why: 'Because.', lenses: {}, mistakes: '- One' },
  ...overrides,
});

describe('diffCards', () => {
  it('reports a new card with its size', () => {
    const { changes, totals } = diffCards(undefined, card());
    expect(changes[0]?.name).toBe('New card');
    expect(totals).toEqual({ fields: 1, added: 1, changed: 0, removed: 0 });
  });

  it('compares fields: added, changed and removed items', () => {
    const after = card({
      card_version: '1.1.0',
      checklist: [
        {
          id: 'hash',
          lens: 'security',
          level: 'must',
          text: 'Hash passwords with Argon2id or scrypt.',
        },
        { id: 'mfa', lens: 'security', level: 'should', text: 'Offer MFA.' },
      ],
      versions: [
        {
          package: 'stripe',
          range: '>=23.0.0 <24.0.0',
          notes: ['Use constructEvent.', 'Node 20 or later.'],
          docs: 'https://docs.stripe.com/webhooks',
        },
      ],
    });
    const { changes, totals } = diffCards(card(), after);
    const checklist = changes.find((c) => c.id === 'checklist');
    expect(checklist?.rows.map((r) => r.kind)).toEqual(['chg', 'add', 'del']);
    expect(checklist?.rows[0]?.old).toBe('Hash passwords with Argon2id.');
    const versions = changes.find((c) => c.id === 'versions');
    expect(versions?.rows.map((r) => [r.kind, r.caption])).toEqual([
      ['chg', 'stripe · range'],
      ['add', 'stripe >=23.0.0 <24.0.0'],
    ]);
    expect(changes.find((c) => c.id === 'meta')?.maintainerOnly).toBe(true);
    expect(totals.fields).toBe(3);
  });

  it('finds nothing when the card is unchanged', () => {
    expect(diffCards(card(), card()).changes).toEqual([]);
  });
});

describe('request discussions', () => {
  const discussion: GhDiscussion = {
    number: 42,
    title: 'Auth · Django + Next.js',
    body: '### Topic\n\nauth\n\n### Stack\n\ndjango-nextjs\n\n### What are you building?\n\nA B2B dashboard.',
    url: 'https://github.com/RIDAM7/mustlist/discussions/42',
    createdAt: '2026-11-09T09:00:00Z',
    updatedAt: '2026-11-10T09:00:00Z',
    upvoteCount: 24,
    closed: false,
    stateReason: null,
    isAnswered: false,
    author: { login: 'lena-dev' },
    labels: { nodes: [] },
    comments: {
      totalCount: 1,
      nodes: [
        {
          id: 'c1',
          url: 'https://github.com/RIDAM7/mustlist/discussions/42#discussioncomment-1',
          body: 'Same parent domain?',
          createdAt: '2026-11-11T09:00:00Z',
          author: { login: 'maya-k' },
          replies: {
            nodes: [
              { id: 'c2', url: '', body: 'Yes.', createdAt: '2026-11-11T10:00:00Z', author: null },
            ],
          },
        },
      ],
    },
  };

  it('reads form fields, the upvote count and the thread', () => {
    const request = mapDiscussion(discussion, {
      cardIds: ['auth/nextjs-postgres'],
      proposalsByRequest: new Map(),
    });
    expect(request).toMatchObject({
      topic: 'auth',
      stack: 'django-nextjs',
      need: 24,
      status: 'open',
    });
    expect(request.body).toBe('A B2B dashboard.');
    expect(request.related).toEqual(['auth/nextjs-postgres']);
    expect(request.comments[0]?.replies?.[0]?.author).toBe('ghost');
    expect(request.updated).toBe('2026-11-11T10:00:00Z');
  });

  it('marks requests in progress when a proposal links them, and resolved when closed as resolved', () => {
    const linked = new Map([[42, [{ number: 7, status: 'in-review' as const }]]]);
    expect(mapDiscussion(discussion, { cardIds: [], proposalsByRequest: linked }).status).toBe(
      'in-progress',
    );
    const closed = { ...discussion, closed: true, stateReason: 'RESOLVED' as const };
    expect(mapDiscussion(closed, { cardIds: [], proposalsByRequest: new Map() }).status).toBe(
      'resolved',
    );
    const duplicate = { ...discussion, closed: true, stateReason: 'DUPLICATE' as const };
    expect(mapDiscussion(duplicate, { cardIds: [], proposalsByRequest: new Map() }).status).toBe(
      'closed',
    );
  });

  it('falls back to the title when the form is missing', () => {
    expect(parseRequestTitle('Payment webhooks · Next.js + Postgres')).toEqual({
      topic: 'payments-webhooks',
      stack: 'nextjs-postgres',
    });
    expect(readFormField('### Stack\n\n_No response_', 'Stack')).toBeUndefined();
  });
});

describe('proposal pull requests', () => {
  const pr: GhPullRequest = {
    number: 7,
    title: 'Change: Auth · add MFA',
    body: '## What this changes\n\nAdds MFA. Request: #42\n\n## Checklist\n\n- [x] done',
    url: 'https://github.com/RIDAM7/mustlist/pull/7',
    createdAt: '2026-11-12T09:00:00Z',
    updatedAt: '2026-11-13T09:00:00Z',
    isDraft: false,
    state: 'OPEN',
    mergedAt: null,
    closedAt: null,
    author: { login: 'maya-k' },
    mergedBy: null,
    reviewDecision: 'REVIEW_REQUIRED',
    baseRefOid: 'base',
    headRefOid: 'head',
    labels: { nodes: [] },
    files: { nodes: [{ path: 'cards/auth/nextjs-postgres.md', changeType: 'MODIFIED' }] },
    commits: {
      totalCount: 2,
      nodes: [
        {
          commit: {
            committedDate: '2026-11-13T08:00:00Z',
            statusCheckRollup: {
              state: 'SUCCESS',
              contexts: {
                nodes: [
                  {
                    __typename: 'CheckRun',
                    name: 'Typecheck, lint, test, validate, build',
                    status: 'COMPLETED',
                    conclusion: 'SUCCESS',
                    startedAt: '2026-11-13T08:00:00Z',
                    completedAt: '2026-11-13T08:01:42Z',
                    title: null,
                  },
                ],
              },
            },
          },
        },
      ],
    },
    reviewRequests: { nodes: [{ requestedReviewer: { login: 'RIDAM7' } }] },
    reviews: {
      nodes: [
        {
          id: 'r1',
          author: { login: 'tomas-r' },
          state: 'APPROVED',
          body: 'Looks right.',
          submittedAt: '2026-11-13T09:00:00Z',
          comments: {
            nodes: [{ path: 'cards/auth/nextjs-postgres.md', line: 12, body: 'Source?' }],
          },
        },
      ],
    },
  };

  it('maps a card pull request to a proposal', () => {
    const before = card();
    const after = card({ card_version: '1.1.0', summary: 'Use a maintained library, with MFA.' });
    const proposal = mapPullRequest(pr, {
      base: before,
      head: after,
      requestNumbers: new Set([42]),
    });
    expect(proposal).toMatchObject({
      number: 7,
      type: 'change',
      status: 'in-review',
      checks: 'passing',
      revisions: 2,
      cardId: 'auth/nextjs-postgres',
      fromVersion: '1.0.0',
      toVersion: '1.1.0',
      request: 42,
      summary: 'Adds MFA. Request: #42',
    });
    expect(proposal?.approvals).toEqual([
      { handle: 'tomas-r', state: 'approved' },
      { handle: 'RIDAM7', state: 'requested' },
    ]);
    expect(proposal?.checkRuns[0]).toMatchObject({ state: 'passing', seconds: 102 });
    expect(proposal?.reviews[0]?.notes?.[0]?.field).toBe('cards/auth/nextjs-postgres.md · line 12');
    expect(proposal?.timeline.at(-1)).toMatchObject({ label: 'Accepted', state: 'next' });
    expect(proposal?.previewCard).toBe(after);
  });

  it('skips pull requests that do not change a card, and infers new cards', () => {
    expect(
      mapPullRequest(
        { ...pr, files: { nodes: [{ path: 'apps/web/x.ts', changeType: 'MODIFIED' }] } },
        { requestNumbers: new Set() },
      ),
    ).toBeUndefined();
    const added = {
      ...pr,
      files: { nodes: [{ path: 'cards/jobs/nextjs-postgres.md', changeType: 'ADDED' }] },
    };
    expect(mapPullRequest(added, { requestNumbers: new Set() })?.type).toBe('new-card');
    expect(cardFileOf(added)).toMatchObject({
      topic: 'jobs',
      stack: 'nextjs-postgres',
      added: true,
    });
  });

  it('turns review state into proposal status', () => {
    expect(proposalStatus({ state: 'MERGED', isDraft: false, reviewDecision: null })).toBe(
      'accepted',
    );
    expect(proposalStatus({ state: 'OPEN', isDraft: true, reviewDecision: null })).toBe('draft');
    expect(
      proposalStatus({ state: 'OPEN', isDraft: false, reviewDecision: 'CHANGES_REQUESTED' }),
    ).toBe('changes-requested');
  });

  it('finds the requests a pull request resolves', () => {
    const known = new Set([42, 51]);
    expect(linkedRequests('Resolves request #42', known)).toEqual([42]);
    expect(linkedRequests('See https://github.com/x/y/discussions/51 and #99', known)).toEqual([
      51,
    ]);
  });

  it('builds activity from discussions and pull requests', () => {
    const events = activityFrom([], [pr], new Set([7]));
    expect(events.map((e) => e.verb)).toEqual(['approved', 'opened']);
  });
});

describe('people and webhooks', () => {
  it('reads maintainers and topic reviewers', () => {
    const people = peopleFrom(
      '# Maintainers\nRIDAM7\n',
      'cards/** @RIDAM7\ncards/auth/** @maya-k @org/team\n',
      toneFor,
    );
    expect(people).toEqual([
      { handle: 'RIDAM7', role: 'maintainer', topics: [], tone: 1 },
      { handle: 'maya-k', role: 'reviewer', topics: ['auth'], tone: 4 },
    ]);
  });

  it('accepts only correctly signed deliveries', () => {
    const body = '{"action":"created"}';
    const signature = `sha256=${createHmac('sha256', 'secret').update(body).digest('hex')}`;
    expect(verifySignature(body, signature, 'secret')).toBe(true);
    expect(verifySignature(body, signature, 'other')).toBe(false);
    expect(verifySignature(`${body} `, signature, 'secret')).toBe(false);
    expect(verifySignature(body, null, 'secret')).toBe(false);
  });
});

describe('requests posted from the site', () => {
  it('read back like requests from the GitHub form', () => {
    const body = requestBody({
      topic: 'background-jobs',
      stack: 'nextjs-postgres',
      what: 'Nightly exports.',
    });
    expect(readFormField(body, 'Topic')).toBe('background-jobs');
    expect(readFormField(body, 'Stack')).toBe('nextjs-postgres');
    expect(readFormField(body, 'What are you building?')).toBe('Nightly exports.');
    const title = `${topicName('background-jobs')} · ${stackTitle('nextjs-postgres')}`;
    expect(parseRequestTitle(title)).toEqual({
      topic: 'background-jobs',
      stack: 'nextjs-postgres',
    });
  });
});
