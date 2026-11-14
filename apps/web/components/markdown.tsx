import { renderInline, renderMarkdown } from '@/lib/markdown';
import { cn } from '@/lib/utils';

/** Card markdown, rendered at build time and sanitized (see lib/markdown.ts). */
export function Markdown({ source, className }: { source: string; className?: string }) {
  return (
    <div
      className={cn('card-prose', className)}
      dangerouslySetInnerHTML={{ __html: renderMarkdown(source) }}
    />
  );
}

/** One line of card text that may contain `code` or links. */
export function InlineMarkdown({ source }: { source: string }) {
  return <span className="card-prose" dangerouslySetInnerHTML={{ __html: renderInline(source) }} />;
}
