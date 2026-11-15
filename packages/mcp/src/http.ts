import { createMcpHandler } from 'mcp-handler';
import type { Library } from './library';
import { registerMustlist, SERVER_INSTRUCTIONS, SERVER_NAME, SERVER_VERSION } from './server';

/**
 * The remote endpoint: a stateless, read-only Streamable HTTP handler,
 * `(Request) => Promise<Response>`. Mount it at any route (the website uses
 * /library/mcp). It serves the 2026-07-28 protocol and falls back to stateless
 * Streamable HTTP for 2025-era clients.
 */
export function createMustlistHttpHandler(
  library: Library,
  version = SERVER_VERSION,
): (request: Request) => Promise<Response> {
  return createMcpHandler((server) => registerMustlist(server, library), {
    serverInfo: { name: SERVER_NAME, version },
    instructions: SERVER_INSTRUCTIONS,
  });
}
