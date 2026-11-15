import type { Metadata } from 'next';
import { ReviewQueue } from '@/components/proposals/review-queue';
import { SourceBanner } from '@/components/ui';
import { listProposals, toProposalSummary } from '@/lib/community';
import { loadCommunity } from '@/lib/community/load';
import { SITE_NAME } from '@/lib/site';

export const metadata: Metadata = {
  title: { absolute: `Review queue | ${SITE_NAME}` },
  robots: { index: false, follow: true },
};

export default async function ReviewQueuePage() {
  const community = await loadCommunity();
  const proposals = listProposals(community).map((p) => ({
    ...toProposalSummary(p),
    reviews: p.reviews.map((r) => ({ author: r.author, verdict: r.verdict })),
  }));
  return (
    <div className="wrap pb-24 pt-6 md:pt-10">
      <SourceBanner
        source={community.source}
        unavailable={community.unavailable}
        className="mb-6"
      />
      <ReviewQueue proposals={proposals} people={community.people} now={community.now} />
    </div>
  );
}
