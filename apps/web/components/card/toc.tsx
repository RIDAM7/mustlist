'use client';

import { useEffect, useState } from 'react';
import type { TocItem } from '@/lib/card';
import { cn } from '@/lib/utils';
import { Menu } from '../overlay';

/** The section currently at the top of the viewport. */
function useActiveSection(items: TocItem[]) {
  const [active, setActive] = useState(items[0]?.id ?? '');
  useEffect(() => {
    const sections = items
      .map((item) => document.getElementById(item.id))
      .filter((el): el is HTMLElement => Boolean(el));
    if (sections.length === 0) return;
    const onScroll = () => {
      const line = 120;
      let current = sections[0]?.id ?? '';
      for (const section of sections) {
        if (section.getBoundingClientRect().top - line <= 0) current = section.id;
      }
      // At the very bottom the last section wins even if it is short.
      if (window.innerHeight + window.scrollY >= document.body.scrollHeight - 4) {
        current = sections.at(-1)?.id ?? current;
      }
      setActive(current);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [items]);
  return active;
}

/** Desktop: sticky "On this card" list with the current section marked. */
export function Toc({ items }: { items: TocItem[] }) {
  const active = useActiveSection(items);
  return (
    <nav aria-label="On this card" className="toc">
      <div className="label mb-2.5">On this card</div>
      {items.map((item) => (
        <a
          key={item.id}
          href={`#${item.id}`}
          className={cn(item.id === active && 'toc-on')}
          aria-current={item.id === active ? 'location' : undefined}
        >
          {item.label}
        </a>
      ))}
    </nav>
  );
}

/** Phone: one sticky "On this card · Section" button that opens the list. */
export function TocSelect({ items }: { items: TocItem[] }) {
  const active = useActiveSection(items);
  const label = items.find((item) => item.id === active)?.label ?? items[0]?.label ?? '';
  return (
    <div className="sticky top-0 z-20 -mx-4 -mb-6 border-b bg-bg px-4 py-2 md:-mx-8 md:px-8 lg:hidden">
      <Menu
        label="On this card"
        align="left"
        className="w-full"
        items={items.map((item) => ({
          label: item.label,
          selected: item.id === active,
          onSelect: () => document.getElementById(item.id)?.scrollIntoView({ behavior: 'smooth' }),
        }))}
        trigger={(props) => (
          <button type="button" className="select h-9 w-full justify-between" {...props}>
            <span>
              <span className="k">On this card</span> · {label}
            </span>
            <svg className="i i-sm" viewBox="0 0 24 24" aria-hidden="true">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
        )}
      />
    </div>
  );
}
