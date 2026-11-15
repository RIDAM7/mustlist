import {
  AMBIGUOUS_YAML_IDS,
  LENSES,
  LENS_TITLES,
  SECTION_TITLES,
  TEXT_LIMITS,
  type ChecklistLevel,
  type Lens,
  type VerifyType,
} from '@mustlist/schema/constants';
import type { CardJSON } from '@mustlist/schema/types';

/**
 * The editor's working copy of a card. Lists carry a stable `key` for React and
 * an optional user `id`; empty ids are generated from the text on the fly, so the
 * form never asks for kebab-case until someone wants to choose one.
 */

export interface DraftChecklistItem {
  key: string;
  id: string;
  lens: Lens;
  level: ChecklistLevel;
  text: string;
  why: string;
}

export interface DraftAnswer {
  key: string;
  id: string;
  label: string;
  /** Key of the option this answer favours, or ''. */
  pointsTo: string;
}

export interface DraftDecision {
  key: string;
  id: string;
  question: string;
  /** Key of the default answer, or ''. */
  defaultKey: string;
  answers: DraftAnswer[];
}

export interface DraftOption {
  key: string;
  id: string;
  name: string;
  /** Comma-separated. */
  examples: string;
  best: string[];
  avoid: string[];
  trade: string[];
}

export interface DraftVersion {
  key: string;
  pkg: string;
  range: string;
  notes: string[];
  docs: string;
  context7: string;
}

export interface DraftVerify {
  key: string;
  id: string;
  lens: Lens;
  type: VerifyType;
  check: string;
}

export interface DraftSource {
  key: string;
  title: string;
  url: string;
}

export interface Draft {
  /** Set when the draft changes an existing card. */
  cardId: string | null;
  request: number | null;
  title: string;
  topic: string;
  stack: string;
  /** Technologies (frontmatter `stack`), comma-separated. */
  tech: string;
  summary: string;
  appTypes: string;
  notFor: string;
  related: string[];
  authors: string[];
  cardVersion: string;
  checklist: DraftChecklistItem[];
  decisions: DraftDecision[];
  options: DraftOption[];
  /** Key of the recommended option. */
  recommended: string;
  why: string;
  lenses: Record<Lens, string>;
  mistakes: string[];
  versions: DraftVersion[];
  verify: DraftVerify[];
  sources: DraftSource[];
}

/* ── Keys and ids ───────────────────────────────────────── */

let counter = 0;

/** A fresh key for an item added in the browser (never during render). */
export function newKey(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter}`;
}

/** "Hash passwords with Argon2id!" -> "hash-passwords-with-argon2id" */
export function slugify(text: string, maxWords = 5): string {
  const slug = text
    .toLowerCase()
    .replace(/[`'".,:;!?()[\]{}<>/\\]/g, ' ')
    .replace(/[^a-z0-9\s-]/g, '')
    .split(/[\s-]+/)
    .filter(Boolean)
    .slice(0, maxWords)
    .join('-')
    .slice(0, TEXT_LIMITS.itemId)
    .replace(/-+$/, '');
  if (!slug) return '';
  return AMBIGUOUS_YAML_IDS.includes(slug) ? `${slug}-item` : slug;
}

/** Effective ids for a list: the typed id, or one generated from the text, made unique. */
export function effectiveIds<T>(
  items: readonly T[],
  typed: (item: T) => string,
  text: (item: T) => string,
  fallback: string,
): string[] {
  const used = new Map<string, number>();
  return items.map((item, index) => {
    const own = typed(item).trim();
    if (own) return own;
    const base = slugify(text(item)) || `${fallback}-${index + 1}`;
    const seen = used.get(base) ?? 0;
    used.set(base, seen + 1);
    return seen === 0 ? base : `${base}-${seen + 1}`;
  });
}

export const checklistIds = (draft: Draft) =>
  effectiveIds(
    draft.checklist,
    (i) => i.id,
    (i) => i.text,
    'item',
  );
