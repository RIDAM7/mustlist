import type { Rule } from '../types';
import { diagnostic, issuesFor } from '../util';

/** Frontmatter matches the card schema (types, required fields, lists, formats). */
export const schemaRule: Rule = {
  id: 'schema',
  description: 'Frontmatter matches the card schema',
  check: (context) => [
    ...context.card.parseErrors.map((error) =>
      diagnostic(context, 'schema', error.line, error.message),
    ),
    ...issuesFor(context, 'schema'),
  ],
};

/** `recommended`, `points_to` and decision defaults point at real ids; ids are unique. */
export const refsRule: Rule = {
  id: 'refs',
  description: 'References point at existing option ids; ids are unique',
  check: (context) => issuesFor(context, 'refs'),
};

/** Version ranges are valid and don't overlap; docs are official; Context7 links are Context7. */
export const versionsRule: Rule = {
  id: 'versions',
  description: 'Version entries have valid, non-overlapping ranges and official docs links',
  check: (context) => issuesFor(context, 'versions'),
};
