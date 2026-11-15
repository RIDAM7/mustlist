'use client';

import { useSearchParams } from 'next/navigation';
import { useViewer } from '@/components/viewer';
import { stackName, topicName } from '@/lib/topics';
import { type DraftChecklistItem, newDraft } from './draft';
import { ProposeEditor } from './editor';

/** Sample mode only: request #38 already has a draft in the design (proposal #20). */
const SAMPLE_CHECKLIST: Record<number, Omit<DraftChecklistItem, 'key'>[]> = {
  38: [
    {
      id: 'idempotent-jobs',
      level: 'must',
      lens: 'data',
      text: 'Make every job idempotent: a retried job must not charge, email or write twice.',
      why: 'Workers retry after crashes and timeouts.',
    },
    {
      id: 'claim-skip-locked',
      level: 'must',
      lens: 'data',
      text: 'Store jobs in Postgres with a unique key per logical job and claim them with FOR UPDATE SKIP LOCKED.',
      why: '',
    },
    {
      id: 'enqueue-not-inline',
      level: 'must',
      lens: 'performance',
      text: 'Return the HTTP response before slow work; enqueue it instead of running it in the request.',
      why: 'Serverless functions stop at their max duration.',
    },
    {
      id: 'job-state-ux',
      level: 'must',
      lens: 'ux',
      text: 'Show users the state (queued, running, failed, done) of any job they started, and let them safely retry a failed job without creating a duplicate or losing the inputs they first gave.',
      why: '',
    },
    {
      id: 'backoff-dead-letter',
      level: 'should',
      lens: 'cost',
      text: 'Cap retries with exponential backoff and move jobs that keep failing to a dead-letter table.',
      why: '',
    },
    {
      id: 'alert-queue-age',
      level: 'should',
      lens: 'performance',
      text: 'Alert when the oldest queued job is older than your latency budget.',
      why: '',
    },
  ],
};

/** New card, optionally started from a request (`/propose?request=38`). */
export function NewCardEditor({
  requests,
}: {
  /** Open requests, so `?request=<n>` can fill in the topic and stack. */
  requests: { number: number; topic: string; stack: string }[];
}) {
  const params = useSearchParams();
  const { mode, viewer } = useViewer();
  const number = Number(params.get('request'));
  const request =
    Number.isInteger(number) && number > 0 ? requests.find((r) => r.number === number) : undefined;

  const initial = newDraft({
    topic: request?.topic,
    stack: request?.stack,
    title: request ? `${topicName(request.topic)} for a ${stackName(request.stack)} app` : '',
    request: request?.number ?? null,
    author: viewer?.handle,
    checklist: request && mode === 'sample' ? SAMPLE_CHECKLIST[request.number] : undefined,
  });

  return (
    <ProposeEditor
      key={request?.number ?? 'new'}
      initial={initial}
      storageKey={`mustlist-draft:new${request ? `:request-${request.number}` : ''}`}
      mode="new"
    />
  );
}
