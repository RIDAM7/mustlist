import type { Metadata } from 'next';
import { Suspense } from 'react';
import { stackTitle } from '@mustlist/schema/site';
import { NewRequestForm, type DuplicateSource } from '@/components/requests/new-request-form';
import { Crumbs, SourceBanner } from '@/components/ui';
import { countComments } from '@/lib/community';
import { loadCommunity } from '@/lib/community/load';
import { getIndex, getTopics } from '@/lib/data';
import { formatDate } from '@/lib/format';
import { CARD_STATUS, REQUEST_STATUS } from '@/lib/status';
import { topicName } from '@/lib/topics';

export const metadata: Metadata = {
  title: 'Request a card | Mustlist',
  robots: { index: false, follow: true },
};

export default async function NewRequestPage() {
  const community = await loadCommunity();
  const cards = getIndex();
  const requests = community.requests.filter(
    (r) => r.status === 'open' || r.status === 'in-progress',
  );
  const topics = [
    ...new Set([...getTopics().map((t) => t.topic), ...requests.map((r) => r.topic)]),
  ].sort((a, b) => topicName(a).localeCompare(topicName(b)));

  const sources: DuplicateSource[] = [
    ...requests.map((r) => ({
      kind: 'request' as const,
      key: `r${r.number}`,
      number: r.number,
      topic: r.topic,
      stack: r.stack,
      title: r.title,
      meta: `${r.need} need this · ${countComments(r.comments)} replies`,
      pill: REQUEST_STATUS[r.status].pill,
      status: REQUEST_STATUS[r.status].label,
      href: `/requests/${r.number}`,
    })),
    ...cards.map((card) => {
      const stack = card.id.split('/')[1] ?? '';
      return {
        kind: 'card' as const,
        key: card.id,
        topic: card.topic,
        stack,
        title: `${topicName(card.topic)} · ${stackTitle(stack)}`,
        meta: `v${card.card_version}${card.last_verified ? ` · ${formatDate(card.last_verified)}` : ''}`,
        pill: CARD_STATUS[card.status].pill,
        status: CARD_STATUS[card.status].label,
        href: `/${card.id}`,
      };
    }),
  ];

  return (
    <div className="wrap pb-24 pt-4 md:pt-8">
      <SourceBanner
        source={community.source}
        unavailable={community.unavailable}
        className="mb-6"
      />
      <Crumbs items={[{ name: 'Requests', href: '/requests' }, { name: 'New' }]} />
      <h1 className="t-h2 mt-4 text-[28px] leading-9">Request a card</h1>
      <Suspense fallback={<div className="sk mt-8 h-96 max-w-[720px]" />}>
        <NewRequestForm topics={topics} sources={sources} />
      </Suspense>
    </div>
  );
}
