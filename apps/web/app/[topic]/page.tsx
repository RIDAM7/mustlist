import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { stackTitle, topicTitle } from '@mustlist/schema/site';
import { JsonLd } from '@/components/json-ld';
import { StatusBadge } from '@/components/status-badge';
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
      <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
        <Link href="/" className="hover:underline">
          Library
        </Link>{' '}
        › {topicTitle(topic)}
      </nav>
      <h1 className="font-heading text-3xl font-semibold tracking-tight">
        How should I build {topicTitle(topic).toLowerCase()}?
      </h1>
      <ul className="space-y-4">
        {cards.map((card) => (
          <li key={card.id} className="rounded-xl border p-4">
            <div className="flex items-center justify-between gap-3">
              <Link href={`/${card.id}`} className="font-medium hover:underline">
                {stackTitle(splitId(card.id).stack)}
              </Link>
              <StatusBadge status={card.status} />
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{card.summary}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