export const decisionIds = (draft: Draft) =>
  effectiveIds(
    draft.decisions,
    (d) => d.id,
    (d) => d.question,
    'decision',
  );
export const answerIds = (decision: DraftDecision) =>
  effectiveIds(
    decision.answers,
    (a) => a.id,
    (a) => a.label,
    'answer',
  );
export const optionIds = (draft: Draft) =>
  effectiveIds(
    draft.options,
    (o) => o.id,
    (o) => o.name,
    'option',
  );
export const verifyIds = (draft: Draft) =>
  effectiveIds(
    draft.verify,
    (v) => v.id,
    (v) => v.check,
    'check',
  );

/* ── Starting points ────────────────────────────────────── */

const emptyLenses = (): Record<Lens, string> =>
  Object.fromEntries(LENSES.map((lens) => [lens, ''])) as Record<Lens, string>;

const blankChecklist = (key: string): DraftChecklistItem => ({
  key,
  id: '',
  lens: 'security',
  level: 'must',
  text: '',
  why: '',
});

export const blankAnswer = (key: string): DraftAnswer => ({ key, id: '', label: '', pointsTo: '' });

export const blankDecision = (key: string): DraftDecision => ({
  key,
  id: '',
  question: '',
  defaultKey: '',
  answers: [blankAnswer(`${key}-a1`), blankAnswer(`${key}-a2`)],
});

export const blankOption = (key: string): DraftOption => ({
  key,
  id: '',
  name: '',
  examples: '',
  best: [''],
  avoid: [''],
  trade: [''],
});

export const blankVersion = (key: string): DraftVersion => ({
  key,
  pkg: '',
  range: '',
  notes: [''],
  docs: '',
  context7: '',
});

export const blankVerify = (key: string): DraftVerify => ({
  key,
  id: '',
  lens: 'security',
  type: 'integration',
  check: '',
});

export const blankSource = (key: string): DraftSource => ({ key, title: '', url: '' });

export { blankChecklist };

/** `nextjs-postgres` -> `nextjs, postgres` */
const techFromStack = (stack: string) =>
  stack
    .split('-')
    .filter((part) => part && part !== 'any')
    .join(', ');

export function newDraft(init: {
  topic?: string;
  stack?: string;
  title?: string;
  request?: number | null;
  author?: string;
  checklist?: Omit<DraftChecklistItem, 'key'>[];
}): Draft {
  const topic = init.topic ?? '';
  const stack = init.stack ?? '';
  return {
    cardId: null,
    request: init.request ?? null,
    title: init.title ?? '',
    topic,
    stack,
    tech: techFromStack(stack),
    summary: '',
    appTypes: 'web-app',
    notFor: '',
    related: [],
    authors: [init.author ?? 'your-handle'],
    cardVersion: '0.1.0',
    checklist: init.checklist
      ? init.checklist.map((item, index) => ({ ...item, key: `c${index}` }))
      : [blankChecklist('c0'), blankChecklist('c1'), blankChecklist('c2')],
    decisions: [blankDecision('d0')],
    options: [blankOption('o0')],
    recommended: 'o0',
    why: '',
    lenses: emptyLenses(),
    mistakes: ['', '', ''],
    versions: [blankVersion('v0')],
    verify: [blankVerify('k0'), blankVerify('k1'), blankVerify('k2')],
    sources: [blankSource('s0'), blankSource('s1')],
  };
}

/** Bullets of a markdown list -> plain strings. */
function bullets(markdown: string): string[] {
  return markdown
    .split('\n')
    .map((line) => line.match(/^\s*[-*]\s+(.*)$/)?.[1]?.trim())
    .filter((line): line is string => Boolean(line));
}

