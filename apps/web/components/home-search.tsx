'use client';

import { useId } from 'react';
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
  return (
    <div className={cn('relative', className)} role="search">
      <label htmlFor={id} className="sr-only">
        Search the library
      </label>
      <Icon
        name="search"
        size={big ? 'lg' : undefined}
        className={cn(
          'pointer-events-none absolute text-fg-subtle',
          big ? 'left-4 top-4 max-md:left-3.5 max-md:top-3.5' : 'left-3.5 top-3',
        )}
      />
      <input
        id={id}
        className={cn(
          'input',
          big
            ? 'h-[52px] rounded-lg pl-12 pr-24 text-base max-md:h-12 max-md:pl-11 max-md:pr-3'
            : 'h-10 pl-10',
        )}
        placeholder={placeholder}
        readOnly
        onClick={() => openSearch()}
        onKeyDown={(event) => {
          if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
            event.preventDefault();
            openSearch(event.key);
          } else if (event.key === 'Enter') {
            openSearch();
          }
        }}
      />
      {big && (
        <span className="pointer-events-none absolute right-3.5 top-4 hidden gap-0.5 md:flex">
          <Kbd>{mod}</Kbd>
          <Kbd>K</Kbd>
        </span>
      )}
    </div>
  );
}
