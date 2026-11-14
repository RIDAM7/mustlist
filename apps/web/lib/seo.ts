import type { Metadata } from 'next';
import { PUBLIC_STATUSES, type Status } from '@mustlist/schema/constants';
import type { CardJSON } from '@mustlist/schema/types';
import { stackTitle, topicTitle } from '@mustlist/schema/site';
import { LIBRARY_URL, LICENSE_CONTENT_URL, SITE_NAME, SITE_URL } from './site';

/** Only verified and stale cards may be indexed; drafts and proposals are `noindex, follow`. */
export function isIndexable(status: Status): boolean {
  return PUBLIC_STATUSES.includes(status);
}

export function robotsFor(indexable: boolean): Metadata['robots'] {
  return indexable ? { index: true, follow: true } : { index: false, follow: true };
}

/** Cut text at a word boundary so it fits `max` characters. */
export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), 0)).replace(/[\s,.;:]+$/, '')}…`;
}

/**
 * `{title} — verified best practices | Mustlist` for reviewed cards, trimmed to stay
 * near 60 characters. Unreviewed cards never claim to be verified.
 */
export function cardPageTitle(card: Pick<CardJSON, 'title' | 'status'>): string {
  const candidates = isIndexable(card.status)
    ? [`${card.title} — verified best practices | ${SITE_NAME}`, `${card.title} | ${SITE_NAME}`]
    : [`${card.title} | ${SITE_NAME}`];
  return candidates.find((title) => title.length <= 60) ?? card.title;
}

/** Serialise JSON-LD safely for a <script> tag (escape `<` as recommended by Next.js). */
export function jsonLdString(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\' + 'u003c');
}

export function breadcrumbJsonLd(items: { name: string; url: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export function cardBreadcrumbs(card: Pick<CardJSON, 'id' | 'topic'>) {
  const stack = card.id.split('/')[1] ?? '';
  return [
    { name: 'Library', url: LIBRARY_URL },
    { name: topicTitle(card.topic), url: `${LIBRARY_URL}/${card.topic}` },
    { name: stackTitle(stack), url: `${LIBRARY_URL}/${card.id}` },
  ];
}

export function techArticleJsonLd(card: CardJSON) {
  return {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline: card.title,
    description: card.summary,
    url: `${LIBRARY_URL}/${card.id}`,
    mainEntityOfPage: `${LIBRARY_URL}/${card.id}`,
    author: card.authors.map((handle) => ({
      '@type': 'Person',
      name: handle,
      url: `https://github.com/${handle}`,
    })),
    ...(card.last_verified ? { dateModified: card.last_verified } : {}),
    about: [topicTitle(card.topic), ...card.stack.map((slug) => stackTitle(slug))].map((name) => ({
      '@type': 'Thing',
      name,
    })),
    version: card.card_version,
    isAccessibleForFree: true,
    license: LICENSE_CONTENT_URL,
    publisher: { '@type': 'Organization', name: SITE_NAME, url: LIBRARY_URL },
  };
}

export function collectionJsonLd(
  name: string,
  url: string,
  cards: { title: string; id: string }[],
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name,
    url,
    isPartOf: { '@type': 'WebSite', name: SITE_NAME, url: SITE_URL },
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: cards.map((card, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: card.title,
        url: `${LIBRARY_URL}/${card.id}`,
      })),
    },
  };
}
