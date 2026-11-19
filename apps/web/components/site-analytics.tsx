'use client';

import { Analytics } from '@vercel/analytics/next';
import { withBasePath } from '@/lib/analytics';

/** ridamagrawal.com's own Web Analytics, at the domain root. */
const INSIGHTS = '/_vercel/insights';

/**
 * Vercel Web Analytics: cookieless page views, no banner needed.
 *
 * The library is served on ridamagrawal.com/library, so it reports to the
 * site's own Web Analytics at the domain root. Every path is pinned, because a
 * Vercel build bakes in this project's own (disguised) endpoints, which don't
 * exist on ridamagrawal.com and answer 404. `beforeSend` restores the basePath
 * that Next's pathname leaves out of each recorded URL.
 */
export function SiteAnalytics() {
  return (
    <Analytics
      scriptSrc={`${INSIGHTS}/script.js`}
      endpoint={INSIGHTS}
      viewEndpoint={`${INSIGHTS}/view`}
      eventEndpoint={`${INSIGHTS}/event`}
      sessionEndpoint={`${INSIGHTS}/session`}
      beforeSend={(event) => withBasePath(event)}
    />
  );
}
