import { createAuthClient } from 'better-auth/react';

/**
 * Browser side of "Sign in with GitHub". Created on first use, in the browser
 * only, so prerendered pages never touch auth.
 */
type AuthClient = ReturnType<typeof createAuthClient>;
let client: AuthClient | undefined;

export function authClient(): AuthClient {
  client ??= createAuthClient({ baseURL: window.location.origin, basePath: '/library/api/auth' });
  return client;
}

export interface SessionUser {
  /** GitHub login (stored as the user's name, see lib/auth.ts). */
  handle: string;
  avatar?: string;
}

export async function currentUser(): Promise<SessionUser | null> {
  const { data } = await authClient().getSession();
  if (!data?.user) return null;
  return { handle: data.user.name, avatar: data.user.image ?? undefined };
}
