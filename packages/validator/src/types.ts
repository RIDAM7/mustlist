import type { CardFrontmatter, FrontmatterIssue, ParsedCard } from '@mustlist/schema';

export const RULE_IDS = [
  'schema',
  'id-path',
  'slug',
  'sections',
  'lens-sections',
  'size',
  'refs',
  'related',
  'versions',
  'safety-code',
  'safety-text',
  'safety-links',
  'secrets',
  'reviewer-notes',
  'status-guard',
  'duplicate',
  'links',
] as const;

export type RuleId = (typeof RULE_IDS)[number];
export type Severity = 'error' | 'warning';

export interface Diagnostic {
  file: string;
  line: number;
  rule: RuleId;
  severity: Severity;
  message: string;
}

/** A card file to validate. `filePath` decides the expected id (`cards/<topic>/<stack>.md`). */
export interface CardInput {
  filePath: string;
  text: string;
}

/** Everything the rules need to know about one card. */
export interface CardContext {
  card: ParsedCard;
  /** Typed frontmatter when it passed the schema; otherwise `undefined`. */
  data: CardFrontmatter | undefined;
  /** Schema issues, each tagged with the rule it belongs to. */
  issues: FrontmatterIssue[];
}

/** All cards in the project, for rules that look across cards. */
export interface ProjectContext {
  cards: readonly CardContext[];
  knownIds: ReadonlySet<string>;
}

export interface Rule {
  id: RuleId;
  description: string;
  check: (card: CardContext, project: ProjectContext) => Diagnostic[];
}
