import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { CardInput } from '../src/types';

export const fixturesDir = fileURLToPath(new URL('../../../fixtures/', import.meta.url));

/**
 * Load a fixture as if it lived in `cards/`. The virtual path comes from a
 * `# fixture-path: ...` comment, or else from the fixture's `id`.
 */
export function fixtureInput(relative: string): CardInput {
  const text = readFileSync(`${fixturesDir}${relative}`, 'utf8');
  const declared = /^# fixture-path: (.+)$/m.exec(text)?.[1]?.trim();
  const id = /^id: (.+)$/m.exec(text)?.[1]?.trim();
  return { filePath: declared ?? `cards/${id ?? 'fixture/unknown'}.md`, text };
}

export const goodInputs = (): CardInput[] =>
  ['good/draft.md', 'good/verified.md'].map(fixtureInput);

export const badFixtureRules = (): string[] =>
  readdirSync(`${fixturesDir}bad`)
    .filter((name) => name.endsWith('.md'))
    .map((name) => name.slice(0, -'.md'.length))
    .sort();

/** Build a minimal card file from frontmatter lines and a body. */
export function card(frontmatter: string, body: string): string {
  return `---\n${frontmatter}\n---\n${body}`;
}
