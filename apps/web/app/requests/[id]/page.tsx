import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { stackTitle } from '@mustlist/schema/site';
import { RequestView } from '@/components/requests/request-view';
import { Crumbs, SourceBanner } from '@/components/ui';
import { getProposal, getRequest, type CommunityData } from '@/lib/community';
import { loadCommunity } from '@/lib/community/load';
import { renderComments } from '@/lib/community/render';
import { getCard } from '@/lib/data';
import { renderCommentMarkdown } from '@/lib/markdown';
import { CARD_STATUS, PROPOSAL_STATUS } from '@/lib/status';
import { stackName, topicName } from '@/lib/topics';

export async function generateStaticParams() {
  const { requests } = await loadCommunity();
  // Cache Components needs at least one sample param; "0" is never a request (404).
  return requests.length ? requests.map((r) => ({ id: String(r.number) })) : [{ id: '0' }];
}

export const instant = false;

function load(community: CommunityData, id: string) {
  const request = /^\d+$/.test(id) ? getRequest(community, Number(id)) : undefined;
  if (!request) notFound();
  return request;
}

export async function generateMetadata({ params }: PageProps<'/requests/[id]'>): Promise<Metadata> {
  const { id } = await params;
  const request = /^\d+$/.test(id) ? getRequest(await loadCommunity(), Number(id)) : undefined;
  if (!request) return {};
  return {
    title: `#${request.number} ${request.title} | Mustlist`,
    robots: { index: false, follow: true },
  };
}

export default async function RequestPage({ params }: PageProps<'/requests/[id]'>) {
  const community = await loadCommunity();
  const request = load(community, (await params).id);
  const participants = [
    ...new Set([
      request.author,
      ...request.comments.flatMap((c) => [c.author, ...(c.replies ?? []).map((r) => r.author)]),
    ]),
  ];

  return (
    <div className="wrap pb-12 pt-4 md:pb-24 md:pt-8">
      <SourceBanner
        source={community.source}
        unavailable={community.unavailable}
        className="mb-6"
      />
      <Crumbs items={[{ name: 'Requests', href: '/requests' }, { name: `#${request.number}` }]} />
      <RequestView
        number={request.number}
        title={request.title}
        topic={request.topic}
        topicLabel={topicName(request.topic)}
        stackLabel={stackName(request.stack)}
        author={request.author}
        created={request.created}
        status={request.status}
        need={request.need}
        bodyHtml={renderCommentMarkdown(request.body)}
        comments={renderComments(request.comments, community.people)}
        url={request.url}
        participants={participants}
        proposals={request.proposals
          .map((number) => getProposal(community, number))
          .filter((p) => p !== undefined)
          .map((p) => ({
            number: p.number,
            title: p.title,
            pill: PROPOSAL_STATUS[p.status].pill,
            status: PROPOSAL_STATUS[p.status].label,
          }))}
        related={request.related
          .map((id) => getCard(id))
          .filter((card) => card !== undefined)
          .map((card) => ({
            id: card.id,
            label: `${topicName(card.topic)} · ${stackTitle(card.id.split('/')[1] ?? '')}`,
            pill: CARD_STATUS[card.status].pill,
            status: CARD_STATUS[card.status].label,
          }))}
      />
    </div>
  );
}
