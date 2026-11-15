import type { Metadata } from 'next';
import { stackTitle } from '@mustlist/schema/site';
import { JsonLd } from '@/components/json-ld';
import { StacksGrid, type StackTile } from '@/components/stacks-grid';
import { Crumbs } from '@/components/ui';
import { loadCommunity } from '@/lib/community/load';
import { getIndex, getStacks } from '@/lib/data';
import { breadcrumbJsonLd } from '@/lib/seo';
import { LIBRARY_URL, SITE_NAME } from '@/lib/site';
import { stackParts } from '@/lib/topics';

export const metadata: Metadata = {
  title: { absolute: `Stacks | ${SITE_NAME}` },
  description: 'Every stack with cards, and the stacks people are asking for.',
  alternates: { canonical: `${LIBRARY_URL}/stacks` },
};

/** Index of stacks: those with cards, then those only requested. */
export default async function StacksPage() {
  const community = await loadCommunity();
  const index = getIndex();
  const open = community.requests.filter((r) => r.status === 'open' || r.status === 'in-progress');
  const withCards = getStacks().map((s) => s.stack);
  const requestedOnly = [...new Set(open.map((r) => r.stack))].filter(
    (s) => !withCards.includes(s),
  );

  const tiles: StackTile[] = [...withCards, ...requestedOnly].map((stack) => {
    const cards = index.filter((c) => c.id.split('/')[1] === stack);
    return {
      slug: stack,
      name: stackTitle(stack),
      parts: stackParts(stack),
      cards: cards.length,
      verified: cards.filter((c) => c.status === 'verified').length,
      requested: open.filter((r) => r.stack === stack).length,
      hasCards: cards.length > 0,
      href:
        cards.length > 0
          ? `/stacks/${stack}`
          : `/requests/${[...open].sort((a, b) => b.need - a.need).find((r) => r.stack === stack)?.number ?? ''}`,
    };
  });

  return (
    <div className="wrap pb-24 pt-6 md:pt-8">
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Library', url: LIBRARY_URL },
          { name: 'Stacks', url: `${LIBRARY_URL}/stacks` },
        ])}
      />
      <Crumbs items={[{ name: 'Library', href: '/' }, { name: 'Stacks' }]} />
      <StacksGrid tiles={tiles} sample={community.source === 'sample'} />
    </div>
  );
}
