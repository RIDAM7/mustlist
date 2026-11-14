import { GITHUB_HANDLE_PATTERN, isReservedSlug, isSlug } from '@mustlist/schema';

export interface NewCardRequest {
  topic: string;
  stack: string;
  authors: readonly string[];
  draft: boolean;
}

/** Topic plus the sorted technologies of the stack slug: `auth/nextjs-postgres` == `auth/postgres-nextjs`. */
export function cardKey(topic: string, stack: string): string {
  return `${topic}/${stack.split('-').sort().join('-')}`;
}

/** Reasons the card cannot be created, or an empty list. */
export function newCardProblems(request: NewCardRequest, existingIds: readonly string[]): string[] {
  const problems: string[] = [];
  const { topic, stack } = request;
  if (!isSlug(topic))
    problems.push(`Topic "${topic}" must be lowercase kebab-case, 2-40 characters.`);
  if (isReservedSlug(topic)) problems.push(`Topic "${topic}" is reserved by the site.`);
  if (!isSlug(stack))
    problems.push(`Stack "${stack}" must be lowercase kebab-case, 2-40 characters.`);
  if (problems.length > 0) return problems;

  const key = cardKey(topic, stack);
  const clash = existingIds.find((id) => {
    const [otherTopic = '', otherStack = ''] = id.split('/');
    return id === `${topic}/${stack}` || cardKey(otherTopic, otherStack) === key;
  });
  if (clash) problems.push(`A card for this topic and stack already exists: cards/${clash}.md`);
  return problems;
}

/** Fill the template placeholders. */
export function renderCardTemplate(template: string, request: NewCardRequest): string {
  const values: Record<string, string> = {
    id: `${request.topic}/${request.stack}`,
    topic: request.topic,
    stack: request.stack.split('-').join(', '),
    status: request.draft ? 'draft' : 'proposed',
    authors: request.authors.join(', '),
  };
  return template.replace(
    /\{\{(\w+)\}\}/g,
    (placeholder, name: string) => values[name] ?? placeholder,
  );
}

/** A GitHub handle from git config values, or `undefined` if none looks like one. */
export function pickGithubHandle(candidates: readonly (string | undefined)[]): string | undefined {
  return candidates
    .map((value) => value?.trim())
    .find((value) => !!value && GITHUB_HANDLE_PATTERN.test(value));
}
