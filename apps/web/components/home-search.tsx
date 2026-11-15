'use client';

import { useId, type KeyboardEvent } from 'react';
import { cn } from '@/lib/utils';
import { Icon } from './icons';
import { useSearch } from './search-palette';
import { useModKey } from './top-bar';
import { Kbd } from './ui';

/** The large search field. Typing or clicking opens the search palette with the query. */
export function HomeSearch({
  placeholder = 'Search: login, uploads, webhooks…',
  size = 'lg',
  className,
}: {
  placeholder?: string;
  size?: 'lg' | 'md';
  className?: string;
}) {
  const openSearch = useSearch();
  const id = useId();
  const mod = useModKey();
  const big = size === 'lg';
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
      event.preventDefault();
      openSearch(event.key);
    } else if (event.key === 'Enter') {
      openSearch();
    }
  };
  if (big) {
    return (
      <div className={className} role="search">
        <label htmlFor={id} className="hero-search">
          <Icon name="search" size="lg" />
          <span className="sr-only">Search the library</span>
          <input
            id={id}
            type="search"
            placeholder={placeholder}
            readOnly
            onClick={() => openSearch()}
            onKeyDown={onKeyDown}
          />
          <span className="hidden gap-[3px] md:flex" aria-hidden="true">
            <Kbd>{mod}</Kbd>
            <Kbd>K</Kbd>
          </span>
        </label>
      </div>
    );
  }
  return (
    <div className={cn('relative', className)} role="search">
      <label htmlFor={id} className="sr-only">
        Search the library
      </label>
      <Icon name="search" className="pointer-events-none absolute left-3.5 top-3 text-fg-subtle" />
      <input
        id={id}
        className="input h-10 pl-10"
        placeholder={placeholder}
        readOnly
        onClick={() => openSearch()}
        onKeyDown={onKeyDown}
      />
    </div>
  );
}
