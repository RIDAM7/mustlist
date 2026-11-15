import path from 'node:path';
import { buildArtifacts } from '@mustlist/build';
import type { CardJSON } from '@mustlist/schema/types';
import { findMarkdownFiles, readCards } from '@mustlist/validator';
import { createLibrary, type Library } from '../src/library';

const ROOT = path.resolve(import.meta.dirname, '..', '..', '..');

/** The repository's real cards, built in memory (dist/ may not exist in CI). */
export function realCards(): CardJSON[] {
  return buildArtifacts(readCards(ROOT, findMarkdownFiles(ROOT, 'cards'))).cards;
}

/** Real cards plus two unreviewed ones, to test status filtering and stack choice. */
export function testLibrary(): Library {
  const cards = realCards();
  const auth = cards.find((card) => card.id === 'auth/nextjs-postgres');
  if (!auth) throw new Error('auth/nextjs-postgres is missing');
  const draft: CardJSON = {
    ...auth,
    id: 'auth/django-postgres',
    title: 'Authentication for a Django + Postgres app',
    stack: ['django', 'postgres'],
    status: 'draft',
    last_verified: null,
    review_level: null,
    url: 'https://ridamagrawal.com/library/auth/django-postgres',
  };
  const proposed: CardJSON = {
    ...auth,
    id: 'search/nextjs-postgres',
    topic: 'search',
    title: 'Full-text search for a Next.js + Postgres app',
    summary: 'Use Postgres full-text search with a GIN index before reaching for a search service.',
    status: 'proposed',
    last_verified: null,
    review_level: null,
    url: 'https://ridamagrawal.com/library/search/nextjs-postgres',
  };
  return createLibrary([...cards, draft, proposed], {
    markdown: (id) => (id === 'auth/nextjs-postgres' ? '# raw auth markdown\n' : undefined),
  });
}
