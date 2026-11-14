import semver from 'semver';
import { z } from 'zod';
import {
  AMBIGUOUS_YAML_IDS,
  CARD_ID_PATTERN,
  CHECKLIST_LEVELS,
  CONTEXT7_URL_PREFIX,
  COUNT_LIMITS,
  GITHUB_HANDLE_PATTERN,
  LENSES,
  MIN_REVIEWERS,
  MIN_SOURCES,
  MIN_VERSIONS,
  OFFICIAL_DOCS_DOMAINS,
  PACKAGE_NAME_PATTERN,
  RESERVED_SLUGS,
  REVIEW_LEVELS,
  SIZE_LIMITS,
  SLUG_PATTERN,
  STATUSES,
  TEXT_LIMITS,
  VERIFY_TYPES,
  isOfficialDocsUrl,
} from './constants';

/**
 * Which validator rule an issue belongs to. Most issues are plain `schema` issues;
 * cross-field and rule-specific checks carry their rule id in `params.rule`.
 */
export type SchemaRuleId = 'schema' | 'slug' | 'size' | 'refs' | 'versions';

type IssueCtx = z.core.$RefinementCtx;

function report(ctx: IssueCtx, rule: SchemaRuleId, path: PropertyKey[], message: string): void {
  ctx.addIssue({ code: 'custom', message, path, params: { rule } });
}

function describe(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'string') return `"${value}"`;
  return `${typeof value} ${JSON.stringify(value)}`;
}

/** A required string with a clear message for missing values and YAML booleans or numbers. */
function requiredString(label: string) {
  return z.string({
    error: (issue) =>
      issue.input === undefined
        ? `${label} is required`
        : `${label} must be a string, got ${describe(issue.input)}`,
  });
}

function text(label: string, max: number, min = 1) {
  return requiredString(label)
    .min(min, `${label} must have at least ${min} characters`)
    .max(max, `${label} must have at most ${max} characters`);
}

/**
 * An item id (checklist, decision, option, verify). YAML can turn unquoted
 * `yes`/`no`/`on`/`off`/`true`/`false` into booleans and bare digits into numbers,
 * so non-string ids get a message that explains why.
 */
export function itemIdSchema(label: string) {
  return z
    .string({
      error: (issue) =>
        issue.input === undefined
          ? `${label} is required`
          : `${label} must be a string, got ${describe(issue.input)}. ` +
            'YAML reads unquoted yes/no/on/off/true/false as booleans and bare numbers as numbers: ' +
            'use a descriptive kebab-case id such as "needed" or "not-needed"',
    })
    .max(TEXT_LIMITS.itemId, `${label} must have at most ${TEXT_LIMITS.itemId} characters`)
    .regex(SLUG_PATTERN, `${label} must be kebab-case (lowercase letters, digits, single hyphens)`)
    .refine((value) => !AMBIGUOUS_YAML_IDS.includes(value), {
      error: (issue) =>
        `${label} ${describe(issue.input)} is read as a boolean or null by many YAML tools: ` +
        'use a descriptive id such as "needed" or "not-needed"',
    });
}

const slugMessage = `must be lowercase kebab-case, ${TEXT_LIMITS.slugMin}-${TEXT_LIMITS.slugMax} characters`;

/** True for a valid topic/stack slug. */
export function isSlug(value: string): boolean {
  return (
    value.length >= TEXT_LIMITS.slugMin &&
    value.length <= TEXT_LIMITS.slugMax &&
    SLUG_PATTERN.test(value)
  );
}

export function isReservedSlug(value: string): boolean {
  return (RESERVED_SLUGS as readonly string[]).includes(value);
}

/** True for an exact semver version such as `1.2.3` (no `v` prefix, no range). */
export function isExactSemver(value: string): boolean {
  return semver.valid(value) === value;
}

function isParsableUrl(value: string): boolean {
  return URL.canParse(value);
}

const handle = (label: string) =>
  requiredString(label).regex(GITHUB_HANDLE_PATTERN, `${label} must be a GitHub handle`);

const urlString = (label: string) =>
  requiredString(label).refine(isParsableUrl, `${label} must be an absolute URL`);

function listOf<T extends z.ZodType>(
  item: T,
  label: string,
  [min, max]: readonly [number, number],
) {
  return z
    .array(item, { error: `${label} must be a list` })
    .min(min, `${label} needs at least ${min} item${min === 1 ? '' : 's'}`)
    .max(max, `${label} allows at most ${max} items`);
}

