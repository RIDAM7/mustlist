import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ProposeEditor } from '@/components/propose/editor';
import { draftFromCard } from '@/components/propose/draft';
import { getCard, getIndex, splitId } from '@/lib/data';
import { SITE_NAME } from '@/lib/site';

export function generateStaticParams() {
  return getIndex().map(({ id }) => splitId(id));
}

// Unknown cards get a real 404 instead of a soft one.
export const instant = false;

export async function generateMetadata({
  params,
}: PageProps<'/[topic]/[stack]/propose'>): Promise<Metadata> {
  const { topic, stack } = await params;
  const card = getCard(`${topic}/${stack}`);
  return {
    title: { absolute: `Suggest a change: ${card?.title ?? 'card'} | ${SITE_NAME}` },
    robots: { index: false, follow: true },
  };
}

/** Suggest a change to an existing card: the editor starts from the card. */
export default async function ProposeChangePage({ params }: PageProps<'/[topic]/[stack]/propose'>) {
  const { topic, stack } = await params;
  const card = getCard(`${topic}/${stack}`);
  if (!card) notFound();
  return (
    <ProposeEditor
      initial={draftFromCard(card)}
      storageKey={`mustlist-draft:${card.id}`}
      mode="change"
      cardTitle={card.title}
    />
  );
}
