'use client';

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import Link from 'next/link';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

/* ── Popover menu ───────────────────────────────────────── */

/** Closes on outside click and Escape, and returns focus to the trigger. */
export function useDisclosure() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const close = useCallback((restoreFocus = true) => {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, close]);

  return { open, setOpen, close, rootRef, triggerRef };
}

/** Arrow keys move between `[role=menuitem]` children. */
function onMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
  const items = [
    ...event.currentTarget.querySelectorAll<HTMLElement>(
      '[role="menuitem"], [role="menuitemradio"], [role="option"]',
    ),
  ];
  const index = items.indexOf(document.activeElement as HTMLElement);
  if (event.key === 'ArrowDown') {
    event.preventDefault();
    items[(index + 1) % items.length]?.focus();
  } else if (event.key === 'ArrowUp') {
    event.preventDefault();
    items[(index - 1 + items.length) % items.length]?.focus();
  } else if (event.key === 'Home') {
    event.preventDefault();
    items[0]?.focus();
  } else if (event.key === 'End') {
    event.preventDefault();
    items.at(-1)?.focus();
  }
}

export interface MenuItem {
  label: string;
  icon?: ReactNode;
  onSelect?: () => void;
  /** App route (basePath added by Link). */
  href?: string;
  /** Plain URL for files and route handlers (no client navigation). */
  rawHref?: string;
  danger?: boolean;
  separatorBefore?: boolean;
  /** Marks the current choice in select-style menus. */
  selected?: boolean;
}

/** A dropdown menu anchored to its trigger (the design's `.menu`). */
export function Menu({
  trigger,
  items,
  align = 'right',
  label,
  minWidth,
  className,
  placement = 'below',
}: {
  trigger: (props: {
    ref: RefObject<HTMLButtonElement | null>;
    onClick: () => void;
    'aria-expanded': boolean;
    'aria-haspopup': 'menu';
    'aria-controls': string;
  }) => ReactNode;
  items: MenuItem[];
  align?: 'left' | 'right';
  label: string;
  minWidth?: number;
  className?: string;
  placement?: 'below' | 'above';
}) {
  const { open, setOpen, close, rootRef, triggerRef } = useDisclosure();
  const menuId = useId();
  const menuRef = useRef<HTMLDivElement>(null);

  // Keep the open menu on screen: a wide menu near the edge moves back inside.
  useLayoutEffect(() => {
    const menu = menuRef.current;
    const root = rootRef.current;
    if (!open || !menu || !root) return;
    // Move the box itself (not a transform), so it never widens the page.
    const side = align === 'right' ? 'right' : 'left';
    menu.style[side] = '';
    const gutter = 8;
    // Layout box, not getBoundingClientRect: the opening animation scales the menu.
    const left = root.getBoundingClientRect().left + menu.offsetLeft;
    const right = left + menu.offsetWidth;
    const overflow = right - (document.documentElement.clientWidth - gutter);
    const shift = overflow > 0 ? -Math.min(overflow, left - gutter) : Math.max(gutter - left, 0);
    if (shift) menu.style[side] = `${side === 'left' ? shift : -shift}px`;
  }, [open, align, rootRef]);

  useEffect(() => {
    if (open)
      menuRef.current
        ?.querySelector<HTMLElement>(
          '[aria-checked="true"], [role="menuitem"], [role="menuitemradio"]',
        )
        ?.focus();
  }, [open]);

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      {trigger({
        ref: triggerRef,
        onClick: () => setOpen(!open),
        'aria-expanded': open,
        'aria-haspopup': 'menu',
        'aria-controls': menuId,
      })}
      {open && (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label={label}
          className={cn(
            'menu dialog-in absolute z-40',
            align === 'right' ? 'right-0' : 'left-0',
            placement === 'below' ? 'top-[calc(100%+6px)]' : 'bottom-[calc(100%+6px)]',
          )}
          style={minWidth ? { minWidth } : undefined}
          onKeyDown={onMenuKeyDown}
        >
          {items.map((item) => (
            <div key={item.label}>
              {item.separatorBefore && <div className="menu-sep" role="separator" />}
              {item.href ? (
                <Link
                  href={item.href}
                  role="menuitem"
                  className={cn('menu-item', item.danger && 'text-danger')}
                  onClick={() => close(false)}
                >
                  {item.icon}
                  {item.label}
                </Link>
              ) : item.rawHref ? (
                <a
                  href={item.rawHref}
                  role="menuitem"
                  className={cn('menu-item', item.danger && 'text-danger')}
                  onClick={() => close(false)}
                >
                  {item.icon}
                  {item.label}
                </a>
              ) : (
                <button
                  type="button"
                  role={item.selected === undefined ? 'menuitem' : 'menuitemradio'}
                  aria-checked={item.selected === undefined ? undefined : item.selected}
                  className={cn(
                    'menu-item',
                    item.danger && 'text-danger',
                    item.selected && 'menu-on',
                  )}
                  onClick={() => {
                    close();
                    item.onSelect?.();
                  }}
                >
                  {item.icon}
                  <span className="flex-1">{item.label}</span>
                  {item.selected && (
                    <svg className="i i-sm" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="m5 12 4.5 4.5L19 7" />
                    </svg>
                  )}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** `.select` button + menu: "Topic Any ⌄". */
export function SelectMenu<T extends string>({
  label,
  value,
  options,
  onChange,
  icon,
  align = 'left',
  className,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  icon?: ReactNode;
  align?: 'left' | 'right';
  /** Classes for the wrapper, e.g. a max width so a long choice is truncated. */
  className?: string;
}) {
  const current = options.find((option) => option.value === value)?.label ?? value;
  return (
    <Menu
      label={label}
      align={align}
      minWidth={180}
      className={className}
      items={options.map((option) => ({
        label: option.label,
        selected: option.value === value,
        onSelect: () => onChange(option.value),
      }))}
      trigger={(props) => (
        <button
          type="button"
          className="select"
          {...props}
          aria-label={`${label}: ${current}`}
          title={`${label}: ${current}`}
        >
          {icon}
          <span className="k">{label}</span>
          <span className="v">{current}</span>
          <svg className="i i-sm" viewBox="0 0 24 24" aria-hidden="true">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
      )}
    />
  );
}

/* ── Modal dialog ───────────────────────────────────────── */

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * A modal over the page: Escape and the overlay close it, Tab stays inside,
 * and focus returns to where it was.
 */
export function Modal({
  open,
  onClose,
  labelledBy,
  label,
  children,
  className,
  align = 'top',
  initialFocus,
}: {
  open: boolean;
  onClose: () => void;
  labelledBy?: string;
  label?: string;
  children: ReactNode;
  className?: string;
  align?: 'top' | 'center';
  initialFocus?: RefObject<HTMLElement | null>;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    (initialFocus?.current ?? panel?.querySelector<HTMLElement>(FOCUSABLE) ?? panel)?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, [open, initialFocus]);

  if (!open) return null;

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== 'Tab' || !panelRef.current) return;
    const focusable = [...panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
    const first = focusable[0];
    const last = focusable.at(-1);
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return createPortal(
    <div
      className={cn(
        'overlay flex justify-center px-4',
        align === 'center' ? 'items-center' : 'items-start pt-[12vh] md:pt-[112px]',
      )}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-label={label}
        tabIndex={-1}
        className={cn('dialog dialog-in w-full outline-none', className)}
        onKeyDown={onKeyDown}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
