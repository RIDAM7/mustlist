# Mustlist

Reviewed "build it properly" cards for AI coding agents: the must-haves you forgot to ask for, options with "best fit when…", version gotchas linked to official docs, and checks that prove the code is right.

> Context7 tells your agent the current API. Mustlist tells it what to build, and what you forgot to ask for.

**Status: early development, not launched.** The card format, validator, build and website work locally. The first card (`auth/nextjs-postgres`) is a draft and has not been reviewed yet.

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

## How you will use it

These work locally today and will be served at `https://ridamagrawal.com/library`:

- **Website**: one page per card, plus topic and stack pages.
- **Raw markdown** for agents: add `.md` to any card URL.
- **JSON API**: `/library/api/index`, `/library/api/cards/<topic>/<stack>`, `/library/api/topics`, `/library/api/stacks`.
- **`/library/llms.txt`** and **`/library/sitemap.xml`**: verified cards only.

**Planned**: a remote MCP server and an `npx mustlist` command (a local MCP server, plus `init` to add a card index to your `AGENTS.md`).

## Quick start

You need Node.js 22.13 or later (LTS) and pnpm 11.

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
packages/mcp, packages/cli not implemented yet
apps/web                   the website (Next.js, served under /library)
fixtures/                  good and bad cards used by the validator tests
docs/card-spec.md          the card format
```

## Contributing

Contributions will open after launch. Until then, [CONTRIBUTING.md](CONTRIBUTING.md) is a draft of how it will work. Please read the [Code of Conduct](CODE_OF_CONDUCT.md). To report harmful card content or a vulnerability, see [SECURITY.md](SECURITY.md).

## Licences

- Code: [MIT](LICENSE)
- Cards and other content: [CC BY 4.0](LICENSE-CONTENT)
