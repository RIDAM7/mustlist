import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ProposalHeader, ProposalPhoneBar } from '@/components/proposals/proposal-header';
import { ProposalStateProvider } from '@/components/proposals/proposal-state';
import { cardLinkFor, proposalFromParam } from '@/components/proposals/server';
import { SourceBanner } from '@/components/ui';
import { loadCommunity } from '@/lib/community/load';
import { SITE_NAME } from '@/lib/site';

export async function generateStaticParams() {
  const { proposals } = await loadCommunity();
  // Cache Components needs at least one sample param; "0" is never a proposal (404).
  return proposals.length ? proposals.map((p) => ({ id: String(p.number) })) : [{ id: '0' }];
}

// Known proposals are prerendered; unknown ids block so notFound() sends a real 404.
export const instant = false;

export async function generateMetadata({
  params,
}: LayoutProps<'/proposals/[id]'>): Promise<Metadata> {
  const { id } = await params;
  const proposal = proposalFromParam(await loadCommunity(), id);
  if (!proposal) return {};
  return {
    title: { absolute: `#${proposal.number} ${proposal.title} | ${SITE_NAME}` },
    robots: { index: false, follow: true },
  };
}

export default async function ProposalLayout({ children, params }: LayoutProps<'/proposals/[id]'>) {
  const { id } = await params;
  const community = await loadCommunity();
  const proposal = proposalFromParam(community, id);
  if (!proposal) notFound();
  // The preview card is rendered on the server; the browser does not need it.
  const { previewCard, ...clientProposal } = proposal;
  void previewCard;
  const cardLink = cardLinkFor(proposal);

  return (
    <ProposalStateProvider proposal={clientProposal} people={community.people} now={community.now}>
      <ProposalHeader cardLink={cardLink} />
      {(community.source === 'sample' || community.unavailable) && (
        <div className="wrap pt-5 md:pt-6">
          <SourceBanner source={community.source} unavailable={community.unavailable} />
        </div>
      )}
      {children}
      <ProposalPhoneBar cardLink={cardLink} />
    </ProposalStateProvider>
  );
}
