import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { toPosixPath } from '@mustlist/schema';
import type { CardInput } from './types';

/** Repo-relative, forward-slash path. */
export function relativePath(cwd: string, filePath: string): string {
  return toPosixPath(path.relative(cwd, path.resolve(cwd, filePath)));
}

/** All `.md` files under `dir`, sorted. Missing directories give an empty list. */
export function findMarkdownFiles(cwd: string, dir: string): string[] {
  const absolute = path.resolve(cwd, dir);
  if (!existsSync(absolute)) return [];
  if (statSync(absolute).isFile())
    return absolute.endsWith('.md') ? [relativePath(cwd, absolute)] : [];
  return readdirSync(absolute, { recursive: true, encoding: 'utf8' })
    .filter((name) => name.endsWith('.md'))
    .map((name) => relativePath(cwd, path.join(absolute, name)))
    .sort();
}

export function readCards(cwd: string, files: readonly string[]): CardInput[] {
  return files.map((filePath) => ({
    filePath,
    text: readFileSync(path.resolve(cwd, filePath), 'utf8'),
  }));
}

function git(cwd: string, args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

const lines = (output: string) =>
  output
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

/** The base to compare against: `--base`, `MUSTLIST_BASE_REF`, the PR base branch, or origin/main. */
export function resolveBaseRef(flag: string | undefined, env: NodeJS.ProcessEnv): string {
  if (flag) return flag;
  if (env['MUSTLIST_BASE_REF']) return env['MUSTLIST_BASE_REF'];
  if (env['GITHUB_BASE_REF']) return `origin/${env['GITHUB_BASE_REF']}`;
  return 'origin/main';
}

/**
 * Card files changed compared with `baseRef` (committed changes since the merge base).
 * If the base does not exist (for example, no remote yet), falls back to uncommitted
 * and untracked changes.
 */
export function changedCardFiles(
  cwd: string,
  cardsDir: string,
  baseRef: string,
): { files: string[]; comparedWith: string } {
  const isCard = (file: string) => file.endsWith('.md') && existsSync(path.resolve(cwd, file));
  try {
    git(cwd, ['rev-parse', '--verify', '--quiet', `${baseRef}^{commit}`]);
    const diff = git(cwd, [
      'diff',
      '--name-only',
      '--diff-filter=ACMR',
      `${baseRef}...HEAD`,
      '--',
      cardsDir,
    ]);
    return { files: lines(diff).filter(isCard).sort(), comparedWith: baseRef };
  } catch {
    const changed = lines(
      git(cwd, ['diff', '--name-only', '--diff-filter=ACMR', 'HEAD', '--', cardsDir]),
    );
    const untracked = lines(
      git(cwd, ['ls-files', '--others', '--exclude-standard', '--', cardsDir]),
    );
    const files = [...new Set([...changed, ...untracked])].filter(isCard).sort();
    return { files, comparedWith: 'uncommitted changes' };
  }
}
