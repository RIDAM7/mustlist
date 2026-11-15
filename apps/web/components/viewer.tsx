'use client';

import {
  createContext,
  useCallback,
  useContext,
  useId,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { getPerson, isSampleData, sampleViewerHandle, type Person } from '@/lib/community';
import { Icon } from './icons';
import { Modal } from './overlay';
import { useToast } from './toast';

/**
 * Who is signed in. Reading never needs an account; writing does. In sample mode
 * the viewer is the sample maintainer, and "Sign out" / "Sign in" switch between
 * the two states so both can be tried. Build step B replaces this with a GitHub App.
 */

interface ViewerContextValue {
  viewer: Person | null;
  signIn: () => void;
  signOut: () => void;
  /** Run `action` when signed in; otherwise ask to sign in, e.g. "Sign in to reply". */
  requireViewer: (reason: string, action?: () => void) => void;
}

const ViewerContext = createContext<ViewerContextValue>({
  viewer: null,
  signIn: () => {},
  signOut: () => {},
  requireViewer: () => {},
});

export function useViewer() {
  return useContext(ViewerContext);
}

const STORAGE_KEY = 'mustlist-sample-signed-out';
const listeners = new Set<() => void>();

function readSignedOut(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function writeSignedOut(value: boolean) {
  try {
    if (value) localStorage.setItem(STORAGE_KEY, '1');
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage can be blocked; the state then lasts for this page only.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function ViewerProvider({ children }: { children: ReactNode }) {
  const signedOut = useSyncExternalStore(subscribe, readSignedOut, () => false);
  const [prompt, setPrompt] = useState<{ reason: string; action?: () => void } | null>(null);
  const toast = useToast();

  const viewer = isSampleData && !signedOut ? getPerson(sampleViewerHandle) : null;

  const signIn = useCallback(() => {
    if (isSampleData) writeSignedOut(false);
  }, []);
  const signOut = useCallback(() => {
    writeSignedOut(true);
    toast('Signed out');
  }, [toast]);

  const requireViewer = useCallback(
    (reason: string, action?: () => void) => {
      if (viewer) action?.();
      else setPrompt({ reason, action });
    },
    [viewer],
  );

  const value = useMemo(
    () => ({ viewer, signIn, signOut, requireViewer }),
    [viewer, signIn, signOut, requireViewer],
  );

  return (
    <ViewerContext.Provider value={value}>
      {children}
      <SignInDialog
        open={prompt !== null}
        reason={prompt?.reason ?? 'continue'}
        onClose={() => setPrompt(null)}
        onSignIn={() => {
          const action = prompt?.action;
          setPrompt(null);
          signIn();
          toast(`Signed in as @${sampleViewerHandle}`);
          // The viewer updates on the next render; run the action after it.
          if (action) setTimeout(action, 0);
        }}
      />
    </ViewerContext.Provider>
  );
}

/** "Sign in with GitHub", one line on what it is used for (design board 36). */
export function SignInDialog({
  open,
  reason,
  onClose,
  onSignIn,
}: {
  open: boolean;
  reason: string;
  onClose: () => void;
  onSignIn: () => void;
}) {
  const titleId = useId();
  return (
    <Modal
      open={open}
      onClose={onClose}
      labelledBy={titleId}
      align="center"
      className="relative max-w-[400px] p-7"
    >
      <button
        type="button"
        className="btn btn-ghost btn-icon absolute right-3 top-3"
        aria-label="Close"
        onClick={onClose}
      >
        <Icon name="x" />
      </button>
      <div className="wordmark">Mustlist</div>
      <h2 id={titleId} className="t-h3 mt-5">
        Sign in to {reason}
      </h2>
      <p className="t-sm muted mt-1.5">
        GitHub is used only for your handle and avatar. Reading needs no account.
      </p>
      <button type="button" className="btn btn-primary btn-lg mt-6 w-full" onClick={onSignIn}>
        <Icon name="signIn" />
        Sign in with GitHub
      </button>
      <p className="t-xs subtle mt-4 text-center">Read-only access to your public profile.</p>
    </Modal>
  );
}
