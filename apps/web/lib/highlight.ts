/**
 * A tiny, dependency-free highlighter for the short code blocks cards allow
 * (ts, tsx, js, sql, json, yaml; at most 15 lines). It only marks keywords,
 * strings and comments, which is all the design asks for.
 */

export interface Token {
  text: string;
  /** '' | 'c-kw' | 'c-str' | 'c-com' */
  cls: string;
}

const TS_KEYWORDS = new Set(
  (
    'const let var export import from async function await return new try catch finally ' +
    'throw if else for of in while switch case break default class extends type interface ' +
    'null undefined true false this typeof as satisfies'
  ).split(' '),
);

const SQL_KEYWORDS = new Set(
  (
    'CREATE TABLE NOT NULL DEFAULT PRIMARY KEY UNIQUE INDEX ON INSERT INTO VALUES UPDATE SET ' +
    'WHERE SELECT FROM FOR SKIP LOCKED LIMIT ORDER BY RETURNING CONFLICT DO NOTHING AND OR IN ' +
    'REFERENCES CHECK ALTER ADD CONSTRAINT text timestamptz jsonb int bigint boolean uuid'
  ).split(' '),
);

const JSON_KEYWORDS = new Set(['true', 'false', 'null']);

function commentMark(lang: string): string {
  if (lang === 'sql') return '--';
  if (lang === 'yaml' || lang === 'yml') return '#';
  if (lang === 'json') return '';
  return '//';
}

function keywordsFor(lang: string): Set<string> {
  if (lang === 'sql') return SQL_KEYWORDS;
  if (lang === 'json' || lang === 'yaml' || lang === 'yml') return JSON_KEYWORDS;
  return TS_KEYWORDS;
}

/** Index of the first comment marker that is not inside a string, or -1. */
function commentStart(line: string, mark: string): number {
  if (!mark) return -1;
  let quote = '';
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (quote) {
      if (char === '\\') i++;
      else if (char === quote) quote = '';
    } else if (char === "'" || char === '"' || char === '`') {
      quote = char;
    } else if (line.startsWith(mark, i)) {
      return i;
    }
  }
  return -1;
}

export function highlightLine(line: string, lang: string): Token[] {
  const at = commentStart(line, commentMark(lang));
  const code = at < 0 ? line : line.slice(0, at);
  const comment = at < 0 ? '' : line.slice(at);
  const keywords = keywordsFor(lang);
  const tokens: Token[] = [];
  const re =
    /('(?:[^'\\]|\\.)*'?|"(?:[^"\\]|\\.)*"?|`(?:[^`\\]|\\.)*`?)|([A-Za-z_$][\w$]*)|([^'"`A-Za-z_$]+)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(code))) {
    if (match[1]) tokens.push({ text: match[1], cls: 'c-str' });
    else if (match[2]) tokens.push({ text: match[2], cls: keywords.has(match[2]) ? 'c-kw' : '' });
    else if (match[3]) tokens.push({ text: match[3], cls: '' });
  }
  if (comment) tokens.push({ text: comment, cls: 'c-com' });
  return tokens;
}

export function highlight(code: string, lang: string): Token[][] {
  return code
    .replace(/\n$/, '')
    .split('\n')
    .map((line) => highlightLine(line, lang));
}
