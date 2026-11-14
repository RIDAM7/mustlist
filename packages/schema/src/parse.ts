import { LineCounter, isNode, parseDocument } from 'yaml';
import { type BodyOutline, type Section, extractOutline } from './sections';

export interface CardParseError {
  line: number;
  message: string;
}

export interface ParsedCard {
  /** Path as given, with forward slashes. */
  filePath: string;
  /** The file text exactly as read. */
  raw: string;
  /** The text with a leading BOM removed and line endings normalised to LF. */
  text: string;
  /** Parsed YAML frontmatter, not yet validated. `undefined` when it could not be parsed. */
  frontmatter: unknown;
  /** Missing frontmatter or YAML syntax errors. */
  parseErrors: CardParseError[];
  /** Everything after the closing `---`. */
  body: string;
  /** 1-based file line of the first body line. */
  bodyStartLine: number;
  /** H2 sections with their H3 children (from `body`). */
  sections: Section[];
  /** The full body outline, including H1 headings and text before the first H2. */
  outline: BodyOutline;
  /** 1-based file line for a frontmatter path such as `['checklist', 2, 'text']`. */
  lineOf: (path: readonly PropertyKey[]) => number;
}

const FRONTMATTER_PATTERN = /^---\n(?:([\s\S]*?)\n)?---[ \t]*(?:\n|$)/;

/** Remove a BOM and normalise CRLF/CR line endings to LF. */
export function normaliseText(raw: string): string {
  return raw.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
}

export function toPosixPath(filePath: string): string {
  return filePath.replace(/\\/g, '/');
}

interface FrontmatterParse {
  data: unknown;
  errors: CardParseError[];
  lineOf: (path: readonly PropertyKey[]) => number;
}

/** Parse YAML that starts on file line 2 (right after the opening `---`). */
function parseFrontmatterYaml(yamlText: string): FrontmatterParse {
  const firstLine = 2;
  const lineCounter = new LineCounter();
  const doc = parseDocument(yamlText, { lineCounter, prettyErrors: false, uniqueKeys: true });
  const toFileLine = (offset: number) =>
    Math.max(lineCounter.linePos(offset).line, 1) + firstLine - 1;

  const lineOf = (path: readonly PropertyKey[]): number => {
    for (let length = path.length; length >= 0; length--) {
      const node: unknown = doc.getIn(path.slice(0, length), true);
      if (isNode(node) && node.range) return toFileLine(node.range[0]);
    }
    return firstLine;
  };

  const errors = doc.errors.map((error) => ({
    line: toFileLine(error.pos[0]),
    message: `YAML: ${error.message.split('\n')[0] ?? error.message}`,
  }));
  return { data: errors.length === 0 ? doc.toJS() : undefined, errors, lineOf };
}

/**
 * Parse a card file into frontmatter (unvalidated), body and sections.
 * Never throws: problems are returned in `parseErrors`.
 */
export function parseCard(raw: string, filePath: string): ParsedCard {
  const text = normaliseText(raw);
  const match = FRONTMATTER_PATTERN.exec(text);
  const base = { filePath: toPosixPath(filePath), raw, text };

  if (!match) {
    const outline = extractOutline(text, 0);
    return {
      ...base,
      frontmatter: undefined,
      parseErrors: [
        { line: 1, message: 'Missing YAML frontmatter: the file must start with a `---` line' },
      ],
      body: text,
      bodyStartLine: 1,
      sections: outline.sections,
      outline,
      lineOf: () => 1,
    };
  }

  const yaml = parseFrontmatterYaml(match[1] ?? '');
  const body = text.slice(match[0].length);
  const bodyStartLine = match[0].split('\n').length;
  const outline = extractOutline(body, bodyStartLine - 1);
  return {
    ...base,
    frontmatter: yaml.data,
    parseErrors: yaml.errors,
    body,
    bodyStartLine,
    sections: outline.sections,
    outline,
    lineOf: yaml.lineOf,
  };
}
