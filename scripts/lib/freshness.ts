/**
 * Pure helpers for the weekly freshness check (`scripts/freshness.ts`):
 * cards due for a re-check, and package majors that no card covers yet.
 */
import semver from 'semver';
import type { CardFrontmatter } from '@mustlist/schema';

/** A verified card is re-checked after this many days. */
export const RECHECK_AFTER_DAYS = 180;
/** An open re-check issue is overdue after this many days. */
export const OVERDUE_AFTER_DAYS = 30;

export const daysBetween = (from: string, to: Date) =>
  Math.floor((to.getTime() - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

/** Verified cards whose `last_verified` is older than RECHECK_AFTER_DAYS. */
export function dueForRecheck(cards: readonly CardFrontmatter[], today: Date): CardFrontmatter[] {
  return cards.filter(
    (card) =>
      card.status === 'verified' &&
      card.last_verified !== null &&
      daysBetween(card.last_verified, today) > RECHECK_AFTER_DAYS,
  );
}

export interface NewMajor {
  cardId: string;
  topic: string;
  pkg: string;
  latest: string;
  ranges: string[];
}

/**
 * Packages whose latest release is newer than every range a card covers, for
 * example `next` 17.0.0 against `>=16.0.0 <17.0.0`. Ranges with no upper bound
 * never match, so names that aren't npm packages (like `postgresql`) are safe.
 */
export function newMajors(
  cards: readonly CardFrontmatter[],
  latest: ReadonlyMap<string, string>,
): NewMajor[] {
  const found: NewMajor[] = [];
  for (const card of cards) {
    if (card.status !== 'verified') continue;
    const byPackage = new Map<string, string[]>();
    for (const entry of card.versions) {
      byPackage.set(entry.package, [...(byPackage.get(entry.package) ?? []), entry.range]);
    }
    for (const [pkg, ranges] of byPackage) {
      const version = latest.get(pkg);
      if (!version || !semver.valid(version) || semver.prerelease(version)) continue;
      const covered = ranges.some((range) => semver.satisfies(version, range));
      const aboveAll = ranges.every(
        (range) => semver.validRange(range) && semver.gtr(version, range),
      );
      if (!covered && aboveAll) {
        found.push({ cardId: card.id, topic: card.topic, pkg, latest: version, ranges });
      }
    }
  }
  return found;
}

export const recheckTitle = (id: string) => `Re-check: ${id}`;
export const majorTitle = (major: NewMajor) =>
  `New major version: ${major.pkg} ${semver.major(major.latest)} (${major.cardId})`;
export const LINKS_TITLE = 'Broken links in cards';
