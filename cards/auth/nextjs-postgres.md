---
id: auth/nextjs-postgres
title: Authentication for a Next.js + Postgres app
topic: auth
stack: [nextjs, postgres, typescript]
summary: >-
  Use a maintained auth library with database sessions in Postgres, sent in an
  HttpOnly, Secure, SameSite=Lax cookie. Hash passwords with Argon2id, rate-limit
  login and reset, authorize in server code (not only in proxy/middleware), and
  ship email verification and password reset from day one.
status: draft
card_version: 0.1.0
last_verified: null
review_level: null
authors: [RIDAM7]
reviewers: []
lenses: [security, performance, ux, data, cost]
applies_when:
  app_types: [web-app, saas, dashboard]
  not_for: [static-site-without-accounts, mobile-only-api]
related: [rate-limiting/nextjs-postgres]

checklist:
  - id: hash-passwords
    lens: security
    level: must
    text: Hash passwords with Argon2id (OWASP minimum m=19 MiB, t=2, p=1); use bcrypt with cost 10 or more only if Argon2id is unavailable.
    why: A leaked database must not reveal passwords.
  - id: secure-session-cookie
    lens: security
    level: must
    text: Keep the session in an HttpOnly, Secure, SameSite=Lax cookie; never in localStorage.
    why: JavaScript (and any XSS) cannot read HttpOnly cookies.
  - id: rotate-and-revoke
    lens: security
    level: must
    text: Issue a new session id on login, and revoke sessions on logout and on password change.
    why: Prevents session fixation and stops stolen sessions after a reset.
  - id: authorize-server-side
    lens: security
    level: must
    text: Check the session and permissions in server code where data is read or changed (Server Components, Server Actions, Route Handlers), not only in proxy/middleware.
    why: A middleware-only check was bypassable in CVE-2025-29927.
  - id: rate-limit-auth
    lens: security
    level: must
    text: Rate-limit login, sign-up and password-reset requests per IP and per account.
    why: Stops credential stuffing, brute force and email bombing.
  - id: no-user-enumeration
    lens: security
    level: must
    text: Return the same message and similar timing for "wrong password" and "unknown email", on login and on reset.
  - id: password-reset-flow
    lens: ux
    level: must
    text: Ship forgot-password with random, single-use, short-lived reset tokens stored hashed; notify the user by email after the password changes.
  - id: email-verification
    lens: ux
    level: must
    text: Verify email addresses before sensitive actions (billing, invites, data export).
  - id: password-rules
    lens: security
    level: should
    text: Require a long minimum length, allow long passphrases, block known-breached passwords, and skip forced composition rules.
  - id: mfa-option
    lens: security
    level: should
    text: Offer MFA (TOTP or passkeys) to users and require it for admin accounts.
  - id: sign-out-everywhere
    lens: ux
    level: should
    text: Let users see active sessions and sign out of other devices.
  - id: pooled-connections
    lens: performance
    level: must
    text: Use a pooled Postgres connection string in serverless deployments and look up the session with one indexed query per request.
  - id: auth-audit-log
    lens: data
    level: should
    text: Log auth events (login, failed login, reset, password change) without storing passwords or tokens.

decisions:
  - id: social-login
    question: Do you need Google or GitHub sign-in at launch?
    options:
      - { id: needed, label: "Yes, social sign-in at launch" }
      - { id: email-only, label: "Email + password only for now" }
    default: email-only
  - id: sso-soon
    question: Will business customers need SSO (SAML/OIDC) in the next 6 months?
    options:
      - { id: needed, label: "Yes, SSO is needed soon", points_to: managed-provider }
      - { id: not-needed, label: "No, not in the next 6 months" }
    default: not-needed
  - id: mfa
    question: How should MFA work?
    options:
      - { id: optional-admin-required, label: "Optional for users, required for admins" }
      - { id: required-all, label: "Required for everyone" }
      - { id: later, label: "Not at launch" }
    default: optional-admin-required
  - id: expected-users
    question: How many monthly active users do you expect in year one?
    options:
      - { id: under-10k, label: "Under 10,000" }
      - { id: over-10k, label: "More than 10,000", points_to: library-db-sessions }
    default: under-10k
  - id: email-provider
    question: Which email service will send verification and reset emails?
    options:
      - { id: existing, label: "I already have one" }
      - { id: choose, label: "Help me choose" }
    default: choose

options:
  - id: library-db-sessions
    name: Open-source auth library + Postgres sessions
    examples: [Better Auth, Auth.js]
    best_fit_when:
      - You want to own user data in your own database
      - You want no per-user fees
      - Email/password and social sign-in cover your needs
    avoid_when:
      - You need enterprise SSO very soon and have no time to integrate it
    tradeoffs:
      - You run the reset/verification emails yourself
      - You must keep the library updated for security fixes
  - id: managed-provider
    name: Managed auth provider
    examples: [Clerk, Supabase Auth, Auth0, WorkOS]
    best_fit_when:
      - You want the fastest launch with MFA and SSO built in
      - A small team doesn't want to own auth security
    avoid_when:
      - Per-user pricing hurts at your expected scale
      - Strict data-residency rules apply
    tradeoffs:
      - Vendor lock-in; migrating users later is hard
      - Monthly cost grows with active users
  - id: custom-sessions
    name: Hand-rolled sessions table + cookie
    best_fit_when:
      - Learning, or very unusual requirements, with an experienced reviewer
    avoid_when:
      - Most production apps
    tradeoffs:
      - You own every security detail and every future fix
recommended: library-db-sessions

