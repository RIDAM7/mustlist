import { LENS_TITLES, isOfficialDocsUrl } from '@mustlist/schema/constants';
import { CodeText } from '@/components/ui';
import { Icon } from '@/components/icons';
import { hostOf, pad2, splitCode } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Section } from './checks';
import { type Draft, optionIds, usedLenses } from './draft';
import { LENS_SHORT } from './sections';
import { Pill } from '../ui';

/** The current section, rendered with the card page's classes. */

const Text = ({ text }: { text: string }) => <CodeText parts={splitCode(text)} />;

/** Paragraphs of a markdown field, without a markdown renderer (preview only). */
function Paragraphs({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/).filter((block) => block.trim());
  return (
    <div className="prose flex flex-col gap-3">
      {blocks.map((block, index) =>
        block.startsWith('```') ? (
          <pre key={index} className="code code-b px-4">
            {block.replace(/^```[^\n]*\n?/, '').replace(/```$/, '')}
          </pre>
        ) : (
          <p key={index}>
            <Text text={block} />
          </p>
        ),
      )}
    </div>
  );
}

const Empty = ({ what }: { what: string }) => <p className="t-sm subtle py-4">No {what} yet.</p>;

export function SectionPreview({ section, draft }: { section: Section; draft: Draft }) {
  switch (section) {
    case 'Basics':
      return (
        <div>
          <h2 className="t-h2">{draft.title || 'Untitled card'}</h2>
          {draft.summary && (
            <p className="mt-4 rounded-lg bg-bg-subtle px-5 py-4 text-[17px] leading-[27px] md:px-7 md:py-6 md:text-[19px] md:leading-[30px]">
              {draft.summary}
            </p>
          )}
          <div className="t-sm mt-4 flex flex-wrap gap-x-6 gap-y-2">
            <span className="flex flex-wrap items-center gap-1.5">
              <span className="subtle mr-0.5">For</span>
              {draft.appTypes
                .split(',')
                .map((t) => t.trim())
                .filter(Boolean)
                .map((t) => (
                  <span key={t} className="tag mono">
                    {t}
                  </span>
                ))}
            </span>
            {draft.notFor.trim() && (
              <span className="flex flex-wrap items-center gap-1.5">
                <span className="subtle mr-0.5">Not for</span>
                {draft.notFor
                  .split(',')
                  .map((t) => t.trim())
                  .filter(Boolean)
                  .map((t) => (
                    <span key={t} className="tag mono">
                      {t}
                    </span>
                  ))}
              </span>
            )}
          </div>
        </div>
      );

    case 'Checklist': {
      const ordered = [
        ...draft.checklist.filter((i) => i.level === 'must'),
        ...draft.checklist.filter((i) => i.level === 'should'),
      ];
      return (
        <div>
          <h2 className="sec-h mb-2">Must-have checklist</h2>
          {ordered.length === 0 && <Empty what="items" />}
          {ordered.map((item, index) => (
            <div key={item.key} className="ck">
              <span className="mono subtle text-xs leading-6">{pad2(index + 1)}</span>
              <div>
                <p className="ck-t">
                  {item.text ? <Text text={item.text} /> : <span className="subtle">Empty</span>}
                </p>
                {item.why && <p className="ck-w">{item.why}</p>}
              </div>
              <span className="flex items-start gap-1.5">
                <span
                  className={cn('lvl leading-5', item.level === 'must' ? 'lvl-must' : 'lvl-should')}
                >
                  {item.level.toUpperCase()}
                </span>
                <span className="lens">{LENS_SHORT[item.lens]}</span>
              </span>
            </div>
          ))}
        </div>
      );
    }

    case 'Decisions': {
      const opIds = optionIds(draft);
      const optionName = new Map(draft.options.map((o, i) => [o.key, o.name || opIds[i] || '']));
      return (
        <div className="flex flex-col gap-7">
          <h2 className="sec-h">Decisions to make</h2>
          {draft.decisions.length === 0 && <Empty what="decisions" />}
          {draft.decisions.map((decision, index) => (
            <div key={decision.key} role="radiogroup" aria-label={decision.question}>
              <p className="mb-2.5 text-[15px] font-medium leading-6">
                <span className="mono subtle mr-2.5 text-xs">{pad2(index + 1)}</span>
                {decision.question || <span className="subtle">Question</span>}
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {decision.answers.map((answer) => {
                  const on = decision.defaultKey === answer.key;
                  return (
                    <div
                      key={answer.key}
                      role="radio"
                      aria-checked={on}
                      className={cn('ans cursor-default', on && 'ans-on')}
                    >
                      <span className="radio" />
                      <span className="flex flex-1 flex-col">
                        <span>{answer.label || <span className="subtle">Answer</span>}</span>
                        {answer.pointsTo && optionName.get(answer.pointsTo) && (
                          <span className="t-xs subtle mt-0.5">
                            Favours {optionName.get(answer.pointsTo)}
                          </span>
                        )}
                      </span>
                      {on && <span className="badge">Default</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      );
    }

    case 'Options':
      return (
        <div>
          <h2 className="sec-h mb-5">Options</h2>
          <div className={cn('grid gap-3', draft.options.length > 1 && 'md:grid-cols-2')}>
            {draft.options.map((option) => {
              const rec = draft.recommended === option.key;
              return (
                <div key={option.key} className={cn('opt flex flex-col gap-4', rec && 'opt-rec')}>
                  <div>
                    {rec && (
                      <div className="mb-2.5">
                        <Pill pill="p-rec" label="Recommended" />
                      </div>
                    )}
                    <h3 className="text-[15px] font-semibold leading-[22px]">
                      {option.name || 'Option'}
                    </h3>
                    {option.examples.trim() && (
                      <p className="t-xs subtle mt-1.5">
                        Examples, not endorsements: {option.examples}
                      </p>
                    )}
                  </div>
                  {(
                    [
                      ['Best fit when', option.best],
                      ['Avoid when', option.avoid],
                      ['Trade-offs', option.trade],
                    ] as const
                  ).map(([label, items]) => (
                    <div key={label}>
                      <div className="label">{label}</div>
                      <ul>
                        {items
                          .filter((x) => x.trim())
                          .map((x, i) => (
                            <li key={i}>{x}</li>
                          ))}
                      </ul>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      );

    case 'Lenses':
      return (
        <div className="flex flex-col gap-10">
          <div>
            <h2 className="sec-h mb-3">Why this approach</h2>
            {draft.why.trim() ? <Paragraphs text={draft.why} /> : <Empty what="text" />}
          </div>
          <div>
            <h2 className="sec-h mb-2">Lenses</h2>
            <div className="border-t">
              {usedLenses(draft).map((lens) => (
                <div key={lens} className="border-b pb-6 pt-5">
                  <h3 className="mb-3 text-base font-semibold">{LENS_TITLES[lens]}</h3>
                  {draft.lenses[lens].trim() ? (
                    <Paragraphs text={draft.lenses[lens]} />
                  ) : (
                    <Empty what="text" />
                  )}
                </div>
              ))}
            </div>
          </div>
          <div>
            <h2 className="sec-h mb-2">Common mistakes</h2>
            <ul className="bul prose">
              {draft.mistakes
                .filter((m) => m.trim())
                .map((m, i) => (
                  <li key={i}>
                    <Text text={m} />
                  </li>
                ))}
            </ul>
          </div>
        </div>
      );

    case 'Versions':
      return (
        <div>
          <h2 className="sec-h mb-4">Version notes</h2>
          <div className="flex flex-col gap-3">
            {draft.versions.map((entry) => (
              <div key={entry.key} className="ver">
                <div className="mb-3 flex flex-wrap items-center gap-2.5">
                  <span className="mono text-[13px] font-semibold">{entry.pkg || 'package'}</span>
                  <span className="mono muted text-[13px]">{entry.range}</span>
                </div>
                <ul className="flex flex-col gap-1.5">
                  {entry.notes
                    .filter((n) => n.trim())
                    .map((note, i) => (
                      <li key={i} className="relative pl-4 text-sm leading-[22px]">
                        <span
                          aria-hidden="true"
                          className="absolute left-[3px] top-[9px] size-1 rounded-full bg-fg-subtle"
                        />
                        <Text text={note} />
                      </li>
                    ))}
                </ul>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      'btn btn-primary btn-sm',
                      !isOfficialDocsUrl(entry.docs) && 'btn-disabled',
                    )}
                  >
                    Official docs
                    <Icon name="external" size="sm" />
                  </span>
                  {entry.context7 && (
                    <span className="btn btn-ghost btn-sm">
                      Context7
                      <Icon name="external" size="sm" />
                    </span>
                  )}
                  {entry.docs && (
                    <span className="mono subtle ml-auto text-xs">{hostOf(entry.docs)}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      );

    case 'Verify':
      return (
        <div>
          <h2 className="sec-h mb-2">Verify checks</h2>
          {draft.verify.map((check, index) => (
            <div
              key={check.key}
              className="grid grid-cols-[32px_minmax(0,1fr)] gap-4 border-t py-3.5 sm:grid-cols-[32px_minmax(0,1fr)_auto]"
            >
              <span className="mono subtle text-xs leading-6">{pad2(index + 1)}</span>
              <p className="text-[15px] leading-6">
                {check.check || <span className="subtle">Empty</span>}
              </p>
              <div className="col-start-2 flex items-start gap-1.5 pt-0.5 sm:col-start-auto">
                <span className="type">{check.type}</span>
                <span className="lens">{LENS_SHORT[check.lens]}</span>
              </div>
            </div>
          ))}
        </div>
      );

    case 'Sources':
      return (
        <div>
          <h2 className="sec-h mb-2">Sources</h2>
          {draft.sources.map((source) => (
            <div key={source.key} className="flex min-h-11 items-center gap-3 border-t py-2">
              <span className="min-w-0 flex-1 text-sm">
                {source.title || <span className="subtle">Title</span>}
              </span>
              {source.url && <span className="mono subtle text-xs">{hostOf(source.url)}</span>}
              <Icon name="external" size="sm" className="subtle" />
            </div>
          ))}
        </div>
      );
  }
}
