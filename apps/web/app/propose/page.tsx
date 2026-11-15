import type { Metadata } from 'next';
import { Suspense } from 'react';
import { EditorSkeleton } from '@/components/propose/editor';
import { NewCardEditor } from '@/components/propose/new-card-editor';
import { loadCommunity } from '@/lib/community/load';
import { SITE_NAME } from '@/lib/site';

export const metadata: Metadata = {
  title: { absolute: `New card | ${SITE_NAME}` },
  robots: { index: false, follow: true },
};

/** Write a new card in a form. `?request=<n>` starts from a request. */
export default async function ProposePage() {
  const { requests } = await loadCommunity();
  return (
    <Suspense fallback={<EditorSkeleton />}>
      <NewCardEditor
        requests={requests.map((r) => ({ number: r.number, topic: r.topic, stack: r.stack }))}
      />
    </Suspense>
  );
}
