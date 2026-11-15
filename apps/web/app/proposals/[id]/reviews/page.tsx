import { notFound } from 'next/navigation';
import { LocalReviews, ReviewArticle, ReviewBox } from '@/components/proposals/reviews';
import { proposalFromParam } from '@/components/proposals/server';
import { ProposalSide } from '@/components/proposals/side-panels';
import { renderCommentMarkdown } from '@/lib/markdown';

// Blocking: unknown proposal ids get a real 404 (see the layout).
export const instant = false;

export default async function ProposalReviews({ params }: PageProps<'/proposals/[id]'>) {
  const { id } = await params;
  const proposal = proposalFromParam(id);
  if (!proposal) notFound();

  return (
    <div className="wrap flex flex-wrap gap-12 pb-24 pt-5 md:pt-8">
      <div className="flex min-w-0 max-w-[760px] flex-[999_1_560px] flex-col gap-4">
        <LocalReviews showEmpty={proposal.reviews.length === 0} />
        {proposal.reviews.map((review) => (
          <ReviewArticle
            key={review.id}
            review={review}
            body={
              <div
                className="md t-body"
                dangerouslySetInnerHTML={{ __html: renderCommentMarkdown(review.body) }}
              />
            }
          />
        ))}
        <ReviewBox />
      </div>
      <aside className="hidden max-w-[380px] flex-[1_1_320px] md:block">
        <ProposalSide showAccept={false} />
      </aside>
    </div>
  );
}
