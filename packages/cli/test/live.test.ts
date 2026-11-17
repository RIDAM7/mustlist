import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadLive, type Snapshot } from '../src/data';

const snap = (source: string, taken: string): Snapshot => ({
  taken,
  source,
  cards: [],
  markdown: {},
});
const hoursAgo = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString();

let dir: string;
let cacheFile: string;
const saved = process.env.MUSTLIST_DIST_DIR;
beforeEach(() => {
  delete process.env.MUSTLIST_DIST_DIR;
  dir = mkdtempSync(path.join(os.tmpdir(), 'mustlist-live-'));
  cacheFile = path.join(dir, 'cards.json');
});
afterEach(() => {
  if (saved !== undefined) process.env.MUSTLIST_DIST_DIR = saved;
});

const bundled = () => snap('bundled', '2026-01-01T00:00:00.000Z');
const log = vi.fn();

describe('loadLive', () => {
  it('fetches and caches when there is no cache', async () => {
    const fetched = snap('live', hoursAgo(0));
    const result = await loadLive({
      log,
      refresh: 'wait',
      cacheFile,
      bundled,
      fetcher: async () => fetched,
    });
    expect(result.source).toBe('live');
    expect(JSON.parse(readFileSync(cacheFile, 'utf8')).source).toBe('live');
  });

  it('uses a fresh cache without fetching', async () => {
    writeFileSync(cacheFile, JSON.stringify(snap('cache', hoursAgo(2))));
    const fetcher = vi.fn();
    const result = await loadLive({ log, refresh: 'wait', cacheFile, bundled, fetcher });
    expect(result.source).toBe('cache');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('falls back to an old cache, then to the bundled cards, when the fetch fails', async () => {
    const failing = async () => {
      throw new Error('offline');
    };
    const none = await loadLive({ log, refresh: 'wait', cacheFile, bundled, fetcher: failing });
    expect(none.source).toBe('bundled');
    writeFileSync(cacheFile, JSON.stringify(snap('cache', hoursAgo(48))));
    const old = await loadLive({ log, refresh: 'wait', cacheFile, bundled, fetcher: failing });
    expect(old.source).toBe('cache');
  });

  it('answers at once from an old cache in background mode, then refreshes it', async () => {
    writeFileSync(cacheFile, JSON.stringify(snap('cache', hoursAgo(48))));
    let finish: (value: Snapshot) => void = () => undefined;
    const pending = new Promise<Snapshot>((resolve) => (finish = resolve));
    const result = await loadLive({
      log,
      refresh: 'background',
      cacheFile,
      bundled,
      fetcher: () => pending,
    });
    expect(result.source).toBe('cache');
    finish(snap('live', hoursAgo(0)));
    await pending;
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(JSON.parse(readFileSync(cacheFile, 'utf8')).source).toBe('live');
  });

  it('prefers bundled cards that are newer than the cache (after an upgrade)', async () => {
    writeFileSync(cacheFile, JSON.stringify(snap('cache', '2025-01-01T00:00:00.000Z')));
    const result = await loadLive({
      log,
      refresh: 'background',
      cacheFile,
      bundled,
      fetcher: async () => {
        throw new Error('offline');
      },
    });
    expect(result.source).toBe('bundled');
  });
});
