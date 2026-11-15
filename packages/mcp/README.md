# @mustlist/mcp

Read-only MCP tools for Mustlist cards. Two places use them:

- the remote endpoint at `/library/mcp` (`apps/web/app/mcp/route.ts`);
- the stdio server in the `mustlist` CLI (`packages/cli`).

| File             | What it holds                                                                                                                |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `src/tools.ts`   | `search_cards`, `get_checklist`, `get_card` and `report_feedback` as pure functions, with their zod input and output schemas |
| `src/match.ts`   | Feature words → topics (`login` → `auth`), package names → stack slugs, and stack fit                                        |
| `src/format.ts`  | The reference wrapper and the compact card markdown                                                                          |
| `src/server.ts`  | Registers the tools, the `mustlist://cards/{topic}/{stack}` resource and the `plan-feature` prompt                           |
| `src/http.ts`    | The stateless Streamable HTTP handler (`mcp-handler`), exported as `@mustlist/mcp/http`                                      |
| `src/clients.ts` | Setup snippets per client, shared by the Connect page and `mustlist init` (`@mustlist/mcp/clients`)                          |

It is built on the MCP TypeScript SDK v2 (`@modelcontextprotocol/server`) and serves the 2026-07-28 protocol, with a stateless fallback for 2025-era clients.

Rules:

- Only `verified` and `stale` cards are returned unless the input has `include_unverified: true`.
- Every card result starts with the reference wrapper (D-012).
- `report_feedback` never writes anything.

Tests in `test/`:

- the tools against the real cards;
- a real MCP client talking to the HTTP handler end to end.
