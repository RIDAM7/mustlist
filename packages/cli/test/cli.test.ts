import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { buildArtifacts, writeArtifacts } from '@mustlist/build';
import { findMarkdownFiles, readCards } from '@mustlist/validator';
import { beforeAll, describe, expect, it } from 'vitest';

/**
 * The CLI from source, as a user runs it: a child process with tsx. Cards come
 * from a dist/ built into a temp folder, because CI runs tests before the build.
 */
const ROOT = path.resolve(import.meta.dirname, '..', '..', '..');
const BIN = path.join(ROOT, 'packages', 'cli', 'src', 'bin.ts');
// Absolute, so the CLI can run from any project folder.
const TSX = import.meta.resolve('tsx');
let env: Record<string, string>;

beforeAll(() => {
  const dist = mkdtempSync(path.join(os.tmpdir(), 'mustlist-dist-'));
  writeArtifacts(dist, buildArtifacts(readCards(ROOT, findMarkdownFiles(ROOT, 'cards'))).files);
  env = { ...(process.env as Record<string, string>), MUSTLIST_DIST_DIR: dist };
});

function run(args: string[], cwd = ROOT): { stdout: string; code: number } {
  try {
    const stdout = execFileSync(process.execPath, ['--import', TSX, BIN, ...args], {
      cwd,
      env: { ...env, NODE_OPTIONS: '' },
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { stdout, code: 0 };
  } catch (error) {
    const failed = error as { stdout?: string; status?: number };
    return { stdout: failed.stdout ?? '', code: failed.status ?? 1 };
  }
}

describe('mustlist CLI', () => {
  it('prints help and the version', () => {
    expect(run(['--help']).stdout).toContain('mustlist mcp');
    expect(run(['--version']).stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/);
    expect(run(['nope']).code).toBe(2);
  });

  it('searches', () => {
    const { stdout, code } = run(['search', 'login', '--json']);
    expect(code).toBe(0);
    expect(JSON.parse(stdout)[0].id).toBe('auth/nextjs-postgres');
  });

  it('writes AGENTS.md from package.json, and a second run changes nothing', () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'mustlist-project-'));
    writeFileSync(
      path.join(dir, 'package.json'),
      JSON.stringify({ dependencies: { next: '16.1.0', pg: '8.13.0' } }),
    );
    writeFileSync(path.join(dir, 'AGENTS.md'), '# Rules\n\nUse pnpm.\n');
    expect(run(['init', '--no-claude-md'], dir).code).toBe(0);
    const first = readFileSync(path.join(dir, 'AGENTS.md'), 'utf8');
    expect(first).toContain('Use pnpm.');
    expect(first).toContain('auth/nextjs-postgres.md');
    expect(first).not.toContain('file-uploads/nextjs-s3.md');
    expect(run(['init', '--no-claude-md'], dir).code).toBe(0);
    expect(readFileSync(path.join(dir, 'AGENTS.md'), 'utf8')).toBe(first);
  }, 30_000);

  it('serves MCP over stdio', async () => {
    const client = new Client({ name: 'mustlist-test', version: '1.0.0' });
    await client.connect(
      new StdioClientTransport({
        command: process.execPath,
        args: ['--import', TSX, BIN, 'mcp'],
        cwd: ROOT,
        env,
        stderr: 'ignore',
      }),
    );
    try {
      const { tools } = await client.listTools();
      expect(tools).toHaveLength(4);
      const result = await client.callTool({
        name: 'get_checklist',
        arguments: { feature: 'login', stack: ['nextjs', 'postgres'] },
      });
      expect(result.structuredContent).toMatchObject({ card: { id: 'auth/nextjs-postgres' } });
    } finally {
      await client.close();
    }
  }, 30_000);
});
