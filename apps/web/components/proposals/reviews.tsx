'use client';

import { useId, useState, type ReactNode } from 'react';
import { Icon } from '@/components/icons';
import { useToast } from '@/components/toast';
import { Avatar, CodeText } from '@/components/ui';
import { useViewer } from '@/components/viewer';
import { roleLabel, type Comment, type Review } from '@/lib/community';
import { formatShortDate, splitCode } from '@/lib/format';
import { cn } from '@/lib/utils';
import { VerdictPill } from './bits';
import { nowIso, useProposalState } from './proposal-state';

/** One review (board 28). `body` is pre-rendered markdown for server reviews. */
export function ReviewArticle({ review, body }: { review: Review; body?: ReactNode }) {
  return (
    <article className="box">
      <div className="box-h min-h-[52px]">
        <span className="flex items-center gap-2.5">
          <Avatar handle={review.author} />
          <span className="t-sm">
            <span className="strong">@{review.author}</span>{' '}
            <span className="subtle">
              · {formatShortDate(review.date)}
              {review.revision !== undefined && ` · revision ${review.revision}`}
            </span>
          </span>
        </span>
        <VerdictPill verdict={review.verdict} />
      </div>
      {(body || review.body || review.notes?.length) && (
        <div className="flex flex-col gap-3 p-4">
          {body ?? <p className="t-body whitespace-pre-wrap">{review.body}</p>}
          {review.notes?.map((note) => (
            <div key={note.field} className="panel p-3">
              <div className="t-xs subtle mono mb-1.5">{note.field}</div>
              {note.quote && (
                <p className="t-sm border-l-2 border-border-strong pl-2.5">
                  <CodeText parts={splitCode(note.quote)} />
                </p>
              )}
              <p className={cn('t-sm', note.quote && 'mt-2')}>
                <CodeText parts={splitCode(note.text)} />
              </p>
              {note.resolved && (
                <div className="t-xs ok mt-2 inline-flex items-center gap-1">
                  <Icon name="check" size="sm" />
                  {note.resolved}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {review.replies?.map((reply: Comment) => (
        <div
          key={reply.id}
          className="grid grid-cols-[24px_minmax(0,1fr)] gap-2.5 border-t px-4 py-3"
        >
          <Avatar handle={reply.author} />
          <div>
            <div className="t-sm">
              <span className="strong">@{reply.author}</span>{' '}
              <span className="subtle">· {formatShortDate(reply.date)}</span>
            </div>
            <p className="t-sm mt-0.5">
              <CodeText parts={splitCode(reply.body)} />
            </p>
          </div>
        </div>
      ))}
    </article>
  );
}

/** Reviews written in this browser appear above the existing ones. */
export function LocalReviews({ showEmpty = false }: { showEmpty?: boolean }) {
  const { localReviews } = useProposalState();
  if (showEmpty && localReviews.length === 0) return <p className="t-sm subtle">No reviews yet.</p>;
  return (
    <>
      {localReviews.map((review) => (
        <ReviewArticle key={review.id} review={review} />
      ))}
    </>
  );
}

const KINDS: { id: Review['verdict']; label: string; hint: string }[] = [
  { id: 'approved', label: 'Approve', hint: 'Counts toward the 2 approvals' },
  { id: 'changes', label: 'Request changes', hint: 'Blocks accept until resolved' },
  { id: 'comment', label: 'Comment', hint: 'No verdict' },
];

/** "Your review": comment, verdict, submit (board 28). */
export function ReviewBox() {
  const { viewer, requireViewer } = useViewer();
  const toast = useToast();
  const { proposal, status, localReviews, addReview, approve, requestChanges } = useProposalState();
  const [text, setText] = useState('');
  const own = viewer?.handle === proposal.author;
  const [kind, setKind] = useState<Review['verdict']>(own ? 'comment' : 'approved');
  const inputId = useId();

  if (status === 'accepted' || status === 'closed') return null;

  if (!viewer) {
    return (
      <section className="box mt-4" aria-labelledby={`${inputId}-h`}>
        <div className="box-h">
          <h2 id={`${inputId}-h`} className="t-sm strong">
            Your review
          </h2>
        </div>
        <div className="p-4">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => requireViewer('review')}
          >
            Sign in to review
          </button>
        </div>
      </section>
    );
  }

  const needsText = kind !== 'approved' && !text.trim();

  function submit() {
    if (!viewer || needsText) return;
    addReview({
      id: `local-review-${localReviews.length + 1}`,
      author: viewer.handle,
      date: nowIso(),
      verdict: kind,
      body: text.trim(),
    });
    if (kind === 'approved') approve(viewer.handle);
    if (kind === 'changes') requestChanges();
    setText('');
    toast('Review submitted');
  }

  return (
    <section className="box mt-4" aria-labelledby={`${inputId}-h`}>
      <div className="box-h">
        <h2 id={`${inputId}-h`} className="t-sm strong">
          Your review
        </h2>
        <span className="t-xs subtle">
          as @{viewer.handle} · {roleLabel(viewer.role)}
        </span>
      </div>
      <div className="p-4">
        <label htmlFor={inputId} className="sr-only">
          Review comment
        </label>
        <textarea
          id={inputId}
          className="input"
          rows={4}
          placeholder="Leave a comment…"
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) submit();
          }}
        />
        <div role="radiogroup" aria-label="Review type" className="mt-3 flex flex-col gap-2">
          {KINDS.map((item) => {
            const disabled = own && item.id !== 'comment';
            return (
              <button
                key={item.id}
                type="button"
                role="radio"
                aria-checked={item.id === kind}
                disabled={disabled}
                className={cn(
                  'ans',
                  item.id === kind && 'ans-on',
                  disabled && 'cursor-not-allowed opacity-45',
                )}
                onClick={() => setKind(item.id)}
              >
                <span className="radio" />
                <span className="flex flex-1 flex-col">
                  <span className="font-medium">{item.label}</span>
                  <span className="t-xs subtle">
                    {disabled ? 'Not on your own proposal' : item.hint}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            className={cn('btn btn-primary', needsText && 'btn-disabled')}
            aria-disabled={needsText}
            onClick={submit}
          >
            Submit review
          </button>
        </div>
      </div>
    </section>
  );
}