const stringList = (label: string, minItems: number, maxLength: number = TEXT_LIMITS.listItem) =>
  z
    .array(text(`${label} entry`, maxLength), { error: `${label} must be a list` })
    .min(minItems, `${label} needs at least ${minItems} item${minItems === 1 ? '' : 's'}`);

export const ChecklistItemSchema = z.strictObject({
  id: itemIdSchema('checklist id'),
  lens: z.enum(LENSES),
  level: z.enum(CHECKLIST_LEVELS),
  text: text('checklist text', TEXT_LIMITS.checklistText),
  why: text('checklist why', TEXT_LIMITS.checklistWhy).optional(),
});

export const DecisionOptionSchema = z.strictObject({
  id: itemIdSchema('decision option id'),
  label: text('decision option label', TEXT_LIMITS.label),
  points_to: itemIdSchema('points_to').optional(),
});

export const DecisionSchema = z.strictObject({
  id: itemIdSchema('decision id'),
  question: text('decision question', TEXT_LIMITS.question),
  options: listOf(DecisionOptionSchema, 'decision options', COUNT_LIMITS.decisionOptions),
  default: itemIdSchema('decision default').optional(),
});

export const OptionSchema = z.strictObject({
  id: itemIdSchema('option id'),
  name: text('option name', TEXT_LIMITS.optionName),
  examples: stringList('examples', 1).optional(),
  best_fit_when: stringList('best_fit_when', 1),
  avoid_when: stringList('avoid_when', 1),
  tradeoffs: stringList('tradeoffs', 1),
});

export const VersionEntrySchema = z.strictObject({
  package: requiredString('package').regex(PACKAGE_NAME_PATTERN, 'package must be a package name'),
  range: requiredString('range').refine((value) => semver.validRange(value) !== null, {
    error: (issue) => `range ${describe(issue.input)} is not a valid semver range`,
    params: { rule: 'versions' },
  }),
  notes: listOf(text('version note', TEXT_LIMITS.versionNote), 'notes', COUNT_LIMITS.versionNotes),
  docs: urlString('docs').refine((value) => isOfficialDocsUrl(value), {
    error: (issue) =>
      `docs ${describe(issue.input)} is not on the official docs allowlist ` +
      `(${OFFICIAL_DOCS_DOMAINS.join(', ')}). If the domain is official, add it to ` +
      'packages/schema/src/config/official-docs-domains.ts in the same pull request',
    params: { rule: 'versions' },
  }),
  context7: requiredString('context7')
    .refine((value) => value.startsWith(CONTEXT7_URL_PREFIX), {
      error: `context7 must start with ${CONTEXT7_URL_PREFIX}`,
      params: { rule: 'versions' },
    })
    .optional(),
});

export const VerifyCheckSchema = z.strictObject({
  id: itemIdSchema('verify id'),
  lens: z.enum(LENSES),
  type: z.enum(VERIFY_TYPES),
  check: text('verify check', TEXT_LIMITS.verifyCheck),
});

export const SourceSchema = z.strictObject({
  title: text('source title', TEXT_LIMITS.sourceTitle),
  url: urlString('source url'),
});

/** Ranges for the same package must not overlap. */
function checkVersionOverlaps(entries: readonly VersionEntry[], ctx: IssueCtx): void {
  entries.forEach((entry, index) => {
    if (semver.validRange(entry.range) === null) return;
    for (let earlier = 0; earlier < index; earlier++) {
      const other = entries[earlier];
      if (!other || other.package !== entry.package) continue;
      if (semver.validRange(other.range) === null) continue;
      if (semver.intersects(entry.range, other.range)) {
        report(
          ctx,
          'versions',
          [index, 'range'],
          `range "${entry.range}" overlaps "${other.range}" for package ${entry.package}`,
        );
      }
    }
  });
}

function checkSummary(summary: string, ctx: IssueCtx): void {
  if (summary.length > SIZE_LIMITS.summaryChars) {
    report(
      ctx,
      'size',
      [],
      `summary has ${summary.length} characters; the limit is ${SIZE_LIMITS.summaryChars}`,
    );
  }
  if (/[\r\n]/.test(summary)) {
    report(ctx, 'schema', [], 'summary must be a single paragraph (use `>-` in YAML)');
  }
  if (/<[a-z!/]/i.test(summary) || /\]\(/.test(summary)) {
    report(ctx, 'schema', [], 'summary must be plain text: no HTML or markdown links');
  }
}

