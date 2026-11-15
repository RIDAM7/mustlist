import { notFound } from 'next/navigation';
import type { CardJSON } from '@mustlist/schema/types';
import { getCard } from './data';

/** Card for a `[topic]/[stack]` route, or a real 404. */
export async function loadCard(
  params: Promise<{ topic: string; stack: string }>,
): Promise<CardJSON> {
  const { topic, stack } = await params;
  const card = getCard(`${topic}/${stack}`);
  if (!card) notFound();
  return card;
}
