import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon } from '@/components/icons';
import { ProposalsList } from '@/components/proposals/proposals-list';
import { SourceBanner } from '@/components/ui';
import { listProposals, toProposalSummary } from '@/lib/community';
import { loadCommunity } from '@/lib/community/load';
import { SITE_NAME } from '@/lib/site';

export const metadata: Metadata = {
  title: { absolute: `Proposals | ${SITE_NAME}` },
  description: 'New cards and changes in review, and recently accepted.',
  robots: { index: false, follow: true },
};

export default async function ProposalsPage() {
  const community = await loadCommunity();
  return (
    <div className="wrap pb-24 pt-6 md:pt-10">
      <div className="flex items-center justify-between gap-4">
        <h1 className="t-h2 text-[28px] leading-9">Proposals</h1>
        <Link href="/propose" className="btn btn-primary">
          <Icon name="plus" />
          New proposal
        </Link>
      </div>
      <SourceBanner
        source={community.source}
        unavailable={community.unavailable}
        className="mt-6"
      />
      <ProposalsList
        proposals={listProposals(community).map(toProposalSummary)}
        now={community.now}
      />
    </div>
  );
}
