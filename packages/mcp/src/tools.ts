import semver from 'semver';
import * as z from 'zod';
import { LENSES, type Lens, REPO_URL } from '@mustlist/schema/constants';
import type { CardJSON } from '@mustlist/schema/types';
import { type CardView, cardMarkdown, GENERAL_WRAPPER, referenceWrapper } from './format';
import type { Library } from './library';
import { isVisible } from './library';
import { stackFits, stackOverlap, techSlugs, topicsForFeature } from './match';

/**
 * The four read-only tools as pure functions: input in, result out. The MCP
 * server (server.ts) only wraps them. Contracts: 06-MCP-AND-DELIVERY in the plan.
 */

const stackInput = z
  .array(z.string().min(1).max(60))
  .max(10)
  .optional()
  .describe('The project\'s technologies, for example ["nextjs", "postgres"].');

const includeUnverified = z
  .boolean()
  .optional()
  .describe('Also return cards that are not reviewed yet (draft, proposed). Default false.');

// ---------------------------------------------------------------------------
// search_cards

export const searchCardsInput = z.object({
  query: z
    .string()
    .min(1)
    .max(200)
    .describe('What you are building, in a few words: "login", "stripe webhooks".'),
  stack: stackInput,
  topic: z.string().max(60).optional().describe('Limit to one topic slug, for example "auth".'),
  limit: z.number().int().min(1).max(10).optional().describe('Results to return: 1-10, default 5.'),
  include_unverified: includeUnverified,
});

export const searchCardsOutput = z.object({
  results: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      summary: z.string(),
      status: z.string(),
      stack: z.array(z.string()),
      url: z.string(),
      score: z.number(),
    }),
  ),
});

export type SearchCardsInput = z.infer<typeof searchCardsInput>;
export type SearchCardsOutput = z.infer<typeof searchCardsOutput>;

export function searchCards(library: Library, input: SearchCardsInput): SearchCardsOutput {
  const limit = input.limit ?? 5;
  const visible = new Set(library.visible(input.include_unverified).map((card) => card.id));
  const topic = input.topic?.trim().toLowerCase();
  const keep = (id: string) => visible.has(id) && (!topic || library.get(id)?.topic === topic);

  // Words like "login" name a topic ("auth") that the card text may not contain.
  const topics = topicsForFeature(input.query, library.topics);
  const query = [input.query, ...topics.map((t) => t.replace(/-/g, ' '))].join(' ');
  const scores = new Map<string, number>();
  for (const hit of library.index.search(query, { filter: (r) => keep(String(r.id)) })) {
    scores.set(String(hit.id), hit.score);
  }
  for (const card of library.cards) {
    if (keep(card.id) && topics.includes(card.topic) && !scores.has(card.id))
      scores.set(card.id, 1);
  }
  if (scores.size === 0 && topic) {
    for (const card of library.cards) if (keep(card.id)) scores.set(card.id, 0);
  }

  // Drop weak matches (a shared word like "postgres" or "email"): keep results
  // within a quarter of the best score.
  const top = Math.max(0, ...scores.values());
  for (const [id, score] of scores) if (score < top * 0.25) scores.delete(id);

  const stack = techSlugs(input.stack);
  const ranked = [...scores]
    .map(([id, score]) => ({ card: library.get(id) as CardJSON, score }))
    .sort(
      (a, b) =>
        Number(stack.length > 0 && stackFits(b.card.id, stack)) -
          Number(stack.length > 0 && stackFits(a.card.id, stack)) ||
        b.score - a.score ||
        (a.card.id < b.card.id ? -1 : 1),
    );

  return {
    results: ranked.slice(0, limit).map(({ card, score }) => ({
      id: card.id,
      title: card.title,
      summary: card.summary,
      status: card.status,
      stack: card.stack,
      url: card.url,
      score: Math.round(score * 100) / 100,
    })),
  };
}

