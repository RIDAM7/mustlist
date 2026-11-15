'use client';

import { useId, useState } from 'react';
import { LENS_TITLES } from '@mustlist/schema/constants';
import { Icon } from '@/components/icons';
import { Avatar, CodeText } from '@/components/ui';
import { useViewer } from '@/components/viewer';
import type { Comment, DiffRow, FieldChange, FieldThread } from '@/lib/community';
import { formatShortDate, splitCode } from '@/lib/format';
import { cn } from '@/lib/utils';
import { nowIso, useProposalState } from './proposal-state';

const ROW_CLASS: Record<DiffRow['kind'], string> = {
  add: 'd-add',
  del: 'd-del',
  chg: 'd-chg',
  same: '',
};

const MARK: Record<DiffRow['kind'], string> = { add: '+', del: '−', chg: '~', same: '·' };

/** Every field a card has, for "Show unchanged". */
const CARD_FIELDS: { id: string; name: string }[] = [
  { id: 'basics', name: 'Basics' },
  { id: 'checklist', name: 'Checklist' },
  { id: 'decisions', name: 'Decisions' },
  { id: 'options', name: 'Options' },
  { id: 'lenses', name: 'Lenses' },
  { id: 'versions', name: 'Version notes' },
  { id: 'verify', name: 'Verify checks' },
  { id: 'sources', name: 'Sources' },
  { id: 'meta', name: 'Card metadata' },
];

const Text = ({ value }: { value: string }) => <CodeText parts={splitCode(value)} />;

/**
 * Inline diff when the old and new text share a long beginning (at least 40% of the
 * shorter one): the shared part, the removed tail struck through, the new tail marked.
 * Returns null when the texts are too different, so the caller shows both in full.
 */
