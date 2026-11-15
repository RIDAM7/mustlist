import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { stackTitle } from '@mustlist/schema/site';
import { JsonLd } from '@/components/json-ld';
import { StackCards } from '@/components/stack-cards';
import { Crumbs, NeedBox, SampleBadge } from '@/components/ui';
import { isSampleData, requestProposalMeta, requestsForStack } from '@/lib/community';
import { getIndex, getStacks, splitId } from '@/lib/data';
import { formatDate } from '@/lib/format';
import { breadcrumbJsonLd, collectionJsonLd, isIndexable, robotsFor } from '@/lib/seo';
import { LIBRARY_URL, SITE_NAME } from '@/lib/site';
import { CARD_STATUS, REQUEST_STATUS } from '@/lib/status';
import { topicName } from '@/lib/topics';
import { cn } from '@/lib/utils';

export function generateStaticParams() {
  return getStacks().map(({ stack }) => ({ stack }));
}

// Stack pages are prerendered; blocking lets unknown stacks return a real 404 status.
export const instant = false;

function stackCards(stack: string) {
  return getIndex().filter((card) => splitId(card.id).stack === stack);
}

const STATUS_RANK = { verified: 0, stale: 1, proposed: 2, draft: 3 } as const;

export async function generateMetadata({
  params,
}: PageProps<'/stacks/[stack]'>): Promise<Metadata> {
  const { stack } = await params;
  const cards = stackCards(stack);
  if (cards.length === 0) return {};
  return {
    title: { absolute: `${stackTitle(stack)}: build it properly | ${SITE_NAME}` },
    description: `Reviewed cards for features built with ${stackTitle(stack)}.`,
    alternates: { canonical: `${LIBRARY_URL}/stacks/${stack}` },
    robots: robotsFor(cards.some((card) => isIndexable(card.status))),
  };
}

/** Everything for one stack. */
export default async function StackPage({ params }: PageProps<'/stacks/[stack]'>) {
  const { stack } = await params;
  const cards = stackCards(stack);
  if (cards.length === 0) notFound();
  const url = `${LIBRARY_URL}/stacks/${stack}`;
  const name = stackTitle(stack);
  const techs = [...new Set(cards.flatMap((card) => card.stack))];
  const requests = requestsForStack(stack);

  return (
    <div className="wrap pb-24 pt-6 md:pt-8">
      <JsonLd data={collectionJsonLd(name, url, cards)} />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Library', url: LIBRARY_URL },
          { name: 'Stacks', url: `${LIBRARY_URL}/stacks` },
          { name, url },
        ])}
      />
      <Crumbs
        items={[{ name: 'Library', href: '/' }, { name: 'Stacks', href: '/stacks' }, { name }]}
      />
      <h1 className="t-h1 mt-4 max-md:text-[30px] max-md:leading-9">{name}</h1>
      <div className="t-sm mt-3 flex flex-wrap items-center gap-4">
        <span className="flex flex-wrap gap-1.5">
          {techs.map((slug) => (
            <span key={slug} className="tag mono">
              {slug}
            </span>
          ))}
        </span>
        <span className="muted">
          {cards.length} {cards.length === 1 ? 'card' : 'cards'} · {requests.length} open{' '}
          {requests.length === 1 ? 'request' : 'requests'}
        </span>
      </div>

      <StackCards
        rows={cards.map((card) => ({
          id: card.id,
          topic: topicName(card.topic),
          title: card.title,
          pill: CARD_STATUS[card.status].pill,
          status: CARD_STATUS[card.status].label,
          statusRank: STATUS_RANK[card.status],
          version: card.card_version,
          verified: card.last_verified,
          verifiedLabel: card.last_verified ? formatDate(card.last_verified) : '—',
        }))}
      />

      {requests.length > 0 && (
        <section className="mt-12">
          <div className="mb-3 flex items-baseline gap-2">
            <h2 className="sec-h text-[18px]">Requested for this stack</h2>
            <span className="count">{requests.length}</span>
            {isSampleData && <SampleBadge />}
          </div>
          <div className="rows">
            {requests.map((r) => {
              const status = REQUEST_STATUS[r.status];
              return (
                <Link key={r.number} href={`/requests/${r.number}`} className="row">
                  <NeedBox need={r.need} />
                  <div className="min-w-0 flex-1">
                    <div className="row-title">{r.title}</div>
                    <div className="t-sm subtle">{requestProposalMeta(r)}</div>
                  </div>
                  <span className={cn('pill', status.pill)}>{status.label}</span>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
