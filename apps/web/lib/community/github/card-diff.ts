import { LENSES, LENS_TITLES } from '@mustlist/schema/constants';
import type { CardJSON } from '@mustlist/schema/types';
import { hostOf } from '@/lib/format';
import type { DiffRow, FieldChange } from '../types';

/**
 * Field-by-field comparison of a card before and after a proposal: what the
 * "Changes" tab shows instead of a line diff. Pure, so it is easy to test.
 */

export interface CardDiff {
  changes: FieldChange[];
  totals: { fields: number; added: number; changed: number; removed: number };
}

const short = (text: string, max = 280) =>
  text.length > max ? `${text.slice(0, max - 1)}…` : text;

function counts(rows: DiffRow[]) {
  return {
    added: rows.filter((r) => r.kind === 'add').length,
    changed: rows.filter((r) => r.kind === 'chg').length,
    removed: rows.filter((r) => r.kind === 'del').length,
  };
}

function field(
  id: string,
  name: string,
  rows: DiffRow[],
  extra: Partial<FieldChange> = {},
  unchanged = 0,
): FieldChange | undefined {
  const real = rows.filter((r) => r.kind !== 'same');
  if (real.length === 0) return undefined;
  const { added, changed, removed } = counts(rows);
  const summary = [
    added && `${added} added`,
    changed && `${changed} changed`,
    removed && `${removed} removed`,
  ]
    .filter(Boolean)
    .join(' · ');
  const shortText = [added && `+${added}`, changed && `~${changed}`, removed && `−${removed}`]
    .filter(Boolean)
    .join(' ');
  const withSame: DiffRow[] = unchanged
    ? [...rows, { kind: 'same', text: `${unchanged} unchanged` }]
    : rows;
  return { id, name, short: shortText, summary, rows: withSame, ...extra };
}

/** Compare items that have ids: added, removed, and changed in place. */
function byId<T extends { id: string }>(
  before: T[],
  after: T[],
  describe: (item: T) => Pick<DiffRow, 'text' | 'chips' | 'caption'>,
  same: (a: T, b: T) => boolean,
): { rows: DiffRow[]; unchanged: number } {
  const old = new Map(before.map((item) => [item.id, item]));
  const rows: DiffRow[] = [];
  let unchanged = 0;
  for (const item of after) {
    const previous = old.get(item.id);
    if (!previous) rows.push({ kind: 'add', ...describe(item) });
    else if (!same(previous, item)) {
      const now = describe(item);
      const was = describe(previous);
      rows.push({ kind: 'chg', ...now, ...(was.text !== now.text ? { old: was.text } : {}) });
    } else unchanged += 1;
  }
  const kept = new Set(after.map((item) => item.id));
  for (const item of before) if (!kept.has(item.id)) rows.push({ kind: 'del', ...describe(item) });
  return { rows, unchanged };
}

const json = (value: unknown) => JSON.stringify(value);

function scalar(rows: DiffRow[], caption: string, before: unknown, after: unknown, mono = false) {
  if (json(before) === json(after)) return;
  const text = (value: unknown) =>
    value === null || value === undefined || value === ''
      ? '—'
      : Array.isArray(value)
        ? value.join(', ')
        : String(value);
  rows.push({ kind: 'chg', caption, old: text(before), text: text(after), mono });
}

/** Added and removed strings in a list (option bullets, mistakes). */
function list(rows: DiffRow[], caption: string, before: string[], after: string[]) {
  for (const item of after)
    if (!before.includes(item)) rows.push({ kind: 'add', caption, text: item });
  for (const item of before)
    if (!after.includes(item)) rows.push({ kind: 'del', caption, text: item });
}

