import { jsonResponse, notFoundResponse } from '@/lib/api';
import { getCardJsonText, getIndex, splitId } from '@/lib/data';

/** GET /library/api/cards/<topic>/<stack>: the full structured card (CardJSON). */
export function generateStaticParams() {
  return getIndex().map(({ id }) => splitId(id));
}

export async function GET(
  _request: Request,
  { params }: RouteContext<'/api/cards/[topic]/[stack]'>,
) {
  const { topic, stack } = await params;
  const json = getCardJsonText(`${topic}/${stack}`);
  return json === undefined ? notFoundResponse() : jsonResponse(json);
}
