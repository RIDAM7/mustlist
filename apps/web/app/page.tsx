import type { Metadata } from 'next';
import Link from 'next/link';
import { stackTitle } from '@mustlist/schema/site';
import type { CardIndexEntry } from '@mustlist/schema/types';
import { HomeSearch } from '@/components/home-search';
import { Icon } from '@/components/icons';
import { JsonLd } from '@/components/json-ld';
import { EmptyState, NeedBox, SampleBadge } from '@/components/ui';
import { shortTitle, topicStatus } from '@/lib/card';
import { countComments, mostWanted, requestProposalMeta } from '@/lib/community';
import { loadCommunity } from '@/lib/community/load';
import { getIndex, getStacks, getTopics } from '@/lib/data';
import { formatShortDate } from '@/lib/format';
import { breadcrumbJsonLd, collectionJsonLd } from '@/lib/seo';
import { LIBRARY_URL, SITE_NAME, SITE_PITCH, SITE_TAGLINE } from '@/lib/site';
import { CARD_STATUS, REQUEST_STATUS } from '@/lib/status';
import { topicLine, topicName } from '@/lib/topics';
import { cn } from '@/lib/utils';

export const metadata: Metadata = {
  title: { absolute: `${SITE_NAME}: ${SITE_TAGLINE}` },
  description: SITE_PITCH,
  alternates: { canonical: LIBRARY_URL },
};

const stackOf = (card: CardIndexEntry) => card.id.split('/')[1] ?? '';

function latest(cards: CardIndexEntry[]) {
  const verified = cards
    .filter((c) => c.status === 'verified' || c.status === 'stale')
    .sort((a, b) => (b.last_verified ?? '').localeCompare(a.last_verified ?? ''));
  return verified.length > 0
    ? { title: 'Latest verified', cards: verified.slice(0, 5) }
    : {
        title: 'Latest cards',
        cards: [...cards].sort((a, b) => a.title.localeCompare(b.title)).slice(0, 5),
      };
}

