import { LENSES, LENS_TITLES, type Lens, SECTION_TITLES, findSection } from '@mustlist/schema';
import type { CardContext, Diagnostic, Rule } from '../types';
import { diagnostic, rawStringList } from '../util';

const lensByTitle = new Map<string, Lens>(LENSES.map((lens) => [LENS_TITLES[lens], lens]));

function listedLenses(context: CardContext): Lens[] {
  const lenses: readonly string[] = context.data?.lenses ?? rawStringList(context, 'lenses');
  return LENSES.filter((lens) => lenses.includes(lens));
}

/** Every lens in `lenses` has its `###` section under `## Lenses`, and vice versa. */
export const lensSectionsRule: Rule = {
  id: 'lens-sections',
  description: 'Every listed lens has its ### section, and vice versa',
  check: (context) => {
    const lensesSection = findSection(context.card.sections, SECTION_TITLES.lenses);
    if (!lensesSection) return []; // reported by the sections rule

    const found: Diagnostic[] = [];
    const listed = listedLenses(context);
    const present = new Map<Lens, number>();
    let lastOrder = -1;

    for (const child of lensesSection.children) {
      const lens = lensByTitle.get(child.title);
      if (!lens) {
        found.push(
          diagnostic(
            context,
            'lens-sections',
            child.line,
            `Unknown lens section "### ${child.title}". Use: ${LENSES.map((l) => LENS_TITLES[l]).join(', ')}`,
          ),
        );
        continue;
      }
      if (present.has(lens)) {
        found.push(
          diagnostic(context, 'lens-sections', child.line, `"### ${child.title}" appears twice`),
        );
        continue;
      }
      present.set(lens, child.line);
      const order = LENSES.indexOf(lens);
      if (order < lastOrder) {
        found.push(
          diagnostic(
            context,
            'lens-sections',
            child.line,
            `"### ${child.title}" is out of order. Order: ${LENSES.map((l) => LENS_TITLES[l]).join(', ')}`,
          ),
        );
      }
      lastOrder = Math.max(lastOrder, order);
      if (!listed.includes(lens)) {
        found.push(
          diagnostic(
            context,
            'lens-sections',
            child.line,
            `"### ${child.title}" has no matching entry in \`lenses\`: add "${lens}" or remove the section`,
          ),
        );
      }
      if (child.markdown === '') {
        found.push(
          diagnostic(context, 'lens-sections', child.line, `"### ${child.title}" is empty`),
        );
      }
    }

    for (const lens of listed) {
      if (!present.has(lens)) {
        found.push(
          diagnostic(
            context,
            'lens-sections',
            lensesSection.line,
            `Lens "${lens}" is listed in \`lenses\` but "### ${LENS_TITLES[lens]}" is missing`,
          ),
        );
      }
    }

    const firstChild = lensesSection.children[0];
    const intro = firstChild
      ? lensesSection.markdown.slice(0, lensesSection.markdown.indexOf(`### ${firstChild.title}`))
      : lensesSection.markdown;
    if (intro.trim() !== '') {
      found.push(
        diagnostic(
          context,
          'lens-sections',
          lensesSection.line,
          'Text directly under "## Lenses" is not shown: move it into a lens section',
          'warning',
        ),
      );
    }
    return found;
  },
};
