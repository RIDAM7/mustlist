import { createLibrary, type Library } from '@mustlist/mcp';
import { createMustlistHttpHandler } from '@mustlist/mcp/http';
import { getCard, getIndex, getRawMarkdown } from '@/lib/data';

/**
 * /library/mcp: the remote MCP server (Streamable HTTP, stateless, read-only,
 * no auth). Cards come from the deployed dist/ and stay in memory per instance.
 */

let handle: ((request: Request) => Promise<Response>) | undefined;

function library(): Library {
  const cards = getIndex().flatMap(({ id }) => getCard(id) ?? []);
  return createLibrary(cards, { markdown: getRawMarkdown });
}

/**
 * Public, read-only data with no cookies, so any origin may call it (browser
 * clients such as the MCP Inspector need this). Preflight answers here.
 */
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Expose-Headers': '*',
  'Access-Control-Max-Age': '86400',
};

async function mcp(request: Request): Promise<Response> {
  handle ??= createMustlistHttpHandler(library());
  const response = await handle(request);
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(CORS)) headers.set(key, value);
  headers.set('X-Robots-Tag', 'noindex');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export { mcp as GET, mcp as POST, mcp as DELETE };

export function OPTIONS(): Response {
  return new Response(null, { status: 204, headers: CORS });
}
