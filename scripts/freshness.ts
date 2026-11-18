/**
 * Weekly freshness check, run by .github/workflows/freshness.yml (or locally,
 * without a token, as a dry run that only prints):
 * - a verified card older than 180 days gets a "Re-check" issue;
 * - a package major newer than every range in a card gets a "New major version" issue;
 * - re-check issues open for 30 days get the `overdue` label and one reminder;
 * - broken links get one "Broken links in cards" issue, closed again when they're fixed.
 */
import { parseArgs } from 'node:util';
import type { CardFrontmatter } from '@mustlist/schema';
import { DEFAULT_SITE_URL as SITE_URL } from '@mustlist/schema/constants';
import {
  checkLinks,
  createCardContext,
  findMarkdownFiles,
  formatText,
  readCards,
} from '@mustlist/validator';
import {
  daysBetween,
  dueForRecheck,
  LINKS_TITLE,
  majorTitle,
  newMajors,
  OVERDUE_AFTER_DAYS,
  RECHECK_AFTER_DAYS,
  recheckTitle,
} from './lib/freshness';
import { createGitHub, type GitHub, writeSummary } from './lib/github';

const { values } = parseArgs({ options: { 'no-links': { type: 'boolean', default: false } } });
const repo = process.env['GITHUB_REPOSITORY'] ?? 'RIDAM7/mustlist';
const gh: GitHub | undefined = process.env['GITHUB_TOKEN'] ? createGitHub() : undefined;
const today = new Date();
const report: string[] = ['### Freshness', ''];

interface Issue {
  number: number;
  title: string;
  created_at: string;
  labels: { name: string }[];
  pull_request?: unknown;
}

async function openIssues(): Promise<Issue[]> {
  if (!gh) return [];
  const issues = await gh.list<Issue>(`/repos/${repo}/issues?state=open`);
  return issues.filter((issue) => !issue.pull_request);
}

async function openIssue(title: string, body: string, labels: string[], existing: Issue[]) {
  const found = existing.find((issue) => issue.title === title);
  if (found) {
    report.push(`- already open: #${found.number} ${title}`);
    return;
  }
  if (!gh) {
    report.push(`- would open: ${title} [${labels.join(', ')}]`);
    return;
  }
  const created = await gh.send<{ number: number }>('POST', `/repos/${repo}/issues`, {
    title,
    body,
    labels,
  });
  report.push(`- opened #${created.number}: ${title}`);
}

async function latestVersions(cards: readonly CardFrontmatter[]): Promise<Map<string, string>> {
  const names = [...new Set(cards.flatMap((card) => card.versions.map((entry) => entry.package)))];
  const latest = new Map<string, string>();
  for (const name of names.sort()) {
    try {
      const response = await fetch(
        `https://registry.npmjs.org/${name.replaceAll('/', '%2F')}/latest`,
        {
          headers: { Accept: 'application/json', 'User-Agent': 'mustlist-workflows' },
          signal: AbortSignal.timeout(15_000),
        },
      );
      if (!response.ok) continue;
      const json = (await response.json()) as { version?: string };
      if (json.version) latest.set(name, json.version);
    } catch {
      // Not on npm, or the registry is slow: skip this package this week.
    }
  }
  return latest;
}

async function main(): Promise<void> {
  const cwd = process.cwd();
  const contexts = readCards(cwd, findMarkdownFiles(cwd, 'cards')).map(createCardContext);
  const cards = contexts.flatMap((context) => (context.data ? [context.data] : []));
  const issues = await openIssues();
  const cardUrl = (id: string) => `${SITE_URL}/library/${id}`;

  for (const card of dueForRecheck(cards, today)) {
    await openIssue(
      recheckTitle(card.id),
      [
        `[${card.title}](${cardUrl(card.id)}) was last verified on ${card.last_verified}, more than ${RECHECK_AFTER_DAYS} days ago.`,
        '',
        'To re-check it: run its verify checks against the current versions, compare each version entry with the official docs, then open a proposal with any fixes (or a maintainer re-promotes it unchanged).',
        '',
        `File: \`cards/${card.id}.md\``,
      ].join('\n'),
      ['needs-recheck', `topic: ${card.topic}`],
      issues,
    );
  }

  for (const major of newMajors(cards, await latestVersions(cards))) {
    await openIssue(
      majorTitle(major),
      [
        `\`${major.pkg}\` ${major.latest} is out, and [${major.cardId}](${cardUrl(major.cardId)}) covers only ${major.ranges.map((range) => `\`${range}\``).join(', ')}.`,
        '',
        `Add a version entry for the new major (notes plus a link to the official docs, which must come first). A small, self-contained change: a good first contribution.`,
      ].join('\n'),
      ['new-major', 'good first card', `topic: ${major.topic}`],
      issues,
    );
  }

  for (const issue of issues) {
    const isRecheck = issue.labels.some((label) => label.name === 'needs-recheck');
    const overdue = issue.labels.some((label) => label.name === 'overdue');
    const age = daysBetween(issue.created_at.slice(0, 10), today);
    if (!isRecheck || overdue || age < OVERDUE_AFTER_DAYS) continue;
    if (!gh) {
      report.push(`- would mark #${issue.number} overdue (${age} days)`);
      continue;
    }
    await gh.send('POST', `/repos/${repo}/issues/${issue.number}/labels`, { labels: ['overdue'] });
    await gh.send('POST', `/repos/${repo}/issues/${issue.number}/comments`, {
      body: `This re-check has been open for ${age} days. Maintainers: re-verify the card or mark it stale.`,
    });
    report.push(`- marked #${issue.number} overdue`);
  }

  if (!values['no-links']) {
    const broken = (await checkLinks(contexts)).filter((item) => item.severity === 'error');
    const linksIssue = issues.find((issue) => issue.title === LINKS_TITLE);
    const body = ['Links that failed this week:', '', '```', formatText(broken), '```'].join('\n');
    if (broken.length > 0 && linksIssue && gh) {
      await gh.send('PATCH', `/repos/${repo}/issues/${linksIssue.number}`, { body });
      report.push(`- updated #${linksIssue.number}: ${broken.length} broken link(s)`);
    } else if (broken.length > 0) {
      await openIssue(LINKS_TITLE, body, ['broken-links'], issues);
    } else if (linksIssue && gh) {
      await gh.send('POST', `/repos/${repo}/issues/${linksIssue.number}/comments`, {
        body: 'Every link works again.',
      });
      await gh.send('PATCH', `/repos/${repo}/issues/${linksIssue.number}`, {
        state: 'closed',
        state_reason: 'completed',
      });
      report.push(`- closed #${linksIssue.number}: every link works`);
    } else {
      report.push('- every link works');
    }
  }

  if (report.length === 2) report.push('Nothing is due.');
  await writeSummary(report.join('\n'));
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
