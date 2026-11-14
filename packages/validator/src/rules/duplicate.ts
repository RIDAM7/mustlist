import type { CardContext, Rule } from '../types';
import { diagnostic, locationFromPath, rawString } from '../util';

/**
 * Identity of a card: its topic plus the set of technologies in its stack slug,
 * so `auth/nextjs-postgres` and `auth/postgres-nextjs` are the same card.
 */
export function cardKey(context: CardContext): string | undefined {
  const location = locationFromPath(context.card.filePath);
  const id = rawString(context, 'id');
  const [topic, stack] = location ? [location.topic, location.stack] : (id?.split('/') ?? []);
  if (!topic || !stack) return undefined;
  const technologies = stack.toLowerCase().split('-').sort().join('-');
  return `${topic.toLowerCase()}/${technologies}`;
}

/** No second card for the same topic and stack. The first card (by path) wins. */
export const duplicateRule: Rule = {
  id: 'duplicate',
  description: 'No second card for the same topic + stack',
  check: (context, project) => {
    const key = cardKey(context);
    const id = rawString(context, 'id');
    if (key === undefined) return [];
    const position = project.cards.indexOf(context);
    const original = project.cards.find(
      (other, index) =>
        index < position &&
        (cardKey(other) === key || (id !== undefined && rawString(other, 'id') === id)),
    );
    if (!original) return [];
    return [
      diagnostic(
        context,
        'duplicate',
        context.card.lineOf(['id']),
        `Same topic and stack as ${original.card.filePath}: update that card instead of adding another`,
      ),
    ];
  },
};
