import type { ReactNode } from 'react';
import { Breadcrumbs } from '@/components/card-list';
import { JsonLd } from '@/components/json-ld';
import { breadcrumbJsonLd } from '@/lib/seo';
import { LIBRARY_URL } from '@/lib/site';

/** Layout for the simple text pages (About, Contribute, Discuss, Changelog). */
export function InfoPage({
  slug,
  title,
  intro,
  children,
}: {
  slug: string;
  title: string;
  intro: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-8">
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Library', url: LIBRARY_URL },
          { name: title, url: `${LIBRARY_URL}/${slug}` },
        ])}
      />
      <Breadcrumbs items={[{ name: 'Library', href: '/' }, { name: title }]} />
      <header className="space-y-3">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="max-w-2xl text-lg text-muted-foreground">{intro}</p>
      </header>
      <div className="card-prose max-w-2xl space-y-6">{children}</div>
    </div>
  );
}

export function InfoSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="font-heading text-xl font-semibold tracking-tight">{title}</h2>
      {children}
    </section>
  );
}
