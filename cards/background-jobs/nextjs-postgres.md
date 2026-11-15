---
id: background-jobs/nextjs-postgres
title: Background jobs and queues for a Next.js + Postgres app
topic: background-jobs
stack: [nextjs, postgres, typescript]
summary: >-
  Enqueue each job in the same Postgres transaction as its write and run it in a
  separate long-running worker (pg-boss or Graphile Worker). Make handlers
  idempotent, retry with capped backoff, keep failed jobs to replay, and never
  treat after() as a queue.
status: draft
card_version: 0.1.0
last_verified: null
review_level: null
authors: [RIDAM7]
reviewers: []
lenses: [security, performance, ux, data, cost]
applies_when:
  app_types: [web-app, saas, e-commerce, marketplace, internal-tool]
  not_for: [static-site-without-backend, high-volume-event-streaming]
related:
  - payments-webhooks/nextjs-postgres
  - idempotency-keys/nextjs-postgres
  - connection-pooling/nextjs-postgres
  - transactional-email/nextjs-postgres
  - file-uploads/nextjs-s3
  - rate-limiting/nextjs-postgres

checklist:
  - id: no-after-for-durable
    lens: data
    level: must
    text: "Never use `after()`, `waitUntil` or an un-awaited promise for work that must happen; enqueue a durable job instead."
    why: "`after()` runs only within the route's max duration and is never retried, so a crash, deploy or timeout loses the work."
  - id: enqueue-in-transaction
    lens: data
    level: must
    text: "Enqueue the job in the same Postgres transaction as the business write (pg-boss `db` option, `graphile_worker.add_job()` or an outbox row), never in a separate call."
    why: Enqueue-then-rollback acts on data that never existed; commit-then-crash silently loses the job.
  - id: idempotent-handlers
    lens: data
    level: must
    text: "Make every handler safe to run twice: guard each side effect with a unique constraint, an upsert or a provider idempotency key derived from the job's business id."
    why: Every option here delivers at least once; a worker can die after the side effect but before marking the job done.
  - id: dedupe-keys
    lens: data
    level: should
    text: "Give jobs that must exist once per entity a deterministic key (pg-boss `singletonKey` with a matching policy, Graphile `job_key`), and still enforce the outcome with a constraint."
    why: Queue keys only dedupe jobs that are still pending; completed Graphile Worker jobs are deleted and their keys freed.
  - id: bounded-retries
    lens: performance
    level: must
    text: Retry with exponential backoff plus jitter, cap the delay, and set max attempts per queue from how long the work stays useful; fail fast on errors that cannot succeed.
    why: pg-boss defaults to 2 retries with no delay; Graphile Worker defaults to 25 attempts over about 3 days. Neither fits every job.
  - id: failed-state
    lens: data
    level: must
    text: Keep permanently failed jobs in an inspectable failed or dead-letter state with the last error, alert on them, and provide a replay path after a fix.
    why: pg-boss deletes failed jobs after deleteAfterSeconds (7 days by default); Vercel Queues has no dead-letter queue and expires messages.
  - id: lease-and-heartbeat
    lens: performance
    level: must
    text: Set a job lease above the worst-case run time and send heartbeats for long jobs, so a crashed worker's job returns to the queue quickly.
    why: A killed Graphile Worker leaves its jobs locked for about 4 hours; pg-boss expires active jobs after 15 minutes by default.
  - id: skip-locked-claim
    lens: performance
    level: must
    text: "In a hand-rolled jobs table, claim a batch with `FOR UPDATE SKIP LOCKED` in a short transaction that sets `locked_until`, then do the work outside that transaction."
    why: Workers never block each other, and no row lock or connection is held during slow I/O.
  - id: cron-once
    lens: data
    level: must
    text: "Run each scheduled occurrence once across instances: use the queue library's cron, or take `pg_try_advisory_xact_lock` and record the scheduled time under a unique key."
    why: Vercel documents that a cron run can be delivered twice and that runs can overlap.
  - id: respect-max-duration
    lens: performance
    level: must
    text: "Run long-lived workers outside serverless functions; a serverless consumer or cron drain must stop claiming well before `maxDuration` and leave the rest queued."
    why: Vercel stops a function at its max duration (300 s default; 800 s maximum on Pro and Enterprise).
  - id: graceful-shutdown
    lens: performance
    level: must
    text: On SIGTERM stop fetching new jobs, let in-flight jobs finish within a timeout, then exit; make the platform's shutdown grace period longer than that timeout.
    why: Jobs cut off mid-run wait out their lease and may repeat side effects.
  - id: secure-triggers
    lens: security
    level: must
    text: "Authenticate every route that starts work: check the `CRON_SECRET` bearer token, verify managed-service signatures on the raw body, and exclude these routes from `proxy.ts` redirects."
  - id: minimal-payloads
    lens: security
    level: should
    text: Put ids in job payloads, not secrets, tokens or full personal data; load current data and re-check permissions in the handler.
    why: Payloads are kept for days in job tables, dashboards and third-party services, and data can change before the job runs.
  - id: user-visible-status
    lens: ux
    level: should
    text: For user-started jobs such as exports, store a status row the UI can poll, show failures with a retry action, and notify the user when the result is ready.
  - id: observe-queue
    lens: performance
    level: must
    text: Track queue depth, age of the oldest ready job, failure rate and dead-letter count per queue, and alert on oldest-job age, not depth alone.
    why: A stopped worker shows up as rising age; pg-boss reports readyOldestSeconds for each queue.