/** A draft that starts from an existing card ("Suggest a change"). */
export function draftFromCard(card: CardJSON): Draft {
  const [, stack = ''] = card.id.split('/');
  const optionKey = new Map(card.options.map((option, index) => [option.id, `o${index}`]));
  return {
    cardId: card.id,
    request: null,
    title: card.title,
    topic: card.topic,
    stack,
    tech: card.stack.join(', '),
    summary: card.summary,
    appTypes: card.applies_when.app_types.join(', '),
    notFor: card.applies_when.not_for.join(', '),
    related: card.related,
    authors: card.authors,
    cardVersion: card.card_version,
    checklist: card.checklist.map((item, index) => ({
      key: `c${index}`,
      id: item.id,
      lens: item.lens,
      level: item.level,
      text: item.text,
      why: item.why ?? '',
    })),
    decisions: card.decisions.map((decision, index) => {
      const key = `d${index}`;
      const answers = decision.options.map((answer, answerIndex) => ({
        key: `${key}-a${answerIndex}`,
        id: answer.id,
        label: answer.label,
        pointsTo: answer.points_to ? (optionKey.get(answer.points_to) ?? '') : '',
      }));
      const defaultIndex = decision.options.findIndex((answer) => answer.id === decision.default);
      return {
        key,
        id: decision.id,
        question: decision.question,
        defaultKey: defaultIndex >= 0 ? `${key}-a${defaultIndex}` : '',
        answers,
      };
    }),
    options: card.options.map((option, index) => ({
      key: `o${index}`,
      id: option.id,
      name: option.name,
      examples: (option.examples ?? []).join(', '),
      best: option.best_fit_when,
      avoid: option.avoid_when,
      trade: option.tradeoffs,
    })),
    recommended: optionKey.get(card.recommended) ?? 'o0',
    why: card.body.why,
    lenses: { ...emptyLenses(), ...card.body.lenses },
    mistakes: bullets(card.body.mistakes),
    versions: card.versions.map((entry, index) => ({
      key: `v${index}`,
      pkg: entry.package,
      range: entry.range,
      notes: entry.notes,
      docs: entry.docs,
      context7: entry.context7 ?? '',
    })),
    verify: card.verify.map((check, index) => ({
      key: `k${index}`,
      id: check.id,
      lens: check.lens,
      type: check.type,
      check: check.check,
    })),
    sources: card.sources.map((source, index) => ({
      key: `s${index}`,
      title: source.title,
      url: source.url,
    })),
  };
}

/* ── Frontmatter and markdown ───────────────────────────── */

const list = (value: string) =>
  value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

const filled = (values: readonly string[]) => values.map((v) => v.trim()).filter(Boolean);

/** Lenses the card covers: used by checklist or verify, or written. */
export function usedLenses(draft: Draft): Lens[] {
  const used = new Set<Lens>([
    ...draft.checklist.map((i) => i.lens),
    ...draft.verify.map((v) => v.lens),
  ]);
  for (const lens of LENSES) if (draft.lenses[lens].trim()) used.add(lens);
  return LENSES.filter((lens) => used.has(lens));
}

