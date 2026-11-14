import type { Diagnostic, Rule } from '../types';
import { diagnostic, rawString, rawStringList } from '../util';

/** Related card ids exist. An error for verified cards, a warning otherwise. */
export const relatedRule: Rule = {
  id: 'related',
  description: 'Related card ids exist (error for verified cards, warning otherwise)',
  check: (context, project) => {
    const related = context.data?.related ?? rawStringList(context, 'related');
    const ownId = context.data?.id ?? rawString(context, 'id');
    const status = context.data?.status ?? rawString(context, 'status');
    const severity = status === 'verified' ? 'error' : 'warning';
    const found: Diagnostic[] = [];

    related.forEach((id, index) => {
      const line = context.card.lineOf(['related', index]);
      if (id === ownId) {
        found.push(
          diagnostic(context, 'related', line, 'related lists the card itself', 'warning'),
        );
      } else if (!project.knownIds.has(id)) {
        found.push(
          diagnostic(context, 'related', line, `related card "${id}" does not exist`, severity),
        );
      }
    });
    return found;
  },
};
