'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Icon } from '../icons';

export interface LensBlock {
  id: string;
  /** Tab label: Security, Performance, UX flows, Data model, Cost. */
  short: string;
  /** Section title: Security, Performance & latency, UX flows, Data model, Cost. */
  title: string;
  /** Sanitized HTML rendered on the server. */
  html: string;
}

/** Lenses as tabs (card page) or as collapsible sections (proposal preview). */
export function LensSections({ lenses, mode }: { lenses: LensBlock[]; mode: 'tabs' | 'stack' }) {
  const [active, setActive] = useState(lenses[0]?.id ?? '');
  const [closed, setClosed] = useState<Set<string>>(() => new Set());
  const current = lenses.find((lens) => lens.id === active) ?? lenses[0];

  if (mode === 'tabs') {
    return (
      <>
        <div className="seg mb-5" role="tablist" aria-label="Lenses">
          {lenses.map((lens) => (
            <button
              key={lens.id}
              type="button"
              role="tab"
              id={`lens-tab-${lens.id}`}
              aria-selected={lens.id === current?.id}
              aria-controls="lens-panel"
              className={cn('seg-b', lens.id === current?.id && 'seg-on')}
              onClick={() => setActive(lens.id)}
            >
              {lens.short}
            </button>
          ))}
        </div>
        {current && (
          <div
            id="lens-panel"
            role="tabpanel"
            aria-labelledby={`lens-tab-${current.id}`}
            className="md prose gap-4"
            dangerouslySetInnerHTML={{ __html: current.html }}
          />
        )}
      </>
    );
  }

  return (
    <div className="border-t">
      {lenses.map((lens) => {
        const open = !closed.has(lens.id);
        return (
          <div key={lens.id} className="border-b pb-6 pt-5">
            <button
              type="button"
              aria-expanded={open}
              aria-controls={`lens-${lens.id}`}
              className="flex min-h-8 w-full cursor-pointer items-center justify-between border-0 bg-transparent p-0 text-left"
              onClick={() => {
                const next = new Set(closed);
                if (open) next.add(lens.id);
                else next.delete(lens.id);
                setClosed(next);
              }}
            >
              <span className="text-base font-semibold">{lens.title}</span>
              <Icon name={open ? 'chevronUp' : 'chevronDown'} className="subtle" />
            </button>
            {open && (
              <div
                id={`lens-${lens.id}`}
                className="md prose mt-3 gap-4"
                dangerouslySetInnerHTML={{ __html: lens.html }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
