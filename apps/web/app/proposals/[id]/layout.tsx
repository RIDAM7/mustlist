import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ProposalHeader, ProposalPhoneBar } from '@/components/proposals/proposal-header';
import { ProposalStateProvider } from '@/components/proposals/proposal-state';
import { cardLinkFor, proposalFromParam } from '@/components/proposals/server';
import { SampleBanner } from '@/components/ui';
import { isSampleData, listProposals } from '@/lib/community';
import { SITE_NAME } from '@/lib/site';

export function generateStaticParams() {
  return listProposals().map((proposal) => ({ id: String(proposal.number) }));
}

// Known proposals are prerendered; unknown ids block so notFound() sends a real 404.
export const instant = false;

export async function generateMetadata({
  params,
}: LayoutProps<'/proposals/[id]'>): Promise<Metadata> {
  const { id } = await params;
  const proposal = proposalFromParam(id);
  if (!proposal) return {};
  return {
    title: { absolute: `#${proposal.number} ${proposal.title} | ${SITE_NAME}` },
    robots: { index: false, follow: true },
  };
}

export default async function ProposalLayout({ children, params }: LayoutProps<'/proposals/[id]'>) {
  const { id } = await params;
  const proposal = proposalFromParam(id);
  if (!proposal) notFound();
  const cardLink = cardLinkFor(proposal);

  return (
    <ProposalStateProvider number={proposal.number}>
      <ProposalHeader cardLink={cardLink} />
      {isSampleData && (
        <div className="wrap pt-5 md:pt-6">
          <SampleBanner />
        </div>
      )}
      {children}
      <ProposalPhoneBar cardLink={cardLink} />
    </ProposalStateProvider>
  );
}