export function searchCardsText(output: SearchCardsOutput): string {
  if (!output.results.length) {
    return `${GENERAL_WRAPPER}\n\nNo cards match. Tell the user there is no card for this yet; do not invent one.`;
  }
  const lines = output.results.map(
    (r) => `- ${r.id} (${r.status}): ${r.title}. ${r.summary}\n  ${r.url}`,
  );
  return `${GENERAL_WRAPPER}\n\n${lines.join('\n')}\n\nNext: call get_checklist or get_card with an id.`;
}

// ---------------------------------------------------------------------------
// get_checklist

export const getChecklistInput = z.object({
  feature: z
    .string()
    .min(1)
    .max(200)
    .describe('A topic slug or the feature in words: "auth", "login", "file upload".'),
  stack: stackInput,
  include_unverified: includeUnverified,
});

const itemOutput = z.object({ id: z.string(), lens: z.string(), text: z.string() });

export const getChecklistOutput = z.object({
  card: z
    .object({
      id: z.string(),
      title: z.string(),
      status: z.string(),
      last_verified: z.string().nullable(),
      url: z.string(),
    })
    .nullable(),
  alternatives: z.array(z.object({ id: z.string(), title: z.string() })),
  must: z.array(itemOutput),
  should: z.array(itemOutput),
  decisions: z.array(
    z.object({
      id: z.string(),
      question: z.string(),
      default: z.string().optional(),
      options: z.array(
        z.object({ id: z.string(), label: z.string(), points_to: z.string().optional() }),
      ),
    }),
  ),
  options: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      best_fit_when: z.array(z.string()),
      avoid_when: z.array(z.string()),
    }),
  ),
  recommended: z.string(),
  next_step: z.string(),
});

export type GetChecklistInput = z.infer<typeof getChecklistInput>;
export type GetChecklistOutput = z.infer<typeof getChecklistOutput>;

const statusRank = (card: CardJSON) =>
  card.status === 'verified' ? 0 : card.status === 'stale' ? 1 : 2;

/** The card for a feature on a stack, or null with the closest cards as alternatives. */
export function resolveFeature(
  library: Library,
  input: Pick<GetChecklistInput, 'feature' | 'stack' | 'include_unverified'>,
): { card: CardJSON | null; alternatives: CardJSON[] } {
  const pool = library.visible(input.include_unverified);
  const direct = library.get(input.feature);
  const stack = techSlugs(input.stack);

  let topic: string | undefined;
  if (direct && pool.includes(direct)) topic = direct.topic;
  topic ??= topicsForFeature(input.feature, library.topics).find((t) =>
    pool.some((card) => card.topic === t),
  );
  if (!topic) {
    const closest = searchCards(library, {
      query: input.feature,
      stack: input.stack,
      limit: 3,
      include_unverified: input.include_unverified,
    }).results.map((r) => library.get(r.id) as CardJSON);
    return { card: null, alternatives: closest };
  }

  const candidates = pool
    .filter((card) => card.topic === topic)
    .sort((a, b) => statusRank(a) - statusRank(b) || (a.id < b.id ? -1 : 1));
  if (direct && candidates.includes(direct) && (!stack.length || stackFits(direct.id, stack))) {
    return { card: direct, alternatives: candidates.filter((c) => c !== direct) };
  }
  if (!stack.length) {
    const [first = null, ...rest] = candidates;
    return { card: first, alternatives: rest };
  }
  const fitting = candidates
    .filter((card) => stackFits(card.id, stack))
    .sort((a, b) => stackOverlap(b.id, stack) - stackOverlap(a.id, stack));
  const card = fitting[0] ?? null;
  return { card, alternatives: candidates.filter((c) => c !== card) };
}

