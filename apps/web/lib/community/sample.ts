import type { ActivityEvent, CommunityData, Person, Proposal, Request } from './types';

/**
 * Sample community data, shown until requests and proposals are read from GitHub
 * (D-021, build step A). Every page that shows it says so. Card status and card
 * content always come from the real cards, never from here.
 */

export const SAMPLE_NOW = '2026-11-15T12:00:00Z';

export const PEOPLE: Person[] = [
  {
    handle: 'RIDAM7',
    role: 'maintainer',
    topics: ['auth', 'caching', 'payments-webhooks', 'rate-limiting'],
    tone: 1,
  },
  { handle: 'maya-k', role: 'reviewer', topics: ['auth', 'payments-webhooks'], tone: 4 },
  { handle: 'tomas-r', role: 'contributor', topics: [], tone: 2 },
  { handle: 'lena-dev', role: 'contributor', topics: [], tone: 3 },
];

/** The signed-in person in sample mode. */
export const SAMPLE_VIEWER = 'RIDAM7';

export const REQUESTS: Request[] = [
  {
    number: 42,
    title: 'Auth · Django + Next.js',
    topic: 'auth',
    stack: 'django-nextjs',
    author: 'lena-dev',
    created: '2026-11-09T09:12:00Z',
    updated: '2026-11-14T18:30:00Z',
    status: 'open',
    need: 24,
    body:
      'We run a Django REST backend with a Next.js App Router frontend on a separate subdomain. ' +
      'The Next.js + Postgres card assumes one app.\n\nNeeded:\n\n' +
      '- Session cookie or token when the API is on `api.` and the app on `app.`\n' +
      "- CSRF with Django's middleware and Next.js Server Actions\n" +
      '- Where to authorize: Django views, Next.js, or both',
    comments: [
      {
        id: 'c42-1',
        author: 'maya-k',
        date: '2026-11-09T11:40:00Z',
        body:
          'Most of the card carries over. New parts: cross-subdomain cookies and CSRF. ' +
          "I'd split the decisions by deployment: same parent domain vs different domains.",
        replies: [
          {
            id: 'c42-1a',
            author: 'lena-dev',
            date: '2026-11-09T13:02:00Z',
            body: 'Same parent domain for us: `app.example.com` and `api.example.com`.',
          },
        ],
      },
      {
        id: 'c42-2',
        author: 'tomas-r',
        date: '2026-11-10T08:15:00Z',
        body:
          "For same-site subdomains, Django's session cookie with `SameSite=Lax` plus " +
          '`CSRF_TRUSTED_ORIGINS` works. From Next.js:\n\n' +
          '```ts\nconst res = await fetch(`${API}/api/me`, {\n' +
          "  credentials: 'include',\n  headers: { 'X-CSRFToken': csrfToken },\n});\n```",
        replies: [
          {
            id: 'c42-2a',
            author: 'RIDAM7',
            date: '2026-11-10T10:20:00Z',
            body: 'Agreed. Same-site first; cross-domain becomes a decision with its own option.',
          },
        ],
      },
      {
        id: 'c42-3',
        author: 'maya-k',
        date: '2026-11-11T09:00:00Z',
        body:
          'Different registrable domains need tokens or a backend-for-frontend. ' +
          'Keep that as an option, not the default.',
        replies: [
          {
            id: 'c42-3a',
            author: 'tomas-r',
            date: '2026-11-11T09:45:00Z',
            body: 'A BFF route in Next.js keeps the cookie first-party.',
          },
        ],
      },
      {
        id: 'c42-4',
        author: 'RIDAM7',
        date: '2026-11-12T16:10:00Z',
        body: 'Draft decision: "Are the app and the API on the same parent domain?" Default: yes.',
        replies: [
          { id: 'c42-4a', author: 'lena-dev', date: '2026-11-12T17:00:00Z', body: 'Works for us.' },
        ],
      },
      {
        id: 'c42-5',
        author: 'lena-dev',
        date: '2026-11-14T18:30:00Z',
        body: "I'll start a proposal this week.",
      },
    ],
    proposals: [],
    related: ['auth/nextjs-postgres'],
  },
  {
    number: 38,
    title: 'Background jobs · Next.js + Postgres',
    topic: 'background-jobs',
    stack: 'nextjs-postgres',
    author: 'tomas-r',
    created: '2026-11-01T10:00:00Z',
    updated: '2026-11-12T12:41:00Z',
    status: 'in-progress',
    need: 17,
    body:
      'Emails, webhooks and exports run inside requests today. Needed: a queue in Postgres, ' +
      'retries that never double-charge, and what users see while a job runs.',
    comments: [
      {
        id: 'c38-1',
        author: 'maya-k',
        date: '2026-11-02T09:30:00Z',
        body: '`FOR UPDATE SKIP LOCKED` should be the default claim pattern.',
        replies: [
          {
            id: 'c38-1a',
            author: 'tomas-r',
            date: '2026-11-02T10:05:00Z',
            body: 'Yes, plus a unique key per logical job.',
          },
        ],
      },
      {
        id: 'c38-2',
        author: 'lena-dev',
        date: '2026-11-11T15:20:00Z',
        body: 'Started a proposal: #20.',
        replies: [
          {
            id: 'c38-2a',
            author: 'RIDAM7',
            date: '2026-11-11T16:00:00Z',
            body: 'Thanks. Ping me when checks pass.',
          },
          {
            id: 'c38-2b',
            author: 'maya-k',
            date: '2026-11-12T08:00:00Z',
            body: 'Happy to review.',
          },
          {
            id: 'c38-2c',
            author: 'tomas-r',
            date: '2026-11-12T09:10:00Z',
            body: 'Same.',
          },
        ],
      },
    ],
    proposals: [20],
    related: ['payments-webhooks/nextjs-postgres'],
  },
  {
    number: 44,
    title: 'Multi-tenancy · Next.js + Postgres',
    topic: 'multi-tenancy',
    stack: 'nextjs-postgres',
    author: 'maya-k',
    created: '2026-11-11T08:00:00Z',
    updated: '2026-11-13T19:00:00Z',
    status: 'open',
    need: 12,
    body:
      'B2B apps with many customers in one database. Needed: tenant id on every row, ' +
      'row-level security or query scoping, and how to test that one tenant never sees another.',
    comments: [
      {
        id: 'c44-1',
        author: 'tomas-r',
        date: '2026-11-11T12:00:00Z',
        body: 'Row-level security as the default, with a test that switches tenants mid-request.',
        replies: [
          {
            id: 'c44-1a',
            author: 'maya-k',
            date: '2026-11-11T13:30:00Z',
            body: 'Agreed. Schema-per-tenant can be an option.',
          },
        ],
      },
      {
        id: 'c44-2',
        author: 'lena-dev',
        date: '2026-11-13T19:00:00Z',
        body: 'Connection pooling with RLS needs `SET LOCAL` per transaction.',
        replies: [
          {
            id: 'c44-2a',
            author: 'RIDAM7',
            date: '2026-11-13T19:30:00Z',
            body: 'Good catch. That belongs in version notes.',
          },
        ],
      },
    ],
    proposals: [],
    related: ['auth/nextjs-postgres'],
  },
  {
    number: 45,
    title: 'Transactional email · any stack',
    topic: 'transactional-email',
    stack: 'any',
    author: 'lena-dev',
    created: '2026-11-13T07:30:00Z',
    updated: '2026-11-14T09:00:00Z',
    status: 'open',
    need: 8,
    body:
      'Verification, reset and receipt emails. Needed: SPF, DKIM and DMARC, bounces, ' +
      'and keeping links short-lived.',
    comments: [
      {
        id: 'c45-1',
        author: 'maya-k',
        date: '2026-11-13T10:00:00Z',
        body: 'Mostly stack-independent. Fine as `any`.',
      },
      {
        id: 'c45-2',
        author: 'tomas-r',
        date: '2026-11-14T09:00:00Z',
        body: 'Add a check for one-click unsubscribe on non-transactional mail.',
      },
    ],
    proposals: [],
    related: ['auth/nextjs-postgres'],
  },
  {
    number: 40,
    title: 'Idempotency keys · Next.js + Postgres',
    topic: 'idempotency-keys',
    stack: 'nextjs-postgres',
    author: 'tomas-r',
    created: '2026-11-05T14:00:00Z',
    updated: '2026-11-15T10:00:00Z',
    status: 'in-progress',
    need: 9,
    body: 'Safe retries for POST endpoints: store a key per request and replay the first response.',
    comments: [
      {
        id: 'c40-1',
        author: 'RIDAM7',
        date: '2026-11-06T09:00:00Z',
        body: 'Overlaps with payment webhooks; link both ways.',
      },
    ],
    proposals: [18],
    related: ['payments-webhooks/nextjs-postgres'],
  },
  {
    number: 51,
    title: 'Re-check: Payment webhooks · stripe-node 23 released',
    topic: 'payments-webhooks',
    stack: 'nextjs-postgres',
    author: 'RIDAM7',
    created: '2026-11-08T08:00:00Z',
    updated: '2026-11-13T12:00:00Z',
    status: 'in-progress',
    need: 5,
    body: 'stripe-node 23 is out, and the card passed 180 days. Re-check the version notes.',
    comments: [
      {
        id: 'c51-1',
        author: 'lena-dev',
        date: '2026-11-10T09:00:00Z',
        body: 'Taking this one: #17.',
      },
    ],
    proposals: [17],
    related: ['payments-webhooks/nextjs-postgres'],
  },
  {
    number: 31,
    title: 'Search · Next.js + Postgres',
    topic: 'search',
    stack: 'nextjs-postgres',
    author: 'tomas-r',
    created: '2026-10-12T10:00:00Z',
    updated: '2026-10-30T10:00:00Z',
    status: 'resolved',
    need: 15,
    body: 'Full-text search with `tsvector`, ranking, and when to move to a search service.',
    comments: [
      {
        id: 'c31-1',
        author: 'maya-k',
        date: '2026-10-13T10:00:00Z',
        body: 'Generated columns keep the `tsvector` in sync.',
        replies: [
          {
            id: 'c31-1a',
            author: 'tomas-r',
            date: '2026-10-13T11:00:00Z',
            body: 'And a GIN index on it.',
          },
        ],
      },
      {
        id: 'c31-2',
        author: 'RIDAM7',
        date: '2026-10-30T10:00:00Z',
        body: 'Accepted in #12. Closing as resolved.',
      },
    ],
    proposals: [],
    related: [],
  },
];

