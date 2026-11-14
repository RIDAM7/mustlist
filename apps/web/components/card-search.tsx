'use client';

import Link from 'next/link';
import { useId, useRef, useState } from 'react';
import { loadSearchIndex } from '@mustlist/build/search';
import { BASE_PATH } from '@mustlist/schema/constants';
import { Input } from '@/components/ui/input';

interface Hit {
  id: string;
  title: string;
  summary: string;
  status: string;
}

/** Client-side search over the prebuilt MiniSearch index (loaded on first use). */
export function CardSearch() {
  const inputId = useId();
  const index = useRef<Promise<ReturnType<typeof loadSearchIndex>> | null>(null);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<Hit[]>([]);
  const [error, setError] = useState(false);

  function loadIndex() {
    // fetch() does not add basePath, so prefix it here.
    index.current ??= fetch(`${BASE_PATH}/api/search-index`)
      .then((response) => response.text())
      .then(loadSearchIndex);
    return index.current;
  }

  async function search(value: string) {
    setQuery(value);
    if (value.trim().length < 2) {
      setHits([]);
      return;
    }
    try {
      const results = (await loadIndex()).search(value).slice(0, 8);
      setHits(
        results.map((result) => ({
          id: String(result.id),
          title: String(result['title']),
          summary: String(result['summary']),
          status: String(result['status']),
        })),
      );
      setError(false);
    } catch {
      setError(true);
    }
  }

  return (
    <div className="w-full" role="search">
      <label htmlFor={inputId} className="sr-only">
        Search cards
      </label>
      <Input
        id={inputId}
        type="search"
        placeholder="Search: login, uploads, webhooks…"
        value={query}
        onFocus={() => void loadIndex()}
        onChange={(event) => void search(event.target.value)}
        className="h-11 text-base"
      />
      {error && <p className="mt-2 text-sm text-destructive">Search is unavailable right now.</p>}
      {query.trim().length >= 2 && !error && (
        <ul className="mt-3 divide-y rounded-lg border" aria-live="polite">
          {hits.length === 0 && (
            <li className="p-3 text-sm text-muted-foreground">No cards match.</li>
          )}
          {hits.map((hit) => (
            <li key={hit.id}>
              <Link href={`/${hit.id}`} className="block p-3 hover:bg-muted focus-visible:bg-muted">
                <span className="font-medium">{hit.title}</span>
                {hit.status !== 'verified' && (
                  <span className="ml-2 text-xs text-muted-foreground">({hit.status})</span>
                )}
                <span className="mt-1 block text-sm text-muted-foreground line-clamp-2">
                  {hit.summary}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
