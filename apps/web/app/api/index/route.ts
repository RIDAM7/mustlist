import { jsonResponse } from '@/lib/api';
import { getDistFile } from '@/lib/data';

/** GET /library/api/index: every card (all statuses) with its summary and status. */
export function GET() {
  return jsonResponse(getDistFile('index.json'));
}