export function getChecklist(library: Library, input: GetChecklistInput): GetChecklistOutput {
  const { card, alternatives } = resolveFeature(library, input);
  const alt = alternatives.map((c) => ({ id: c.id, title: c.title }));
  if (!card) {
    return {
      card: null,
      alternatives: alt,
      must: [],
      should: [],
      decisions: [],
      options: [],
      recommended: '',
      next_step:
        'No card matches this feature and stack. Tell the user and do not invent a card. ' +
        'If an alternative fits, call get_checklist with its id.',
    };
  }
  const items = (level: 'must' | 'should') =>
    card.checklist
      .filter((item) => item.level === level)
      .map(({ id, lens, text }) => ({ id, lens, text }));
  return {
    card: {
      id: card.id,
      title: card.title,
      status: card.status,
      last_verified: card.last_verified,
      url: card.url,
    },
    alternatives: alt,
    must: items('must'),
    should: items('should'),
    decisions: card.decisions,
    options: card.options.map(({ id, name, best_fit_when, avoid_when }) => ({
      id,
      name,
      best_fit_when,
      avoid_when,
    })),
    recommended: card.recommended,
    next_step: `Ask the user the decisions above, then call get_card with id=${card.id}.`,
  };
}

export function getChecklistText(library: Library, output: GetChecklistOutput): string {
  if (!output.card) {
    const alt = output.alternatives.map((a) => `- ${a.id}: ${a.title}`).join('\n');
    return `${GENERAL_WRAPPER}\n\n${output.next_step}${alt ? `\n\nClosest cards:\n${alt}` : ''}`;
  }
  const card = library.get(output.card.id) as CardJSON;
  const parts = [referenceWrapper(card), '', `# Checklist: ${card.title}`, card.url];
  const list = (items: GetChecklistOutput['must']) =>
    items.map((item) => `- [${item.lens}] ${item.text}`).join('\n');
  parts.push('', '## Must build', list(output.must));
  if (output.should.length) parts.push('', '## Should build', list(output.should));
  parts.push('', '## Ask the user first');
  for (const decision of output.decisions) {
    const options = decision.options
      .map((o) => `${o.label} (\`${o.id}\`${o.points_to ? ` → option ${o.points_to}` : ''})`)
      .join(' / ');
    const fallback = decision.default ? ` Default: \`${decision.default}\`.` : '';
    parts.push(`- ${decision.question} ${options}.${fallback}`);
  }
  parts.push('', '## Options');
  for (const option of output.options) {
    const star = option.id === output.recommended ? ' (recommended)' : '';
    parts.push(
      `- ${option.name} (\`${option.id}\`)${star}: best fit when ${option.best_fit_when.join('; ')}`,
    );
  }
  if (output.alternatives.length) {
    parts.push('', `Other stacks: ${output.alternatives.map((a) => a.id).join(', ')}.`);
  }
  parts.push('', `Next: ${output.next_step}`);
  return parts.join('\n');
}

// ---------------------------------------------------------------------------
// get_card

export const getCardInput = z.object({
  id: z.string().min(3).max(100).describe('Card id, for example "auth/nextjs-postgres".'),
  lenses: z
    .array(z.enum(LENSES))
    .optional()
    .describe('Lens sections to include. Default: every lens on the card.'),
  versions: z
    .record(z.string().max(100), z.string().max(60))
    .optional()
    .describe(
      'Installed package versions, for example {"next": "16.1.0"}. Only matching version notes are returned for these packages.',
    ),
  chosen_option: z
    .string()
    .max(60)
    .optional()
    .describe('An option id from get_checklist, to focus on that option.'),
  format: z
    .enum(['markdown', 'json'])
    .optional()
    .describe('markdown (default, fewest tokens) or json.'),
  include_unverified: includeUnverified,
});

export type GetCardInput = z.infer<typeof getCardInput>;

export type GetCardResult =
  { ok: true; view: CardView; json: CardJSON } | { ok: false; message: string };

/** `^16.1.0` or `16` -> `16.1.0` / `16.0.0`; undefined when it isn't a version. */
export function normaliseVersion(value: string): string | undefined {
  const text = value.trim().replace(/^npm:/, '');
  const exact = semver.valid(semver.clean(text) ?? text);
  if (exact) return exact;
  if (semver.validRange(text)) {
    const min = semver.minVersion(text);
    if (min) return min.version;
  }
  return semver.coerce(text)?.version;
}

const PACKAGE_ALIASES: Readonly<Record<string, string>> = { nextjs: 'next', 'next.js': 'next' };

