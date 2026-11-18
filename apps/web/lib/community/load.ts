import { cacheLife, cacheTag } from 'next/cache';
import { getIndex } from '@/lib/data';
import { fetchCommunity } from './github/fetch';
import { REPO } from './links';
import { sampleCommunity } from './sample';
import type { CommunityData } from './types';

/** Cache tag for everything read from GitHub; the webhook route revalidates it. */
export const COMMUNITY_TAG = 'community';

/**
 * Refresh hourly (in the background, on a visit), but never expire for a month:
 * the `hours` preset expires after a day, so the first visitor after a quiet
 * day waited ~3 s for a blocking GitHub read.
 */
const COMMUNITY_LIFE = { stale: 300, revalidate: 3600, expire: 60 * 60 * 24 * 30 };

/**
 * Community data for every page, read once and cached (Cache Components).
 *
 * - With `MUSTLIST_GITHUB_TOKEN` set: requests and proposals from GitHub,
 *   refreshed in the background when the webhook (app/api/github/webhook)
 *   reports a change, and at least every hour.
 * - Without it: the sample data, which every page labels as sample. Production
 *   deployments on Vercel refuse to build without the token.
 */
export async function loadCommunity(): Promise<CommunityData> {
  'use cache';
  cacheTag(COMMUNITY_TAG);

  const token = process.env.MUSTLIST_GITHUB_TOKEN?.trim();
  if (!token) {
    if (process.env.VERCEL_ENV === 'production') {
      throw new Error(
        'MUSTLIST_GITHUB_TOKEN must be set in production (see apps/web/.env.example).',
      );
    }
    cacheLife('max');
    return sampleCommunity(REPO.slug);
  }

  try {
    const data = await fetchCommunity({ token, cardIds: getIndex().map((card) => card.id) });
    cacheLife(COMMUNITY_LIFE);
    return data;
  } catch (error) {
    // Keep the site up when GitHub is down or the token is wrong; retry soon.
    console.error(
      '[community] Could not read GitHub:',
      error instanceof Error ? error.message : error,
    );
    cacheLife('minutes');
    const now = new Date().toISOString();
    return {
      source: 'github',
      repo: REPO.slug,
      fetchedAt: now,
      now,
      unavailable: true,
      requestsEnabled: false,
      people: [],
      requests: [],
      proposals: [],
      activity: [],
    };
  }
}
