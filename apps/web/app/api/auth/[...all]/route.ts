import { toNextJsHandler } from 'better-auth/next-js';
import { BASE_PATH } from '@mustlist/schema/constants';
import { getAuth } from '@/lib/auth';

/** /library/api/auth/*: Better Auth (sign in with GitHub, session, sign out). */

/**
 * Next.js removes the `/library` base path from `request.url` in route handlers,
 * but Better Auth matches and builds URLs with the full path. Put it back.
 */
function withBasePath(request: Request): Request {
  const url = new URL(request.url);
  if (url.pathname === BASE_PATH || url.pathname.startsWith(`${BASE_PATH}/`)) return request;
  url.pathname = `${BASE_PATH}${url.pathname}`;
  const init: RequestInit & { duplex?: 'half' } = {
    method: request.method,
    headers: request.headers,
    body: request.body,
    signal: request.signal,
    duplex: 'half',
  };
  return new Request(url, init);
}

async function handle(request: Request): Promise<Response> {
  const auth = getAuth();
  if (!auth) {
    return new Response('Sign-in is not set up on this site.\n', {
      status: 404,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Robots-Tag': 'noindex' },
    });
  }
  const handlers = toNextJsHandler(auth);
  const full = withBasePath(request);
  return request.method === 'POST' ? handlers.POST(full) : handlers.GET(full);
}

export { handle as GET, handle as POST };
