import semver from 'semver';
import type { CardIndexEntry, CardJSON } from '@mustlist/schema/types';
import { cardMarkdownUrl } from '@mustlist/schema/site';
import { SITE_NAME, SITE_URL } from './site';
import { topicName } from './topics';

/** What "Copy for my agent" puts on the clipboard: a pointer line, then the card itself. */
export function agentMessage(
  card: Pick<CardJSON, 'id' | 'topic' | 'status'>,
  markdown: string,
): string {
  const note =
    card.status === 'verified'
      ? ''
      : card.status === 'stale'
        ? ' This card is being re-checked: confirm versions in the official docs.'
        : ' This card is not reviewed yet.';
  return (
    `Use this ${SITE_NAME} card (${cardMarkdownUrl(SITE_URL, card.id)}) as reference material ` +
    `before building ${topicName(card.topic).toLowerCase()}. Ask me its decisions first, ` +
    `then build the checklist and prove it with the verify checks.${note}\n\n${markdown.trim()}\n`
  );
}

/** "Community · 2", "Seed · 1", or "Not reviewed". */
export function reviewLabel(card: Pick<CardJSON, 'review_level' | 'reviewers'>): string {
  if (!card.review_level) return 'Not reviewed';
  const level = card.review_level === 'community' ? 'Community' : 'Seed';
  return `${level} · ${card.reviewers.length}`;
}

/** Packages whose next major version should trigger a re-check: `next@17`. */
export function nextMajors(card: Pick<CardJSON, 'versions'>): string[] {
  const highest = new Map<string, number>();
  for (const entry of card.versions) {
    const min = semver.minVersion(entry.range);
    if (!min) continue;
    const upper = /<\s*(\d+)\.0\.0/.exec(entry.range);
    const major = upper ? Number(upper[1]) : min.major + 1;
    highest.set(entry.package, Math.max(highest.get(entry.package) ?? 0, major));
  }
  return [...highest].map(([pkg, major]) => `${pkg}@${major}`);
}

export interface TocItem {
  id: string;
  label: string;
}

/** Sections in page order; empty optional sections are left out. */
export function tocItems(card: CardJSON): TocItem[] {
  const items: [string, string, boolean][] = [
    ['summary', 'Summary', true],
    ['checklist', 'Checklist', card.checklist.length > 0],
    ['decisions', 'Decisions', card.decisions.length > 0],
    ['options', 'Options', card.options.length > 0],
    ['why', 'Why this approach', Boolean(card.body.why)],
    ['lenses', 'Lenses', Object.values(card.body.lenses).some(Boolean)],
    ['versions', 'Version notes', card.versions.length > 0],
    ['verify', 'Verify checks', card.verify.length > 0],
    ['mistakes', 'Common mistakes', Boolean(card.body.mistakes)],
    ['sources', 'Sources', card.sources.length > 0],
    ['related', 'Related cards', card.related.length > 0],
  ];
  return items.filter(([, , show]) => show).map(([id, label]) => ({ id, label }));
}

/** Topic status for tiles: Verified if any card is, then Being re-checked, else Draft. */
export function topicStatus(cards: Pick<CardIndexEntry, 'status'>[]): CardIndexEntry['status'] {
  if (cards.some((card) => card.status === 'verified')) return 'verified';
  if (cards.some((card) => card.status === 'stale')) return 'stale';
  if (cards.some((card) => card.status === 'proposed')) return 'proposed';
  return 'draft';
}

/** `Authentication for a Next.js + Postgres app` -> `Authentication` */
export function shortTitle(title: string): string {
  return title.replace(/\s+for an?\s.+$/i, '').trim() || title;
}
