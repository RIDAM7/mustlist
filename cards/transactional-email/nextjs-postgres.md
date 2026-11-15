---
id: transactional-email/nextjs-postgres
title: Transactional email for a Next.js + Postgres app
topic: transactional-email
stack: [nextjs, postgres, typescript]
summary: >-
  Queue each email in a Postgres outbox in the write's transaction; a worker
  sends it via an email API with idempotency keys, from a DMARC-aligned
  subdomain. Suppress bounces via verified webhooks, rate-limit per recipient,
  and email only hashed, single-use tokens.
status: verified
card_version: 1.0.0
last_verified: 2026-11-15
review_level: seed
authors: [RIDAM7]
reviewers: [RIDAM7]
lenses: [security, performance, ux, data, cost]
applies_when:
  app_types: [web-app, saas, e-commerce, marketplace]
  not_for: [marketing-newsletters-only, static-site-without-backend]
related:
  [
    auth/nextjs-postgres,
    rate-limiting/nextjs-postgres,
    background-jobs/nextjs-postgres,
    idempotency-keys/nextjs-postgres,
    payments-webhooks/nextjs-postgres,
    security-headers/nextjs,
  ]

checklist:
  - id: authenticate-domain
    lens: security
    level: must
    text: Publish SPF and DKIM (2048-bit key) for the sending domain so at least one aligns with the From domain, plus DMARC starting at p=none with reports, then quarantine or reject.
    why: Gmail and Yahoo require SPF and DKIM plus DMARC from bulk senders and SPF or DKIM from all; Outlook.com requires all three above 5,000 a day.
  - id: sending-subdomain
    lens: ux
    level: should
    text: Send transactional mail from its own subdomain and provider stream, separate from marketing, and keep promotions out of it.
    why: Isolates reputation. Gmail and Yahoo require one-click unsubscribe (RFC 8058) for marketing, not transactional mail; promotions change that.
  - id: outbox-worker
    lens: performance
    level: must
    text: Insert an outbox row in the same transaction as the change that triggers the email and send from a worker; never await the provider inside the request.
    why: Provider latency, 429s and outages then never fail sign-up, and no committed change can lose its email.
  - id: idempotent-send
    lens: data
    level: must
    text: Give each email a stable dedupe key under a unique constraint (for example `receipt:<order_id>`) and pass it as the provider idempotency key on every retry where supported.
    why: Resend keeps keys 24 hours; SES SendEmail and Postmark have no key, so the outbox is your only guard against duplicates.
  - id: retry-backoff
    lens: performance
    level: must
    text: Retry 429, 5xx and network errors with capped backoff and jitter, honouring Retry-After; never retry validation errors, permanent SMTP rejections, or jobs whose token expired.
    why: Retrying a permanent failure repeats it and burns quota, and a reset email that arrives after its link expired only confuses the user.
  - id: verify-event-webhooks
    lens: security
    level: must
    text: Verify bounce and complaint webhooks on the raw body (Resend signature, SNS signature plus TopicArn) and store event ids once; Postmark signs nothing, so use basic auth and its IP ranges.
    why: The webhook URL is public; an unverified event could suppress any address or hide real bounces.
  - id: suppression-list
    lens: data
    level: must
    text: Mirror hard bounces and complaints into a Postgres suppression table keyed by normalised address, check it before every send, and record skipped sends.
    why: Repeated sends to dead or complaining addresses raise bounce and spam rates, and providers drop them silently anyway.
  - id: monitor-reputation
    lens: ux
    level: should
    text: Alert on rising bounce and complaint rates, and watch the spam rate in Gmail Postmaster Tools (Gmail requires under 0.3% and asks for under 0.1%).
    why: Gmail sends no complaint data to SES, so Gmail users' spam reports never reach those webhooks.
  - id: rate-limit-recipient
    lens: security
    level: must
    text: Limit emails per recipient address, per account and per IP (for example 3 reset emails per address per hour), plus a daily cap per template, as in the rate-limiting card.
    why: Attackers submit a victim's address to public forms to flood their inbox, burning your quota and reputation.
  - id: no-enumeration
    lens: security
    level: must
    text: Return the same response and similar timing for reset and sign-in link requests whether or not the account exists; enqueue the email only for real accounts.
  - id: secure-links
    lens: security
    level: must
    text: Put only a random, single-use token in links, stored hashed and expiring within 24 hours (shorter for sign-in), on a configured base URL; turn off click tracking for these emails.
    why: NIST caps emailed recovery codes at 24 hours; click tracking routes the token through a third-party redirect and its logs.
  - id: scanner-safe-links
    lens: ux
    level: should
    text: Consume tokens on a POST from a confirm page, or with a typed code, never on the link's GET request.
    why: Some mail security scanners open links before the user does and would use up single-use tokens.
  - id: plain-text-accessible
    lens: ux
    level: must
    text: Send a plain-text part with every HTML email; give the HTML a `lang` attribute, real text instead of images of text, alt text, and link text that names the action.
  - id: minimal-logging
    lens: data
    level: must
    text: Log template, recipient, provider message id, status and timestamps; never log bodies, links or tokens, and clear outbox payloads once sent or expired.
  - id: block-dev-sends
    lens: security
    level: must
    text: Use separate provider keys per environment; outside production send through a capture transport or only to allowlisted addresses such as provider test addresses.
    why: A seed script or test run with the production key emails real users and hurts domain reputation.

