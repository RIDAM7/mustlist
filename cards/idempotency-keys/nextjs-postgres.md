---
id: idempotency-keys/nextjs-postgres
title: Idempotency keys for retry-safe writes in a Next.js + Postgres app
topic: idempotency-keys
stack: [nextjs, postgres, typescript]
summary: >-
  Clients send one Idempotency-Key per intent with each POST or Server Action.
  Store it in Postgres, unique per account, with a request hash and the
  response, in the write's transaction. Replay finished keys; return 409 while
  one runs and 422 for a changed body.
status: verified
card_version: 1.0.0
last_verified: 2026-11-15
review_level: seed
authors: [RIDAM7]
reviewers: [RIDAM7]
lenses: [security, performance, ux, data, cost]
applies_when:
  app_types: [web-app, saas, e-commerce, marketplace, public-api, mobile-backend]
  not_for: [read-only-apps, static-site-without-server-endpoints]
related:
  - payments-webhooks/nextjs-postgres
  - background-jobs/nextjs-postgres
  - connection-pooling/nextjs-postgres
  - rate-limiting/nextjs-postgres
  - auth/nextjs-postgres

checklist:
  - id: key-per-intent
    lens: ux
    level: must
    text: Generate one key per user intent on the client (a v4 UUID), save it with any queued request, reuse it on every retry, and create a new one only for a new intent.
    why: A new key on each retry turns every retry into a new order.
  - id: require-key
    lens: security
    level: must
    text: Require an `Idempotency-Key` on POST endpoints that create orders, payments or other records that must not be duplicated, and answer a missing key with 400.
    why: The IETF draft specifies 400 when an operation documented as needing a key gets none.
  - id: validate-key-format
    lens: security
    level: must
    text: Accept only one documented key format (for example a UUID, quoted or bare) and reject anything else with 400 before any database lookup.
    why: The IETF draft warns that unvalidated keys invite injection and low-entropy keys let attackers guess other clients' keys.
  - id: scope-per-account
    lens: security
    level: must
    text: Make the unique key (account_id, key), or (session or cart id, key) for guests; never a key column that is unique across all users.
    why: With a global key, anyone who learns a key can read another account's stored response.
  - id: fingerprint-422
    lens: data
    level: must
    text: Store a SHA-256 hash of method, route and the validated body in canonical form; answer a known key with a different hash with 422.
    why: The IETF draft specifies 422 for a key reused with a different payload; Stripe also rejects changed parameters.
  - id: claim-with-write
    lens: data
    level: must
    text: For Postgres-only work, insert the key row (ON CONFLICT DO NOTHING), run the business writes and save the response in one transaction.
    why: A crash then rolls back all three, so no key stays locked and no order exists without its stored response.
  - id: concurrent-409
    lens: ux
    level: must
    text: Answer a duplicate that arrives while the first request is still running with 409 and Retry-After, and set `lock_timeout` so it never waits indefinitely.
    why: The IETF draft and Stripe (`idempotency_key_in_use`) use 409 here; Postgres waits forever by default.
  - id: replay-response
    lens: ux
    level: must
    text: For a completed key, return the stored status code, body and Location header instead of running the handler again.
    why: The retry then shows the result of the first attempt, such as the order it created.
  - id: what-to-store
    lens: data
    level: must
    text: Store final 2xx results and deterministic business errors; store nothing for auth, validation, rate-limit or key errors, and let unexpected errors roll back.
    why: Stripe saves no result when execution never began; a stored 500 from a rolled-back write blocks a retry that is safe.
  - id: external-call-steps
    lens: data
    level: must
    text: "Never hold a transaction open across a payment or email API call: commit a started row, call the provider with a key derived from your operation id, then commit the result."
    why: stripe-node creates a new key on every call, so a retried handler without your own key can charge twice.
  - id: lease-recovery
    lens: data
    level: should
    text: Give started rows a `locked_at` lease; once it expires, let a retry take over and resume from the last committed step with the same downstream keys.
    why: A function that times out mid-request otherwise leaves the key locked until cleanup.
  - id: retention-window
    lens: data
    level: must
    text: Keep keys for at least 24 hours and longer than your clients' longest retry window, delete older rows with a scheduled job, and document the window.
    why: Stripe keeps keys for at least 24 hours; the IETF draft asks servers to publish their expiry policy.
  - id: natural-backstop
    lens: data
    level: should
    text: Also put a natural unique constraint on the business row, such as one order per cart or checkout id, so a retry after its key expired still cannot duplicate it.
  - id: pending-button
    lens: ux
    level: should
    text: Disable submit buttons while a Server Action is pending, but rely on the key, not the button, to stop duplicates.
    why: A reload, a network retry or a direct POST bypasses a disabled button.
  - id: minimal-stored-response
    lens: security
    level: should
    text: Store only what a replay needs; never store Set-Cookie headers, session tokens or card data, and delete stored responses together with their key.

