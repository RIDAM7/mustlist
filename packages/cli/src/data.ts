import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLibrary, type Library } from '@mustlist/mcp';
import { DEFAULT_SITE_URL } from '@mustlist/schema/constants';
import type { CardIndexEntry, CardJSON } from '@mustlist/schema/types';

/**
 * Where the CLI gets cards:
 * - default: the live cards from the site (one request to /library/api/snapshot),
 *   cached for 24 hours in the OS cache folder, so new and updated cards arrive
 *   without a new npm release. When the network fails it falls back to the cache,
 *   then to the snapshot bundled at build time (`dist/snapshot.json`);
 * - `--offline`: only the bundled snapshot, no network.
 * `MUSTLIST_DIST_DIR` points at a `dist/` folder instead (development and tests; no network).
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

async function fetchText(url: string, timeoutMs = 15_000): Promise<string> {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'mustlist-cli' },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.text();
}

/** Every card from the live site: one request, or one per card on an older site. */
export async function fetchSnapshot(site = SITE, timeoutMs = 15_000): Promise<Snapshot> {
  const base = `${site}/library`;
  try {
    const bundle = JSON.parse(await fetchText(`${base}/api/snapshot`, timeoutMs)) as Pick<
      Snapshot,
      'cards' | 'markdown'
    >;
    if (Array.isArray(bundle.cards) && bundle.markdown) {
      return { taken: new Date().toISOString(), source: base, ...bundle };
    }
  } catch (error) {
    if (!(error instanceof Error && error.message.endsWith('returned 404'))) throw error;
  }
  const index = JSON.parse(await fetchText(`${base}/api/index`)) as CardIndexEntry[];
  const cards: CardJSON[] = [];
  const markdown: Record<string, string> = {};
  for (const { id } of index) {
    cards.push(JSON.parse(await fetchText(`${base}/api/cards/${id}`)) as CardJSON);
    markdown[id] = await fetchText(`${base}/${id}.md`);
  }
  return { taken: new Date().toISOString(), source: base, cards, markdown };
}

function readCache(file: string): Snapshot | undefined {
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as Snapshot;
  } catch {
    return undefined;
  }
}

function writeCache(file: string, snapshot: Snapshot): void {
  try {
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(snapshot));
  } catch {
    // A read-only home folder only means no cache.
  }
}

const newer = (a: Snapshot | undefined, b: Snapshot) =>
  a && Date.parse(a.taken) > Date.parse(b.taken) ? a : b;

export interface LiveOptions {
  /** Messages go here (stderr), never to stdout. */
  log: (message: string) => void;
  /**
   * `wait`: fetch now when the cache is older than 24 hours (search, init).
   * `background`: answer at once from the cache or bundled snapshot and refresh
   * for next time (the MCP server, which must start fast).
   */
  refresh: 'wait' | 'background';
  cacheFile?: string;
  fetcher?: () => Promise<Snapshot>;
  bundled?: () => Snapshot;
}

/** Live cards, cached for 24 hours, with the cache and the bundled snapshot as fallbacks. */
export async function loadLive(options: LiveOptions): Promise<Snapshot> {
  if (process.env.MUSTLIST_DIST_DIR) return loadSnapshot();
  const file = options.cacheFile ?? path.join(cacheDir(), 'cards.json');
  const timeout = options.refresh === 'background' ? 4_000 : 10_000;
  const fetcher = options.fetcher ?? (() => fetchSnapshot(SITE, timeout));
  const bundled = (options.bundled ?? loadSnapshot)();
  const cached = readCache(file);
  const best = newer(cached, bundled);
  if (cached && Date.now() - Date.parse(cached.taken) < CACHE_TTL_MS) return best;

  const refresh = fetcher().then((fresh) => {
    writeCache(file, fresh);
    return fresh;
  });
  if (options.refresh === 'background' && cached) {
    refresh.catch(() => undefined);
    return best;
  }
  try {
    return await refresh;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    options.log(
      `mustlist: could not fetch the latest cards (${reason}); using ${
        best === cached ? `the cache from ${best.taken}` : 'the cards bundled with this version'
      }.`,
    );
    return best;
  }
}