export default async function LibraryHome() {
  const community = await loadCommunity();
  const cards = getIndex();
  const byId = new Map(cards.map((card) => [card.id, card]));
  const topics = getTopics().map((topic) => {
    const topicCards = topic.cards
      .map((id) => byId.get(id))
      .filter((c): c is CardIndexEntry => Boolean(c));
    const status = CARD_STATUS[topicStatus(topicCards)];
    return {
      slug: topic.topic,
      name: topicName(topic.topic),
      line: topicLine(topic.topic, topicCards[0]?.summary ?? ''),
      stacks: topicCards.map((c) => stackTitle(stackOf(c))),
      status,
    };
  });
  const stacks = getStacks().map((s) => stackTitle(s.stack));
  const recent = latest(cards);
  const wanted = mostWanted(community, 4);

  return (
    <>
      <JsonLd data={collectionJsonLd(`${SITE_NAME} library`, LIBRARY_URL, cards)} />
      <JsonLd data={breadcrumbJsonLd([{ name: 'Library', url: LIBRARY_URL }])} />

      <section className="wrap pb-10 pt-10 md:pb-[72px] md:pt-[88px]">
        <h1 className="t-display max-w-[760px] max-md:text-[30px] max-md:leading-9 max-md:tracking-[-0.025em]">
          Reviewed “build it properly” cards for AI coding agents.
        </h1>
        <p className="t-lead muted mt-3 max-w-[640px] max-md:text-base max-md:leading-6 md:mt-4">
          What to build, what you forgot to ask for, and how to check it.
        </p>
        <HomeSearch className="mt-6 max-w-[720px] md:mt-8" />
        <div className="mt-3 flex items-center gap-2 overflow-x-auto md:mt-4 md:flex-wrap">
          <span className="t-sm subtle hidden md:inline">Popular</span>
          {topics.slice(0, 4).map((topic) => (
            <Link key={topic.slug} href={`/${topic.slug}`} className="tag max-md:h-8">
              {topic.name}
            </Link>
          ))}
        </div>
      </section>

      <section className="wrap pb-10 md:pb-[72px]" aria-labelledby="topics-h">
        <div className="mb-3 flex items-baseline justify-between md:mb-4">
          <h2 id="topics-h" className="sec-h max-md:text-[18px]">
            Topics
          </h2>
          <Link
            href="/stacks"
            className="t-sm muted inline-flex items-center gap-1 hover:text-fg max-md:leading-[44px]"
          >
            All stacks <Icon name="chevronRight" size="sm" className="max-md:hidden" />
          </Link>
        </div>

        {/* Desktop: tiles */}
        <div className="hidden grid-cols-3 gap-4 md:grid">
          {topics.map((topic) => (
            <Link
              key={topic.slug}
              href={`/${topic.slug}`}
              className="tile flex min-h-[148px] flex-col gap-2.5 p-5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-base font-semibold">{topic.name}</span>
                <span className={cn('pill', topic.status.pill)}>{topic.status.label}</span>
              </div>
              <p className="t-sm muted flex-1">{topic.line}</p>
              <div className="flex flex-wrap gap-1.5">
                {topic.stacks.map((stack) => (
                  <span key={stack} className="tag">
                    {stack}
                  </span>
                ))}
              </div>
            </Link>
          ))}
          <Link
            href="/stacks"
            className="tile box-dash flex min-h-[148px] flex-col justify-center gap-1 bg-transparent p-5"
          >
            <span className="text-[15px] font-medium">Browse by stack</span>
            <span className="t-sm subtle">{stacks.join(' · ')}</span>
          </Link>
        </div>

        {/* Phone: rows */}
        <div className="rows md:hidden">
          {topics.map((topic) => (
            <Link key={topic.slug} href={`/${topic.slug}`} className="row items-start px-4 py-3.5">
              <div className="min-w-0 flex-1">
                <span className="row-title text-[15px]">{topic.name}</span>
                <p className="t-sm muted mt-0.5">{topic.line}</p>
                <div className="t-xs subtle mt-1.5">{topic.stacks.join(' · ')}</div>
              </div>
              <span className={cn('pill', topic.status.pill)}>{topic.status.label}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="wrap grid gap-10 pb-10 md:grid-cols-2 md:gap-8 md:pb-[72px]">
        <div>
          <div className="mb-3 flex items-baseline justify-between md:mb-4">
            <h2 className="sec-h max-md:text-[18px]">{recent.title}</h2>
            <Link href="/activity" className="t-sm muted hover:text-fg max-md:hidden">
              Activity
            </Link>
          </div>
          <div className="rows">
            {recent.cards.map((card) => {
              const status = CARD_STATUS[card.status];
              return (
                <Link key={card.id} href={`/${card.id}`} className="row">
                  <div className="min-w-0 flex-1">
                    <div className="row-title">{shortTitle(card.title)}</div>
                    <div className="t-sm subtle">
                      {stackTitle(stackOf(card))}
                      <span className="max-md:hidden">
                        {' · '}
                        <span className="mono text-xs">v{card.card_version}</span>
                      </span>
                      {card.last_verified && (
                        <span className="md:hidden"> · {formatShortDate(card.last_verified)}</span>
                      )}
                    </div>
                  </div>
                  {card.last_verified && (
                    <span className="t-sm subtle max-md:hidden">
                      {formatShortDate(card.last_verified)}
                    </span>
                  )}
                  <span className="mono subtle text-xs md:hidden">v{card.card_version}</span>
                  <span className={cn('pill max-md:hidden', status.pill)}>{status.label}</span>
                </Link>
              );
            })}
          </div>
        </div>

        <div>
          <div className="mb-3 flex items-baseline justify-between md:mb-4">
            <div className="flex items-baseline gap-2">
              <h2 className="sec-h max-md:text-[18px]">Most wanted</h2>
              {community.source === 'sample' && <SampleBadge />}
            </div>
            <Link href="/requests" className="t-sm muted hover:text-fg max-md:leading-[44px]">
              All requests
            </Link>
          </div>
          {wanted.length === 0 && (
            <EmptyState icon="inbox" title="No requests yet" className="py-8 md:py-10">
              <Link href="/requests/new" className="btn btn-secondary btn-sm">
                Request a card
              </Link>
            </EmptyState>
          )}
          <div className={cn('rows', wanted.length === 0 && 'hidden')}>
            {wanted.map((request) => {
              const status = REQUEST_STATUS[request.status];
              const meta =
                request.proposals.length > 0
                  ? requestProposalMeta(community, request)
                  : `${countComments(request.comments)} replies`;
              return (
                <Link key={request.number} href={`/requests/${request.number}`} className="row">
                  <NeedBox need={request.need} />
                  <div className="min-w-0 flex-1">
                    <div className="row-title">{request.title}</div>
                    <div className="t-sm subtle max-md:hidden">{meta}</div>
                    <div className="mt-1 md:hidden">
                      <span className={cn('pill', status.pill)}>{status.label}</span>
                    </div>
                  </div>
                  <span className={cn('pill max-md:hidden', status.pill)}>{status.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section className="wrap grid gap-3 pb-12 md:grid-cols-2 md:gap-4 md:pb-24">
        <div className="panel flex items-center gap-4 p-6 max-md:flex-col max-md:items-stretch max-md:p-5">
          <div className="flex-1">
            <div className="text-[15px] font-semibold">Missing a card?</div>
            <div className="t-sm muted max-md:mt-0.5">
              Feature + stack. Others add “Need this too”.
            </div>
          </div>
          <Link
            href="/requests/new"
            className="btn btn-secondary max-md:mt-4 max-md:h-11 max-md:w-full"
          >
            Request a card
          </Link>
        </div>
        <div className="panel flex items-center gap-4 p-6 max-md:flex-col max-md:items-stretch max-md:p-5">
          <div className="flex-1">
            <div className="text-[15px] font-semibold">Connect your agent</div>
            <div className="t-sm muted max-md:mt-0.5">
              <span className="mono text-xs">MCP · llms.txt · API</span>
              <span className="max-md:hidden"> — verified cards only.</span>
            </div>
          </div>
          <Link href="/connect" className="btn btn-secondary max-md:mt-4 max-md:h-11 max-md:w-full">
            Connect
          </Link>
        </div>
      </section>
    </>
  );
}
