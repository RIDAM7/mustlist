import { jsonResponse } from '@/lib/api';
import { getCard, getIndex, getRawMarkdown } from '@/lib/data';

/**
 * GET /library/api/snapshot: every card (all statuses) as JSON plus its raw
 * markdown, in one response. The `mustlist` CLI reads this to stay current
 * without a new npm release; it stores the time it fetched it.
 */
export function GET() {
  const index = getIndex();
  return jsonResponse(
    JSON.stringify({
      cards: index.map(({ id }) => getCard(id)),
      markdown: Object.fromEntries(index.map(({ id }) => [id, getRawMarkdown(id) ?? ''])),
    }),
  );
}
