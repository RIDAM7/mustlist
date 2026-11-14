import {
  ALLOWED_CODE_LANGS,
  BLOCKED_CODE_LANGS,
  SIZE_LIMITS,
  parseMarkdown,
} from '@mustlist/schema';
import { visit } from 'unist-util-visit';
import type { Diagnostic, Rule } from '../types';
import { diagnostic } from '../util';

const allowed: readonly string[] = ALLOWED_CODE_LANGS;
const blocked: readonly string[] = BLOCKED_CODE_LANGS;

/** Problems with one code block, or an empty list. */
export function codeBlockProblems(lang: string | null | undefined, value: string): string[] {
  const language = lang?.toLowerCase();
  const problems: string[] = [];
  if (!language) {
    problems.push(
      `Code blocks need a language from: ${allowed.join(', ')} (indented code blocks are not allowed)`,
    );
  } else if (blocked.includes(language)) {
    problems.push(
      `Shell code blocks ("${language}") are not allowed: card text is data, never commands`,
    );
  } else if (!allowed.includes(language)) {
    problems.push(
      `Code block language "${language}" is not allowed; use one of: ${allowed.join(', ')}`,
    );
  }
  const lines = value.split('\n').length;
  if (lines > SIZE_LIMITS.codeBlockLines) {
    problems.push(
      `Code blocks may have at most ${SIZE_LIMITS.codeBlockLines} lines (found ${lines})`,
    );
  }
  return problems;
}

/** Code blocks use allowed languages only, no shell, at most 15 lines. */
export const safetyCodeRule: Rule = {
  id: 'safety-code',
  description: 'Code blocks use allowed languages only (no shell), at most 15 lines',
  check: (context) => {
    const found: Diagnostic[] = [];
    visit(parseMarkdown(context.card.body), 'code', (node) => {
      const line = (node.position?.start.line ?? 1) + context.card.bodyStartLine - 1;
      for (const problem of codeBlockProblems(node.lang, node.value)) {
        found.push(diagnostic(context, 'safety-code', line, problem));
      }
    });
    return found;
  },
};
