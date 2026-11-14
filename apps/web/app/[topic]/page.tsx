import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { stackTitle, topicTitle } from '@mustlist/schema/site';
import { Breadcrumbs, CardList } from '@/components/card-list';
import { JsonLd } from '@/components/json-ld';
import { getIndex, getTopics, splitId } from '@/lib/data';
import { breadcrumbJsonLd, collectionJsonLd, isIndexable, robotsFor } from '@/lib/seo';
import { LIBRARY_URL, SITE_NAME } from '@/lib/site';

export function generateStaticParams() {
  return getTopics().map(({ topic }) => ({ topic }));
}

// Topic pages are prerendered; blocking lets unknown topics return a real 404 status.
export const instant = false;

function topicCards(topic: string) {
  return getIndex().filter((card) => card.topic === topic);
}

export async function generateMetadata({ params }: PageProps<'/[topic]'>): Promise<Metadata> {
  const { topic } = await params;
  const cards = topicCards(topic);
  if (cards.length === 0) return {};
  return {
    title: { absolute: `${topicTitle(topic)}: build it properly | ${SITE_NAME}` },
    description: `Reviewed cards for building ${topicTitle(topic).toLowerCase()} properly, by stack.`,
    alternates: { canonical: `${LIBRARY_URL}/${topic}` },
    // A topic page is only worth indexing once it has a reviewed card.
    robots: robotsFor(cards.some((card) => isIndexable(card.status))),
  };
}

export default async function TopicPage({ params }: PageProps<'/[topic]'>) {
  const { topic } = await params;
  const cards = topicCards(topic);
  if (cards.length === 0) notFound();
  const url = `${LIBRARY_URL}/${topic}`;

  return (
    <div className="space-y-8">
      <JsonLd data={collectionJsonLd(topicTitle(topic), url, cards)} />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Library', url: LIBRARY_URL },
          { name: topicTitle(topic), url },
        ])}
      />
      <Breadcrumbs items={[{ name: 'Library', href: '/' }, { name: topicTitle(topic) }]} />
      <h1 className="font-heading text-3xl font-semibold tracking-tight">
        How should I build {topicTitle(topic).toLowerCase()}?
      </h1>
      <CardList cards={cards} label={(card) => stackTitle(splitId(card.id).stack)} />
    </div>
  );
}
