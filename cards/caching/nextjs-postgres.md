---
id: caching/nextjs-postgres
title: Caching for a Next.js + Postgres app
topic: caching
stack: [nextjs, postgres, typescript]
summary: >-
  Cache shared, non-personal reads with use cache, cacheLife and cacheTag
  (Next.js 16 Cache Components). Check auth outside cached code, key on every
  input, invalidate tags where you write, never CDN-cache cookie responses, and
  fix slow SQL with indexes first.
status: verified
card_version: 1.0.1
last_verified: 2026-11-15
review_level: seed
authors: [RIDAM7]
reviewers: [RIDAM7]
lenses: [security, performance, ux, data, cost]
applies_when:
  app_types: [web-app, saas, dashboard, content-site, ecommerce]
  not_for: [pages-router-only-app, static-export-site]
related: [auth/nextjs-postgres, rate-limiting/nextjs-postgres]

checklist:
  - id: authorize-outside-cache
    lens: security
    level: must
    text: Check the session and permissions on every request outside the cached function, pass the verified user or tenant id in, and keep the cached helper unexported.
    why: A cache hit returns the stored result without running the function body, so a check inside it is skipped.
  - id: cache-key-complete
    lens: security
    level: must
    text: Pass every input the result depends on (user or tenant id, role, locale, filters) as an argument; never cache per-user or permission-dependent data under a shared key.
    why: Arguments and captured variables form the cache key; anything left out is shared between callers.
  - id: no-secrets-in-keys
    lens: security
    level: must
    text: Key and tag on stable ids; keep tokens, passwords and raw emails out of cached-function arguments and cacheTag values.
    why: Next.js stores cache keys and tags in plain text, including in remote cache handlers.
  - id: no-shared-cache-for-cookies
    lens: security
    level: must
    text: Send Cache-Control private, no-store on any response that sets a cookie or depends on the session; never public or s-maxage.
    why: Set-Cookie alone does not stop a shared cache from storing and reusing a response (RFC 9111, section 7.3).
  - id: protect-revalidation-endpoint
    lens: security
    level: must
    text: Authenticate Route Handlers that call revalidateTag or revalidatePath for webhooks (shared secret or signature) and accept only known tags.
    why: An open endpoint lets anyone flush the cache and push the load onto Postgres.
  - id: tag-and-invalidate-on-write
    lens: data
    level: must
    text: Tag cached reads with cacheTag (collection and entity tags) and invalidate those tags in every Server Action, Route Handler or job that writes, after the write commits.
  - id: read-your-own-writes
    lens: ux
    level: must
    text: After a user's own change, call updateTag in the Server Action (Next.js 16) so their next read waits for fresh data; use revalidateTag(tag, 'max') where brief staleness is fine.
  - id: explicit-cache-life
    lens: performance
    level: should
    text: Set an explicit cacheLife in every use cache scope, chosen from how stale that data may be.
    why: Without it the implicit default profile applies, and nested lifetimes become hard to reason about.
  - id: suspense-for-runtime-data
    lens: performance
    level: must
    text: Wrap components that read cookies, headers, searchParams or uncached data in Suspense with a fallback, and move those reads as deep in the tree as possible.
    why: With Cache Components, an uncached or runtime read outside Suspense is flagged as a blocking route.
  - id: multi-instance-invalidation
    lens: data
    level: must
    text: With more than one app instance, use a cache handler that shares tag state across instances, or document that other instances may be stale up to cacheLife.
    why: By default revalidateTag only invalidates the cache on the instance that received the call.
  - id: fix-query-before-caching
    lens: performance
    level: must
    text: Before caching a slow query, find it with pg_stat_statements, read its plan with EXPLAIN (ANALYZE, BUFFERS), and add the missing index.
  - id: materialized-view-aggregates
    lens: performance
    level: should
    text: Serve heavy shared aggregates from a materialized view with a unique index, refreshed CONCURRENTLY on a schedule or after batch writes.
    why: CONCURRENTLY refreshes without blocking reads but needs a unique index on plain columns.
  - id: pooled-connections
    lens: performance
    level: must
    text: Use a pooled Postgres connection so cache-miss bursts after a deploy or revalidation don't exhaust max_connections.
    why: Postgres runs one backend process per connection and max_connections is typically 100 by default.
  - id: cdn-headers-public-only
    lens: cost
    level: should
    text: Give only public, non-personalised GET Route Handlers Cache-Control public, s-maxage and stale-while-revalidate, and purge the CDN when on-demand revalidation must reach it.
    why: revalidateTag and revalidatePath clear the Next.js cache, not a CDN copy.

