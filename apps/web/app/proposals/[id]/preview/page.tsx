import { notFound } from 'next/navigation';
import type { CardJSON } from '@mustlist/schema/types';
import { CardBody } from '@/components/card/card-body';
import { PreviewSwitch } from '@/components/proposals/preview-switch';
import { proposalFromParam } from '@/components/proposals/server';
import { AvatarStack, Crumbs, EmptyState, handleList } from '@/components/ui';
import type { Proposal } from '@/lib/community';
import { getCard } from '@/lib/data';
import { formatDate } from '@/lib/format';
import { CARD_STATUS } from '@/lib/status';
import { stackName, techName, topicName } from '@/lib/topics';
import { cn } from '@/lib/utils';

function PreviewHeader({
  card,
  pill,
  status,
  verified,
  people,
  version,
}: {
  card: CardJSON;
  pill: string;
  status: string;
  verified: string;
  people: string[];
  version: string;
}) {
  const stack = card.id.split('/')[1] ?? '';
  return (
    <>
      <Crumbs
        label="Card path"
        items={[{ name: 'Library' }, { name: topicName(card.topic) }, { name: stackName(stack) }]}
      />
      <h2 className="t-h1 mt-4 text-[26px] leading-8 md:text-[36px] md:leading-[44px]">
        {card.title}
      </h2>
      <div className="t-sm mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className={cn('pill', pill)}>{status}</span>
        <span className="muted">{verified}</span>
        {people.length > 0 && (
          <span className="inline-flex items-center gap-2">
            <AvatarStack handles={people} size="sm" />
            <span className="muted">{handleList(people)}</span>
          </span>
        )}
        <span className="mono subtle text-xs">v{version}</span>
        <span className="inline-flex flex-wrap gap-1.5">
          {card.stack.map((slug) => (
            <span key={slug} className="tag">
              {techName(slug)}
            </span>
          ))}
        </span>
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          className="btn btn-primary btn-disabled"
          aria-disabled="true"
          tabIndex={-1}
        >
          Copy for my agent
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-disabled"
          aria-disabled="true"
          tabIndex={-1}
        >
          Suggest a change
        </button>
      </div>
    </>
  );
}

function revisionPeople(proposal: Proposal): string[] {
  return proposal.approvals.map((approval) => approval.handle);
}

// Blocking: unknown proposal ids get a real 404 (see the layout).
export const instant = false;

export default async function ProposalPreview({ params }: PageProps<'/proposals/[id]'>) {
  const { id } = await params;
  const proposal = proposalFromParam(id);
  if (!proposal) notFound();
  const card = proposal.cardId ? getCard(proposal.cardId) : undefined;

  if (!card) {
    return (
      <div className="wrap pb-24 pt-5 md:pt-6">
        <EmptyState
          icon="file"
          title="No preview yet"
          line="This card is not in the library yet."
        />
      </div>
    );
  }

  const current = CARD_STATUS[card.status];

  return (
    <div className="wrap pb-24 pt-5 md:pt-6">
      <PreviewSwitch
        revisionLabel={`Revision ${proposal.revisions}`}
        revisionHeader={
          <PreviewHeader
            card={card}
            pill="p-success"
            status="Verified"
            verified="Last verified on accept"
            people={revisionPeople(proposal)}
            version={proposal.toVersion ?? card.card_version}
          />
        }
        currentHeader={
          <PreviewHeader
            card={card}
            pill={current.pill}
            status={current.label}
            verified={
              card.last_verified
                ? `Last verified ${formatDate(card.last_verified)}`
                : 'Not verified yet'
            }
            people={card.reviewers}
            version={card.card_version}
          />
        }
      >
        <CardBody card={card} lensMode="stack" />
      </PreviewSwitch>
    </div>
  );
}
