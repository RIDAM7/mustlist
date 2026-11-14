'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

/** Copies a ready-made message that points the user's agent at this card. */
export function CopyForAgent({ message }: { message: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');

  async function copy() {
    try {
      await navigator.clipboard.writeText(message);
      setState('copied');
    } catch {
      setState('failed');
    }
    setTimeout(() => setState('idle'), 2500);
  }

  return (
    <Button onClick={copy} aria-live="polite">
      {state === 'copied' ? 'Copied' : state === 'failed' ? 'Copy failed' : 'Copy for my agent'}
    </Button>
  );
}
