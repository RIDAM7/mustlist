import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { LENSES, LENS_TITLES } from '@mustlist/schema/constants';
import { stackTitle } from '@mustlist/schema/site';
import type { CardJSON } from '@mustlist/schema/types';
import { Icon } from '@/components/icons';
import { JsonLd } from '@/components/json-ld';
import {
  AvatarStack,
  Crumbs,
  NeedBox,
  SampleBadge,
  SectionHead,
  handleList,
} from '@/components/ui';
import { approvalCount, countComments, proposalsForTopic, requestsForTopic } from '@/lib/community';
import { loadCommunity } from '@/lib/community/load';
import { getCard, getIndex, getTopics } from '@/lib/data';
import { formatDate, formatShortDate } from '@/lib/format';
import { breadcrumbJsonLd, collectionJsonLd, isIndexable, robotsFor, truncate } from '@/lib/seo';
import { LIBRARY_URL, SITE_NAME } from '@/lib/site';
import {
  CARD_STATUS,
  CHECKS_STATE,
  PROPOSAL_STATUS,
  PROPOSAL_TYPE,
  REQUEST_STATUS,
} from '@/lib/status';
import { stackName, techName, topicLead, topicName } from '@/lib/topics';
import { cn } from '@/lib/utils';

export function generateStaticParams() {
  return getTopics().map(({ topic }) => ({ topic }));
}

// Topic pages are prerendered; blocking lets unknown topics return a real 404 status.
export const instant = false;

function topicCards(topic: string): CardJSON[] {
  return getIndex()
    .filter((card) => card.topic === topic)
    .map((card) => getCard(card.id))
    .filter((card): card is CardJSON => Boolean(card));
}

export async function generateMetadata({ params }: PageProps<'/[topic]'>): Promise<Metadata> {
  const { topic } = await params;
  const cards = topicCards(topic);
  if (cards.length === 0) return {};
  return {
    title: { absolute: `${topicName(topic)}: build it properly | ${SITE_NAME}` },
    description: `Reviewed cards for building ${topicName(topic).toLowerCase()} properly, by stack.`,
    alternates: { canonical: `${LIBRARY_URL}/${topic}` },
    // A topic page is only worth indexing once it has a reviewed card.
    robots: robotsFor(cards.some((card) => isIndexable(card.status))),
  };
}

