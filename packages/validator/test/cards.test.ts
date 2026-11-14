import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { findMarkdownFiles, readCards } from '../src/files';
import { validateCards } from '../src/validate';

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));

describe('cards/', () => {
  it('has no validation errors', () => {
    const inputs = readCards(repoRoot, findMarkdownFiles(repoRoot, 'cards'));
    expect(inputs.length).toBeGreaterThan(0);
    const errors = validateCards(inputs).filter((item) => item.severity === 'error');
    expect(errors).toEqual([]);
  });
});