/** The frontmatter object the zod schema validates (status stays `draft`). */
export function toFrontmatter(draft: Draft) {
  const opIds = optionIds(draft);
  const opIdByKey = new Map(draft.options.map((option, index) => [option.key, opIds[index] ?? '']));
  const ckIds = checklistIds(draft);
  const dcIds = decisionIds(draft);
  const vfIds = verifyIds(draft);
  return {
    id: `${draft.topic.trim()}/${draft.stack.trim()}`,
    title: draft.title.trim(),
    topic: draft.topic.trim(),
    stack: list(draft.tech),
    summary: draft.summary.trim(),
    status: 'draft',
    card_version: draft.cardVersion,
    last_verified: null,
    review_level: null,
    authors: draft.authors,
    reviewers: [],
    lenses: usedLenses(draft),
    applies_when: { app_types: list(draft.appTypes), not_for: list(draft.notFor) },
    related: draft.related,
    checklist: draft.checklist.map((item, index) => ({
      id: ckIds[index] ?? '',
      lens: item.lens,
      level: item.level,
      text: item.text.trim(),
      ...(item.why.trim() ? { why: item.why.trim() } : {}),
    })),
    decisions: draft.decisions.map((decision, index) => {
      const ids = answerIds(decision);
      const defaultIndex = decision.answers.findIndex((a) => a.key === decision.defaultKey);
      return {
        id: dcIds[index] ?? '',
        question: decision.question.trim(),
        options: decision.answers.map((answer, answerIndex) => ({
          id: ids[answerIndex] ?? '',
          label: answer.label.trim(),
          ...(answer.pointsTo && opIdByKey.get(answer.pointsTo)
            ? { points_to: opIdByKey.get(answer.pointsTo) }
            : {}),
        })),
        ...(defaultIndex >= 0 ? { default: ids[defaultIndex] } : {}),
      };
    }),
    options: draft.options.map((option, index) => ({
      id: opIds[index] ?? '',
      name: option.name.trim(),
      ...(list(option.examples).length ? { examples: list(option.examples) } : {}),
      best_fit_when: filled(option.best),
      avoid_when: filled(option.avoid),
      tradeoffs: filled(option.trade),
    })),
    recommended: opIdByKey.get(draft.recommended) ?? '',
    versions: draft.versions.map((entry) => ({
      package: entry.pkg.trim(),
      range: entry.range.trim(),
      notes: filled(entry.notes),
      docs: entry.docs.trim(),
      ...(entry.context7.trim() ? { context7: entry.context7.trim() } : {}),
    })),
    verify: draft.verify.map((check, index) => ({
      id: vfIds[index] ?? '',
      lens: check.lens,
      type: check.type,
      check: check.check.trim(),
    })),
    sources: draft.sources.map((source) => ({
      title: source.title.trim(),
      url: source.url.trim(),
    })),
  };
}

export type DraftFrontmatter = ReturnType<typeof toFrontmatter>;

/** Body markdown in the spec's order: why, lenses, common mistakes. */
export function toBody(draft: Draft): string {
  const lenses = usedLenses(draft)
    .map((lens) => `### ${LENS_TITLES[lens]}\n\n${draft.lenses[lens].trim()}`)
    .join('\n\n');
  const mistakes = filled(draft.mistakes)
    .map((line) => `- ${line}`)
    .join('\n');
  return [
    `## ${SECTION_TITLES.why}\n\n${draft.why.trim()}`,
    `## ${SECTION_TITLES.lenses}\n\n${lenses}`,
    `## ${SECTION_TITLES.mistakes}\n\n${mistakes}`,
  ].join('\n\n');
}

/* A small YAML writer: every string double-quoted (JSON strings are valid YAML). */

type Yaml = string | number | boolean | null | Yaml[] | { [key: string]: Yaml | undefined };

const scalar = (value: string | number | boolean | null) =>
  typeof value === 'string' ? JSON.stringify(value) : String(value);

function isScalar(value: Yaml): value is string | number | boolean | null {
  return value === null || typeof value !== 'object';
}

function yamlLines(value: Yaml, indent: string): string[] {
  if (isScalar(value)) return [`${indent}${scalar(value)}`];
  if (Array.isArray(value)) {
    if (value.every(isScalar))
      return [`${indent}[${value.map((v) => scalar(v as string)).join(', ')}]`];
    return value.flatMap((item) => {
      const [first = '', ...rest] = yamlLines(item, `${indent}  `);
      return [`${indent}- ${first.trimStart()}`, ...rest];
    });
  }
  return Object.entries(value)
    .filter((entry): entry is [string, Yaml] => entry[1] !== undefined)
    .flatMap(([key, item]) => {
      if (isScalar(item) || (Array.isArray(item) && item.every(isScalar))) {
        return [`${indent}${key}: ${yamlLines(item, '')[0]}`];
      }
      return [`${indent}${key}:`, ...yamlLines(item, `${indent}  `)];
    });
}

/** The full card file, ready to open as a pull request. */
export function serializeCard(draft: Draft): string {
  const frontmatter = toFrontmatter(draft) as unknown as Yaml;
  return `---\n${yamlLines(frontmatter, '').join('\n')}\n---\n\n${toBody(draft)}\n`;
}

/** Count of words, as the size rule counts them. */
export function wordCount(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}
