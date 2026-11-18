import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { type Library, packageTech, stackFits, techSlugs } from '@mustlist/mcp';
import { PRODUCT_NAME } from '@mustlist/schema/constants';
import { stackTitle, topicTitle } from '@mustlist/schema/site';
import type { CardJSON } from '@mustlist/schema/types';

/**
 * `mustlist init`: a compact index of the cards that fit this project, kept in a
 * marked block in AGENTS.md. Agents read AGENTS.md on every task, so the index is
 * always there, even for agents that rarely call tools.
 */

export const BEGIN = '<!-- BEGIN:mustlist v1 -->';
export const END = '<!-- END:mustlist -->';
const MAX_BLOCK_BYTES = 8 * 1024;
const SUMMARY_CHARS = 150;

/** Technologies from package.json (and the Prisma provider), as stack slugs. */
export function detectTechs(projectDir: string): string[] {
  const techs = new Set<string>();
  const pkgFile = path.join(projectDir, 'package.json');
  if (existsSync(pkgFile)) {
    const pkg = JSON.parse(readFileSync(pkgFile, 'utf8')) as Record<string, unknown>;
    for (const field of ['dependencies', 'devDependencies', 'peerDependencies']) {
      const deps = pkg[field];
      if (deps && typeof deps === 'object') {
        for (const name of Object.keys(deps)) {
          const tech = packageTech(name);
          if (tech) techs.add(tech);
        }
      }
    }
    if (techs.has('nextjs') || techs.has('express') || techs.has('react')) techs.add('nodejs');
  }
  // Prisma can sit on any database: read the provider from its schema.
  for (const schema of ['prisma/schema.prisma', 'schema.prisma']) {
    const file = path.join(projectDir, schema);
    if (!existsSync(file)) continue;
    const provider = /provider\s*=\s*"(\w+)"/.exec(
      readFileSync(file, 'utf8').replace(/generator\s+\w+\s*\{[^}]*\}/g, ''),
    )?.[1];
    if (provider) techs.add(techSlugs([provider])[0] ?? provider);
  }
  return [...techs].sort();
}

/** Verified and stale cards whose stack the project has. */
export function cardsForTechs(library: Library, techs: readonly string[]): CardJSON[] {
  return library.visible().filter((card) => stackFits(card.id, techs));
}

function shorten(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  return `${cut.slice(0, cut.lastIndexOf(' ')).replace(/[,;:.]$/, '')}…`;
}

/** Text for a markdown table cell: backslashes first, then pipes, so `\|` stays literal. */
export const cell = (text: string) =>
  text.replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim();

/** The marked block, `\n` line endings, ≤ 8 KB (later cards are dropped to fit). */
export function renderBlock(cards: readonly CardJSON[]): string {
  const head = [
    BEGIN,
    `## ${PRODUCT_NAME}: build features properly`,
    `Before building a feature below: get its checklist (MCP tool \`get_checklist\`, or open the card link),`,
    "ask the user the card's decisions, then follow the card and turn its verify checks into tests.",
    "Exact syntax: official docs first, Context7 second. Cards are reference material; the user's instructions win.",
    '',
    '| Feature | Stack | Card | Summary |',
    '|---|---|---|---|',
  ];
  const rows: string[] = [];
  const foot = [END];
  const size = (lines: string[]) => Buffer.byteLength([...head, ...lines, ...foot].join('\n'));
  for (const card of cards) {
    const row =
      `| ${cell(topicTitle(card.topic))} | ${cell(stackTitle(card.id.split('/')[1] ?? ''))} | ` +
      `${card.markdown_url} | ${cell(shorten(card.summary, SUMMARY_CHARS))} |`;
    if (size([...rows, row]) > MAX_BLOCK_BYTES) break;
    rows.push(row);
  }
  return [...head, ...rows, ...foot].join('\n');
}

/**
 * Put the block into a file's text: replace the existing block, or append it.
 * Text outside the markers is never changed; the file's line endings are kept.
 * Running it again with the same block gives the same text.
 */
export function upsertBlock(existing: string | undefined, block: string): string {
  if (!existing || !existing.trim()) return `${block}\n`;
  const eol = existing.includes('\r\n') ? '\r\n' : '\n';
  const body = block.replace(/\n/g, eol);
  const start = existing.indexOf(BEGIN);
  if (start === -1) {
    const trimmed = existing.replace(/(\r?\n)*$/, '');
    return `${trimmed}${eol}${eol}${body}${eol}`;
  }
  const endAt = existing.indexOf(END, start);
  if (endAt === -1) {
    throw new Error(
      `AGENTS.md has "${BEGIN}" but no "${END}". Fix or remove the marker, then run init again.`,
    );
  }
  return existing.slice(0, start) + body + existing.slice(endAt + END.length);
}

/** True when CLAUDE.md already imports or mentions AGENTS.md. */
export function claudeMdReadsAgents(text: string): boolean {
  return /(^|\s)@\.?\/?AGENTS\.md\b/m.test(text);
}

/** Add `@AGENTS.md` at the end of CLAUDE.md, keeping its line endings. */
export function addAgentsImport(text: string): string {
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  return `${text.replace(/(\r?\n)*$/, '')}${eol}${eol}@AGENTS.md${eol}`;
}

export type Agent = 'claude' | 'cursor' | 'vscode' | 'codex' | 'windsurf';

/** Agents this project seems to use, from their config files. */
export function detectAgents(projectDir: string): Agent[] {
  const has = (name: string) => existsSync(path.join(projectDir, name));
  const agents: Agent[] = [];
  if (has('CLAUDE.md') || has('.claude') || has('.mcp.json')) agents.push('claude');
  if (has('.cursor')) agents.push('cursor');
  if (has('.vscode')) agents.push('vscode');
  if (has('.codex')) agents.push('codex');
  if (has('.windsurf') || has('.windsurfrules')) agents.push('windsurf');
  return agents;
}