function findDuplicates(ids: readonly string[]): Map<string, number[]> {
  const positions = new Map<string, number[]>();
  ids.forEach((id, index) => positions.set(id, [...(positions.get(id) ?? []), index]));
  return new Map([...positions].filter(([, indexes]) => indexes.length > 1));
}

function reportDuplicateIds(
  ctx: IssueCtx,
  items: readonly { id: string }[],
  basePath: PropertyKey[],
  label: string,
): void {
  for (const [id, indexes] of findDuplicates(items.map((item) => item.id))) {
    for (const index of indexes.slice(1)) {
      report(ctx, 'refs', [...basePath, index, 'id'], `duplicate ${label} id "${id}"`);
    }
  }
}

/** Cross-field rules that need the whole frontmatter. */
function checkCrossFields(card: CardFrontmatter, ctx: IssueCtx): void {
  reportDuplicateIds(ctx, card.checklist, ['checklist'], 'checklist');
  reportDuplicateIds(ctx, card.decisions, ['decisions'], 'decision');
  reportDuplicateIds(ctx, card.options, ['options'], 'option');
  reportDuplicateIds(ctx, card.verify, ['verify'], 'verify');

  const optionIds = new Set(card.options.map((option) => option.id));
  if (!optionIds.has(card.recommended)) {
    report(
      ctx,
      'refs',
      ['recommended'],
      `recommended "${card.recommended}" is not an option id (${[...optionIds].join(', ')})`,
    );
  }

  card.decisions.forEach((decision, decisionIndex) => {
    const path = ['decisions', decisionIndex];
    reportDuplicateIds(ctx, decision.options, [...path, 'options'], 'decision option');
    const answerIds = new Set(decision.options.map((option) => option.id));
    if (decision.default !== undefined && !answerIds.has(decision.default)) {
      report(
        ctx,
        'refs',
        [...path, 'default'],
        `default "${decision.default}" is not one of this decision's option ids`,
      );
    }
    decision.options.forEach((answer, answerIndex) => {
      if (answer.points_to !== undefined && !optionIds.has(answer.points_to)) {
        report(
          ctx,
          'refs',
          [...path, 'options', answerIndex, 'points_to'],
          `points_to "${answer.points_to}" is not an option id`,
        );
      }
    });
  });

  const duplicateLenses = findDuplicates(card.lenses);
  for (const lens of duplicateLenses.keys()) {
    report(ctx, 'schema', ['lenses'], `lens "${lens}" is listed more than once`);
  }

  const isReviewed = card.status === 'verified' || card.status === 'stale';
  if (isReviewed && card.last_verified === null) {
    report(
      ctx,
      'schema',
      ['last_verified'],
      `last_verified is required when status is ${card.status}`,
    );
  }
  if (isReviewed && card.review_level === null) {
    report(
      ctx,
      'schema',
      ['review_level'],
      `review_level is required when status is ${card.status}`,
    );
  }
  if (card.review_level !== null) {
    const needed = MIN_REVIEWERS[card.review_level];
    if (card.reviewers.length < needed) {
      report(
        ctx,
        'schema',
        ['reviewers'],
        `review_level ${card.review_level} needs at least ${needed} reviewer${needed === 1 ? '' : 's'}`,
      );
    }
  }
}

