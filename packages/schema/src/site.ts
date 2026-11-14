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

/** Display names for technology slugs. Unknown slugs are capitalised. */
export const TECHNOLOGY_NAMES: Readonly<Record<string, string>> = {
  any: 'Any stack',
  django: 'Django',
  express: 'Express',
  mongodb: 'MongoDB',
  mysql: 'MySQL',
  nextjs: 'Next.js',
  nodejs: 'Node.js',
  postgres: 'Postgres',
  prisma: 'Prisma',
  react: 'React',
  redis: 'Redis',
  s3: 'S3',
  sqlite: 'SQLite',
  typescript: 'TypeScript',
};

const capitalise = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);

/** `payments-webhooks` -> `Payments webhooks` */
export function topicTitle(topic: string): string {
  return capitalise(topic.replace(/-/g, ' '));
}

/** `nextjs-postgres` -> `Next.js + Postgres` */
export function stackTitle(stack: string): string {
  return stack
    .split('-')
    .map((slug) => TECHNOLOGY_NAMES[slug] ?? capitalise(slug))
    .join(' + ');
}