decisions:
  - id: existing-provider
    question: Do you already have an email provider or relay that you must use?
    options:
      - { id: api-provider, label: "Yes, an email API provider", points_to: api-provider-outbox }
      - { id: aws-ses, label: "Yes, Amazon SES in our AWS account", points_to: amazon-ses }
      - { id: smtp-relay, label: "Only an SMTP relay (corporate or hosting mail server)", points_to: smtp-nodemailer }
      - { id: undecided, label: "No, help me choose" }
    default: undecided
  - id: monthly-volume
    question: How many transactional emails do you expect to send per month in year one?
    options:
      - { id: under-100k, label: "Under 100,000" }
      - { id: over-100k, label: "More than 100,000, and per-email price matters", points_to: amazon-ses }
    default: under-100k
  - id: marketing-mail
    question: Will the same domain also send marketing email or newsletters?
    options:
      - { id: transactional-only, label: "No, transactional email only" }
      - { id: marketing-too, label: "Yes (needs its own subdomain and one-click unsubscribe)" }
    default: transactional-only
  - id: job-runner
    question: Do you already run a queue or background job runner?
    options:
      - { id: existing-queue, label: "Yes, a queue or job service" }
      - { id: postgres-only, label: "No, only Postgres (use an outbox table and a worker)" }
    default: postgres-only
  - id: sign-in-email
    question: Will email carry sign-in links or one-time sign-in codes?
    options:
      - { id: magic-links, label: "Sign-in links (magic links)" }
      - { id: typed-codes, label: "Typed one-time codes" }
      - { id: reset-only, label: "Neither; only verification, reset and notifications" }
    default: reset-only

options:
  - id: api-provider-outbox
    name: Email API provider called from an outbox worker
    examples: [Resend, Postmark, SendGrid]
    best_fit_when:
      - Most apps, including serverless deployments, because sends are plain HTTPS calls
      - You want signed bounce and complaint webhooks and a managed suppression list
      - You want provider-side idempotency keys (Resend supports them)
    avoid_when:
      - Volume is high enough that per-email price dominates your bill
      - Data-residency rules forbid the provider's regions
    tradeoffs:
      - Monthly plans cost more per email than SES at volume
      - Webhook formats, signing and idempotency support differ by provider (Postmark has neither keys nor signatures)
  - id: amazon-ses
    name: Amazon SES through the SESv2 SDK
    examples: [Amazon SES]
    best_fit_when:
      - You already run on AWS and can own IAM, SNS and configuration sets
      - High volume where the lowest per-email price matters
    avoid_when:
      - You must launch within days (new accounts start in the sandbox; AWS gives a first answer to production-access requests within 96 hours)
      - Nobody on the team will build and watch the bounce and complaint pipeline
    tradeoffs:
      - No idempotency token on SendEmail; deduplicate in the outbox
      - Bounces and complaints arrive through SNS, which you subscribe to and verify yourself
  - id: smtp-nodemailer
    name: SMTP relay through Nodemailer
    examples: [Nodemailer]
    best_fit_when:
      - You must use an existing SMTP relay or want to switch providers by changing credentials
      - Local development and tests that capture mail instead of sending it
    avoid_when:
      - Short-lived serverless functions, which reconnect on every send and cannot keep a pool
      - You need provider idempotency keys or rich event data
    tradeoffs:
      - Slower than HTTPS APIs per message; pooling needs a long-running worker
      - Bounce and complaint events still come from the relay provider's webhooks, if it has them
recommended: api-provider-outbox

