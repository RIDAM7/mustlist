import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { CardIndexEntry, CardJSON, TopicEntry } from '@mustlist/schema/types';

/**
 * Server-only access to the built `dist/` folder (run `pnpm build:data` first).
 * Reads are synchronous on purpose: with Cache Components, `fs.readFileSync`
 * finishes during prerendering, so every page stays static.
 */
// The ignore comments stop Turbopack from tracing the whole repository because of these
// dynamic paths. next.config.ts adds `dist/` to the server output explicitly instead.
const DIST_DIR =
  process.env.MUSTLIST_DIST_DIR ??
  path.join(/* turbopackIgnore: true */ process.cwd(), '..', '..', 'dist');

function readDist(relative: string): string {
  const file = path.join(/* turbopackIgnore: true */ DIST_DIR, ...relative.split('/'));
  if (!existsSync(file)) {
    throw new Error(`Missing ${file}. Run "pnpm build:data" from the repository root first.`);
  }
  return readFileSync(file, 'utf8');
}

function readJson<T>(relative: string): T {
  return JSON.parse(readDist(relative)) as T;
}

export function getIndex(): CardIndexEntry[] {
  return readJson<CardIndexEntry[]>('index.json');
}

export function getTopics(): TopicEntry[] {
  return readJson<TopicEntry[]>('topics.json');
}

/** Only ids from the index are read, so request params can never escape `dist/`. */
function knownId(id: string): boolean {
  return getIndex().some((entry) => entry.id === id);
}

export function getCard(id: string): CardJSON | undefined {
  return knownId(id) ? readJson<CardJSON>(`cards/${id}.json`) : undefined;
}

export function getRawMarkdown(id: string): string | undefined {
  return knownId(id) ? readDist(`cards/${id}.md`) : undefined;
}

export function getSearchIndexJson(): string {
  return readDist('search-index.json');
}

/** `auth/nextjs-postgres` -> `{ topic: 'auth', stack: 'nextjs-postgres' }` */
export function splitId(id: string): { topic: string; stack: string } {
  const [topic = '', stack = ''] = id.split('/');
  return { topic, stack };
}
