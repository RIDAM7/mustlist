'use client';

import Link from 'next/link';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { formatShortDate } from '@/lib/format';
import { renderCommentMarkdown } from '@/lib/markdown';
import { cn } from '@/lib/utils';
import { useModKey } from '../top-bar';
import { Icon } from '../icons';
import { useCopy, useToast } from '../toast';
import { Avatar, EmptyState, Kbd } from '../ui';
import { useViewer } from '../viewer';

/** A comment with its markdown already rendered to sanitized HTML. */
export interface ThreadComment {
  id: string;
  author: string;
  date: string;
  html: string;
  /** "Maintainer" or "Reviewer". */
  badge?: string;
  /** The comment on GitHub. */
  url?: string;
  replies: ThreadComment[];
}

const total = (comments: ThreadComment[]) =>
  comments.reduce((sum, c) => sum + 1 + c.replies.length, 0);

function newComment(author: string, body: string): ThreadComment {
  return {
    id: `local-${Date.now()}`,
    author,
    date: new Date().toISOString(),
    html: renderCommentMarkdown(body),
    replies: [],
  };
}

/** Discussion: comments with one level of replies, markdown, code blocks, a reply box. */
export function Thread({
  comments: initial,
  heading = 'Discussion',
  emptyLine = 'Discussion',
  githubUrl,
}: {
  comments: ThreadComment[];
  heading?: string;
  emptyLine?: string;
  /** Where replies go in GitHub mode: the discussion, or a new one. */
  githubUrl?: string;
}) {
  const [comments, setComments] = useState(initial);
  const [order, setOrder] = useState<'oldest' | 'newest'>('oldest');
  const [expanded, setExpanded] = useState(false);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const { mode, viewer, requireViewer } = useViewer();
  const toast = useToast();
  const boxRef = useRef<HTMLTextAreaElement>(null);

  // "#reply" (from "Report a problem") focuses the reply box.
  useEffect(() => {
    if (window.location.hash === '#reply') boxRef.current?.focus();
  }, []);

  const sorted = order === 'oldest' ? comments : [...comments].reverse();
  const collapse = !expanded && sorted.length > 3;
  const hidden = collapse ? sorted.slice(2, -1) : [];
  const visible = collapse ? [...sorted.slice(0, 2), ...sorted.slice(-1)] : sorted;

  const addComment = (body: string) => {
    if (!viewer) return;
    setComments((list) => [...list, newComment(viewer.handle, body)]);
    toast('Comment posted');
  };

  const addReply = (parent: string, body: string) => {
    if (!viewer) return;
    setComments((list) =>
      list.map((c) =>
        c.id === parent ? { ...c, replies: [...c.replies, newComment(viewer.handle, body)] } : c,
      ),
    );
    setReplyTo(null);
    toast('Reply posted');
  };

  return (
    <section aria-labelledby="discussion-h">
      <div className="mb-2 mt-8 flex items-center justify-between md:mt-10">
        <h2 id="discussion-h" className="sec-h text-[18px]">
          {heading} <span className="subtle font-normal">{total(comments)}</span>
        </h2>
        {comments.length > 1 && (
          <div className="seg" role="radiogroup" aria-label="Order">
            {(['oldest', 'newest'] as const).map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={order === value}
                className={cn('seg-b', order === value && 'seg-on')}
                onClick={() => setOrder(value)}
              >
                {value === 'oldest' ? 'Oldest' : 'Newest'}
              </button>
            ))}
          </div>
        )}
      </div>

      {comments.length === 0 ? (
        <EmptyState icon="comment" title="No replies yet" line={emptyLine} className="mt-4">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => requireViewer('reply', () => boxRef.current?.focus(), githubUrl)}
          >
            Reply
          </button>
        </EmptyState>
      ) : (
        <div className="flex flex-col">
          {visible.map((comment, index) => (
            <div key={comment.id}>
              {collapse && index === 2 && (
                <button
                  type="button"
                  className="btn btn-ghost h-12 w-full justify-start rounded-none border-t text-fg-subtle"
                  onClick={() => setExpanded(true)}
                >
                  <Icon name="chevronDown" />
                  Show {total(hidden)} more replies
                </button>
              )}
              <CommentItem
                comment={comment}
                replying={replyTo === comment.id}
                onReply={() =>
                  requireViewer('reply', () => setReplyTo(comment.id), comment.url ?? githubUrl)
                }
                onCancelReply={() => setReplyTo(null)}
                onSubmitReply={(body) => addReply(comment.id, body)}
              />
            </div>
          ))}
        </div>
      )}

      {mode === 'github' ? (
        <GitHubReply href={githubUrl} />
      ) : (
        <>
          {/* Desktop reply box */}
          <div
            className="hidden grid-cols-[32px_minmax(0,1fr)] gap-3 border-t pt-5 md:grid"
            id="reply"
          >
            {viewer ? (
              <Avatar handle={viewer.handle} size="md" />
            ) : (
              <span className="av av-md bg-bg-muted text-fg-subtle" aria-hidden="true">
                <Icon name="user" size="sm" />
              </span>
            )}
            <ReplyBox
              textareaRef={boxRef}
              onSubmit={(body) => requireViewer('reply', () => addComment(body))}
              onFocusSignedOut={() => requireViewer('reply')}
              signedIn={Boolean(viewer)}
            />
          </div>

          {/* Phone reply bar */}
          <PhoneReplyBar onSubmit={(body) => requireViewer('reply', () => addComment(body))} />
        </>
      )}
    </section>
  );
}

