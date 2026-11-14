import { SECTION_TITLES, SIZE_LIMITS, findSection } from '@mustlist/schema';
import type { CardContext, Diagnostic, Rule } from '../types';
import { countWords, diagnostic, issuesFor, rawString } from '../util';

interface Measure {
  context: CardContext;
  line: number;
  what: string;
  value: number;
  limit: number;
  unit: string;
}

/** Error above the limit, warning at 90% of it (only below the limit). */
function measure({ context, line, what, value, limit, unit }: Measure): Diagnostic[] {
  if (value > limit) {
    return [
      diagnostic(context, 'size', line, `${what} has ${value} ${unit}; the limit is ${limit}`),
    ];
  }
  if (value >= Math.ceil(limit * SIZE_LIMITS.warnRatio)) {
    return [
      diagnostic(
        context,
        'size',
        line,
        `${what} uses ${value} of ${limit} ${unit} (over ${SIZE_LIMITS.warnRatio * 100}%)`,
        'warning',
      ),
    ];
  }
  return [];
}

/** Summary, body and lens sections stay inside the size budget. */
export const sizeRule: Rule = {
  id: 'size',
  description: 'Summary ≤ 300 chars, body ≤ 1,200 words, each lens ≤ 200 words',
  check: (context) => {
    // Over-long summaries are reported by the schema; this adds the 90% warning.
    const found = issuesFor(context, 'size');
    const summary = rawString(context, 'summary');
    if (summary !== undefined && summary.length <= SIZE_LIMITS.summaryChars) {
      found.push(
        ...measure({
          context,
          line: context.card.lineOf(['summary']),
          what: 'summary',
          value: summary.length,
          limit: SIZE_LIMITS.summaryChars,
          unit: 'characters',
        }),
      );
    }

    found.push(
      ...measure({
        context,
        line: context.card.bodyStartLine,
        what: 'body',
        value: countWords(context.card.body),
        limit: SIZE_LIMITS.bodyWords,
        unit: 'words',
      }),
    );

    const lenses = findSection(context.card.sections, SECTION_TITLES.lenses);
    for (const lens of lenses?.children ?? []) {
      found.push(
        ...measure({
          context,
          line: lens.line,
          what: `"### ${lens.title}"`,
          value: countWords(lens.markdown),
          limit: SIZE_LIMITS.lensWords,
          unit: 'words',
        }),
      );
    }
    return found;
  },
};