function versionRows(before: CardJSON['versions'], after: CardJSON['versions']) {
  const rows: DiffRow[] = [];
  const packages = [...new Set([...before, ...after].map((v) => v.package))];
  for (const pkg of packages) {
    const was = before.filter((v) => v.package === pkg);
    const now = after.filter((v) => v.package === pkg);
    const pairs = Math.max(was.length, now.length);
    for (let i = 0; i < pairs; i++) {
      const a = was[i];
      const b = now[i];
      if (!a && b) {
        rows.push({ kind: 'add', caption: `${pkg} · range`, text: b.range, mono: true });
        b.notes.forEach((note) =>
          rows.push({ kind: 'add', caption: `${pkg} ${b.range}`, text: note }),
        );
        continue;
      }
      if (a && !b) {
        rows.push({ kind: 'del', caption: `${pkg} · range`, text: a.range, mono: true });
        continue;
      }
      if (!a || !b) continue;
      const where = `${pkg} ${b.range}`;
      if (a.range !== b.range)
        rows.push({
          kind: 'chg',
          caption: `${pkg} · range`,
          old: a.range,
          text: b.range,
          mono: true,
        });
      const notes = Math.max(a.notes.length, b.notes.length);
      for (let n = 0; n < notes; n++) {
        const oldNote = a.notes[n];
        const newNote = b.notes[n];
        if (oldNote === newNote) continue;
        if (oldNote === undefined && newNote !== undefined)
          rows.push({ kind: 'add', caption: where, text: newNote });
        else if (newNote === undefined && oldNote !== undefined)
          rows.push({ kind: 'del', caption: where, text: oldNote });
        else if (oldNote !== undefined && newNote !== undefined)
          rows.push({
            kind: 'chg',
            caption: `${where} · note ${n + 1}`,
            old: oldNote,
            text: newNote,
          });
      }
      if (a.docs !== b.docs)
        rows.push({
          kind: 'chg',
          caption: `${where} · docs`,
          old: a.docs,
          text: b.docs,
          mono: true,
        });
      if ((a.context7 ?? '') !== (b.context7 ?? ''))
        rows.push({
          kind: 'chg',
          caption: `${where} · Context7`,
          old: a.context7 ?? '—',
          text: b.context7 ?? '—',
          mono: true,
        });
    }
  }
  return rows;
}

function bodyRows(before: CardJSON['body'], after: CardJSON['body']) {
  const rows: DiffRow[] = [];
  const text = (caption: string, a = '', b = '') => {
    if (a.trim() === b.trim()) return;
    if (!a.trim()) rows.push({ kind: 'add', caption, text: short(b) });
    else if (!b.trim()) rows.push({ kind: 'del', caption, text: short(a) });
    else rows.push({ kind: 'chg', caption, old: short(a), text: short(b) });
  };
  text('Why this approach', before.why, after.why);
  for (const lens of LENSES)
    text(`Lenses · ${LENS_TITLES[lens]}`, before.lenses[lens], after.lenses[lens]);
  text('Common mistakes', before.mistakes, after.mistakes);
  text('Further reading', before.further_reading, after.further_reading);
  return rows;
}

