import type { MetadataRoute } from 'next';
import { getIndex, splitId } from '@/lib/data';
import { isIndexable } from '@/lib/seo';
import { LIBRARY_URL } from '@/lib/site';

/** Pages that are always indexable. */
export const INFO_PAGES = ['about', 'how-it-works', 'connect', 'stacks', 'activity'] as const;

/**
 * /library/sitemap.xml: indexable pages only. Cards appear once they are verified
 * (or stale), with lastModified = last_verified; topic and stack hubs appear once
 * they contain such a card.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const cards = getIndex().filter((card) => isIndexable(card.status));
  const topics = [...new Set(cards.map((card) => card.topic))].sort();
  const stacks = [...new Set(cards.map((card) => splitId(card.id).stack))].sort();

  return [
    { url: LIBRARY_URL },
    ...INFO_PAGES.map((page) => ({ url: `${LIBRARY_URL}/${page}` })),
    ...topics.map((topic) => ({ url: `${LIBRARY_URL}/${topic}` })),
    ...stacks.map((stack) => ({ url: `${LIBRARY_URL}/stacks/${stack}` })),
    ...cards.map((card) => ({
      url: `${LIBRARY_URL}/${card.id}`,
      ...(card.last_verified ? { lastModified: card.last_verified } : {}),
    })),
  ];
}
