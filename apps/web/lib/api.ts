/**
 * Responses for the machine endpoints (JSON API, raw markdown, llms.txt).
 * Read-only public data: cacheable on the CDN, readable from any origin,
 * and kept out of search results (people should land on the card pages).
 */
const SHARED_HEADERS = {
  'Cache-Control': 'public, max-age=300, s-maxage=86400, stale-while-revalidate=604800',
  'Access-Control-Allow-Origin': '*',
  'X-Robots-Tag': 'noindex',
};

export function dataResponse(body: string, contentType: string): Response {
  return new Response(body, {
    headers: { 'Content-Type': `${contentType}; charset=utf-8`, ...SHARED_HEADERS },
  });
}

export const jsonResponse = (body: string) => dataResponse(body, 'application/json');

export function notFoundResponse(): Response {
  return new Response('Not found\n', {
    status: 404,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Robots-Tag': 'noindex' },
  });
}