const PASSING_RUNS = [
  { name: 'Format', state: 'passing', note: 'Schema v1 · 0 warnings', seconds: 2 },
  { name: 'Safety', state: 'passing', note: 'No agent-directed text', seconds: 1 },
  { name: 'Links', state: 'passing', note: 'All links resolve · docs on allowlist', seconds: 6 },
] as const;

export const PROPOSALS: Proposal[] = [
  {
    number: 18,
    type: 'new-card',
    title: 'New card: Idempotency keys · Next.js + Postgres',
    topic: 'idempotency-keys',
    stack: 'nextjs-postgres',
    author: 'tomas-r',
    opened: '2026-11-14T09:00:00Z',
    updated: '2026-11-15T10:00:00Z',
    status: 'in-review',
    checks: 'passing',
    revisions: 2,
    request: 40,
    toVersion: '1.0.0',
    summary:
      'A new card for idempotent POST endpoints: a key per request stored with a unique ' +
      'constraint, the first response replayed, and keys that expire.',
    approvals: [
      { handle: 'maya-k', state: 'approved' },
      { handle: 'RIDAM7', state: 'requested' },
    ],
    timeline: [
      { label: 'Opened', meta: '@tomas-r · 14 Nov', state: 'done' },
      { label: 'Checks passed', meta: 'Revision 2 · 15 Nov', state: 'done' },
      { label: 'Approved', meta: '@maya-k · 15 Nov', state: 'done' },
      { label: 'Accepted', meta: 'Waiting for a maintainer approval', state: 'next' },
    ],
    checkRuns: [...PASSING_RUNS],
    checkedAt: '2026-11-15T09:40:00Z',
    changes: [
      {
        id: 'card',
        name: 'New card',
        short: '+1',
        summary: '7 checklist items · 2 options · 4 verify checks',
        rows: [
          { kind: 'add', caption: 'title', text: 'Idempotency keys for a Next.js + Postgres app' },
          {
            kind: 'add',
            caption: 'summary',
            text:
              'Require an `Idempotency-Key` header on retried POSTs, store it under a unique ' +
              'constraint with the first response, and replay that response for 24 hours.',
          },
        ],
      },
    ],
    reviews: [
      {
        id: 'r18-1',
        author: 'maya-k',
        date: '2026-11-15T08:00:00Z',
        verdict: 'approved',
        body: 'Clear and testable. The 24-hour expiry matches the Stripe docs it links.',
      },
    ],
  },
  {
    number: 17,
    type: 're-check',
    title: 'Re-check: Payment webhooks (Stripe, Razorpay) · Next.js + Postgres',
    topic: 'payments-webhooks',
    stack: 'nextjs-postgres',
    author: 'lena-dev',
    opened: '2026-11-10T09:30:00Z',
    updated: '2026-11-15T07:00:00Z',
    status: 'in-review',
    checks: 'passing',
    revisions: 3,
    cardId: 'payments-webhooks/nextjs-postgres',
    fromVersion: '1.0.0',
    toVersion: '1.1.0',
    request: 51,
    summary:
      'Re-checks the card against stripe-node 23 and Next.js 16, after the 180-day mark.\n\n' +
      '- Stripe entry moves to `>=23.0.0 <24.0.0`: thin vs snapshot parsing, Node 20 minimum\n' +
      '- Livemode check added to the checklist and verify checks\n' +
      '- Secret rotation item added (Should)',
    approvals: [
      { handle: 'maya-k', state: 'approved' },
      { handle: 'RIDAM7', state: 'requested' },
    ],
    timeline: [
      { label: 'Opened', meta: '@lena-dev · 10 Nov', state: 'done' },
      { label: 'Checks passed', meta: 'Revision 1 · 10 Nov', state: 'done' },
      {
        label: 'Changes requested',
        meta: '@maya-k · 11 Nov',
        note: 'Source for the 10-second Checkout redirect wait.',
        state: 'warn',
      },
      { label: 'Checks passed', meta: 'Revision 3 · 12 Nov', state: 'done' },
      { label: 'Approved', meta: '@maya-k · 13 Nov', state: 'done' },
      { label: 'Accepted', meta: 'Waiting for a maintainer approval', state: 'next' },
    ],
    checkRuns: [
      { name: 'Format', state: 'passing', note: 'Schema v1 · 0 warnings', seconds: 2 },
      {
        name: 'Safety',
        state: 'passing',
        note: 'No agent-directed text · 2 code blocks ≤ 15 lines',
        seconds: 1,
      },
      { name: 'Links', state: 'passing', note: '19 of 19 resolve · docs on allowlist', seconds: 8 },
    ],
    checkedAt: '2026-11-12T16:04:00Z',
    changeTotals: { fields: 6, added: 6, changed: 4, removed: 1 },
    changes: [
      {
        id: 'versions',
        name: 'Version notes',
        short: '+2 ~2',
        hint: 'stripe',
        summary: '1 changed range · 2 added · 1 changed',
        rows: [
          {
            kind: 'chg',
            caption: 'range',
            old: '>=20.0.0 <21.0.0',
            text: '>=23.0.0 <24.0.0',
            mono: true,
          },
          {
            kind: 'chg',
            caption: 'note 1',
            old: 'Use `stripe.webhooks.constructEvent(rawBody, signature, secret)`.',
            text:
              'Snapshot destinations: `stripe.webhooks.constructEvent(rawBody, signature, secret)`. ' +
              "Thin destinations (Stripe's recommended format): `stripe.parseEventNotification(...)`. " +
              'Since v21 the wrong method for the format throws.',
          },
          {
            kind: 'add',
            text:
              'v23 requires Node.js 20 or later; since v22 the default export is a true class, ' +
              'so create the client with `new Stripe(key)`.',
          },
          {
            kind: 'add',
            text:
              'Each major pins a newer API version (23.1.0 pins `2026-10-28.endive`); snapshot ' +
              "payloads follow the destination's API version, not the SDK's.",
          },
          { kind: 'same', text: '2 unchanged notes' },
        ],
      },
      {
        id: 'checklist',
        name: 'Checklist',
        short: '+1 ~1',
        summary: '1 added · 1 changed',
        rows: [
          {
            kind: 'chg',
            chips: { id: 'separate-test-live', lens: 'security', level: 'must' },
            old:
              'Use separate API keys and webhook secrets for test and live mode in server-only ' +
              'environment variables.',
            text:
              'Use separate API keys and webhook secrets for test and live mode in server-only ' +
              'environment variables; reject Stripe events whose `livemode` does not match.',
          },
          {
            kind: 'add',
            chips: { id: 'secret-rotation', lens: 'security', level: 'should' },
            text:
              'Accept the old and the new webhook secret during rotation, and rotate when a ' +
              'secret may have leaked or someone with access leaves.',
          },
        ],
        thread: {
          field: 'secret-rotation · why',
          comments: [
            {
              id: 't17-1',
              author: 'maya-k',
              date: '2026-11-11T10:00:00Z',
              body: 'Source for the 7-day overlap?',
            },
            {
              id: 't17-2',
              author: 'lena-dev',
              date: '2026-11-12T15:30:00Z',
              body: 'Added: Stripe webhooks doc, “Roll endpoint secrets”.',
            },
          ],
          resolvedBy: 'maya-k',
        },
      },
      {
        id: 'verify',
        name: 'Verify checks',
        short: '+1',
        summary: '1 added',
        rows: [
          {
            kind: 'add',
            chips: { id: 'livemode-mismatch', type: 'unit', lens: 'security' },
            text:
              'A test-mode deployment rejects a Stripe event with livemode true, and a live ' +
              'deployment rejects livemode false.',
          },
        ],
      },
      {
        id: 'options',
        name: 'Options',
        short: '+1',
        summary: 'Recommended: unchanged · 1 changed',
        rows: [
          {
            kind: 'add',
            caption: 'inline-after · trade-offs',
            text: "Bounded by the route's max duration on your platform",
          },
        ],
      },
      {
        id: 'sources',
        name: 'Sources',
        short: '+2 −1',
        summary: '2 added · 1 removed',
        rows: [
          {
            kind: 'add',
            text: 'Stripe: How events work (thin and snapshot events)',
            host: 'docs.stripe.com',
          },
          { kind: 'add', text: 'stripe-node changelog', host: 'github.com' },
          { kind: 'del', text: 'Stripe: Check webhook signatures', host: 'docs.stripe.com' },
        ],
      },
      {
        id: 'meta',
        name: 'Card metadata',
        short: '~2',
        summary: 'set by maintainers',
        maintainerOnly: true,
        rows: [
          {
            kind: 'chg',
            caption: 'card_version',
            old: '1.0.0',
            text: '1.1.0',
            mono: true,
            note: 'minor: version entry, checklist item, verify check',
          },
          {
            kind: 'chg',
            caption: 'last_verified',
            old: '2026-05-02',
            text: 'on accept',
            mono: true,
          },
        ],
      },
    ],
    reviews: [
      {
        id: 'r17-3',
        author: 'maya-k',
        date: '2026-11-13T11:00:00Z',
        verdict: 'approved',
        body:
          "Claims match the sources. Razorpay's 5-second timeout is on the best-practices page; " +
          'the 7-day Stripe overlap is on the webhooks page.',
      },
      {
        id: 'r17-2',
        author: 'tomas-r',
        date: '2026-11-12T17:00:00Z',
        verdict: 'comment',
        body: 'Checked `parseEventNotification` against stripe-node 23.1.0. Matches.',
      },
      {
        id: 'r17-1',
        author: 'maya-k',
        date: '2026-11-11T10:00:00Z',
        revision: 1,
        verdict: 'changes',
        body: 'Two claims need a source before this can pass.',
        notes: [
          {
            field: 'lenses.performance · paragraph 1',
            quote:
              '…Stripe Checkout waits up to 10 seconds for your `checkout.session.completed` response…',
            text: 'Source for the 10-second wait?',
            resolved: 'Resolved in revision 3',
          },
          {
            field: 'checklist.secret-rotation · why',
            text: 'Source for the 7-day overlap?',
            resolved: 'Resolved in revision 3',
          },
        ],
        replies: [
          {
            id: 'r17-1a',
            author: 'lena-dev',
            date: '2026-11-12T16:00:00Z',
            body: 'Both added to Sources. Revision 3 pushed.',
          },
        ],
      },
    ],
  },
  {
    number: 16,
    type: 'change',
    title: 'Change: Auth · add a passkeys option',
    topic: 'auth',
    stack: 'nextjs-postgres',
    author: 'maya-k',
    opened: '2026-11-12T08:00:00Z',
    updated: '2026-11-14T11:00:00Z',
    status: 'changes-requested',
    checks: 'failing',
    revisions: 2,
    cardId: 'auth/nextjs-postgres',
    summary:
      'Adds passkeys (WebAuthn) as a fourth option and an MFA answer that favours it.\n\n' +
      '- New option: passkeys first, password as fallback\n' +
      '- Decision "How should MFA work?" gains a passkeys answer',
    approvals: [
      { handle: 'RIDAM7', state: 'requested' },
      { handle: 'tomas-r', state: 'requested' },
    ],
    timeline: [
      { label: 'Opened', meta: '@maya-k · 12 Nov', state: 'done' },
      {
        label: 'Checks failed',
        meta: 'Revision 2 · 14 Nov',
        note: 'Links: 1 docs link is not on the allowlist.',
        state: 'warn',
      },
      {
        label: 'Changes requested',
        meta: '@RIDAM7 · 13 Nov',
        note: 'Link the WebAuthn spec, not a blog post.',
        state: 'warn',
      },
      { label: 'Accepted', meta: 'Needs passing checks and 2 approvals', state: 'next' },
    ],
    checkRuns: [
      { name: 'Format', state: 'passing', note: 'Schema v1 · 0 warnings', seconds: 2 },
      { name: 'Safety', state: 'passing', note: 'No agent-directed text', seconds: 1 },
      { name: 'Links', state: 'failing', note: '1 docs link not on the allowlist', seconds: 7 },
    ],
    checkedAt: '2026-11-14T11:00:00Z',
    changes: [
      {
        id: 'options',
        name: 'Options',
        short: '+1',
        summary: '1 added · recommended unchanged',
        rows: [
          {
            kind: 'add',
            caption: 'passkeys-first · name',
            text: 'Passkeys first, password as fallback',
          },
        ],
      },
      {
        id: 'decisions',
        name: 'Decisions',
        short: '+1',
        summary: '1 answer added',
        rows: [
          {
            kind: 'add',
            caption: 'mfa · answers',
            text: 'Passkeys for everyone, TOTP as backup',
          },
        ],
      },
    ],
    reviews: [
      {
        id: 'r16-1',
        author: 'RIDAM7',
        date: '2026-11-13T09:00:00Z',
        verdict: 'changes',
        body: 'Link the WebAuthn spec or the library docs, not a blog post.',
      },
    ],
  },
  {
    number: 19,
    type: 'version-update',
    title: 'Version update: Caching · Next.js 17',
    topic: 'caching',
    stack: 'nextjs-postgres',
    author: 'RIDAM7',
    opened: '2026-11-13T15:00:00Z',
    updated: '2026-11-14T12:00:00Z',
    status: 'approved',
    checks: 'passing',
    revisions: 1,
    cardId: 'caching/nextjs-postgres',
    summary: 'Adds a version entry for `next >=17.0.0` and links the upgrade guide.',
    approvals: [
      { handle: 'maya-k', state: 'approved' },
      { handle: 'tomas-r', state: 'approved' },
    ],
    timeline: [
      { label: 'Opened', meta: '@RIDAM7 · 13 Nov', state: 'done' },
      { label: 'Checks passed', meta: 'Revision 1 · 13 Nov', state: 'done' },
      { label: 'Approved', meta: '@maya-k, @tomas-r · 14 Nov', state: 'done' },
      { label: 'Accepted', meta: 'Ready for a maintainer', state: 'next' },
    ],
    checkRuns: [...PASSING_RUNS],
    checkedAt: '2026-11-13T15:10:00Z',
    changes: [
      {
        id: 'versions',
        name: 'Version notes',
        short: '+1',
        hint: 'next',
        summary: '1 range added',
        rows: [{ kind: 'add', caption: 'range', text: '>=17.0.0', mono: true }],
      },
    ],
    reviews: [
      {
        id: 'r19-1',
        author: 'maya-k',
        date: '2026-11-14T09:00:00Z',
        verdict: 'approved',
        body: 'Matches the upgrade guide.',
      },
      {
        id: 'r19-2',
        author: 'tomas-r',
        date: '2026-11-14T12:00:00Z',
        verdict: 'approved',
        body: 'Checked against a fresh Next.js 17 app.',
      },
    ],
  },
  {
    number: 20,
    type: 'new-card',
    title: 'New card: Background jobs · Next.js + Postgres',
    topic: 'background-jobs',
    stack: 'nextjs-postgres',
    author: 'lena-dev',
    opened: '2026-11-12T12:00:00Z',
    updated: '2026-11-12T12:41:00Z',
    status: 'draft',
    checks: 'running',
    revisions: 1,
    request: 38,
    toVersion: '1.0.0',
    summary: 'Postgres-backed jobs claimed with `FOR UPDATE SKIP LOCKED`, idempotent workers.',
    approvals: [],
    timeline: [
      { label: 'Opened as draft', meta: '@lena-dev · 12 Nov', state: 'done' },
      { label: 'Checks running', meta: 'Revision 1', state: 'next' },
    ],
    checkRuns: [
      { name: 'Format', state: 'failing', note: 'Verify: 2 checks, needs at least 3', seconds: 2 },
      { name: 'Safety', state: 'passing', note: 'No agent-directed text', seconds: 1 },
      { name: 'Links', state: 'running', note: 'Checking 6 links' },
    ],
    checkedAt: '2026-11-12T12:41:00Z',
    changes: [],
    reviews: [],
  },
  {
    number: 15,
    type: 'change',
    title: 'Change: Auth · NIST 800-63B-4 password rules',
    topic: 'auth',
    stack: 'nextjs-postgres',
    author: 'lena-dev',
    opened: '2026-11-08T10:00:00Z',
    updated: '2026-11-12T14:00:00Z',
    status: 'accepted',
    checks: 'passing',
    revisions: 2,
    cardId: 'auth/nextjs-postgres',
    summary: 'Updates password rules to NIST SP 800-63B-4 (final, July 2025).',
    approvals: [
      { handle: 'maya-k', state: 'approved' },
      { handle: 'RIDAM7', state: 'approved' },
    ],
    timeline: [
      { label: 'Opened', meta: '@lena-dev · 8 Nov', state: 'done' },
      { label: 'Checks passed', meta: 'Revision 2 · 10 Nov', state: 'done' },
      { label: 'Approved', meta: '@maya-k, @RIDAM7 · 12 Nov', state: 'done' },
      { label: 'Accepted', meta: '@RIDAM7 · 12 Nov', state: 'done' },
    ],
    checkRuns: [...PASSING_RUNS],
    checkedAt: '2026-11-10T09:00:00Z',
    changes: [
      {
        id: 'checklist',
        name: 'Checklist',
        short: '~1',
        summary: '1 changed',
        rows: [
          {
            kind: 'chg',
            chips: { id: 'password-rules', lens: 'security', level: 'should' },
            old: 'Require 8+ characters and block breached passwords.',
            text:
              'Require 15+ characters for password-only accounts (8+ if MFA is always required), ' +
              'allow at least 64, and block common and breached passwords.',
          },
        ],
      },
    ],
    reviews: [
      {
        id: 'r15-1',
        author: 'maya-k',
        date: '2026-11-11T10:00:00Z',
        verdict: 'approved',
        body: 'Matches sec. 3.1.1.2.',
      },
      {
        id: 'r15-2',
        author: 'RIDAM7',
        date: '2026-11-12T14:00:00Z',
        verdict: 'approved',
        body: 'Good to accept.',
      },
    ],
  },
];

