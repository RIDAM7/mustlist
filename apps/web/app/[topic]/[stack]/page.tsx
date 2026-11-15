import type { Metadata } from 'next';
import { CardBody } from '@/components/card/card-body';
import { CardHeader } from '@/components/card/card-header';
import { JsonLd } from '@/components/json-ld';
import { getCard, getIndex, splitId } from '@/lib/data';
import { loadCard } from '@/lib/load-card';
import {
  breadcrumbJsonLd,
  cardBreadcrumbs,
  cardPageTitle,
  isIndexable,
  robotsFor,
  techArticleJsonLd,
  truncate,
} from '@/lib/seo';
import { LIBRARY_URL, SITE_NAME } from '@/lib/site';

export function generateStaticParams() {
  return getIndex().map(({ id }) => splitId(id));
}

// Every card is prerendered, so navigating to one is instant anyway. Blocking only
// affects unknown URLs, where it lets notFound() send a real 404 status (no soft 404).
export const instant = false;

export async function generateMetadata({
  params,
}: PageProps<'/[topic]/[stack]'>): Promise<Metadata> {
  const { topic, stack } = await params;
  const card = getCard(`${topic}/${stack}`);
  if (!card) return {};
  const url = `${LIBRARY_URL}/${card.id}`;
  const description = truncate(card.summary, 155);
  return {
    title: { absolute: cardPageTitle(card) },
    description,
    alternates: { canonical: url },
    robots: robotsFor(isIndexable(card.status)),
    openGraph: { type: 'article', title: card.title, description, url, siteName: SITE_NAME },
    twitter: { card: 'summary', title: card.title, description },
  };
}

export default async function CardPage({ params }: PageProps<'/[topic]/[stack]'>) {
  const card = await loadCard(params);
  return (
    <div className="pb-24 md:pb-0">
      <JsonLd data={techArticleJsonLd(card)} />
      <JsonLd data={breadcrumbJsonLd(cardBreadcrumbs(card))} />
      <CardHeader card={card} tab="card" />
      <div className="wrap pb-12 pt-6 md:pb-24 md:pt-10">
        <CardBody card={card} lensMode="tabs" />
      </div>
    </div>
  );
}
