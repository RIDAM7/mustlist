import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { stackTitle, topicTitle } from '@mustlist/schema/site';
import { Breadcrumbs, CardList } from '@/components/card-list';
import { JsonLd } from '@/components/json-ld';
import { getIndex, getStacks, splitId } from '@/lib/data';
import { breadcrumbJsonLd, collectionJsonLd, isIndexable, robotsFor } from '@/lib/seo';
import { LIBRARY_URL, SITE_NAME } from '@/lib/site';

export function generateStaticParams() {
  return getStacks().map(({ stack }) => ({ stack }));
}

// Stack pages are prerendered; blocking lets unknown stacks return a real 404 status.
export const instant = false;

function stackCards(stack: string) {
  return getIndex().filter((card) => splitId(card.id).stack === stack);
}

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

export default async function StackPage({ params }: PageProps<'/stacks/[stack]'>) {
  const { stack } = await params;
  const cards = stackCards(stack);
  if (cards.length === 0) notFound();
  const url = `${LIBRARY_URL}/stacks/${stack}`;

  return (
    <div className="space-y-8">
      <JsonLd data={collectionJsonLd(stackTitle(stack), url, cards)} />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Library', url: LIBRARY_URL },
          { name: stackTitle(stack), url },
        ])}
      />
      <Breadcrumbs items={[{ name: 'Library', href: '/' }, { name: stackTitle(stack) }]} />
      <h1 className="font-heading text-3xl font-semibold tracking-tight">
        Building with {stackTitle(stack)}
      </h1>
      <CardList cards={cards} label={(card) => topicTitle(card.topic)} />
    </div>
  );
}
