import { SECTION_TITLES, findSection } from '@mustlist/schema';
import type { Rule } from '../types';
import { diagnostic, rawString } from '../util';

/** `## Notes for reviewers` must be empty or absent once a card is verified. */
export const reviewerNotesRule: Rule = {
  id: 'reviewer-notes',
  description: '"Notes for reviewers" is empty or absent when verified',
  check: (context) => {
    const status = context.data?.status ?? rawString(context, 'status');
    const notes = findSection(context.card.sections, SECTION_TITLES.reviewerNotes);
    if (status !== 'verified' || !notes || notes.markdown === '') return [];
    return [
      diagnostic(
        context,
        'reviewer-notes',
        notes.line,
        `Resolve and remove "## ${notes.title}" before a card is verified`,
      ),
    ];
  },
};