versions:
  - package: resend
    range: ">=6.0.0 <7.0.0"
    notes:
      - "`emails.send()` resolves to `{ data, error }` without throwing, and the SDK has no retries: throw on `error` in the worker so the job retries."
      - "Pass `{ idempotencyKey }` as the second argument (kept 24 hours); a 409 `invalid_idempotent_request` means the payload changed."
      - "The default limit is 10 requests per second per team; on 429 wait the `retry-after` seconds."
      - "Since 6.2.0, `resend.webhooks.verify(...)` checks the raw body against the `svix-*` headers."
    docs: https://resend.com/docs/dashboard/emails/idempotency-keys
    context7: https://context7.com/resend/resend-node
  - package: "@aws-sdk/client-sesv2"
    range: ">=3.0.0 <4.0.0"
    notes:
      - "`SendEmail` has no idempotency token, and a `MessageId` means accepted, not sent: deduplicate in the outbox."
      - "The client already retries throttling and 5xx errors (3 attempts by default)."
      - "New accounts start in the sandbox per Region (verified recipients, 200 a day); request production access before launch."
    docs: https://docs.aws.amazon.com/ses/latest/APIReference-V2/API_SendEmail.html
    context7: https://context7.com/aws/aws-sdk-js-v3
  - package: nodemailer
    range: ">=10.0.0 <11.0.0"
    notes:
      - "Needs Node.js 20+. Since 10.2.0, `err.permanent` is true for 5xx replies except 503: do not retry those."
      - "Use `jsonTransport: true` in development and tests to build messages without sending them."
    docs: https://nodemailer.com/smtp
    context7: https://context7.com/nodemailer/nodemailer
  - package: react-email
    range: ">=6.0.0 <7.0.0"
    notes:
      - "Import components and `render` from `react-email` (`@react-email/components` is deprecated); `render()` returns a Promise."
      - "Build the text part with `toPlainText(html)` or `render(element, { plainText: true })`."
    docs: https://react.email/docs/utilities/render
    context7: https://context7.com/resend/react-email
  - package: next
    range: ">=16.0.0 <17.0.0"
    notes:
      - "`after()` never retries: use it only to nudge the outbox worker. Keep provider keys out of `NEXT_PUBLIC_` variables."
      - "Build email links from a configured base URL, never from the request's `host` header."
    docs: https://nextjs.org/docs/app/api-reference/functions/after
    context7: https://context7.com/vercel/next.js

verify:
  - id: outbox-same-transaction
    lens: data
    type: integration
    check: When the transaction that creates a user or order rolls back, no outbox row exists; when it commits, exactly one row exists even with the worker stopped.
  - id: provider-down-request-ok
    lens: performance
    type: integration
    check: With the email provider mocked to time out, sign-up and password-reset requests still return their normal response in under 1 second.
  - id: duplicate-job-one-send
    lens: data
    type: integration
    check: Running the same outbox job twice, including from two workers at once, makes one provider call, or several calls that all carry the same idempotency key.
  - id: retry-classification
    lens: performance
    type: unit
    check: A 429 with Retry-After schedules the next attempt no earlier than that delay, a 5xx retries with backoff, and a validation error or permanent SMTP rejection is not retried and is marked failed.
  - id: webhook-signature
    lens: security
    type: integration
    check: A bounce webhook with a missing or wrong signature gets 400 and changes nothing; a validly signed payload with unusual JSON whitespace passes.
  - id: bounce-suppresses
    lens: data
    type: integration
    check: A verified hard-bounce or complaint event delivered twice adds the address to the suppression table once, and later emails for it are skipped and recorded as suppressed.
  - id: reset-no-enumeration
    lens: security
    type: integration
    check: Reset requests for an existing and an unknown email return the same status and body with similar timing, and only the existing account gets an outbox row.
  - id: token-single-use
    lens: security
    type: integration
    check: An emailed token works once, fails on reuse and after expiry, the database stores only its hash, and no log line contains the raw token.
  - id: scanner-get-safe
    lens: security
    type: e2e
    check: Opening an emailed link with GET does not consume its token; only the confirming POST does.
  - id: recipient-rate-limit
    lens: security
    type: integration
    check: Requesting more reset emails for one address than the limit, from many IPs, enqueues no further emails and still returns the same generic response.
  - id: template-parts
    lens: ux
    type: unit
    check: Every template renders non-empty HTML and plain-text parts, the HTML root has a lang attribute, and every image has alt text.
  - id: dev-cannot-send
    lens: security
    type: integration
    check: With non-production configuration, sending to an address outside the allowlist never calls the real provider.

