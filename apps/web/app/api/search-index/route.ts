import { jsonResponse } from '@/lib/api';
import { getDistFile } from '@/lib/data';

/** The prebuilt MiniSearch index used by the search box. Prerendered at build time. */
export function GET() {
  return jsonResponse(getDistFile('search-index.json'));
}
