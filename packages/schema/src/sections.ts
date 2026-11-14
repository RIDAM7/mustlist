import type { Heading, Root } from 'mdast';
import { toString } from 'mdast-util-to-string';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import { unified } from 'unified';

export interface Section {
  /** Heading text, for example "Why this approach". */
  title: string;
  depth: 2 | 3;
  /** 1-based line of the heading in the card file. */
  line: number;
  /** Markdown under the heading (H2 sections include their H3 sub-sections). */
  markdown: string;
  /** H3 sub-sections of an H2 section. Always empty for H3 sections. */
  children: Section[];
}

export interface HeadingRef {
  title: string;
  depth: number;
  line: number;
}

export interface BodyOutline {
  /** H2 sections in document order, each with its H3 children. */
  sections: Section[];
  /** H1 headings (not allowed in cards; reported by the validator). */
  h1: HeadingRef[];
  /** Markdown before the first H2, trimmed. Empty when there is none. */
  preamble: string;
  /** Line of the first non-blank preamble content, or 0. */
  preambleLine: number;
}

export function parseMarkdown(markdown: string): Root {
  return unified().use(remarkParse).use(remarkGfm).parse(markdown);
}

interface HeadingAt {
  title: string;
  depth: number;
  line: number;
  start: number;
  contentStart: number;
}

function topLevelHeadings(tree: Root): HeadingAt[] {
  return tree.children
    .filter((node): node is Heading => node.type === 'heading' && node.depth <= 3)
    .map((node) => ({
      title: toString(node).trim(),
      depth: node.depth,
      line: node.position?.start.line ?? 1,
      start: node.position?.start.offset ?? 0,
      contentStart: node.position?.end.offset ?? 0,
    }));
}

/** Offset where a heading's content ends: the next heading of the same or higher level. */
function contentEnd(headings: HeadingAt[], index: number, bodyLength: number): number {
  const current = headings[index];
  if (!current) return bodyLength;
  const next = headings.slice(index + 1).find((heading) => heading.depth <= current.depth);
  return next?.start ?? bodyLength;
}

/**
 * Split a card body into its H2/H3 outline.
 * `lineOffset` converts body lines to file lines (first body line = lineOffset + 1).
 */
export function extractOutline(body: string, lineOffset = 0): BodyOutline {
  const headings = topLevelHeadings(parseMarkdown(body));
  const sections: Section[] = [];
  const h1: HeadingRef[] = [];
  let current: Section | undefined;

  headings.forEach((heading, index) => {
    const line = heading.line + lineOffset;
    if (heading.depth === 1) {
      h1.push({ title: heading.title, depth: 1, line });
      current = undefined;
      return;
    }
    const section: Section = {
      title: heading.title,
      depth: heading.depth === 2 ? 2 : 3,
      line,
      markdown: body.slice(heading.contentStart, contentEnd(headings, index, body.length)).trim(),
      children: [],
    };
    if (section.depth === 2) {
      sections.push(section);
      current = section;
    } else if (current) {
      current.children.push(section);
    }
  });

  const firstH2 = headings.find((heading) => heading.depth === 2);
  const preambleRaw = body.slice(0, firstH2?.start ?? body.length);
  const preamble = preambleRaw.trim();
  const leadingBlankLines =
    preamble === ''
      ? 0
      : preambleRaw.slice(0, preambleRaw.indexOf(preamble)).split('\n').length - 1;

  return {
    sections,
    h1,
    preamble,
    preambleLine: preamble === '' ? 0 : leadingBlankLines + 1 + lineOffset,
  };
}

/** Find an H2 section by its exact title. */
export function findSection(sections: readonly Section[], title: string): Section | undefined {
  return sections.find((section) => section.title === title);
}