sources:
  - { title: "Google: Email sender guidelines", url: "https://support.google.com/a/answer/81126" }
  - { title: "Google: Email sender guidelines FAQ", url: "https://support.google.com/a/answer/14229414" }
  - { title: "Yahoo Sender Hub: Sender best practices", url: "https://senders.yahooinc.com/best-practices/" }
  - { title: "Yahoo Sender Hub: FAQs", url: "https://senders.yahooinc.com/faqs/" }
  - { title: "Microsoft: Outlook's new requirements for high-volume senders", url: "https://techcommunity.microsoft.com/blog/microsoft-defender-for-office-365-blog/strengthening-email-ecosystem-outlook%E2%80%99s-new-requirements-for-high%E2%80%90volume-senders/4399730" }
  - { title: "RFC 9989: DMARC (obsoletes RFC 7489)", url: "https://www.rfc-editor.org/rfc/rfc9989.html" }
  - { title: "RFC 7208: Sender Policy Framework (SPF)", url: "https://www.rfc-editor.org/rfc/rfc7208.html" }
  - { title: "RFC 6376: DomainKeys Identified Mail (DKIM) Signatures", url: "https://www.rfc-editor.org/rfc/rfc6376.html" }
  - { title: "RFC 8058: One-Click Unsubscribe for List Email Headers", url: "https://www.rfc-editor.org/rfc/rfc8058.html" }
  - { title: "FTC: CAN-SPAM Act compliance guide for business", url: "https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business" }
  - { title: "OWASP Forgot Password Cheat Sheet", url: "https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html" }
  - { title: "NIST SP 800-63B-4: Authentication and Authenticator Management", url: "https://pages.nist.gov/800-63-4/sp800-63b.html" }
  - { title: "Resend: Idempotency keys", url: "https://resend.com/docs/dashboard/emails/idempotency-keys" }
  - { title: "Resend: Rate limit", url: "https://resend.com/docs/api-reference/rate-limit" }
  - { title: "Resend: Verify webhook requests", url: "https://resend.com/docs/dashboard/webhooks/verify-webhooks-requests" }
  - { title: "Resend: Webhook retries and replays", url: "https://resend.com/docs/webhooks/retries-and-replays" }
  - { title: "Resend: Email suppressions", url: "https://resend.com/docs/dashboard/emails/email-suppressions" }
  - { title: "Resend: Send test emails", url: "https://resend.com/docs/dashboard/emails/send-test-emails" }
  - { title: "Amazon SES API v2: SendEmail", url: "https://docs.aws.amazon.com/ses/latest/APIReference-V2/API_SendEmail.html" }
  - { title: "Amazon SES: Request production access (sandbox limits)", url: "https://docs.aws.amazon.com/ses/latest/dg/request-production-access.html" }
  - { title: "Amazon SES: Account-level suppression list", url: "https://docs.aws.amazon.com/ses/latest/dg/sending-email-suppression-list.html" }
  - { title: "Amazon SES: Setting up event notifications", url: "https://docs.aws.amazon.com/ses/latest/dg/monitor-sending-activity-using-notifications.html" }
  - { title: "Amazon SNS: Verifying message signatures", url: "https://docs.aws.amazon.com/sns/latest/dg/sns-verify-signature-of-message.html" }
  - { title: "AWS SDKs and Tools: Retry behavior", url: "https://docs.aws.amazon.com/sdkref/latest/guide/feature-retry-behavior.html" }
  - { title: "Postmark: Webhooks overview (security and retries)", url: "https://postmarkapp.com/developer/webhooks/webhooks-overview" }
  - { title: "Postmark: What is an idempotency key?", url: "https://postmarkapp.com/support/article/what-is-an-idempotency-key" }
  - { title: "React Email: render utility", url: "https://react.email/docs/utilities/render" }
  - { title: "React Email: Updating React Email (6.0)", url: "https://react.email/docs/getting-started/updating-react-email" }
  - { title: "Nodemailer changelog", url: "https://github.com/nodemailer/nodemailer/blob/master/CHANGELOG.md" }
  - { title: "Next.js after reference", url: "https://nextjs.org/docs/app/api-reference/functions/after" }
  - { title: "Next.js environment variables guide", url: "https://nextjs.org/docs/app/guides/environment-variables" }
  - { title: "Supabase: OTP verification failures (email link prefetching)", url: "https://supabase.com/docs/guides/troubleshooting/otp-verification-failures-token-has-expired-or-otp_expired-errors-5ee4d0" }
---

## Why this approach

