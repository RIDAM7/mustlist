import { getProposal, type Proposal } from '@/lib/community';
import { getCard } from '@/lib/data';
import { topicName } from '@/lib/topics';
import type { CardLink } from './proposal-header';

/** `"17"` -> the proposal, or undefined for anything that is not a known number. */
export function proposalFromParam(id: string): Proposal | undefined {
  return /^\d+$/.test(id) ? getProposal(Number(id)) : undefined;
}

/** "Payment webhooks · v1.0.0" linking to the card this proposal changes. */
export function cardLinkFor(proposal: Proposal): CardLink | undefined {
  if (!proposal.cardId) return undefined;
  const card = getCard(proposal.cardId);
  if (!card) return undefined;
  return {
    label: `${topicName(card.topic)} · v${proposal.fromVersion ?? card.card_version}`,
    href: `/${card.id}`,
  };
}
