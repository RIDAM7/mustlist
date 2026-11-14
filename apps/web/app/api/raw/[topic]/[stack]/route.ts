import { getIndex, getRawMarkdown, splitId } from '@/lib/data';

/**
 * Raw card markdown. Public URL: /library/<topic>/<stack>.md, mapped here by the
 * rewrite in next.config.ts. Prerendered at build time for every card.
 */
export function generateStaticParams() {
  return getIndex().map(({ id }) => splitId(id));
}

const HEADERS = {
  'Content-Type': 'text/markdown; charset=utf-8',
  // Raw files are for agents and tools; search engines should index the card page.
  'X-Robots-Tag': 'noindex',
  'Access-Control-Allow-Origin': '*',
  'Cache-Control': 'public, max-age=300, s-maxage=86400, stale-while-revalidate=604800',
};

export async function GET(_request: Request, { params }: RouteContext<'/api/raw/[topic]/[stack]'>) {
  const { topic, stack } = await params;
  const markdown = getRawMarkdown(`${topic}/${stack}`);
  if (markdown === undefined) {
    return new Response('Card not found\n', {
      status: 404,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Robots-Tag': 'noindex' },
    });
  }
  return new Response(markdown, { headers: HEADERS });
}
