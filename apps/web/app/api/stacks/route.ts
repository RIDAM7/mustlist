import { jsonResponse } from '@/lib/api';
import { getDistFile } from '@/lib/data';

/** GET /library/api/stacks: stacks and their card ids. */
export function GET() {
  return jsonResponse(getDistFile('stacks.json'));
}
