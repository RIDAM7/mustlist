import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { findMarkdownFiles } from '@mustlist/validator';
import { newCardProblems, pickGithubHandle, renderCardTemplate } from './lib/new-card';

const USAGE =
  'Usage: pnpm new-card <topic> <stack> [--draft]\nExample: pnpm new-card rate-limiting nextjs-postgres';

function gitConfig(key: string): string | undefined {
  try {
    return execFileSync('git', ['config', key], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    return undefined;
  }
}

function main(): number {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: { draft: { type: 'boolean', default: false }, help: { type: 'boolean', short: 'h' } },
  });
  const [topic, stack] = positionals;
  if (values.help || !topic || !stack || positionals.length > 2) {
    console.log(USAGE);
    return values.help ? 0 : 1;
  }

  const cwd = process.cwd();
  const existingIds = findMarkdownFiles(cwd, 'cards').map((file) =>
    file.replace(/^cards\//, '').replace(/\.md$/, ''),
  );
  const handle = pickGithubHandle([gitConfig('github.user'), gitConfig('user.name')]);
  const request = { topic, stack, authors: [handle ?? 'your-github-handle'], draft: values.draft };

  const problems = newCardProblems(request, existingIds);
  const target = path.join(cwd, 'cards', topic, `${stack}.md`);
  if (existsSync(target)) problems.push(`File already exists: cards/${topic}/${stack}.md`);
  if (problems.length > 0) {
    for (const problem of problems) console.error(problem);
    return 1;
  }

  const template = readFileSync(path.join(cwd, 'templates', 'card.md'), 'utf8');
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, renderCardTemplate(template, request));

  console.log(
    `Created cards/${topic}/${stack}.md (status: ${values.draft ? 'draft' : 'proposed'}).`,
  );
  if (!handle) {
    console.log('Set your GitHub handle so new cards credit you: git config github.user <handle>');
  }
  console.log(`Next: fill it in, then run pnpm validate cards/${topic}/${stack}.md`);
  return 0;
}

process.exitCode = main();