versions:
  - package: next
    range: ">=15.0.0 <16.0.0"
    notes:
      - "`cookies()` and `headers()` are async: await them."
      - "Optimistic route checks live in `middleware.ts`; still authorize in server code."
      - "Stay on a patched release (CVE-2025-29927 affected middleware authorization)."
    docs: https://nextjs.org/docs/app/guides/authentication
    context7: https://context7.com/vercel/next.js
  - package: next
    range: ">=16.0.0"
    notes:
      - "`middleware.ts` is deprecated and renamed to `proxy.ts` (export `proxy`); a codemod handles the rename."
      - "Proxy runs on the Node.js runtime; treat it as a first, optimistic check only."
      - "Authorize again where data is read or changed."
    docs: https://nextjs.org/docs/app/guides/authentication
    context7: https://context7.com/vercel/next.js

verify:
  - id: cookie-flags
    lens: security
    type: integration
    check: After login, the session cookie has HttpOnly, SameSite=Lax, and Secure in production.
  - id: same-error
    lens: security
    type: integration
    check: Login with an unknown email and login with a wrong password return the same status and message.
  - id: login-rate-limit
    lens: security
    type: integration
    check: Repeated failed logins for one account or IP are rejected (HTTP 429) after the configured limit.
  - id: reset-token-single-use
    lens: security
    type: integration
    check: A reset token works once, fails on a second use, and fails after it expires.
  - id: sessions-revoked
    lens: security
    type: integration
    check: Logout and password change invalidate existing sessions for that user.
  - id: server-side-authz
    lens: security
    type: integration
    check: A protected Server Action or Route Handler returns 401/redirect without a valid session even when proxy/middleware is skipped (call it directly in a test).
  - id: argon2id-hashes
    lens: security
    type: unit
    check: Stored password hashes use Argon2id (hash strings start with $argon2id$) or bcrypt with cost >= 10.
  - id: session-query-count
    lens: performance
    type: integration
    check: Rendering a protected page performs at most one session lookup query per request.

sources:
  - { title: OWASP Password Storage Cheat Sheet, url: "https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html" }
  - { title: OWASP Session Management Cheat Sheet, url: "https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html" }
  - { title: OWASP Forgot Password Cheat Sheet, url: "https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html" }
  - { title: OWASP Authentication Cheat Sheet, url: "https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html" }
  - { title: Next.js Authentication guide, url: "https://nextjs.org/docs/app/guides/authentication" }
  - { title: NIST SP 800-63B Digital Identity Guidelines, url: "https://pages.nist.gov/800-63-4/sp800-63b.html" }
---

## Why this approach

For most Next.js + Postgres apps, a maintained open-source auth library with database sessions gives you secure defaults, keeps user data in your own database, and costs nothing per user. Database sessions (instead of long-lived JWTs) can be revoked instantly on logout or a password change. Choose a managed provider instead when you need SSO or MFA immediately and would rather pay per user than own auth security. Avoid hand-rolled auth unless an experienced reviewer checks it.

## Lenses

### Security

Hash passwords with Argon2id, keep sessions in HttpOnly cookies, and rotate the session id on login. Treat proxy/middleware only as a fast first check, and authorize again next to the data, because a middleware-only check was bypassable (CVE-2025-29927). Rate-limit every auth endpoint, and give identical responses so attackers can't discover which emails exist. For data-changing Route Handlers that rely on cookies, keep SameSite=Lax and also check the `Origin` header. Server Actions include an origin check by default; confirm this in the docs for your version.

### Performance & latency

Look up the session once per request with a single indexed query, and reuse the result within the request instead of calling auth in every component. In serverless deployments, use the provider's pooled connection string so each function doesn't open new Postgres connections. Update a session's "last seen" time at most every few minutes, not on every request. Delete expired sessions with a scheduled job.

### UX flows

Cover the full journey from day one: sign up → verify email → log in → forgot password → reset → change password → sign out (and sign out of other devices). Keep error messages helpful but generic ("Email or password is incorrect"). After a reset, email the user that their password changed. If you offer MFA, give recovery codes at enrollment.

### Data model

Keep a `users` table with a unique, case-insensitive email (for example `citext`, or a unique index on `lower(email)`), `email_verified_at` and `password_hash`. Keep a `sessions` table (store a hash of the session token, plus `user_id`, `expires_at`, `created_at`, `last_seen_at`) with indexes on `user_id` and `expires_at`. Keep reset and verification tokens hashed with `expires_at` and `used_at`. If your auth library manages its own tables, keep its schema and check that these properties exist.

### Cost

An open-source library costs only your hosting and email sending. Managed providers usually have a free tier and then charge per monthly active user, so estimate the bill at 10,000 and 100,000 users before you choose. Email providers have free tiers that are enough for early-stage verification and reset emails.

## Common mistakes

- Storing tokens or sessions in `localStorage`.
- Protecting pages only in `middleware.ts`/`proxy.ts` and skipping checks in Server Actions and Route Handlers.
- Different messages for "unknown email" and "wrong password" (user enumeration).
- Reset tokens that never expire, can be reused, or are stored in plain text.
- Not revoking sessions after a password change.
- No rate limit on login or forgot-password.
- Opening a new database connection per request in serverless without pooling.
- Choosing an auth library without checking that it is still maintained (recent releases, active security fixes).
- Logging request bodies that contain passwords or tokens.

## Notes for reviewers

Check these claims against the sources before setting `verified`:
- The OWASP Argon2id minimum parameters (m=19 MiB, t=2, p=1) and the bcrypt cost guidance.
- NIST SP 800-63B (rev. 4) minimum password length when the password is the only factor versus with MFA. Then make `password-rules` specific.
- The Next.js 16 `proxy.ts` behaviour and the current state of the Server Actions origin check.
- The maintenance status of the libraries named in `options.examples`.
- That the docs and Context7 links resolve.
