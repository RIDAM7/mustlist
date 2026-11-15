import type { Metadata } from 'next';
import { CardHeader } from '@/components/card/card-header';
import { Thread } from '@/components/requests/thread';
import { getCard, getIndex, splitId } from '@/lib/data';
import { loadCard } from '@/lib/load-card';

export function generateStaticParams() {
  return getIndex().map(({ id }) => splitId(id));
}

export const instant = false;

export async function generateMetadata({
  params,
}: PageProps<'/[topic]/[stack]/discussion'>): Promise<Metadata> {
  const { topic, stack } = await params;
  const card = getCard(`${topic}/${stack}`);
  if (!card) return {};
  return {
    title: { absolute: `Discussion: ${card.title} | Mustlist` },
    robots: { index: false, follow: true },
  };
}

/** Questions and problems about one card. */
export default async function CardDiscussionPage({
  params,
}: PageProps<'/[topic]/[stack]/discussion'>) {
  const card = await loadCard(params);
  return (
    <div className="pb-24 md:pb-0">
      <CardHeader card={card} tab="discussion" />
      <div className="wrap pb-24 pt-2">
        <div className="max-w-[760px]">
          <Thread comments={[]} emptyLine="Questions, problems and ideas for this card." />
        </div>
      </div>
    </div>
  );
}
