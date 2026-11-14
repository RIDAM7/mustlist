import { type ParsedCard, parseMarkdown } from '@mustlist/schema';
import { visit } from 'unist-util-visit';

export interface FoundUrl {
  url: string;
  line: number;
}

/** Frontmatter keys whose whole value is a URL. */
const URL_KEYS = new Set(['docs', 'context7', 'url']);

/** `scheme://...` inside free text. */
const EMBEDDED_URL = /\b[a-z][a-z0-9+.-]*:\/\/[^\s<>"'`)\]]+/gi;

function walkStrings(
  value: unknown,
  path: PropertyKey[],
  visitString: (text: string, path: PropertyKey[]) => void,
): void {
  if (typeof value === 'string') {
    visitString(value, path);
  } else if (Array.isArray(value)) {
    value.forEach((item, index) => walkStrings(item, [...path, index], visitString));
  } else if (typeof value === 'object' && value !== null) {
    for (const [key, item] of Object.entries(value)) walkStrings(item, [...path, key], visitString);
  }
}

/** URLs in frontmatter: URL fields plus any `scheme://` text inside other strings. */
export function frontmatterUrls(card: ParsedCard): FoundUrl[] {
  const found: FoundUrl[] = [];
  walkStrings(card.frontmatter, [], (text, path) => {
    const line = card.lineOf(path);
    const key = path.at(-1);
    if (typeof key === 'string' && URL_KEYS.has(key)) {
      found.push({ url: text.trim(), line });
      return;
    }
    for (const match of text.matchAll(EMBEDDED_URL)) found.push({ url: match[0], line });
  });
  return found;
}

/** URLs in the body: links, images, definitions and `scheme://` text. */
export function bodyUrls(card: ParsedCard): FoundUrl[] {
  const found: FoundUrl[] = [];
  const toFileLine = (line: number | undefined) => (line ?? 1) + card.bodyStartLine - 1;
  visit(parseMarkdown(card.body), (node) => {
    if (node.type === 'link' || node.type === 'image' || node.type === 'definition') {
      found.push({ url: node.url, line: toFileLine(node.position?.start.line) });
    } else if (node.type === 'text') {
      for (const match of node.value.matchAll(EMBEDDED_URL)) {
        found.push({ url: match[0], line: toFileLine(node.position?.start.line) });
      }
    }
  });
  return found;
}

/** Every URL in a card, de-duplicated by URL and line, in file order. */
export function cardUrls(card: ParsedCard): FoundUrl[] {
  const seen = new Set<string>();
  return [...frontmatterUrls(card), ...bodyUrls(card)]
    .filter(({ url, line }) => {
      const key = `${line} ${url}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.line - b.line);
}
