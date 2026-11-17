import semver from 'semver';
import type { CardFrontmatter } from '@mustlist/schema';
import type { Diagnostic } from '../types';

/**
 * status-guard: who may change what in a pull request (docs/card-spec.md, "Status guard").
 *
 * It compares the pull request's version of a card with the base branch, so it
 * runs in the trusted pull-request workflow (`scripts/pr-checks.ts`) rather than
 * in `pnpm validate`:
 * - only maintainers may set `status: verified` or `status: stale`, or change
 *   `reviewers`, `review_level` and `last_verified`. A change counts as a
 *   maintainer's when the PR author is a maintainer or a maintainer accepted
 *   the proposal (the `accepted` label, added by a maintainer);
 * - every listed reviewer approved the pull request (a maintainer author counts
 *   for themselves, since GitHub doesn't let people approve their own PR), and at
 *   least one reviewer is a maintainer;
 * - `card_version` must increase when the card's content changes.
 */
export interface StatusGuardInput {
  filePath: string;
  /** The card on the base branch; `undefined` for a new card. */
  before: CardFrontmatter | undefined;
  /** The card in the pull request; `undefined` when the PR deletes it. */
  after: CardFrontmatter | undefined;
  /** GitHub handle of the pull request author. */
  author: string;
  /** Handles from the MAINTAINERS file. */
  maintainers: readonly string[];
  /** Handles whose latest review approves the pull request. */
  approvers: readonly string[];
  /** Handle of the maintainer who added the `accepted` label, if one did. */
  acceptedBy: string | undefined;
  /** True when anything other than `card_version` and the maintainer-only fields changed. */
  contentChanged: boolean;
  /** 1-based line of a frontmatter key in the PR's card, for annotations. */
  lineOf?: (key: string) => number;
}

/** Fields only maintainers may change. */
export const MAINTAINER_FIELDS = ['reviewers', 'review_level', 'last_verified'] as const;
const MAINTAINER_STATUSES = new Set(['verified', 'stale']);

const sameHandle = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
const includesHandle = (list: readonly string[], handle: string) =>
  list.some((item) => sameHandle(item, handle));

function sameValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

/** The maintainer-only changes between two versions of a card, as short descriptions. */
export function maintainerChanges(
  before: CardFrontmatter | undefined,
  after: CardFrontmatter | undefined,
): string[] {
  const changes: string[] = [];
  const fromStatus = before?.status;
  const toStatus = after?.status;
  if (!after) {
    if (fromStatus && MAINTAINER_STATUSES.has(fromStatus))
      changes.push(`deletes a ${fromStatus} card`);
    return changes;
  }
  if (toStatus !== fromStatus && toStatus && MAINTAINER_STATUSES.has(toStatus)) {
    changes.push(`sets status: ${toStatus}`);
  }
  const record = (card: CardFrontmatter | undefined) =>
    (card ?? {}) as unknown as Record<string, unknown>;
  for (const field of MAINTAINER_FIELDS) {
    if (!sameValue(record(before)[field], record(after)[field])) changes.push(`changes ${field}`);
  }
  return changes;
}

export function checkStatusGuard(input: StatusGuardInput): Diagnostic[] {
  const { filePath, before, after, author, maintainers } = input;
  const line = (key: string) => input.lineOf?.(key) ?? 1;
  const diagnostics: Diagnostic[] = [];
  const error = (key: string, message: string) =>
    diagnostics.push({
      file: filePath,
      line: line(key),
      rule: 'status-guard',
      severity: 'error',
      message,
    });

  const authorIsMaintainer = includesHandle(maintainers, author);
  const acceptedBy =
    input.acceptedBy && includesHandle(maintainers, input.acceptedBy)
      ? input.acceptedBy
      : undefined;

  const changes = maintainerChanges(before, after);
  if (changes.length > 0 && !authorIsMaintainer && !acceptedBy) {
    error(
      'status',
      `Only maintainers can do this: the pull request ${changes.join(', ')}. Leave these fields as they are; a maintainer sets them when accepting the card.`,
    );
  }

  if (after && after.status === 'verified' && changes.length > 0) {
    const reviewers = after.reviewers ?? [];
    const missing = reviewers.filter(
      (handle) =>
        !includesHandle(input.approvers, handle) &&
        !(authorIsMaintainer && sameHandle(handle, author)),
    );
    if (missing.length > 0) {
      error(
        'reviewers',
        `Every reviewer must approve the pull request; no approval from: ${missing.join(', ')}.`,
      );
    }
    if (!reviewers.some((handle) => includesHandle(maintainers, handle))) {
      error('reviewers', 'At least one reviewer of a verified card must be a maintainer.');
    }
  }

  if (before && after && input.contentChanged) {
    const from = before.card_version;
    const to = after.card_version;
    if (semver.valid(from) && semver.valid(to) && !semver.gt(to, from)) {
      error(
        'card_version',
        `The card's content changed, so card_version must increase (it is ${to}; the base has ${from}).`,
      );
    }
  }
  return diagnostics;
}
