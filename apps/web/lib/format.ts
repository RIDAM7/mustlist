/** Small, pure formatting helpers shared by server and client components. */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function parse(date: string): Date {
  // Plain dates (2026-11-12) are calendar days: read them as UTC so they never shift.
  return new Date(/^\d{4}-\d{2}-\d{2}$/.test(date) ? `${date}T00:00:00Z` : date);
}

/** `2026-11-12` -> `12 Nov 2026` */
export function formatDate(date: string): string {
  const d = parse(date);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** `2026-11-12` -> `12 Nov` */
export function formatShortDate(date: string): string {
  const d = parse(date);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/** `2026-11-12T16:04:00Z` -> `12 Nov, 16:04` */
export function formatDateTime(date: string): string {
  const d = parse(date);
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${formatShortDate(date)}, ${hh}:${mm}`;
}

/** Add days to a plain date: `addDays('2026-11-12', 180)` -> `2027-05-11`. */
export function addDays(date: string, days: number): string {
  const d = parse(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Relative time for lists: `2 hours ago`, `Yesterday`, `6 days ago`, `2 weeks ago`, `1 month ago`.
 * `now` is passed in so the function stays pure and testable.
 */
export function relativeTime(date: string, now: Date): string {
  const seconds = Math.max(0, (now.getTime() - parse(date).getTime()) / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? '' : 's'} ago`;
  if (minutes < 1) return 'just now';
  if (hours < 1) return plural(minutes, 'minute');
  if (days < 1) return plural(hours, 'hour');
  if (days === 1) return 'Yesterday';
  if (days < 14) return plural(days, 'day');
  if (days < 30) return plural(Math.floor(days / 7), 'week');
  if (days < 365) return plural(Math.floor(days / 30), 'month');
  return plural(Math.floor(days / 365), 'year');
}

/** Compact age for activity feeds: `5h`, `1d`, `3d`, `1w`, `2mo`. */
export function compactAge(date: string, now: Date): string {
  const hours = Math.max(0, (now.getTime() - parse(date).getTime()) / 3_600_000);
  if (hours < 1) return 'now';
  if (hours < 24) return `${Math.floor(hours)}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  if (days < 30) return `${Math.floor(days / 7)}w`;
  return `${Math.floor(days / 30)}mo`;
}

/** `7` -> `07` */
export const pad2 = (n: number): string => String(n).padStart(2, '0');

/** `https://docs.stripe.com/webhooks` -> `docs.stripe.com` */
export function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

/** `1` -> `1 reply`, `2` -> `2 replies` */
export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/**
 * Split one line of card text on backticks so `code` spans can be styled,
 * exactly like the design does: [{ text, code }].
 */
export function splitCode(text: string): { text: string; code: boolean }[] {
  return text
    .split('`')
    .map((part, index) => ({ text: part, code: index % 2 === 1 }))
    .filter((part) => part.text.length > 0);
}
