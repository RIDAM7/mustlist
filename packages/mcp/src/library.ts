import type MiniSearch from 'minisearch';
import { createSearchIndex, type SearchDocument } from '@mustlist/build/search';
import { PUBLIC_STATUSES, type Status } from '@mustlist/schema/constants';
import type { CardJSON } from '@mustlist/schema/types';

/**
 * The cards one MCP server answers from. The remote endpoint builds it from the
 * deployed `dist/`; the CLI from its bundled snapshot or the live JSON API.
 */
export interface Library {
  /** Every card, all statuses, sorted by id. */
  readonly cards: readonly CardJSON[];
  get(id: string): CardJSON | undefined;
  /** Cards an agent may see: verified and stale, plus the rest when `includeUnverified`. */
  visible(includeUnverified?: boolean): CardJSON[];
  /** Full-text search over title, summary, topic, stack and checklist. */
  readonly index: MiniSearch<SearchDocument>;
  /** Topic slugs that have at least one card. */
  readonly topics: readonly string[];
  /** Raw card markdown, when the source has it. */
  markdown(id: string): Promise<string | undefined>;
}

export interface LibraryOptions {
  markdown?: (id: string) => Promise<string | undefined> | string | undefined;
}

export function isVisible(status: Status, includeUnverified = false): boolean {
  return includeUnverified || PUBLIC_STATUSES.includes(status);
}

export function createLibrary(cards: readonly CardJSON[], options: LibraryOptions = {}): Library {
  const sorted = [...cards].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const byId = new Map(sorted.map((card) => [card.id, card]));
  const index = createSearchIndex(sorted);
  const topics = [...new Set(sorted.map((card) => card.topic))].sort();
  return {
    cards: sorted,
    get: (id) =>
      byId.get(
        id
          .trim()
          .replace(/^\/+|\/+$/g, '')
          .replace(/\.md$/, ''),
      ),
    visible: (includeUnverified = false) =>
      sorted.filter((card) => isVisible(card.status, includeUnverified)),
    index,
    topics,
    markdown: async (id) => (byId.has(id) ? await options.markdown?.(id) : undefined),
  };
}
