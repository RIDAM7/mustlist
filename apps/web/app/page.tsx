import type { Metadata } from 'next';
import Link from 'next/link';
import { stackTitle } from '@mustlist/schema/site';
import type { CardIndexEntry } from '@mustlist/schema/types';
import { AgentCard } from '@/components/agent-card';
import { AGENT_BRANDS, BrandMark } from '@/components/brand-marks';
import { HomeSearch } from '@/components/home-search';
import { Icon } from '@/components/icons';
import { JsonLd } from '@/components/json-ld';
import { EmptyState, NeedBox, Pill, SampleBadge } from '@/components/ui';
import { shortTitle, topicStatus } from '@/lib/card';
import { countComments, mostWanted, requestProposalMeta } from '@/lib/community';
import { loadCommunity } from '@/lib/community/load';
import { getIndex, getStacks, getTopics } from '@/lib/data';
import { formatShortDate } from '@/lib/format';
import { breadcrumbJsonLd, collectionJsonLd } from '@/lib/seo';
import { LIBRARY_URL, SITE_NAME, SITE_PITCH, SITE_TAGLINE } from '@/lib/site';
import { CARD_STATUS, REQUEST_STATUS } from '@/lib/status';
import { topicLine, topicName } from '@/lib/topics';

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

      <section className="hero">
        <div className="wrap flex flex-wrap items-start gap-10 pb-8 pt-7 md:pb-14 md:pt-14">
          <div className="flex min-w-0 flex-[999_1_460px] flex-col gap-5 md:pt-4">
            <h1 className="t-display max-w-[600px]">
              Reviewed “build it properly” cards for AI coding agents.
            </h1>
            <p className="t-lead max-w-[560px]">
              What to build, what you forgot to ask for, and how to check it.
            </p>
            <HomeSearch className="mt-2 max-w-[560px]" />
            <div className="flex flex-wrap items-center gap-2">
              <span className="meta mr-0.5">Popular</span>
              {topics.slice(0, 4).map((topic) => (
                <Link
                  key={topic.slug}
                  href={`/${topic.slug}`}
                  className="tag h-[30px] px-3 text-[13px]"
                >
                  {topic.name}
                </Link>
              ))}
            </div>
          </div>
          <div className="w-full min-w-0 max-w-[520px] flex-[1_1_420px]">
            <AgentCard mcpUrl={`${LIBRARY_URL}/mcp`} />
          </div>
        </div>
      </section>

      <div className="wrap pb-14">
        <section className="pt-2" aria-labelledby="topics-h">
          <div className="mb-3.5 flex items-baseline justify-between gap-3">
            <h2 id="topics-h" className="t-h2">
              Topics
            </h2>
            <Link href="/stacks" className="link t-sm inline-flex items-center gap-0.5">
              All stacks <Icon name="chevronRight" size="sm" />
            </Link>
          </div>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(300px,100%),1fr))] gap-3">
            {topics.map((topic) => (
              <Link key={topic.slug} href={`/${topic.slug}`} className="tile">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="t-h3">{topic.name}</h3>
                  <Pill pill={topic.status.pill} label={topic.status.label} />
                </div>
                <p className="t-sm muted">{topic.line}</p>
                <div className="mt-auto flex flex-wrap gap-1.5 pt-1.5">
                  {topic.stacks.map((stack) => (
                    <span key={stack} className="tag">
                      {stack}
                    </span>
                  ))}
                </div>
              </Link>
            ))}
            <Link href="/stacks" className="tile box-dash justify-between">
              <div className="flex items-center justify-between gap-3">
                <h3 className="t-h3">Browse by stack</h3>
                <Icon name="arrowRight" className="subtle" />
              </div>
              <p className="t-sm muted">{stacks.join(' · ')}</p>
            </Link>
          </div>
        </section>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(440px,100%),1fr))] gap-x-8 gap-y-9 pt-9 md:pt-12">
          <section aria-labelledby="latest-h">
            <div className="mb-3.5 flex items-baseline justify-between gap-3">
              <h2 id="latest-h" className="t-h2">
                {recent.title}
              </h2>
              <Link href="/activity" className="link t-sm">
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
                      <div className="meta">
                        {stackTitle(stackOf(card))} ·{' '}
                        <span className="mono">v{card.card_version}</span>
                      </div>
                    </div>
                    {card.last_verified && (
                      <span className="meta shrink-0">{formatShortDate(card.last_verified)}</span>
                    )}
                    <Pill pill={status.pill} label={status.label} />
                  </Link>
                );
              })}
            </div>
          </section>

          <section aria-labelledby="wanted-h">
            <div className="mb-3.5 flex items-baseline justify-between gap-3">
              <div className="flex items-baseline gap-2">
                <h2 id="wanted-h" className="t-h2">
                  Most wanted
                </h2>
                {community.source === 'sample' && <SampleBadge />}
              </div>
              <Link href="/requests" className="link t-sm">
                All requests
              </Link>
            </div>
            {wanted.length === 0 ? (
              <EmptyState icon="inbox" title="No requests yet" className="md:min-h-[310px]">
                <Link href="/requests/new" className="btn btn-secondary btn-sm">
                  Request a card
                </Link>
              </EmptyState>
            ) : (
              <div className="rows">
                {wanted.map((request) => {
                  const status = REQUEST_STATUS[request.status];
                  const meta =
                    request.proposals.length > 0
                      ? requestProposalMeta(community, request)
                      : `${countComments(request.comments)} replies`;
                  return (
                    <Link
                      key={request.number}
                      href={`/requests/${request.number}`}
                      className="row gap-4"
                    >
                      <NeedBox need={request.need} />
                      <div className="min-w-0 flex-1">
                        <div className="row-title">{request.title}</div>
                        <div className="meta">{meta}</div>
                      </div>
                      <Pill pill={status.pill} label={status.label} className="max-sm:hidden" />
                    </Link>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(440px,100%),1fr))] gap-x-8 gap-y-4 pt-9 md:pt-12">
          <div className="banner flex-wrap justify-between gap-x-4 gap-y-3 px-5 py-4">
            <div className="flex flex-col gap-0.5">
              <p className="strong text-sm">Missing a card?</p>
              <p className="t-sm muted">Feature + stack. Others add “Need this too”.</p>
            </div>
            <Link href="/requests/new" className="btn btn-secondary">
              Request a card
            </Link>
          </div>
          <div className="banner flex-wrap justify-between gap-x-4 gap-y-3 px-5 py-4">
            <div className="flex flex-col gap-0.5">
              <p className="strong text-sm">Connect your agent</p>
              <p className="t-sm muted">
                <span className="mono">MCP · llms.txt · API</span> — verified cards only.
              </p>
            </div>
            <Link href="/connect" className="btn btn-secondary">
              Connect
            </Link>
          </div>
        </div>

        <section className="pt-9 md:pt-12" aria-label="Works with">
          <div className="works border-t pt-5">
            <span className="label">Works with</span>
            {AGENT_BRANDS.map((brand) => (
              <span key={brand.id} className="works-i">
                <BrandMark id={brand.id} />
                {brand.name}
              </span>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
