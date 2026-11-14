---
id: rate-limiting/nextjs-postgres
title: Rate limiting for a Next.js + Postgres app
topic: rate-limiting
stack: [nextjs, postgres, typescript]
summary: >-
  Rate-limit auth, costly and public API endpoints per account or API key plus
  IP, in Route Handlers and Server Actions, with counters in a shared store (a
  Postgres upsert by default). Return 429 with Retry-After and trust only your
  platform's client-IP header.
status: draft
card_version: 0.1.0
last_verified: null
review_level: null
authors: [RIDAM7]
reviewers: []
lenses: [security, performance, ux, data, cost]
applies_when:
  app_types: [web-app, saas, public-api]
  not_for: [static-site-without-server-endpoints]
related: [auth/nextjs-postgres, payments-webhooks/nextjs-postgres]

checklist:
  - id: limit-auth-endpoints
    lens: security
    level: must
    text: Rate-limit login, sign-up, password reset, OTP send and verify, and verification-email resend, per submitted identifier and per IP.
    why: Stops credential stuffing, OTP brute force, and email or SMS bombing.
  - id: limit-costly-endpoints
    lens: cost
    level: must
    text: Limit AI calls, email and SMS sends, and exports per account, with both a short-window limit and a daily quota.
    why: One script can run up a provider bill in minutes (OWASP API4:2023).
  - id: key-by-identity
    lens: security
    level: must
    text: Key limits by account id or API key when known, plus the client IP; never by IP alone.
    why: Users behind one NAT share an IP, and attackers spread attempts across many IPs.
  - id: trusted-client-ip
    lens: security
    level: must
    text: "Read the client IP only from a header your platform sets (for example `x-real-ip` on Vercel, `CF-Connecting-IP` behind Cloudflare); never the leftmost `X-Forwarded-For` value."
    why: Clients can set X-Forwarded-For, so trusting it lets an attacker choose their own bucket.
  - id: ipv6-prefix
    lens: security
    level: should
    text: When keying by IP, group IPv6 addresses by prefix (at least /64) instead of using the full address.
    why: One customer usually gets a whole /56 or /48 and can rotate addresses inside it.
  - id: shared-store
    lens: performance
    level: must
    text: Keep counters in a shared store (Postgres, Redis, or the platform's limiter), never in process memory.
    why: Each serverless instance has its own memory, and in-memory counts reset on restart.
  - id: atomic-increment
    lens: data
    level: must
    text: Increment and read the counter in one atomic statement (`INSERT ... ON CONFLICT DO UPDATE ... RETURNING`); never SELECT then UPDATE.
    why: Read-then-write lets concurrent requests slip past the limit.
  - id: enforce-in-handler
    lens: security
    level: must
    text: Check the limit inside each Route Handler and Server Action before any expensive work; treat proxy.ts and WAF rules as an extra, coarse layer.
    why: A proxy matcher that skips a path also skips the Server Functions on that path.
  - id: return-429
    lens: ux
    level: must
    text: Return 429 with Retry-After (seconds) from Route Handlers, and a typed rate-limited result with the retry time from Server Actions.
  - id: explicit-fail-mode
    lens: security
    level: must
    text: Set a short timeout on limiter calls and choose fail-open or fail-closed per endpoint; fail closed on auth and costly endpoints and alert on store errors.
    why: Some limiter libraries allow requests by default when the store times out.
  - id: cleanup-old-rows
    lens: data
    level: must
    text: Delete expired counter rows with a scheduled job and index the window column; don't rely on in-process timers in serverless.
  - id: hash-keys
    lens: data
    level: should
    text: Store an HMAC of emails and IPs in counter keys instead of raw values, and keep rows only as long as the longest window.
    why: The counter table then holds no readable personal data.
  - id: spending-caps
    lens: cost
    level: should
    text: Set spending caps or billing alerts with your SMS, email and AI providers.
    why: Rate limits cap request rates, not total spend.
  - id: monitor-limit-hits
    lens: security
    level: should
    text: Log rate-limit rejections per endpoint and key type, and alert on spikes.
    why: Spikes reveal attacks, and steady rejections of real users reveal limits set too low.

decisions:
  - id: hosting
    question: Where does the app run, and what sits in front of it?
    options:
      - { id: vercel, label: "Vercel (read x-real-ip or the platform IP helper)" }
      - { id: cloudflare-proxied, label: "Behind Cloudflare (read CF-Connecting-IP)" }
      - { id: own-proxy, label: "Self-hosted behind my own reverse proxy or load balancer" }
      - { id: other-host, label: "Another host (check its docs for the trusted client-IP header)" }
  - id: traffic-volume
    question: Will any limited endpoint take sustained high traffic, such as a public API with many clients?
    options:
      - { id: modest, label: "No, mainly auth and costly endpoints at modest rates" }
      - { id: high-volume, label: "Yes, high request rates on limited endpoints", points_to: redis-store }
    default: modest
  - id: existing-redis
    question: Do you already run Redis or a managed Redis-compatible service?
    options:
      - { id: have-redis, label: "Yes, one is already in the stack", points_to: redis-store }
      - { id: no-redis, label: "No, only Postgres" }
    default: no-redis
  - id: algorithm
    question: Which counting algorithm fits the limited endpoints?
    options:
      - { id: fixed-window, label: "Fixed window: simplest and cheapest; fine for auth and daily quotas" }
      - { id: sliding-window, label: "Sliding window: smoother limits for public APIs, at extra cost" }
      - { id: token-bucket, label: "Token bucket: allow short bursts at a steady average rate" }
    default: fixed-window
  - id: store-outage
    question: What should happen when the limiter store is down or times out?
    options:
      - { id: closed-for-sensitive, label: "Fail closed for auth and costly endpoints, open for the rest" }
      - { id: open-everywhere, label: "Fail open everywhere and alert" }
      - { id: closed-everywhere, label: "Fail closed everywhere" }
    default: closed-for-sensitive
  - id: edge-flood
    question: Do you need to block request floods before they reach your functions and database?
    options:
      - { id: block-at-edge, label: "Yes, add platform or WAF limits in front", points_to: platform-edge }
      - { id: app-only, label: "No, app-level limits are enough for now" }
    default: app-only

options:
  - id: postgres-counters
    name: Postgres counter table with an atomic upsert
    examples: [rate-limiter-flexible (Postgres store)]
    best_fit_when:
      - You already run Postgres and don't want another service
      - Limits guard auth and costly endpoints at modest request rates
      - You want counters in the same database, region and backups as your data
    avoid_when:
      - Limited endpoints take sustained high request rates (each check is a write)
      - Your database is already the bottleneck
    tradeoffs:
      - Adds one indexed write and a database round trip per limited request
      - Needs a scheduled cleanup job and some vacuum headroom
  - id: redis-store
    name: Redis or a managed Redis-compatible store
    examples: [Upstash Ratelimit, rate-limiter-flexible (Redis or Valkey store)]
    best_fit_when:
      - A public API or other endpoint takes high request rates
      - You already run Redis, or want sliding-window and token-bucket algorithms built in
    avoid_when:
      - You would add a new service only to limit a few auth endpoints
    tradeoffs:
      - Another service to pay for, secure and monitor
      - Check what the library does on a store timeout; some allow the request
  - id: platform-edge
    name: Platform or WAF rate limiting at the edge
    examples: [Vercel WAF rate limiting, Cloudflare rate limiting rules, AWS WAF rate-based rules]
    best_fit_when:
      - You want to drop per-IP floods before they reach functions and the database
      - You want limits without writing or running counter code
    avoid_when:
      - You need per-account or per-API-key limits and your plan only counts by IP
      - You need exact global counts (counters are kept per region or data center)
    tradeoffs:
      - Keys, window lengths and rule counts depend on the plan
      - Configuration lives in a dashboard, outside the repo and code review
recommended: postgres-counters

versions:
  - package: next
    range: ">=16.0.0"
    notes:
      - "`middleware.ts` is renamed to `proxy.ts`; Proxy runs on Node.js by default but is not meant for slow data fetching, so keep store lookups in handlers."
      - "Server Functions are POST requests to the route that uses them; a Proxy matcher that excludes the path also skips them, so check limits inside each action."
      - "`NextRequest.ip` was removed in v15; read the client IP from your host's trusted header or helper."
      - "In-memory counters are per instance and reset on restart; keep counts in a shared store or use your host's rate limiting."
    docs: https://nextjs.org/docs/app/guides/backend-for-frontend#rate-limiting
    context7: https://context7.com/vercel/next.js
  - package: postgresql
    range: ">=14.0.0"
    notes:
      - "`date_bin()`, used here to bucket timestamps into windows, exists from PostgreSQL 14."
      - "`INSERT ... ON CONFLICT DO UPDATE` guarantees an atomic insert-or-update outcome under concurrency; add `RETURNING` to read the new count in the same statement."
      - "`UNLOGGED` tables are faster but are truncated after a crash and are not replicated to standby servers."
    docs: https://www.postgresql.org/docs/current/sql-insert.html
  - package: "@upstash/ratelimit"
    range: ">=2.0.0"
    notes:
      - "If Redis doesn't answer within the timeout (default 5 s), the request is allowed; set a shorter timeout and handle the fail mode yourself on sensitive endpoints."
      - "The ephemeral cache of blocked identifiers lives in instance memory; create the limiter outside the handler so it is reused."
      - "Multi-region mode syncs asynchronously and can exceed the limit slightly; token bucket is not supported there."
    docs: https://upstash.com/docs/redis/sdks/ratelimit-ts/overview
    context7: https://context7.com/websites/upstash_redis_sdks_ratelimit-
  - package: "@vercel/firewall"
    range: ">=1.0.0"
    notes:
      - "`checkRateLimit` needs a matching rate limit ID configured as a rule in the Vercel Firewall dashboard."
      - "A custom `rateLimitKey` replaces the default client-IP bucket; build a compound key yourself to limit by IP and account together."
      - "Counters are tracked per region, so a key hit from several regions can exceed the configured limit."
      - "The `timeout` option exists from 1.2.6; decide per endpoint what a timeout means."
    docs: https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting-sdk

verify:
  - id: account-limit-across-ips
    lens: security
    type: integration
    check: Failed logins for one email sent from several different IPs are rejected with 429 once the per-account limit is reached.
  - id: ip-limit-across-accounts
    lens: security
    type: integration
    check: Login attempts for many different emails from one IP are rejected with 429 once the per-IP limit is reached.
  - id: retry-after-header
    lens: ux
    type: integration
    check: Every 429 response has a Retry-After header with a positive whole number of seconds that matches when the window resets.
  - id: spoofed-xff-ignored
    lens: security
    type: unit
    check: The client-IP helper ignores client-supplied X-Forwarded-For entries and returns only the address set by the trusted platform or proxy.
  - id: concurrent-increments
    lens: data
    type: integration
    check: With a limit of N, sending 5N concurrent requests for one key allows exactly N and rejects the rest.
  - id: shared-across-instances
    lens: performance
    type: integration
    check: The limit still holds when requests alternate between two app instances, and after an instance restarts.
  - id: direct-call-limited
    lens: security
    type: integration
    check: Calling a limited Server Action or Route Handler directly, without passing through proxy.ts, is still rate limited.
  - id: store-down-behaviour
    lens: security
    type: integration
    check: With the limiter store unreachable, endpoints follow the chosen fail mode (for example 503 on auth and costly endpoints), and an error is logged.
  - id: daily-quota
    lens: cost
    type: integration
    check: An account that reaches its daily quota on an AI, SMS or email endpoint is blocked until the quota resets, whatever IP it uses.
  - id: cleanup-removes-rows
    lens: data
    type: integration
    check: The cleanup job deletes counter rows older than the longest window and keeps rows for current windows.
  - id: no-raw-pii-keys
    lens: data
    type: unit
    check: Counter keys contain no raw email addresses or IP addresses.

sources:
  - { title: "OWASP API Security Top 10 2023, API4: Unrestricted Resource Consumption", url: "https://api-security.owasp.org/editions/2023/en/0xa4-unrestricted-resource-consumption" }
  - { title: OWASP Authentication Cheat Sheet (login throttling), url: "https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html#login-throttling" }
  - { title: OWASP Credential Stuffing Prevention Cheat Sheet, url: "https://cheatsheetseries.owasp.org/cheatsheets/Credential_Stuffing_Prevention_Cheat_Sheet.html" }
  - { title: "RFC 6585, Section 4: 429 Too Many Requests", url: "https://www.rfc-editor.org/rfc/rfc6585#section-4" }
  - { title: "RFC 9110, Section 10.2.3: Retry-After", url: "https://www.rfc-editor.org/rfc/rfc9110#section-10.2.3" }
  - { title: IETF draft-ietf-httpapi-ratelimit-headers (RateLimit header fields), url: "https://datatracker.ietf.org/doc/draft-ietf-httpapi-ratelimit-headers/" }
  - { title: MDN X-Forwarded-For (security and privacy concerns), url: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/X-Forwarded-For" }
  - { title: Next.js Backend for Frontend guide (rate limiting), url: "https://nextjs.org/docs/app/guides/backend-for-frontend#rate-limiting" }
  - { title: Next.js proxy.ts file convention, url: "https://nextjs.org/docs/app/api-reference/file-conventions/proxy" }
  - { title: Next.js Error Handling (expected errors in Server Functions), url: "https://nextjs.org/docs/app/getting-started/error-handling" }
  - { title: PostgreSQL INSERT (ON CONFLICT), url: "https://www.postgresql.org/docs/current/sql-insert.html" }
  - { title: PostgreSQL Heap-Only Tuples (HOT), url: "https://www.postgresql.org/docs/current/storage-hot.html" }
  - { title: PostgreSQL CREATE TABLE (UNLOGGED), url: "https://www.postgresql.org/docs/current/sql-createtable.html" }
  - { title: Vercel request headers, url: "https://vercel.com/docs/headers/request-headers" }
  - { title: Vercel WAF Rate Limiting, url: "https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting" }
  - { title: Cloudflare HTTP headers (CF-Connecting-IP), url: "https://developers.cloudflare.com/fundamentals/reference/http-headers/" }
  - { title: Cloudflare rate limiting rules, url: "https://developers.cloudflare.com/waf/rate-limiting-rules/" }
  - { title: Upstash Ratelimit algorithms, url: "https://upstash.com/docs/redis/sdks/ratelimit-ts/algorithms" }
  - { title: "RIPE-690: Best Current Operational Practice for IPv6 prefix assignment", url: "https://www.ripe.net/publications/docs/ripe-690/" }
---

## Why this approach

A Postgres counter table with one atomic upsert per check works across every serverless instance, adds no new service, and is enough for auth and costly endpoints, which see modest request rates. Run the check inside the Route Handler or Server Action, where you know the account or API key, not in `proxy.ts`. Add platform or WAF rate limiting in front when you need to drop per-IP floods before they reach your functions. Move counters to Redis or a managed Redis-compatible service when a public API or other high-volume endpoint makes one database write per request too expensive.

## Lenses

### Security

Limit login, sign-up, password reset, OTP send and verify, and verification-email resend by both the submitted identifier (normalised email or account id) and the client IP. The OWASP Authentication Cheat Sheet ties failed-login counters to the account, because per-IP limits alone miss attacks spread across many addresses. Key public APIs by API key. Take the IP only from a header your platform sets: Vercel overwrites `X-Forwarded-For` and also sends `x-real-ip`; Cloudflare recommends `CF-Connecting-IP`; behind your own proxy, scan `X-Forwarded-For` from the right and take the first address your proxies didn't add. The leftmost value is whatever the client sent. Run the check inside each Server Action, because a `proxy.ts` matcher that skips a path also skips its Server Functions. Fail closed on auth and costly endpoints so a store outage can't open them to brute force. Rate limits slow attackers but don't stop them; OWASP treats them as one layer next to MFA and monitoring.

### Performance & latency

Each check is one round trip to the store, so make it one statement: an `INSERT ... ON CONFLICT DO UPDATE ... RETURNING` increments and reads atomically, even under concurrency. Use your provider's pooled connection string in serverless. Don't query the store from `proxy.ts` on every matched request; the Next.js docs say Proxy isn't meant for slow data fetching. A fixed window needs one row per key per window, but a client can send up to twice the limit in a short burst across a window boundary. A sliding window weights the previous window's count to smooth that, at the cost of reading two rows. A token bucket allows short bursts at a steady average rate and suits API clients. Set a short timeout on the store call. A CDN that serves a cached response never runs your limiter, so don't cache limited routes publicly.

### UX flows

Return HTTP 429 with a `Retry-After` header in seconds (RFC 6585, RFC 9110) and a short message that says when to try again. In Server Actions, treat the limit as an expected error: return a result such as `{ error: 'rate_limited', retryAfter }` and show it with `useActionState`, as the Next.js error-handling guide recommends. Keep auth messages generic so a limit never reveals whether an email exists. Per-account limits let an attacker lock out a real user, so prefer short, growing delays over long lockouts, and keep password reset working while login is throttled. For public APIs, document the limits. The IETF `RateLimit` and `RateLimit-Policy` header fields are still an Internet-Draft (draft 11, May 2026), so treat them as optional and expect changes.

### Data model

Keep counters in a narrow table keyed by `(key, window_start)`, with an index on `window_start` for cleanup:

```sql
CREATE TABLE rate_limit_hits (
  key          text        NOT NULL,
  window_start timestamptz NOT NULL,
  hits         integer     NOT NULL DEFAULT 1,
  PRIMARY KEY (key, window_start)
);
CREATE INDEX ON rate_limit_hits (window_start);

INSERT INTO rate_limit_hits (key, window_start)
VALUES ($1, date_bin('60 seconds', now(), timestamptz '2000-01-01'))
ON CONFLICT (key, window_start)
DO UPDATE SET hits = rate_limit_hits.hits + 1
RETURNING hits, window_start;
```

Build keys as scope, dimension and an HMAC of the value (for example `login:acct:` plus the HMAC of the email), so the table holds no readable personal data. Delete rows older than the longest window from a scheduled job. Don't index `hits`, so increments can be HOT updates. An `UNLOGGED` table writes faster but is emptied after a crash; use it only for counters you can afford to lose.

### Cost

Postgres counters add one write per limited request plus vacuum work, with no new bill; that is cheap for auth and costly endpoints but adds up on a busy public API. Managed Redis services charge by command or by capacity, and some algorithms use several commands per check. Platform WAF limits depend on the plan (keys, window length, rule count) and may be usage-priced. The biggest savings come from the endpoints that spend money: put per-account daily quotas on AI, SMS, email and export endpoints, and set spending caps or billing alerts with those providers, as OWASP API4:2023 recommends.

## Common mistakes

- Counting in process memory (a `Map` or an LRU cache): each serverless instance keeps its own count, which resets on restart.
- Keying only by IP, so users behind one NAT block each other while attackers rotate IPs.
- Trusting the leftmost `X-Forwarded-For` value, which any client can set.
- Reading the count and then writing it in two statements, so concurrent requests slip past the limit.
- Limiting only in `proxy.ts`, leaving Server Actions and Route Handlers that the matcher skips unprotected.
- Returning 200 with an error body, or a 500, instead of 429 with `Retry-After`.
- Never deleting old counter rows, so the table and its indexes grow forever.
- Using a library's default timeout without knowing that it lets requests through when the store is down.
- Limiting OTP sends but not OTP verification, so short codes can be brute-forced.
- Caching a limited route publicly, so a CDN serves it without running the limiter.

## Notes for reviewers

Check these claims against the sources before setting `verified`:
- Vercel's `X-Forwarded-For` overwrite and `x-real-ip` behaviour, and Cloudflare's `CF-Connecting-IP` guidance.
- The status of the IETF RateLimit header fields (draft 11, 23 May 2026, expiring 24 November 2026).
- The IPv6 grouping advice (/64 minimum; RIPE-690 suggests ISPs assign a /56 or /48 per customer).
- Upstash Ratelimit's default timeout (5 seconds, request allowed) and the multi-region caveats.
- Vercel WAF and Cloudflare plan limits (keys, windows, rule counts, per-region or per-data-center counters), which change often.
- That `UNLOGGED` tables and HOT updates behave as described on common managed Postgres providers.
- The `postgresql` version entry uses the server name as its package (for `date_bin`, PostgreSQL 14+); confirm that convention for database versions.
- A `rate-limiter-flexible` version entry was dropped because its docs live on a GitHub wiki, which is not on the official-docs allowlist. Its Postgres store needs a scheduled `clearExpired` call in serverless; decide whether to mention that elsewhere.
