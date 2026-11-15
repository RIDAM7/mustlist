import Link from 'next/link';
import { BASE_PATH, LENSES, LENS_TITLES, type Lens } from '@mustlist/schema/constants';
import { stackTitle } from '@mustlist/schema/site';
import type { CardJSON } from '@mustlist/schema/types';
import { reviewLabel, tocItems } from '@/lib/card';
import { getIndex } from '@/lib/data';
import { hostOf, pad2 } from '@/lib/format';
import { renderInline, renderMarkdown } from '@/lib/markdown';
import { CARD_STATUS } from '@/lib/status';
import { topicName } from '@/lib/topics';
import { cn } from '@/lib/utils';
import { Icon } from '../icons';
import { DecisionsAndOptions } from './decisions-options';
import { LensSections, type LensBlock } from './lens-sections';
import { Toc, TocSelect } from './toc';
import { VersionNotes } from './version-notes';

const LENS_SHORT: Record<Lens, string> = {
  security: 'Security',
  performance: 'Performance',
  ux: 'UX flows',
  data: 'Data model',
  cost: 'Cost',
};

/** Lens tag text in checklist and verify rows. */
const LENS_TAG: Record<Lens, string> = {
  security: 'Security',
  performance: 'Performance',
  ux: 'UX',
  data: 'Data',
  cost: 'Cost',
};

function Html({ html, className }: { html: string; className?: string }) {
  return <span className={cn('md-inline', className)} dangerouslySetInnerHTML={{ __html: html }} />;
}

/**
 * The accepted knowledge, ready for an agent: summary, checklist, decisions,
 * options, why, lenses, version notes, verify checks, mistakes, sources, related.
 * Used by the card page (lens tabs) and the proposal preview (lens sections).
 */
