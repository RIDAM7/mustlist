import { parseCard, validateFrontmatter } from '@mustlist/schema';
import { DEFAULT_RULES } from './rules';
import type { CardContext, CardInput, Diagnostic, ProjectContext, Rule } from './types';

/** Parse a card and run the schema once; every rule reuses the result. */
export function createCardContext(input: CardInput): CardContext {
  const card = parseCard(input.text, input.filePath);
  if (card.parseErrors.length > 0) return { card, data: undefined, issues: [] };
  const { data, issues } = validateFrontmatter(card.frontmatter);
  return { card, data, issues };
}

function idOf(context: CardContext): string | undefined {
  const raw = context.card.frontmatter;
  if (typeof raw !== 'object' || raw === null) return undefined;
  const id = (raw as Record<string, unknown>)['id'];
  return typeof id === 'string' ? id : undefined;
}

/** Cards sorted by path (stable), plus the set of card ids that exist. */
export function createProject(contexts: readonly CardContext[]): ProjectContext {
  const cards = [...contexts].sort((a, b) =>
    a.card.filePath < b.card.filePath ? -1 : a.card.filePath > b.card.filePath ? 1 : 0,
  );
  const knownIds = new Set(cards.map(idOf).filter((id): id is string => id !== undefined));
  return { cards, knownIds };
}

export function compareDiagnostics(a: Diagnostic, b: Diagnostic): number {
  if (a.file !== b.file) return a.file < b.file ? -1 : 1;
  if (a.line !== b.line) return a.line - b.line;
  if (a.rule !== b.rule) return a.rule < b.rule ? -1 : 1;
  return a.message < b.message ? -1 : a.message > b.message ? 1 : 0;
}

export interface ValidateOptions {
  /** Report only on these file paths. Default: every input. */
  only?: ReadonlySet<string>;
  rules?: readonly Rule[];
}

/**
 * Validate cards. All `inputs` form the project (for `related` and `duplicate`);
 * diagnostics are reported for `options.only` (default: all inputs).
 */
export function validateCards(
  inputs: readonly CardInput[],
  options: ValidateOptions = {},
): Diagnostic[] {
  const project = createProject(inputs.map(createCardContext));
  const rules = options.rules ?? DEFAULT_RULES;
  const only = options.only;
  return project.cards
    .filter((context) => !only || only.has(context.card.filePath))
    .flatMap((context) => rules.flatMap((rule) => rule.check(context, project)))
    .sort(compareDiagnostics);
}

export function hasErrors(diagnostics: readonly Diagnostic[]): boolean {
  return diagnostics.some((item) => item.severity === 'error');
}
