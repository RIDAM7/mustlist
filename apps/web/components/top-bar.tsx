'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { ThemeToggle } from './client-bits';
import { Icon } from './icons';
import { Menu } from './overlay';
import { useSearch } from './search-palette';
import { Avatar, Kbd } from './ui';
import { useViewer } from './viewer';

type Section = 'library' | 'requests' | 'proposals' | 'none';

const NAV: { id: Section; label: string; href: string }[] = [
  { id: 'library', label: 'Library', href: '/' },
  { id: 'requests', label: 'Requests', href: '/requests' },
  { id: 'proposals', label: 'Proposals', href: '/proposals' },
];

const NO_SECTION = [
  '/review',
  '/people',
  '/how-it-works',
  '/activity',
  '/about',
  '/connect',
  '/changelog',
];

function sectionOf(pathname: string): Section {
  if (pathname.startsWith('/requests')) return 'requests';
  if (
    pathname.startsWith('/proposals') ||
    pathname.startsWith('/propose') ||
    pathname.endsWith('/propose')
  ) {
    return 'proposals';
  }
  if (NO_SECTION.some((prefix) => pathname.startsWith(prefix))) return 'none';
  return 'library';
}

const noop = () => () => {};
const isMac = () => /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

/** "Ctrl" on the server and on Windows/Linux, "⌘" on Apple devices. */
export function useModKey() {
  return useSyncExternalStore(
    noop,
    () => (isMac() ? '⌘' : 'Ctrl'),
    () => 'Ctrl',
  );
}

export function TopBar() {
  const pathname = usePathname();
  const active = sectionOf(pathname);
  const openSearch = useSearch();
  const { viewer, canSignIn, signOut, requireViewer } = useViewer();
  const mod = useModKey();
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <header className="border-b bg-bg">
      {/* Desktop */}
      <div className="wrap hidden h-16 items-center gap-6 md:flex">
        <Link href="/" className="wordmark">
          Mustlist
        </Link>
        <nav aria-label="Main" className="flex gap-1">
          {NAV.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className={cn('nav', item.id === active && 'nav-cur')}
              aria-current={item.id === active ? 'page' : undefined}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex-1" />
        <button
          type="button"
          className="searchbox w-[260px]"
          aria-label="Search cards, requests and proposals"
          onClick={() => openSearch()}
        >
          <Icon name="search" />
          <span className="flex-1 text-left">Search</span>
          <span className="flex gap-0.5">
            <Kbd>{mod}</Kbd>
            <Kbd>K</Kbd>
          </span>
        </button>
        <ThemeToggle />
        {viewer ? (
          <Menu
            label="Account"
            minWidth={200}
            items={[
              { label: 'Profile', icon: <Icon name="user" />, href: `/people/${viewer.handle}` },
              { label: 'Review queue', icon: <Icon name="queue" />, href: '/review' },
              {
                label: 'Sign out',
                icon: <Icon name="signOut" />,
                onSelect: signOut,
                separatorBefore: true,
              },
            ]}
            trigger={(props) => (
              <button
                type="button"
                className="btn btn-ghost gap-1.5 pl-1 pr-1.5"
                aria-label={`Account menu for ${viewer.handle}`}
                {...props}
              >
                <Avatar handle={viewer.handle} size="md" />
                <Icon name="chevronDown" size="sm" />
              </button>
            )}
          />
        ) : canSignIn ? (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => requireViewer('continue')}
          >
            Sign in
          </button>
        ) : null}
      </div>

      {/* Phone */}
      <div className="flex h-14 items-center gap-1 pl-4 pr-2 md:hidden">
        <Link href="/" className="wordmark flex-1">
          Mustlist
        </Link>
        <button
          type="button"
          className="btn btn-ghost btn-icon btn-lg"
          aria-label="Search"
          onClick={() => openSearch()}
        >
          <Icon name="search" size="lg" />
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-icon btn-lg"
          aria-label="Open menu"
          aria-expanded={sheetOpen}
          onClick={() => setSheetOpen(true)}
        >
          <Icon name="menu" size="lg" />
        </button>
      </div>
      {sheetOpen && (
        <MenuSheet active={active} pathname={pathname} onClose={() => setSheetOpen(false)} />
      )}
    </header>
  );
}

/** The phone menu: a sheet from the right with navigation, theme and account. */
function MenuSheet({
  active,
  pathname,
  onClose,
}: {
  active: Section;
  pathname: string;
  onClose: () => void;
}) {
  const { viewer, canSignIn, signOut, requireViewer } = useViewer();
  const panelRef = useRef<HTMLDivElement>(null);
  const first = useRef(pathname);

  // Close after navigating.
  useEffect(() => {
    if (pathname !== first.current) onClose();
  }, [pathname, onClose]);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    panelRef.current?.querySelector<HTMLElement>('button, a')?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, []);

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') onClose();
  };

  const link = (href: string, label: string, current = false) => (
    <Link
      href={href}
      className={cn('side h-11 text-[15px]', current && 'side-on')}
      aria-current={current ? 'page' : undefined}
    >
      {label}
    </Link>
  );

  return createPortal(
    <div onKeyDown={onKeyDown}>
      <div className="overlay" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        className="sheet flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
      >
        <div className="flex h-14 items-center justify-between border-b pl-4 pr-2">
          <span className="wordmark">Mustlist</span>
          <button
            type="button"
            className="btn btn-ghost btn-icon btn-lg"
            aria-label="Close menu"
            onClick={onClose}
          >
            <Icon name="x" size="lg" />
          </button>
        </div>
        <nav aria-label="Main" className="flex flex-col gap-0.5 p-2">
          {NAV.map((item) => link(item.href, item.label, item.id === active))}
        </nav>
        <div className="menu-sep mx-2" />
        <nav aria-label="More" className="flex flex-col gap-0.5 p-2">
          {link('/how-it-works', 'How it works', pathname === '/how-it-works')}
          {link('/activity', 'Activity', pathname === '/activity')}
          {link('/connect', 'Connect your agent', pathname === '/connect')}
          {link('/about', 'About', pathname === '/about')}
        </nav>
        <div className="flex-1" />
        <div className="flex flex-col gap-0.5 border-t p-2">
          {viewer ? (
            <>
              <Link href={`/people/${viewer.handle}`} className="side h-11 text-[15px]">
                <span className="flex items-center gap-2.5">
                  <Avatar handle={viewer.handle} />@{viewer.handle}
                </span>
              </Link>
              {link('/review', 'Review queue', pathname === '/review')}
              <button type="button" className="side h-11 text-[15px]" onClick={signOut}>
                Sign out
              </button>
            </>
          ) : canSignIn ? (
            <button
              type="button"
              className="btn btn-secondary btn-lg w-full"
              onClick={() => {
                onClose();
                requireViewer('continue');
              }}
            >
              Sign in
            </button>
          ) : (
            link('/review', 'Review queue', pathname === '/review')
          )}
          <div className="side h-11 cursor-default text-[15px] hover:bg-transparent">
            Theme
            <ThemeToggle className="btn btn-secondary btn-icon" />
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
