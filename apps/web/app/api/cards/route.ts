import { jsonResponse } from '@/lib/api';
import { getDistFile } from '@/lib/data';

/** GET /library/api/cards: the same list as /library/api/index. */
export function GET() {
  return jsonResponse(getDistFile('index.json'));
}