decisions:
  - id: caching-model
    question: Which Next.js caching model does the app use?
    options:
      - { id: cache-components, label: "Next.js 16 with cacheComponents enabled", points_to: framework-cache }
      - { id: previous-model, label: "Next.js 15, or 16 without cacheComponents" }
    default: cache-components
  - id: freshness
    question: How quickly must readers see a change after it is written?
    options:
      - { id: immediately, label: "Immediately (balances, stock, permissions): don't cache, or use updateTag" }
      - { id: within-minutes, label: "Within seconds to minutes", points_to: framework-cache }
      - { id: until-edited, label: "Hours, or until someone edits it (catalog, CMS, docs)", points_to: framework-cache }
    default: within-minutes
  - id: personalisation
    question: Are pages personalised per user or per permission?
    options:
      - { id: mostly-public, label: "Mostly the same for everyone" }
      - { id: mixed, label: "Public shell with per-user parts" }
      - { id: mostly-private, label: "Almost everything is per user (dashboards, accounts)" }
    default: mixed
  - id: instances-and-writers
    question: How many app instances or services read and write this data?
    options:
      - { id: single-instance, label: "One Next.js instance, and only it writes", points_to: framework-cache }
      - { id: many-instances, label: "Several Next.js instances or serverless functions", points_to: shared-external-cache }
      - { id: other-writers, label: "Other services or jobs also write to Postgres", points_to: shared-external-cache }
    default: single-instance
  - id: heavy-aggregates
    question: Do pages show expensive aggregates (counts, sums or reports over large tables)?
    options:
      - { id: heavy, label: "Yes, dashboards or reports over large tables", points_to: materialized-views }
      - { id: light, label: "No, mostly indexed lookups" }
    default: light

options:
  - id: framework-cache
    name: Next.js framework cache (Cache Components)
    best_fit_when:
      - Data is shared by many users and may be a little stale
      - One Next.js app owns the writes and can invalidate tags
      - You want cached parts in the prerendered static shell
    avoid_when:
      - Several services must share cached values outside Next.js
      - Entries must survive a deploy
    tradeoffs:
      - The default store is in-memory per instance, ephemeral on serverless, and resets on every deploy
      - Invalidation reaches other instances only through a shared cache handler
      - Cache keys and tags are stored in plain text
  - id: shared-external-cache
    name: Shared external cache (Redis-compatible)
    examples: [Redis, Valkey, Upstash Redis]
    best_fit_when:
      - Several app instances or services need the same cached values
      - A slow or rate-limited upstream must be protected under high traffic
      - "You self-host and need a shared store behind `use cache: remote` (cacheHandlers)"
    avoid_when:
      - One instance and the framework cache are enough
      - Keys are mostly unique per request or per user, so the hit rate is low
      - The query is already fast
    tradeoffs:
      - A network round trip on every lookup
      - Another service to run, secure, monitor and pay for
      - Every write path must delete or re-tag the affected keys
  - id: materialized-views
    name: Database-side materialized views
    best_fit_when:
      - Heavy aggregates are read often and change in batches
      - Several apps or services read the same summaries
      - Minutes to hours of staleness is acceptable
    avoid_when:
      - Data must be current on every read
      - Base tables change so often that refreshes would run back to back
    tradeoffs:
      - Each refresh recomputes the whole query
      - CONCURRENTLY needs a unique index and an already populated view
      - You schedule and monitor refreshes yourself
