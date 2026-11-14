---
# New card. The format is described in docs/card-spec.md.
# Fill in every field, then run `pnpm validate` until it passes.
id: {{id}}
title: ""  # 10-80 characters, for example "Authentication for a Next.js + Postgres app"
topic: {{topic}}
stack: [{{stack}}]  # 1-5 technology slugs
summary: ""  # answer first, plain text, at most 300 characters
status: {{status}}
card_version: 0.1.0
last_verified: null
review_level: null
authors: [{{authors}}]
reviewers: []
lenses: [security, performance, ux, data, cost]  # keep only the lenses this card covers
applies_when:
  app_types: []  # for example [web-app, saas]
  not_for: []
related: []  # other card ids, for example [rate-limiting/nextjs-postgres]

# The must-haves users forget. 3-15 items:
#   - id: kebab-case-id
#     lens: security        # security | performance | ux | data | cost
#     level: must           # must | should
#     text: Imperative, specific and testable, at most 200 characters.
#     why: Optional, at most 160 characters.
checklist: []

# Questions the agent asks before building. 1-6 items. Never use yes/no as ids.
#   - id: sso-soon
#     question: Will business customers need SSO in the next 6 months?
#     options:
#       - { id: needed, label: "Yes, SSO is needed soon", points_to: managed-provider }
#       - { id: not-needed, label: "No, not in the next 6 months" }
#     default: not-needed
decisions: []

# Ways to build it. 1-4 items. Products are examples, not endorsements.
#   - id: managed-provider
#     name: Managed auth provider
#     examples: [Example A, Example B]
#     best_fit_when: [You want the fastest launch]
#     avoid_when: [Per-user pricing hurts at your scale]
#     tradeoffs: [Vendor lock-in]
options: []
recommended: ""  # the option id to use when the user has no preference

# Version gotchas. Official docs first (required), Context7 second (optional).
#   - package: next
#     range: ">=16.0.0"
#     notes: ["One gotcha for this range."]
#     docs: https://nextjs.org/docs/...
#     context7: https://context7.com/vercel/next.js
versions: []

# What must be true; the agent turns these into tests. 3-12 items. Never shell commands.
#   - id: reset-token-single-use
#     lens: security
#     type: integration     # unit | integration | e2e | scan | manual
#     check: A reset token works once and fails on a second use.
verify: []

# At least 2. Prefer official docs, OWASP, RFCs and NIST.
#   - { title: Source title, url: "https://..." }
sources: []
---

## Why this approach

## Lenses

### Security

### Performance & latency

### UX flows

### Data model

### Cost

## Common mistakes

## Notes for reviewers
