/**
 * Matching helpers: free-text features to topics, and a project's stack to a card's stack.
 * Pure functions, no I/O.
 */

/** Words people use for each topic. The topic slug and its words always match too. */
export const TOPIC_KEYWORDS: Readonly<Record<string, readonly string[]>> = {
  auth: [
    'authentication',
    'login',
    'log in',
    'logout',
    'sign in',
    'signin',
    'sign up',
    'signup',
    'register',
    'registration',
    'session',
    'sessions',
    'password',
    'passwords',
    'password reset',
    'mfa',
    '2fa',
    'two-factor',
    'oauth',
    'social login',
    'accounts',
  ],
  'rate-limiting': [
    'rate limit',
    'rate limiter',
    'ratelimit',
    'throttle',
    'throttling',
    '429',
    'brute force',
    'abuse',
    'quota',
  ],
  'payments-webhooks': [
    'payment',
    'payments',
    'webhook',
    'webhooks',
    'stripe',
    'razorpay',
    'checkout',
    'billing',
    'subscription',
    'subscriptions',
  ],
  'file-uploads': [
    'upload',
    'uploads',
    'file upload',
    'file uploads',
    'image upload',
    'attachments',
    'presigned url',
    's3 upload',
    'storage',
  ],
  caching: ['cache', 'caches', 'cached', 'use cache', 'revalidate', 'revalidation', 'cdn', 'isr'],
};

/** Package and product names that mean the same technology slug. */
const TECH_ALIASES: Readonly<Record<string, string>> = {
  next: 'nextjs',
  'next.js': 'nextjs',
  nextjs: 'nextjs',
  pg: 'postgres',
  postgresql: 'postgres',
  postgres: 'postgres',
  'postgres.js': 'postgres',
  '@neondatabase/serverless': 'postgres',
  '@vercel/postgres': 'postgres',
  neon: 'postgres',
  supabase: 'postgres',
  '@supabase/supabase-js': 'postgres',
  s3: 's3',
  'aws-s3': 's3',
  '@aws-sdk/client-s3': 's3',
  node: 'nodejs',
  'node.js': 'nodejs',
  nodejs: 'nodejs',
  ts: 'typescript',
  typescript: 'typescript',
  express: 'express',
  mysql: 'mysql',
  mysql2: 'mysql',
  sqlite: 'sqlite',
  'better-sqlite3': 'sqlite',
  mongodb: 'mongodb',
  mongoose: 'mongodb',
  redis: 'redis',
  ioredis: 'redis',
  prisma: 'prisma',
  '@prisma/client': 'prisma',
  django: 'django',
  react: 'react',
};

/** A dependency name -> its technology slug, only for packages we know: `pg` -> `postgres`. */
export function packageTech(name: string): string | undefined {
  return TECH_ALIASES[name.trim().toLowerCase()];
}

/** Lowercase, trim, and collapse separators: `  Next.js  ` -> `next.js`. */
function clean(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** One technology name -> its slug: `next` -> `nextjs`, `PostgreSQL` -> `postgres`. */
export function techSlug(value: string): string {
  const key = clean(value);
  return TECH_ALIASES[key] ?? key.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/**
 * A stack as given by an agent -> technology slugs. Accepts arrays and
 * compound values: `["Next.js + Postgres"]`, `["nextjs-postgres"]`, `["next", "pg"]`.
 */
export function techSlugs(stack: readonly string[] | undefined): string[] {
  const slugs = new Set<string>();
  for (const value of stack ?? []) {
    const whole = clean(value);
    if (TECH_ALIASES[whole]) {
      slugs.add(TECH_ALIASES[whole]);
      continue;
    }
    for (const part of whole.split(/[\s,+/]+|-(?=[a-z])/)) {
      if (part) slugs.add(techSlug(part));
    }
  }
  slugs.delete('');
  return [...slugs].sort();
}

/** The technologies a card is written for, from its id: `auth/nextjs-postgres` -> nextjs, postgres. */
export function cardTechs(id: string): string[] {
  const stack = id.split('/')[1] ?? '';
  return stack === 'any' ? [] : stack.split('-').filter(Boolean);
}

/** True when the project's stack has every technology the card is written for. */
export function stackFits(id: string, stack: readonly string[]): boolean {
  const have = new Set(stack);
  return cardTechs(id).every((tech) => have.has(tech));
}

/** How many of the card's technologies the project has. */
export function stackOverlap(id: string, stack: readonly string[]): number {
  const have = new Set(stack);
  return cardTechs(id).filter((tech) => have.has(tech)).length;
}

const slugify = (value: string) =>
  clean(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/**
 * Topics a free-text feature names, best first. Matches the topic slug, the topic
 * written as words ("rate limiting"), and the keywords above, as whole words.
 */
export function topicsForFeature(feature: string, topics: readonly string[]): string[] {
  const text = ` ${clean(feature).replace(/[^a-z0-9.@/+ -]+/g, ' ')} `;
  const slug = slugify(feature);
  const scores = new Map<string, number>();
  for (const topic of topics) {
    if (slug === topic) {
      scores.set(topic, 100);
      continue;
    }
    const phrases = [topic, topic.replace(/-/g, ' '), ...(TOPIC_KEYWORDS[topic] ?? [])];
    let best = 0;
    for (const phrase of phrases) {
      if (text.includes(` ${phrase} `)) best = Math.max(best, phrase.length);
    }
    if (best > 0) scores.set(topic, best);
  }
  return [...scores].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).map(([topic]) => topic);
}
