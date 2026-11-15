import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createInterface } from 'node:readline/promises';
import { parseArgs } from 'node:util';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { createMustlistServer, type Library, searchCards, techSlugs } from '@mustlist/mcp';
import { clientSetups } from '@mustlist/mcp/clients';
import pkg from '../package.json' with { type: 'json' };
import { loadOnline, loadSnapshot, SITE, toLibrary } from './data';
import {
  addAgentsImport,
  cardsForTechs,
  claudeMdReadsAgents,
  detectAgents,
  detectTechs,
  renderBlock,
  upsertBlock,
} from './init';

const VERSION: string = pkg.version;
const MCP_URL = `${SITE}/library/mcp`;

const HELP = `mustlist ${VERSION}: reviewed "build it properly" cards for AI coding agents

Usage:
  mustlist mcp [--online]            Run the MCP server over stdio (for your agent's config)
  mustlist init [options]            Add a card index for this project to AGENTS.md
  mustlist search <query> [options]  Find cards from the terminal

init options:
  --stack <slugs>    Use these technologies instead of package.json (e.g. nextjs,postgres)
  --dry-run          Show the block; change no files
  --yes              Add @AGENTS.md to CLAUDE.md without asking
  --no-claude-md     Never touch CLAUDE.md

search options:
  --stack <slugs>    Prefer cards for these technologies
  --topic <slug>     Only this topic
  --limit <n>        Results (1-10, default 5)
  --all              Include cards that are not reviewed yet
  --json             Print JSON

Common:
  --online           Use the live cards (cached 24 h) instead of the bundled snapshot
  -h, --help         Show this help
  -v, --version      Show the version

Remote MCP (no install): ${MCP_URL}
Cards: ${SITE}/library`;

/** stdout is the MCP channel in `mcp` mode, so all messages go to stderr. */
const log = (message: string) => process.stderr.write(`${message}\n`);

async function getLibrary(online: boolean): Promise<Library> {
  return toLibrary(online ? await loadOnline(log) : loadSnapshot());
}

async function runMcp(online: boolean): Promise<void> {
  const library = await getLibrary(online);
  serveStdio(() => createMustlistServer(library, VERSION));
}

async function runSearch(
  query: string,
  options: {
    stack?: string;
    topic?: string;
    limit?: string;
    all?: boolean;
    json?: boolean;
    online?: boolean;
  },
): Promise<number> {
  const library = await getLibrary(Boolean(options.online));
  const limit = options.limit ? Number(options.limit) : 5;
  if (!Number.isInteger(limit) || limit < 1 || limit > 10) {
    log('--limit must be a whole number from 1 to 10.');
    return 2;
  }
  const { results } = searchCards(library, {
    query,
    stack: options.stack?.split(','),
    topic: options.topic,
    limit,
    include_unverified: options.all,
  });
  if (options.json) {
    process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
    return 0;
  }
  if (!results.length) {
    log(`No cards match "${query}". Browse ${SITE}/library or request one there.`);
    return 1;
  }
  for (const r of results) {
    const status = r.status === 'verified' ? '' : ` [${r.status}]`;
    process.stdout.write(`${r.id}${status}\n  ${r.title}\n  ${r.url}\n\n`);
  }
  return 0;
}

async function confirm(question: string): Promise<boolean> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) return false;
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return /^y(es)?$/i.test((await rl.question(`${question} [y/N] `)).trim());
  } finally {
    rl.close();
  }
}

function setupHint(projectDir: string): string {
  const setups = clientSetups(MCP_URL);
  const agents = detectAgents(projectDir);
  const shown = setups.filter((s) => agents.includes(s.id));
  const list = shown.length ? shown : setups.filter((s) => s.id === 'claude' || s.id === 'cursor');
  const lines = ['Connect the MCP server so your agent can call get_checklist and get_card:'];
  for (const setup of list) {
    lines.push('', `${setup.name} (${setup.where}):`, setup.remote);
  }
  lines.push('', `Other agents: ${SITE}/library/connect?tab=mcp`);
  return lines.join('\n');
}

