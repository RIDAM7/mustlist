import type { Metadata } from 'next';
import Link from 'next/link';
import { stackTitle, topicTitle } from '@mustlist/schema/site';
import { CardSearch } from '@/components/card-search';
import { JsonLd } from '@/components/json-ld';
import { StatusBadge } from '@/components/status-badge';
import { getIndex, getTopics, splitId } from '@/lib/data';
import { breadcrumbJsonLd, collectionJsonLd } from '@/lib/seo';
import { LIBRARY_URL, SITE_NAME, SITE_PITCH, SITE_TAGLINE } from '@/lib/site';

export const metadata: Metadata = {
  title: { absolute: `${SITE_NAME}: ${SITE_TAGLINE}` },
  description: SITE_PITCH,
  alternates: { canonical: LIBRARY_URL },
};

export default function LibraryHub() {
  const cards = getIndex();
  const topics = getTopics();
  const byId = new Map(cards.map((card) => [card.id, card]));

  return (
    <div className="space-y-12">
      <JsonLd data={collectionJsonLd(`${SITE_NAME} library`, LIBRARY_URL, cards)} />
      <JsonLd data={breadcrumbJsonLd([{ name: 'Library', url: LIBRARY_URL }])} />

      <section className="space-y-5">
        <h1 className="font-heading text-4xl font-semibold tracking-tight">{SITE_NAME}</h1>
        <p className="max-w-2xl text-lg text-muted-foreground">{SITE_PITCH}</p>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Context7 tells your agent the current API. {SITE_NAME} tells it what to build, and what
          you forgot to ask for.
        </p>
        <CardSearch />
      </section>

      <section aria-labelledby="topics-title" className="space-y-6">
        <h2 id="topics-title" className="font-heading text-2xl font-semibold tracking-tight">
          Topics
        </h2>
        <ul className="grid gap-4 sm:grid-cols-2">
          {topics.map(({ topic, cards: ids }) => (
            <li key={topic} className="rounded-xl border p-4">
              <h3 className="font-heading text-lg font-medium">
                <Link href={`/${topic}`} className="hover:underline">
                  {topicTitle(topic)}
                </Link>
              </h3>
              <ul className="mt-3 space-y-2">
                {ids.map((id) => {
                  const card = byId.get(id);
                  if (!card) return null;
                  return (
                    <li key={id} className="flex items-center justify-between gap-3 text-sm">
                      <Link href={`/${id}`} className="hover:underline">
                        {stackTitle(splitId(id).stack)}
                      </Link>
                      <StatusBadge status={card.status} />
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
