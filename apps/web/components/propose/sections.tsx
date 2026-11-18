'use client';

import {
  COUNT_LIMITS,
  LENSES,
  LENS_TITLES,
  SIZE_LIMITS,
  TEXT_LIMITS,
  VERIFY_TYPES,
  isOfficialDocsUrl,
  type Lens,
} from '@mustlist/schema/constants';
import { SelectMenu } from '@/components/overlay';
import { Icon } from '@/components/icons';
import { pad2 } from '@/lib/format';
import { STACK_CHOICES, stackName, techName, topicName } from '@/lib/topics';
import { cn } from '@/lib/utils';
import {
  type Draft,
  answerIds,
  blankAnswer,
  blankChecklist,
  blankDecision,
  blankOption,
  blankSource,
  blankVerify,
  blankVersion,
  checklistIds,
  decisionIds,
  newKey,
  optionIds,
  usedLenses,
  verifyIds,
  wordCount,
} from './draft';
import {
  AddButton,
  Counter,
  FieldFoot,
  IdInput,
  ItemShell,
  Seg,
  StringList,
  moveItem,
  useReorder,
} from './fields';

export type SetDraft = (update: (draft: Draft) => Draft) => void;

export const LENS_SHORT: Record<Lens, string> = {
  security: 'Security',
  performance: 'Performance',
  ux: 'UX',
  data: 'Data',
  cost: 'Cost',
};

const LENS_OPTIONS = LENSES.map((lens) => ({ value: lens, label: LENS_SHORT[lens] }));
const TYPE_OPTIONS = VERIFY_TYPES.map((type) => ({ value: type, label: type }));

/** Replace item `index` of a list with `patch` applied. */
function patchAt<T>(items: readonly T[], index: number, patch: Partial<T>): T[] {
  return items.map((item, i) => (i === index ? { ...item, ...patch } : item));
}

function SectionTitle({ title, meta }: { title: string; meta?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <h2 className="sec-h">{title}</h2>
      {meta && <span className="t-sm subtle">{meta}</span>}
    </div>
  );
}

/* ── Basics ─────────────────────────────────────────────── */

export function BasicsSummary({ draft, onEdit }: { draft: Draft; onEdit: () => void }) {
  return (
    <div className="box flex items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="label">Basics</div>
        <div className="t-sm mt-1 truncate">
          {draft.title || <span className="subtle">Untitled card</span>}{' '}
          <span className="subtle">·</span>{' '}
          <span className="mono subtle text-xs">
            {draft.topic || 'topic'}/{draft.stack || 'stack'}
          </span>
        </div>
      </div>
      <button type="button" className="btn btn-ghost btn-sm" onClick={onEdit}>
        Edit
      </button>
    </div>
  );
}

const STACK_ORDER = STACK_CHOICES.flatMap((group) => group.items);

