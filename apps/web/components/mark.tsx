import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Status marks (Claude Design "Mustlist pill marks", Nov 2026). Each names one
 * idea and keeps it wherever that idea appears: a tick is a yes, an eye is
 * waiting on reviewers, an empty ring is no card yet. Drawn on a 12 grid with a
 * 1.5 stroke, round caps and joins, in currentColor; a filled part says so.
 */

/** A filled part: only where the fill means something. */
const ON = { fill: 'currentColor', stroke: 'none' } as const;

const MARKS = {
  tick: <path d="M2.5 6.5 5 9l4.5-5.5" />,
  'double-tick': <path d="M1 6l2.5 2.5 4-5M6.5 8l.5.5 4-5" />,
  'tick-disc': (
    <path
      {...ON}
      fillRule="evenodd"
      d="M6 1.25a4.75 4.75 0 1 1 0 9.5a4.75 4.75 0 1 1 0-9.5zM2.97 7.03L4.47 8.53A.75 .75 0 0 0 5.57 8.49L8.57 4.99A.75 .75 0 0 0 7.43 4.01L4.96 6.9L4.03 5.97A.75 .75 0 0 0 2.97 7.03z"
    />
  ),
  cross: <path d="M3 3l6 6M9 3 3 9" />,
  spinner: <path d="M6 2a4 4 0 1 1-4 4" />,
  refresh: <path d="M9.5 6.5A3.5 3.5 0 1 1 6 3M4.5 1.5 6 3 4.5 4.5" />,
  'dashed-ring': <circle cx="6" cy="6" r="4" strokeDasharray="1.5 3.53" strokeDashoffset="7.03" />,
  ring: <circle cx="6" cy="6" r="4" />,
  'half-ring': (
    <>
      <circle cx="6" cy="6" r="4" />
      <path {...ON} d="M6 3.5a2.5 2.5 0 0 1 0 5z" />
    </>
  ),
  'slash-ring': (
    <>
      <circle cx="6" cy="6" r="4" />
      <path d="M3.5 8.5l5-5" />
    </>
  ),
  eye: (
    <>
      <path d="M1.5 6c1.25-2.5 2.75-4 4.5-4s3.25 1.5 4.5 4c-1.25 2.5-2.75 4-4.5 4S2.75 8.5 1.5 6z" />
      <circle {...ON} cx="6" cy="6" r="1.5" />
    </>
  ),
  'back-arrow': <path d="M4 2 1.5 4.5 4 7M1.5 4.5h6a2.5 2.5 0 0 1 0 5H5" />,
  bubble: <path d="M10.5 6a4 4 0 0 1-6 3.5L2 10l.5-2.5A4 4 0 1 1 10.5 6z" />,
  star: (
    <path d="M6 1.75L7.32 4.68L10.52 5.03L8.14 7.2L8.79 10.34L6 8.75L3.21 10.34L3.86 7.2L1.48 5.03L4.68 4.68z" />
  ),
  target: (
    <>
      <circle cx="6" cy="6" r="4" />
      <circle {...ON} cx="6" cy="6" r="1.5" />
    </>
  ),
} satisfies Record<string, ReactNode>;

/** The same shapes on a 16 grid: check rows, the Checks column, the Accept panel. */
const MARKS_16 = {
  tick: <path d="M3.5 8.5l3 3 6-7" />,
  cross: <path d="M4 4l8 8M12 4l-8 8" />,
  spinner: <path d="M8 2.5a5.5 5.5 0 1 1-5.5 5.5" />,
  ring: <circle cx="8" cy="8" r="5.5" />,
} satisfies Record<string, ReactNode>;

export type MarkName = keyof typeof MARKS;
export type RowMarkName = keyof typeof MARKS_16;

type MarkProps =
  | { name: MarkName; size?: 12; className?: string }
  | { name: RowMarkName; size: 16; className?: string };

/** Decorative: the label beside it always carries the meaning. */
export function Mark({ name, size = 12, className }: MarkProps) {
  const shape = size === 16 ? MARKS_16[name as RowMarkName] : MARKS[name as MarkName];
  return (
    <svg
      className={cn('mark', className)}
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden="true"
      focusable="false"
    >
      {shape}
    </svg>
  );
}
