import { BASE_PATH, DEFAULT_SITE_URL } from './constants';

/** `https://example.com/` -> `https://example.com` */
export function normaliseSiteUrl(siteUrl: string | undefined): string {
  const value = siteUrl?.trim() || DEFAULT_SITE_URL;
  return value.replace(/\/+$/, '');
}

/** Path of a card page under the site, for example `/library/auth/nextjs-postgres`. */
export function cardPath(id: string): string {
  return `${BASE_PATH}/${id}`;
}

export function cardUrl(siteUrl: string, id: string): string {
  return `${normaliseSiteUrl(siteUrl)}${cardPath(id)}`;
}

export function cardMarkdownUrl(siteUrl: string, id: string): string {
  return `${cardUrl(siteUrl, id)}.md`;
}

export function libraryUrl(siteUrl: string, path = ''): string {
  return `${normaliseSiteUrl(siteUrl)}${BASE_PATH}${path}`;
}
