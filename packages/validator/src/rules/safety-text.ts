import { parseMarkdown } from '@mustlist/schema';
import { visit } from 'unist-util-visit';
import type { Diagnostic, Rule } from '../types';
import { diagnostic, findAll, lineAtOffset } from '../util';

interface TextPattern {
  pattern: RegExp;
  message: string;
}

/**
 * Text that tries to steer an agent beyond the card's purpose. Words are joined with
 * `\s+` so a phrase split across lines still matches.
 */
export const BLOCKED_TEXT_PATTERNS: readonly TextPattern[] = [
  {
    pattern:
      /\b(?:ignore|disregard|forget|override)\s+(?:all\s+|any\s+|the\s+)?(?:previous|prior|above|earlier|preceding|other|your)\s+(?:instructions|prompts?|rules|directions|messages)\b/i,
    message: 'Instruction-override text ("ignore previous instructions")',
  },
  { pattern: /\bsystem\s+prompt\b/i, message: 'Mentions the system prompt' },
  {
    pattern: /\byou\s+must\s+(?:now\s+)?(?:run|execute|install|download)\b/i,
    message: 'Tells the agent to run or install something',
  },
  { pattern: /\bexecute\s+the\s+following\b/i, message: 'Tells the agent to execute something' },
  {
    pattern: /\b(?:download|fetch)\s+(?:and|&|then)\s+(?:run|execute|install|open)\b/i,
    message: 'Download-and-run instruction',
  },
  {
    pattern: /\b(?:curl|wget)\b[^\n|]{0,200}\|\s*(?:sudo\s+)?(?:sh|bash|zsh|python3?|node)\b/i,
    message: 'Pipes a download into a shell',
  },
  {
    pattern:
      /\b(?:iwr|irm|invoke-webrequest|invoke-restmethod)\b[^\n|]{0,200}\|\s*(?:iex|invoke-expression)\b/i,
    message: 'Pipes a download into PowerShell',
  },
  { pattern: /\bbase64\s+(?:-d|-D|--decode)\b/i, message: 'Decodes hidden base64 content' },
  {
    pattern:
      /\b(?:send|post|upload|forward|transmit|exfiltrate)\b[^.\n]{0,80}\bto\s+(?:https?:\/\/|(?:this|that|the\s+following|my|our)\s+(?:url|endpoint|webhook|server|address|email))/i,
    message: 'Asks to send data to an address',
  },
  {
    pattern:
      /(?:^|[.!?:]\s+|\b(?:please|now|first|then|also)\s+)(?:read|cat|print|output|display|reveal|dump|upload|share|send)\s+(?:the\s+|your\s+|all\s+|any\s+)?(?:contents?\s+of\s+)?(?:\.env\b|~\/\.ssh|id_rsa|\.npmrc|\.aws\/credentials|credentials\s+files?|private\s+keys?|api\s+keys?|secrets?\b|environment\s+variables)/im,
    message: 'Asks to read or reveal secrets',
  },
];

/** Zero-width, bidirectional-control and Unicode tag characters (hidden text). */
const INVISIBLE_RANGES: readonly (readonly [number, number])[] = [
  [0x200b, 0x200f],
  [0x202a, 0x202e],
  [0x2060, 0x2064],
  [0x2066, 0x2069],
  [0xfeff, 0xfeff],
  [0xe0000, 0xe007f],
];

function isInvisible(codePoint: number): boolean {
  return INVISIBLE_RANGES.some(([from, to]) => codePoint >= from && codePoint <= to);
}

/** Lines that contain invisible or bidirectional-control characters. */
export function invisibleCharacterLines(text: string): number[] {
  const lines = new Set<number>();
  let offset = 0;
  for (const character of text) {
    const codePoint = character.codePointAt(0) ?? 0;
    if (isInvisible(codePoint)) lines.add(lineAtOffset(text, offset));
    offset += character.length;
  }
  return [...lines];
}

/** No injection or command patterns, hidden characters, or raw HTML. */
export const safetyTextRule: Rule = {
  id: 'safety-text',
  description: 'No instruction-like text, hidden characters or raw HTML',
  check: (context) => {
    const { text, body, bodyStartLine } = context.card;
    const found: Diagnostic[] = [];

    for (const { pattern, message } of BLOCKED_TEXT_PATTERNS) {
      for (const hit of findAll(text, pattern)) {
        found.push(
          diagnostic(context, 'safety-text', hit.line, `${message}: "${hit.match.trim()}"`),
        );
      }
    }
    for (const line of invisibleCharacterLines(text)) {
      found.push(
        diagnostic(
          context,
          'safety-text',
          line,
          'Invisible or bidirectional Unicode characters are not allowed (they can hide text)',
        ),
      );
    }
    visit(parseMarkdown(body), 'html', (node) => {
      const line = (node.position?.start.line ?? 1) + bodyStartLine - 1;
      found.push(
        diagnostic(
          context,
          'safety-text',
          line,
          'Raw HTML and HTML comments are not allowed: they can hide text from readers',
        ),
      );
    });
    return found.sort((a, b) => a.line - b.line);
  },
};
