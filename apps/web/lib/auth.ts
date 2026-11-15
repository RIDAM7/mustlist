import { betterAuth } from 'better-auth';
import { nextCookies } from 'better-auth/next-js';
import { SITE_URL } from './site';

/**
 * "Sign in with GitHub" through a GitHub App (D-021 step B), with Better Auth in
 * stateless mode: no database, the session and the GitHub tokens live in
 * encrypted (JWE), HttpOnly cookies. Server only.
 *
 * A GitHub App's user token can act only where the app is installed (this
 * repository) and only with the app's permissions (discussions and pull
 * requests), always as the signed-in person. It expires after 8 hours; Better
 * Auth refreshes it with the 6-month refresh token.
 *
 * Env: GITHUB_APP_CLIENT_ID, GITHUB_APP_CLIENT_SECRET, BETTER_AUTH_SECRET, and
 * BETTER_AUTH_URL for local development (http://localhost:3000). Without them
 * sign-in is off and write buttons open GitHub instead.
 */

/** Auth routes, under the site's /library base path. */
export const AUTH_BASE_PATH = '/library/api/auth';

const clientId = process.env.GITHUB_APP_CLIENT_ID?.trim();
const clientSecret = process.env.GITHUB_APP_CLIENT_SECRET?.trim();
const secret = process.env.BETTER_AUTH_SECRET?.trim();

export const authEnabled = Boolean(clientId && clientSecret && secret);

/** One sign-in lasts 30 days (GitHub's refresh token lasts six months). */
const SESSION_SECONDS = 30 * 24 * 60 * 60;

function createAuth(id: string, clientSecretValue: string, secretValue: string) {
  const baseURL = process.env.BETTER_AUTH_URL?.trim() || SITE_URL;
  return betterAuth({
    appName: 'Mustlist',
    baseURL,
    basePath: AUTH_BASE_PATH,
    secret: secretValue,
    telemetry: { enabled: false },
    socialProviders: {
      github: {
        clientId: id,
        clientSecret: clientSecretValue,
        // We never need email. A GitHub App without the email permission makes the
        // email lookup fail quietly; use GitHub's no-reply address instead.
        mapProfileToUser: (profile) => ({
          name: profile.login,
          email: profile.email || `${profile.id}+${profile.login}@users.noreply.github.com`,
          image: profile.avatar_url,
        }),
      },
    },
    session: {
      expiresIn: SESSION_SECONDS,
      cookieCache: {
        enabled: true,
        maxAge: SESSION_SECONDS,
        strategy: 'jwe',
        refreshCache: true,
      },
    },
    // Stateless: OAuth state and the GitHub tokens are kept in encrypted cookies.
    account: { storeStateStrategy: 'cookie', storeAccountCookie: true },
    advanced: { useSecureCookies: baseURL.startsWith('https://') },
    // Lets Server Actions set cookies (for example after a token refresh). Keep last.
    plugins: [nextCookies()],
  });
}

type Auth = ReturnType<typeof createAuth>;
let instance: Auth | undefined;

/** The Better Auth instance, or undefined when sign-in isn't configured. */
export function getAuth(): Auth | undefined {
  if (!clientId || !clientSecret || !secret) return undefined;
  instance ??= createAuth(clientId, clientSecret, secret);
  return instance;
}
