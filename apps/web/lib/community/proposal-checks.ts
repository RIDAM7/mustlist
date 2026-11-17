import 'server-only';
import semver from 'semver';
import { normaliseText, parseCard } from '@mustlist/schema';
import { setTopLevelKey } from '@mustlist/schema/promote';
import {
  type CardInput,
  checkStatusGuard,
  createCardContext,
  validateCards,
} from '@mustlist/validator';
import { getIndex, getRawMarkdown } from '@/lib/data';

/**
 * Server-side checks for cards sent from the site: the same validator CI runs,
 * plus the status guard. The editor's live checks are a convenience; these are
 * the ones that decide.
 */

const pathOf = (cardId: string) => `cards/${cardId}.md`;

/** Every card in the library, as files, with `replace` swapped in. */
function library(replace: CardInput): CardInput[] {
  const inputs = getIndex()
    .map(({ id }) => ({ filePath: pathOf(id), text: getRawMarkdown(id) ?? '' }))
    .filter((input) => input.filePath !== replace.filePath);
  return [...inputs, replace];
}

/** Error messages from the validator for one card file. */
export function cardProblems(filePath: string, text: string): string[] {
  return validateCards(library({ filePath, text }), { only: new Set([filePath]) })
    .filter((item) => item.severity === 'error')
    .map((item) => `${item.message} (line ${item.line})`);
}

const NON_CONTENT = ['card_version', 'status', 'reviewers', 'review_level', 'last_verified'];

function content(text: string): string {
  const card = parseCard(text, 'card.md');
  const data = Object.fromEntries(
    Object.entries((card.frontmatter ?? {}) as Record<string, unknown>).filter(
      ([key]) => !NON_CONTENT.includes(key),
    ),
  );
  return `${JSON.stringify(data)}\n${card.body.trim()}`;
}

function setFrontmatter(text: string, values: Record<string, string>): string {
  const match = /^---\n([\s\S]*?)\n---/.exec(text);
  if (!match?.[1]) return text;
  let frontmatter = match[1];
  for (const [key, value] of Object.entries(values))
    frontmatter = setTopLevelKey(frontmatter, key, value);
  return `---\n${frontmatter}\n---${text.slice(match[0].length)}`;
}

/**
 * The card as it will be committed, and anything that blocks it:
 * - a new card is `proposed` at its own version;
 * - a change keeps the card's status, reviewers and dates (maintainers set
 *   those when they accept) and gets a minor version bump unless it already has one.
 */
export function prepareSubmission(
  cardId: string,
  markdown: string,
  mode: 'new' | 'change',
  author: string,
): { text: string; problems: string[] } {
  const filePath = pathOf(cardId);
  let text = normaliseText(markdown);
  if (!text.endsWith('\n')) text += '\n';
  const existing = getRawMarkdown(cardId);
  if (mode === 'new' && existing) {
    return {
      text,
      problems: [`A card for ${cardId} already exists. Suggest a change to it instead.`],
    };
  }
  if (mode === 'change' && !existing)
    return { text, problems: [`There is no card ${cardId} to change.`] };

  try {
    if (mode === 'new') {
      text = setFrontmatter(text, {
        status: 'proposed',
        last_verified: 'null',
        review_level: 'null',
        reviewers: '[]',
      });
    } else if (existing) {
      const before = createCardContext({ filePath, text: existing }).data;
      if (content(existing) === content(text)) {
        return { text, problems: ['Nothing has changed yet: edit the card, then submit.'] };
      }
      const draftVersion = (
        parseCard(text, filePath).frontmatter as { card_version?: string } | undefined
      )?.card_version;
      if (before) {
        const version =
          draftVersion && semver.valid(draftVersion) && semver.gt(draftVersion, before.card_version)
            ? draftVersion
            : (semver.inc(before.card_version, 'minor') ?? before.card_version);
        text = setFrontmatter(text, {
          status: before.status,
          card_version: version,
          last_verified: before.last_verified ?? 'null',
          review_level: before.review_level ?? 'null',
          reviewers: `[${before.reviewers.join(', ')}]`,
        });
      }
    }
  } catch (error) {
    return {
      text,
      problems: [error instanceof Error ? error.message : 'The card does not parse.'],
    };
  }

  const problems = cardProblems(filePath, text);
  const after = createCardContext({ filePath, text }).data;
  if (after) {
    const before = existing ? createCardContext({ filePath, text: existing }).data : undefined;
    problems.push(
      ...checkStatusGuard({
        filePath,
        before,
        after,
        author,
        maintainers: [],
        approvers: [],
        acceptedBy: undefined,
        contentChanged: Boolean(existing),
      }).map((item) => item.message),
    );
  }
  return { text, problems };
}
