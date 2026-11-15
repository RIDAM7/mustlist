import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Icon } from '@/components/icons';
import { LiveTimeline } from '@/components/proposals/overview-parts';
import { proposalFromParam } from '@/components/proposals/server';
import { AcceptBox, PhoneStatusBoxes, ProposalSide } from '@/components/proposals/side-panels';
import { getRequest } from '@/lib/community';
import { getCard } from '@/lib/data';
import { formatDate } from '@/lib/format';
import { renderCommentMarkdown } from '@/lib/markdown';
import { CARD_STATUS, REQUEST_STATUS } from '@/lib/status';
import { cn } from '@/lib/utils';

// Blocking: unknown proposal ids get a real 404 (see the layout).
export const instant = false;

export default async function ProposalOverview({ params }: PageProps<'/proposals/[id]'>) {
  const { id } = await params;
  const proposal = proposalFromParam(id);
  if (!proposal) notFound();
  const request = proposal.request ? getRequest(proposal.request) : undefined;
  const card = proposal.cardId ? getCard(proposal.cardId) : undefined;
  const accepted = proposal.status === 'accepted';

  return (
    <div className="wrap flex flex-wrap gap-12 pb-24 pt-5 md:pt-8">
      <div className="flex min-w-0 max-w-[760px] flex-[999_1_560px] flex-col gap-4 md:gap-10">
        <div className="flex flex-col gap-4 md:hidden">
          <PhoneStatusBoxes />
        </div>

        <section>
          <h2 className="label mb-2 md:mb-2.5">Summary</h2>
          <div
            className="md prose"
            dangerouslySetInnerHTML={{ __html: renderCommentMarkdown(proposal.summary) }}
          />
        </section>

        {(request || card) && (
          <section>
            <h2 className="label mb-2.5">Linked</h2>
            <div className="rows">
              {request && (
                <Link href={`/requests/${request.number}`} className="row">
                  <Icon name="inbox" className="subtle" />
                  <div className="min-w-0 flex-1">
                    <div className="row-title">
                      #{request.number} {request.title}
                    </div>
                    <div className="t-sm subtle">
                      Request · {accepted ? 'resolved by this proposal' : 'resolves on accept'}
                    </div>
                  </div>
                  <span className={cn('pill', REQUEST_STATUS[request.status].pill)}>
                    {REQUEST_STATUS[request.status].label}
                  </span>
                </Link>
              )}
              {card && (
                <Link href={`/${card.id}`} className="row">
                  <Icon name="file" className="subtle" />
                  <div className="min-w-0 flex-1">
                    <div className="row-title">{card.title}</div>
                    <div className="t-sm subtle">
                      Card · v{card.card_version} ·{' '}
                      {card.last_verified
                        ? `last verified ${formatDate(card.last_verified)}`
                        : 'not verified yet'}
                    </div>
                  </div>
                  <span className={cn('pill', CARD_STATUS[card.status].pill)}>
                    {CARD_STATUS[card.status].label}
                  </span>
                </Link>
              )}
            </div>
          </section>
        )}

        <section>
          <h2 className="label mb-3 md:mb-4">Timeline</h2>
          <LiveTimeline />
        </section>

        <div className="md:hidden">
          <AcceptBox size="lg" />
        </div>
      </div>
      <aside className="hidden max-w-[380px] flex-[1_1_320px] md:block">
        <ProposalSide />
      </aside>
    </div>
  );
}
