---
id: payments-webhooks/nextjs-postgres
title: Payment webhooks (Stripe, Razorpay) for a Next.js + Postgres app
topic: payments-webhooks
stack: [nextjs, postgres, typescript]
summary: >-
  Verify each webhook signature on the raw body in a Route Handler, store the
  event id under a unique constraint, return 2xx fast and process in a worker.
  Fulfil only from verified events or server-side API checks, never the redirect,
  and reconcile with the provider.
status: draft
card_version: 0.1.0
last_verified: null
review_level: null
authors: [RIDAM7]
reviewers: []
lenses: [security, performance, ux, data, cost]
applies_when:
  app_types: [web-app, saas, e-commerce, marketplace]
  not_for: [static-site-without-backend, manual-invoicing-only]
related: [rate-limiting/nextjs-postgres, auth/nextjs-postgres]

checklist:
  - id: verify-raw-body
    lens: security
    level: must
    text: Verify every webhook with the provider SDK against the exact body from `await request.text()`; never verify `JSON.stringify(await request.json())`.
    why: Re-serialised JSON changes the bytes, so real events fail and teams are tempted to switch verification off.
  - id: replay-window
    lens: security
    level: must
    text: Keep Stripe's signature timestamp tolerance (SDK default 5 minutes, never 0). Razorpay signs no timestamp, so reject event ids you have already stored.
    why: Stops a captured, validly signed request from being replayed.
  - id: store-event-once
    lens: data
    level: must
    text: Insert each event into a table with a unique (provider, event_id) key using ON CONFLICT DO NOTHING; Razorpay's id is the `x-razorpay-event-id` header.
    why: Both providers deliver at least once and retry, so duplicates are expected.
  - id: ack-fast
    lens: performance
    level: must
    text: Return 2xx right after verifying and storing the event; run fulfilment, emails and provider API calls in a queue or background job.
    why: Razorpay times out after 5 seconds and Stripe counts timeouts as failures; both then retry.
  - id: fulfil-server-side
    lens: security
    level: must
    text: Fulfil orders only from verified webhooks or a server-side API fetch of the payment; never from the success redirect or a client-side callback alone.
    why: Customers may never reach the landing page, and anything the browser sends can be forged.
  - id: idempotent-fulfilment
    lens: data
    level: must
    text: Make fulfilment idempotent with a unique constraint per order, so webhook and landing-page calls running at the same time grant access once.
    why: Stripe warns fulfilment may be called multiple times, possibly concurrently, for one payment.
  - id: payment-state-machine
    lens: data
    level: must
    text: Store payment status as an explicit state machine in Postgres and apply only allowed transitions, for example never from succeeded back to pending.
    why: Events arrive out of order; a late or duplicate event must not undo a success.
  - id: fetch-current-state
    lens: data
    level: should
    text: Before acting on an event, fetch the current payment, session or subscription from the provider API instead of trusting the payload order.
  - id: reconcile-job
    lens: data
    level: must
    text: Run a scheduled job that compares recent provider payments with your payments table and repairs missing or stuck rows.
    why: Retries stop (Stripe after up to 3 days live, Razorpay after 24 hours) and a lost event is otherwise never noticed.
  - id: separate-test-live
    lens: security
    level: must
    text: Use separate API keys and webhook secrets for test and live mode in server-only environment variables; reject Stripe events whose `livemode` does not match.
  - id: secret-rotation
    lens: security
    level: should
    text: Accept the old and the new webhook secret during rotation, and rotate when a secret may have leaked or someone with access leaves.
    why: Stripe keeps the old secret valid for up to 7 days; Razorpay retries of older events still carry the old signature.
  - id: no-redirects-on-route
    lens: security
    level: must
    text: Keep the webhook route out of `proxy.ts` auth redirects, CSRF checks and trailing-slash redirects; register the exact final URL.
    why: Stripe counts 3xx responses as failed deliveries, and Razorpay accepts only 2xx.
  - id: unhandled-types-2xx
    lens: performance
    level: should
    text: Subscribe only to the event types you handle, and return 2xx for any other type instead of an error.
    why: Errors for ignored types cause pointless retries and can get the endpoint disabled.
  - id: provider-ip-allowlist
    lens: security
    level: should
    text: Where your host supports it, also allowlist the provider's published webhook IPs; never use it instead of signature checks.
  - id: alert-on-failures
    lens: performance
    level: should
    text: Alert on signature failures, a growing backlog of unprocessed events and disabled endpoints.
    why: Razorpay disables a webhook after 24 hours of failed deliveries.

