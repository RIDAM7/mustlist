import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon } from '@/components/icons';
import { Avatar, EmptyState, SampleBadge } from '@/components/ui';
import {
  communityNow,
  describeTarget,
  getProposal,
  isSampleData,
  listActivity,
  type ActivityEvent,
} from '@/lib/community';
import { getIndex } from '@/lib/data';
import { compactAge, formatDate } from '@/lib/format';
import { LIBRARY_URL, SITE_NAME } from '@/lib/site';
import { CARD_STATUS, PROPOSAL_STATUS } from '@/lib/status';
import { cn } from '@/lib/utils';

export const metadata: Metadata = {
  title: { absolute: `Activity | ${SITE_NAME}` },
  description: 'Cards verified or re-checked recently, and the latest requests and proposals.',
  alternates: { canonical: `${LIBRARY_URL}/activity` },
};

const VERB: Record<ActivityEvent['verb'], string> = {
  opened: 'opened',
  'requested-changes': 'requested changes on',
  accepted: 'accepted',
  approved: 'approved',
  commented: 'commented on',
  asked: 'asked for',
};

/** What was accepted or re-checked recently. */
export default function ActivityPage() {
  const now = communityNow();
  const reviewed = getIndex()
    .filter((card) => card.last_verified && (card.status === 'verified' || card.status === 'stale'))
    .sort((a, b) => (b.last_verified ?? '').localeCompare(a.last_verified ?? ''));
  const events = listActivity();

  return (
    <div className="wrap pb-24 pt-10">
      <h1 className="t-h2 text-[28px] leading-9">Activity</h1>

      <section className="mt-8 max-w-[760px]">
        <h2 className="label mb-3">Verified and re-checked</h2>
        {reviewed.length === 0 ? (
          <EmptyState
            icon="checkCircle"
            title="No verified cards yet"
            line="Cards appear here once accepted."
          >
            <Link href="/how-it-works" className="btn btn-secondary btn-sm">
              How it works
            </Link>
          </EmptyState>
        ) : (
          <div className="rows">
            {reviewed.map((card) => {
              const status = CARD_STATUS[card.status];
              return (
                <Link key={card.id} href={`/${card.id}`} className="row">
                  <div className="min-w-0 flex-1">
                    <div className="row-title">{card.title}</div>
                    <div className="t-sm subtle">
                      v{card.card_version} · {formatDate(card.last_verified ?? '')}
                    </div>
                  </div>
                  <span className={cn('pill', status.pill)}>{status.label}</span>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <section className="mt-12 max-w-[760px]">
        <h2 className="label mb-1 flex items-center gap-2">
          Community {isSampleData && <SampleBadge />}
        </h2>
        <ol>
          {events.map((event) => {
            const target = describeTarget(event.target);
            const proposal = event.target.startsWith('proposal:')
              ? getProposal(Number(event.target.split(':')[1]))
              : undefined;
            const pill =
              event.verb === 'accepted' && proposal ? PROPOSAL_STATUS[proposal.status] : undefined;
            return (
              <li
                key={`${event.actor}-${event.verb}-${event.target}-${event.date}`}
                className="grid min-h-14 grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-3 border-b py-2"
              >
                <Avatar handle={event.actor} size="md" />
                <div className="t-sm min-w-0">
                  <Link href={`/people/${event.actor}`} className="strong hover:underline">
                    @{event.actor}
                  </Link>{' '}
                  <span className="muted">{VERB[event.verb]}</span>{' '}
                  <Link href={target.href} className="font-medium hover:underline">
                    {target.title}
                  </Link>
                </div>
                <span className="flex items-center gap-3">
                  {pill && (
                    <span className={cn('pill max-md:hidden', pill.pill)}>{pill.label}</span>
                  )}
                  <span className="t-xs subtle w-10 text-right">{compactAge(event.date, now)}</span>
                </span>
              </li>
            );
          })}
        </ol>
        <Link
          href="/requests"
          className="t-sm muted mt-4 inline-flex items-center gap-1 hover:text-fg"
        >
          All requests <Icon name="chevronRight" size="sm" />
        </Link>
      </section>
    </div>
  );
}
