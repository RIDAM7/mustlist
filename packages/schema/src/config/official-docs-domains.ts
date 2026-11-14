/**
 * Official documentation domains that a version entry's `docs` link may point to.
 *
 * A URL matches when its hostname equals one of these domains or is a subdomain of it,
 * so `stripe.com` also allows `docs.stripe.com`.
 *
 * To add a domain: append it here (lowercase, no protocol, no path) in the same pull
 * request as the card that needs it, and link the project's homepage in the PR so a
 * reviewer can confirm the domain is official.
 */
export const OFFICIAL_DOCS_DOMAINS: readonly string[] = [
  'authjs.dev',
  'better-auth.com',
  'developer.mozilla.org',
  'docs.aws.amazon.com',
  'nextjs.org',
  'nodejs.org',
  'orm.drizzle.team',
  'postgresql.org',
  'prisma.io',
  'razorpay.com',
  'react.dev',
  'stripe.com',
  'vercel.com',
];

/** True when `url` is an https URL whose host is on the official docs allowlist. */
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
  return domains.some((domain) => host === domain || host.endsWith(`.${domain}`));
}
