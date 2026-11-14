import rehypeSanitize from 'rehype-sanitize';
import rehypeStringify from 'rehype-stringify';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';

/**
 * Markdown -> HTML. Raw HTML in cards is never rendered: remark-rehype drops it,
 * and rehype-sanitize (GitHub's safe schema) cleans whatever is left.
 */
const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype)
  .use(rehypeSanitize)
  .use(rehypeStringify);

export function renderMarkdown(markdown: string): string {
  return String(processor.processSync(markdown));
}

/** For one-line text (checklist items, version notes): no wrapping paragraph. */
export function renderInline(markdown: string): string {
  return renderMarkdown(markdown)
    .trim()
    .replace(/^<p>([\s\S]*)<\/p>$/, '$1');
}
