import semver from 'semver';
import {
  GITHUB_HANDLE_PATTERN,
  MIN_REVIEWERS,
  REVIEW_LEVELS,
  type ReviewLevel,
  normaliseText,
  parseCard,
} from '@mustlist/schema';

export interface PromoteOptions {
  reviewers: readonly string[];
  level: string;
  /** `YYYY-MM-DD`; the caller passes today's date. */
  date: string;
}

export interface PromoteResult {
  text: string;
  fromStatus: string;
  fromVersion: string;
  toVersion: string;
}

export class PromoteError extends Error {
  override name = 'PromoteError';
}

/**
 * The version after promotion:
 * - first verification (0.x) -> 1.0.0
 * - re-verifying a verified or stale card -> patch bump
 * - verifying again after a major change (already 1.0.0 or above) -> unchanged
 */
export function nextCardVersion(version: string, status: string): string {
  if (semver.valid(version) === null)
    throw new PromoteError(`card_version "${version}" is not semver`);
  if (semver.major(version) === 0) return '1.0.0';
  if (status === 'verified' || status === 'stale') return semver.inc(version, 'patch') ?? version;
  return version;
}

/**
 * Replace a top-level frontmatter key (and any indented lines that continue its value).
 * Everything else in the file stays byte-for-byte the same.
 */
export function setTopLevelKey(frontmatter: string, key: string, value: string): string {
  const lines = frontmatter.split('\n');
  const start = lines.findIndex((line) => line.startsWith(`${key}:`));
  if (start === -1) throw new PromoteError(`frontmatter has no top-level "${key}" field`);
  let end = start + 1;
  while (end < lines.length && /^\s+\S/.test(lines[end] ?? '')) end++;
  return [...lines.slice(0, start), `${key}: ${value}`, ...lines.slice(end)].join('\n');
}

function readString(data: Record<string, unknown>, key: string): string {
  const value = data[key];
  if (typeof value !== 'string') throw new PromoteError(`frontmatter "${key}" must be a string`);
  return value;
}

/** Set a card to verified: status, last_verified, reviewers, review_level and card_version. */
export function promoteCard(raw: string, options: PromoteOptions): PromoteResult {
  const level = REVIEW_LEVELS.find((item) => item === options.level) as ReviewLevel | undefined;
  if (!level) throw new PromoteError(`--level must be one of: ${REVIEW_LEVELS.join(', ')}`);
  const reviewers = [...new Set(options.reviewers.map((handle) => handle.trim()).filter(Boolean))];
  const invalid = reviewers.filter((handle) => !GITHUB_HANDLE_PATTERN.test(handle));
  if (invalid.length > 0) throw new PromoteError(`Not GitHub handles: ${invalid.join(', ')}`);
  if (reviewers.length < MIN_REVIEWERS[level]) {
    throw new PromoteError(`--level ${level} needs at least ${MIN_REVIEWERS[level]} reviewer(s)`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(options.date)) throw new PromoteError('date must be YYYY-MM-DD');

  const text = normaliseText(raw);
  const card = parseCard(text, 'card.md');
  if (card.parseErrors.length > 0 || typeof card.frontmatter !== 'object' || !card.frontmatter) {
    throw new PromoteError('The card frontmatter does not parse; run pnpm validate first');
  }
  const data = card.frontmatter as Record<string, unknown>;
  const fromStatus = readString(data, 'status');
  const fromVersion = readString(data, 'card_version');
  const toVersion = nextCardVersion(fromVersion, fromStatus);

  const match = /^---\n([\s\S]*?)\n---/.exec(text);
  if (!match?.[1]) throw new PromoteError('Missing frontmatter');
  let frontmatter = match[1];
  frontmatter = setTopLevelKey(frontmatter, 'status', 'verified');
  frontmatter = setTopLevelKey(frontmatter, 'card_version', toVersion);
  frontmatter = setTopLevelKey(frontmatter, 'last_verified', options.date);
  frontmatter = setTopLevelKey(frontmatter, 'review_level', level);
  frontmatter = setTopLevelKey(frontmatter, 'reviewers', `[${reviewers.join(', ')}]`);

  return {
    text: `---\n${frontmatter}\n---${text.slice(match[0].length)}`,
    fromStatus,
    fromVersion,
    toVersion,
  };
}