decisions:
  - id: provider
    question: Which payment provider(s) will send webhooks?
    options:
      - { id: stripe, label: "Stripe only" }
      - { id: razorpay, label: "Razorpay only" }
      - { id: both, label: "Both (for example by region)" }
  - id: billing-model
    question: Are you selling one-time payments, subscriptions, or both?
    options:
      - { id: one-time, label: "One-time payments" }
      - { id: subscriptions, label: "Subscriptions" }
      - { id: both, label: "Both" }
    default: one-time
  - id: job-runner
    question: Do you already run a queue or background job runner?
    options:
      - { id: existing-queue, label: "Yes, a managed queue or job service", points_to: managed-queue }
      - { id: postgres-only, label: "No, only Postgres", points_to: postgres-outbox }
      - { id: undecided, label: "Not yet; help me choose" }
    default: undecided
  - id: hosting
    question: Will the app run on serverless functions or a long-running server?
    options:
      - { id: serverless, label: "Serverless functions" }
      - { id: long-running, label: "Long-running server or container", points_to: postgres-outbox }
  - id: delayed-methods
    question: Will you accept payment methods that confirm later, such as bank debits or bank transfers?
    options:
      - { id: delayed, label: "Yes, some payments confirm later" }
      - { id: instant-only, label: "No, cards and instant methods only" }
    default: instant-only

options:
  - id: postgres-outbox
    name: Postgres event table drained by a worker
    examples: [pg-boss, Graphile Worker]
    best_fit_when:
      - You already run Postgres and want no extra infrastructure
      - You want the event log and payment state updated in one transaction
    avoid_when:
      - You have no way to run a worker or scheduled trigger
      - Event volume is high enough to strain the primary database
    tradeoffs:
      - You own retries, backoff and dead-letter handling
      - Workers poll the table, adding some database load
  - id: managed-queue
    name: Managed queue or durable job service
    examples: [Inngest, Trigger.dev, Amazon SQS, Upstash QStash]
    best_fit_when:
      - You run on serverless functions and expect bursts (for example month-start renewals)
      - You want built-in retries, backoff and a dashboard
    avoid_when:
      - Strict data-residency rules forbid sending payloads to another vendor
    tradeoffs:
      - Another vendor and a per-message or per-run fee
      - You still record and deduplicate events in Postgres
  - id: inline-after
    name: Inline processing with after()
    best_fit_when:
      - Low-volume prototypes where fulfilment is quick and idempotent
    avoid_when:
      - Any work that must not be lost
    tradeoffs:
      - No retry if the callback fails; reconciliation is the only safety net
      - Bounded by the route's max duration on your platform
recommended: postgres-outbox

versions:
  - package: stripe
    range: ">=23.0.0 <24.0.0"
    notes:
      - "Snapshot destinations: `stripe.webhooks.constructEvent(rawBody, signature, secret)`. Thin destinations (Stripe's recommended format): `stripe.parseEventNotification(...)`. Since v21 the wrong method for the format throws."
      - "The default signature tolerance is 300 seconds; never pass 0, which disables the timestamp check."
      - "v23 requires Node.js 20 or later; since v22 the default export is a true class, so create the client with `new Stripe(key)`."
      - "Each major pins a newer API version (23.1.0 pins `2026-10-28.endive`); snapshot payloads follow the destination's API version, not the SDK's."
      - "Never use the `...WithoutVerification` parsing helpers outside tests."
    docs: https://docs.stripe.com/webhooks
    context7: https://context7.com/stripe/stripe-node
  - package: razorpay
    range: ">=2.0.0 <3.0.0"
    notes:
      - "`validateWebhookSignature(rawBody, signature, secret)` (also `Razorpay.validateWebhookSignature`) returns a boolean; pass the raw text, not `JSON.stringify` of a parsed body as some doc snippets do."
      - "Webhook signatures carry no timestamp; replay protection relies on storing `x-razorpay-event-id` under a unique constraint."
      - "The helper compares with `===`; for a constant-time check, compute HMAC-SHA256 with `node:crypto` and compare with `timingSafeEqual`."
      - "Verify Checkout results with `validatePaymentVerification({ order_id, payment_id }, signature, keySecret)`, using the order id stored on your server."
    docs: https://razorpay.com/docs/webhooks/validate-test/
    context7: https://context7.com/razorpay/razorpay-node
  - package: next
    range: ">=16.0.0 <17.0.0"
    notes:
      - "Read the body once with `await request.text()` in a `POST` Route Handler; App Router handlers need no `bodyParser` config."
      - "Keep the default Node.js runtime; the 16.x docs mark the Edge runtime as deprecated."
      - "`after()` runs work after the response, within the route's max duration, but never retries; use it only to nudge a durable worker."
      - "Exclude webhook paths from `proxy.ts` matchers so auth redirects never answer the provider."
    docs: https://nextjs.org/docs/app/api-reference/file-conventions/route
    context7: https://context7.com/vercel/next.js