/** Version entries that match the given package versions; other packages are kept. */
export function matchVersions(
  entries: CardJSON['versions'],
  versions: Record<string, string> | undefined,
): CardJSON['versions'] {
  if (!versions) return entries;
  const given = new Map<string, string>();
  for (const [name, value] of Object.entries(versions)) {
    const version = normaliseVersion(value);
    const key = name.trim().toLowerCase();
    if (version) given.set(PACKAGE_ALIASES[key] ?? key, version);
  }
  return entries.filter((entry) => {
    const version = given.get(entry.package.toLowerCase());
    return !version || semver.satisfies(version, entry.range, { includePrerelease: true });
  });
}

function cardLenses(card: CardJSON): Lens[] {
  return LENSES.filter(
    (lens) => card.body.lenses[lens] || card.checklist.some((item) => item.lens === lens),
  );
}

export function getCard(library: Library, input: GetCardInput): GetCardResult {
  const card = library.get(input.id);
  if (!card) {
    return {
      ok: false,
      message: `No card has the id "${input.id}". Call search_cards or get_checklist to find one; do not invent a card.`,
    };
  }
  if (!isVisible(card.status, input.include_unverified)) {
    return {
      ok: false,
      message: `The card ${card.id} is ${card.status} (not reviewed). Pass include_unverified: true only if the user accepts unreviewed guidance.`,
    };
  }
  const onCard = cardLenses(card);
  const lenses = input.lenses?.length ? onCard.filter((l) => input.lenses?.includes(l)) : onCard;
  const versions = matchVersions(card.versions, input.versions);
  const chosen = input.chosen_option
    ? card.options.find((option) => option.id === input.chosen_option)
    : undefined;
  const option = chosen ?? card.options.find((item) => item.id === card.recommended);

  const json: CardJSON = {
    ...card,
    checklist: card.checklist.filter((item) => lenses.includes(item.lens)),
    verify: card.verify.filter((item) => lenses.includes(item.lens)),
    versions,
    body: {
      ...card.body,
      lenses: Object.fromEntries(
        Object.entries(card.body.lenses).filter(([lens]) => lenses.includes(lens as Lens)),
      ),
    },
  };
  return {
    ok: true,
    view: { card, lenses, versions, option, optionIsChosen: Boolean(chosen) },
    json,
  };
}

export function getCardText(
  result: Extract<GetCardResult, { ok: true }>,
  format: GetCardInput['format'],
): string {
  if (format === 'json') {
    return `${referenceWrapper(result.view.card)}\n\n${JSON.stringify(result.json)}`;
  }
  return cardMarkdown(result.view);
}

// ---------------------------------------------------------------------------
// report_feedback

export const reportFeedbackInput = z.object({
  id: z.string().min(3).max(100).describe('The card id the feedback is about.'),
  outcome: z.enum(['worked', 'failed', 'outdated', 'unclear']).describe('How the card worked.'),
  note: z
    .string()
    .max(500)
    .optional()
    .describe('What happened, in a sentence or two. Never include secrets or private code.'),
});

export const reportFeedbackOutput = z.object({ issue_url: z.string(), message: z.string() });

export type ReportFeedbackInput = z.infer<typeof reportFeedbackInput>;
export type ReportFeedbackOutput = z.infer<typeof reportFeedbackOutput>;

/**
 * Writes nothing: returns a pre-filled GitHub issue link so a person decides
 * whether to post it. Issue forms prefill text fields only, so the outcome goes
 * into the title and the note.
 */
export function reportFeedback(
  library: Library,
  input: ReportFeedbackInput,
): ReportFeedbackOutput | { error: string } {
  const card = library.get(input.id);
  if (!card) return { error: `No card has the id "${input.id}".` };
  const params = new URLSearchParams({
    template: 'feedback.yml',
    title: `Feedback (${input.outcome}): ${card.id}`,
    'card-id': card.id,
    note: `Outcome: ${input.outcome}\n\n${input.note?.trim() ?? ''}`.trim(),
  });
  return {
    issue_url: `${REPO_URL}/issues/new?${params.toString()}`,
    message: 'Share this link with the user so they can submit it.',
  };
}
