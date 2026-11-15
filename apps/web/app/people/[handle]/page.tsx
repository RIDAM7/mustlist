import type { Metadata } from 'next';
import { stackTitle } from '@mustlist/schema/site';
import type { CardJSON } from '@mustlist/schema/types';
import { notFound } from 'next/navigation';
import { ProfileTabs } from '@/components/profile-tabs';
import { Avatar, SourceBanner } from '@/components/ui';
import {
  activityFor,
  allHandles,
  describeTarget,
  getPerson,
  getProposal,
  listProposals,
  roleLabel,
  type CommunityData,
  type ActivityEvent,
} from '@/lib/community';
import { loadCommunity } from '@/lib/community/load';
import { getCard, getIndex } from '@/lib/data';
import { compactAge } from '@/lib/format';
import { CARD_STATUS, PROPOSAL_STATUS } from '@/lib/status';
import { topicName } from '@/lib/topics';

export async function generateStaticParams() {
  const community = await loadCommunity();
  const handles = allHandles(community);
  return (handles.length ? handles : ['RIDAM7']).map((handle) => ({ handle }));
}

export const instant = false;

/** Anyone who maintains, reviews, or took part; unknown handles are a 404. */
function findPerson(community: CommunityData, handle: string) {
  const known = allHandles(community).find((h) => h.toLowerCase() === handle.toLowerCase());
  return known ? getPerson(community.people, known) : undefined;
}

export async function generateMetadata({
  params,
}: PageProps<'/people/[handle]'>): Promise<Metadata> {
  const { handle } = await params;
  const person = findPerson(await loadCommunity(), handle);
  if (!person) return {};
  return { title: `@${person.handle} | Mustlist`, robots: { index: false, follow: true } };
}

const VERB: Record<ActivityEvent['verb'], string> = {
  opened: 'Opened',
  'requested-changes': 'Requested changes on',
  accepted: 'Accepted',
  approved: 'Approved',
  commented: 'Commented on',
  asked: 'Asked for',
};

const ICON: Record<ActivityEvent['verb'], 'plus' | 'alertCircle' | 'check' | 'comment' | 'inbox'> =
  {
    opened: 'plus',
    'requested-changes': 'alertCircle',
    accepted: 'check',
    approved: 'check',
    commented: 'comment',
    asked: 'inbox',
  };

/** A person's contributions (design board 34). */
export default async function ProfilePage({ params }: PageProps<'/people/[handle]'>) {
  const { handle } = await params;
  const community = await loadCommunity();
  const person = findPerson(community, handle);
  if (!person) notFound();
  const now = new Date(community.now);

  // Cards come from the real card files: everyone listed as an author.
  const authoredCards = getIndex()
    .map((card) => getCard(card.id))
    .filter((card): card is CardJSON => Boolean(card?.authors.includes(person.handle)));
  const proposals = listProposals(community).filter((p) => p.author === person.handle);
  const reviews = listProposals(community).flatMap((p) =>
    p.reviews
      .filter((review) => review.author === person.handle)
      .map((review) => ({
        key: review.id,
        number: p.number,
        title: p.title,
        verdict: review.verdict,
        when: compactAge(review.date, now),
      })),
  );

  const feed = activityFor(community, person.handle).map((event) => {
    const target = describeTarget(community, event.target);
    const proposal = event.target.startsWith('proposal:')
      ? getProposal(community, Number(event.target.split(':')[1]))
      : undefined;
    const showPill = event.verb === 'opened' || event.verb === 'accepted';
    return {
      key: `${event.verb}-${event.target}-${event.date}`,
      icon: ICON[event.verb],
      verb: VERB[event.verb],
      title: target.title,
      href: target.href,
      pill: showPill && proposal ? PROPOSAL_STATUS[proposal.status] : undefined,
      when: compactAge(event.date, now),
    };
  });

  return (
    <div className="wrap pb-24 pt-8 md:pt-12">
      <SourceBanner
        source={community.source}
        unavailable={community.unavailable}
        className="mb-8"
      />
      <div className="flex flex-wrap items-center gap-6">
        <Avatar handle={person.handle} size="xl" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5">
            <h1 className="t-h2 text-[28px] leading-9">@{person.handle}</h1>
            {person.role !== 'contributor' && (
              <span className="badge">{roleLabel(person.role)}</span>
            )}
          </div>
          {person.topics.length > 0 && (
            <div className="t-sm muted mt-1.5">
              Reviews: {person.topics.map(topicName).join(' · ')}
            </div>
          )}
          <a
            href={`https://github.com/${person.handle}`}
            className="mono t-xs subtle mt-1.5 inline-block hover:text-fg"
            rel="noopener noreferrer"
            target="_blank"
          >
            github.com/{person.handle}
          </a>
        </div>
        <dl className="m-0 flex gap-10 max-md:w-full max-md:justify-between max-md:gap-4">
          <div>
            <dt className="label">Cards</dt>
            <dd className="m-0 mt-1 text-2xl font-semibold">{authoredCards.length}</dd>
          </div>
          <div>
            <dt className="label">Proposals</dt>
            <dd className="m-0 mt-1 text-2xl font-semibold">{proposals.length}</dd>
          </div>
          <div>
            <dt className="label">Reviews</dt>
            <dd className="m-0 mt-1 text-2xl font-semibold">{reviews.length}</dd>
          </div>
        </dl>
      </div>

      <ProfileTabs
        feed={feed}
        cards={authoredCards.map((card) => ({
          id: card.id,
          title: topicName(card.topic),
          stack: stackTitle(card.id.split('/')[1] ?? ''),
          pill: CARD_STATUS[card.status].pill,
          status: CARD_STATUS[card.status].label,
        }))}
        proposals={proposals.map((p) => ({
          number: p.number,
          title: p.title,
          pill: PROPOSAL_STATUS[p.status].pill,
          status: PROPOSAL_STATUS[p.status].label,
        }))}
        reviews={reviews}
      />
    </div>
  );
}
