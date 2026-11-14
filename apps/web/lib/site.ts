import { BASE_PATH, PRODUCT_NAME, REPO_URL } from '@mustlist/schema/constants';
import { normaliseSiteUrl } from '@mustlist/schema/site';

/** Canonical origin, never the deployment host. Set NEXT_PUBLIC_SITE_URL to override. */
export const SITE_URL = normaliseSiteUrl(process.env.NEXT_PUBLIC_SITE_URL);

export const LIBRARY_URL = `${SITE_URL}${BASE_PATH}`;

export const SITE_NAME = PRODUCT_NAME;
export const SITE_TAGLINE = 'Build features right with your AI agent';
export const SITE_PITCH =
  'Reviewed "build it properly" cards for AI coding agents: what to build, what you forgot to ask for, and how to check it.';

export const LICENSE_CONTENT_URL = 'https://creativecommons.org/licenses/by/4.0/';

export function editOnGithubUrl(id: string): string {
  return `${REPO_URL}/edit/main/cards/${id}.md`;
}

export { BASE_PATH, REPO_URL };
