---
# Bad fixture for "schema": a checklist id of "yes", which YAML 1.1 tools read as a boolean
id: schema/nextjs-postgres
title: Example feature for a Next.js + Postgres app
topic: schema
stack: [nextjs, postgres]
summary: >-
  A small but complete draft card used by the validator tests. Every rule
  should pass on this file.
status: draft
card_version: 0.1.0
last_verified: null
review_level: null
authors: [RIDAM7]
reviewers: []
lenses: [security, performance]
applies_when:
  app_types: [web-app]
  not_for: [static-site]
related: [example/express-postgres]

checklist:
  - id: yes
    lens: security
    level: must
    text: Validate every request body on the server before using it.
    why: Client-side checks can be skipped.
  - id: index-lookups
    lens: performance
    level: must
    text: Add an index for every column used in a frequent lookup.
  - id: log-failures
    lens: security
    level: should
    text: Log failed requests without logging request bodies.

decisions:
  - id: scale
    question: How many requests per second do you expect at launch?
    options:
      - { id: low, label: "Fewer than 10" }
      - { id: high, label: "More than 10", points_to: managed }
    default: low

options:
  - id: built-in
    name: Built-in framework feature
    examples: [Next.js Route Handlers]
    best_fit_when: [You want the fewest moving parts]
    avoid_when: [You need features the framework does not offer]
    tradeoffs: [You maintain the code yourself]
  - id: managed
    name: Managed service
    best_fit_when: [You need it working today]
    avoid_when: [Per-request pricing hurts at your scale]
    tradeoffs: [Vendor lock-in]
recommended: built-in

versions:
  - package: next
    range: ">=16.0.0"
    notes:
      - "Route Handlers receive `params` as a Promise: await it."
    docs: https://nextjs.org/docs/app/api-reference/file-conventions/route
    context7: https://context7.com/vercel/next.js

verify:
  - id: rejects-bad-input
    lens: security
    type: integration
    check: A request with an invalid body returns HTTP 400 and changes nothing.
  - id: uses-index
    lens: performance
    type: integration
    check: The main lookup query uses an index scan, not a sequential scan.
  - id: no-body-in-logs
    lens: security
    type: unit
    check: Log lines for failed requests never contain the request body.

sources:
  - { title: OWASP Input Validation Cheat Sheet, url: "https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html" }
  - { title: PostgreSQL indexes, url: "https://www.postgresql.org/docs/current/indexes.html" }
---

## Why this approach

The built-in feature keeps the code close to the data and adds no new service. Choose the managed service when you need it working today and the price is acceptable.

## Lenses

### Security

Validate input on the server and keep request bodies out of logs.

```ts
const body = schema.parse(await request.json());
```

### Performance & latency

Index the columns you look up most often and check the query plan.

## Common mistakes

- Trusting client-side validation.
- Logging full request bodies.
- Adding the feature without an index.

## Notes for reviewers

Check that the version note still matches the current Next.js docs.
