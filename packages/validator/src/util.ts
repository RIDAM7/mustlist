import type { CardContext, Diagnostic, RuleId, Severity } from './types';

export function diagnostic(
  context: CardContext,
  rule: RuleId,
  line: number,
  message: string,
  severity: Severity = 'error',
): Diagnostic {
  return { file: context.card.filePath, line, rule, severity, message };
}

/** Schema issues that belong to `rule`, as diagnostics on the right lines. */
export function issuesFor(context: CardContext, rule: RuleId): Diagnostic[] {
  return context.issues
    .filter((issue) => issue.rule === rule)
    .map((issue) => diagnostic(context, rule, context.card.lineOf(issue.path), issue.message));
}

/** The raw (unvalidated) frontmatter as a record, or an empty record. */
export function rawFrontmatter(context: CardContext): Record<string, unknown> {
  const value = context.card.frontmatter;
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function rawString(context: CardContext, key: string): string | undefined {
  const value = rawFrontmatter(context)[key];
  return typeof value === 'string' ? value : undefined;
}

export function rawStringList(context: CardContext, key: string): string[] {
  const value = rawFrontmatter(context)[key];
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

/** Words in markdown text: whitespace-separated tokens that contain a letter or digit. */
export function countWords(markdown: string): number {
  return markdown.split(/\s+/).filter((token) => /[\p{L}\p{N}]/u.test(token)).length;
}

/** 1-based line number of a character offset in `text`. */
export function lineAtOffset(text: string, offset: number): number {
  let line = 1;
  for (let index = 0; index < offset && index < text.length; index++) {
    if (text.charCodeAt(index) === 10) line++;
  }
  return line;
}

/** `cards/<topic>/<stack>.md` -> `{ topic, stack }`, or `undefined` for any other path. */
export function locationFromPath(filePath: string): { topic: string; stack: string } | undefined {
  const parts = filePath.split('/');
  const fileName = parts.at(-1);
  const topic = parts.at(-2);
  if (parts.at(-3) !== 'cards' || !topic || !fileName?.endsWith('.md')) return undefined;
  return { topic, stack: fileName.slice(0, -'.md'.length) };
}

/** Run `pattern` (global) over `text` and return each match with its line. */
export function findAll(text: string, pattern: RegExp): { match: string; line: number }[] {
  const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`;
  const global = new RegExp(pattern.source, flags);
  return [...text.matchAll(global)].map((match) => ({
    match: match[0],
    line: lineAtOffset(text, match.index),
  }));
}
