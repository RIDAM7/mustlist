import type { Element, ElementContent, Root, RootContent, Text } from 'hast';
import rehypeSanitize from 'rehype-sanitize';
import rehypeStringify from 'rehype-stringify';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';
import { highlight } from './highlight';

/**
 * Markdown -> HTML. Raw HTML in cards is never rendered: remark-rehype drops it,
 * and rehype-sanitize (GitHub's safe schema) cleans whatever is left. Code blocks
 * are then rebuilt as the design's code component (header, copy, line numbers).
 */

type CodeVariant = 'card' | 'plain';

const el = (
  tagName: string,
  properties: Element['properties'],
  children: ElementContent[] = [],
): Element => ({ type: 'element', tagName, properties, children });

const text = (value: string): Text => ({ type: 'text', value });

function textOf(node: ElementContent): string {
  if (node.type === 'text') return node.value;
  if (node.type === 'element') return node.children.map(textOf).join('');
  return '';
}

const COPY_ICON = el(
  'svg',
  { className: ['i', 'i-sm'], viewBox: '0 0 24 24', ariaHidden: 'true' },
  [
    el('rect', { x: '9', y: '9', width: '11', height: '11', rx: '2' }),
    el('path', { d: 'M5 15V6a2 2 0 0 1 2-2h8' }),
  ],
);

function codeBlock(code: string, lang: string, variant: CodeVariant): Element {
  const lines = highlight(code, lang);
  const label =
    variant === 'card'
      ? `${lang || 'code'} · ${lines.length} line${lines.length === 1 ? '' : 's'} · illustration`
      : lang || 'code';
  return el('div', { className: ['code'] }, [
    el('div', { className: ['code-h'] }, [
      el('span', {}, [text(label)]),
      el(
        'button',
        { type: 'button', className: ['btn', 'btn-ghost', 'btn-sm'], dataCopyCode: '' },
        [COPY_ICON, text('Copy')],
      ),
    ]),
    el(
      'div',
      { className: ['code-b'] },
      lines.map((tokens, index) =>
        el('div', { className: ['code-l'] }, [
          el('span', { className: ['ln'] }, [text(String(index + 1))]),
          el(
            'span',
            {},
            tokens.map((token) =>
              token.cls
                ? el('span', { className: [token.cls] }, [text(token.text)])
                : text(token.text),
            ),
          ),
        ]),
      ),
    ),
  ]);
}

/** Replace every `<pre><code class="language-x">` with the design's code block. */
function rehypeCodeBlocks(variant: CodeVariant) {
  return (tree: Root) => {
    const walk = (children: (RootContent | ElementContent)[]) => {
      children.forEach((node, index) => {
        if (node.type !== 'element') return;
        const code = node.tagName === 'pre' ? node.children[0] : undefined;
        if (code?.type === 'element' && code.tagName === 'code') {
          const classes = (code.properties.className as string[] | undefined) ?? [];
          const lang = classes.find((c) => c.startsWith('language-'))?.slice(9) ?? '';
          children[index] = codeBlock(textOf(code), lang, variant);
          return;
        }
        walk(node.children);
      });
    };
    walk(tree.children);
  };
}

function processor(variant: CodeVariant) {
  return unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype)
    .use(rehypeSanitize)
    .use(rehypeCodeBlocks, variant)
    .use(rehypeStringify);
}

const cardProcessor = processor('card');
const plainProcessor = processor('plain');

/** Card markdown (lenses, why, mistakes). Code blocks say "illustration". */
export function renderMarkdown(markdown: string): string {
  return String(cardProcessor.processSync(markdown));
}

/** Discussion and review markdown. Code blocks show only the language. */
export function renderCommentMarkdown(markdown: string): string {
  return String(plainProcessor.processSync(markdown));
}

/** For one-line text (checklist items, version notes): no wrapping paragraph. */
export function renderInline(markdown: string): string {
  return renderMarkdown(markdown)
    .trim()
    .replace(/^<p>([\s\S]*)<\/p>$/, '$1');
}