export const ACTIVITY: ActivityEvent[] = [
  { actor: 'tomas-r', verb: 'opened', date: '2026-11-15T09:00:00Z', target: 'proposal:18' },
  { actor: 'maya-k', verb: 'approved', date: '2026-11-15T08:00:00Z', target: 'proposal:18' },
  { actor: 'lena-dev', verb: 'commented', date: '2026-11-14T18:30:00Z', target: 'request:42' },
  { actor: 'RIDAM7', verb: 'opened', date: '2026-11-13T15:00:00Z', target: 'proposal:19' },
  { actor: 'maya-k', verb: 'approved', date: '2026-11-13T11:00:00Z', target: 'proposal:17' },
  {
    actor: 'RIDAM7',
    verb: 'requested-changes',
    date: '2026-11-13T09:00:00Z',
    target: 'proposal:16',
  },
  { actor: 'RIDAM7', verb: 'accepted', date: '2026-11-12T14:00:00Z', target: 'proposal:15' },
  { actor: 'RIDAM7', verb: 'approved', date: '2026-11-12T14:00:00Z', target: 'proposal:15' },
  { actor: 'maya-k', verb: 'asked', date: '2026-11-11T08:00:00Z', target: 'request:44' },
  { actor: 'RIDAM7', verb: 'commented', date: '2026-11-10T10:20:00Z', target: 'request:42' },
  { actor: 'lena-dev', verb: 'opened', date: '2026-11-10T09:30:00Z', target: 'proposal:17' },
  { actor: 'RIDAM7', verb: 'asked', date: '2026-11-08T08:00:00Z', target: 'request:51' },
];

/** The whole sample as one dataset (used when no GitHub token is set). */
export function sampleCommunity(repo: string): CommunityData {
  return {
    source: 'sample',
    repo,
    fetchedAt: SAMPLE_NOW,
    now: SAMPLE_NOW,
    requestsEnabled: true,
    people: PEOPLE,
    requests: REQUESTS,
    proposals: PROPOSALS,
    activity: ACTIVITY,
  };
}
