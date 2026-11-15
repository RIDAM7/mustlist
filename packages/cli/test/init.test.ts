import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { cacheDir } from '../src/data';
import {
  addAgentsImport,
  BEGIN,
  cardsForTechs,
  claudeMdReadsAgents,
  detectAgents,
  detectTechs,
  END,
  renderBlock,
  upsertBlock,
} from '../src/init';
import { testLibrary } from '../../mcp/test/helpers';

const library = testLibrary();

function project(files: Record<string, string>): string {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'mustlist-init-'));
  for (const [name, text] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
    writeFileSync(path.join(dir, name), text);
  }
  return dir;
}

describe('detectTechs', () => {
  it('maps dependencies to stack slugs', () => {
    const dir = project({
      'package.json': JSON.stringify({
        dependencies: { next: '16.1.0', pg: '^8', react: '19' },
        devDependencies: { typescript: '6' },
      }),
    });
    expect(detectTechs(dir)).toEqual(['nextjs', 'nodejs', 'postgres', 'react', 'typescript']);
  });

  it('reads the Prisma provider, ignoring the generator block', () => {
    const dir = project({
      'package.json': JSON.stringify({ dependencies: { next: '16', '@prisma/client': '7' } }),
      'prisma/schema.prisma':
        'generator client {\n  provider = "prisma-client"\n}\ndatasource db {\n  provider = "postgresql"\n}\n',
    });
    expect(detectTechs(dir)).toEqual(['nextjs', 'nodejs', 'postgres', 'prisma']);
  });

  it('returns nothing without package.json', () => {
    expect(detectTechs(project({}))).toEqual([]);
  });
});

describe('the AGENTS.md block', () => {
  const cards = cardsForTechs(library, ['nextjs', 'postgres']);

  it('lists only verified cards that fit the stack', () => {
    const ids = cards.map((c) => c.id);
    expect(ids).toContain('auth/nextjs-postgres');
    expect(ids).not.toContain('file-uploads/nextjs-s3');
    expect(ids).not.toContain('auth/django-postgres');
    expect(ids).not.toContain('search/nextjs-postgres');
  });

  it('is marked, links raw markdown and stays under 8 KB', () => {
    const block = renderBlock(cards);
    expect(block.startsWith(BEGIN)).toBe(true);
    expect(block.endsWith(END)).toBe(true);
    expect(block).toContain('https://ridamagrawal.com/library/auth/nextjs-postgres.md');
    expect(Buffer.byteLength(block)).toBeLessThanOrEqual(8 * 1024);
    const many = renderBlock(Array.from({ length: 200 }, () => cards).flat());
    expect(Buffer.byteLength(many)).toBeLessThanOrEqual(8 * 1024);
  });

  it('is idempotent and leaves text outside the markers alone (acceptance)', () => {
    const block = renderBlock(cards);
    const mine = '# My agents file\n\nUse pnpm.\n';
    const once = upsertBlock(mine, block);
    expect(once.startsWith(mine.trimEnd())).toBe(true);
    expect(upsertBlock(once, block)).toBe(once);

    const withTail = `${once}\n## Later section\nKeep me.\n`;
    const replaced = upsertBlock(withTail, renderBlock(cards.slice(0, 1)));
    expect(replaced).toContain('Use pnpm.');
    expect(replaced).toContain('## Later section\nKeep me.\n');
    expect(replaced.match(/BEGIN:mustlist/g)).toHaveLength(1);
  });

  it('creates the file content and keeps CRLF line endings', () => {
    const block = renderBlock(cards);
    expect(upsertBlock(undefined, block)).toBe(`${block}\n`);
    const crlf = upsertBlock('# Agents\r\n\r\nNotes.\r\n', block);
    expect(crlf).not.toMatch(/[^\r]\n/);
    expect(upsertBlock(crlf, block)).toBe(crlf);
  });

  it('refuses a begin marker without an end marker', () => {
    expect(() => upsertBlock(`${BEGIN}\nhalf a block\n`, renderBlock(cards))).toThrow(
      /no "<!-- END/,
    );
  });
});

describe('CLAUDE.md and agents', () => {
  it('detects an existing AGENTS.md import', () => {
    expect(claudeMdReadsAgents('# Notes\n@AGENTS.md\n')).toBe(true);
    expect(claudeMdReadsAgents('See AGENTS.md for rules.\n')).toBe(false);
    expect(addAgentsImport('# Notes\r\n')).toBe('# Notes\r\n\r\n@AGENTS.md\r\n');
  });

  it('detects agents from their config files', () => {
    const dir = project({ 'CLAUDE.md': '# x', '.cursor/mcp.json': '{}' });
    expect(detectAgents(dir)).toEqual(['claude', 'cursor']);
  });
});

describe('cacheDir', () => {
  it("uses each platform's cache folder", () => {
    expect(
      cacheDir('win32', { LOCALAPPDATA: 'C:\\Users\\a\\AppData\\Local' }, 'C:\\Users\\a'),
    ).toBe(path.join('C:\\Users\\a\\AppData\\Local', 'mustlist', 'Cache'));
    expect(cacheDir('darwin', {}, '/Users/a')).toBe(
      path.join('/Users/a', 'Library', 'Caches', 'mustlist'),
    );
    expect(cacheDir('linux', { XDG_CACHE_HOME: '/x' }, '/home/a')).toBe(
      path.join('/x', 'mustlist'),
    );
    expect(cacheDir('linux', {}, '/home/a')).toBe(path.join('/home/a', '.cache', 'mustlist'));
  });
});
