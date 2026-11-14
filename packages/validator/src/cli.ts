import { parseArgs } from 'node:util';
import { formatGithubAnnotations, formatJson, formatText } from './format';
import {
  changedCardFiles,
  findMarkdownFiles,
  readCards,
  relativePath,
  resolveBaseRef,
} from './files';
import { checkLinks } from './links';
import type { Diagnostic } from './types';
import { compareDiagnostics, createCardContext, hasErrors, validateCards } from './validate';

const CARDS_DIR = 'cards';

const HELP = `Usage: pnpm validate [paths...] [options]

Validates card files. With no paths, validates every card in ${CARDS_DIR}/.

Options:
  --json        Print machine-readable JSON
  --links       Also check that every https link responds (slower, uses the network)
  --changed     Only cards changed compared with the base branch
  --base <ref>  Base for --changed (default: MUSTLIST_BASE_REF, the PR base, or origin/main)
  -h, --help    Show this help`;

async function main(): Promise<number> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      json: { type: 'boolean', default: false },
      links: { type: 'boolean', default: false },
      changed: { type: 'boolean', default: false },
      base: { type: 'string' },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
  if (values.help) {
    console.log(HELP);
    return 0;
  }

  const cwd = process.cwd();
  const log = (message: string) => {
    if (!values.json) console.log(message);
  };

  let selected: string[];
  if (values.changed) {
    const { files, comparedWith } = changedCardFiles(
      cwd,
      CARDS_DIR,
      resolveBaseRef(values.base, process.env),
    );
    log(`Changed cards (compared with ${comparedWith}): ${files.length}`);
    selected = files;
  } else if (positionals.length > 0) {
    selected = positionals.flatMap((target) => findMarkdownFiles(cwd, target));
    if (selected.length === 0) {
      console.error(`No .md files found in: ${positionals.join(', ')}`);
      return 1;
    }
  } else {
    selected = findMarkdownFiles(cwd, CARDS_DIR);
  }

  if (selected.length === 0) {
    log('No cards to validate.');
    if (values.json) console.log(formatJson([]));
    return 0;
  }

  // Every card in cards/ is part of the project, so `related` and `duplicate` see them all.
  const projectFiles = [...new Set([...findMarkdownFiles(cwd, CARDS_DIR), ...selected])];
  const inputs = readCards(cwd, projectFiles);
  const only = new Set(selected.map((file) => relativePath(cwd, file)));
  let diagnostics: Diagnostic[] = validateCards(inputs, { only });

  if (values.links) {
    log(`Checking links in ${only.size} card(s)...`);
    const contexts = inputs.filter((input) => only.has(input.filePath)).map(createCardContext);
    diagnostics = [...diagnostics, ...(await checkLinks(contexts))].sort(compareDiagnostics);
  }

  if (values.json) {
    console.log(formatJson(diagnostics));
  } else {
    console.log(formatText(diagnostics));
    if (process.env['GITHUB_ACTIONS'] === 'true' && diagnostics.length > 0) {
      console.log(formatGithubAnnotations(diagnostics));
    }
  }
  return hasErrors(diagnostics) ? 1 : 0;
}

main().then(
  (code) => {
    process.exitCode = code;
  },
  (error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  },
);
