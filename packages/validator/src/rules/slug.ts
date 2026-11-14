import { TEXT_LIMITS, isReservedSlug, isSlug } from '@mustlist/schema';
import type { Diagnostic, Rule } from '../types';
import { diagnostic, issuesFor, locationFromPath, rawString } from '../util';

const slugHelp = `lowercase kebab-case, ${TEXT_LIMITS.slugMin}-${TEXT_LIMITS.slugMax} characters`;

/** Topic and stack slugs are kebab-case; the topic is not a reserved slug. */
export const slugRule: Rule = {
  id: 'slug',
  description: 'Topic and stack slugs are kebab-case; topic is not reserved',
  check: (context) => {
    const found: Diagnostic[] = issuesFor(context, 'slug');
    const location = locationFromPath(context.card.filePath);
    if (!location) return found;

    if (!isSlug(location.stack)) {
      found.push(
        diagnostic(
          context,
          'slug',
          1,
          `file name "${location.stack}.md" must be a stack slug: ${slugHelp}`,
        ),
      );
    }
    // The `topic` field is checked by the schema; only report the folder when it differs.
    if (rawString(context, 'topic') !== location.topic) {
      if (!isSlug(location.topic)) {
        found.push(
          diagnostic(
            context,
            'slug',
            1,
            `folder "${location.topic}" must be a topic slug: ${slugHelp}`,
          ),
        );
      } else if (isReservedSlug(location.topic)) {
        found.push(diagnostic(context, 'slug', 1, `folder "${location.topic}" is a reserved slug`));
      }
    }
    return found;
  },
};
