import type { Metadata } from 'next';
import { ReviewQueue } from '@/components/proposals/review-queue';
import { SampleBanner } from '@/components/ui';
import { isSampleData } from '@/lib/community';
import { SITE_NAME } from '@/lib/site';

export const metadata: Metadata = {
  title: { absolute: `Review queue | ${SITE_NAME}` },
  robots: { index: false, follow: true },
};

export default function ReviewQueuePage() {
  return (
    <div className="wrap pb-24 pt-6 md:pt-10">
      {isSampleData && <SampleBanner className="mb-6" />}
      <ReviewQueue />
    </div>
  );
}
