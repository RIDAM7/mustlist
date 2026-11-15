import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon } from '@/components/icons';
import { ProposalsList } from '@/components/proposals/proposals-list';
import { SampleBanner } from '@/components/ui';
import { isSampleData } from '@/lib/community';
import { SITE_NAME } from '@/lib/site';

export const metadata: Metadata = {
  title: { absolute: `Proposals | ${SITE_NAME}` },
  description: 'New cards and changes in review, and recently accepted.',
  robots: { index: false, follow: true },
};

export default function ProposalsPage() {
  return (
    <div className="wrap pb-24 pt-6 md:pt-10">
      <div className="flex items-center justify-between gap-4">
        <h1 className="t-h2 text-[28px] leading-9">Proposals</h1>
        <Link href="/propose" className="btn btn-primary">
          <Icon name="plus" />
          New proposal
        </Link>
      </div>
      {isSampleData && <SampleBanner className="mt-6" />}
      <ProposalsList />
    </div>
  );
}
