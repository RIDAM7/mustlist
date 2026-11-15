import type { ReactNode } from 'react';
import { JsonLd } from '@/components/json-ld';
import { Crumbs } from '@/components/ui';
import { breadcrumbJsonLd } from '@/lib/seo';
import { LIBRARY_URL } from '@/lib/site';

/** Layout for the text pages (About, Connect): breadcrumbs, title, lead, prose. */
export function InfoPage({
  slug,
  title,
  intro,
  children,
  wide = false,
}: {
  slug: string;
  title: string;
  intro: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="wrap pb-24 pt-6 md:pt-8">
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Library', url: LIBRARY_URL },
          { name: title, url: `${LIBRARY_URL}/${slug}` },
        ])}
      />
      <Crumbs items={[{ name: 'Library', href: '/' }, { name: title }]} />
      <h1 className="t-h1 mt-4 max-md:text-[30px] max-md:leading-9">{title}</h1>
      <p className="t-lead muted mt-2 max-w-[640px] max-md:text-base">{intro}</p>
      <div
        className={wide ? 'mt-10 flex flex-col gap-12' : 'mt-10 flex max-w-[68ch] flex-col gap-10'}
      >
        {children}
      </div>
    </div>
  );
}

export function InfoSection({
  title,
  children,
  id,
}: {
  title: string;
  children: ReactNode;
  id?: string;
}) {
  return (
    <section id={id} aria-label={title}>
      <h2 className="sec-h mb-3">{title}</h2>
      <div className="md prose">{children}</div>
    </section>
  );
}
