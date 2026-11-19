# Mustlist

Reviewed "build it properly" cards for AI coding agents: the must-haves you forgot to ask for, options with "best fit when…", version gotchas linked to official docs, and checks that prove the code is right.

> Context7 tells your agent the current API. Mustlist tells it what to build, and what you forgot to ask for.

**Live at [ridamagrawal.com/library](https://ridamagrawal.com/library)** with 5 verified cards: auth, rate limiting, payment webhooks, file uploads and caching, for Next.js with Postgres or S3. More are coming; [request one](https://github.com/RIDAM7/mustlist/discussions/categories/requests).

## What is a card?

A card covers one feature on one stack, for example [`cards/auth/nextjs-postgres.md`](cards/auth/nextjs-postgres.md). It contains:

- a short, answer-first **summary**
- a **must-have checklist**: the things people forget (rate limits, password reset, secure cookies…)
- **decisions** the agent should ask you about before it writes code
- **options**, each with "best fit when", "avoid when" and trade-offs
- **lenses**: security, performance, UX flows, data model and cost
- **version notes** that link to the official docs first and Context7 second
- **verify checks** the agent turns into tests
- sources, status, reviewers and the date it was last verified

Cards are Markdown with YAML frontmatter, and Git is the source of truth. Card text is reference material, never instructions: the validator blocks shell commands, hidden text and injection-style phrases. The full format is in [docs/card-spec.md](docs/card-spec.md).

Only **verified** cards are meant for agents. Drafts are visible on the website but marked `noindex`.

## Use it with your agent

**Remote MCP server** (read-only, no account, no key): `https://ridamagrawal.com/library/mcp`

```bash
claude mcp add --transport http mustlist https://ridamagrawal.com/library/mcp
```

**Claude Code plugin**: the same server plus a skill that makes Claude check the card before it builds a feature:

```text
/plugin marketplace add RIDAM7/mustlist
/plugin install mustlist@mustlist
```

Setup for Cursor, VS Code, Codex CLI and Windsurf is on the [Connect page](https://ridamagrawal.com/library/connect?tab=mcp). The server has four tools:

| Tool              | What it returns                                                                                |
| ----------------- | ---------------------------------------------------------------------------------------------- |
| `get_checklist`   | What to build for a feature (must / should), the decisions to ask you, and the options         |
| `get_card`        | The card for your stack: option, checklist, lens notes, version notes for your packages, tests |
| `search_cards`    | Cards by feature, topic or stack                                                               |
| `report_feedback` | A pre-filled GitHub issue link for you to review; it posts nothing itself                      |

Every result starts with a note that card text is reference material and your instructions win. Only verified cards are returned unless the agent asks for unreviewed ones.

**The `mustlist` command** ([packages/cli](packages/cli/README.md)):

```bash
npx mustlist init     # add an index of the cards that fit your stack to AGENTS.md
npx mustlist mcp      # the same MCP server over stdio (latest cards, cached; --offline for the bundled ones)
npx mustlist search "stripe webhooks"
```

**Without MCP**: add `.md` to any card URL for raw markdown, read [`/library/llms.txt`](https://ridamagrawal.com/library/llms.txt), or use the JSON API (`/library/api/index`, `/library/api/cards/<topic>/<stack>`, `/library/api/topics`, `/library/api/stacks`, and `/library/api/snapshot` for every card in one response).

## Quick start

You need Node.js 22.13 or later (LTS) and pnpm 12. If you have pnpm 11, run `pnpm self-update` first: pnpm 11 releases before 11.28.4 can't start pnpm 12 on Windows.

```bash
pnpm install
pnpm dev
```

Then open http://localhost:3000/library.

| Command                                                     | What it does                                                     |
| ----------------------------------------------------------- | ---------------------------------------------------------------- |
| `pnpm dev`                                                  | Builds the card data, then starts the website                    |
| `pnpm validate [paths…]`                                    | Checks cards against the spec (`--json`, `--links`, `--changed`) |
| `pnpm new-card <topic> <stack> [--draft]`                   | Creates a card from the template                                 |
| `pnpm promote <id> --reviewers a,b --level seed\|community` | Marks a reviewed card as verified (maintainers only)             |
| `pnpm build`                                                | Builds `dist/` (JSON, raw markdown, search index) and the site   |
| `pnpm test` · `pnpm lint` · `pnpm typecheck`                | Tests, lint and formatting, type checks                          |

## Repository layout

```
cards/<topic>/<stack>.md   the cards (source of truth)
templates/card.md          template used by pnpm new-card
packages/schema            card schema (zod), types, constants and parser
packages/validator         validation rules and the pnpm validate CLI
packages/build             cards -> dist/ (JSON, markdown, search index, llms.txt)
packages/mcp               MCP tools (search_cards, get_checklist, get_card, report_feedback)
packages/cli               the npx mustlist command: stdio MCP server, init, search
apps/web                   the website (Next.js, served under /library)
fixtures/                  good and bad cards used by the validator tests
docs/card-spec.md          the card format
```

## Contributing

Ask for a card in [Requests](https://ridamagrawal.com/library/requests) ("Need this too" is an upvote). Propose or fix a card right on the site (sign in with GitHub, then **Propose a card** or **Suggest a change**), or with git: see [CONTRIBUTING.md](CONTRIBUTING.md). Checks, labels, acceptance and freshness reminders are automated; reviewers are in [REVIEWERS.md](REVIEWERS.md). Please read the [Code of Conduct](CODE_OF_CONDUCT.md). To report harmful card content or a vulnerability, see [SECURITY.md](SECURITY.md).

## Licences

- Code: [MIT](LICENSE)
- Cards and other content: [CC BY 4.0](LICENSE-CONTENT)