recommended: framework-cache

versions:
  - package: next
    range: ">=15.0.0 <16.0.0"
    notes:
      - "`use cache` is experimental only; cache Postgres queries with `unstable_cache(fn, keyParts, { tags, revalidate })` and dedupe per request with React `cache`."
      - "`fetch` and `GET` Route Handlers are not cached by default; opt in with `cache: 'force-cache'` or `export const dynamic = 'force-static'`."
      - "`revalidateTag(tag)` takes one argument and `updateTag` does not exist; call `revalidateTag` or `revalidatePath` in the Server Action that writes."
      - "Reading `cookies()` or `headers()` makes the whole route dynamic, and they can't be read inside `unstable_cache`: pass values as arguments."
    docs: https://nextjs.org/docs/15/app/getting-started/caching-and-revalidating
    context7: https://context7.com/vercel/next.js
  - package: next
    range: ">=16.0.0"
    notes:
      - "Enable `cacheComponents: true` (and set `partialPrefetching` explicitly from 16.3); data is dynamic by default and you opt in with `use cache`, `cacheLife` and `cacheTag`."
      - "`cookies()`, `headers()` and `searchParams` throw inside `use cache` and `use cache: remote`; read them outside and pass values in, or use `use cache: private` (browser only)."
      - "`revalidateTag(tag, profile)` needs a second argument (`'max'`, or `{ expire: 0 }` in webhooks); `updateTag(tag)` works only in Server Actions."
      - "Uncached or runtime reads outside `<Suspense>` are flagged as blocking routes; Cache Components needs the Node.js runtime (remove any `runtime` export)."
      - "By default `use cache` entries live in per-instance memory, and all entries reset on every deploy; `use cache: remote` needs a cache handler from your host or `cacheHandlers`."
    docs: https://nextjs.org/docs/app/getting-started/caching
    context7: https://context7.com/vercel/next.js

verify:
  - id: no-cross-user-leak
    lens: security
    type: integration
    check: Two users with different permissions load the same page and endpoint twice; each sees only their own data, including on the second, cached request.
  - id: cached-getter-requires-session
    lens: security
    type: integration
    check: Calling the exported data getter without a valid session redirects or returns 401 even when a cached entry exists for another user.
  - id: cookie-responses-private
    lens: security
    type: integration
    check: Every response that sets a cookie or reads the session has Cache-Control with private or no-store, and never public or s-maxage.
  - id: no-secrets-in-cache-keys
    lens: security
    type: scan
    check: No cached function takes a token, password or raw email as an argument, and no cacheTag value contains one.
  - id: revalidation-endpoint-auth
    lens: security
    type: integration
    check: The revalidation Route Handler returns 401 without a valid secret or signature and ignores unknown tags.
  - id: read-your-writes
    lens: ux
    type: e2e
    check: After a user saves a change through a Server Action, the next page view shows the new value without a reload or waiting for cacheLife to pass.
  - id: tag-invalidation-on-write
    lens: data
    type: integration
    check: Writing a row invalidates every cached read tagged for it; list and detail views return the new data on the next request.
  - id: multi-instance-consistency
    lens: data
    type: integration
    check: With two app instances, a write handled by one instance is visible on the other within the documented freshness window.
  - id: matview-refresh-non-blocking
    lens: data
    type: integration
    check: The materialized view has a unique index, and REFRESH MATERIALIZED VIEW CONCURRENTLY completes while concurrent reads keep returning rows.
  - id: hot-queries-indexed
    lens: performance
    type: manual
    check: The top queries in pg_stat_statements use index scans or have a recorded reason not to, and each cached query has an EXPLAIN ANALYZE plan on record.