decisions:
  - id: callers
    question: Which clients send the writes that must be safe to retry?
    options:
      - { id: browser-only, label: "Only this app's browser forms and Server Actions" }
      - { id: api-clients, label: "Mobile apps, SDKs or third-party API clients", points_to: postgres-table }
      - { id: internal-workers, label: "Background jobs or queue consumers inside the same system" }
  - id: side-effects
    question: Does the write call an external API, such as a payment provider or email service, before it returns?
    options:
      - { id: postgres-only, label: "No, it only writes to Postgres (one transaction covers it)" }
      - { id: external-api, label: "Yes, it calls a payment provider or another API (commit in steps)" }
  - id: natural-id
    question: Does each operation already have a stable unique id, such as a cart, checkout or client-generated order id?
    options:
      - { id: has-natural-id, label: "Yes, and the write creates one row with no other side effects", points_to: natural-unique }
      - { id: no-natural-id, label: "No, or the handler does several things", points_to: postgres-table }
    default: no-natural-id
  - id: redis-in-stack
    question: Do you already run Redis, and is the protected work outside Postgres?
    options:
      - { id: redis-non-postgres, label: "Yes, Redis is in the stack and the work is not a Postgres write", points_to: redis-store }
      - { id: postgres-work, label: "No, the work writes to Postgres", points_to: postgres-table }
    default: postgres-work
  - id: retry-window
    question: How long after the first attempt can a client retry?
    options:
      - { id: minutes, label: "Minutes: browser retries and double submits (keep keys for 24 hours)" }
      - { id: days, label: "Days: offline mobile queues or delayed jobs (keep keys longer than the longest retry)" }
    default: minutes

options:
  - id: postgres-table
    name: Postgres idempotency-key table with a stored response
    best_fit_when:
      - Writes create orders, payments or other records that must not be duplicated
      - Mobile apps, SDKs or API clients retry with an Idempotency-Key header
      - You want the key, the business rows and the stored response to commit together
    avoid_when:
      - One natural unique id already identifies a single-row write and no stored response is needed
      - Write rates are high enough that an extra row per request strains the primary database
    tradeoffs:
      - One extra insert and update per protected request, plus a cleanup job
      - You own lock leases, recovery steps and the retention policy
  - id: redis-store
    name: Redis key store (SET NX with an expiry)
    examples: [Redis, Valkey, Upstash Redis]
    best_fit_when:
      - You already run Redis and the protected work is not a Postgres write
      - Very high request rates on endpoints whose work can be repeated safely after a crash
    avoid_when:
      - The work writes to Postgres and must commit together with the key
      - Your Redis evicts keys under memory pressure (any policy other than noeviction)
    tradeoffs:
      - The key and the business write cannot commit atomically, so a crash between them leaves a stuck lock or a lost response
      - Another service to pay for, secure and monitor
  - id: natural-unique
    name: Natural unique constraint only (no key table)
    best_fit_when:
      - The write creates one row with a stable id, such as one order per cart or a client-generated order id
      - Browser-only forms where a retry can simply return the existing record
    avoid_when:
      - The handler has several side effects or calls external APIs
      - You must detect a key reused with a different body (422)
    tradeoffs:
      - No stored response; a retry sees the record's current state, not the original response
      - Nothing expires, so the protection never lapses
recommended: postgres-table

