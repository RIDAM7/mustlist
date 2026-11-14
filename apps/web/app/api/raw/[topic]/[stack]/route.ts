import { dataResponse, notFoundResponse } from '@/lib/api';
import { getIndex, getRawMarkdown, splitId } from '@/lib/data';

/**
 * Raw card markdown. Public URL: /library/<topic>/<stack>.md, mapped here by the
 * rewrite in next.config.ts. Prerendered at build time for every card.
 */
export function generateStaticParams() {
  return getIndex().map(({ id }) => splitId(id));
}

export async function GET(_request: Request, { params }: RouteContext<'/api/raw/[topic]/[stack]'>) {
  const { topic, stack } = await params;
  const markdown = getRawMarkdown(`${topic}/${stack}`);
  return markdown === undefined ? notFoundResponse() : dataResponse(markdown, 'text/markdown');
}
