import { jsonResponse } from '@/lib/api';
import { getDistFile } from '@/lib/data';

/** GET /library/api/topics: topics and their card ids. */
export function GET() {
  return jsonResponse(getDistFile('topics.json'));
}