versions:
  - package: next
    range: ">=16.0.0 <17.0.0"
    notes:
      - "Server Actions are public POST endpoints. The client sends them one at a time, but the server neither queues nor deduplicates them: check the key inside each action."
      - "`experimental.useOffline` (16.3+) re-sends a Server Action whose request failed, including one already in flight; if the first attempt reached the server, it runs twice."
      - "In `'use cache'` scopes (Cache Components), `crypto.randomUUID()` is captured once for every visitor: generate keys in the browser."
    docs: https://nextjs.org/docs/app/guides/server-actions
    context7: https://context7.com/vercel/next.js
  - package: stripe
    range: ">=23.0.0 <24.0.0"
    notes:
      - "Pass your own key per call, `stripe.paymentIntents.create(params, { idempotencyKey })`, derived from your operation; the SDK's automatic key covers only its own retries."
      - "v1 keeps keys at least 24 hours and replays the first result, including 500s; changed parameters give `idempotency_error`, and a running request gives 409 `idempotency_key_in_use`."
      - "After a 500 or a timeout, retry with the same key or reconcile through webhooks; never retry with a new key while the outcome is unknown."
    docs: https://docs.stripe.com/api/idempotent_requests
    context7: https://context7.com/stripe/stripe-node
  - package: postgresql
    range: ">=14.0.0"
    notes:
      - "An INSERT that conflicts with an uncommitted row waits for that transaction, and `ON CONFLICT DO NOTHING ... RETURNING` returns no row for an existing key."
      - "That wait is a lock on the first transaction's id, which `lock_timeout` (default 0) covers: `SET LOCAL lock_timeout` makes a duplicate fail fast with 55P03, for a 409."
      - "`idle_in_transaction_session_timeout` also defaults to 0, so a transaction left open across an API call keeps its locks."
    docs: https://www.postgresql.org/docs/current/sql-insert.html

verify:
  - id: replay-same-response
    lens: data
    type: integration
    check: Sending the same POST twice with one key creates one order, and the second response has the same status code and body as the first.
  - id: concurrent-one-execution
    lens: data
    type: integration
    check: Ten concurrent requests with one key create exactly one order; every other request gets the replayed response or 409 with Retry-After, never a 5xx.
  - id: changed-body-422
    lens: security
    type: integration
    check: Reusing a key with a different body, or on a different route, returns 422 and writes nothing.
  - id: cross-account-isolated
    lens: security
    type: integration
    check: When account B sends a key that account A already used, B's request runs as its own and never receives A's stored response.
  - id: missing-or-bad-key-400
    lens: security
    type: integration
    check: An endpoint that requires a key returns 400 for a missing key or one outside the documented format, and creates no key row.
  - id: validation-not-stored
    lens: data
    type: integration
    check: A request that fails validation leaves no key row, so a corrected request with the same key succeeds.
  - id: crash-rolls-back
    lens: data
    type: integration
    check: An error thrown after the business insert but before commit leaves neither an order nor a key row, and a retry with the same key creates exactly one order.
  - id: resume-after-lease
    lens: data
    type: integration
    check: If the process dies right after the payment provider call, a retry after the lease expires reuses the same provider key and ends with one provider payment.
  - id: double-click-once
    lens: ux
    type: e2e
    check: Double-clicking submit on a Server Action form, and resubmitting after a simulated network failure, each create only one record.
  - id: key-unique-per-visitor
    lens: security
    type: e2e
    check: Two visitors who load the same form page get different keys, showing that no key is captured in a prerendered or cached shell.
  - id: cleanup-and-backstop
    lens: data
    type: integration
    check: The cleanup job deletes keys older than the retention window and keeps newer ones; after a key is deleted, the natural unique constraint still blocks a duplicate order.
  - id: no-secrets-stored
    lens: security
    type: unit
    check: Stored responses contain no Set-Cookie header, session token or payment card data.

