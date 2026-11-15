'use client';

import { useState, type ReactNode } from 'react';
import { Icon } from '@/components/icons';
import { cn } from '@/lib/utils';

/** "Revision N | Current card" toggle above the boxed preview (board 26). */
export function PreviewSwitch({
  revisionLabel,
  revisionHeader,
  currentHeader,
  hasCurrent = true,
  currentBody,
  children,
}: {
  revisionLabel: string;
  revisionHeader: ReactNode;
  currentHeader: ReactNode;
  /** False for a new card: there is no current card to switch to. */
  hasCurrent?: boolean;
  /** The current card's body, when it differs from the proposal's. */
  currentBody?: ReactNode;
  /** The proposal's card body. */
  children: ReactNode;
}) {
  const [mode, setMode] = useState<'revision' | 'current'>('revision');
  return (
    <>
      <div className="panel t-sm flex flex-wrap items-center gap-3 py-2.5 pl-4 pr-3">
        <Icon name="eye" className="subtle" />
        <span className="flex-1">Preview · exactly as it will look when accepted</span>
        <div className="seg" role="tablist" aria-label="Version">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'revision'}
            className={cn('seg-b', mode === 'revision' && 'seg-on')}
            onClick={() => setMode('revision')}
          >
            {revisionLabel}
          </button>
          {hasCurrent && (
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'current'}
              className={cn('seg-b', mode === 'current' && 'seg-on')}
              onClick={() => setMode('current')}
            >
              Current card
            </button>
          )}
        </div>
      </div>
      <div className="box mt-4 px-4 pb-10 pt-6 md:px-12 md:pb-14 md:pt-10">
        {mode === 'revision' ? revisionHeader : currentHeader}
        <div className="mb-10 mt-8 h-px bg-border" />
        {mode === 'current' && currentBody ? currentBody : children}
      </div>
    </>
  );
}
