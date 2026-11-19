import { dataResponse } from '@/lib/api';
import { getDistFile } from '@/lib/data';

/**
 * GET /library/llms.txt: verified and stale cards (stale ones marked as being
 * re-checked) grouped by topic, linking to their raw markdown.
 */
export function GET() {
  return dataResponse(getDistFile('llms.txt'), 'text/plain');
}
