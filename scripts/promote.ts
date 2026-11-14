import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import {
  findMarkdownFiles,
  formatText,
  hasErrors,
  readCards,
  validateCards,
} from '@mustlist/validator';
import { PromoteError, promoteCard } from './lib/promote';

const USAGE = `Usage: pnpm promote <topic/stack> --reviewers a,b --level seed|community [--date YYYY-MM-DD]

Marks a reviewed card as verified (maintainers only): sets status, last_verified,
reviewers and review_level, and bumps card_version. Refuses if the result does not validate.`;

const today = () => new Date().toISOString().slice(0, 10);

function main(): number {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      reviewers: { type: 'string' },
      level: { type: 'string' },
      date: { type: 'string' },
      help: { type: 'boolean', short: 'h' },
    },
  });
  const [id] = positionals;
  if (values.help || !id || !values.reviewers || !values.level) {
    console.log(USAGE);
    return values.help ? 0 : 1;
  }

  const cwd = process.cwd();
  const filePath = `cards/${id}.md`;
  if (!existsSync(path.join(cwd, filePath))) {
    console.error(`No card at ${filePath}`);
    return 1;
  }

  try {
    const result = promoteCard(readFileSync(path.join(cwd, filePath), 'utf8'), {
      reviewers: values.reviewers.split(','),
      level: values.level,
      date: values.date ?? today(),
    });
    const others = readCards(cwd, findMarkdownFiles(cwd, 'cards')).filter(
      (card) => card.filePath !== filePath,
    );
    const diagnostics = validateCards([...others, { filePath, text: result.text }], {
      only: new Set([filePath]),
    });
    if (hasErrors(diagnostics)) {
      console.error(formatText(diagnostics));
      console.error(`Not promoted: ${filePath} would not validate as verified.`);
      return 1;
    }
    writeFileSync(path.join(cwd, filePath), result.text);
    console.log(
      `Promoted ${id}: ${result.fromStatus} -> verified, card_version ${result.fromVersion} -> ${result.toVersion}`,
    );
    return 0;
  } catch (error) {
    if (error instanceof PromoteError) {
      console.error(error.message);
      return 1;
    }
    throw error;
  }
}

process.exitCode = main();