function inlineDiff(old: string, next: string) {
  let prefix = 0;
  while (prefix < old.length && prefix < next.length && old[prefix] === next[prefix]) prefix++;
  // Never split inside a `code` span.
  const ticks = (old.slice(0, prefix).match(/`/g) ?? []).length;
  if (ticks % 2 === 1) prefix = old.lastIndexOf('`', prefix - 1);
  if (prefix < 0.4 * Math.min(old.length, next.length)) return null;
  return { same: old.slice(0, prefix), removed: old.slice(prefix), added: next.slice(prefix) };
}

function Chips({ chips }: { chips: NonNullable<DiffRow['chips']> }) {
  return (
    <span className="mb-1 flex flex-wrap items-center gap-1.5">
      {chips.id && <span className="mono t-xs subtle">{chips.id}</span>}
      {chips.type && <span className="type">{chips.type}</span>}
      {chips.lens && <span className="lens">{LENS_TITLES[chips.lens].split(' ')[0]}</span>}
      {chips.level && (
        <span className={cn('lvl leading-4', chips.level === 'must' ? 'lvl-must' : 'lvl-should')}>
          {chips.level.toUpperCase()}
        </span>
      )}
    </span>
  );
}

function RowBody({ row, inlineCaption }: { row: DiffRow; inlineCaption: boolean }) {
  if (row.kind === 'same') return <span className="subtle">{row.text}</span>;

  const caption = row.caption ? (
    inlineCaption ? (
      <>
        <span className="mono t-xs subtle">{row.caption}</span>{' '}
      </>
    ) : (
      <span className="t-xs subtle block">{row.caption}</span>
    )
  ) : null;

  // Mono values: `old → new`.
  if (row.mono) {
    return (
      <span>
        {caption}
        {row.old && (
          <>
            <span className="mono d-old text-[13px]">{row.old}</span>{' '}
            <span className="subtle">→</span>{' '}
          </>
        )}
        <span className="mono text-[13px]">{row.text}</span>
        {row.note && <span className="t-xs subtle"> {row.note}</span>}
      </span>
    );
  }

  if (row.kind === 'chg' && row.old) {
    const diff = inlineDiff(row.old, row.text);
    return (
      <span>
        {row.chips && <Chips chips={row.chips} />}
        {caption}
        {diff ? (
          <>
            <Text value={diff.same} />
            {diff.removed && (
              <span className="d-old">
                <Text value={diff.removed} />
              </span>
            )}
            {diff.added && (
              <span className="d-ins">
                <Text value={diff.added} />
              </span>
            )}
          </>
        ) : (
          <>
            <span className="d-old block">
              <Text value={row.old} />
            </span>
            <span className="mt-1 block">
              <Text value={row.text} />
            </span>
          </>
        )}
      </span>
    );
  }

  return (
    <span className={row.chips || row.caption ? undefined : 'd-txt'}>
      {row.chips && <Chips chips={row.chips} />}
      {caption}
      <span className={row.chips || row.caption ? 'd-txt' : undefined}>
        <Text value={row.text} />
        {row.host && (
          <>
            {' '}
            <span className={cn('mono t-xs', row.kind !== 'del' && 'subtle')}>{row.host}</span>
          </>
        )}
      </span>
    </span>
  );
}

function ThreadComment({ comment, field }: { comment: Comment; field?: string }) {
  return (
    <div className="grid grid-cols-[24px_minmax(0,1fr)] gap-2.5 px-3 pt-3 last:pb-3">
      <Avatar handle={comment.author} />
      <div>
        <div className="t-sm flex flex-wrap items-center gap-2">
          <span className="strong">@{comment.author}</span>
          {field && <span className="mono t-xs subtle">{field}</span>}
          <span className="subtle">{formatShortDate(comment.date)}</span>
        </div>
        <p className="t-sm mt-1 whitespace-pre-wrap">
          <Text value={comment.body} />
        </p>
      </div>
    </div>
  );
}

function Thread({ thread, extra }: { thread?: FieldThread; extra: Comment[] }) {
  const { requireViewer } = useViewer();
  const [resolved, setResolved] = useState(Boolean(thread?.resolvedBy));
  const comments = [...(thread?.comments ?? []), ...extra];
  if (comments.length === 0) return null;
  return (
    <div className="mx-3 mb-3 rounded-lg border bg-bg-subtle">
      {comments.map((comment, index) => (
        <ThreadComment
          key={comment.id}
          comment={comment}
          field={index === 0 ? thread?.field : undefined}
        />
      ))}
      <div className="mt-3 flex items-center justify-between border-t px-3 py-2">
        {resolved ? (
          <span className="t-xs ok inline-flex items-center gap-1">
            <Icon name="check" size="sm" />
            Resolved by @{thread?.resolvedBy ?? 'you'}
          </span>
        ) : (
          <span className="t-xs subtle">Open</span>
        )}
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() =>
            requireViewer(resolved ? 'reopen threads' : 'resolve threads', () =>
              setResolved(!resolved),
            )
          }
        >
          {resolved ? 'Reopen' : 'Resolve'}
        </button>
      </div>
    </div>
  );
}

function FieldBox({ field, inlineCaption }: { field: FieldChange; inlineCaption: boolean }) {
  const { viewer, requireViewer } = useViewer();
  const { fieldComments, addFieldComment } = useProposalState();
  const [composing, setComposing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputId = useId();
  const extra = fieldComments[field.id] ?? [];

  function submit() {
    const body = draft.trim();
    if (!body || !viewer) return;
    addFieldComment(field.id, {
      id: `local-${field.id}-${extra.length + 1}`,
      author: viewer.handle,
      date: nowIso(),
      body,
    });
    setDraft('');
    setComposing(false);
  }

  return (
    <section id={field.id} className="box scroll-mt-6">
      <div className="box-h flex-wrap py-2">
        <span className="flex items-center gap-2.5">
          <span className="t-sm strong">{field.name}</span>
          {field.hint && <span className="mono t-xs subtle">{field.hint}</span>}
        </span>
        {field.maintainerOnly ? (
          <span className="t-xs subtle">set by maintainers</span>
        ) : (
          <span className="flex items-center gap-3">
            <span className="t-xs subtle">{field.summary}</span>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => requireViewer('comment', () => setComposing(true))}
            >
              <Icon name="comment" size="sm" />
              Comment
            </button>
          </span>
        )}
      </div>
      <div className="flex flex-col gap-1 p-3">
        {field.rows.map((row, index) => (
          <div key={index} className={cn('d-row', ROW_CLASS[row.kind])}>
            <span className={cn('d-mark', row.kind === 'same' && 'subtle')}>{MARK[row.kind]}</span>
            <RowBody row={row} inlineCaption={inlineCaption} />
          </div>
        ))}
      </div>
      <Thread thread={field.thread} extra={extra} />
      {composing && (
        <div className="mx-3 mb-3 overflow-hidden rounded-lg border">
          <label htmlFor={inputId} className="sr-only">
            Comment on {field.name}
          </label>
          <textarea
            id={inputId}
            className="input rounded-none border-0 shadow-none"
            rows={3}
            placeholder={`Comment on ${field.name.toLowerCase()}…`}
            value={draft}
            autoFocus
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) submit();
              if (event.key === 'Escape') setComposing(false);
            }}
          />
          <div className="flex justify-end gap-2 border-t p-2">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setComposing(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className={cn('btn btn-primary btn-sm', !draft.trim() && 'btn-disabled')}
              aria-disabled={!draft.trim()}
              onClick={submit}
            >
              Comment
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

export function ChangesView() {
  const { proposal } = useProposalState();
  const fields = proposal.changes;
  const [active, setActive] = useState(fields[0]?.id ?? '');
  const [showUnchanged, setShowUnchanged] = useState(false);
  const changedIds = new Set(fields.map((field) => field.id));
  const unchanged = CARD_FIELDS.filter((field) => !changedIds.has(field.id));
  const rows = fields.flatMap((field) => field.rows);
  const count = (kind: DiffRow['kind']) => rows.filter((row) => row.kind === kind).length;

  return (
    <div className="wrap flex flex-wrap gap-10 pb-24 pt-5 md:pt-6">
      <nav aria-label="Changed fields" className="hidden max-w-[240px] flex-[1_1_220px] md:block">
        <div className="sticky top-6">
          <div className="label mb-2">Fields</div>
          {fields.map((field) => (
            <a
              key={field.id}
              href={`#${field.id}`}
              className={cn('side', field.id === active && 'side-on')}
              onClick={() => setActive(field.id)}
            >
              <span>{field.name}</span>
              <span className="t-xs subtle mono">{field.short}</span>
            </a>
          ))}
          {showUnchanged &&
            unchanged.map((field) => (
              <a
                key={field.id}
                href={`#${field.id}`}
                className="side subtle"
                onClick={() => setActive(field.id)}
              >
                <span>{field.name}</span>
              </a>
            ))}
          <label className="t-sm muted mt-4 flex min-h-8 items-center gap-2 px-2.5">
            <input
              type="checkbox"
              checked={showUnchanged}
              onChange={(event) => setShowUnchanged(event.target.checked)}
              style={{ accentColor: 'var(--accent)' }}
            />
            Show unchanged
          </label>
        </div>
      </nav>
      <div className="flex min-w-0 flex-[999_1_640px] flex-col gap-5">
        {fields.length === 0 ? (
          <div className="box-dash flex flex-col items-center gap-1.5 px-6 py-12 text-center">
            <Icon name="file" size="lg" className="subtle" />
            <div className="mt-1.5 text-[15px] font-semibold">No changes yet</div>
            <div className="t-sm subtle">Checks run on every revision.</div>
          </div>
        ) : (
          <>
            <div className="t-sm flex flex-wrap items-center gap-x-4 gap-y-1">
              <span className="strong">
                {fields.length} field{fields.length === 1 ? '' : 's'} changed
              </span>
              {count('add') > 0 && <span className="ok">+ {count('add')} added</span>}
              {count('chg') > 0 && <span className="warn">~ {count('chg')} changed</span>}
              {count('del') > 0 && <span className="bad">− {count('del')} removed</span>}
              <span className="flex-1" />
              <span className="subtle">
                {proposal.revisions > 1 ? `Revision 1 → ${proposal.revisions}` : 'Revision 1'}
              </span>
              <label className="t-sm muted flex min-h-11 w-full items-center gap-2 md:hidden">
                <input
                  type="checkbox"
                  checked={showUnchanged}
                  onChange={(event) => setShowUnchanged(event.target.checked)}
                  style={{ accentColor: 'var(--accent)' }}
                />
                Show unchanged
              </label>
            </div>
            {fields.map((field) => (
              <FieldBox
                key={field.id}
                field={field}
                inlineCaption={Boolean(field.maintainerOnly)}
              />
            ))}
          </>
        )}
        {showUnchanged &&
          unchanged.map((field) => (
            <section key={field.id} id={field.id} className="box scroll-mt-6">
              <div className="box-h border-b-0">
                <span className="t-sm strong">{field.name}</span>
                <span className="t-xs subtle">unchanged</span>
              </div>
            </section>
          ))}
      </div>
    </div>
  );
}
