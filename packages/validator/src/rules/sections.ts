import {
  COUNT_LIMITS,
  REQUIRED_SECTIONS,
  SECTION_ORDER,
  SECTION_TITLES,
  findSection,
  parseMarkdown,
} from '@mustlist/schema';
import type { CardContext, Diagnostic, Rule } from '../types';
import { diagnostic } from '../util';

/** Number of top-level list items in a markdown fragment. */
export function countTopLevelBullets(markdown: string): number {
  return parseMarkdown(markdown)
    .children.filter((node) => node.type === 'list')
    .reduce((total, list) => total + (list.type === 'list' ? list.children.length : 0), 0);
}

/** Rough sentence count: sentence-ending punctuation followed by a space or the end. */
export function countSentences(markdown: string): number {
  return (markdown.match(/[.!?](?=\s|$)/g) ?? []).length;
}

function structureProblems(context: CardContext): Diagnostic[] {
  const { outline, bodyStartLine, sections } = context.card;
  const found: Diagnostic[] = [];

  for (const heading of outline.h1) {
    found.push(
      diagnostic(
        context,
        'sections',
        heading.line,
        `Remove the H1 "# ${heading.title}": the page title comes from \`title\` in the frontmatter`,
      ),
    );
  }
  if (outline.preamble !== '' && outline.h1.length === 0) {
    found.push(
      diagnostic(
        context,
        'sections',
        outline.preambleLine,
        'Text before the first "##" heading is not shown anywhere: move it into a section',
      ),
    );
  }

  const seen = new Set<string>();
  let lastIndex = -1;
  let lastTitle = '';
  for (const section of sections) {
    const index = SECTION_ORDER.indexOf(section.title);
    if (index === -1) {
      found.push(
        diagnostic(
          context,
          'sections',
          section.line,
          `Unknown section "## ${section.title}". Allowed, in order: ${SECTION_ORDER.join(', ')}`,
        ),
      );
      continue;
    }
    if (seen.has(section.title)) {
      found.push(
        diagnostic(
          context,
          'sections',
          section.line,
          `Section "## ${section.title}" appears twice`,
        ),
      );
      continue;
    }
    if (index < lastIndex) {
      found.push(
        diagnostic(
          context,
          'sections',
          section.line,
          `"## ${section.title}" must come before "## ${lastTitle}"`,
        ),
      );
    }
    seen.add(section.title);
    lastIndex = Math.max(lastIndex, index);
    if (index === lastIndex) lastTitle = section.title;
  }

  for (const title of REQUIRED_SECTIONS) {
    if (!seen.has(title)) {
      found.push(
        diagnostic(context, 'sections', bodyStartLine, `Missing required section "## ${title}"`),
      );
    }
  }
  return found;
}

function contentProblems(context: CardContext): Diagnostic[] {
  const found: Diagnostic[] = [];
  const { sections } = context.card;

  const mistakes = findSection(sections, SECTION_TITLES.mistakes);
  if (mistakes) {
    const [min, max] = COUNT_LIMITS.mistakes;
    const bullets = countTopLevelBullets(mistakes.markdown);
    if (bullets < min || bullets > max) {
      found.push(
        diagnostic(
          context,
          'sections',
          mistakes.line,
          `"## ${mistakes.title}" needs ${min}-${max} bullet points (found ${bullets})`,
        ),
      );
    }
  }

  const why = findSection(sections, SECTION_TITLES.why);
  if (why) {
    const sentences = countSentences(why.markdown);
    if (sentences < 2 || sentences > 6) {
      found.push(
        diagnostic(
          context,
          'sections',
          why.line,
          `"## ${why.title}" should be 2-6 sentences (found about ${sentences})`,
          'warning',
        ),
      );
    }
  }
  return found;
}

/** Required H2 sections are present, in order, with no unknown H2s; content sizes fit. */
export const sectionsRule: Rule = {
  id: 'sections',
  description: 'Required sections present, in order, no unknown H2',
  check: (context) => [...structureProblems(context), ...contentProblems(context)],
};
