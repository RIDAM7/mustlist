import { CardFrontmatterSchema } from '@mustlist/schema';
import {
  ALLOWED_CODE_LANGS,
  BLOCKED_CODE_LANGS,
  COUNT_LIMITS,
  LENS_TITLES,
  MIN_SOURCES,
  SIZE_LIMITS,
  TEXT_LIMITS,
} from '@mustlist/schema/constants';
import { pad2 } from '@/lib/format';
import { type Draft, toFrontmatter, usedLenses, wordCount } from './draft';

/**
 * Live checks for the editor. Format runs the real frontmatter schema (the same
 * zod rules the validator uses) plus the size and count limits; Safety and Links
 * mirror the validator's rules that can run in a browser. Link reachability is
 * checked by CI when the proposal is submitted.
 */

export const SECTIONS = [
  'Basics',
  'Checklist',
  'Decisions',
  'Options',
  'Lenses',
  'Versions',
  'Verify',
  'Sources',
] as const;
export type Section = (typeof SECTIONS)[number];

export type Level = 'err' | 'warn';
export type Group = 'format' | 'safety' | 'links';

export interface Problem {
  level: Level;
  group: Group;
  section: Section;
  where: string;
  what: string;
  /** Element id to focus, if any. */
  field?: string;
}

export interface CheckReport {
  problems: Problem[];
  errors: number;
  warnings: number;
  status: Record<Section, 'ok' | 'warn' | 'err'>;
  counts: Record<Section, string>;
  format: { ok: boolean; note: string };
  safety: { ok: boolean; note: string };
  links: { ok: boolean; note: string; total: number };
}

const LIST_SECTION: Record<string, Section> = {
  checklist: 'Checklist',
  decisions: 'Decisions',
  options: 'Options',
  recommended: 'Options',
  versions: 'Versions',
  verify: 'Verify',
  sources: 'Sources',
  lenses: 'Lenses',
};

const BASICS_LABEL: Record<string, string> = {
  id: 'Card id',
  title: 'Title',
  topic: 'Topic',
  stack: 'Technologies',
  summary: 'Summary',
  applies_when: 'App types',
  authors: 'Authors',
  related: 'Related',
};

const FIELD_LABEL: Record<string, string> = {
  id: 'Id',
  text: 'Text',
  why: 'Why',
  question: 'Question',
  label: 'Label',
  name: 'Name',
  examples: 'Examples',
  best_fit_when: 'Best fit when',
  avoid_when: 'Avoid when',
  tradeoffs: 'Trade-offs',
  package: 'Package',
  range: 'Range',
  notes: 'Notes',
  docs: 'Official docs',
  context7: 'Context7',
  check: 'Check',
  title: 'Title',
  url: 'URL',
  default: 'Default',
  points_to: 'Favours',
};

/** Counted lists whose count problems the editor reports in its own words. */
const COUNTED = new Set(['checklist', 'decisions', 'options', 'versions', 'verify', 'sources']);

function valueAt(data: unknown, path: readonly PropertyKey[]): unknown {
  return path.reduce<unknown>(
    (value, key) =>
      value !== null && typeof value === 'object'
        ? (value as Record<PropertyKey, unknown>)[key]
        : undefined,
    data,
  );
}

function where(path: readonly PropertyKey[]): { section: Section; where: string } {
  const [head, index, , answerIndex] = path;
  const top = String(head ?? '');
  const section = LIST_SECTION[top] ?? 'Basics';
  if (section === 'Basics') return { section, where: BASICS_LABEL[top] ?? 'Basics' };
  if (typeof index !== 'number') return { section, where: section };
  const n = pad2(index + 1);
  switch (top) {
    case 'checklist':
      return { section, where: `Checklist ${n}` };
    case 'decisions':
      return {
        section,
        where:
          typeof answerIndex === 'number'
            ? `Decision ${n} · answer ${answerIndex + 1}`
            : `Decision ${n}`,
      };
    case 'options':
      return { section, where: `Option ${index + 1}` };
    case 'versions':
      return { section, where: `Version ${index + 1}` };
    case 'verify':
      return { section, where: `Verify ${n}` };
    case 'sources':
      return { section, where: `Source ${index + 1}` };
    default:
      return { section, where: section };
  }
}

