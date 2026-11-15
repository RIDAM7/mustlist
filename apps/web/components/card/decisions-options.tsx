'use client';

import { useState } from 'react';
import type { CardJSON } from '@mustlist/schema/types';
import { pad2, splitCode } from '@/lib/format';
import { LABEL_PILL } from '@/lib/status';
import { cn } from '@/lib/utils';
import { Icon } from '../icons';
import { CodeText, Pill } from '../ui';

/**
 * Decisions to make + Options. Picking an answer that favours an option marks
 * that option "Fits your answers", so both sections share one piece of state.
 */
export function DecisionsAndOptions({
  decisions,
  options,
  recommended,
}: Pick<CardJSON, 'decisions' | 'options' | 'recommended'>) {
  const [picks, setPicks] = useState<Record<string, string | null>>(() =>
    Object.fromEntries(decisions.map((d) => [d.id, d.default ?? null])),
  );
  const [openOption, setOpenOption] = useState<string | null>(null);

  const optionName = new Map(options.map((o) => [o.id, o.name]));
  const favoured = new Set(
    decisions.flatMap((d) =>
      d.options.filter((a) => a.id === picks[d.id] && a.points_to).map((a) => a.points_to ?? ''),
    ),
  );
  const columns = options.length === 4 ? 2 : options.length;

  return (
    <>
      {decisions.length > 0 && (
        <section id="decisions" aria-labelledby="decisions-h">
          <div className="mb-5 flex items-baseline justify-between gap-4">
            <h2 id="decisions-h" className="sec-h max-md:text-[18px]">
              Decisions to make
            </h2>
            <span className="t-sm subtle">Asked before building</span>
          </div>
          <div className="flex flex-col gap-7">
            {decisions.map((decision, index) => (
              <div key={decision.id} role="radiogroup" aria-labelledby={`q-${decision.id}`}>
                <p id={`q-${decision.id}`} className="mb-2.5 text-[15px] font-medium leading-6">
                  <span className="mono subtle mr-2.5 text-xs">{pad2(index + 1)}</span>
                  {decision.question}
                </p>
                <div className="grid gap-2 md:grid-cols-2">
                  {decision.options.map((answer) => {
                    const on = picks[decision.id] === answer.id;
                    return (
                      <button
                        key={answer.id}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        className={cn('ans', on && 'ans-on')}
                        onClick={() => setPicks({ ...picks, [decision.id]: answer.id })}
                      >
                        <span className="radio" />
                        <span className="flex flex-1 flex-col">
                          <span>{answer.label}</span>
                          {answer.points_to && optionName.has(answer.points_to) && (
                            <span className="t-xs subtle mt-0.5">
                              Favours {optionName.get(answer.points_to)}
                            </span>
                          )}
                        </span>
                        {decision.default === answer.id && <span className="badge">Default</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {options.length > 0 && (
        <section id="options" aria-labelledby="options-h">
          <div className="mb-5 flex items-baseline justify-between gap-4 max-md:mb-3">
            <h2 id="options-h" className="sec-h max-md:text-[18px]">
              Options
            </h2>
            <span className="t-sm subtle max-md:text-xs">{options.length} compared</span>
          </div>
          <div
            className="grid items-stretch gap-3 max-md:gap-2 md:[grid-template-columns:var(--cols)]"
            style={{ '--cols': `repeat(${columns}, minmax(0, 1fr))` } as React.CSSProperties}
          >
            {options.map((option) => {
              const rec = option.id === recommended;
              const fits = favoured.has(option.id);
              const expanded = rec || openOption === option.id;
              return (
                <div key={option.id} className="contents">
                  {/* Phone: the recommended option is open, the others collapse. */}
                  {!rec && (
                    <button
                      type="button"
                      aria-expanded={expanded}
                      className="opt flex min-h-[52px] w-full cursor-pointer items-center justify-between px-4 py-0 text-left md:hidden"
                      onClick={() => setOpenOption(expanded ? null : option.id)}
                    >
                      <span className="flex flex-col py-3">
                        <span className="text-[15px] font-semibold">{option.name}</span>
                        {fits && <Pill {...LABEL_PILL.fits} className="mt-1.5 self-start" />}
                      </span>
                      <Icon name={expanded ? 'chevronUp' : 'chevronDown'} className="subtle" />
                    </button>
                  )}
                  <div
                    className={cn(
                      'opt flex flex-col gap-4 max-md:gap-3 max-md:p-4',
                      rec && 'opt-rec',
                      !expanded && 'max-md:hidden',
                    )}
                  >
                    <div>
                      {(rec || fits) && (
                        <div
                          className={cn('mb-2.5 flex flex-wrap gap-1.5', !rec && 'max-md:hidden')}
                        >
                          {rec && <Pill pill="p-rec" label="Recommended" />}
                          {fits && <Pill pill="p-accent" label="Fits your answers" />}
                        </div>
                      )}
                      <h3
                        className={cn(
                          'text-[15px] font-semibold leading-[22px]',
                          !rec && 'max-md:hidden',
                        )}
                      >
                        {option.name}
                      </h3>
                      {option.examples && option.examples.length > 0 && (
                        <p className="t-xs subtle mt-1.5">
                          Examples, not endorsements: {option.examples.join(', ')}
                        </p>
                      )}
                    </div>
                    <OptionList title="Best fit when" items={option.best_fit_when} />
                    <OptionList title="Avoid when" items={option.avoid_when} />
                    <OptionList title="Trade-offs" items={option.tradeoffs} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </>
  );
}

function OptionList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <div className="label">{title}</div>
      <ul>
        {items.map((item) => (
          <li key={item}>
            <CodeText parts={splitCode(item)} />
          </li>
        ))}
      </ul>
    </div>
  );
}
