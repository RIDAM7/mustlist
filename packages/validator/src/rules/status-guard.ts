import type { CardFrontmatter } from '@mustlist/schema';
import type { Diagnostic } from '../types';

/**
 * status-guard (not implemented yet).
 *
 * Compares a pull request's version of a card with the base branch:
 * - only maintainers may set `status: verified` or `status: stale`;
 * - only maintainers may change `reviewers`, `review_level` and `last_verified`;
 * - `card_version` must increase when the card's content changes.
 *
 * It needs the PR diff and the MAINTAINERS list, so it runs in a pull-request
 * workflow rather than in `pnpm validate`.
 *
 * TODO: implement `checkStatusGuard` and add it to the pull-request workflow.
 */
export interface StatusGuardInput {
  /** The card on the base branch; `undefined` for a new card. */
  before: CardFrontmatter | undefined;
  /** The card in the pull request. */
  after: CardFrontmatter;
  filePath: string;
  /** GitHub handle of the pull request author. */
  author: string;
  /** Handles from the MAINTAINERS file. */
  maintainers: readonly string[];
  /** True when anything other than `card_version` changed. */
  contentChanged: boolean;
}

export type StatusGuard = (input: StatusGuardInput) => Diagnostic[];