/** Element id for a frontmatter path (the editor uses the same scheme). */
export function fieldId(path: readonly PropertyKey[]): string {
  const [head] = path;
  if (head === 'id') return 'f-topic';
  if (head === 'applies_when') return `f-applies_when-${String(path[1] ?? 'app_types')}`;
  if (path.length === 1 && COUNTED.has(String(head))) return `f-add-${String(head)}`;
  if (head === 'recommended') return 'f-options-0-name';
  if (head === 'lenses') return 'f-why';
  return `f-${path.map(String).join('-')}`;
}

function friendly(message: string, value: unknown, path: readonly PropertyKey[]): string {
  const field = FIELD_LABEL[String(path.at(-1))] ?? '';
  if (/at least 1 character/.test(message) || /is required$/.test(message)) {
    return field ? `${field} is empty` : 'Empty';
  }
  const max = message.match(/at most (\d+) characters/);
  if (max && typeof value === 'string')
    return `${field ? `${field}: ` : ''}${value.length} / ${max[1]} characters`;
  if (/is not on the official docs allowlist/.test(message))
    return 'Docs link is not on the allowlist';
  if (/must start with https:\/\/context7\.com\//.test(message))
    return 'Context7 link must start with https://context7.com/';
  if (/must be an absolute URL/.test(message)) return `${field || 'Link'} is not a full URL`;
  if (/must be kebab-case/.test(message)) return `${field || 'Id'} must be kebab-case`;
  if (/read as a boolean or null/.test(message))
    return `${field || 'Id'} reads as yes/no in YAML; choose another`;
  if (/^recommended /.test(message)) return 'Pick a recommended option';
  // Strip the schema's own field prefix ("checklist text must…" -> "must…").
  return message
    .replace(/^[a-z_ ]+? (must|needs|allows)/, (_, verb: string) => verb)
    .replace(/^\w/, (c) => c.toUpperCase());
}

const linkGroup = (path: readonly PropertyKey[]): boolean => {
  const last = String(path.at(-1));
  return last === 'docs' || last === 'context7' || (path[0] === 'sources' && last === 'url');
};

function countProblem(
  count: number,
  [min, max]: readonly [number, number],
  noun: [string, string],
  section: Section,
  field: string,
  whereLabel: string = section,
): Problem | null {
  const label = `${count} ${count === 1 ? noun[0] : noun[1]}`;
  if (count < min)
    return {
      level: 'err',
      group: 'format',
      section,
      where: whereLabel,
      what: `${label} · needs at least ${min}`,
      field,
    };
  if (count > max)
    return {
      level: 'err',
      group: 'format',
      section,
      where: whereLabel,
      what: `${label} · at most ${max}`,
      field,
    };
  return null;
}

/* ── Safety (browser copy of the validator's text rules) ── */

const BLOCKED_TEXT: readonly RegExp[] = [
  /\b(?:ignore|disregard|forget|override)\s+(?:all\s+|any\s+|the\s+)?(?:previous|prior|above|earlier|preceding|other|your)\s+(?:instructions|prompts?|rules|directions|messages)\b/i,
  /\bsystem\s+prompt\b/i,
  /\byou\s+must\s+(?:now\s+)?(?:run|execute|install|download)\b/i,
  /\bexecute\s+the\s+following\b/i,
  /\b(?:download|fetch)\s+(?:and|&|then)\s+(?:run|execute|install|open)\b/i,
  /\b(?:curl|wget)\b[^\n|]{0,200}\|\s*(?:sudo\s+)?(?:sh|bash|zsh|python3?|node)\b/i,
  /\bbase64\s+(?:-d|-D|--decode)\b/i,
];

const INVISIBLE = /[​-‏‪-‮⁠-⁤⁦-⁩﻿]/;

function safetyProblems(
  texts: { section: Section; where: string; field: string; text: string }[],
): Problem[] {
  const problems: Problem[] = [];
  const add = (t: (typeof texts)[number], what: string) =>
    problems.push({
      level: 'err',
      group: 'safety',
      section: t.section,
      where: t.where,
      what,
      field: t.field,
    });

  for (const t of texts) {
    if (!t.text) continue;
    if (/<\/?[a-z][^>]*>|<!--/i.test(t.text.replace(/`[^`]*`/g, ''))) add(t, 'No raw HTML');
    if (BLOCKED_TEXT.some((pattern) => pattern.test(t.text))) add(t, 'Text addresses the agent');
    if (INVISIBLE.test(t.text)) add(t, 'Hidden characters');
    if (/\bhttp:\/\//i.test(t.text)) add(t, 'Links must use https');
    for (const fence of t.text.matchAll(/```([^\n`]*)\n([\s\S]*?)(?:```|$)/g)) {
      const lang = (fence[1] ?? '').trim().toLowerCase();
      const lines = (fence[2] ?? '').replace(/\n$/, '').split('\n').length;
      if ((BLOCKED_CODE_LANGS as readonly string[]).includes(lang))
        add(t, 'Shell code blocks are not allowed');
      else if (!(ALLOWED_CODE_LANGS as readonly string[]).includes(lang)) {
        add(t, `Code language: ${ALLOWED_CODE_LANGS.join(', ')}`);
      }
      if (lines > SIZE_LIMITS.codeBlockLines)
        add(t, `Code block: ${lines} / ${SIZE_LIMITS.codeBlockLines} lines`);
    }
  }
  return problems;
}

/* ── The report ─────────────────────────────────────────── */

export function runChecks(draft: Draft): CheckReport {
  const frontmatter = toFrontmatter(draft);
  const problems: Problem[] = [];

  // 1. Schema (format + links).
  const parsed = CardFrontmatterSchema.safeParse(frontmatter);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const path = issue.path;
      const top = String(path[0] ?? '');
      if (
        path.length === 1 &&
        COUNTED.has(top) &&
        /needs at least|allows at most/.test(issue.message)
      )
        continue;
      if (top === 'lenses' && /needs at least one lens/.test(issue.message)) continue;
      if (
        top === 'status' ||
        top === 'card_version' ||
        top === 'last_verified' ||
        top === 'review_level' ||
        top === 'reviewers'
      )
        continue;
      const loc = where(path);
      problems.push({
        level: 'err',
        group: linkGroup(path) ? 'links' : 'format',
        section: loc.section,
        where: loc.where,
        what: friendly(issue.message, valueAt(frontmatter, path), path),
        field: fieldId(path),
      });
    }
  }

  // 2. Counts, in the editor's words.
  const counted: (Problem | null)[] = [
    countProblem(
      draft.checklist.length,
      COUNT_LIMITS.checklist,
      ['item', 'items'],
      'Checklist',
      'f-add-checklist',
    ),
    countProblem(
      draft.decisions.length,
      COUNT_LIMITS.decisions,
      ['decision', 'decisions'],
      'Decisions',
      'f-add-decisions',
    ),
    ...draft.decisions.map((decision, index) =>
      countProblem(
        decision.answers.length,
        COUNT_LIMITS.decisionOptions,
        ['answer', 'answers'],
        'Decisions',
        `f-add-answer-${index}`,
        `Decision ${pad2(index + 1)}`,
      ),
    ),
    countProblem(
      draft.options.length,
      COUNT_LIMITS.options,
      ['option', 'options'],
      'Options',
      'f-add-options',
    ),
    countProblem(
      draft.versions.length,
      [1, 99],
      ['entry', 'entries'],
      'Versions',
      'f-add-versions',
    ),
    ...draft.versions.map((entry, index) =>
      countProblem(
        entry.notes.filter((n) => n.trim()).length,
        COUNT_LIMITS.versionNotes,
        ['note', 'notes'],
        'Versions',
        `f-versions-${index}-notes-0`,
        `Version ${index + 1}`,
      ),
    ),
    countProblem(
      draft.verify.length,
      COUNT_LIMITS.verify,
      ['check', 'checks'],
      'Verify',
      'f-add-verify',
    ),
    countProblem(
      draft.sources.length,
      [MIN_SOURCES, 99],
      ['source', 'sources'],
      'Sources',
      'f-add-sources',
    ),
    countProblem(
      draft.mistakes.filter((m) => m.trim()).length,
      COUNT_LIMITS.mistakes,
      ['mistake', 'mistakes'],
      'Lenses',
      'f-mistakes-0',
      'Common mistakes',
    ),
  ];
  problems.push(...counted.filter((p): p is Problem => p !== null));

  // 3. Near-limit warnings and body rules.
  draft.checklist.forEach((item, index) => {
    const len = item.text.trim().length;
    if (
      len >= TEXT_LIMITS.checklistText * SIZE_LIMITS.warnRatio &&
      len <= TEXT_LIMITS.checklistText
    ) {
      problems.push({
        level: 'warn',
        group: 'format',
        section: 'Checklist',
        where: `Checklist ${pad2(index + 1)}`,
        what: `${len} / ${TEXT_LIMITS.checklistText} characters`,
        field: `f-checklist-${index}-text`,
      });
    }
  });
  const summaryLen = draft.summary.trim().length;
  if (
    summaryLen >= SIZE_LIMITS.summaryChars * SIZE_LIMITS.warnRatio &&
    summaryLen <= SIZE_LIMITS.summaryChars
  ) {
    problems.push({
      level: 'warn',
      group: 'format',
      section: 'Basics',
      where: 'Summary',
      what: `${summaryLen} / ${SIZE_LIMITS.summaryChars} characters`,
      field: 'f-summary',
    });
  }
  if (!draft.why.trim()) {
    problems.push({
      level: 'err',
      group: 'format',
      section: 'Lenses',
      where: 'Why this approach',
      what: 'Empty',
      field: 'f-why',
    });
  }
  for (const lens of usedLenses(draft)) {
    const words = wordCount(draft.lenses[lens]);
    const field = `f-lens-${lens}`;
    if (words === 0) {
      problems.push({
        level: 'warn',
        group: 'format',
        section: 'Lenses',
        where: 'Lenses',
        what: `${LENS_TITLES[lens]} is listed but has no section`,
        field,
      });
    } else if (words > SIZE_LIMITS.lensWords) {
      problems.push({
        level: 'err',
        group: 'format',
        section: 'Lenses',
        where: LENS_TITLES[lens],
        what: `${words} / ${SIZE_LIMITS.lensWords} words`,
        field,
      });
    } else if (words >= SIZE_LIMITS.lensWords * SIZE_LIMITS.warnRatio) {
      problems.push({
        level: 'warn',
        group: 'format',
        section: 'Lenses',
        where: LENS_TITLES[lens],
        what: `${words} / ${SIZE_LIMITS.lensWords} words`,
        field,
      });
    }
  }
  const bodyWords =
    wordCount(draft.why) +
    usedLenses(draft).reduce((sum, lens) => sum + wordCount(draft.lenses[lens]), 0) +
    draft.mistakes.reduce((sum, line) => sum + wordCount(line), 0);
  if (bodyWords > SIZE_LIMITS.bodyWords) {
    problems.push({
      level: 'err',
      group: 'format',
      section: 'Lenses',
      where: 'Body',
      what: `${bodyWords} / ${SIZE_LIMITS.bodyWords} words`,
      field: 'f-why',
    });
  }

  // 4. Safety over every text field.
  problems.push(
    ...safetyProblems([
      { section: 'Basics', where: 'Summary', field: 'f-summary', text: draft.summary },
      { section: 'Lenses', where: 'Why this approach', field: 'f-why', text: draft.why },
      ...usedLenses(draft).map((lens) => ({
        section: 'Lenses' as const,
        where: LENS_TITLES[lens],
        field: `f-lens-${lens}`,
        text: draft.lenses[lens],
      })),
      ...draft.mistakes.map((text, index) => ({
        section: 'Lenses' as const,
        where: 'Common mistakes',
        field: `f-mistakes-${index}`,
        text,
      })),
      ...draft.checklist.flatMap((item, index) => [
        {
          section: 'Checklist' as const,
          where: `Checklist ${pad2(index + 1)}`,
          field: `f-checklist-${index}-text`,
          text: item.text,
        },
        {
          section: 'Checklist' as const,
          where: `Checklist ${pad2(index + 1)}`,
          field: `f-checklist-${index}-why`,
          text: item.why,
        },
      ]),
      ...draft.versions.flatMap((entry, index) =>
        entry.notes.map((text, noteIndex) => ({
          section: 'Versions' as const,
          where: `Version ${index + 1}`,
          field: `f-versions-${index}-notes-${noteIndex}`,
          text,
        })),
      ),
      ...draft.verify.map((check, index) => ({
        section: 'Verify' as const,
        where: `Verify ${pad2(index + 1)}`,
        field: `f-verify-${index}-check`,
        text: check.check,
      })),
    ]),
  );

  // 5. Roll-up.
  const errors = problems.filter((p) => p.level === 'err').length;
  const warnings = problems.length - errors;
  const status = Object.fromEntries(
    SECTIONS.map((section) => {
      const own = problems.filter((p) => p.section === section);
      return [section, own.some((p) => p.level === 'err') ? 'err' : own.length ? 'warn' : 'ok'];
    }),
  ) as CheckReport['status'];

  const lensesUsed = usedLenses(draft);
  const lensesWritten = lensesUsed.filter((lens) => draft.lenses[lens].trim()).length;
  const ofMin = (n: number, min: number) => (n < min ? `${n}/${min}` : String(n));
  const counts: CheckReport['counts'] = {
    Basics: '',
    Checklist: String(draft.checklist.length),
    Decisions: String(draft.decisions.length),
    Options: String(draft.options.length),
    Lenses:
      lensesWritten < lensesUsed.length
        ? `${lensesWritten}/${lensesUsed.length}`
        : String(lensesWritten),
    Versions: String(draft.versions.length),
    Verify: ofMin(draft.verify.length, COUNT_LIMITS.verify[0]),
    Sources: ofMin(draft.sources.length, MIN_SOURCES),
  };

  const formatErrors = problems.filter((p) => p.group === 'format' && p.level === 'err').length;
  const safetyErrors = problems.filter((p) => p.group === 'safety').length;
  const linkErrors = problems.filter((p) => p.group === 'links').length;
  const totalLinks =
    draft.versions.reduce(
      (sum, v) => sum + (v.docs.trim() ? 1 : 0) + (v.context7.trim() ? 1 : 0),
      0,
    ) + draft.sources.filter((s) => s.url.trim()).length;

  return {
    problems,
    errors,
    warnings,
    status,
    counts,
    format: {
      ok: formatErrors === 0,
      note: formatErrors ? `${formatErrors} error${formatErrors === 1 ? '' : 's'}` : 'schema v1',
    },
    safety: {
      ok: safetyErrors === 0,
      note: safetyErrors ? `${safetyErrors} problem${safetyErrors === 1 ? '' : 's'}` : 'clean',
    },
    links: {
      ok: linkErrors === 0,
      note:
        totalLinks === 0 ? 'none yet' : `${Math.max(totalLinks - linkErrors, 0)} of ${totalLinks}`,
      total: totalLinks,
    },
  };
}
