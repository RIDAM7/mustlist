import type { Diagnostic, Rule } from '../types';
import { diagnostic, findAll } from '../util';

interface SecretPattern {
  name: string;
  pattern: RegExp;
}

/** Known credential formats. Example-looking values are blocked too. */
export const SECRET_PATTERNS: readonly SecretPattern[] = [
  { name: 'AWS access key', pattern: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/ },
  {
    name: 'GitHub token',
    pattern: /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{22,})\b/,
  },
  { name: 'Stripe key', pattern: /\b(?:sk|rk|pk)_(?:live|test)_[A-Za-z0-9]{16,}\b/ },
  { name: 'Stripe webhook secret', pattern: /\bwhsec_[A-Za-z0-9]{16,}\b/ },
  { name: 'Razorpay key', pattern: /\brzp_(?:live|test)_[A-Za-z0-9]{10,}\b/ },
  { name: 'Slack token', pattern: /\bxox[abposr]-[A-Za-z0-9-]{10,}\b/ },
  { name: 'Google API key', pattern: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { name: 'API secret key', pattern: /\bsk-(?:ant-|proj-)?[A-Za-z0-9_-]{20,}\b/ },
  { name: 'private key', pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  {
    name: 'JSON Web Token',
    pattern: /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/,
  },
  {
    name: 'connection string with a password',
    pattern: /\b[a-z][a-z0-9+.-]*:\/\/[^\s:/@]+:[^\s@/]+@/i,
  },
  {
    name: 'hard-coded credential',
    pattern:
      /\b(?:api[_-]?key|secret|token|password|passwd|client[_-]?secret|access[_-]?key)\b\s*[:=]\s*["']?[A-Za-z0-9+/_-]{12,}/i,
  },
];

/** Shannon entropy in bits per character. */
export function shannonEntropy(value: string): number {
  const counts = new Map<string, number>();
  for (const character of value) counts.set(character, (counts.get(character) ?? 0) + 1);
  return [...counts.values()].reduce((sum, count) => {
    const p = count / value.length;
    return sum - p * Math.log2(p);
  }, 0);
}

const URL_IN_TEXT = /\b[a-z][a-z0-9+.-]*:\/\/\S+/gi;
const TOKEN_CANDIDATE = /[A-Za-z0-9+/_=-]{32,}/g;

/** Long random-looking strings (letters and digits, high entropy) outside URLs. */
export function highEntropyTokens(line: string): string[] {
  const withoutUrls = line.replace(URL_IN_TEXT, ' ');
  return [...withoutUrls.matchAll(TOKEN_CANDIDATE)]
    .map((match) => match[0])
    .filter((token) => /[A-Za-z]/.test(token) && /\d/.test(token) && shannonEntropy(token) > 4.2);
}

/** No credential-looking strings. */
export const secretsRule: Rule = {
  id: 'secrets',
  description: 'No credential-looking strings',
  check: (context) => {
    const { text } = context.card;
    const found: Diagnostic[] = [];
    for (const { name, pattern } of SECRET_PATTERNS) {
      for (const hit of findAll(text, pattern)) {
        found.push(
          diagnostic(
            context,
            'secrets',
            hit.line,
            `Looks like a ${name}: remove it, even if it is an example`,
          ),
        );
      }
    }
    text.split('\n').forEach((line, index) => {
      if (highEntropyTokens(line).length > 0) {
        found.push(
          diagnostic(
            context,
            'secrets',
            index + 1,
            'Long random-looking string: secrets must never be in cards',
          ),
        );
      }
    });
    return found.sort((a, b) => a.line - b.line);
  },
};