/** Field-level schema. `CardFrontmatterSchema` adds the cross-field rules on top. */
export const CardFrontmatterObjectSchema = z.strictObject({
  id: requiredString('id').regex(
    CARD_ID_PATTERN,
    'id must look like "<topic>/<stack>", for example "auth/nextjs-postgres"',
  ),
  title: text('title', TEXT_LIMITS.titleMax, TEXT_LIMITS.titleMin),
  topic: requiredString('topic')
    .refine(isSlug, { error: `topic ${slugMessage}`, params: { rule: 'slug' } })
    .refine((value) => !isReservedSlug(value), {
      error: (issue) => `topic ${describe(issue.input)} is reserved by the site and cannot be used`,
      params: { rule: 'slug' },
    }),
  stack: listOf(
    requiredString('stack entry').regex(SLUG_PATTERN, 'stack entries must be kebab-case slugs'),
    'stack',
    COUNT_LIMITS.stack,
  ),
  summary: text('summary', Number.MAX_SAFE_INTEGER).superRefine(checkSummary),
  status: z.enum(STATUSES),
  card_version: requiredString('card_version').refine(
    isExactSemver,
    'card_version must be a semver version such as 0.1.0',
  ),
  last_verified: z.iso
    .date({ error: 'last_verified must be a date such as 2026-11-12, or null' })
    .nullable(),
  review_level: z.enum(REVIEW_LEVELS).nullable(),
  authors: z.array(handle('author')).min(1, 'authors needs at least one GitHub handle'),
  reviewers: z.array(handle('reviewer')),
  lenses: z.array(z.enum(LENSES)).min(1, 'lenses needs at least one lens'),
  applies_when: z.strictObject({
    app_types: stringList('app_types', 1, TEXT_LIMITS.label),
    not_for: stringList('not_for', 0, TEXT_LIMITS.label),
  }),
  related: z
    .array(
      requiredString('related id').regex(
        CARD_ID_PATTERN,
        'related ids look like "<topic>/<stack>"',
      ),
    )
    .default([]),
  checklist: listOf(ChecklistItemSchema, 'checklist', COUNT_LIMITS.checklist),
  decisions: listOf(DecisionSchema, 'decisions', COUNT_LIMITS.decisions),
  options: listOf(OptionSchema, 'options', COUNT_LIMITS.options),
  recommended: itemIdSchema('recommended'),
  versions: z
    .array(VersionEntrySchema)
    .min(MIN_VERSIONS, `versions needs at least ${MIN_VERSIONS} entry`)
    .superRefine(checkVersionOverlaps),
  verify: listOf(VerifyCheckSchema, 'verify', COUNT_LIMITS.verify),
  sources: z.array(SourceSchema).min(MIN_SOURCES, `sources needs at least ${MIN_SOURCES} entries`),
});

export type ChecklistItem = z.output<typeof ChecklistItemSchema>;
export type DecisionOption = z.output<typeof DecisionOptionSchema>;
export type Decision = z.output<typeof DecisionSchema>;
export type Option = z.output<typeof OptionSchema>;
export type VersionEntry = z.output<typeof VersionEntrySchema>;
export type VerifyCheck = z.output<typeof VerifyCheckSchema>;
export type Source = z.output<typeof SourceSchema>;
export type CardFrontmatter = z.output<typeof CardFrontmatterObjectSchema>;

/** The full frontmatter contract: field rules plus cross-field rules. */
export const CardFrontmatterSchema = CardFrontmatterObjectSchema.superRefine(checkCrossFields);

export interface FrontmatterIssue {
  rule: SchemaRuleId;
  path: PropertyKey[];
  message: string;
}

const SCHEMA_RULE_IDS: readonly SchemaRuleId[] = ['schema', 'slug', 'size', 'refs', 'versions'];

function ruleOf(issue: z.core.$ZodIssue): SchemaRuleId {
  const tag: unknown = issue.code === 'custom' ? issue.params?.['rule'] : undefined;
  return SCHEMA_RULE_IDS.find((rule) => rule === tag) ?? 'schema';
}

/** `['checklist', 2, 'text']` -> `checklist[2].text` */
export function formatPath(path: readonly PropertyKey[]): string {
  return path.reduce<string>((out, key) => {
    if (typeof key === 'number') return `${out}[${key}]`;
    const name = String(key);
    return out === '' ? name : `${out}.${name}`;
  }, '');
}

/** Validate parsed frontmatter. Returns the typed data when valid, plus every issue found. */
export function validateFrontmatter(data: unknown): {
  data: CardFrontmatter | undefined;
  issues: FrontmatterIssue[];
} {
  const result = CardFrontmatterSchema.safeParse(data);
  if (result.success) return { data: result.data, issues: [] };
  const issues = result.error.issues.map((issue) => {
    const where = formatPath(issue.path);
    return {
      rule: ruleOf(issue),
      path: issue.path,
      message:
        where === '' || issue.message.startsWith(where)
          ? issue.message
          : `${where}: ${issue.message}`,
    };
  });
  return { data: undefined, issues };
}
