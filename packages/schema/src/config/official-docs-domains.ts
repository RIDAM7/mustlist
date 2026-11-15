/**
 * Official documentation sources that a version entry's `docs` link may point to.
 *
 * - A domain entry (`stripe.com`) matches that host and its subdomains, so it also
 *   allows `docs.stripe.com`.
 * - A repository entry (`github.com/porsager/postgres`) is for projects whose only
 *   official docs are their repository README. It matches that exact host and that
 *   path or anything below it, never the rest of the host: `github.com` itself is
 *   never allowed.
 *
 * To add an entry: append it here (lowercase, no protocol) in the same pull request
 * as the card that needs it, and link the project's homepage in the PR so a reviewer
 * can confirm the source is official.
 */
export const OFFICIAL_DOCS_DOMAINS: readonly string[] = [
  'authjs.dev',
  'better-auth.com',
  'developer.mozilla.org',
  'docs.aws.amazon.com',
  'github.com/porsager/postgres',
  'inngest.com',
  'neon.com',
  'nextjs.org',
  'node-postgres.com',
  'nodejs.org',
  'nodemailer.com',
  'orm.drizzle.team',
  'pgboss.io',
  'postgresql.org',
  'prisma.io',
  'razorpay.com',
  'react.dev',
  'react.email',
  'resend.com',
  'stripe.com',
  'upstash.com',
  'vercel.com',
  'worker.graphile.org',
];

/** True when `url` is an https URL on the official docs allowlist. */
export function isOfficialDocsUrl(
  url: string,
  domains: readonly string[] = OFFICIAL_DOCS_DOMAINS,
): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  const host = parsed.hostname.toLowerCase();
  const path = parsed.pathname.toLowerCase();
  return domains.some((entry) => {
    const slash = entry.indexOf('/');
    if (slash === -1) return host === entry || host.endsWith(`.${entry}`);
    const prefix = entry.slice(slash);
    return (
      host === entry.slice(0, slash) &&
      (path === prefix || path.startsWith(`${prefix}/`) || path.startsWith(`${prefix}#`))
    );
  });
}
