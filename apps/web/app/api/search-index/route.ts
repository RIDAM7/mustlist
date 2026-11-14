import { getSearchIndexJson } from '@/lib/data';

/** The prebuilt MiniSearch index used by the search box. Prerendered at build time. */
export function GET() {
  return new Response(getSearchIndexJson(), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'X-Robots-Tag': 'noindex',
      'Cache-Control': 'public, max-age=300, s-maxage=86400, stale-while-revalidate=604800',
    },
  });
}
