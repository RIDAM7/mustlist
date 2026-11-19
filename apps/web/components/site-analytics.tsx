'use client';

import { Analytics } from '@vercel/analytics/next';
import { withBasePath } from '@/lib/analytics';

/**
 * Vercel Web Analytics: cookieless page views, no banner needed.
 *
 * The library is served on ridamagrawal.com/library, where /_vercel/insights at
 * the domain root is the site's own Web Analytics, so the script and endpoint
 * are pinned there (not under the /library basePath). `beforeSend` restores the
 * basePath that Next's pathname leaves out of each recorded URL.
 */
export function SiteAnalytics() {
  return (
    <Analytics
      scriptSrc="/_vercel/insights/script.js"
      endpoint="/_vercel/insights"
      beforeSend={(event) => withBasePath(event)}
    />
  );
}
