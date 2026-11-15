import Link from 'next/link';
import type { ReactNode } from 'react';
import { toneFor } from '@/lib/community';
import { cn } from '@/lib/utils';
import { Icon, type IconName } from './icons';

/** Status pill: one colour per state. */
export function Pill({
  pill,
  label,
  className,
}: {
  pill: string;
  label: string;
  className?: string;
}) {
  return <span className={cn('pill', pill, className)}>{label}</span>;
}

const TONE_CLASS = ['', '', 'av-2', 'av-3', 'av-4'] as const;

/** Initial avatar in the person's colour. Links to the profile unless `link` is false. */
/** Pixel size of each avatar size, for the GitHub image request. */
const AVATAR_PX = { sm: 20, md: 28, lg: 40, xl: 64 } as const;

/**
 * GitHub photos are shown only with live GitHub data (set at build time in
 * next.config.ts), so the sample data's made-up handles never show real people.
 */
const GITHUB_AVATARS = process.env.NEXT_PUBLIC_MUSTLIST_AVATARS === 'github';

/** A person's GitHub photo, at twice the shown size for sharp screens. */
export function githubAvatarUrl(handle: string, px: number): string {
  return `https://avatars.githubusercontent.com/${encodeURIComponent(handle)}?s=${px * 2}`;
}

export function Avatar({
  handle,
  size,
  link = false,
  className,
}: {
  handle: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  link?: boolean;
  className?: string;
}) {
  const classes = cn('av', size && `av-${size}`, TONE_CLASS[toneFor(handle)], className);
  const initial = handle.charAt(0).toUpperCase();
  // The photo covers the initial; if it fails to load, the initial shows through.
  const photo = GITHUB_AVATARS ? (
    // eslint-disable-next-line @next/next/no-img-element -- tiny remote avatar; no optimization needed
    <img
      className="av-img"
      src={githubAvatarUrl(handle, size ? AVATAR_PX[size] : 24)}
      alt=""
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
    />
  ) : null;
  if (link) {
    return (
      <Link href={`/people/${handle}`} className={classes} aria-label={`@${handle}`}>
        {initial}
        {photo}
      </Link>
    );
  }
  return (
    <span className={classes} aria-hidden="true">
      {initial}
      {photo}
    </span>
  );
}

export function AvatarStack({
  handles,
  size,
  link = false,
}: {
  handles: string[];
  size?: 'sm' | 'md';
  link?: boolean;
}) {
  return (
    <span className="avs">
      {handles.map((handle) => (
        <Avatar key={handle} handle={handle} size={size} link={link} />
      ))}
    </span>
  );
}

/** `@RIDAM7, @maya-k` */
export const handleList = (handles: string[]) => handles.map((h) => `@${h}`).join(', ');

export interface Crumb {
  name: string;
  href?: string;
}

export function Crumbs({ items, label = 'Breadcrumb' }: { items: Crumb[]; label?: string }) {
  return (
    <nav className="crumbs" aria-label={label}>
      {items.map((item, index) => (
        <span key={`${item.name}-${index}`} className="contents">
          {index > 0 && <span aria-hidden="true">/</span>}
          {item.href ? (
            <Link href={item.href} className="leading-8 md:leading-normal">
              {item.name}
            </Link>
          ) : (
            <span className="text-fg-muted" aria-current="page">
              {item.name}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}

/** Section heading with an optional count and right-hand content. */
export function SectionHead({
  title,
  count,
  right,
  as: Tag = 'h2',
  className,
  small = false,
  id,
}: {
  title: ReactNode;
  count?: number;
  right?: ReactNode;
  as?: 'h2' | 'h3';
  className?: string;
  small?: boolean;
  id?: string;
}) {
  return (
    <div className={cn('mb-3 flex items-baseline justify-between gap-4', className)}>
      <div className="flex items-baseline gap-2">
        <Tag id={id} className={cn('sec-h', small && 'text-[18px]')}>
          {title}
        </Tag>
        {count !== undefined && <span className="count">{count}</span>}
      </div>
      {right}
    </div>
  );
}

/** The "need this too" counter box used in request rows. */
export function NeedBox({ need }: { need: number }) {
  return (
    <span className="need" aria-label={`${need} need this`}>
      <Icon name="caretUp" size="sm" />
      {need}
    </span>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <span className="kbd">{children}</span>;
}

export function KeyHint({ keys, label }: { keys: string[]; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      {keys.map((key) => (
        <Kbd key={key}>{key}</Kbd>
      ))}{' '}
      {label}
    </span>
  );
}

/** Dashed empty state with an icon, a title, a line and actions. */
export function EmptyState({
  icon,
  title,
  line,
  children,
  className,
}: {
  icon: IconName;
  title: string;
  line?: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'box-dash flex flex-col items-center gap-1.5 px-6 py-12 text-center md:py-16',
        className,
      )}
    >
      <Icon name={icon} size="lg" className="subtle" />
      <div className="mt-1.5 text-[15px] font-semibold">{title}</div>
      {line && <div className="t-sm subtle">{line}</div>}
      {children && <div className="mt-3 flex flex-wrap justify-center gap-2">{children}</div>}
    </div>
  );
}

/** Marks a section that shows sample community data. */
export function SampleBadge() {
  return (
    <span className="badge" title="Sample data until requests and proposals come from GitHub">
      Sample
    </span>
  );
}

/**
 * Shown on community pages while they read sample data (no GitHub token), and
 * when GitHub could not be read.
 */
export function SampleBanner({ className }: { className?: string }) {
  return (
    <div className={cn('banner banner-dash', className)} role="note">
      <span className="pill p-neutral">Sample data</span>
      <span className="muted flex-1">
        Shown until a GitHub token is set. Nothing here is saved.
      </span>
    </div>
  );
}

/** The community data source, as a banner when it is not live GitHub data. */
export function SourceBanner({
  source,
  unavailable,
  className,
}: {
  source: 'github' | 'sample';
  unavailable?: boolean;
  className?: string;
}) {
  if (source === 'sample') return <SampleBanner className={className} />;
  if (!unavailable) return null;
  return (
    <div className={cn('banner banner-warn', className)} role="status">
      <span className="pill p-warning bg-transparent px-0">GitHub unavailable</span>
      <span className="flex-1 text-fg">
        Requests and proposals could not be loaded. Retrying soon.
      </span>
    </div>
  );
}

/** Text with `code` spans, as the design renders one-line card text. */
export function CodeText({ parts }: { parts: { text: string; code: boolean }[] }) {
  return (
    <>
      {parts.map((part, index) =>
        part.code ? (
          <code key={index} className="ic">
            {part.text}
          </code>
        ) : (
          <span key={index}>{part.text}</span>
        ),
      )}
    </>
  );
}

/** Small external link with the design's arrow icon. */
export function External({
  href,
  children,
  className,
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <a href={href} className={className} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
}
