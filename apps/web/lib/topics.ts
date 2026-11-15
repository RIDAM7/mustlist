import { TECHNOLOGY_NAMES, stackTitle, topicTitle } from '@mustlist/schema/site';

/**
 * Display names and one-line descriptions for topics. Cards define which topics
 * exist; this only adds the words the site shows. Unknown topics fall back to
 * the slug ("background-jobs" -> "Background jobs").
 */
const TOPICS: Record<string, { name: string; line: string; lead?: string }> = {
  auth: {
    name: 'Auth',
    line: 'Sessions, password hashing, reset, MFA.',
    lead: 'Sign-up, sessions, passwords, reset and MFA.',
  },
  'payments-webhooks': {
    name: 'Payment webhooks',
    line: 'Verify signatures, store events once, fulfil server-side.',
    lead: 'Signature checks, events stored once, fulfilment you can trust.',
  },
  'rate-limiting': {
    name: 'Rate limiting',
    line: 'Per-account and per-IP limits in a shared store.',
    lead: 'Limits per account and per IP, kept in a shared store.',
  },
  'file-uploads': {
    name: 'File uploads',
    line: 'Presigned uploads, type and size checks, private by default.',
    lead: 'Presigned uploads, type and size checks, private by default.',
  },
  caching: {
    name: 'Caching',
    line: 'Cache what is safe; invalidate on write.',
    lead: 'Cache what is safe, and invalidate it when data changes.',
  },
  'background-jobs': { name: 'Background jobs', line: 'Queues, retries and idempotent workers.' },
  'multi-tenancy': { name: 'Multi-tenancy', line: 'Tenant isolation in one database.' },
  'transactional-email': { name: 'Transactional email', line: 'Verification, reset and receipts.' },
  search: { name: 'Search', line: 'Full-text search in Postgres.' },
  'idempotency-keys': { name: 'Idempotency keys', line: 'Safe retries for writes.' },
};

export function topicName(topic: string): string {
  return TOPICS[topic]?.name ?? topicTitle(topic);
}

export function topicLine(topic: string, fallback = ''): string {
  return TOPICS[topic]?.line ?? fallback;
}

export function topicLead(topic: string, fallback = ''): string {
  return TOPICS[topic]?.lead ?? TOPICS[topic]?.line ?? fallback;
}

/** `any` -> `any stack`, otherwise the usual stack title. */
export function stackName(stack: string): string {
  return stack === 'any' ? 'any stack' : stackTitle(stack);
}

export type TechKind = 'Framework' | 'Data store' | 'Infra' | 'Language';

/** What role each technology plays in a stack (used by Stacks and New request). */
export const TECH_KIND: Record<string, TechKind> = {
  nextjs: 'Framework',
  django: 'Framework',
  rails: 'Framework',
  sveltekit: 'Framework',
  laravel: 'Framework',
  express: 'Framework',
  react: 'Framework',
  nodejs: 'Framework',
  postgres: 'Data store',
  mysql: 'Data store',
  mongodb: 'Data store',
  sqlite: 'Data store',
  prisma: 'Data store',
  s3: 'Infra',
  redis: 'Infra',
  any: 'Infra',
  typescript: 'Language',
};

export function techName(slug: string): string {
  return TECHNOLOGY_NAMES[slug] ?? slug.charAt(0).toUpperCase() + slug.slice(1);
}

/** `nextjs-postgres` -> [{ k: 'Framework', v: 'Next.js' }, { k: 'Data store', v: 'Postgres' }] */
export function stackParts(stack: string): { k: string; v: string }[] {
  if (stack === 'any') return [{ k: 'Scope', v: 'Stack-independent guidance' }];
  const groups = new Map<string, string[]>();
  for (const slug of stack.split('-')) {
    const kind = TECH_KIND[slug] ?? 'Framework';
    groups.set(kind, [...(groups.get(kind) ?? []), techName(slug)]);
  }
  return [...groups].map(([k, v]) => ({ k, v: v.join(', ') }));
}

/** The technologies shown as chips in New request, in the order framework, data store, infra. */
export const STACK_CHOICES: { label: TechKind; items: string[] }[] = [
  { label: 'Framework', items: ['django', 'nextjs', 'rails', 'sveltekit', 'laravel'] },
  { label: 'Data store', items: ['postgres', 'mysql', 'mongodb', 'sqlite'] },
  { label: 'Infra', items: ['s3', 'redis', 'any'] },
];