decisions:
  - id: hosting
    question: Can you run a long-running process (container, VM or Vercel Daemons) next to the Next.js app?
    options:
      - { id: can-run-worker, label: "Yes, we can run an always-on worker", points_to: postgres-queue-worker }
      - { id: serverless-only, label: "No, serverless functions only", points_to: managed-durable }
  - id: start-latency
    question: How soon must a job start after it is enqueued?
    options:
      - { id: seconds, label: "Within seconds", points_to: postgres-queue-worker }
      - { id: minutes-ok, label: "A minute or more is fine", points_to: cron-drain }
    default: seconds
  - id: longest-job
    question: How long can the longest job run?
    options:
      - { id: short, label: "Well under the platform's function limit (a few minutes)" }
      - { id: long, label: "Longer, such as large exports or media processing", points_to: postgres-queue-worker }
    default: short
  - id: job-shape
    question: Do jobs have several steps with long waits (hours or days) or wait for outside events?
    options:
      - { id: single-step, label: "No, each job is one unit of work" }
      - { id: multi-step, label: "Yes, multi-step flows with waits", points_to: managed-durable }
    default: single-step
  - id: data-residency
    question: May job payloads be stored by a third-party service?
    options:
      - { id: allowed, label: "Yes" }
      - { id: not-allowed, label: "No, payloads must stay in our infrastructure", points_to: postgres-queue-worker }
    default: allowed

