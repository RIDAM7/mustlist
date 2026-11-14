import type { Rule } from '../types';
import { duplicateRule } from './duplicate';
import { refsRule, schemaRule, versionsRule } from './frontmatter-rules';
import { idPathRule } from './id-path';
import { lensSectionsRule } from './lens-sections';
import { relatedRule } from './related';
import { reviewerNotesRule } from './reviewer-notes';
import { safetyCodeRule } from './safety-code';
import { safetyLinksRule } from './safety-links';
import { safetyTextRule } from './safety-text';
import { secretsRule } from './secrets';
import { sectionsRule } from './sections';
import { sizeRule } from './size';
import { slugRule } from './slug';

/**
 * Rules run by `pnpm validate`. `links` runs only with `--links` (see links.ts),
 * and `status-guard` is not implemented yet (see status-guard.ts).
 */
export const DEFAULT_RULES: readonly Rule[] = [
  schemaRule,
  idPathRule,
  slugRule,
  sectionsRule,
  lensSectionsRule,
  sizeRule,
  refsRule,
  relatedRule,
  versionsRule,
  safetyCodeRule,
  safetyTextRule,
  safetyLinksRule,
  secretsRule,
  reviewerNotesRule,
  duplicateRule,
];

export {
  duplicateRule,
  idPathRule,
  lensSectionsRule,
  refsRule,
  relatedRule,
  reviewerNotesRule,
  safetyCodeRule,
  safetyLinksRule,
  safetyTextRule,
  schemaRule,
  secretsRule,
  sectionsRule,
  sizeRule,
  slugRule,
  versionsRule,
};