verify:
  - id: bad-signature-rejected
    lens: security
    type: integration
    check: A request with a missing or wrong signature header gets 400 and writes nothing to the database.
  - id: raw-body-verified
    lens: security
    type: integration
    check: A validly signed payload with unusual JSON whitespace passes verification, proving the handler verifies the raw body rather than re-serialised JSON.
  - id: stale-timestamp-rejected
    lens: security
    type: unit
    check: A Stripe payload signed with a timestamp older than the tolerance is rejected.
  - id: duplicate-event-once
    lens: data
    type: integration
    check: Delivering the same event id twice returns 2xx both times and fulfils the order once.
  - id: out-of-order-events
    lens: data
    type: integration
    check: Delivering a failure or pending event after a success event leaves the payment in the succeeded state.
  - id: concurrent-fulfilment
    lens: data
    type: integration
    check: Webhook and success-page fulfilment running concurrently for the same payment create exactly one fulfilment row.
  - id: redirect-cannot-fulfil
    lens: security
    type: e2e
    check: Visiting the success URL with a made-up session or payment id does not fulfil any order.
  - id: fast-ack
    lens: performance
    type: integration
    check: With the worker stopped, the handler still returns 2xx in under 1 second and leaves the event stored as unprocessed.
  - id: worker-retries
    lens: performance
    type: integration
    check: When processing throws, the event stays unprocessed with an incremented attempt count and is retried later.
  - id: reconcile-repairs
    lens: data
    type: integration
    check: A payment that is paid at the provider but missing locally (webhook never delivered) is repaired by the reconciliation job.
  - id: livemode-mismatch
    lens: security
    type: unit
    check: A test-mode deployment rejects a Stripe event with livemode true, and a live deployment rejects livemode false.
  - id: no-redirect-response
    lens: security
    type: integration
    check: A POST to the webhook URL without a session cookie never receives a 3xx response.

sources:
  - { title: "Stripe: Receive Stripe events in your webhook endpoint", url: "https://docs.stripe.com/webhooks" }
  - { title: "Stripe: How events work (thin and snapshot events)", url: "https://docs.stripe.com/events/how-events-work" }
  - { title: "Stripe: Fulfil orders", url: "https://docs.stripe.com/checkout/fulfillment" }
  - { title: "Stripe: API keys", url: "https://docs.stripe.com/keys" }
  - { title: "stripe-node changelog", url: "https://github.com/stripe/stripe-node/blob/master/CHANGELOG.md" }
  - { title: "Razorpay: Validate and test webhooks", url: "https://razorpay.com/docs/webhooks/validate-test/" }
  - { title: "Razorpay: Webhook best practices", url: "https://razorpay.com/docs/webhooks/best-practices/" }
  - { title: "Razorpay: Node.js integration steps", url: "https://razorpay.com/docs/payments/server-integration/nodejs/integration-steps/" }
  - { title: "razorpay-node signature helpers (source)", url: "https://github.com/razorpay/razorpay-node/blob/master/lib/utils/razorpay-utils.js" }
  - { title: "Next.js route.js reference (Webhooks)", url: "https://nextjs.org/docs/app/api-reference/file-conventions/route" }
  - { title: "Next.js after reference", url: "https://nextjs.org/docs/app/api-reference/functions/after" }
  - { title: "PostgreSQL INSERT (ON CONFLICT)", url: "https://www.postgresql.org/docs/current/sql-insert.html" }
  - { title: "PostgreSQL SELECT (locking clause, SKIP LOCKED)", url: "https://www.postgresql.org/docs/current/sql-select.html" }
---

## Why this approach

A verified webhook is the only reliable signal that money moved, because customers can close the tab before your success page loads and some payment methods settle later. Verifying the signature on the raw body, recording the event id once in Postgres and returning 2xx quickly keeps the endpoint safe under the providers' at-least-once retries. A Postgres event table drained by a worker adds no new infrastructure and lets you record events and payment state in one transaction. Choose a managed queue when you run on serverless functions and expect bursts, and use inline `after()` processing only for low-volume prototypes backed by a reconciliation job.

## Lenses

### Security