Transactional email fails in ways a request handler cannot fix: providers rate-limit, time out and go down, and mailbox providers reject mail from unauthenticated domains. Writing an outbox row in the same transaction as the change and sending from a worker means a slow provider never breaks sign-up, and a retry never sends twice when the provider honours an idempotency key. An email API provider is the default because it adds signed bounce and complaint webhooks, a managed suppression list and an HTTPS API that works from serverless functions. Choose Amazon SES when you already run on AWS and per-email price matters at your volume, and SMTP through Nodemailer when you must use an existing relay.

## Lenses

### Security

Treat every form that sends email as an abuse target: limit sends per recipient address, per account and per IP, because attackers submit a victim's address to flood their inbox. Return the same response for known and unknown addresses, and enqueue email only for real accounts. Links carry only a random token (for example 32 bytes from `crypto.randomBytes`), stored as a SHA-256 hash, used once and expiring within NIST's 24-hour cap for emailed recovery codes; sign-in links should expire much sooner. NIST SP 800-63B-4 forbids email for out-of-band authentication, so treat a magic link as a single factor. Build URLs from a configured base URL, never the `Host` header, and serve token pages with `Referrer-Policy: no-referrer` before redirecting to a token-free URL. Verify webhooks before acting: Resend signs with `svix-*` headers, SES events arrive as signed SNS messages, and Postmark signs nothing, so protect it with basic auth and its published IP ranges. Keep provider keys server-only, one per environment, with sending-only permission where offered.

### Performance & latency

Send nothing inside the request. The worker claims due rows with `FOR UPDATE SKIP LOCKED`, sends, and stores the provider message id. Resend allows 10 requests per second per team by default and answers 429 with `retry-after`; SES enforces a per-account send rate and its SDK already retries throttling up to 3 attempts. Honour `Retry-After`, otherwise back off exponentially with jitter, and stop after a capped number of attempts.

```ts
const { data, error } = await resend.emails.send(
  { from: 'Acme <no-reply@notify.example.com>', to: job.toAddress, subject, html, text },
  { idempotencyKey: `email/${job.id}` }, // same key on every retry; kept 24 hours
);
if (error) throw new EmailSendError(error); // the SDK returns errors, it does not throw
await markSent(job.id, data.id);
```

### UX flows

Say what happens next: "If an account exists for that address, we sent a link that expires in 30 minutes," with a resend button behind a cooldown. Some mail scanners, such as link-rewriting security gateways, open links before the user, so a link should open a page with a Continue button that consumes the token on POST, or ask for a typed code. When an address is suppressed, show an in-app banner asking the user to fix it instead of failing silently. Render templates on the server with React Email, and send the `toPlainText` output as the text part. Use a `lang` attribute, real text rather than images of text, alt text, link text that names the action, and the full URL as a fallback. Keep promotions out of receipts: Gmail and Yahoo exempt transactional mail from one-click unsubscribe, but CAN-SPAM treats a message whose primary purpose is promotion as commercial.

### Data model

```sql
CREATE TABLE email_outbox (
  id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  dedupe_key          text NOT NULL UNIQUE,  -- e.g. 'receipt:' || order_id
  template            text NOT NULL,
  to_address          text NOT NULL,
  payload             jsonb,                 -- cleared after send or expiry
  status              text NOT NULL DEFAULT 'pending',
  attempts            int NOT NULL DEFAULT 0,
  run_after           timestamptz NOT NULL DEFAULT now(),
  expires_at          timestamptz,
  provider_message_id text
);
CREATE TABLE email_suppressions (address text PRIMARY KEY, reason text NOT NULL,
  event_id text, created_at timestamptz NOT NULL DEFAULT now());
```

Add a partial index on pending rows by `run_after`. Store addresses normalised (trimmed, lowercase) so lookups match. Keep the raw link token only in the outbox payload until the send succeeds or expires; the tokens table holds only the hash. Record webhook events with a unique `(provider, event_id)`, as in the payments-webhooks card.

### Cost

Free tiers are small: Resend's free plan stops at 100 emails a day, which a launch-day sign-up burst can exceed, and test sends count against the quota. SES lists $0.10 per 1,000 emails but needs SNS, IAM and engineering time for the bounce pipeline. An unthrottled form lets anyone spend your quota and damage your domain's reputation, which is slow to rebuild.

## Common mistakes

- Awaiting the provider call inside the sign-up or reset request, so an outage fails the request.
- Leaving DKIM on the provider's shared domain and SPF on its return path, so neither aligns with the From domain and DMARC fails.
- Retrying with a new idempotency key, or none, so a timeout after acceptance sends duplicates.
- Ignoring bounce and complaint events, so sends keep hitting dead addresses until the provider pauses the account.
- Using the production key in development, or seed scripts that email real users.
- Adding promotions to receipts, which makes them commercial mail.
