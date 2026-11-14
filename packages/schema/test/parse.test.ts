import { describe, expect, it } from 'vitest';
import { parseCard } from '../src/parse';
import { readFixture } from './helpers';

describe('parseCard', () => {
  const draft = readFixture('good/draft.md');

  it('splits frontmatter, body and H2/H3 sections', () => {
    const card = parseCard(draft, 'cards/example/nextjs-postgres.md');
    expect(card.parseErrors).toEqual([]);
    expect(card.frontmatter).toMatchObject({ id: 'example/nextjs-postgres', status: 'draft' });
    expect(card.sections.map((section) => section.title)).toEqual([
      'Why this approach',
      'Lenses',
      'Common mistakes',
      'Notes for reviewers',
    ]);
    const lenses = card.sections[1];
    expect(lenses?.children.map((child) => child.title)).toEqual([
      'Security',
      'Performance & latency',
    ]);
    expect(lenses?.children[0]?.markdown).toContain('Validate input on the server');
  });

  it('reports file line numbers for sections and frontmatter paths', () => {
    const card = parseCard(draft, 'cards/example/nextjs-postgres.md');
    const lines = draft.split('\n');
    const whyLine = lines.indexOf('## Why this approach') + 1;
    expect(card.sections[0]?.line).toBe(whyLine);
    expect(card.lineOf(['id'])).toBe(2);
    expect(card.lineOf(['checklist', 1, 'text'])).toBe(
      lines.findIndex((l) => l.includes('Add an index')) + 1,
    );
    // Missing paths fall back to the nearest existing parent.
    expect(card.lineOf(['checklist', 1, 'why'])).toBe(
      lines.findIndex((l) => l.includes('id: index-lookups')) + 1,
    );
  });

  it('normalises CRLF line endings and a BOM', () => {
    const crlf = `\uFEFF${draft.replace(/\n/g, '\r\n')}`;
    const card = parseCard(crlf, 'cards\\example\\nextjs-postgres.md');
    expect(card.filePath).toBe('cards/example/nextjs-postgres.md');
    expect(card.parseErrors).toEqual([]);
    expect(card.text).not.toContain('\r');
    expect(card.sections).toHaveLength(4);
  });

  it('reports missing frontmatter', () => {
    const card = parseCard('## Why this approach\n\nText.\n', 'cards/a/b.md');
    expect(card.frontmatter).toBeUndefined();
    expect(card.parseErrors[0]).toMatchObject({ line: 1 });
  });

  it('reports YAML syntax errors with the file line', () => {
    const card = parseCard('---\nid: a/b\ntitle: [unclosed\n---\n', 'cards/a/b.md');
    expect(card.frontmatter).toBeUndefined();
    expect(card.parseErrors.length).toBeGreaterThan(0);
    expect(card.parseErrors[0]?.line).toBeGreaterThanOrEqual(3);
  });

  it('reports duplicate YAML keys', () => {
    const card = parseCard('---\nid: a/b\nid: c/d\n---\n', 'cards/a/b.md');
    expect(card.parseErrors[0]?.line).toBe(3);
  });

  it('records H1 headings and text before the first H2', () => {
    const card = parseCard(
      '---\nid: a/b\n---\n# Title\n\nIntro text.\n\n## Lenses\n',
      'cards/a/b.md',
    );
    expect(card.outline.h1).toEqual([{ title: 'Title', depth: 1, line: 4 }]);
    expect(card.outline.preamble).toContain('Intro text.');
    expect(card.outline.preambleLine).toBe(4);
  });
});
