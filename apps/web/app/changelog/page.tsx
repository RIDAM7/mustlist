import type { Metadata } from 'next';
import Link from 'next/link';
import { InfoPage, InfoSection } from '@/components/info-page';
import { StatusBadge } from '@/components/status-badge';
import { getIndex } from '@/lib/data';
import { isIndexable } from '@/lib/seo';
import { LIBRARY_URL, SITE_NAME } from '@/lib/site';

const intro = 'Cards that were verified or re-checked, newest first, and cards in progress.';

export const metadata: Metadata = {
  title: { absolute: `Changelog | ${SITE_NAME}` },
  description: intro,
  alternates: { canonical: `${LIBRARY_URL}/changelog` },
};

export default function ChangelogPage() {
  const cards = getIndex();
  const reviewed = cards
    .filter((card) => isIndexable(card.status) && card.last_verified)
    .sort((a, b) => (b.last_verified ?? '').localeCompare(a.last_verified ?? ''));
  const inProgress = cards.filter((card) => !isIndexable(card.status));

  return (
    <InfoPage slug="changelog" title="Changelog" intro={intro}>
      <InfoSection title="Verified and re-checked">
        {reviewed.length === 0 ? (
          <p>No cards are verified yet.</p>
        ) : (
          <ul>
            {reviewed.map((card) => (
              <li key={card.id}>
                <time dateTime={card.last_verified ?? undefined}>{card.last_verified}</time>:{' '}
                <Link href={`/${card.id}`}>{card.title}</Link> (v{card.card_version})
              </li>
            ))}
          </ul>
        )}
      </InfoSection>

      <InfoSection title="In progress">
        {inProgress.length === 0 ? (
          <p>Nothing in progress.</p>
        ) : (
          <ul>
            {inProgress.map((card) => (
              <li key={card.id}>
                <Link href={`/${card.id}`}>{card.title}</Link> <StatusBadge status={card.status} />
              </li>
            ))}
          </ul>
        )}
      </InfoSection>
    </InfoPage>
  );
}