Treat the webhook URL as public: anyone can POST to it, so the signature is the only proof of origin. Read the body once as text, verify it with the provider SDK, and only then parse JSON. Stripe signs a timestamp, so keep the SDK's 5-minute tolerance and keep server clocks in sync. Razorpay signs no timestamp, so the stored event id is your replay guard. Keep test and live secrets in server-only environment variables, never with a `NEXT_PUBLIC_` prefix (Next.js inlines those into browser bundles). During rotation, accept both secrets until retries signed with the old one have stopped. Never grant access from a redirect's query string; fetch the session or payment from the provider API on the server. Exclude the route from `proxy.ts` session checks: the signature replaces them.

### Performance & latency

Do only two things before responding: verify, then insert the event row. Everything else runs in a worker that claims unprocessed rows with `FOR UPDATE SKIP LOCKED` and retries with backoff. Razorpay times out after 5 seconds, and Stripe Checkout waits up to 10 seconds for your `checkout.session.completed` response before redirecting, so a slow handler also delays the customer.

```ts
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '');
export async function POST(request: Request) {
  const body = await request.text(); // exact bytes; never request.json() first
  const signature = request.headers.get('stripe-signature') ?? '';
  let event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET ?? '');
  } catch {
    return new Response('Invalid signature', { status: 400 });
  }
  await recordEvent('stripe', event.id, event.type, body); // ON CONFLICT DO NOTHING
  return new Response(null, { status: 200 }); // the worker does the slow part
}
```

### UX flows

Show a "confirming your payment" state on the success page and poll your own API for the order status instead of declaring success from the redirect. Stripe recommends also running the same idempotent fulfilment function server-side when the landing page loads, so customers who are present get access at once. For methods that confirm later, show "payment processing" and email the result. With Razorpay Checkout, verify `razorpay_signature` on the server before showing success, then let the webhook or an API fetch confirm capture. Key receipts by payment id so retries never email twice. When a payment fails, keep the order and offer a retry instead of creating a duplicate order.

### Data model

Keep provider events separate from your own payment state:

```sql
CREATE TABLE webhook_events (
  provider     text NOT NULL,
  event_id     text NOT NULL,
  type         text NOT NULL,
  payload      jsonb NOT NULL,
  received_at  timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  attempts     int NOT NULL DEFAULT 0,
  last_error   text,
  PRIMARY KEY (provider, event_id)
);
```

Give `payments` a unique `(provider, provider_payment_id)`, amounts as integer minor units (both providers use the smallest currency unit), `livemode`, and a status such as `pending`, `processing`, `succeeded`, `failed`, `refunded` or `disputed`. Apply transitions with a guarded `UPDATE ... WHERE status IN (...)` so late events cannot move a payment backwards. Make `fulfilments.order_id` unique. Add a partial index on unprocessed events, and prune old payloads after your retention period while keeping the ids.

### Cost

Most of the cost is compute: each delivery is a function invocation on serverless hosting, and retries multiply invocations when the handler is slow or failing. Subscribing to every event type adds invocations and rows for nothing. Stripe thin events need an API call to fetch the object, which counts against API rate limits, so let the reconciliation job batch its reads. A managed queue adds a per-message or per-run fee; a Postgres table with a scheduled worker costs only database storage, so set a payload retention period.

## Common mistakes

- Calling `request.json()` and re-serialising before verification, then disabling verification when it fails.
- Fulfilling from the success redirect or a client-side Checkout callback.
- Deduplicating on `created` timestamps, or assuming events arrive in order.
- Doing slow work (emails, provider API calls, PDFs) before returning 2xx, which causes timeouts and duplicate retries.
- Using the test-mode secret in production, or one secret for several endpoints.
- Passing a tolerance of 0 to Stripe's verifier, which turns off replay protection.
- Returning an error for event types you don't handle instead of 2xx.
- Putting the webhook route behind session auth in `proxy.ts`, so providers receive redirects.
- Treating `after()` as a durable queue.
- No reconciliation job, so a webhook lost after the retry window is never noticed.

## Notes for reviewers

Check these claims against the sources before setting `verified`:
- Stripe: retries for up to 3 days in live mode (3 attempts over a few hours in sandboxes), the 5-minute default tolerance, the 7-day secret roll overlap and the 10-second Checkout redirect wait.
- Razorpay: the 5-second timeout, the 24-hour retry window followed by auto-disable, and that webhook signatures carry no timestamp.
- The stripe-node v21-v23 changes (wrong-parser error, Node 20 minimum, tolerance 0 behaviour) against the changelog.
- That razorpay-node 2.9.x `validateWebhookSignature` still compares with plain `===`.
- That the Next.js 16 docs still mark the Edge runtime deprecated, and that `after()` has no retry.
- That both providers express amounts in the smallest currency unit.
- That the docs and Context7 links resolve.