sources:
  - { title: "IETF draft-ietf-httpapi-idempotency-key-header (The Idempotency-Key HTTP Header Field)", url: "https://datatracker.ietf.org/doc/draft-ietf-httpapi-idempotency-key-header/" }
  - { title: "RFC 9110, Section 9.2.2: Idempotent Methods", url: "https://www.rfc-editor.org/rfc/rfc9110#section-9.2.2" }
  - { title: "RFC 9110, Section 15.5.10: 409 Conflict", url: "https://www.rfc-editor.org/rfc/rfc9110#section-15.5.10" }
  - { title: "RFC 9110, Section 15.5.21: 422 Unprocessable Content", url: "https://www.rfc-editor.org/rfc/rfc9110#section-15.5.21" }
  - { title: "RFC 9457: Problem Details for HTTP APIs", url: "https://www.rfc-editor.org/rfc/rfc9457" }
  - { title: "Stripe API: Idempotent requests", url: "https://docs.stripe.com/api/idempotent_requests" }
  - { title: "Stripe: Advanced error handling (idempotency and retries)", url: "https://docs.stripe.com/error-low-level" }
  - { title: "Stripe: API v2 overview (idempotency)", url: "https://docs.stripe.com/api-v2-overview" }
  - { title: "Stripe API: Errors (idempotency_error)", url: "https://docs.stripe.com/api/errors" }
  - { title: "Stripe: Error codes (idempotency_key_in_use)", url: "https://docs.stripe.com/error-codes" }
  - { title: "stripe-node wiki: Passing options", url: "https://github.com/stripe/stripe-node/wiki/Passing-Options" }
  - { title: "Next.js Server Actions and Mutations guide", url: "https://nextjs.org/docs/app/guides/server-actions" }
  - { title: "Next.js Mutating data (pending state)", url: "https://nextjs.org/docs/app/getting-started/mutating-data" }
  - { title: "Next.js useOffline config (how retry works)", url: "https://nextjs.org/docs/app/api-reference/config/next-config-js/useOffline" }
  - { title: "Next.js Caching (random values and timestamps)", url: "https://nextjs.org/docs/app/getting-started/caching" }
  - { title: "MDN Crypto.randomUUID()", url: "https://developer.mozilla.org/en-US/docs/Web/API/Crypto/randomUUID" }
  - { title: "PostgreSQL INSERT (ON CONFLICT, RETURNING)", url: "https://www.postgresql.org/docs/current/sql-insert.html" }
  - { title: "PostgreSQL Index Uniqueness Checks", url: "https://www.postgresql.org/docs/current/index-unique-checks.html" }
  - { title: "PostgreSQL Client Connection Defaults (lock_timeout)", url: "https://www.postgresql.org/docs/current/runtime-config-client.html" }
  - { title: "PostgreSQL pg_locks (waiting on another transaction's id)", url: "https://www.postgresql.org/docs/current/view-pg-locks.html" }
  - { title: "PostgreSQL Error Codes", url: "https://www.postgresql.org/docs/current/errcodes-appendix.html" }
  - { title: "Redis SET command (NX, EX)", url: "https://redis.io/docs/latest/commands/set/" }
  - { title: "Redis key eviction policies", url: "https://redis.io/docs/latest/develop/reference/eviction/" }
---

## Why this approach

Networks drop responses, users double-click, and mobile apps and job queues retry, so any POST that creates an order or payment can run twice. With an idempotency key, a retry becomes a lookup: the client sends one key per intent, and the server stores the key, a request hash and the final response, unique per account. In the same Postgres database, the key, the business rows and the stored response commit in one transaction, so a crash never leaves half a result. Use a natural unique constraint alone when one stable id identifies a single-row write, and Redis only when the work is not in Postgres.

## Lenses

### Security

Treat the key as untrusted input and check it against one documented format before any query: the IETF draft warns that unvalidated keys invite injection and low-entropy keys let attackers guess other clients' keys. The draft's value is a Structured Field String, quoted on the wire, while Stripe-style clients send it bare, so strip the quotes and accept both. Authenticate and authorize before claiming a key, and scope every lookup by account (or session or cart id for guests), so no key alone selects someone else's stored response. Never build keys from email addresses or other personal data, as Stripe also advises. Keep only what a replay needs in stored responses. When calling Stripe or another provider, send a stable key derived from the operation, never a fresh UUID per attempt.

