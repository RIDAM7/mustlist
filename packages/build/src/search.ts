import MiniSearch, { type Options } from 'minisearch';
import type { CardJSON } from '@mustlist/schema/types';

/** One document in the search index. Arrays are joined into text. */
export interface SearchDocument {
  id: string;
  title: string;
  summary: string;
  topic: string;
  stack: string;
  checklist: string;
  status: string;
}

/** Shared by the build (to create the index) and the website (to load it). */
export const SEARCH_OPTIONS: Options<SearchDocument> = {
  idField: 'id',
  fields: ['title', 'summary', 'topic', 'stack', 'checklist'],
  storeFields: ['title', 'summary', 'topic', 'status'],
  searchOptions: {
    boost: { title: 3, topic: 2, summary: 1.5 },
    prefix: true,
    fuzzy: 0.2,
  },
};

export function toSearchDocument(card: CardJSON): SearchDocument {
  return {
    id: card.id,
    title: card.title,
    summary: card.summary,
    topic: card.topic,
    stack: [card.id.split('/')[1] ?? '', ...card.stack].join(' '),
    checklist: card.checklist.map((item) => item.text).join(' '),
    status: card.status,
  };
}

/** Build the index from cards in id order, so the serialised output is deterministic. */
export function createSearchIndex(cards: readonly CardJSON[]): MiniSearch<SearchDocument> {
  const index = new MiniSearch<SearchDocument>(SEARCH_OPTIONS);
  index.addAll([...cards].sort((a, b) => (a.id < b.id ? -1 : 1)).map(toSearchDocument));
  return index;
}

/** Load a serialised index (the contents of `search-index.json`). */
export function loadSearchIndex(json: string): MiniSearch<SearchDocument> {
  return MiniSearch.loadJSON<SearchDocument>(json, SEARCH_OPTIONS);
}