export function CardBody({
  card,
  lensMode = 'tabs',
  toc = true,
}: {
  card: CardJSON;
  lensMode?: 'tabs' | 'stack';
  toc?: boolean;
}) {
  const items = tocItems(card);
  const musts = card.checklist.filter((item) => item.level === 'must');
  const shoulds = card.checklist.filter((item) => item.level === 'should');
  const lenses: LensBlock[] = LENSES.filter((lens) => card.body.lenses[lens]).map((lens) => ({
    id: lens,
    short: LENS_SHORT[lens],
    title: LENS_TITLES[lens],
    html: renderMarkdown(card.body.lenses[lens] ?? ''),
  }));
  const index = new Map(getIndex().map((entry) => [entry.id, entry]));
  const stack = card.id.split('/')[1] ?? '';

  return (
    <div className={cn('grid items-start gap-16', toc && 'lg:grid-cols-[minmax(0,1fr)_208px]')}>
      <article className="flex min-w-0 flex-col gap-16 max-md:gap-10">
        {toc && <TocSelect items={items} />}

        <section id="summary" aria-label="Summary">
          <p className="rounded-lg bg-bg-subtle px-7 py-6 text-[19px] leading-[30px] tracking-[-0.006em] max-md:px-[18px] max-md:py-4 max-md:text-[17px] max-md:leading-[27px]">
            {card.summary}
          </p>
          <div className="t-sm mt-4 flex flex-wrap gap-x-6 gap-y-2">
            {card.applies_when.app_types.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="subtle mr-0.5">For</span>
                {card.applies_when.app_types.map((type) => (
                  <span key={type} className="tag mono">
                    {type}
                  </span>
                ))}
              </div>
            )}
            {card.applies_when.not_for.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="subtle mr-0.5">Not for</span>
                {card.applies_when.not_for.map((type) => (
                  <span key={type} className="tag mono">
                    {type}
                  </span>
                ))}
              </div>
            )}
          </div>
        </section>

        <section id="checklist" aria-labelledby="checklist-h">
          <div className="flex items-baseline justify-between gap-4 max-md:flex-col max-md:gap-0.5">
            <h2 id="checklist-h" className="sec-h max-md:text-[18px]">
              Must-have checklist
            </h2>
            <span className="t-sm subtle max-md:text-xs">
              {musts.length} must · {shoulds.length} should
            </span>
          </div>
          <ChecklistGroup title="Must" items={musts} start={0} first />
          {shoulds.length > 0 && (
            <ChecklistGroup title="Should" items={shoulds} start={musts.length} />
          )}
        </section>

        <DecisionsAndOptions
          decisions={card.decisions}
          options={card.options}
          recommended={card.recommended}
        />

        {card.body.why && (
          <section id="why" aria-labelledby="why-h">
            <h2 id="why-h" className="sec-h mb-3 max-md:text-[18px]">
              Why this approach
            </h2>
            <div
              className="md prose"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(card.body.why) }}
            />
          </section>
        )}

        {lenses.length > 0 && (
          <section id="lenses" aria-labelledby="lenses-h">
            <h2 id="lenses-h" className="sec-h mb-4 max-md:text-[18px]">
              Lenses
            </h2>
            <LensSections lenses={lenses} mode={lensMode} />
          </section>
        )}

        {card.versions.length > 0 && (
          <VersionNotes
            entries={card.versions.map((entry) => ({
              package: entry.package,
              range: entry.range,
              notes: entry.notes.map(renderInline),
              docs: entry.docs,
              context7: entry.context7,
            }))}
          />
        )}

        <section id="verify" aria-labelledby="verify-h">
          <div className="mb-2 flex items-baseline justify-between gap-4">
            <h2 id="verify-h" className="sec-h max-md:text-[18px]">
              Verify checks
            </h2>
            <span className="t-sm subtle">{card.verify.length} checks</span>
          </div>
          {card.verify.map((check, i) => (
            <div
              key={check.id}
              className="grid grid-cols-[32px_minmax(0,1fr)_auto] gap-4 border-t py-3.5 max-md:grid-cols-[auto_1fr] max-md:gap-x-2 max-md:gap-y-1"
            >
              <span className="mono subtle text-xs leading-6">{pad2(i + 1)}</span>
              <p className="text-[15px] leading-6 max-md:order-3 max-md:col-span-2">
                {check.check}
              </p>
              <div className="flex items-start gap-1.5 pt-0.5 max-md:order-2 max-md:pt-0.5">
                <span className="type">{check.type}</span>
                <span className="lens">{LENS_TAG[check.lens]}</span>
              </div>
            </div>
          ))}
        </section>

        {card.body.mistakes && (
          <section id="mistakes" aria-labelledby="mistakes-h">
            <h2 id="mistakes-h" className="sec-h mb-2 max-md:text-[18px]">
              Common mistakes
            </h2>
            <div
              className="md prose"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(card.body.mistakes) }}
            />
          </section>
        )}

        <section id="sources" aria-labelledby="sources-h">
          <div className="mb-2 flex items-baseline justify-between gap-4">
            <h2 id="sources-h" className="sec-h max-md:text-[18px]">
              Sources
            </h2>
            <span className="t-sm subtle">{card.sources.length} sources</span>
          </div>
          {card.sources.map((source) => (
            <a
              key={source.url}
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-11 items-center gap-3 border-t py-2 hover:text-accent-text"
            >
              <span className="min-w-0 flex-1 text-sm">{source.title}</span>
              <span className="mono subtle text-xs max-md:hidden">{hostOf(source.url)}</span>
              <Icon name="external" size="sm" className="subtle" />
            </a>
          ))}
          {card.body.further_reading && (
            <div
              className="md prose t-sm mt-4"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(card.body.further_reading) }}
            />
          )}
        </section>

        {card.related.length > 0 && (
          <section id="related" aria-labelledby="related-h">
            <h2 id="related-h" className="sec-h mb-4 max-md:text-[18px]">
              Related cards
            </h2>
            <div className="grid gap-3 md:grid-cols-2">
              {card.related.map((id) => {
                const entry = index.get(id);
                const [topic = '', relatedStack = ''] = id.split('/');
                if (!entry) {
                  return (
                    <div
                      key={id}
                      className="tile flex flex-col gap-2 hover:border-border hover:bg-surface"
                    >
                      <span className="text-sm font-medium">{topicName(topic)}</span>
                      <span className="flex items-center justify-between gap-2">
                        <span className="t-sm subtle">{stackTitle(relatedStack)}</span>
                        <span className="pill p-outline">Not in library</span>
                      </span>
                    </div>
                  );
                }
                const status = CARD_STATUS[entry.status];
                return (
                  <Link key={id} href={`/${id}`} className="tile flex flex-col gap-2">
                    <span className="text-sm font-medium">{topicName(entry.topic)}</span>
                    <span className="flex items-center justify-between gap-2">
                      <span className="t-sm subtle">{stackTitle(relatedStack)}</span>
                      <span className={cn('pill', status.pill)}>{status.label}</span>
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>
        )}
      </article>

      {toc && (
        <aside className="sticky top-6 hidden flex-col gap-6 lg:flex">
          <Toc items={items} />
          <dl className="t-sm m-0 grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 border-t pt-5">
            <dt className="subtle">Version</dt>
            <dd className="mono m-0 text-xs leading-5">v{card.card_version}</dd>
            <dt className="subtle">Review</dt>
            <dd className="m-0">{reviewLabel(card)}</dd>
            <dt className="subtle">Licence</dt>
            <dd className="m-0">CC BY 4.0</dd>
            <dt className="subtle">Raw</dt>
            <dd className="m-0">
              <a href={`${BASE_PATH}/${card.id}.md`} className="link mono text-xs">
                {stack}.md
              </a>
            </dd>
          </dl>
        </aside>
      )}
    </div>
  );
}

function ChecklistGroup({
  title,
  items,
  start,
  first = false,
}: {
  title: string;
  items: CardJSON['checklist'];
  start: number;
  first?: boolean;
}) {
  return (
    <>
      <div className={cn('label pb-2', first ? 'pt-5' : 'pt-7')}>{title}</div>
      {items.map((item, i) => (
        <div key={item.id} className="ck max-md:grid-cols-[auto_1fr] max-md:gap-x-2 max-md:gap-y-1">
          <span className="mono subtle text-xs leading-6">{pad2(start + i + 1)}</span>
          <div className="min-w-0 max-md:order-3 max-md:col-span-2">
            <p className="ck-t">
              <Html html={renderInline(item.text)} />
            </p>
            {item.why && <p className="ck-w">{item.why}</p>}
          </div>
          <span className="lens mt-0.5 justify-self-start max-md:order-2">
            {LENS_TAG[item.lens]}
          </span>
        </div>
      ))}
    </>
  );
}