function CommentItem({
  comment,
  replying,
  onReply,
  onCancelReply,
  onSubmitReply,
}: {
  comment: ThreadComment;
  replying: boolean;
  onReply: () => void;
  onCancelReply: () => void;
  onSubmitReply: (body: string) => void;
}) {
  const copy = useCopy();
  return (
    <div
      id={comment.id}
      className="grid grid-cols-[32px_minmax(0,1fr)] gap-3 border-t py-5 max-md:block max-md:py-4"
    >
      <span className="max-md:hidden">
        <Avatar handle={comment.author} size="md" />
      </span>
      <div className="min-w-0">
        <Byline handle={comment.author} date={comment.date} badge={comment.badge} />
        <div
          className="md t-body mt-1.5 max-md:mt-2"
          dangerouslySetInnerHTML={{ __html: comment.html }}
        />
        <div className="mt-2 flex gap-1">
          <button
            type="button"
            className="btn btn-ghost btn-sm max-md:-ml-2 max-md:h-11 max-md:px-2"
            onClick={onReply}
          >
            Reply
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm btn-icon max-md:hidden"
            aria-label="Copy link"
            onClick={() =>
              void copy(
                comment.url ?? `${window.location.href.split('#')[0]}#${comment.id}`,
                'Link copied',
              )
            }
          >
            <Icon name="link" size="sm" />
          </button>
        </div>
        {(comment.replies.length > 0 || replying) && (
          <div className="mt-3 flex flex-col gap-3 border-l pl-4 pt-3 max-md:mt-1 max-md:pl-3.5 max-md:pt-1">
            {comment.replies.map((reply) => (
              <div
                id={reply.id}
                key={reply.id}
                className="grid grid-cols-[24px_minmax(0,1fr)] gap-2.5 max-md:block"
              >
                <span className="max-md:hidden">
                  <Avatar handle={reply.author} />
                </span>
                <div className="min-w-0">
                  <Byline handle={reply.author} date={reply.date} badge={reply.badge} small />
                  <div
                    className="md mt-1 text-[15px] leading-6 max-md:mt-1.5"
                    dangerouslySetInnerHTML={{ __html: reply.html }}
                  />
                </div>
              </div>
            ))}
            {replying && (
              <ReplyBox
                compact
                autoFocus
                onSubmit={onSubmitReply}
                onCancel={onCancelReply}
                signedIn
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Byline({
  handle,
  date,
  badge,
  small = false,
}: {
  handle: string;
  date: string;
  badge?: string;
  small?: boolean;
}) {
  return (
    <div className="t-sm flex items-center gap-2">
      <span className="md:hidden">
        <Avatar handle={handle} size={small ? 'sm' : undefined} />
      </span>
      <Link href={`/people/${handle}`} className="strong hover:underline">
        @{handle}
      </Link>
      {badge && <span className="badge">{badge}</span>}
      <time className="subtle" dateTime={date}>
        {formatShortDate(date)}
      </time>
    </div>
  );
}

/** GitHub mode: replies are written on GitHub until sign-in arrives (step B). */
function GitHubReply({ href }: { href?: string }) {
  if (!href) return null;
  return (
    <>
      <div id="reply" className="hidden grid-cols-[32px_minmax(0,1fr)] gap-3 border-t pt-5 md:grid">
        <span className="av av-md bg-bg-muted text-fg-subtle" aria-hidden="true">
          <Icon name="user" size="sm" />
        </span>
        <div className="box flex items-center justify-between gap-3 py-3 pl-4 pr-3">
          <span className="t-sm muted">Replies are written on GitHub.</span>
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary btn-sm"
          >
            Reply on GitHub
            <Icon name="external" size="sm" />
          </a>
        </div>
      </div>
      <div className="sticky bottom-0 z-20 -mx-4 mt-4 border-t bg-bg px-3 pb-3 pt-2 md:hidden">
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-primary btn-lg w-full"
        >
          Reply on GitHub
          <Icon name="external" size="sm" />
        </a>
      </div>
    </>
  );
}

/** Write / Preview, a small toolbar, Markdown, Ctrl+Enter to send. */
export function ReplyBox({
  onSubmit,
  onCancel,
  onFocusSignedOut,
  signedIn,
  compact = false,
  autoFocus = false,
  textareaRef,
  placeholder = 'Reply…',
  submitLabel = 'Comment',
}: {
  onSubmit: (body: string) => void;
  onCancel?: () => void;
  onFocusSignedOut?: () => void;
  signedIn: boolean;
  compact?: boolean;
  autoFocus?: boolean;
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>;
  placeholder?: string;
  submitLabel?: string;
}) {
  const [body, setBody] = useState('');
  const [mode, setMode] = useState<'write' | 'preview'>('write');
  const ownRef = useRef<HTMLTextAreaElement>(null);
  const ref = textareaRef ?? ownRef;
  const id = useId();
  const mod = useModKey();

  const submit = () => {
    if (!body.trim()) return;
    onSubmit(body.trim());
    setBody('');
    setMode('write');
  };

  const wrap = (before: string, after = before) => {
    const el = ref.current;
    if (!el) return;
    const { selectionStart: start, selectionEnd: end } = el;
    const next = body.slice(0, start) + before + body.slice(start, end) + after + body.slice(end);
    setBody(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + before.length, end + before.length);
    });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      submit();
    }
    if (event.key === 'Escape' && onCancel) onCancel();
  };

  return (
    <div className="box overflow-hidden">
      <div className="flex gap-0.5 border-b p-1">
        {(['write', 'preview'] as const).map((value) => (
          <button
            key={value}
            type="button"
            className={cn('seg-b', mode === value && 'seg-on')}
            aria-pressed={mode === value}
            onClick={() => setMode(value)}
          >
            {value === 'write' ? 'Write' : 'Preview'}
          </button>
        ))}
        <div className="flex-1" />
        <button
          type="button"
          className="btn btn-ghost btn-sm btn-icon"
          aria-label="Bold"
          onClick={() => wrap('**')}
        >
          <span className="font-bold">B</span>
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm btn-icon"
          aria-label="Code"
          onClick={() => wrap('`')}
        >
          <span className="mono text-xs">&lt;/&gt;</span>
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm btn-icon"
          aria-label="Link"
          onClick={() => wrap('[', '](https://)')}
        >
          <Icon name="link" size="sm" />
        </button>
      </div>
      <label htmlFor={id} className="sr-only">
        Reply
      </label>
      {mode === 'write' ? (
        <textarea
          id={id}
          ref={ref}
          className="input rounded-none border-0 shadow-none focus:shadow-none"
          rows={compact ? 3 : 4}
          placeholder={placeholder}
          value={body}
          autoFocus={autoFocus}
          onChange={(event) => setBody(event.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => {
            if (!signedIn) onFocusSignedOut?.();
          }}
        />
      ) : (
        <div
          className="md min-h-[112px] px-3 py-2.5 text-sm"
          dangerouslySetInnerHTML={{
            __html: body.trim()
              ? renderCommentMarkdown(body)
              : '<p class="subtle">Nothing to preview</p>',
          }}
        />
      )}
      <div className="flex items-center justify-between border-t py-2 pl-3 pr-2">
        <span className="t-xs subtle">Markdown</span>
        <div className="flex items-center gap-2">
          <span className="t-xs subtle hidden items-center gap-1 sm:inline-flex">
            <Kbd>{mod}</Kbd>
            <Kbd>Enter</Kbd>
          </span>
          {onCancel && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>
              Cancel
            </button>
          )}
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={submit}
            disabled={!body.trim()}
          >
            {submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function PhoneReplyBar({ onSubmit }: { onSubmit: (body: string) => void }) {
  const [body, setBody] = useState('');
  const id = useId();
  return (
    <form
      className="sticky bottom-0 z-20 -mx-4 mt-4 flex items-center gap-2 border-t bg-bg px-3 pb-3 pt-2 md:hidden"
      onSubmit={(event) => {
        event.preventDefault();
        if (!body.trim()) return;
        onSubmit(body.trim());
        setBody('');
      }}
    >
      <label htmlFor={id} className="sr-only">
        Reply
      </label>
      <input
        id={id}
        className="input h-11 flex-1 text-base"
        placeholder="Reply…"
        value={body}
        onChange={(event) => setBody(event.target.value)}
      />
      <button type="submit" className="btn btn-primary btn-lg">
        Send
      </button>
    </form>
  );
}
