'use client';

import { useId, useState } from 'react';
import { Icon } from '@/components/icons';
import { Modal } from '@/components/overlay';
import { useCopy } from '@/components/toast';
import { plural } from '@/lib/format';
import { topicName } from '@/lib/topics';
import { cn } from '@/lib/utils';
import type { CheckReport } from './checks';
import { type Draft, serializeCard } from './draft';

const NOTE_MAX = 500;

/** "Submit for review" (design board 32). */
export function SubmitDialog({
  open,
  draft,
  heading,
  report,
  sending = false,
  viaGitHubEditor,
  onClose,
  onSubmit,
}: {
  open: boolean;
  draft: Draft;
  /** "New card: Background jobs · Next.js + Postgres" */
  heading: string;
  report: CheckReport;
  /** The proposal is on its way to GitHub. */
  sending?: boolean;
  /** Submitting copies the card and opens GitHub's editor (no pull request from the site). */
  viaGitHubEditor: boolean;
  onClose: () => void;
  onSubmit: (note: string) => void;
}) {
  const titleId = useId();
  const noteId = useId();
  const [note, setNote] = useState('');
  const [agreed, setAgreed] = useState(true);
  const copy = useCopy();
  const passing = report.errors === 0;

  const counts = [
    plural(draft.checklist.length, 'checklist item'),
    plural(draft.decisions.length, 'decision'),
    plural(draft.options.length, 'option'),
    plural(draft.verify.length, 'verify check'),
    plural(draft.sources.length, 'source'),
  ].join(' · ');

  return (
    <Modal open={open} onClose={onClose} labelledBy={titleId} className="max-w-[520px]">
      <div className="flex items-center justify-between pl-6 pr-5 pt-5">
        <h2 id={titleId} className="t-h3">
          Submit for review
        </h2>
        <button
          type="button"
          className="btn btn-ghost btn-icon"
          aria-label="Close"
          onClick={onClose}
        >
          <Icon name="x" />
        </button>
      </div>
      <div className="flex flex-col gap-4 px-6 pt-4">
        <div className="panel px-3.5 py-3">
          <div className="t-sm strong">{heading}</div>
          <div className="t-xs subtle mt-0.5">{counts}</div>
        </div>
        <div className="t-sm flex flex-col gap-1.5">
          <div className={cn('flex items-center gap-2', !passing && 'bad')}>
            <Icon
              name={passing ? 'checkCircle' : 'xCircle'}
              size="sm"
              className={passing ? 'ok' : 'bad'}
            />
            {passing ? 'Checks passing' : `${plural(report.errors, 'check problem')} to fix`}
          </div>
          {draft.request !== null && (
            <div className="flex items-center gap-2">
              <Icon name="link" size="sm" className="ok" />
              Resolves request #{draft.request} on accept
            </div>
          )}
          <div className="muted flex items-center gap-2">
            <Icon name="clock" size="sm" />
            Reviewers for {topicName(draft.topic || 'this topic')} are notified
          </div>
        </div>
        <div>
          <label htmlFor={noteId} className="field-label">
            Note for reviewers
          </label>
          <textarea
            id={noteId}
            className="input"
            rows={3}
            value={note}
            maxLength={NOTE_MAX}
            placeholder="What to double-check"
            onChange={(event) => setNote(event.target.value)}
          />
          <div className="mt-1 flex justify-end">
            <span className={cn('counter', note.length >= NOTE_MAX * 0.9 && 'counter-warn')}>
              {note.length} / {NOTE_MAX}
            </span>
          </div>
        </div>
        <label className="t-sm flex min-h-11 items-start gap-2.5">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(event) => setAgreed(event.target.checked)}
            className="mt-[3px] accent-[var(--accent)]"
          />
          <span>
            I wrote this card myself, every link is to a primary source, and I sign off under the{' '}
            <a
              href="https://developercertificate.org"
              target="_blank"
              rel="noopener noreferrer"
              className="link"
            >
              Developer Certificate of Origin
            </a>
            . <span className="subtle">Card text is licensed CC BY 4.0.</span>
          </span>
        </label>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 border-t px-6 pb-5 pt-4">
        <button
          type="button"
          className="btn btn-ghost mr-auto"
          onClick={() => void copy(serializeCard(draft), 'Copied · card file, as markdown')}
        >
          <Icon name="copy" />
          Copy as markdown
        </button>
        <button type="button" className="btn btn-ghost" onClick={onClose}>
          Keep editing
        </button>
        <button
          type="button"
          className={cn('btn btn-primary', (!passing || !agreed || sending) && 'btn-disabled')}
          aria-disabled={!passing || !agreed || sending}
          onClick={() => {
            if (passing && agreed && !sending) onSubmit(note);
          }}
        >
          {sending ? (
            'Sending…'
          ) : viaGitHubEditor ? (
            <>
              Continue on GitHub
              <Icon name="external" size="sm" />
            </>
          ) : (
            'Submit for review'
          )}
        </button>
      </div>
    </Modal>
  );
}