options:
  - id: postgres-queue-worker
    name: Postgres-backed queue with a separate worker process
    examples: [pg-boss, Graphile Worker]
    best_fit_when:
      - You can run one always-on process next to the app
      - You want jobs enqueued in the same transaction as your writes
      - You want no extra vendor and no per-job fee
    avoid_when:
      - You can only deploy serverless functions
      - Job volume is high enough to strain the primary database
    tradeoffs:
      - You deploy, scale and monitor the worker yourself
      - Job rows and polling add storage and query load to Postgres
      - Each worker instance holds database connections
  - id: managed-durable
    name: Managed durable job service
    examples: [Inngest, Trigger.dev, Upstash QStash, Vercel Queues (beta)]
    best_fit_when:
      - You deploy only to serverless functions
      - Jobs have many steps, sleeps or waits for outside events
      - You want hosted retries, replays and a dashboard
    avoid_when:
      - Payloads must not leave your infrastructure
      - Jobs must commit atomically with your write and you cannot add an outbox relay
    tradeoffs:
      - Enqueueing is a network call outside your transaction, so write an outbox row and relay it, or reconcile
      - Per-run, per-step or per-operation fees on top of function compute
      - Dedupe and retention windows are set by the vendor (QStash 10 minutes, Inngest 24 hours)
  - id: cron-drain
    name: Cron-triggered drain of a jobs table
    examples: [Vercel Cron Jobs, Vercel Schedules (beta)]
    best_fit_when:
      - Low volume where a delay of a minute or more is acceptable
      - Serverless-only hosting with no budget for another service
    avoid_when:
      - Jobs must start within seconds
      - One job can run longer than the function max duration
      - You are on Vercel Hobby, where Cron Jobs run at most once a day
    tradeoffs:
      - You build claiming, leases, retries and dead-lettering yourself
      - Vercel does not retry a failed cron run; the next tick must pick up leftovers
  - id: inline-after
    name: Inline after() for non-critical work
    best_fit_when:
      - Analytics, logging or cache warming that may be lost
      - Nudging a durable worker right after enqueueing
    avoid_when:
      - Any work that must happen, or must not happen twice
    tradeoffs:
      - No persistence and no retry; lost on crash, deploy or timeout
      - Bounded by the route's max duration
recommended: postgres-queue-worker

versions:
  - package: pg-boss
    range: ">=12.0.0 <13.0.0"
    notes:
      - "v12 has no default export: use `import { PgBoss } from 'pg-boss'`. It needs Node.js 22.12+ and Postgres 13+. Create one long-lived instance per process and call `createQueue()` before `send()` or `work()`."
      - "Pass `{ db: fromDrizzle(tx, sql) }` (or `fromPrisma`, `fromKysely`, `fromKnex`) to `send()` so the job commits or rolls back with your transaction."
      - "Defaults are `retryLimit` 2, `retryDelay` 0, `retryBackoff` false and `expireInSeconds` 900; set backoff, `retryDelayMax` and `heartbeatSeconds` (at least 10) per queue."
      - "Failed jobs are deleted after `deleteAfterSeconds` (7 days by default). Configure a `deadLetter` queue and use `redrive()` to replay; unworked dead-letter jobs expire after `retentionSeconds` (14 days)."
      - "`work()` handlers receive an array (`async ([job]) => ...`). Short-lived serverless senders should set `registerInstance: false`; `useListenNotify` does not work through PgBouncer transaction pooling."
    docs: https://pgboss.io/api/queues
    context7: https://context7.com/timgit/pg-boss
  - package: graphile-worker
    range: ">=0.18.0 <0.19.0"
    notes:
      - "0.18 is pure ESM, needs Node.js 22.18+ and Postgres 12+, drops cosmiconfig in favour of `graphile.config.ts`, and no longer supports sub-path imports."
      - "Enqueue atomically by calling `graphile_worker.add_job(...)` in SQL inside the same transaction as your write."
      - "`max_attempts` defaults to 25 with `exp(least(10, attempt))` second delays (about 3 days in total). Permanently failed jobs stay in the table until you fix and reschedule or delete them."
      - "`job_key` is not an idempotency record: the default `replace` mode overwrites a pending job, a running job gets a second copy, and completed jobs are deleted."
      - "A worker killed without a graceful shutdown leaves its jobs locked for about 4 hours; send SIGTERM and let it drain."
    docs: https://worker.graphile.org/docs/job-key
    context7: https://context7.com/graphile/worker
  - package: next
    range: ">=16.0.0 <17.0.0"
    notes:
      - "`after()` runs after the response (even an error response) within the route's max duration, with no persistence or retry. Use it to log or to nudge a durable worker, not as a queue."
      - "With self-hosted `next start`, SIGTERM or SIGINT lets pending `after()` callbacks finish; the docs recommend a 10-30 second drain period."
      - "Set `export const maxDuration = <seconds>` in a cron or consumer Route Handler; the platform enforces it."
    docs: https://nextjs.org/docs/app/api-reference/functions/after
    context7: https://context7.com/vercel/next.js
  - package: inngest
    range: ">=4.0.0 <5.0.0"
    notes:
      - "v4 moves triggers into the options object: `createFunction({ id, triggers: { event: 'app/x' } }, handler)`. Serve options such as `signingKey` move to the client, and the default mode is cloud (`INNGEST_DEV=1` locally)."
      - "Functions retry 4 times by default (`retries` 0-20), and each `step.run()` has its own retry counter, so put each side effect in its own step."
      - "An event `id` or the `idempotency` option dedupes for 24 hours only; handlers still need their own idempotency."
    docs: https://www.inngest.com/docs/reference/typescript/v4/migrations/v3-to-v4
    context7: https://context7.com/inngest/inngest-js
  - package: "@upstash/qstash"
    range: ">=2.0.0 <3.0.0"
    notes:
      - "Verify `Upstash-Signature` on the raw body with `Receiver` (current and next signing keys) or `verifySignatureAppRouter`; reject anything unsigned."
      - "Failed deliveries are retried 3 times by default (`retries`), then moved to a dead-letter queue whose retention depends on your plan."
      - "`deduplicationId` and `contentBasedDeduplication` only dedupe publishes within 10 minutes."
    docs: https://upstash.com/docs/qstash/features/retry
    context7: https://context7.com/upstash/qstash-js

