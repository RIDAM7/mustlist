'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from '@/components/icons';
import { Menu, type MenuItem } from '@/components/overlay';
import { useCopy } from '@/components/toast';
import { Avatar, Crumbs } from '@/components/ui';
import { formatShortDate, plural } from '@/lib/format';
import { PROPOSAL_STATUS, PROPOSAL_TYPE } from '@/lib/status';
import { cn } from '@/lib/utils';
import { useProposalState } from './proposal-state';

export type ProposalTab = 'overview' | 'preview' | 'changes' | 'reviews';

export function useProposalTab(number: number): ProposalTab {
  const pathname = usePathname();
  const base = `/proposals/${number}`;
  if (pathname.startsWith(`${base}/preview`)) return 'preview';
  if (pathname.startsWith(`${base}/changes`)) return 'changes';
  if (pathname.startsWith(`${base}/reviews`)) return 'reviews';
  return 'overview';
}

/** "Re-checks Payment webhooks · v1.0.0 for #51", "Changes Auth · v0.1.0", "Resolves #38". */
export interface CardLink {
  label: string;
  href: string;
}

function useMoreItems(cardLink?: CardLink): MenuItem[] {
  const copy = useCopy();
  const { proposal } = useProposalState();
  const items: MenuItem[] = [
    {
      label: 'Copy link',
      icon: <Icon name="link" />,
      onSelect: () => void copy(window.location.href, 'Link copied'),
    },
  ];
  if (proposal.request) {
    items.push({
      label: `Open request #${proposal.request}`,
      icon: <Icon name="inbox" />,
      href: `/requests/${proposal.request}`,
    });
  }
  if (cardLink) items.push({ label: 'Open card', icon: <Icon name="file" />, href: cardLink.href });
  return items;
}

export function ProposalHeader({ cardLink }: { cardLink?: CardLink }) {
  const { proposal, status, reviewCount } = useProposalState();
  const tab = useProposalTab(proposal.number);
  const moreItems = useMoreItems(cardLink);
  const base = `/proposals/${proposal.number}`;
  const changeCount = proposal.changes.reduce(
    (sum, field) => sum + field.rows.filter((row) => row.kind !== 'same').length,
    0,
  );
  const tabs: { id: ProposalTab; label: string; href: string; count?: number }[] = [
    { id: 'overview', label: 'Overview', href: base },
    { id: 'preview', label: 'Preview', href: `${base}/preview` },
    { id: 'changes', label: 'Changes', href: `${base}/changes`, count: changeCount || undefined },
    { id: 'reviews', label: 'Reviews', href: `${base}/reviews`, count: reviewCount || undefined },
  ];
  const statusInfo = PROPOSAL_STATUS[status];
  const requestLink = proposal.request ? (
    <Link href={`/requests/${proposal.request}`} className="link">
      #{proposal.request}
    </Link>
  ) : null;

  let relation: React.ReactNode = null;
  if (proposal.type === 're-check' && cardLink) {
    relation = (
      <>
        Re-checks{' '}
        <Link href={cardLink.href} className="link">
          {cardLink.label}
        </Link>
        {requestLink && <> for {requestLink}</>}
      </>
    );
  } else if (cardLink) {
    relation = (
      <>
        Changes{' '}
        <Link href={cardLink.href} className="link">
          {cardLink.label}
        </Link>
        {requestLink && <> · resolves {requestLink}</>}
      </>
    );
  } else if (requestLink) {
    relation = <>Resolves {requestLink}</>;
  }

  return (
    <div>
      <div className="wrap pt-4 md:pt-8">
        <Crumbs
          items={[{ name: 'Proposals', href: '/proposals' }, { name: `#${proposal.number}` }]}
        />
        <div className="mt-2 flex flex-wrap items-start justify-between gap-8 md:mt-4">
          <div className="min-w-0 flex-[1_1_560px]">
            <h1 className="t-h1 text-[24px] leading-[30px] tracking-[-0.02em] md:text-[30px] md:leading-[38px]">
              {proposal.title}
            </h1>
            <div className="t-sm mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 md:mt-3.5">
              <span className={cn('pill', statusInfo.pill)}>{statusInfo.label}</span>
              <span className="tag">{PROPOSAL_TYPE[proposal.type]}</span>
              <span className="muted inline-flex basis-full items-center gap-1.5 md:basis-auto">
                <Avatar handle={proposal.author} size="sm" />
                <Link href={`/people/${proposal.author}`} className="strong text-fg">
                  @{proposal.author}
                </Link>
                <span className="hidden md:inline">opened</span>
                <span className="md:hidden">·</span> {formatShortDate(proposal.opened)} ·{' '}
                {plural(proposal.revisions, 'revision')}
              </span>
              {relation && <span className="muted hidden md:inline">{relation}</span>}
            </div>
          </div>
          <div className="hidden gap-2 md:flex">
            <Link href={`${base}/reviews`} className="btn btn-primary">
              Review
            </Link>
            <Menu
              label="More actions"
              items={moreItems}
              trigger={(props) => (
                <button
                  type="button"
                  className="btn btn-secondary btn-icon"
                  aria-label="More actions"
                  {...props}
                >
                  <Icon name="more" />
                </button>
              )}
            />
          </div>
        </div>
      </div>
      <div className="wrap mt-4 md:mt-7">
        <nav className="tabs gap-5 md:gap-6" aria-label="Proposal">
          {tabs.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className={cn('tab', item.id === tab && 'tab-on')}
              aria-current={item.id === tab ? 'page' : undefined}
            >
              {item.label}
              {item.count !== undefined && <span className="count">{item.count}</span>}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}

/** Phone: one slim bar fixed to the bottom (board 29). */
export function ProposalPhoneBar({ cardLink }: { cardLink?: CardLink }) {
  const { proposal } = useProposalState();
  const tab = useProposalTab(proposal.number);
  const moreItems = useMoreItems(cardLink);
  const base = `/proposals/${proposal.number}`;
  return (
    <div className="abar md:hidden">
      <Link href={`${base}/reviews`} className="btn btn-primary btn-lg flex-1">
        Review
      </Link>
      {tab === 'preview' ? (
        <Link href={base} className="btn btn-secondary btn-lg">
          Overview
        </Link>
      ) : (
        <Link href={`${base}/preview`} className="btn btn-secondary btn-lg">
          Preview
        </Link>
      )}
      <Menu
        label="More actions"
        placement="above"
        items={[
          ...moreItems,
          {
            label: 'Changes',
            icon: <Icon name="pencil" />,
            href: `${base}/changes`,
            separatorBefore: true,
          },
        ]}
        trigger={(props) => (
          <button
            type="button"
            className="btn btn-ghost btn-icon btn-lg"
            aria-label="More actions"
            {...props}
          >
            <Icon name="more" size="lg" />
          </button>
        )}
      />
    </div>
  );
}
