---
id: example/express-postgres
title: Example feature for an Express + Postgres app
topic: example
stack: [express, postgres]
summary: A verified example card used by the validator tests.
status: verified
card_version: 1.0.0
last_verified: 2026-11-12
review_level: seed
authors: [RIDAM7]
reviewers: [RIDAM7]
lenses: [security]
applies_when:
  app_types: [api]
  not_for: []
related: [example/nextjs-postgres]

checklist:
  - id: validate-input
    lens: security
    level: must
    text: Validate every request body on the server before using it.
  - id: limit-body-size
    lens: security
    level: must
    text: Reject request bodies larger than the largest valid payload.
  - id: log-failures
    lens: security
    level: should
    text: Log failed requests without logging request bodies.

decisions:
  - id: public-api
    question: Will third parties call this API?
    options:
      - { id: public, label: "Yes, it is public" }
      - { id: internal, label: "No, only our own app" }
    default: internal

options:
  - id: middleware
    name: Validation middleware
    best_fit_when: [Most routes share the same rules]
    avoid_when: [Every route is different]
    tradeoffs: [One more layer to read when debugging]
recommended: middleware

versions:
  - package: pg
    range: ">=8.0.0"
    notes:
      - "Use parameterised queries; never build SQL with string concatenation."
    docs: https://www.postgresql.org/docs/current/sql-prepare.html

verify:
  - id: rejects-bad-input
    lens: security
    type: integration
    check: A request with an invalid body returns HTTP 400 and changes nothing.
  - id: rejects-large-body
    lens: security
    type: integration
    check: A request body over the size limit returns HTTP 413.
  - id: no-body-in-logs
    lens: security
    type: unit
    check: Log lines for failed requests never contain the request body.

sources:
  - { title: OWASP Input Validation Cheat Sheet, url: "https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html" }
  - { title: PostgreSQL PREPARE, url: "https://www.postgresql.org/docs/current/sql-prepare.html" }
---

## Why this approach

Shared middleware applies the same checks to every route, so a new route cannot skip them by accident.

## Lenses

### Security

Validate and size-limit every body before any handler runs.

## Common mistakes

- Validating only some routes.
- Accepting unlimited body sizes.
- Logging full request bodies.
