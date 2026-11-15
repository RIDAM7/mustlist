import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon } from '@/components/icons';
import { RequestsList } from '@/components/requests/requests-list';
import { SampleBanner } from '@/components/ui';
import {
  communityNow,
  countComments,
  isSampleData,
  listRequests,
  requestProposalMeta,
} from '@/lib/community';
import { stackName, topicName } from '@/lib/topics';

export const metadata: Metadata = {
  title: 'Requests | Mustlist',
  description: 'Cards people need, ranked by how many need them.',
  robots: { index: false, follow: true },
};

export default function RequestsPage() {
  const rows = listRequests().map((r) => ({
    number: r.number,
    title: r.title,
    topic: r.topic,
    topicLabel: topicName(r.topic),
    stack: r.stack,
    stackLabel: stackName(r.stack),
    author: r.author,
    created: r.created,
    updated: r.updated,
    status: r.status,
    need: r.need,
    replies: countComments(r.comments),
    proposals: requestProposalMeta(r),
  }));

  return (
    <div className="wrap pb-24 pt-6 md:pt-10">
      {isSampleData && <SampleBanner className="mb-6" />}
      <div className="flex items-center justify-between gap-4">
        <h1 className="t-h2 text-[28px] leading-9">Requests</h1>
        <Link href="/requests/new" className="btn btn-primary">
          <Icon name="plus" />
          New request
        </Link>
      </div>
      <RequestsList rows={rows} now={communityNow().toISOString()} />
    </div>
  );
}
