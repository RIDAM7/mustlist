import type { Metadata } from 'next';
import { CardHeader } from '@/components/card/card-header';
import { Thread } from '@/components/requests/thread';
import { githubLinks } from '@/lib/community/links';
import { loadCommunity } from '@/lib/community/load';
import { renderComments } from '@/lib/community/render';
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

/**
 * Questions, problems and ideas about one card: the card's Q&A discussion on
 * GitHub (one per card). The first comment from the site opens it.
 */
export default async function CardDiscussionPage({
  params,
}: PageProps<'/[topic]/[stack]/discussion'>) {
  const card = await loadCard(params);
  const community = await loadCommunity();
  const thread = community.cardThreads?.[card.id];
  return (
    <div className="pb-24 md:pb-0">
      <CardHeader card={card} tab="discussion" />
      <div className="wrap pb-24 pt-2">
        <div className="max-w-[760px]">
          <Thread
            key={thread?.number ?? 'new'}
            comments={renderComments(thread?.comments ?? [], community.people)}
            emptyLine="Questions, problems and ideas for this card."
            request={thread?.number}
            cardId={card.id}
            githubUrl={thread?.url ?? githubLinks.newCardDiscussion(`${card.title} (${card.id})`)}
          />
        </div>
      </div>
    </div>
  );
}