verify:
  - id: rollback-no-job
    lens: data
    type: integration
    check: When the business transaction rolls back after enqueueing, no job exists; when it commits, exactly one job exists.
  - id: crash-after-side-effect
    lens: data
    type: integration
    check: A handler killed after its side effect but before completion is retried, and the side effect (for example one sent-email row) happens once.
  - id: duplicate-enqueue
    lens: data
    type: integration
    check: Enqueueing the same logical job twice, including once after the first has completed, produces one side effect.
  - id: retry-then-fail
    lens: performance
    type: integration
    check: A handler that always throws is retried with growing delays up to the max attempts, then ends in a failed or dead-letter state with its last error.
  - id: replay-failed
    lens: data
    type: integration
    check: A failed job can be replayed after a fix and completes exactly once.
  - id: lease-recovery
    lens: performance
    type: integration
    check: A job whose worker process is killed is picked up by another worker within the configured lease or heartbeat window.
  - id: concurrent-claim
    lens: performance
    type: integration
    check: Two workers polling the same queue never process the same job at the same time.
  - id: cron-once
    lens: data
    type: integration
    check: With two worker instances running, a scheduled job runs once per occurrence, and a duplicate trigger for the same scheduled time does nothing.
  - id: trigger-auth
    lens: security
    type: integration
    check: A request to a cron or consumer route without a valid CRON_SECRET or signature gets 401 and enqueues or runs nothing.
  - id: graceful-stop
    lens: performance
    type: integration
    check: Sending SIGTERM to a worker mid-job lets the job finish or return to the queue, and the worker fetches no new jobs.
  - id: drain-time-budget
    lens: performance
    type: integration
    check: A cron drain facing a large backlog stops claiming before its time budget runs out and leaves the remaining jobs queued for the next run.
  - id: oldest-age-alert
    lens: performance
    type: manual
    check: Stopping all workers triggers the oldest-ready-job age alert within its threshold.

