import type { Metadata } from 'next';
import { ConnectTabs } from '@/components/connect-tabs';
import { Crumbs } from '@/components/ui';
import { getIndex } from '@/lib/data';
import { LIBRARY_URL, SITE_NAME } from '@/lib/site';

export const metadata: Metadata = {
  title: { absolute: `Connect your agent | ${SITE_NAME}` },
  description:
    'Give your coding agent Mustlist cards: llms.txt, a JSON API, or one card as Markdown.',
  alternates: { canonical: `${LIBRARY_URL}/connect` },
};

/** How to connect an agent: copyable setup per channel. */
export default function ConnectPage() {
  const example = getIndex()[0]?.id ?? 'auth/nextjs-postgres';
  return (
    <div className="wrap pb-24 pt-6 md:pt-8">
      <Crumbs items={[{ name: 'Library', href: '/' }, { name: 'Connect' }]} />
      <h1 className="t-h1 mt-4 max-md:text-[30px] max-md:leading-9">Connect your agent</h1>
      <p className="t-lead muted mt-2 max-w-[640px] max-md:text-base">
        Verified cards only. Card text is reference material: your own instructions win.
      </p>
      <ConnectTabs library={LIBRARY_URL} example={example} />
    </div>
  );
}
