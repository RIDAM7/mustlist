# Card format (v1)

A **card** covers one feature built on one stack, for example _authentication_ on _Next.js + Postgres_. Cards are the only thing agents read. `pnpm validate` enforces everything on this page; the zod schema in [`packages/schema`](../packages/schema/src/frontmatter.ts) is the source of truth.

For a complete example, see [`cards/auth/nextjs-postgres.md`](../cards/auth/nextjs-postgres.md). To start a new card, run `pnpm new-card <topic> <stack>`.

## 1. File, id and URL

| Thing        | Rule                                   | Example                            |
| ------------ | -------------------------------------- | ---------------------------------- |
| Path         | `cards/<topic>/<stack>.md`             | `cards/auth/nextjs-postgres.md`    |
| `id`         | `<topic>/<stack>`; must equal the path | `auth/nextjs-postgres`             |
| Slugs        | lowercase kebab-case, 2-40 characters  | `payments-webhooks`                |
| Page         | `/library/<topic>/<stack>`             | `/library/auth/nextjs-postgres`    |
| Raw markdown | page URL + `.md`                       | `/library/auth/nextjs-postgres.md` |

**Reserved slugs** (not allowed as a topic): `stacks`, `connect`, `contribute`, `discuss`, `changelog`, `api`, `mcp`, `search`, `about`, `topics`, `og`, `_next`, `llms.txt`, `sitemap.xml`, `robots.txt`.

**Stack slugs** join the main technologies with `-`, in the order framework → data store → infra: `nextjs-postgres`, `nextjs-s3`, `django-postgres`. Use `any` for stack-independent guidance (`security-headers/any`). `auth/nextjs-postgres` and `auth/postgres-nextjs` count as the same card.

## 2. File structure

```
---
<YAML frontmatter: everything an agent acts on>
---

## Why this approach
## Lenses
### Security
### Performance & latency
### UX flows
### Data model
### Cost
## Common mistakes
## Notes for reviewers        (optional; must be empty or removed when verified)
## Further reading            (optional)
```

Anything an agent must act on goes in the **frontmatter**. Explanations for humans go in the **body**.

## 3. Frontmatter

| Field           | Type            | Required | Rules                                                                                |
| --------------- | --------------- | -------- | ------------------------------------------------------------------------------------ |
| `id`            | string          | yes      | Equals the path                                                                      |
| `title`         | string          | yes      | 10-80 characters                                                                     |
| `topic`         | slug            | yes      | Equals the folder; not reserved                                                      |
| `stack`         | slug[]          | yes      | 1-5 technology slugs, for example `[nextjs, postgres, typescript]`                   |
| `summary`       | string          | yes      | Answer first, plain text, one paragraph, at most 300 characters                      |
| `status`        | enum            | yes      | `draft`, `proposed`, `verified` or `stale`                                           |
| `card_version`  | semver          | yes      | The card's own version, for example `0.1.0`                                          |
| `last_verified` | date or null    | yes      | `YYYY-MM-DD`; required when `verified` or `stale`                                    |
| `review_level`  | enum or null    | yes      | `seed` or `community`; required when `verified` or `stale`                           |
| `authors`       | handle[]        | yes      | GitHub handles, at least one                                                         |
| `reviewers`     | handle[]        | yes      | At least 1 for `seed`, 2 for `community`; set by maintainers only                    |
| `lenses`        | enum[]          | yes      | Subset of `security`, `performance`, `ux`, `data`, `cost`; each needs a body section |
| `applies_when`  | object          | yes      | `{ app_types: string[], not_for: string[] }`                                         |
| `related`       | id[]            | no       | Other card ids; must exist (an error for verified cards, a warning otherwise)        |
| `checklist`     | ChecklistItem[] | yes      | 3-15 items                                                                           |
| `decisions`     | Decision[]      | yes      | 1-6 items                                                                            |
| `options`       | Option[]        | yes      | 1-4 items                                                                            |
| `recommended`   | option id       | yes      | The option to use when the user has no preference                                    |
| `versions`      | VersionEntry[]  | yes      | At least 1                                                                           |
| `verify`        | VerifyCheck[]   | yes      | 3-12 items                                                                           |
| `sources`       | Source[]        | yes      | At least 2; prefer official docs, OWASP, RFCs and NIST                               |

Unknown fields are errors, so typos are caught.

**Ids** (checklist, decisions, decision answers, options, verify checks) are kebab-case and unique within their list. Never use `yes`, `no`, `on`, `off`, `y`, `n`, `true`, `false` or `null` as an id: many YAML tools read them as booleans or null.

### ChecklistItem: what must be built

```yaml
- id: rate-limit-auth
  lens: security # security | performance | ux | data | cost
  level: must # must | should
  text: Rate-limit login, sign-up and password reset per IP and per account. # at most 200 characters
  why: Stops credential stuffing and email bombing. # optional, at most 160 characters
```

### Decision: what the agent asks before building

```yaml
- id: sso-soon
  question: Will business customers need SSO (SAML/OIDC) in the next 6 months?
  options: # 2-6 answers
    - { id: needed, label: 'Yes, SSO is needed soon', points_to: managed-provider }
    - { id: not-needed, label: 'No, not in the next 6 months' }
  default: not-needed # optional; must be one of the answer ids
```