sources:
  - { title: "pg-boss: Introduction (delivery guarantees, transactions)", url: "https://pgboss.io/introduction" }
  - { title: "pg-boss: Queues (retries, dead letter, heartbeat vs expiration)", url: "https://pgboss.io/api/queues" }
  - { title: "pg-boss: ORM transaction adapters", url: "https://pgboss.io/api/adapters" }
  - { title: "pg-boss: Scheduling", url: "https://pgboss.io/api/scheduling" }
  - { title: "pg-boss: Ops (stop and graceful shutdown)", url: "https://pgboss.io/api/ops" }
  - { title: "pg-boss 12.0.0 release notes", url: "https://github.com/timgit/pg-boss/releases/tag/12.0.0" }
  - { title: "Graphile Worker: Error handling", url: "https://worker.graphile.org/docs/error-handling" }
  - { title: "Graphile Worker: Job key", url: "https://worker.graphile.org/docs/job-key" }
  - { title: "Graphile Worker: Recurring tasks (crontab)", url: "https://worker.graphile.org/docs/cron" }
  - { title: "Graphile Worker: Exponential backoff", url: "https://worker.graphile.org/docs/exponential-backoff" }
  - { title: "Graphile Worker v0.18.0 release", url: "https://github.com/graphile/worker/releases/tag/v0.18.0" }
  - { title: "Next.js after reference", url: "https://nextjs.org/docs/app/api-reference/functions/after" }
  - { title: "Next.js self-hosting guide (after and graceful shutdown)", url: "https://nextjs.org/docs/app/guides/self-hosting" }
  - { title: "Vercel Functions limitations (max duration)", url: "https://vercel.com/docs/functions/limitations" }
  - { title: "Vercel: Managing Cron Jobs", url: "https://vercel.com/docs/cron-jobs/manage-cron-jobs" }
  - { title: "Vercel Schedules concepts", url: "https://vercel.com/docs/schedules/concepts" }
  - { title: "Vercel Queues concepts", url: "https://vercel.com/docs/queues/concepts" }
  - { title: "Vercel: Background workers", url: "https://vercel.com/docs/background-workers" }
  - { title: "PostgreSQL SELECT (locking clause, SKIP LOCKED)", url: "https://www.postgresql.org/docs/current/sql-select.html" }
  - { title: "PostgreSQL explicit locking (advisory locks)", url: "https://www.postgresql.org/docs/current/explicit-locking.html" }
  - { title: "Inngest: Retries", url: "https://www.inngest.com/docs/features/inngest-functions/error-retries/retries" }
  - { title: "Inngest: Handling idempotency", url: "https://www.inngest.com/docs/guides/handling-idempotency" }
  - { title: "Upstash QStash: Deduplication", url: "https://upstash.com/docs/qstash/features/deduplication" }
  - { title: "Upstash QStash: Verify signatures", url: "https://upstash.com/docs/qstash/howto/signature" }
  - { title: "Trigger.dev: Introduction", url: "https://trigger.dev/docs/introduction" }
---

## Why this approach

Jobs stored in the same Postgres database as your data can be enqueued in the same transaction as the write they belong to, so a job exists only if the write commits. A Postgres-backed library such as pg-boss or Graphile Worker adds retries with backoff, leases, cron and `SKIP LOCKED` claiming without another vendor, and matches the event table the payment-webhooks card drains. It needs a long-running worker process, which a serverless function cannot host, so run the worker on a container host, a VM or Vercel Daemons (beta). Choose a managed durable service when you can only deploy serverless functions or need multi-step flows with long waits, and a cron-triggered drain only for low-volume work that can wait a minute or more.

## Lenses

### Security

Every route that starts work is public unless you lock it: cron routes, queue consumers and managed-service callbacks. Compare the `Authorization: Bearer` header with `CRON_SECRET` (each deployment keeps the value it was built with), and let the managed SDK verify signatures on the raw body (QStash `Receiver`, Inngest `INNGEST_SIGNING_KEY`). Keep these paths out of `proxy.ts` auth redirects. Put ids in payloads, never tokens, passwords or full personal data: payloads sit in job tables, logs, dashboards and vendor storage for days. Load current data and re-check permissions in the handler, because a user can lose access between enqueue and run. Never let user input choose the task name or queue.

### Performance & latency

Return from the request once the transaction commits; the worker does the slow part. Claim in a short transaction and do the I/O outside it, because a row lock held across an email call pins a connection and holds back vacuum:

```sql
UPDATE jobs SET status = 'running', attempts = attempts + 1,
       locked_until = now() + interval '5 minutes'
WHERE id IN (
  SELECT id FROM jobs
  WHERE (status = 'queued' AND run_at <= now())
     OR (status = 'running' AND locked_until < now())
  ORDER BY run_at LIMIT 20
  FOR UPDATE SKIP LOCKED
)
RETURNING id, kind, payload;
```

