import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLibrary, type Library } from '@mustlist/mcp';
import { DEFAULT_SITE_URL } from '@mustlist/schema/constants';
import type { CardIndexEntry, CardJSON } from '@mustlist/schema/types';

/**
 * Where the CLI gets cards:
 * - default: the snapshot bundled at build time (`dist/snapshot.json`), works offline;
 * - `--online`: the live JSON API, cached for 24 hours in the OS cache folder,
 *   falling back to the cache and then the snapshot when the network fails.
 * `MUSTLIST_DIST_DIR` points at a `dist/` folder instead (development and tests).
 */

export interface Snapshot {
  /** ISO date the cards were taken. */
  taken: string;
  source: string;
  cards: CardJSON[];
  markdown: Record<string, string>;
}

export const SITE = process.env.MUSTLIST_SITE_URL?.replace(/\/+$/, '') || DEFAULT_SITE_URL;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export function toLibrary(snapshot: Snapshot): Library {
  return createLibrary(snapshot.cards, { markdown: (id) => snapshot.markdown[id] });
}

/** Read a built `dist/` folder (`pnpm build:data` output) into a snapshot. */
export function readDistDir(dir: string): Snapshot {
  const read = (relative: string) => readFileSync(path.join(dir, ...relative.split('/')), 'utf8');
  const index = JSON.parse(read('index.json')) as CardIndexEntry[];
  const cards = index.map(({ id }) => JSON.parse(read(`cards/${id}.json`)) as CardJSON);
  const markdown = Object.fromEntries(index.map(({ id }) => [id, read(`cards/${id}.md`)]));
  return { taken: new Date().toISOString(), source: dir, cards, markdown };
}

/** The snapshot next to the bundled CLI, or the repository's dist/ when run from source. */
export function loadSnapshot(): Snapshot {
  const override = process.env.MUSTLIST_DIST_DIR;
  if (override) return readDistDir(override);
  const here = path.dirname(fileURLToPath(import.meta.url));
  const bundled = path.join(here, 'snapshot.json');
  if (existsSync(bundled)) return JSON.parse(readFileSync(bundled, 'utf8')) as Snapshot;
  const repoDist = path.resolve(here, '..', '..', '..', 'dist');
  if (existsSync(path.join(repoDist, 'index.json'))) return readDistDir(repoDist);
  throw new Error(
    'No card snapshot found. Run "pnpm build:data" (from source) or reinstall mustlist.',
  );
}

/** The OS cache folder for mustlist (no dependency needed for three platforms). */
export function cacheDir(
  platform: NodeJS.Platform = process.platform,
  env: NodeJS.ProcessEnv = process.env,
  home = os.homedir(),
): string {
  if (platform === 'win32') {
    return path.join(env.LOCALAPPDATA || path.join(home, 'AppData', 'Local'), 'mustlist', 'Cache');
  }
  if (platform === 'darwin') return path.join(home, 'Library', 'Caches', 'mustlist');
  return path.join(env.XDG_CACHE_HOME || path.join(home, '.cache'), 'mustlist');
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'mustlist-cli' },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.text();
}

/** Every card from the live site's JSON API. */
export async function fetchSnapshot(site = SITE): Promise<Snapshot> {
  const base = `${site}/library`;
  const index = JSON.parse(await fetchText(`${base}/api/index`)) as CardIndexEntry[];
  const cards: CardJSON[] = [];
  const markdown: Record<string, string> = {};
  for (const { id } of index) {
    cards.push(JSON.parse(await fetchText(`${base}/api/cards/${id}`)) as CardJSON);
    markdown[id] = await fetchText(`${base}/${id}.md`);
  }
  return { taken: new Date().toISOString(), source: base, cards, markdown };
}

/** Live cards, cached for 24 hours. Messages go to `log` (stderr), never stdout. */
export async function loadOnline(log: (message: string) => void): Promise<Snapshot> {
  const file = path.join(cacheDir(), 'cards.json');
  let cached: Snapshot | undefined;
  try {
    cached = JSON.parse(readFileSync(file, 'utf8')) as Snapshot;
  } catch {
    cached = undefined;
  }
  if (cached && Date.now() - Date.parse(cached.taken) < CACHE_TTL_MS) return cached;
  try {
    const fresh = await fetchSnapshot();
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(fresh));
    return fresh;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    if (cached) {
      log(`mustlist: could not refresh cards (${reason}); using the cache from ${cached.taken}.`);
      return cached;
    }
    log(`mustlist: could not fetch cards (${reason}); using the bundled snapshot.`);
    return loadSnapshot();
  }
}
