import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { CardInput } from '@mustlist/validator';
import { BuildError, buildArtifacts, loadSearchIndex } from '../src/index';

const fixtures = fileURLToPath(new URL('../../../fixtures/', import.meta.url));
const SITE = 'https://example.test';

function fixture(relative: string, filePath: string): CardInput {
  return { filePath, text: readFileSync(`${fixtures}${relative}`, 'utf8') };
}

const inputs = (): CardInput[] => [
  fixture('good/draft.md', 'cards/example/nextjs-postgres.md'),
  fixture('good/verified.md', 'cards/example/express-postgres.md'),
];

describe('buildArtifacts', () => {
  it('writes every dist artifact', () => {
    const { files } = buildArtifacts(inputs(), SITE);
    expect([...files.keys()]).toEqual([
      'cards/example/express-postgres.json',
      'cards/example/express-postgres.md',
      'cards/example/nextjs-postgres.json',
      'cards/example/nextjs-postgres.md',
      'index.json',
      'llms.txt',
      'search-index.json',
      'stacks.json',
      'topics.json',
    ]);
  });

  it('matches the snapshots', async () => {
    const { files } = buildArtifacts(inputs(), SITE);
    for (const [name, contents] of files) {
      await expect(contents).toMatchFileSnapshot(`__snapshots__/dist/${name}`);
    }
  });

  it('is deterministic regardless of input order', () => {
    const first = buildArtifacts(inputs(), SITE).files;
    const second = buildArtifacts([...inputs()].reverse(), SITE).files;
    expect([...second]).toEqual([...first]);
  });

  it('lists only verified cards in llms.txt', () => {
    const llms = buildArtifacts(inputs(), SITE).files.get('llms.txt') ?? '';
    expect(llms).toContain('https://example.test/library/example/express-postgres.md');
    expect(llms).not.toContain('nextjs-postgres');
  });

  it('builds a search index the website can load', () => {
    const json = buildArtifacts(inputs(), SITE).files.get('search-index.json') ?? '';
    const results = loadSearchIndex(json).search('index lookups');
    expect(results[0]?.id).toBe('example/nextjs-postgres');
  });

  it('refuses to build cards with validation errors', () => {
    const broken = fixture('bad/refs.md', 'cards/refs/nextjs-postgres.md');
    expect(() => buildArtifacts([...inputs(), broken], SITE)).toThrow(BuildError);
  });
});