Set the lease above the worst-case run and add heartbeats for long jobs; a dead worker is otherwise noticed only at expiry. Serverless consumers and cron drains must finish inside `maxDuration` (Vercel: 300 s default, 800 s maximum on Pro, 1,800 s in beta). Each pg-boss instance opens a pool of 10 connections by default, so count workers and serverless instances against your Postgres connection limit.

### UX flows

For jobs a user starts and waits for, such as exports, imports and reports, create a status row in the same transaction as the job and return its id. Show queued, running, failed and done states, poll for updates, and email a link when the job may outlast the visit. On failure, explain what happened and offer a retry that reuses the same job key instead of creating a duplicate. Disable the trigger while a job for the same input is pending. For fire-and-forget work such as receipts, show nothing, and key the side effect so a retry never sends twice.

### Data model

With a library, its schema holds the queue; keep your own outcome tables for idempotency, for example `emails_sent` with a unique `(kind, entity_id)`. A hand-rolled `jobs` table needs `kind`, `payload jsonb`, `status`, `attempts`, `max_attempts`, `run_at`, `locked_until`, `last_error` and a nullable unique `dedupe_key`, plus a partial index on `run_at` for queued and running rows. On failure, set `run_at` to now plus a capped exponential delay with random jitter, or mark the job `failed` once attempts reach the maximum. Enqueue with the write:

```ts
await db.transaction(async (tx) => {
  const [order] = await tx.insert(orders).values(input).returning();
  await boss.send('order-confirmation', { orderId: order.id }, { db: fromDrizzle(tx, sql) });
});
```

Prune completed jobs on a schedule, but keep failed jobs until someone has replayed or closed them.

### Cost

A Postgres queue costs job-table storage, polling queries and one always-on worker. pg-boss workers poll every 2 seconds by default; lengthen the interval for quiet queues, or use LISTEN/NOTIFY where your pooler allows it. Pruning completed jobs (pg-boss `deleteAfterSeconds`, 7 days by default) keeps tables and vacuum cheap. Managed services charge per run, step or operation: Inngest counts each step as an execution, and Vercel Queues bills each 4 KiB as an operation, doubles sends that carry an idempotency key, and its consumers also run on billed function compute. A cron drain is cheapest at low volume, but every tick is an invocation, so check for ready jobs with one indexed query and exit early.

## Common mistakes

- Treating `after()`, `waitUntil` or an un-awaited promise as a queue, so work disappears on a crash, deploy or timeout.
- Enqueueing before commit (a job for a rolled-back write) or after commit in a separate call (a lost job if the process dies in between).
- Assuming exactly-once delivery, then sending an email or charging a card again on retry.
- Using pg-boss `singletonKey` or Graphile `job_key` as a permanent idempotency record.
- Retrying forever, or instantly with no backoff, against a rate-limited provider.
- Letting retention delete failed jobs before anyone has looked at them.
- Starting a polling worker inside a Route Handler or `instrumentation.ts` on serverless hosting, where instances stop at the max duration or between requests.
- Shipping a cron route without the `CRON_SECRET` check, or letting overlapping runs process the same rows.
- Killing workers with SIGKILL on deploy, which leaves jobs locked until their lease expires.
- Alerting on queue depth only, so a stopped worker with a small backlog goes unnoticed.

## Notes for reviewers

- Vercel documents Queues, Schedules and Daemons as beta, and Cron Jobs as a legacy feature to be migrated to Schedules (checked 2026-11-16). Re-check before verifying.
- That pg-boss deletes failed jobs after `deleteAfterSeconds` comes from the `failedCount` note in the queues docs and the retention query in `src/plans.ts`, not from an explicit sentence.
- The serverless `instrumentation.ts` mistake is reasoned from Vercel's max-duration and background-worker docs rather than stated outright.
