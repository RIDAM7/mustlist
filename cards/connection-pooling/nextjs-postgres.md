---
id: connection-pooling/nextjs-postgres
title: Connection pooling for a Next.js + Postgres app
topic: connection-pooling
stack: [nextjs, postgres, typescript]
summary: >-
  Create one small pool per instance at module scope, point serverless code at a
  transaction-mode pooler (provider endpoint or PgBouncer), keep a direct URL for
  migrations and session features, keep session state off the pooler, and verify
  TLS certificates.
status: verified
card_version: 1.0.0
last_verified: 2026-11-15
review_level: seed
authors: [RIDAM7]
reviewers: [RIDAM7]
lenses: [security, performance, data, cost]
applies_when:
  app_types: [web-app, saas, api, dashboard, e-commerce]
  not_for: [static-export-site, browser-only-app-using-a-hosted-data-api]
related: [caching/nextjs-postgres, background-jobs/nextjs-postgres, payments-webhooks/nextjs-postgres]

checklist:
  - id: module-scope-pool
    lens: performance
    level: must
    text: Create one pool or ORM client per server instance, at module scope in a server-only module; never construct `Pool`, `postgres()` or `PrismaClient` inside a handler, Server Action or component.
    why: A pool built per request opens fresh connections on every call and leaves them open until they time out.
  - id: dev-global-singleton
    lens: performance
    level: must
    text: In development, store the pool or client on `globalThis` and reuse it, so `next dev` hot reloads don't open a new pool on every edit.
    why: Next.js reloads modules on change; Prisma documents this creating many client instances, each with its own pool.
  - id: connection-budget
    lens: performance
    level: must
    text: "Write down a connection budget: peak instances × per-instance max, plus workers, cron and migrations, must stay below max_connections minus reserved slots, or within the pooler's limits."
    why: Postgres runs one process per connection; max_connections is typically 100 and 3 slots are reserved for superusers by default.
  - id: pooler-for-serverless
    lens: performance
    level: must
    text: On serverless or autoscaling hosts, give the runtime a transaction-mode pooler URL (provider pooled endpoint, RDS Proxy or PgBouncer), not the database's direct endpoint.
    why: Instance count follows traffic, so per-instance pools multiply; a transaction pooler caps server connections.
  - id: direct-url-for-migrations
    lens: data
    level: must
    text: Run migrations, schema pushes, pg_dump and LISTEN over a separate direct (unpooled) URL; use the pooled URL only for request handling.
    why: Prisma documents Migrate failing through PgBouncer, and Neon says to use direct connections for migrations and pg_dump.
  - id: no-session-state-pooled
    lens: data
    level: must
    text: "Through a transaction pooler keep no session state: use SET LOCAL or role settings instead of SET, pg_advisory_xact_lock instead of session locks, and no LISTEN, WITH HOLD cursors or SQL PREPARE."
    why: PgBouncer lists these as never supported in transaction mode; the next transaction may run on another server connection.
  - id: prepared-statements-per-pooler
    lens: performance
    level: must
    text: "Match prepared statements to the pooler: PgBouncer 1.21+ with max_prepared_statements above 0 supports them; otherwise (for example Supabase's shared pooler) set postgres.js `prepare: false`."
    why: max_prepared_statements defaults to 200 since PgBouncer 1.24; Supabase's shared pooler has no prepared statements in transaction mode.
  - id: one-client-per-transaction
    lens: data
    level: must
    text: Run each transaction on one checked-out client (pg `pool.connect()` or the ORM's transaction API) and release it in `finally`; never send BEGIN and COMMIT through `pool.query`.
    why: node-postgres may send each pool.query call to a different client, splitting the transaction.
  - id: fail-fast-acquire
    lens: performance
    level: must
    text: Set an acquire timeout of a few seconds (pg `connectionTimeoutMillis`, postgres.js 4 `queue_timeout`) and return 503 when the pool is exhausted instead of waiting until the function times out.
    why: Both default to 0, which waits forever, and Prisma 7 inherits the pg default through its adapter.
  - id: fluid-attach-pool
    lens: performance
    level: must
    text: "On Vercel Fluid compute, call `attachDatabasePool(pool)` right after creating a pg pool, use a short `idleTimeoutMillis` (Vercel's example is 5 seconds), and never set `max: 1`."
    why: Idle timers don't run while an instance is suspended; Vercel says max 1 doesn't reduce connections and harms concurrency.
  - id: tls-verify-full
    lens: security
    level: must
    text: "Require TLS with certificate and host checks: `sslmode=verify-full` (pg) or `ssl: 'verify-full'` (postgres.js 4), with the provider's CA if it isn't public; never `rejectUnauthorized: false`."
    why: libpq's require mode encrypts but doesn't stop man-in-the-middle attacks, and pg 9 will switch require to libpq semantics.
  - id: split-db-roles
    lens: security
    level: should
    text: Connect the app with a role that has only the data rights it needs (no DDL) and run migrations with a separate owner role on the direct URL; keep both URLs in server-only variables.
    why: A leaked or injected app connection then can't alter or drop tables.
  - id: role-level-timeouts
    lens: performance
    level: should
    text: Set statement_timeout and idle_in_transaction_session_timeout on the app role with ALTER ROLE ... SET, so a stuck request can't hold a pooled server connection indefinitely.
    why: Role defaults apply whenever the role starts a session, so they survive transaction pooling, unlike a session-level SET.
  - id: pooler-before-upsizing
    lens: cost
    level: should
    text: Fix pooling before buying a larger database tier only to raise max_connections; idle connections from serverless instances hold memory without doing work.
    why: Postgres starts one backend process per connection, and providers such as Neon tie max_connections to compute size.
  - id: monitor-connections
    lens: performance
    level: should
    text: Alert on connection count versus max_connections, pool wait time, pooler client waits and, on RDS Proxy, DatabaseConnectionsCurrentlySessionPinned.
    why: RDS Proxy pins sessions on SET, temporary tables and advisory locks, which quietly stops connection reuse.

decisions:
  - id: hosting
    question: Where will the Next.js server code run?
    options:
      - { id: vercel-fluid, label: "Vercel Functions on Fluid compute (default for new projects since April 2025)", points_to: managed-pooler }
      - { id: other-serverless, label: "Other serverless functions (AWS Lambda, Netlify, Vercel without Fluid)", points_to: managed-pooler }
      - { id: long-running, label: "A fixed number of long-running servers or containers", points_to: direct-small-pool }
      - { id: edge-workers, label: "An edge or Workers runtime where a pool can't outlive a request", points_to: http-driver }
  - id: postgres-host
    question: Who runs your Postgres?
    options:
      - { id: provider-pooler, label: "A provider with a built-in pooler (for example Neon, Supabase, Amazon RDS with RDS Proxy)", points_to: managed-pooler }
      - { id: self-managed, label: "Self-managed Postgres, or a provider without a pooler", points_to: self-run-pgbouncer }
  - id: session-features
    question: Does any code need session state (LISTEN/NOTIFY, session advisory locks, SET, temporary tables, WITH HOLD cursors)?
    options:
      - { id: session-needed, label: "Yes, for example a LISTEN-based worker or session advisory locks", points_to: direct-small-pool }
      - { id: stateless, label: "No, only queries and transactions" }
    default: stateless
  - id: driver
    question: Which driver or ORM talks to Postgres?
    options:
      - { id: node-postgres, label: "pg (node-postgres), directly or through Drizzle" }
      - { id: postgres-js, label: "postgres.js, directly or through Drizzle" }
      - { id: prisma, label: "Prisma ORM" }
      - { id: neon-driver, label: "Neon serverless driver", points_to: http-driver }
  - id: peak-connections
    question: At peak, could instances × pool size exceed the database's max_connections?
    options:
      - { id: may-exceed, label: "Yes, or I can't bound the number of instances", points_to: managed-pooler }
      - { id: well-below, label: "No, instance count is fixed and the total stays well below the limit", points_to: direct-small-pool }
    default: may-exceed
  - id: cold-starts
    question: Do most requests land on cold, short-lived instances (low or very spiky traffic)?
    options:
      - { id: mostly-cold, label: "Yes, most requests start a new instance", points_to: http-driver }
      - { id: mostly-warm, label: "No, instances stay warm and are reused" }
    default: mostly-warm

options:
  - id: managed-pooler
    name: Small app pool behind a provider's transaction-mode pooler
    examples: [Neon pooled endpoint, Supabase Supavisor, Supabase dedicated pooler, Amazon RDS Proxy]
    best_fit_when:
      - The app runs on serverless or autoscaling hosts whose instance count you don't control
      - Your Postgres provider offers a pooled endpoint or proxy
    avoid_when:
      - A component needs session state on one connection (give that part the direct URL)
      - The pooler runs in a different region from your functions
    tradeoffs:
      - No session state across transactions in transaction mode
      - Prepared statement support depends on the pooler and its settings
      - Two connection strings to manage (pooled and direct)
  - id: self-run-pgbouncer
    name: Self-run PgBouncer in transaction mode
    examples: [PgBouncer]
    best_fit_when:
      - You host Postgres yourself or your provider has no pooler
      - You need control over pool sizes, timeouts and prepared statement limits
    avoid_when:
      - Nobody can patch and monitor another network service
    tradeoffs:
      - You run, scale and patch it; 1.25.1 to 1.26.1 all shipped security fixes
      - "Defaults are low for serverless: max_client_conn 100, default_pool_size 20"
      - A single instance is a single point of failure
  - id: http-driver
    name: HTTP or WebSocket serverless driver
    examples: [Neon serverless driver]
    best_fit_when:
      - Edge or Workers runtimes where a TCP pool can't outlive a request
      - Classic serverless with many cold starts and mostly one-shot queries
    avoid_when:
      - You need interactive transactions over HTTP
      - Vercel Fluid compute, where Neon recommends pg over TCP with a pool
      - Your database provider has no such driver
    tradeoffs:
      - Provider-specific API and lock-in
      - WebSocket Pool or Client must be created and closed inside each request on edge runtimes
  - id: direct-small-pool
    name: Direct connections with one small pool per long-running server
    best_fit_when:
      - A fixed number of Node.js servers or containers runs the app
      - Workers need LISTEN/NOTIFY or session advisory locks
    avoid_when:
      - Serverless or autoscaling hosts where instance count follows traffic
    tradeoffs:
      - The budget must be recomputed whenever replicas are added
      - Rolling deploys briefly run old and new instances side by side
recommended: managed-pooler

versions:
  - package: pg
    range: ">=8.0.0 <9.0.0"
    notes:
      - "Pool defaults: `max` 10, `idleTimeoutMillis` 10000, `connectionTimeoutMillis` 0 (waits forever); set an acquire timeout so a full pool fails fast."
      - "Run a transaction on one client from `pool.connect()` and release it in `finally`; never send BEGIN or COMMIT through `pool.query`."
      - "8.x treats `sslmode=require` as `verify-full` with a warning, and pg 9 will switch to libpq semantics: write `sslmode=verify-full`."
    docs: https://node-postgres.com/apis/pool
  - package: postgres
    range: ">=3.0.0 <4.0.0"
    notes:
      - "Pass `prepare: false` through a transaction pooler without prepared statement support (PgBouncer before 1.21, Supabase's shared pooler)."
      - "`idle_timeout` defaults to 0, so connections stay open until `sql.end()`; set it in serverless."
    docs: https://github.com/porsager/postgres
  - package: postgres
    range: ">=4.0.0 <5.0.0"
    notes:
      - "`ssl: 'require'` encrypts without checking the certificate; use `ssl: 'verify-full'`."
      - "Set `idle_timeout` and the new `queue_timeout` (both default 0). Keep `prepare` on unless the pooler lacks prepared statements."
      - "The server now infers parameter types, which changes how a `Date` is written outside UTC; `infer: true` restores v3 behaviour."
    docs: https://github.com/porsager/postgres
  - package: "@prisma/client"
    range: ">=6.0.0 <7.0.0"
    notes:
      - "Pool size is `connection_limit` in the URL; on serverless without a pooler, start at 1. Prisma Migrate uses `directUrl`."
      - "Add `pgbouncer=true` only for PgBouncer before 1.21.0 or a pooler with similar limits."
    docs: https://www.prisma.io/docs/orm/v6/prisma-client/setup-and-configuration/databases-connections
  - package: "@prisma/client"
    range: ">=7.0.0 <8.0.0"
    notes:
      - "Pooling comes from the driver adapter: pass a configured pg Pool to `new PrismaPg(pool)`; `connection_limit` no longer applies."
      - "The CLI reads `datasource.url` from Prisma Config, so set it to the direct URL. Install `prisma@7`: npm `latest` is an 8.x release candidate."
    docs: https://www.prisma.io/docs/orm/v7/prisma-client/setup-and-configuration/databases-connections/connection-pool
  - package: "@vercel/functions"
    range: ">=3.0.0 <4.0.0"
    notes:
      - "Call `attachDatabasePool(pool)` once, after creating a pg pool at module scope; a postgres.js client throws 'Unsupported database pool type'."
      - "After each release it keeps the instance alive for `idleTimeoutMillis` (10 s if unset) plus 100 ms; Vercel's guide uses 5 s."
    docs: https://vercel.com/docs/functions/functions-api-reference/vercel-functions-package
  - package: "@neondatabase/serverless"
    range: ">=1.0.0 <2.0.0"
    notes:
      - "`neon()` over HTTP is a tagged template with only non-interactive `sql.transaction([...])`; interactive transactions need `Pool` or `Client`, created and closed within one request on edge runtimes."
      - "On Vercel Fluid compute, Neon recommends pg over TCP with a pool instead of this driver."
    docs: https://neon.com/docs/serverless/serverless-driver
  - package: drizzle-orm
    range: ">=0.35.0 <1.0.0"
    notes:
      - "Pass your own module-scope pool, `drizzle({ client: pool })`, to control limits and `attachDatabasePool`; point drizzle-kit's `dbCredentials.url` at the direct URL."
      - "`drizzle-orm/neon-http` has no `db.transaction()`; use `neon-serverless` or a TCP driver for transactions."
    docs: https://orm.drizzle.team/docs/get-started-postgresql

verify:
  - id: one-pool-per-instance
    lens: performance
    type: integration
    check: Sending 50 concurrent requests to one warm instance raises the app role's connections in pg_stat_activity by no more than the pool's max.
  - id: peak-load-budget
    lens: performance
    type: e2e
    check: A load test at expected peak, with scale-out and a deploy during the test, keeps total connections below max_connections minus reserved slots and logs no connection-limit errors.
  - id: acquire-timeout
    lens: performance
    type: integration
    check: With every pool client checked out, the next request fails within the acquire timeout with a 503 instead of hanging until the platform's function timeout.
  - id: release-on-error
    lens: data
    type: integration
    check: A handler that throws mid-transaction rolls back and returns its client; the pool's idle count returns to baseline and no session stays idle in transaction.
  - id: pooled-prepared-statements
    lens: performance
    type: integration
    check: Through the production pooler, the same parameterized query run 1,000 times from concurrent instances never fails with a prepared statement "already exists" or "does not exist" error.
  - id: no-session-state-pooled
    lens: data
    type: scan
    check: Code that uses the pooled URL contains no session-level SET, LISTEN, pg_advisory_lock, WITH HOLD cursor or SQL PREPARE; code that needs them uses the direct URL.
  - id: migrations-direct
    lens: data
    type: integration
    check: The migration command reads the direct URL and succeeds while the app serves traffic through the pooler.
  - id: tls-verified
    lens: security
    type: integration
    check: Connecting with a wrong host name or an untrusted certificate fails, and pg_stat_ssl shows ssl true for the app's connections.
  - id: app-role-no-ddl
    lens: security
    type: integration
    check: The runtime role gets a permission error for CREATE, ALTER and DROP, while the migration role on the direct URL succeeds.

sources:
  - { title: "PostgreSQL: Connection settings (max_connections, reserved slots)", url: "https://www.postgresql.org/docs/current/runtime-config-connection.html" }
  - { title: "PostgreSQL: How connections are established", url: "https://www.postgresql.org/docs/current/connect-estab.html" }
  - { title: "PostgreSQL: Client connection defaults (statement_timeout, idle_in_transaction_session_timeout)", url: "https://www.postgresql.org/docs/current/runtime-config-client.html" }
  - { title: "PostgreSQL: ALTER ROLE", url: "https://www.postgresql.org/docs/current/sql-alterrole.html" }
  - { title: "PostgreSQL: SET (SET LOCAL)", url: "https://www.postgresql.org/docs/current/sql-set.html" }
  - { title: "PostgreSQL: Explicit locking (advisory locks)", url: "https://www.postgresql.org/docs/current/explicit-locking.html" }
  - { title: "PostgreSQL: libpq SSL support (sslmode)", url: "https://www.postgresql.org/docs/current/libpq-ssl.html" }
  - { title: "PgBouncer: Features (session vs transaction pooling)", url: "https://www.pgbouncer.org/features.html" }
  - { title: "PgBouncer: Configuration (max_prepared_statements, pool sizes)", url: "https://www.pgbouncer.org/config.html" }
  - { title: "PgBouncer: Changelog", url: "https://www.pgbouncer.org/changelog.html" }
  - { title: "node-postgres: Pool API", url: "https://node-postgres.com/apis/pool" }
  - { title: "node-postgres: SSL", url: "https://node-postgres.com/features/ssl" }
  - { title: "node-postgres: Queries (prepared statements)", url: "https://node-postgres.com/features/queries" }
  - { title: "pg-connection-string: sslmode handling (source)", url: "https://github.com/brianc/node-postgres/blob/master/packages/pg-connection-string/index.js" }
  - { title: "Postgres.js README (options, prepared statements, connection poolers)", url: "https://github.com/porsager/postgres" }
  - { title: "Vercel: @vercel/functions API reference (attachDatabasePool)", url: "https://vercel.com/docs/functions/functions-api-reference/vercel-functions-package" }
  - { title: "Vercel: Efficiently manage database connection pools with Fluid compute", url: "https://vercel.com/kb/guide/efficiently-manage-database-connection-pools-with-fluid-compute" }
  - { title: "Vercel: Fluid compute", url: "https://vercel.com/docs/fluid-compute" }
  - { title: "Vercel: Configuring regions for Vercel Functions", url: "https://vercel.com/docs/functions/configuring-functions/region" }
  - { title: "attachDatabasePool source (vercel/vercel)", url: "https://github.com/vercel/vercel/blob/main/packages/functions/src/db-connections/index.ts" }
  - { title: "Prisma ORM v7: Connection pool", url: "https://www.prisma.io/docs/orm/v7/prisma-client/setup-and-configuration/databases-connections/connection-pool" }
  - { title: "Prisma ORM v7: Configure Prisma Client with PgBouncer", url: "https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/databases-connections/pgbouncer" }
  - { title: "Prisma ORM v7: Deploy to Vercel", url: "https://www.prisma.io/docs/orm/v7/prisma-client/deployment/serverless/deploy-to-vercel" }
  - { title: "Prisma ORM: Upgrade to v7", url: "https://www.prisma.io/docs/orm/v6/more/upgrades/to-v7" }
  - { title: "Prisma ORM: Next.js development practices (hot reload)", url: "https://www.prisma.io/docs/orm/more/help-and-troubleshooting/help-articles/nextjs-prisma-client-dev-practices" }
  - { title: "Prisma ORM v6: Database connections (serverless)", url: "https://www.prisma.io/docs/orm/v6/prisma-client/setup-and-configuration/databases-connections" }
  - { title: "Neon: Connection pooling", url: "https://neon.com/docs/connect/connection-pooling" }
  - { title: "Neon: Choosing a connection method", url: "https://neon.com/docs/connect/choose-connection" }
  - { title: "Neon: Connecting from Vercel", url: "https://neon.com/docs/guides/vercel-connection-methods" }
  - { title: "Neon serverless driver", url: "https://neon.com/docs/serverless/serverless-driver" }
  - { title: "Supabase: Connect to your database", url: "https://supabase.com/docs/guides/database/connecting-to-postgres" }
  - { title: "Amazon RDS Proxy: Avoiding pinning", url: "https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/rds-proxy-pinning.html" }
  - { title: "Drizzle: Connect to Supabase", url: "https://orm.drizzle.team/docs/connect-supabase" }
  - { title: "Drizzle: Connect to Neon", url: "https://orm.drizzle.team/docs/connect-neon" }
  - { title: "Next.js: Data security guide", url: "https://nextjs.org/docs/app/guides/data-security" }
  - { title: "Next.js: runtime route segment config", url: "https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config/runtime" }
  - { title: "Next.js: Environment variables", url: "https://nextjs.org/docs/app/guides/environment-variables" }
---

## Why this approach

Serverless hosts start as many instances as traffic needs and each instance holds its own pool, so connections grow with instances, not with anything you configure; Postgres runs one backend process per connection and `max_connections` is typically 100. A transaction-mode pooler run by your provider multiplexes many client connections onto a small, fixed set of server connections, so a traffic spike or deploy can't exhaust the database. Keep one small pool per instance at module scope (with `attachDatabasePool` on Vercel Fluid) pointed at that pooler, and a direct URL for migrations and session features. Run PgBouncer yourself when you host Postgres, use a direct small pool when a fixed set of long-running servers fits the budget, and use an HTTP driver for edge runtimes or cold-start-heavy classic serverless.

## Lenses

### Security

Require TLS that checks the certificate and host name: libpq's `require` encrypts but doesn't stop a man-in-the-middle, so write `verify-full` and supply the provider's CA when it isn't publicly trusted. Never ship `rejectUnauthorized: false`. Keep the pooled and direct URLs in unprefixed server-side variables (Next.js inlines `NEXT_PUBLIC_` values into browser bundles), import the database module only from server code, and keep it on the Node.js runtime (Edge is deprecated in Next.js 16). Give the runtime a role without DDL rights; only the migration step uses the owner role on the direct URL. If you run PgBouncer, keep it off the public internet and patch it: 1.25.1 fixed a startup-packet `search_path` flaw allowing unauthenticated SQL when `track_extra_parameters` included it.

### Performance & latency

```ts
import 'server-only'
import { Pool } from 'pg'
import { attachDatabasePool } from '@vercel/functions'

function createPool() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL, // pooled, transaction-mode URL
    max: 10, idleTimeoutMillis: 5_000, connectionTimeoutMillis: 5_000,
  })
  attachDatabasePool(pool) // Fluid: close idle clients before suspension
  return pool
}
const globalForDb = globalThis as unknown as { pool?: Pool }
export const pool = globalForDb.pool ?? createPool()
if (process.env.NODE_ENV !== 'production') globalForDb.pool = pool
```

Do the arithmetic before launch: 20 instances × `max` 10 is 200 connections, double a default `max_connections` of 100. Fluid compute runs many requests per instance, so a pool max above 1 helps; classic one-request-per-instance serverless without a pooler should start near 1. Neon estimates about 8 round trips to open a TCP connection versus about 3 for its HTTP driver, so the HTTP driver can win when most requests are cold; a warm pool wins otherwise. Run functions in the database's region; Vercel defaults new projects to `iad1`.

### Data model

In transaction mode a client owns a server connection only for one transaction. Replace `SET` with `SET LOCAL` inside the transaction, or with role defaults:

```sql
ALTER ROLE app_runtime SET statement_timeout = '15s';
ALTER ROLE app_runtime SET idle_in_transaction_session_timeout = '30s';
```

Keep both timeouts shorter than your function's maximum duration. Use `pg_advisory_xact_lock` instead of `pg_advisory_lock`, and run `LISTEN` workers on the direct URL. Protocol-level prepared statements work on PgBouncer 1.21+ when `max_prepared_statements` is above 0 (200 by default since 1.24; Neon uses 1,000); SQL `PREPARE` never does. Run every migration tool over the direct URL.

### Cost

Every open connection is a Postgres process holding memory, and some providers tie `max_connections` to compute size (Neon: 450 on 1 CU), so pooling is cheaper than upsizing for connection slots. On Vercel Fluid, a long `idleTimeoutMillis` keeps instances alive longer, so keep it short. Shift traffic gradually between deployments (Vercel suggests rolling releases) so a new deployment doesn't open a full set of connections at once. A self-run PgBouncer is another service to host and patch.

## Common mistakes

- Constructing a pool or ORM client inside a route handler, Server Action or component, or skipping the `globalThis` cache in development.
- Pointing serverless code at the direct endpoint with the driver's default pool size.
- Running migrations, `pg_dump` or `LISTEN` through the transaction pooler.
- Relying on `SET`, session advisory locks or SQL `PREPARE` through a transaction pooler.
- Setting `max: 1` on Fluid compute, or leaving the acquire timeout at 0.
- Trusting `sslmode=require` or `rejectUnauthorized: false` to protect against interception.
