import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { type CardJSON, normaliseSiteUrl } from '@mustlist/schema';
import {
  type CardInput,
  type Diagnostic,
  createCardContext,
  findMarkdownFiles,
  hasErrors,
  readCards,
  validateCards,
} from '@mustlist/validator';
import { toCardJson } from './card-json';
import {
  indexEntries,
  llmsTxt,
  searchIndexJson,
  stackEntries,
  toJson,
  topicEntries,
} from './outputs';

export { toCardJson } from './card-json';
export * from './outputs';
export * from './search';

export interface BuildResult {
  /** Output files: forward-slash path relative to the output directory -> contents. */
  files: Map<string, string>;
  cards: CardJSON[];
  diagnostics: Diagnostic[];
}

export class BuildError extends Error {
  constructor(public readonly diagnostics: Diagnostic[]) {
    super(
      `Cards have ${diagnostics.filter((d) => d.severity === 'error').length} validation error(s)`,
    );
    this.name = 'BuildError';
  }
}

/**
 * Turn card files into the dist artifacts, in memory. Pure and deterministic:
 * the same inputs (in any order) give the same files.
 * Throws `BuildError` when any card has a validation error.
 */
export function buildArtifacts(inputs: readonly CardInput[], siteUrl?: string): BuildResult {
  const diagnostics = validateCards(inputs);
  if (hasErrors(diagnostics)) throw new BuildError(diagnostics);

  const site = normaliseSiteUrl(siteUrl);
  const built = inputs
    .map(createCardContext)
    .flatMap(({ card, data }) => (data ? [{ card, json: toCardJson(card, data, site) }] : []))
    .sort((a, b) => (a.json.id < b.json.id ? -1 : 1));
  const cards = built.map((item) => item.json);

  const files = new Map<string, string>([
    ['index.json', toJson(indexEntries(cards))],
    ['topics.json', toJson(topicEntries(cards))],
    ['stacks.json', toJson(stackEntries(cards))],
    ['search-index.json', searchIndexJson(cards)],
    ['llms.txt', llmsTxt(cards)],
  ]);
  for (const { card, json } of built) {
    files.set(`cards/${json.id}.json`, toJson(json));
    files.set(`cards/${json.id}.md`, card.text);
  }
  return { files: new Map([...files].sort(([a], [b]) => (a < b ? -1 : 1))), cards, diagnostics };
}

/** Replace `outDir` with exactly these files. */
export function writeArtifacts(outDir: string, files: ReadonlyMap<string, string>): void {
  rmSync(outDir, { recursive: true, force: true });
  for (const [relative, contents] of files) {
    const target = path.join(outDir, ...relative.split('/'));
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, contents);
  }
}

export interface BuildDistOptions {
  cwd: string;
  cardsDir?: string;
  outDir?: string;
  siteUrl?: string;
}

/** Read `cards/`, validate, and write `dist/`. */
export function buildDist(options: BuildDistOptions): BuildResult {
  const { cwd, cardsDir = 'cards', outDir = 'dist', siteUrl } = options;
  const inputs = readCards(cwd, findMarkdownFiles(cwd, cardsDir));
  const result = buildArtifacts(inputs, siteUrl);
  writeArtifacts(path.resolve(cwd, outDir), result.files);
  return result;
}