/** Every stack for one feature, plus what people are asking for. */
export default async function TopicPage({ params }: PageProps<'/[topic]'>) {
  const { topic } = await params;
  const cards = topicCards(topic);
  if (cards.length === 0) notFound();
  const url = `${LIBRARY_URL}/${topic}`;
  const community = await loadCommunity();
  const sample = community.source === 'sample';
  const requests = requestsForTopic(community, topic);
  const proposals = proposalsForTopic(community, topic);
  const lenses = LENSES.filter((lens) =>
    cards.some((c) => c.checklist.some((item) => item.lens === lens)),
  );
  const reviewers = [...new Set(cards.flatMap((c) => c.reviewers))];
  const name = topicName(topic);

  return (
    <div className="wrap pb-24 pt-6 md:pt-8">
      <JsonLd data={collectionJsonLd(name, url, cards)} />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Library', url: LIBRARY_URL },
          { name, url },
        ])}
      />
      <Crumbs items={[{ name: 'Library', href: '/' }, { name }]} />

      <div className="mt-4 flex flex-wrap items-end justify-between gap-6">
        <div>
          <h1 className="t-h1 max-md:text-[30px] max-md:leading-9">{name}</h1>
          <p className="t-lead muted mt-2 max-md:text-base">
            {topicLead(topic, cards[0]?.summary)}
          </p>
          <div className="mono subtle mt-2 text-xs">/library/{topic}</div>
        </div>
        <Link href={`/requests/new?topic=${topic}`} className="btn btn-secondary">
          <Icon name="plus" />
          Request another stack
        </Link>
      </div>

      <div className="mt-12 flex flex-wrap gap-12 max-md:mt-8 max-md:gap-10">
        <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-12 max-md:gap-10">
          <section>
            <SectionHead title="Cards" count={cards.length} small />
            <div className="rows">
              {cards.map((card) => {
                const stack = card.id.split('/')[1] ?? '';
                const status = CARD_STATUS[card.status];
                return (
                  <Link
                    key={card.id}
                    href={`/${card.id}`}
                    className="row items-start gap-4 px-5 py-4 max-md:flex-col max-md:gap-3 max-md:px-4"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="row-title text-[15px]">{card.title}</div>
                      <div className="t-sm muted mt-1">{truncate(card.summary, 120)}</div>
                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        {card.stack.map((slug) => (
                          <span key={slug} className="tag">
                            {techName(slug)}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2 max-md:flex-row max-md:items-center">
                      <span className={cn('pill', status.pill)}>{status.label}</span>
                      <span className="t-xs subtle">
                        v{card.card_version}
                        {card.last_verified && ` · ${formatDate(card.last_verified)}`}
                      </span>
                      {card.reviewers.length > 0 && (
                        <AvatarStack handles={card.reviewers} size="sm" />
                      )}
                      <span className="sr-only">{stackTitle(stack)}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>

          {requests.length > 0 && (
            <section>
              <SectionHead
                title={
                  <span className="flex items-baseline gap-2">
                    Open requests {sample && <SampleBadge />}
                  </span>
                }
                count={requests.length}
                small
              />
              <div className="rows">
                {requests.map((r) => {
                  const status = REQUEST_STATUS[r.status];
                  return (
                    <Link key={r.number} href={`/requests/${r.number}`} className="row">
                      <NeedBox need={r.need} />
                      <div className="min-w-0 flex-1">
                        <div className="row-title">{r.title}</div>
                        <div className="t-sm subtle">
                          #{r.number} · @{r.author} · {formatShortDate(r.created)}
                        </div>
                      </div>
                      <span className="meta max-md:hidden">
                        <Icon name="comment" size="sm" />
                        {countComments(r.comments)}
                      </span>
                      <span className={cn('pill', status.pill)}>{status.label}</span>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

          {proposals.length > 0 && (
            <section>
              <SectionHead
                title={
                  <span className="flex items-baseline gap-2">
                    Open proposals {sample && <SampleBadge />}
                  </span>
                }
                count={proposals.length}
                small
              />
              <div className="rows">
                {proposals.map((p) => {
                  const checks = CHECKS_STATE[p.checks];
                  const status = PROPOSAL_STATUS[p.status];
                  return (
                    <Link key={p.number} href={`/proposals/${p.number}`} className="row">
                      <span className="tag w-[72px] justify-center max-md:hidden">
                        {PROPOSAL_TYPE[p.type].split(' ')[0]}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="row-title">{p.title}</div>
                        <div className="t-sm subtle">
                          #{p.number} · @{p.author} · {approvalCount(p)} of 2 approvals
                        </div>
                      </div>
                      <span className={cn('meta max-md:hidden', checks.glyph)}>
                        <Icon
                          name={
                            p.checks === 'passing'
                              ? 'checkCircle'
                              : p.checks === 'failing'
                                ? 'xCircle'
                                : 'spinner'
                          }
                          size="sm"
                          className={p.checks === 'running' ? 'spin' : undefined}
                        />
                        {checks.label}
                      </span>
                      <span className={cn('pill', status.pill)}>{status.label}</span>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}
        </div>

        <aside className="flex flex-[1_1_260px] flex-col gap-7">
          <div>
            <div className="label mb-2.5">Stacks</div>
            <div className="t-sm flex flex-col gap-2">
              {cards.map((card) => {
                const status = CARD_STATUS[card.status];
                return (
                  <Link
                    key={card.id}
                    href={`/${card.id}`}
                    className="flex justify-between gap-2 hover:text-accent-text"
                  >
                    <span>{stackTitle(card.id.split('/')[1] ?? '')}</span>
                    <span className={cn('pill', status.pill)}>{status.label}</span>
                  </Link>
                );
              })}
              {requests.map((r) => (
                <Link
                  key={r.number}
                  href={`/requests/${r.number}`}
                  className="flex justify-between gap-2 hover:text-accent-text"
                >
                  <span>{stackName(r.stack)}</span>
                  <span className={cn('pill', REQUEST_STATUS[r.status].pill)}>
                    {REQUEST_STATUS[r.status].label}
                  </span>
                </Link>
              ))}
            </div>
          </div>
          <div>
            <div className="label mb-2.5">Lenses</div>
            <div className="flex flex-wrap gap-1.5">
              {lenses.map((lens) => (
                <span key={lens} className="lens">
                  {LENS_TITLES[lens]
                    .replace(' & latency', '')
                    .replace(' flows', '')
                    .replace(' model', '')}
                </span>
              ))}
            </div>
          </div>
          <div>
            <div className="label mb-2.5">Reviewers</div>
            {reviewers.length > 0 ? (
              <div className="flex items-center gap-2">
                <AvatarStack handles={reviewers} link />
                <span className="t-sm muted">{handleList(reviewers)}</span>
              </div>
            ) : (
              <p className="t-sm subtle">None yet</p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
