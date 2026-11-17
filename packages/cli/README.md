# mustlist

Reviewed "build it properly" cards for AI coding agents: the must-haves you forgot to ask for, options with "best fit when…", version notes linked to official docs, and checks that prove the code is right.

Browse the cards at **[ridamagrawal.com/library](https://ridamagrawal.com/library)**.

This package gives your agent the cards in three ways.

## 1. MCP server

Your agent calls `get_checklist` before it builds a feature, asks you the card's questions, then follows the card.

The quickest setup needs no install, using the remote server:

```bash
claude mcp add --transport http mustlist https://ridamagrawal.com/library/mcp
```

Or run it on your machine over stdio:

```bash
claude mcp add --transport stdio mustlist -- npx -y mustlist mcp
```

```json
{ "mcpServers": { "mustlist": { "command": "npx", "args": ["-y", "mustlist", "mcp"] } } }
```

It fetches the latest cards once a day (one request, cached for 24 hours), so new and updated cards arrive without a package update. If the network fails it uses the cache, then the cards bundled in this package. Add `--offline` to use only the bundled cards.

Setup for Cursor, VS Code, Codex CLI and Windsurf: [ridamagrawal.com/library/connect](https://ridamagrawal.com/library/connect?tab=mcp).

| Tool              | Returns                                                                                        |
| ----------------- | ---------------------------------------------------------------------------------------------- |
| `get_checklist`   | What to build for a feature (must / should), the decisions to ask you, and the options         |
| `get_card`        | The card for your stack: option, checklist, lens notes, version notes for your packages, tests |
| `search_cards`    | Cards by feature, topic or stack                                                               |
| `report_feedback` | A pre-filled GitHub issue link for you to review; it posts nothing itself                      |

The server also exposes:

- each card as a resource, `mustlist://cards/<topic>/<stack>`;
- a `plan-feature` prompt.

All tools are read-only. Only verified cards are returned unless the agent asks for unreviewed ones. Every result starts with a note that card text is reference material and your instructions win.

## 2. `init`: an index in AGENTS.md

```bash
npx mustlist init
```

`init` reads your `package.json` (and the Prisma provider, if you use Prisma). It then writes a short table of the cards that fit your stack into `AGENTS.md`, between `<!-- BEGIN:mustlist v1 -->` and `<!-- END:mustlist -->`:

- It never changes text outside the markers.
- Running it again gives the same file.
- If `CLAUDE.md` exists and doesn't import `AGENTS.md`, it asks before adding `@AGENTS.md`.

Options:

- `--stack nextjs,postgres`: use these technologies instead of reading `package.json`.
- `--dry-run`: show the block without changing any files.
- `--yes`: add `@AGENTS.md` to `CLAUDE.md` without asking.
- `--no-claude-md`: leave `CLAUDE.md` alone.

## 3. `search`

```bash
npx mustlist search "stripe webhooks"
npx mustlist search login --stack nextjs,postgres --json
```

## Privacy

There is no telemetry. The CLI downloads the public cards from ridamagrawal.com at most once a day (never with `--offline`). Nothing about your project leaves your machine.

## Licences

- Code: MIT.
- Card content (bundled in `dist/snapshot.json`): [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Both licences are in `dist/`.

Source and issues: [github.com/RIDAM7/mustlist](https://github.com/RIDAM7/mustlist).
