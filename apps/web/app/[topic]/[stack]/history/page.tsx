import type { Metadata } from 'next';
import Link from 'next/link';
import { CardHeader } from '@/components/card/card-header';
import { Avatar, AvatarStack, EmptyState, handleList, Pill, SampleBadge } from '@/components/ui';
import { nextMajors } from '@/lib/card';
import {
  approvalCount,
  cardHistory,
  getPerson,
  proposalsForCard,
  roleLabel,
} from '@/lib/community';
import { loadCommunity } from '@/lib/community/load';
import { getCard, getIndex, splitId } from '@/lib/data';
import { addDays, formatDate } from '@/lib/format';
import { loadCard } from '@/lib/load-card';
import {
  CARD_STATUS,
  CHECKS_STATE,
  PROPOSAL_STATUS,
  PROPOSAL_TYPE,
  isOpenProposal,
} from '@/lib/status';
import { topicName } from '@/lib/topics';
import { cn } from '@/lib/utils';

export function generateStaticParams() {
  return getIndex().map(({ id }) => splitId(id));
}

export const instant = false;

export async function generateMetadata({
  params,
}: PageProps<'/[topic]/[stack]/history'>): Promise<Metadata> {
  const { topic, stack } = await params;
  const card = getCard(`${topic}/${stack}`);
  if (!card) return {};
  return {
    title: { absolute: `History: ${card.title} | Mustlist` },
    robots: { index: false, follow: true },
  };
}

/** Who proposed and reviewed, what changed, when. */
export default async function CardHistoryPage({ params }: PageProps<'/[topic]/[stack]/history'>) {
  const card = await loadCard(params);
  const community = await loadCommunity();
  const accepted = cardHistory(community, card.id, card.status);
  const open = proposalsForCard(community, card.id).filter((p) => isOpenProposal(p.status));
  const majors = nextMajors(card);
  const status = CARD_STATUS[card.status];

  return (
    <div className="pb-24 md:pb-0">
      <CardHeader card={card} tab="history" />
      <div className="wrap flex flex-wrap gap-16 pb-24 pt-10 max-md:gap-10 max-md:pt-6">
        <section className="min-w-0 max-w-[760px] flex-[999_1_560px]">
          <div className="panel t-sm flex flex-wrap gap-x-6 gap-y-1 px-4 py-3">
            {card.last_verified ? (
              <span>
                <span className="subtle">Next re-check by</span>{' '}
                {formatDate(addDays(card.last_verified, 180))}
              </span>
            ) : (
              <span>
                <span className="subtle">Re-check</span> 180 days after review
              </span>
            )}
            {majors.length > 0 && (
              <span>
                <span className="subtle">Or when</span>{' '}
                {majors.map((major, i) => (
                  <span key={major}>
                    {i > 0 && <span className="subtle"> or </span>}
                    <span className="mono text-xs">{major}</span>
                  </span>
                ))}{' '}
                ships
              </span>
            )}
          </div>

          {accepted.length > 0 ? (
            <ol className="relative mt-8">
              {accepted.map((p) => (
                <li
                  key={p.number}
                  className="relative grid grid-cols-[24px_minmax(0,1fr)] gap-4 pb-9"
                >
                  <span className="flex flex-col items-center">
                    <span className="step-dot step-done">
                      <svg className="i i-sm" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="m5 12 4.5 4.5L19 7" />
                      </svg>
                    </span>
                    <span className="mt-1.5 min-h-10 w-px flex-1 bg-border" />
                  </span>
                  <div>
                    <div className="flex flex-wrap items-center gap-2.5">
                      {p.toVersion && (
                        <span className="mono text-[13px] font-semibold">v{p.toVersion}</span>
                      )}
                      <span className="t-sm subtle">{formatDate(p.updated)}</span>
                      <Pill pill="p-solid" label="Accepted" />
                    </div>
                    <Link
                      href={`/proposals/${p.number}`}
                      className="mt-1.5 block text-[15px] font-medium"
                    >
                      {p.title} <span className="subtle font-normal">#{p.number}</span>
                    </Link>
                    <div className="t-sm muted mt-1.5 flex flex-wrap items-center gap-2">
                      <Avatar handle={p.author} size="sm" />
                      Proposed by @{p.author}
                      <span aria-hidden="true">·</span>
                      Approved by{' '}
                      {handleList(
                        p.approvals.filter((a) => a.state === 'approved').map((a) => a.handle),
                      )}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {p.changes.map((change) => (
                        <span key={change.id} className="tag">
                          {change.name}: {change.summary}
                        </span>
                      ))}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <EmptyState
              icon="clock"
              title="No accepted proposals yet"
              line={
                card.status === 'draft'
                  ? 'This card is a draft. History starts at its first review.'
                  : undefined
              }
              className="mt-8"
            >
              <Link href={`/${card.id}/propose`} className="btn btn-secondary btn-sm">
                Suggest a change
              </Link>
            </EmptyState>
          )}

          {open.length > 0 && (
            <section className="mt-12">
              <div className="mb-3 flex items-baseline gap-2">
                <h2 className="sec-h text-[18px]">Open proposals</h2>
                <span className="count">{open.length}</span>
                {community.source === 'sample' && <SampleBadge />}
              </div>
              <div className="rows">
                {open.map((p) => {
                  const checks = CHECKS_STATE[p.checks];
                  const pill = PROPOSAL_STATUS[p.status];
                  return (
                    <Link
                      key={p.number}
                      href={`/proposals/${p.number}`}
                      className="row max-md:flex-wrap"
                    >
                      <span className="tag w-[96px] justify-center max-md:hidden">
                        {PROPOSAL_TYPE[p.type]}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="row-title">{p.title}</div>
                        <div className="t-sm subtle">
                          #{p.number} · @{p.author} · {approvalCount(p)} of 2 approvals
                        </div>
                      </div>
                      <span className={cn('meta max-md:hidden', checks.tone)}>{checks.label}</span>
                      <Pill pill={pill.pill} label={pill.label} />
                    </Link>
                  );
                })}
              </div>
            </section>
          )}
        </section>

        <aside className="flex flex-[1_1_280px] flex-col gap-8">
          <div>
            <div className="label mb-3">Reviewers</div>
            {card.reviewers.length > 0 ? (
              <div className="flex flex-col gap-3">
                {card.reviewers.map((handle) => {
                  const person = getPerson(community.people, handle);
                  return (
                    <Link
                      key={handle}
                      href={`/people/${handle}`}
                      className="flex items-center gap-2.5"
                    >
                      <Avatar handle={handle} size="md" />
                      <span className="flex-1">
                        <span className="block font-medium">@{handle}</span>
                        <span className="t-xs subtle">
                          {roleLabel(person.role)}
                          {person.topics.length > 0 &&
                            ` · ${person.topics.map(topicName).join(', ')}`}
                        </span>
                      </span>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <p className="t-sm subtle">None yet</p>
            )}
          </div>
          <div>
            <div className="label mb-3">Authors</div>
            <div className="flex items-center gap-2">
              <AvatarStack handles={card.authors} link />
              <span className="t-sm muted">{handleList(card.authors)}</span>
            </div>
          </div>
          <div>
            <div className="label mb-3">Versions</div>
            <div className="t-sm grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
              <span className="mono text-xs leading-5">v{card.card_version}</span>
              <span className="muted">
                {card.last_verified
                  ? `${formatDate(card.last_verified)} · current`
                  : `${status.label} · current`}
              </span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
