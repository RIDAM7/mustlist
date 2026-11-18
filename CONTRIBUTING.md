# Contributing to Mustlist

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

## Propose a card or a change

**On the site (no tools needed).** Sign in with GitHub at [ridamagrawal.com/library](https://ridamagrawal.com/library), then use **Propose a card** or **Suggest a change** on any card. The editor checks the card as you type, saves your draft in your browser, and **Submit for review** opens the pull request for you: the Mustlist Library app commits your card in your name, signed off, and names you as the proposer. Send it again from the editor to add a revision. You can have up to 3 proposals from the site open at once; revisions don't count.

**With git (5 minutes).**

1. Fork the repository and install: `pnpm install`.
2. Create the card: `pnpm new-card <topic> <stack>`, for example `pnpm new-card rate-limiting nextjs-postgres`. It starts with `status: proposed`.
3. Fill it in following [docs/card-spec.md](docs/card-spec.md). [`cards/auth/nextjs-postgres.md`](cards/auth/nextjs-postgres.md) is a full example.
4. Run `pnpm validate cards/<topic>/<stack>.md` until it passes. Add `--links` to check that every link works.
5. Run `pnpm dev` and look at your card at `http://localhost:3000/library/<topic>/<stack>`.
6. Commit with a sign-off (`git commit -s`) and open a pull request using the template. One card per pull request.

Looking for something small to start with? Issues labelled [`good first card`](https://github.com/RIDAM7/mustlist/labels/good%20first%20card) are version entries and small fixes.

## How a card becomes verified

1. **Request** (recommended for new cards): ask for the card in the **Requests** discussion category, and upvote existing requests instead of repeating them. See [docs/community.md](docs/community.md) for how the site shows requests and proposals.
2. **Open a proposal** (a pull request), from the site or with git. Checks run on their own:
   - **CI**: typecheck, lint, tests, `pnpm validate`, and a link check on changed cards.
   - **Sign-off**: every commit carries a `Signed-off-by:` line that matches its author.
   - **Card guard**: the changed cards validate, and only maintainers set the fields in the table below. It runs from the main branch, so a pull request can't change its own checks.
   - **Labels**: kind (`new card`, `card change`, `code`, `docs`) and `topic: …` are added for you.
3. **Review.** Code owners for the topic are requested automatically and use the checklist below. Reviewers can comment on a single field from the proposal's **Changes** tab.
4. **Accept.** A maintainer clicks **Accept** on the proposal page. That approves it, marks the card `verified` on the proposal's branch (`last_verified`, `reviewers` from the approvals, `review_level`, and a `card_version` bump) and merges it once the checks pass. A request linked with `Request: #12` is closed as resolved.
5. **Keep it fresh.** Every Monday a bot opens a **Re-check** issue for verified cards older than 180 days, a **New major version** issue when a package outgrows every range in a card, and one issue listing broken links.

**New cards before there are enough reviewers** (seed level): 1 maintainer approval, plus the card's verify checks passing in a small sample app. These cards are labelled `review_level: seed` and re-reviewed later.

## Who may change what

| Field                                        | Contributor pull request           | Maintainer |
| -------------------------------------------- | ---------------------------------- | ---------- |
| `status: draft` or `proposed`                | yes                                | yes        |
| `status: verified` or `stale`                | no (CI will fail)                  | yes        |
| `reviewers`, `review_level`, `last_verified` | no (CI will fail)                  | yes        |
| `card_version`                               | must increase when content changes | yes        |

Maintainers are listed in [MAINTAINERS](MAINTAINERS), reviewers in [REVIEWERS.md](REVIEWERS.md).

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
