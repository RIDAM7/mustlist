import 'server-only';
import { createSign } from 'node:crypto';
import { REPO } from '../links';

/**
 * The Mustlist Library GitHub App acting as itself (an installation token), for
 * the one write a contributor can't make with their own token: putting their
 * card on a proposal branch in this repository. Everything else is written with
 * the signed-in person's own token.
 *
 * Env: GITHUB_APP_ID and GITHUB_APP_PRIVATE_KEY (the PEM from the app's settings;
 * pasted with real line breaks or with `\n`). Without them, proposals from the
 * editor fall back to GitHub's own editor.
 */

const appId = process.env.GITHUB_APP_ID?.trim();
const privateKey = process.env.GITHUB_APP_PRIVATE_KEY?.trim().replace(/\\n/g, '\n');

export const appWritesEnabled = Boolean(appId && privateKey);

const base64url = (input: Buffer | string) => Buffer.from(input).toString('base64url');

/** A 9-minute JWT signed with the app's private key (RS256). */
function appJwt(): string {
  if (!appId || !privateKey) throw new Error('The GitHub App key is not configured');
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64url(JSON.stringify({ iat: now - 60, exp: now + 540, iss: appId }));
  const signature = createSign('RSA-SHA256').update(`${header}.${payload}`).sign(privateKey);
  return `${header}.${payload}.${base64url(signature)}`;
}

async function appRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${appJwt()}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'mustlist-site',
      ...init.headers,
    },
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new Error(
      `GitHub App ${path}: ${response.status} ${(await response.text()).slice(0, 200)}`,
    );
  }
  return (await response.json()) as T;
}

let cached: { token: string; expires: number } | undefined;

/**
 * An installation token limited to this repository's contents and discussions.
 * Cached until five minutes before it expires (tokens last an hour).
 */
export async function installationToken(): Promise<string> {
  if (cached && cached.expires - Date.now() > 5 * 60_000) return cached.token;
  const installation = await appRequest<{ id: number }>(`/repos/${REPO.slug}/installation`);
  const created = await appRequest<{ token: string; expires_at: string }>(
    `/app/installations/${installation.id}/access_tokens`,
    {
      method: 'POST',
      body: JSON.stringify({
        repositories: [REPO.name],
        permissions: { contents: 'write', discussions: 'write', metadata: 'read' },
      }),
    },
  );
  cached = { token: created.token, expires: Date.parse(created.expires_at) };
  return created.token;
}
