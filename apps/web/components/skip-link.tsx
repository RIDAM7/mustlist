'use client';

import { goToSection } from '@/lib/scroll';

/** "Skip to content" for keyboard users. Moves focus to <main> without a `#` in the URL. */
export function SkipLink() {
  return (
    <button
      type="button"
      className="sr-only rounded-md bg-bg px-3 py-2 focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[70]"
      onClick={() => goToSection('main')}
    >
      Skip to content
    </button>
  );
}
