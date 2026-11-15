import Link from 'next/link';
import { stackTitle } from '@mustlist/schema/site';
import type { CardJSON } from '@mustlist/schema/types';
import { agentMessage } from '@/lib/card';
import { countComments, proposalsForCard } from '@/lib/community';
import { getRawMarkdown } from '@/lib/data';
import { formatDate } from '@/lib/format';
import { CARD_STATUS } from '@/lib/status';
import { techName, topicName } from '@/lib/topics';
import { cn } from '@/lib/utils';
import { AvatarStack, Crumbs, handleList } from '../ui';
import { CardActions } from './card-actions';

export type CardTab = 'card' | 'history' | 'discussion';

/** Breadcrumbs, title, status row, actions, banner and the Card · History · Discussion tabs. */
export function CardHeader({ card, tab }: { card: CardJSON; tab: CardTab }) {
  const stack = card.id.split('/')[1] ?? '';
  const status = CARD_STATUS[card.status];
  const accepted =
    card.status === 'draft' ? [] : proposalsForCard(card.id).filter((p) => p.status === 'accepted');
  const discussion = countComments([]);
  const message = agentMessage(card, getRawMarkdown(card.id) ?? '');

  const tabs: { id: CardTab; label: string; href: string; count?: number }[] = [
    { id: 'card', label: 'Card', href: `/${card.id}` },
    {
      id: 'history',
      label: 'History',
      href: `/${card.id}/history`,
      count: accepted.length || undefined,
    },
    {
      id: 'discussion',
      label: 'Discussion',
      href: `/${card.id}/discussion`,
      count: discussion || undefined,
    },
  ];

  return (
    <div className="wrap pt-4 md:pt-8">
      <Crumbs
        items={[
          { name: 'Library', href: '/' },
          { name: topicName(card.topic), href: `/${card.topic}` },
          { name: stackTitle(stack) },
        ]}
      />
      <div className="mt-3 flex flex-wrap items-start justify-between gap-8 md:mt-4">
        <div className="min-w-0 flex-[1_1_560px]">
          <h1 className="t-h1 max-md:text-[26px] max-md:leading-8 max-md:tracking-[-0.02em]">
            {card.title}
          </h1>
          <div className="t-sm mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 md:mt-4 md:gap-x-4">
            <span className={cn('pill', status.pill)}>{status.label}</span>
            <span className="muted">
              {card.last_verified ? (
                <>
                  <span className="max-md:hidden">Last verified </span>
                  {formatDate(card.last_verified)}
                </>
              ) : (
                'Not reviewed yet'
              )}
            </span>
            {card.reviewers.length > 0 && (
              <span className="inline-flex items-center gap-2">
                <AvatarStack handles={card.reviewers} size="sm" link />
                <span className="muted max-md:hidden">{handleList(card.reviewers)}</span>
              </span>
            )}
            <span className="mono subtle text-xs">v{card.card_version}</span>
            <span className="hidden gap-1.5 md:inline-flex">
              {card.stack.map((slug) => (
                <Link key={slug} href={`/stacks/${stack}`} className="tag">
                  {techName(slug)}
                </Link>
              ))}
            </span>
          </div>
          <div className="mt-2.5 flex gap-1.5 md:hidden">
            {card.stack.map((slug) => (
              <Link key={slug} href={`/stacks/${stack}`} className="tag">
                {techName(slug)}
              </Link>
            ))}
          </div>
        </div>
        <CardActions id={card.id} message={message} compact={tab === 'history'} />
      </div>

      {card.status === 'stale' && (
        <div className="banner banner-warn mt-6" role="status">
          <span className="pill p-warning bg-transparent px-0">Being re-checked</span>
          <span className="flex-1 text-fg">Still served to agents. A re-check is in review.</span>
        </div>
      )}
      {(card.status === 'draft' || card.status === 'proposed') && (
        <div className="banner banner-dash mt-6" role="status">
          <span className="pill p-neutral">{status.label}</span>
          <span className="muted flex-1">Not reviewed. Not served to agents.</span>
        </div>
      )}

      <div className="tabs mt-4 gap-5 md:mt-8 md:gap-6" role="tablist" aria-label="Card views">
        {tabs.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            role="tab"
            aria-selected={item.id === tab}
            className={cn('tab', item.id === tab && 'tab-on')}
          >
            {item.label}
            {item.count !== undefined && <span className="count">{item.count}</span>}
          </Link>
        ))}
      </div>
    </div>
  );
}
