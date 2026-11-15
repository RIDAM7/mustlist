# Contributing to Mustlist

> **Draft.** Mustlist is not open for contributions yet. This page describes how it will work, so you can see the process early. Feedback on the process itself is welcome in an issue.

Mustlist cards tell AI coding agents how to build a feature properly. Because agents act on what they read, every card is reviewed by people and checked by CI before agents see it.

## Ways to help

| Kind                     | Example                                      | Approvals needed                                              |
| ------------------------ | -------------------------------------------- | ------------------------------------------------------------- |
| Fix                      | Typo, broken link, wording                   | 1 reviewer or maintainer                                      |
| Version entry            | Notes and links for a new major version      | 1 reviewer, plus CI                                           |
| Improvement              | A new checklist item, option or verify check | 2 (one of them a maintainer)                                  |
| New card                 | `cards/payments-webhooks/nextjs-postgres.md` | 2 (one of them a maintainer)                                  |
| Change of recommendation | A different `recommended` option             | 2, plus a linked discussion; the card goes back to `proposed` |

You can also report a problem with a card using the **Correction** or **Card feedback** issue forms.

## Your first card in 5 minutes

1. Fork the repository and install: `pnpm install`.
2. Create the card: `pnpm new-card <topic> <stack>`, for example `pnpm new-card rate-limiting nextjs-postgres`. It starts with `status: proposed`.
3. Fill it in following [docs/card-spec.md](docs/card-spec.md). [`cards/auth/nextjs-postgres.md`](cards/auth/nextjs-postgres.md) is a full example.
4. Run `pnpm validate cards/<topic>/<stack>.md` until it passes. Add `--links` to check that every link works.
5. Run `pnpm dev` and look at your card at `http://localhost:3000/library/<topic>/<stack>`.
6. Commit with a sign-off (`git commit -s`) and open a pull request using the template. One card per pull request.

## How a card becomes verified

1. **Request** (recommended for new cards): ask for the card in the **Requests** discussion category, and upvote existing requests instead of repeating them. See [docs/community.md](docs/community.md) for how the site shows requests and proposals.
2. **Open a pull request.** CI runs typecheck, lint, tests, `pnpm validate` and a link check on changed cards. A pull request cannot merge while a check fails.
3. **Review.** Code owners for the topic are requested automatically and use the checklist below.
4. **Merge, then promote.** A maintainer merges and then marks the card `verified`, setting `last_verified`, `reviewers` and `review_level`, and bumping `card_version`.
5. **Keep it fresh.** Verified cards are re-checked every 180 days and when a new major version of a covered package ships. Until a re-check lands, the card is marked `stale`.

**New cards before there are enough reviewers** (seed level): 1 maintainer approval, plus the card's verify checks passing in a small sample app. These cards are labelled `review_level: seed` and re-reviewed later.

## Who may change what

| Field                                        | Contributor pull request           | Maintainer |
| -------------------------------------------- | ---------------------------------- | ---------- |
| `status: draft` or `proposed`                | yes                                | yes        |
| `status: verified` or `stale`                | no (CI will fail)                  | yes        |
| `reviewers`, `review_level`, `last_verified` | no (CI will fail)                  | yes        |
| `card_version`                               | must increase when content changes | yes        |

Maintainers are listed in [MAINTAINERS](MAINTAINERS).

## Reviewer checklist

- [ ] The summary answers the question in at most 300 characters and matches the recommended option.
- [ ] Every checklist item is specific and testable; the `must` items really are must-haves.
- [ ] The options are fair: "best fit when" and "avoid when" are honest, and no option reads like an ad.
- [ ] Each version entry links to the official docs first; Context7 is second and optional; nothing is copied from either.
- [ ] Strong claims have sources (official docs, OWASP, NIST, RFCs).
- [ ] The verify checks would catch the most likely mistakes.
- [ ] No unsafe content: commands, hidden instructions, secrets or odd links.
- [ ] For seed-level cards: the verify checks were run in a small sample app (link it).
- [ ] "Notes for reviewers" items are resolved.

## When people disagree

1. Present both views with sources.
2. If both approaches are valid, add the alternative as an option with honest "best fit when" text. Most disagreements end here.
3. If they conflict, the maintainer for the topic decides and records why in the pull request.

## Code changes

The packages and the website follow [AGENTS.md](AGENTS.md): TypeScript `strict`, small pure functions, tests for every validator rule (with a bad fixture in `fixtures/bad/<rule-id>.md`), cross-platform Node scripts, and Conventional Commits. Before opening a pull request, run:

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm validate
```

## Sign-off and licences

- Sign off every commit (`git commit -s`) to certify the [Developer Certificate of Origin](https://developercertificate.org/). There is no CLA.
- Cards and other content are licensed under [CC BY 4.0](LICENSE-CONTENT); code under [MIT](LICENSE).
- Everyone must follow the [Code of Conduct](CODE_OF_CONDUCT.md).