/** Diff two versions of a card. `before` is missing for a new card, `after` for a removed one. */
export function diffCards(before: CardJSON | undefined, after: CardJSON | undefined): CardDiff {
  if (!before && !after)
    return { changes: [], totals: { fields: 0, added: 0, changed: 0, removed: 0 } };
  if (!before && after) {
    return {
      changes: [
        {
          id: 'card',
          name: 'New card',
          short: '+1',
          summary: `${after.checklist.length} checklist items · ${after.options.length} options · ${after.verify.length} verify checks`,
          rows: [
            { kind: 'add', caption: 'title', text: after.title },
            { kind: 'add', caption: 'summary', text: after.summary },
          ],
        },
      ],
      totals: { fields: 1, added: 1, changed: 0, removed: 0 },
    };
  }
  if (before && !after) {
    return {
      changes: [
        {
          id: 'card',
          name: 'Card removed',
          short: '−1',
          summary: 'removed',
          rows: [{ kind: 'del', text: before.title }],
        },
      ],
      totals: { fields: 1, added: 0, changed: 0, removed: 1 },
    };
  }
  const a = before as CardJSON;
  const b = after as CardJSON;

  const basics: DiffRow[] = [];
  scalar(basics, 'title', a.title, b.title);
  scalar(basics, 'summary', a.summary, b.summary);
  scalar(basics, 'stack', a.stack, b.stack, true);
  scalar(basics, 'for', a.applies_when.app_types, b.applies_when.app_types, true);
  scalar(basics, 'not for', a.applies_when.not_for, b.applies_when.not_for, true);
  scalar(basics, 'related', a.related, b.related, true);

  const checklist = byId(
    a.checklist,
    b.checklist,
    (item) => ({ text: item.text, chips: { id: item.id, lens: item.lens, level: item.level } }),
    (x, y) => json(x) === json(y),
  );

  const decisions = byId(
    a.decisions,
    b.decisions,
    (d) => ({
      text: `${d.question} (${d.options.map((o) => o.label).join(' / ')})`,
      chips: { id: d.id },
    }),
    (x, y) => json(x) === json(y),
  );

  const options: DiffRow[] = [];
  const optionIds = byId(
    a.options,
    b.options,
    (o) => ({ text: o.name, chips: { id: o.id } }),
    (x, y) => x.name === y.name,
  );
  options.push(...optionIds.rows);
  for (const now of b.options) {
    const was = a.options.find((o) => o.id === now.id);
    if (!was) continue;
    list(options, `${now.id} · best fit when`, was.best_fit_when, now.best_fit_when);
    list(options, `${now.id} · avoid when`, was.avoid_when, now.avoid_when);
    list(options, `${now.id} · trade-offs`, was.tradeoffs, now.tradeoffs);
    list(options, `${now.id} · examples`, was.examples ?? [], now.examples ?? []);
  }
  scalar(options, 'recommended', a.recommended, b.recommended, true);

  const verify = byId(
    a.verify,
    b.verify,
    (v) => ({ text: v.check, chips: { id: v.id, type: v.type, lens: v.lens } }),
    (x, y) => json(x) === json(y),
  );

  const sources: DiffRow[] = [];
  const oldSources = new Map(a.sources.map((s) => [s.url, s]));
  for (const s of b.sources) {
    const was = oldSources.get(s.url);
    if (!was) sources.push({ kind: 'add', text: s.title, host: hostOf(s.url) });
    else if (was.title !== s.title)
      sources.push({ kind: 'chg', old: was.title, text: s.title, host: hostOf(s.url) });
  }
  const newUrls = new Set(b.sources.map((s) => s.url));
  for (const s of a.sources)
    if (!newUrls.has(s.url)) sources.push({ kind: 'del', text: s.title, host: hostOf(s.url) });

  const meta: DiffRow[] = [];
  scalar(meta, 'card_version', a.card_version, b.card_version, true);
  scalar(meta, 'status', a.status, b.status, true);
  scalar(meta, 'last_verified', a.last_verified, b.last_verified, true);
  scalar(meta, 'review_level', a.review_level, b.review_level, true);
  scalar(meta, 'reviewers', a.reviewers, b.reviewers, true);
  scalar(meta, 'authors', a.authors, b.authors, true);

  const versionHint = [...new Set(b.versions.map((v) => v.package))].join(', ');
  const changes = [
    field('basics', 'Basics', basics),
    field('checklist', 'Checklist', checklist.rows, {}, checklist.unchanged),
    field('decisions', 'Decisions', decisions.rows, {}, decisions.unchanged),
    field('options', 'Options', options),
    field(
      'versions',
      'Version notes',
      versionRows(a.versions, b.versions),
      versionHint ? { hint: versionHint } : {},
    ),
    field('verify', 'Verify checks', verify.rows, {}, verify.unchanged),
    field('sources', 'Sources', sources),
    field('body', 'Text', bodyRows(a.body, b.body)),
    field('meta', 'Card metadata', meta, { maintainerOnly: true, summary: 'set by maintainers' }),
  ].filter((change): change is FieldChange => Boolean(change));

  const all = changes.flatMap((change) => change.rows);
  const { added, changed, removed } = counts(all);
  return { changes, totals: { fields: changes.length, added, changed, removed } };
}