export function BasicsEditor({
  draft,
  set,
  locked,
}: {
  draft: Draft;
  set: SetDraft;
  locked: boolean;
}) {
  const parts = draft.stack.split('-').filter(Boolean);
  const toggle = (slug: string) =>
    set((d) => {
      const current = d.stack.split('-').filter(Boolean);
      const next = current.includes(slug) ? current.filter((s) => s !== slug) : [...current, slug];
      const ordered = [
        ...STACK_ORDER.filter((s) => next.includes(s)),
        ...next.filter((s) => !STACK_ORDER.includes(s)),
      ];
      return {
        ...d,
        stack: ordered.join('-'),
        tech: ordered.filter((s) => s !== 'any').join(', '),
      };
    });
  return (
    <div className="box flex flex-col gap-5 p-4 md:p-5">
      <div className="flex items-center justify-between">
        <div className="label">Basics</div>
        <span className="mono t-xs subtle">
          {draft.topic || 'topic'}/{draft.stack || 'stack'}
        </span>
      </div>
      <div>
        <label htmlFor="f-title" className="field-label">
          Title
        </label>
        <input
          id="f-title"
          className="input"
          value={draft.title}
          placeholder={`${topicName(draft.topic || 'feature')} for a ${stackName(draft.stack || 'nextjs-postgres')} app`}
          onChange={(event) => set((d) => ({ ...d, title: event.target.value }))}
        />
        <FieldFoot hint={`${TEXT_LIMITS.titleMin}–${TEXT_LIMITS.titleMax} characters`}>
          <Counter len={draft.title.length} max={TEXT_LIMITS.titleMax} />
        </FieldFoot>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="f-topic" className="field-label">
            Topic
          </label>
          <div className="relative">
            <input
              id="f-topic"
              className="input pr-28"
              value={draft.topic}
              readOnly={locked}
              placeholder="background-jobs"
              spellCheck={false}
              onChange={(event) =>
                set((d) => ({ ...d, topic: event.target.value.toLowerCase().replace(/\s+/g, '-') }))
              }
            />
            {draft.topic && (
              <span className="t-xs subtle pointer-events-none absolute right-3 top-2.5">
                {topicName(draft.topic)}
              </span>
            )}
          </div>
        </div>
        <div>
          <label htmlFor="f-stackslug" className="field-label">
            Stack
          </label>
          <div className="relative">
            <input
              id="f-stackslug"
              className="input mono pr-32 text-[13px]"
              value={draft.stack}
              readOnly={locked}
              placeholder="nextjs-postgres"
              spellCheck={false}
              onChange={(event) =>
                set((d) => ({ ...d, stack: event.target.value.toLowerCase().replace(/\s+/g, '-') }))
              }
            />
            {draft.stack && (
              <span className="t-xs subtle pointer-events-none absolute right-3 top-2.5">
                {stackName(draft.stack)}
              </span>
            )}
          </div>
        </div>
      </div>
      {locked ? (
        <p className="hint -mt-3">
          Topic and stack are the card&apos;s address; a change keeps them.
        </p>
      ) : (
        <div className="-mt-1 flex flex-col gap-3">
          {STACK_CHOICES.map((group) => (
            <fieldset
              key={group.label}
              className="grid gap-2 sm:grid-cols-[96px_minmax(0,1fr)] sm:gap-3"
            >
              <legend className="t-sm subtle float-left leading-8">{group.label}</legend>
              <div className="flex flex-wrap gap-1.5">
                {group.items.map((slug) => {
                  const on = parts.includes(slug);
                  return (
                    <button
                      key={slug}
                      type="button"
                      aria-pressed={on}
                      className={cn('btn btn-sm h-8', on ? 'btn-pressed' : 'btn-secondary')}
                      onClick={() => toggle(slug)}
                    >
                      {slug === 'any' ? 'any' : techName(slug)}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          ))}
        </div>
      )}
      <div>
        <label htmlFor="f-stack" className="field-label">
          Technologies
        </label>
        <input
          id="f-stack"
          className="input mono text-[13px]"
          value={draft.tech}
          placeholder="nextjs, postgres, typescript"
          spellCheck={false}
          onChange={(event) => set((d) => ({ ...d, tech: event.target.value }))}
        />
        <FieldFoot
          hint={`Comma-separated slugs, ${COUNT_LIMITS.stack[0]}–${COUNT_LIMITS.stack[1]}`}
        />
      </div>
      <div>
        <label htmlFor="f-summary" className="field-label">
          Summary
        </label>
        <textarea
          id="f-summary"
          className="input"
          rows={4}
          value={draft.summary}
          placeholder="What to build, in one paragraph."
          onChange={(event) =>
            set((d) => ({ ...d, summary: event.target.value.replace(/\n/g, ' ') }))
          }
        />
        <FieldFoot hint="One plain paragraph. Shown first on the card.">
          <Counter len={draft.summary.length} max={SIZE_LIMITS.summaryChars} />
        </FieldFoot>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="f-applies_when-app_types" className="field-label">
            For
          </label>
          <input
            id="f-applies_when-app_types"
            className="input mono text-[13px]"
            value={draft.appTypes}
            placeholder="web-app, saas"
            onChange={(event) => set((d) => ({ ...d, appTypes: event.target.value }))}
          />
          <FieldFoot hint="App types, comma-separated" />
        </div>
        <div>
          <label htmlFor="f-applies_when-not_for" className="field-label">
            Not for
          </label>
          <input
            id="f-applies_when-not_for"
            className="input mono text-[13px]"
            value={draft.notFor}
            placeholder="static-site"
            onChange={(event) => set((d) => ({ ...d, notFor: event.target.value }))}
          />
          <FieldFoot hint="Optional" />
        </div>
      </div>
    </div>
  );
}

/* ── Checklist ──────────────────────────────────────────── */

export function ChecklistEditor({ draft, set }: { draft: Draft; set: SetDraft }) {
  const ids = checklistIds(draft);
  const onMove = (from: number, to: number) =>
    set((d) => ({ ...d, checklist: moveItem(d.checklist, from, to) }));
  const reorder = useReorder(onMove);
  const [min, max] = COUNT_LIMITS.checklist;
  const must = draft.checklist.filter((i) => i.level === 'must').length;
  return (
    <section>
      <SectionTitle
        title="Checklist"
        meta={`${draft.checklist.length} of ${min}–${max} · ${must} must`}
      />
      <ol className="mt-4 flex flex-col gap-2">
        {draft.checklist.map((item, index) => {
          const n = pad2(index + 1);
          const len = item.text.length;
          const update = (patch: Partial<typeof item>) =>
            set((d) => ({ ...d, checklist: patchAt(d.checklist, index, patch) }));
          return (
            <ItemShell
              key={item.key}
              n={n}
              label={`item ${n}`}
              index={index}
              total={draft.checklist.length}
              reorder={reorder}
              onMove={onMove}
              onRemove={() =>
                set((d) => ({ ...d, checklist: d.checklist.filter((_, i) => i !== index) }))
              }
              warn={len >= TEXT_LIMITS.checklistText * 0.9}
              error={len > TEXT_LIMITS.checklistText}
              controls={
                <>
                  <Seg
                    label="Level"
                    value={item.level}
                    options={[
                      { value: 'must', label: 'Must' },
                      { value: 'should', label: 'Should' },
                    ]}
                    onChange={(level) => update({ level })}
                  />
                  <SelectMenu
                    label="Lens"
                    value={item.lens}
                    options={LENS_OPTIONS}
                    onChange={(lens) => update({ lens })}
                  />
                  <IdInput
                    id={`f-checklist-${index}-id`}
                    value={item.id}
                    generated={ids[index] ?? ''}
                    label={`Item ${n}`}
                    onChange={(id) => update({ id })}
                  />
                </>
              }
            >
              <div>
                <textarea
                  id={`f-checklist-${index}-text`}
                  className="input"
                  rows={2}
                  value={item.text}
                  aria-label={`Item ${n} text`}
                  onChange={(event) => update({ text: event.target.value.replace(/\n/g, ' ') })}
                />
                <FieldFoot hint="Imperative, specific, testable.">
                  <Counter len={len} max={TEXT_LIMITS.checklistText} />
                </FieldFoot>
              </div>
              <input
                id={`f-checklist-${index}-why`}
                className="input h-8 text-[13px]"
                value={item.why}
                aria-label={`Item ${n} why`}
                placeholder="Why (optional)"
                onChange={(event) => update({ why: event.target.value })}
              />
            </ItemShell>
          );
        })}
      </ol>
      {draft.checklist.length < max && (
        <AddButton
          id="f-add-checklist"
          label="Add item"
          onClick={() =>
            set((d) => ({ ...d, checklist: [...d.checklist, blankChecklist(newKey('c'))] }))
          }
        />
      )}
    </section>
  );
}

/* ── Decisions ──────────────────────────────────────────── */

export function DecisionsEditor({ draft, set }: { draft: Draft; set: SetDraft }) {
  const ids = decisionIds(draft);
  const opIds = optionIds(draft);
  const onMove = (from: number, to: number) =>
    set((d) => ({ ...d, decisions: moveItem(d.decisions, from, to) }));
  const reorder = useReorder(onMove);
  const [min, max] = COUNT_LIMITS.decisions;
  const favourOptions = [
    { value: '', label: 'Nothing' },
    ...draft.options.map((option, index) => ({
      value: option.key,
      label: option.name || opIds[index] || `Option ${index + 1}`,
    })),
  ];
  return (
    <section>
      <SectionTitle
        title="Decisions"
        meta={`${draft.decisions.length} of ${min}–${max} · asked before building`}
      />
      <ol className="mt-4 flex flex-col gap-2">
        {draft.decisions.map((decision, index) => {
          const n = pad2(index + 1);
          const aIds = answerIds(decision);
          const update = (patch: Partial<typeof decision>) =>
            set((d) => ({ ...d, decisions: patchAt(d.decisions, index, patch) }));
          const updateAnswer = (
            answerIndex: number,
            patch: Partial<(typeof decision.answers)[number]>,
          ) => update({ answers: patchAt(decision.answers, answerIndex, patch) });
          return (
            <ItemShell
              key={decision.key}
              n={n}
              label={`decision ${n}`}
              index={index}
              total={draft.decisions.length}
              reorder={reorder}
              onMove={onMove}
              onRemove={() =>
                set((d) => ({ ...d, decisions: d.decisions.filter((_, i) => i !== index) }))
              }
              controls={
                <IdInput
                  id={`f-decisions-${index}-id`}
                  value={decision.id}
                  generated={ids[index] ?? ''}
                  label={`Decision ${n}`}
                  onChange={(id) => update({ id })}
                />
              }
            >
              <div>
                <input
                  id={`f-decisions-${index}-question`}
                  className="input"
                  value={decision.question}
                  aria-label={`Decision ${n} question`}
                  placeholder="Do you need …?"
                  onChange={(event) => update({ question: event.target.value })}
                />
                <FieldFoot hint="A question the agent asks before building.">
                  <Counter len={decision.question.length} max={TEXT_LIMITS.question} />
                </FieldFoot>
              </div>
              <div role="radiogroup" aria-label={`Decision ${n} default answer`}>
                <div className="label mb-1.5">Answers</div>
                <ul className="flex flex-col gap-3">
                  {decision.answers.map((answer, answerIndex) => {
                    const isDefault = decision.defaultKey === answer.key;
                    return (
                      // Two lines: default, answer and remove on top; what it favours and
                      // its id below, so a long option name never squeezes the answer.
                      <li
                        key={answer.key}
                        className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-1.5 gap-y-1"
                      >
                        <button
                          type="button"
                          role="radio"
                          aria-checked={isDefault}
                          aria-label={`Answer ${answerIndex + 1} is the default`}
                          className={cn(
                            'ans h-8 min-h-8 w-auto shrink-0 px-2',
                            isDefault && 'ans-on',
                          )}
                          onClick={() => update({ defaultKey: isDefault ? '' : answer.key })}
                          title="Default"
                        >
                          <span className="radio" />
                          <span className="t-xs">Default</span>
                        </button>
                        <input
                          id={`f-decisions-${index}-options-${answerIndex}-label`}
                          className="input h-8 min-w-0 text-[13px]"
                          value={answer.label}
                          aria-label={`Decision ${n} answer ${answerIndex + 1}`}
                          placeholder="Answer"
                          onChange={(event) =>
                            updateAnswer(answerIndex, { label: event.target.value })
                          }
                        />
                        <div className="col-span-3 row-start-2 flex min-w-0 items-center gap-1.5 sm:col-span-1 sm:col-start-2">
                          <SelectMenu
                            label="Favours"
                            value={answer.pointsTo}
                            options={favourOptions}
                            className="min-w-0"
                            onChange={(pointsTo) => updateAnswer(answerIndex, { pointsTo })}
                          />
                          <IdInput
                            id={`f-decisions-${index}-options-${answerIndex}-id`}
                            value={answer.id}
                            generated={aIds[answerIndex] ?? ''}
                            label={`Answer ${answerIndex + 1}`}
                            className="min-w-32 flex-1 text-right"
                            onChange={(id) => updateAnswer(answerIndex, { id })}
                          />
                        </div>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm btn-icon col-start-3 row-start-1"
                          aria-label={`Remove answer ${answerIndex + 1}`}
                          disabled={decision.answers.length <= COUNT_LIMITS.decisionOptions[0]}
                          onClick={() =>
                            update({
                              answers: decision.answers.filter((_, i) => i !== answerIndex),
                              defaultKey: isDefault ? '' : decision.defaultKey,
                            })
                          }
                        >
                          <Icon name="x" size="sm" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
                {decision.answers.length < COUNT_LIMITS.decisionOptions[1] && (
                  <button
                    id={`f-add-answer-${index}`}
                    type="button"
                    className="btn btn-ghost btn-sm mt-1.5"
                    onClick={() =>
                      update({ answers: [...decision.answers, blankAnswer(newKey('a'))] })
                    }
                  >
                    <Icon name="plus" size="sm" />
                    Add answer
                  </button>
                )}
              </div>
            </ItemShell>
          );
        })}
      </ol>
      {draft.decisions.length < max && (
        <AddButton
          id="f-add-decisions"
          label="Add decision"
          onClick={() =>
            set((d) => ({ ...d, decisions: [...d.decisions, blankDecision(newKey('d'))] }))
          }
        />
      )}
    </section>
  );
}

/* ── Options ────────────────────────────────────────────── */

export function OptionsEditor({ draft, set }: { draft: Draft; set: SetDraft }) {
  const ids = optionIds(draft);
  const onMove = (from: number, to: number) =>
    set((d) => ({ ...d, options: moveItem(d.options, from, to) }));
  const reorder = useReorder(onMove);
  const [min, max] = COUNT_LIMITS.options;
  return (
    <section>
      <SectionTitle
        title="Options"
        meta={`${draft.options.length} of ${min}–${max} · one recommended`}
      />
      <ol className="mt-4 flex flex-col gap-2" role="radiogroup" aria-label="Recommended option">
        {draft.options.map((option, index) => {
          const n = pad2(index + 1);
          const recommended = draft.recommended === option.key;
          const update = (patch: Partial<typeof option>) =>
            set((d) => ({ ...d, options: patchAt(d.options, index, patch) }));
          return (
            <ItemShell
              key={option.key}
              n={n}
              label={`option ${n}`}
              index={index}
              total={draft.options.length}
              reorder={reorder}
              onMove={onMove}
              canRemove={draft.options.length > 1}
              onRemove={() =>
                set((d) => {
                  const options = d.options.filter((_, i) => i !== index);
                  return {
                    ...d,
                    options,
                    recommended:
                      d.recommended === option.key ? (options[0]?.key ?? '') : d.recommended,
                  };
                })
              }
              controls={
                <>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={recommended}
                    className={cn('btn btn-sm h-8', recommended ? 'btn-pressed' : 'btn-secondary')}
                    onClick={() => set((d) => ({ ...d, recommended: option.key }))}
                  >
                    {recommended && <Icon name="check" size="sm" />}
                    Recommended
                  </button>
                  <IdInput
                    id={`f-options-${index}-id`}
                    value={option.id}
                    generated={ids[index] ?? ''}
                    label={`Option ${n}`}
                    onChange={(id) => update({ id })}
                  />
                </>
              }
            >
              <div>
                <input
                  id={`f-options-${index}-name`}
                  className="input"
                  value={option.name}
                  aria-label={`Option ${n} name`}
                  placeholder="Name"
                  onChange={(event) => update({ name: event.target.value })}
                />
                <FieldFoot>
                  <Counter len={option.name.length} max={TEXT_LIMITS.optionName} />
                </FieldFoot>
              </div>
              <div>
                <input
                  id={`f-options-${index}-examples`}
                  className="input h-8 text-[13px]"
                  value={option.examples}
                  aria-label={`Option ${n} examples`}
                  placeholder="Examples, comma-separated (optional)"
                  onChange={(event) => update({ examples: event.target.value })}
                />
                <FieldFoot hint="Examples, not endorsements." />
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <StringList
                  idPrefix={`f-options-${index}-best_fit_when`}
                  label="Best fit when"
                  items={option.best}
                  max={8}
                  maxChars={TEXT_LIMITS.listItem}
                  onChange={(best) => update({ best })}
                />
                <StringList
                  idPrefix={`f-options-${index}-avoid_when`}
                  label="Avoid when"
                  items={option.avoid}
                  max={8}
                  maxChars={TEXT_LIMITS.listItem}
                  onChange={(avoid) => update({ avoid })}
                />
                <StringList
                  idPrefix={`f-options-${index}-tradeoffs`}
                  label="Trade-offs"
                  items={option.trade}
                  max={8}
                  maxChars={TEXT_LIMITS.listItem}
                  onChange={(trade) => update({ trade })}
                />
              </div>
            </ItemShell>
          );
        })}
      </ol>
      {draft.options.length < max && (
        <AddButton
          id="f-add-options"
          label="Add option"
          onClick={() => set((d) => ({ ...d, options: [...d.options, blankOption(newKey('o'))] }))}
        />
      )}
    </section>
  );
}

/* ── Lenses, why, mistakes ──────────────────────────────── */

export function LensesEditor({ draft, set }: { draft: Draft; set: SetDraft }) {
  const used = usedLenses(draft);
  const usage = (lens: Lens) =>
    draft.checklist.filter((i) => i.lens === lens).length +
    draft.verify.filter((v) => v.lens === lens).length;
  const written = used.filter((lens) => draft.lenses[lens].trim()).length;
  return (
    <section className="flex flex-col gap-8">
      <div>
        <SectionTitle title="Why this approach" meta={`${wordCount(draft.why)} words`} />
        <textarea
          id="f-why"
          className="input mt-3"
          rows={5}
          value={draft.why}
          aria-label="Why this approach"
          placeholder="Why the recommended option fits most apps on this stack."
          onChange={(event) => set((d) => ({ ...d, why: event.target.value }))}
        />
        <FieldFoot hint="Markdown. Code blocks: ts, tsx, js, sql, json or yaml, up to 15 lines." />
      </div>
      <div>
        <SectionTitle title="Lenses" meta={`${written} of ${used.length} written`} />
        <div className="mt-3 flex flex-col gap-4">
          {LENSES.map((lens) => {
            const words = wordCount(draft.lenses[lens]);
            const count = usage(lens);
            const listed = used.includes(lens);
            return (
              <div
                key={lens}
                className="box p-3 md:p-4"
                style={{
                  borderColor: listed && !draft.lenses[lens].trim() ? 'var(--warning)' : undefined,
                }}
              >
                <div className="mb-2 flex items-center justify-between gap-3">
                  <label htmlFor={`f-lens-${lens}`} className="text-[15px] font-semibold">
                    {LENS_TITLES[lens]}
                  </label>
                  <span className="t-xs subtle">
                    {count ? `Used by ${count} item${count === 1 ? '' : 's'}` : 'Optional'}
                  </span>
                </div>
                <textarea
                  id={`f-lens-${lens}`}
                  className="input"
                  rows={4}
                  value={draft.lenses[lens]}
                  onChange={(event) =>
                    set((d) => ({ ...d, lenses: { ...d.lenses, [lens]: event.target.value } }))
                  }
                />
                <FieldFoot hint="Markdown">
                  <Counter len={words} max={SIZE_LIMITS.lensWords} unit="words" />
                </FieldFoot>
              </div>
            );
          })}
        </div>
      </div>
      <div>
        <SectionTitle
          title="Common mistakes"
          meta={`${draft.mistakes.filter((m) => m.trim()).length} of ${COUNT_LIMITS.mistakes[0]}–${COUNT_LIMITS.mistakes[1]}`}
        />
        <div className="mt-3">
          <StringList
            idPrefix="f-mistakes"
            label="Mistakes"
            items={draft.mistakes}
            max={COUNT_LIMITS.mistakes[1]}
            placeholder="A mistake people make, in one line"
            onChange={(mistakes) => set((d) => ({ ...d, mistakes }))}
          />
        </div>
      </div>
    </section>
  );
}

/* ── Versions ───────────────────────────────────────────── */

export function VersionsEditor({ draft, set }: { draft: Draft; set: SetDraft }) {
  const onMove = (from: number, to: number) =>
    set((d) => ({ ...d, versions: moveItem(d.versions, from, to) }));
  const reorder = useReorder(onMove);
  return (
    <section>
      <SectionTitle title="Versions" meta={`${draft.versions.length} · official docs first`} />
      <ol className="mt-4 flex flex-col gap-2">
        {draft.versions.map((entry, index) => {
          const update = (patch: Partial<typeof entry>) =>
            set((d) => ({ ...d, versions: patchAt(d.versions, index, patch) }));
          const docs = entry.docs.trim();
          const allowed = docs ? isOfficialDocsUrl(docs) : null;
          return (
            <ItemShell
              key={entry.key}
              n={String(index + 1)}
              label={`version entry ${index + 1}`}
              index={index}
              total={draft.versions.length}
              reorder={reorder}
              onMove={onMove}
              canRemove={draft.versions.length > 1}
              onRemove={() =>
                set((d) => ({ ...d, versions: d.versions.filter((_, i) => i !== index) }))
              }
              controls={
                <span className="mono t-sm">
                  {entry.pkg || 'package'} <span className="muted">{entry.range}</span>
                </span>
              }
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor={`f-versions-${index}-package`} className="field-label">
                    Package
                  </label>
                  <input
                    id={`f-versions-${index}-package`}
                    className="input mono text-[13px]"
                    value={entry.pkg}
                    placeholder="next"
                    spellCheck={false}
                    onChange={(event) => update({ pkg: event.target.value.trim() })}
                  />
                </div>
                <div>
                  <label htmlFor={`f-versions-${index}-range`} className="field-label">
                    Range
                  </label>
                  <input
                    id={`f-versions-${index}-range`}
                    className="input mono text-[13px]"
                    value={entry.range}
                    placeholder=">=16.0.0 <17.0.0"
                    spellCheck={false}
                    onChange={(event) => update({ range: event.target.value })}
                  />
                </div>
              </div>
              <StringList
                idPrefix={`f-versions-${index}-notes`}
                label="Notes"
                items={entry.notes}
                max={COUNT_LIMITS.versionNotes[1]}
                maxChars={TEXT_LIMITS.versionNote}
                placeholder="What changes in this range"
                onChange={(notes) => update({ notes })}
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor={`f-versions-${index}-docs`} className="field-label">
                    Official docs
                  </label>
                  <input
                    id={`f-versions-${index}-docs`}
                    className={cn('input text-[13px]', allowed === false && 'input-err')}
                    value={entry.docs}
                    placeholder="https://nextjs.org/docs/…"
                    inputMode="url"
                    spellCheck={false}
                    onChange={(event) => update({ docs: event.target.value })}
                  />
                  <FieldFoot
                    hint={
                      allowed === null ? (
                        'Required · on the allowlist'
                      ) : allowed ? (
                        <span className="ok inline-flex items-center gap-1">
                          <Icon name="check" size="sm" />
                          On the allowlist
                        </span>
                      ) : (
                        <span className="bad">Not on the allowlist</span>
                      )
                    }
                  />
                </div>
                <div>
                  <label htmlFor={`f-versions-${index}-context7`} className="field-label">
                    Context7
                  </label>
                  <input
                    id={`f-versions-${index}-context7`}
                    className="input text-[13px]"
                    value={entry.context7}
                    placeholder="https://context7.com/…"
                    inputMode="url"
                    spellCheck={false}
                    onChange={(event) => update({ context7: event.target.value })}
                  />
                  <FieldFoot hint="Optional" />
                </div>
              </div>
            </ItemShell>
          );
        })}
      </ol>
      <AddButton
        id="f-add-versions"
        label="Add version entry"
        onClick={() => set((d) => ({ ...d, versions: [...d.versions, blankVersion(newKey('v'))] }))}
      />
    </section>
  );
}

/* ── Verify ─────────────────────────────────────────────── */

export function VerifyEditor({ draft, set }: { draft: Draft; set: SetDraft }) {
  const ids = verifyIds(draft);
  const onMove = (from: number, to: number) =>
    set((d) => ({ ...d, verify: moveItem(d.verify, from, to) }));
  const reorder = useReorder(onMove);
  const [min, max] = COUNT_LIMITS.verify;
  return (
    <section>
      <SectionTitle title="Verify checks" meta={`${draft.verify.length} of ${min}–${max}`} />
      <ol className="mt-4 flex flex-col gap-2">
        {draft.verify.map((check, index) => {
          const n = pad2(index + 1);
          const update = (patch: Partial<typeof check>) =>
            set((d) => ({ ...d, verify: patchAt(d.verify, index, patch) }));
          return (
            <ItemShell
              key={check.key}
              n={n}
              label={`check ${n}`}
              index={index}
              total={draft.verify.length}
              reorder={reorder}
              onMove={onMove}
              onRemove={() =>
                set((d) => ({ ...d, verify: d.verify.filter((_, i) => i !== index) }))
              }
              controls={
                <>
                  <SelectMenu
                    label="Type"
                    value={check.type}
                    options={TYPE_OPTIONS}
                    onChange={(type) => update({ type })}
                  />
                  <SelectMenu
                    label="Lens"
                    value={check.lens}
                    options={LENS_OPTIONS}
                    onChange={(lens) => update({ lens })}
                  />
                  <IdInput
                    id={`f-verify-${index}-id`}
                    value={check.id}
                    generated={ids[index] ?? ''}
                    label={`Check ${n}`}
                    onChange={(id) => update({ id })}
                  />
                </>
              }
            >
              <div>
                <textarea
                  id={`f-verify-${index}-check`}
                  className="input"
                  rows={2}
                  value={check.check}
                  aria-label={`Check ${n}`}
                  onChange={(event) => update({ check: event.target.value.replace(/\n/g, ' ') })}
                />
                <FieldFoot hint="What a test proves once the feature is built.">
                  <Counter len={check.check.length} max={TEXT_LIMITS.verifyCheck} />
                </FieldFoot>
              </div>
            </ItemShell>
          );
        })}
      </ol>
      {draft.verify.length < max && (
        <AddButton
          id="f-add-verify"
          label="Add check"
          onClick={() => set((d) => ({ ...d, verify: [...d.verify, blankVerify(newKey('k'))] }))}
        />
      )}
    </section>
  );
}

/* ── Sources ────────────────────────────────────────────── */

export function SourcesEditor({ draft, set }: { draft: Draft; set: SetDraft }) {
  const onMove = (from: number, to: number) =>
    set((d) => ({ ...d, sources: moveItem(d.sources, from, to) }));
  const reorder = useReorder(onMove);
  return (
    <section>
      <SectionTitle title="Sources" meta={`${draft.sources.length} · primary sources, 2 or more`} />
      <ol className="mt-4 flex flex-col gap-2">
        {draft.sources.map((source, index) => {
          const update = (patch: Partial<typeof source>) =>
            set((d) => ({ ...d, sources: patchAt(d.sources, index, patch) }));
          const url = source.url.trim();
          const bad = url !== '' && !/^https:\/\/[^\s/]+\.[^\s]+/.test(url);
          return (
            <ItemShell
              key={source.key}
              n={String(index + 1)}
              label={`source ${index + 1}`}
              index={index}
              total={draft.sources.length}
              reorder={reorder}
              onMove={onMove}
              onRemove={() =>
                set((d) => ({ ...d, sources: d.sources.filter((_, i) => i !== index) }))
              }
            >
              <input
                id={`f-sources-${index}-title`}
                className="input"
                value={source.title}
                aria-label={`Source ${index + 1} title`}
                placeholder="Title"
                onChange={(event) => update({ title: event.target.value })}
              />
              <div>
                <input
                  id={`f-sources-${index}-url`}
                  className={cn('input mono text-[13px]', bad && 'input-err')}
                  value={source.url}
                  aria-label={`Source ${index + 1} URL`}
                  placeholder="https://…"
                  inputMode="url"
                  spellCheck={false}
                  onChange={(event) => update({ url: event.target.value.trim() })}
                />
                {bad && <FieldFoot hint={<span className="bad">Use a full https:// link</span>} />}
              </div>
            </ItemShell>
          );
        })}
      </ol>
      <AddButton
        id="f-add-sources"
        label="Add source"
        onClick={() => set((d) => ({ ...d, sources: [...d.sources, blankSource(newKey('s'))] }))}
      />
    </section>
  );
}