### Performance & latency

A key adds one primary-key insert and one update to the write's transaction. The cost that matters is waiting: a duplicate blocks on the unique index until the first transaction ends, holding a pooled connection and a running function, so cap it with `lock_timeout` and map error 55P03 to 409.

```ts
await client.query('BEGIN');
await client.query("SET LOCAL lock_timeout = '3s'");
const claim = await client.query(
  `INSERT INTO idempotency_keys (account_id, key, request_hash)
   VALUES ($1, $2, $3) ON CONFLICT DO NOTHING RETURNING key`,
  [accountId, key, requestHash],
);
if (claim.rowCount === 0) return replayOrConflict(client, accountId, key, requestHash); // then ROLLBACK
const order = await insertOrder(client, input); // same transaction
await client.query(
  `UPDATE idempotency_keys SET status = 'completed', response_code = 201, response_body = $3
   WHERE account_id = $1 AND key = $2`, [accountId, key, order]);
await client.query('COMMIT');
```

Keep provider calls, email and PDF rendering out of that transaction.

### UX flows

Never show users an error for their own retry: on a replay, show the original result, such as the order confirmation. On 409, stay pending and retry after `Retry-After` with backoff; log a 422 as a client bug. In a Server Action form, create the key in a Client Component on the first submit, keep it in a ref so a resubmit reuses it, and clear it after success or when the user edits the form. Next.js dispatches one client's Server Actions one at a time, so a double click runs the action twice in a row and the second run gets the replay; still disable the button with the `pending` flag from `useActionState`. Mobile apps should store the key with each queued request and retry with exponential backoff and jitter. Queue consumers deliver at least once, so key jobs by job or message id; inbound webhooks use the provider's event id.

### Data model

```sql
CREATE TABLE idempotency_keys (
  account_id    uuid        NOT NULL,
  key           text        NOT NULL CHECK (length(key) <= 255),
  request_hash  bytea       NOT NULL,
  status        text        NOT NULL DEFAULT 'started',
  step          text,
  response_code int,
  response_body jsonb,
  locked_at     timestamptz NOT NULL DEFAULT now(),
  created_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (account_id, key)
);
CREATE INDEX ON idempotency_keys (created_at);
```

`status` moves from `started` to `completed`; `step` records the last committed step when a handler calls external APIs, so a retry can resume. Hash the method, the route and the validated body serialized with sorted keys, leaving out the key itself. For large responses, store the resource id and re-read it on replay. Delete expired rows in batches from a scheduled job; Stripe keeps v1 keys for at least 24 hours and treats v2 keys as replays for 30 days. Keep natural unique constraints such as `UNIQUE (cart_id)` on orders, because a retry that arrives after its key was deleted runs again.

### Cost

The table costs storage and some write load: one row per protected request, plus response bodies, until cleanup removes them (roughly protected requests per day times retention days). The larger costs are indirect. Duplicates blocked on the unique index hold functions and pooled connections, which serverless platforms bill by duration, so keep `lock_timeout` short. A Redis store adds a service billed by command or by capacity, plus another system to secure and monitor. A duplicated order or charge brings refunds and support work that cost more than the table.

## Common mistakes

- Generating a new key on every retry, or on the server per request, so retries never match.
- A unique index on `key` alone, which lets one account replay another account's response.
- Checking for the key with a SELECT and then inserting, so two concurrent requests both run.
- Saving the response in a later transaction, so a crash leaves an order without a stored response and the retry creates another.
- Storing a 500 from a rolled-back transaction, which blocks a retry that would have been safe.
- Holding a transaction open across a Stripe call, or calling Stripe without your own key.
- Running the handler again for a duplicate that arrives mid-flight instead of returning 409.
- Deleting keys after a few minutes, shorter than mobile and queue retry windows.
- Turning on `experimental.useOffline` before Server Actions are idempotent.

## Further reading

- [Implementing Stripe-like Idempotency Keys in Postgres (brandur.org)](https://brandur.org/idempotency-keys)
- [Stripe blog: Designing robust and predictable APIs with idempotency](https://stripe.com/blog/idempotency)