async function runInit(options: {
  stack?: string;
  'dry-run'?: boolean;
  yes?: boolean;
  'no-claude-md'?: boolean;
  online?: boolean;
}): Promise<number> {
  const projectDir = process.cwd();
  const library = await getLibrary(Boolean(options.online));
  const techs = options.stack ? techSlugs(options.stack.split(',')) : detectTechs(projectDir);
  if (!techs.length) {
    log(
      'No package.json technologies found. Pass --stack, for example: mustlist init --stack nextjs,postgres',
    );
    return 1;
  }
  const cards = cardsForTechs(library, techs);
  if (!cards.length) {
    log(
      `No verified cards for ${techs.join(', ')} yet. Browse ${SITE}/library or request one there.`,
    );
    return 0;
  }

  const block = renderBlock(cards);
  const agentsFile = path.join(projectDir, 'AGENTS.md');
  const before = existsSync(agentsFile) ? readFileSync(agentsFile, 'utf8') : undefined;
  const after = upsertBlock(before, block);

  if (options['dry-run']) {
    process.stdout.write(`${block}\n`);
    log(
      `\nDry run: AGENTS.md would ${before === undefined ? 'be created' : before === after ? 'not change' : 'be updated'}.`,
    );
    return 0;
  }
  if (before !== after) writeFileSync(agentsFile, after);
  log(
    `${before === undefined ? 'Created' : before === after ? 'Already up to date:' : 'Updated'} AGENTS.md ` +
      `with ${cards.length} card(s) for ${techs.join(', ')}.`,
  );

  const claudeFile = path.join(projectDir, 'CLAUDE.md');
  if (!options['no-claude-md'] && existsSync(claudeFile)) {
    const claude = readFileSync(claudeFile, 'utf8');
    if (!claudeMdReadsAgents(claude)) {
      const add =
        options.yes ||
        (await confirm('Add "@AGENTS.md" to CLAUDE.md so Claude Code reads the index?'));
      if (add) {
        writeFileSync(claudeFile, addAgentsImport(claude));
        log('Added @AGENTS.md to CLAUDE.md.');
      } else {
        log(
          'CLAUDE.md does not import AGENTS.md. Add a line "@AGENTS.md" to it, or run init with --yes.',
        );
      }
    }
  }
  log(`\n${setupHint(projectDir)}`);
  return 0;
}

export async function main(argv: string[]): Promise<number> {
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        online: { type: 'boolean' },
        stack: { type: 'string' },
        topic: { type: 'string' },
        limit: { type: 'string' },
        all: { type: 'boolean' },
        json: { type: 'boolean' },
        'dry-run': { type: 'boolean' },
        yes: { type: 'boolean' },
        'no-claude-md': { type: 'boolean' },
        help: { type: 'boolean', short: 'h' },
        version: { type: 'boolean', short: 'v' },
      },
    });
  } catch (error) {
    log(`${error instanceof Error ? error.message : String(error)}\n\n${HELP}`);
    return 2;
  }
  const { values, positionals } = parsed;
  const [command, ...rest] = positionals;
  if (values.version) {
    process.stdout.write(`${VERSION}\n`);
    return 0;
  }
  if (values.help || !command) {
    process.stdout.write(`${HELP}\n`);
    return command || values.help ? 0 : 2;
  }
  switch (command) {
    case 'mcp':
      await runMcp(Boolean(values.online));
      return 0;
    case 'init':
      return runInit(values);
    case 'search':
      if (!rest.length) {
        log('Usage: mustlist search <query>');
        return 2;
      }
      return runSearch(rest.join(' '), values);
    default:
      log(`Unknown command "${command}".\n\n${HELP}`);
      return 2;
  }
}