sources:
  - { title: Next.js Caching (Cache Components), url: "https://nextjs.org/docs/app/getting-started/caching" }
  - { title: Next.js Revalidating, url: "https://nextjs.org/docs/app/getting-started/revalidating" }
  - { title: Next.js use cache directive, url: "https://nextjs.org/docs/app/api-reference/directives/use-cache" }
  - { title: "Next.js use cache: private directive", url: "https://nextjs.org/docs/app/api-reference/directives/use-cache-private" }
  - { title: "Next.js use cache: remote directive", url: "https://nextjs.org/docs/app/api-reference/directives/use-cache-remote" }
  - { title: Next.js updateTag, url: "https://nextjs.org/docs/app/api-reference/functions/updateTag" }
  - { title: Next.js revalidateTag, url: "https://nextjs.org/docs/app/api-reference/functions/revalidateTag" }
  - { title: Next.js Authentication with Cache Components, url: "https://nextjs.org/docs/app/guides/authentication-with-cache-components" }
  - { title: Next.js How revalidation works, url: "https://nextjs.org/docs/app/guides/how-revalidation-works" }
  - { title: Next.js CDN Caching, url: "https://nextjs.org/docs/app/guides/cdn-caching" }
  - { title: Next.js Backend for Frontend guide, url: "https://nextjs.org/docs/app/guides/backend-for-frontend" }
  - { title: Next.js Self-hosting guide, url: "https://nextjs.org/docs/app/guides/self-hosting" }
  - { title: Next.js Caching and Revalidating (Previous Model), url: "https://nextjs.org/docs/app/guides/caching-without-cache-components" }
  - { title: Next.js 15 Caching and Revalidating, url: "https://nextjs.org/docs/15/app/getting-started/caching-and-revalidating" }
  - { title: Next.js Version 16 upgrade guide, url: "https://nextjs.org/docs/app/guides/upgrading/version-16" }
  - { title: PostgreSQL Using EXPLAIN, url: "https://www.postgresql.org/docs/current/using-explain.html" }
  - { title: PostgreSQL pg_stat_statements, url: "https://www.postgresql.org/docs/current/pgstatstatements.html" }
  - { title: PostgreSQL Materialized Views, url: "https://www.postgresql.org/docs/current/rules-materializedviews.html" }
  - { title: PostgreSQL REFRESH MATERIALIZED VIEW, url: "https://www.postgresql.org/docs/current/sql-refreshmaterializedview.html" }
  - { title: PostgreSQL Connection settings (max_connections), url: "https://www.postgresql.org/docs/current/runtime-config-connection.html" }
  - { title: PostgreSQL How Connections Are Established, url: "https://www.postgresql.org/docs/current/connect-estab.html" }
  - { title: "RFC 9111: HTTP Caching", url: "https://www.rfc-editor.org/rfc/rfc9111.html" }
  - { title: MDN Cache-Control header, url: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cache-Control" }
  - { title: OWASP Session Management Cheat Sheet, url: "https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html" }
---

## Why this approach

With Next.js 16 Cache Components, data is dynamic by default and you opt in per function with `use cache`, so the framework cache is the cheapest correct default: no extra service, tag-based invalidation, and cached parts join the prerendered shell. Cache only data that is the same for everyone who can see it, or key it on a verified user id, and invalidate its tags in the code that writes. Add a shared Redis-compatible cache (through `use cache: remote` or your data layer) when several instances or services must share entries and the hit rate is high. Use Postgres materialized views for heavy aggregates that many readers share, and fix slow queries with indexes before caching anything.

## Lenses

### Security

The main risk is serving one user's data to another. A `use cache` or `use cache: remote` entry is shared by every caller that passes the same arguments, so check the session and permissions outside the cached function on every request, pass in the verified user or tenant id, and keep the cached helper unexported so no caller can pass someone else's id. A check inside a cached function is skipped on a cache hit. `use cache: private` keeps results in the browser only, never in a server cache. Next.js stores cache keys and tags in plain text, so key on stable ids, never on tokens or emails. Responses that set cookies or read the session must send `Cache-Control: private, no-store`, because `Set-Cookie` alone does not stop a shared cache from storing them (RFC 9111, section 7.3). Authenticate revalidation webhooks: an open endpoint lets anyone flush the cache.

### Performance & latency

Measure first: find hot queries with `pg_stat_statements`, read their plans with `EXPLAIN (ANALYZE, BUFFERS)`, and add the index that removes the sequential scan. Cache what stays slow or is read far more often than it changes. Set an explicit `cacheLife` in every `use cache` scope; an `expire` under 5 minutes or `revalidate: 0` drops the entry out of the static shell and runs it at request time. Keep cookie, header, `searchParams` and uncached reads inside `<Suspense>` and deep in the tree so the rest of the page prerenders. The default `use cache` store is per-instance memory, ephemeral on serverless. `use cache: remote` adds a network round trip, so use it only for high-hit-rate data whose source is slow (the docs suggest little gain under 50 ms). Use a pooled connection so miss bursts after a deploy or revalidation don't exhaust `max_connections`.

### UX flows

A user who saves something must see it on the next view. In the Server Action, write to Postgres, then call `updateTag` for the affected tags (Next.js 16): the next read waits for fresh data instead of serving the stale entry. Use `revalidateTag(tag, 'max')` for changes other people may see a little later, such as a catalog edit. Route Handlers and webhooks can't call `updateTag`; use `revalidateTag(tag, { expire: 0 })` there when the change must show at once. Give each Suspense fallback the shape of the final content to avoid layout shift. Where staleness could mislead (stock, balances, permissions), don't cache the value, or show when it was last updated.

### Data model

Name tags after data, not pages: a collection tag (`posts`), an entity tag (`post:42`), and a per-user tag (`notes:<userId>`) for per-user entries. Every write path invalidates the same tags after its transaction commits. If a cron job or another service writes to Postgres directly, it calls a protected revalidation endpoint, or you accept staleness up to `cacheLife`. Materialized views need a unique index on plain columns to refresh `CONCURRENTLY` without blocking reads.

```ts
import { cacheLife, cacheTag } from 'next/cache'
// The session is checked on every call, outside the cache.
export async function getNotes() {
  const user = await requireUser() // reads cookies, redirects if signed out
  return notesFor(user.id)
}

async function notesFor(userId: string) {
  'use cache'
  cacheTag(`notes:${userId}`)
  cacheLife('minutes')
  return db.select().from(notes).where(eq(notes.userId, userId))
}
// In the Server Action, after the insert commits: updateTag(`notes:${userId}`)
```

### Cost

The framework cache costs nothing extra, but it starts empty after every deploy because the cache key includes the build id, so the first requests after a deploy hit Postgres. `use cache: remote` and Redis-compatible services add storage, network and usually platform fees; with per-user or highly unique keys the hit rate stays low and you pay for little benefit. A CDN in front of public `GET` Route Handlers with `s-maxage` and `stale-while-revalidate` serves repeat requests without invoking your server, but it does not see `revalidateTag`, so purge it through the CDN's API when on-demand freshness matters. A materialized view refresh recomputes the whole query, so schedule refreshes by how stale the data may be, not as often as possible.

## Common mistakes

- Checking the session inside a `use cache` function, so a cache hit skips the check.
- Caching per-user or role-dependent data without the user, tenant or role in the arguments.
- Reading `cookies()` or `headers()` inside `use cache` (it throws) instead of passing the values in.
- Marking responses that set cookies or show account data `public` or `s-maxage` for a CDN.
- Writing to Postgres without invalidating the tags that cache that data, or invalidating before the transaction commits.
- Calling `revalidateTag(tag)` with one argument on Next.js 16 (deprecated), or `updateTag` in a Route Handler (it throws).
- Expecting `revalidateTag` on one instance to clear the other instances or the CDN.
- Caching a slow query instead of adding the missing index.
- Using `use cache: remote` for keys that are unique per request, so the hit rate is near zero.
- Omitting `cacheLife` and relying on the implicit `default` profile.
