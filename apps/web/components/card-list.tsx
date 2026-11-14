import Link from 'next/link';
import type { CardIndexEntry } from '@mustlist/schema/types';
import { StatusBadge } from '@/components/status-badge';

/** A list of cards with title, summary and status, used on topic and stack hubs. */
export function CardList({
  cards,
  label,
}: {
  cards: CardIndexEntry[];
  label: (card: CardIndexEntry) => string;
}) {
  return (
    <ul className="space-y-4">
      {cards.map((card) => (
        <li key={card.id} className="rounded-xl border p-4">
          <div className="flex items-center justify-between gap-3">
            <Link href={`/${card.id}`} className="font-medium hover:underline">
              {label(card)}
            </Link>
            <StatusBadge status={card.status} />
          </div>
          <p className="mt-2 text-sm text-muted-foreground">{card.summary}</p>
        </li>
      ))}
    </ul>
  );
}

export function Breadcrumbs({ items }: { items: { name: string; href?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
      {items.map((item, index) => (
        <span key={item.name}>
          {index > 0 && ' › '}
          {item.href ? (
            <Link href={item.href} className="hover:underline">
              {item.name}
            </Link>
          ) : (
            item.name
          )}
        </span>
      ))}
    </nav>
  );
}
