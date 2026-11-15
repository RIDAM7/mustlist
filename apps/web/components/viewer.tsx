'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { authClient, currentUser } from '@/lib/auth-client';
import { getPerson, type CommunitySource, type Person } from '@/lib/community';
import { Icon } from './icons';
import { Modal } from './overlay';
import { useToast } from './toast';

/**
 * Who is signed in, and where writes go. Reading never needs an account.
 *
 * - GitHub mode with sign-in set up (D-021 step B): "Sign in with GitHub" (a
 *   GitHub App). Writes go to GitHub as the signed-in person through Server
 *   Actions (lib/community/actions.ts).
 * - GitHub mode without sign-in: every write opens the matching page on GitHub
 *   (the `githubHref` of `requireViewer`).
 * - Sample mode: the viewer is the sample maintainer, writes change local state,
 *   and "Sign out" / "Sign in" switch between the two states so both can be tried.
 *
 * The session is read in the browser, so every page stays prerendered.
 */

interface ViewerContextValue {
  mode: CommunitySource;
  viewer: Person | null;
  /** Whether this site offers sign-in (sample mode, or GitHub mode with the app set up). */
  canSignIn: boolean;
  signIn: () => void;
  signOut: () => void;
  /**
   * Run `action` when signed in; otherwise ask to sign in ("Sign in to reply").
   * In GitHub mode without sign-in, open `githubHref` instead.
   */
  requireViewer: (reason: string, action?: () => void, githubHref?: string) => void;
  /** Ask to sign in again, for example after the GitHub token expired. */
  promptSignIn: (reason: string) => void;
}

const ViewerContext = createContext<ViewerContextValue>({
  mode: 'sample',
  viewer: null,
  canSignIn: false,
  signIn: () => {},
  signOut: () => {},
  requireViewer: () => {},
  promptSignIn: () => {},
});

/** Opens a GitHub page in a new tab (write actions in GitHub mode without sign-in). */
export function openOnGitHub(href: string) {
  window.open(href, '_blank', 'noopener,noreferrer');
}

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

export function ViewerProvider({
  mode,
  sampleViewer,
  authEnabled = false,
  people = [],
  children,
}: {
  mode: CommunitySource;
  /** The signed-in person in sample mode. */
  sampleViewer?: Person;
  /** GitHub mode: sign-in with the GitHub App is configured. */
  authEnabled?: boolean;
  /** Maintainers and reviewers, for the signed-in person's role. */
  people?: Person[];
  children: ReactNode;
}) {
  const signedOut = useSyncExternalStore(subscribe, readSignedOut, () => false);
  const [githubHandle, setGithubHandle] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<{ reason: string; action?: () => void } | null>(null);
  const toast = useToast();
  const github = mode === 'github' && authEnabled;

  useEffect(() => {
    if (!github) return;
    let live = true;
    currentUser()
      .then((user) => {
        if (live) setGithubHandle(user?.handle ?? null);
      })
      .catch(() => {
        // Signed out, or the auth endpoint is unreachable: reading still works.
      });
    return () => {
      live = false;
    };
  }, [github]);

  const viewer = github
    ? githubHandle
      ? getPerson(people, githubHandle)
      : null
    : mode === 'sample' && !signedOut
      ? (sampleViewer ?? null)
      : null;

  const signIn = useCallback(() => {
    if (github) {
      void authClient().signIn.social({ provider: 'github', callbackURL: window.location.href });
    } else if (mode === 'sample') {
      writeSignedOut(false);
    }
  }, [github, mode]);

  const signOut = useCallback(() => {
    if (github) {
      void authClient()
        .signOut()
        .then(() => {
          setGithubHandle(null);
          toast('Signed out');
        });
      return;
    }
    writeSignedOut(true);
    toast('Signed out');
  }, [github, toast]);

  const requireViewer = useCallback(
    (reason: string, action?: () => void, githubHref?: string) => {
      if (mode === 'github' && !authEnabled) {
        if (githubHref) openOnGitHub(githubHref);
        return;
      }
      if (viewer) action?.();
      else setPrompt({ reason, action });
    },
    [mode, authEnabled, viewer],
  );

  const promptSignIn = useCallback((reason: string) => setPrompt({ reason }), []);

  const value = useMemo(
    () => ({
      mode,
      viewer,
      canSignIn: mode === 'sample' || authEnabled,
      signIn,
      signOut,
      requireViewer,
      promptSignIn,
    }),
    [mode, viewer, authEnabled, signIn, signOut, requireViewer, promptSignIn],
  );

  return (
    <ViewerContext.Provider value={value}>
      {children}
      <SignInDialog
        open={prompt !== null}
        reason={prompt?.reason ?? 'continue'}
        github={github}
        onClose={() => setPrompt(null)}
        onSignIn={() => {
          const action = prompt?.action;
          setPrompt(null);
          signIn();
          // GitHub sign-in leaves the page and comes back here; sample sign-in is instant.
          if (github) return;
          toast(`Signed in as @${sampleViewer?.handle ?? 'you'}`);
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
  github = false,
  onClose,
  onSignIn,
}: {
  open: boolean;
  reason: string;
  /** Real GitHub sign-in (not the sample). */
  github?: boolean;
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
        {github
          ? 'Mustlist posts as you on GitHub, only in the Mustlist repository: replies, requests, Need this too and reviews. Reading needs no account.'
          : 'GitHub is used only for your handle and avatar. Reading needs no account.'}
      </p>
      <button type="button" className="btn btn-primary btn-lg mt-6 w-full" onClick={onSignIn}>
        <Icon name="signIn" />
        Sign in with GitHub
      </button>
      <p className="t-xs subtle mt-4 text-center">
        {github
          ? 'No email, no other repositories. Revoke any time in GitHub → Settings → Applications.'
          : 'Read-only access to your public profile.'}
      </p>
    </Modal>
  );
}