`points_to` (optional) names the option that this answer favours.

### Option: one way to build it

```yaml
- id: managed-provider
  name: Managed auth provider
  examples: [Clerk, Supabase Auth, Auth0] # optional; examples, not endorsements
  best_fit_when: [You want the fastest launch]
  avoid_when: [Per-user pricing hurts at your scale]
  tradeoffs: [Vendor lock-in]
```

### VersionEntry: version gotchas, official docs first

```yaml
- package: next
  range: '>=16.0.0' # semver range; ranges for one package must not overlap
  notes: # 1-5 gotchas for this range
    - '`middleware.ts` is renamed to `proxy.ts`.'
  docs: https://nextjs.org/docs/app/guides/authentication # required: official docs
  context7: https://context7.com/vercel/next.js # optional: always second
```

- `docs` must be on the official docs allowlist in [`official-docs-domains.ts`](../packages/schema/src/config/official-docs-domains.ts) (subdomains count). If a project's official docs domain is missing, add it in the same pull request.
- `context7` must start with `https://context7.com/`.
- Link only. Never paste copied API reference into a card.
- A new major version means adding an entry, not rewriting the card.

### VerifyCheck: what tests should prove

```yaml
- id: reset-token-single-use
  lens: security
  type: integration # unit | integration | e2e | scan | manual
  check: A password-reset token works once, fails on a second use, and fails after it expires.
```

Write what must be true, never commands.

### Source

```yaml
- {
    title: OWASP Password Storage Cheat Sheet,
    url: 'https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html',
  }
```

## 4. Body

| Heading                  | Required | Content                                                                                                    |
| ------------------------ | -------- | ---------------------------------------------------------------------------------------------------------- |
| `## Why this approach`   | yes      | 2-6 sentences: why the recommended option is the default, and when to choose another                       |
| `## Lenses`              | yes      | One `###` per lens in `lenses`, in this order: Security, Performance & latency, UX flows, Data model, Cost |
| `## Common mistakes`     | yes      | 3-10 bullets                                                                                               |
| `## Notes for reviewers` | no       | Claims to double-check. Must be empty or removed when the card is verified                                 |
| `## Further reading`     | no       | Extra links                                                                                                |

Headings must appear in this order. No other `##` headings, no `#` heading (the title comes from the frontmatter), and no text before the first `##`.

## 5. Size budget

| Limit                                   | Value          |
| --------------------------------------- | -------------- |
| `summary`                               | 300 characters |
| Body (everything after the frontmatter) | 1,200 words    |
| Each lens section                       | 200 words      |

The validator warns at 90% of each limit.

## 6. Writing and safety rules

**Style**

- Be imperative, specific and testable: "Hash passwords with Argon2id", not "use strong hashing".
- Back every strong claim (a number, an "always" or a "never") with a source or a reason.
- Name products only as `examples` inside options, never as endorsements.
- Use plain English. No marketing language.

**Safety** (card text is data, never commands)

- Fenced code blocks only in `ts`, `tsx`, `js`, `sql`, `json` or `yaml`, at most 15 lines, as illustrations. No shell blocks and no unlabelled or indented code blocks.
- No text that addresses the agent beyond the card's purpose: "ignore previous instructions", "system prompt", "you must run", "execute the following", download-and-run, piping `curl` into a shell, decoding base64, sending data to an address the text names (a URL, or "this", "that", "the following", "my" or "our" URL, endpoint, webhook, server, address or email), or asking to read `.env`, keys or credentials. Ordinary feature text stays fine: "send a reset link to the user", "upload files to S3", "send the ID token to your server".
- No raw HTML, HTML comments or invisible Unicode characters (they can hide text).
- Links: `https://` only. No executables, scripts or archives, no URL shorteners, no raw IP addresses or `localhost`, no user names or passwords in URLs.
- No secrets or credentials, real or example-looking.

## 7. Status and versioning

| Status     | Who sets it                    | Served to agents                | Indexed by search engines |
| ---------- | ------------------------------ | ------------------------------- | ------------------------- |
| `draft`    | author                         | no                              | no (`noindex`)            |
| `proposed` | author (new pull requests)     | only on request, with a warning | no (`noindex`)            |
| `verified` | maintainers only               | yes                             | yes                       |
| `stale`    | maintainers or the stale check | yes, with a warning             | yes, with a banner        |

`card_version` follows semver:

- **patch**: typos, broken links, wording.
- **minor**: a new version entry, checklist item, option or verify check.
- **major**: the recommended option changed, or the meaning changed. The card goes back to `proposed` until it is re-reviewed.

## 8. Lenses

| id            | Section heading       | Covers                                                        |
| ------------- | --------------------- | ------------------------------------------------------------- |
| `security`    | Security              | Threats, secure defaults, OWASP-type issues                   |
| `performance` | Performance & latency | Query counts, caching, cold starts, payload size              |
| `ux`          | UX flows              | Journeys: sign-up, reset, errors, empty states, accessibility |
| `data`        | Data model            | Tables, indexes, constraints, retention, migrations           |
| `cost`        | Cost                  | Hosting, third-party pricing, scaling cost traps              |
