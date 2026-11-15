'use client';

import Link from 'next/link';
import { useId, useState } from 'react';
import type { RenderedComment } from '@/lib/community/render';
import { formatDate } from '@/lib/format';
import { REQUEST_STATUS, type RequestStatus } from '@/lib/status';
import { cn } from '@/lib/utils';
import { Icon } from '../icons';
import { Menu, Modal } from '../overlay';
import { useToast } from '../toast';
import { AvatarStack, Pill } from '../ui';
import { useViewer } from '../viewer';
import { Thread } from './thread';

export interface RequestViewProps {
  number: number;
  title: string;
  topic: string;
  topicLabel: string;
  stackLabel: string;
  author: string;
  created: string;
  status: RequestStatus;
  need: number;
  bodyHtml: string;
  comments: RenderedComment[];
  proposals: { number: number; title: string; pill: string; status: string }[];
  participants: string[];
  related: { id: string; label: string; pill: string; status: string }[];
}

/** The ask and the debate (design boards 21 and 22). */
export function RequestView(props: RequestViewProps) {
  const { viewer, requireViewer } = useViewer();
  const toast = useToast();
  const [status, setStatus] = useState(props.status);
  const [needed, setNeeded] = useState(false);
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const need = props.need + (needed ? 1 : 0);
  const pill = REQUEST_STATUS[status];

  const toggleNeed = () =>
    requireViewer('add Need this too', () => {
      setNeeded((value) => !value);
    });

  const needButton = (big: boolean) => (
    <button
      type="button"
      className={cn('btn btn-secondary', big && 'btn-lg flex-1', needed && 'btn-pressed')}
      aria-pressed={needed}
      onClick={toggleNeed}
    >
      <Icon name="arrowUp" />
      {big ? (
        <>Need this too · {need}</>
      ) : (
        <>
          Need this too
          <span className="mono ml-0.5 border-l pl-2 text-[13px]">{need}</span>
        </>
      )}
    </button>
  );

  const maintainer = viewer?.role === 'maintainer';

  return (
    <>
      <div className="mt-2 flex items-start justify-between gap-6 md:mt-4">
        <div className="min-w-0">
          <h1 className="t-h1 text-[32px] leading-10 max-md:text-[26px] max-md:leading-8 max-md:tracking-[-0.02em]">
            {props.title}
          </h1>
          <div className="t-sm mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 max-md:gap-x-1.5">
            <Pill pill={pill.pill} label={pill.label} />
            <span className="tag tag-topic">{props.topicLabel}</span>
            <span className="tag">{props.stackLabel}</span>
            <span className="muted max-md:hidden">
              <Link href={`/people/${props.author}`} className="strong text-fg hover:underline">
                @{props.author}
              </Link>{' '}
              asked on {formatDate(props.created)}
            </span>
          </div>
          <div className="t-sm muted mt-2 md:hidden">
            <span className="strong text-fg">@{props.author}</span> · {formatDate(props.created)}
          </div>
        </div>
        {maintainer && (
          <Menu
            label="Maintainer actions"
            minWidth={220}
            className="max-md:hidden"
            items={[
              {
                label: 'Mark resolved',
                icon: <Icon name="check" />,
                onSelect: () => {
                  setStatus('resolved');
                  toast('Marked resolved');
                },
              },
              {
                label: 'Close as duplicate…',
                icon: <Icon name="copy" />,
                onSelect: () => setDuplicateOpen(true),
              },
              {
                label: status === 'closed' ? 'Reopen' : 'Close',
                icon: <Icon name={status === 'closed' ? 'arrowUp' : 'x'} />,
                danger: status !== 'closed',
                separatorBefore: true,
                onSelect: () => {
                  setStatus(status === 'closed' ? 'open' : 'closed');
                  toast(status === 'closed' ? 'Request reopened' : 'Request closed');
                },
              },
            ]}
            trigger={(triggerProps) => (
              <button type="button" className="btn btn-secondary btn-sm" {...triggerProps}>
                Maintainer
                <Icon name="chevronDown" size="sm" />
              </button>
            )}
          />
        )}
      </div>

      <div className="mt-8 flex flex-wrap gap-14 max-md:mt-5 max-md:gap-0">
        <div className="min-w-0 max-w-[760px] flex-[999_1_560px]">
          <article className="md:rounded-lg md:border md:bg-surface md:px-6 md:py-5">
            <div
              className="md prose max-md:text-base"
              dangerouslySetInnerHTML={{ __html: props.bodyHtml }}
            />
            <div className="mt-5 hidden items-center gap-3 border-t pt-4 md:flex">
              {needButton(false)}
              <span className="t-xs subtle">Ranks requests. Never verifies.</span>
            </div>
            <div className="mt-5 flex gap-2 md:hidden">
              {needButton(true)}
              {maintainer && (
                <Menu
                  label="More"
                  items={[
                    {
                      label: 'Mark resolved',
                      icon: <Icon name="check" />,
                      onSelect: () => {
                        setStatus('resolved');
                        toast('Marked resolved');
                      },
                    },
                    {
                      label: 'Close as duplicate…',
                      icon: <Icon name="copy" />,
                      onSelect: () => setDuplicateOpen(true),
                    },
                  ]}
                  trigger={(triggerProps) => (
                    <button
                      type="button"
                      className="btn btn-secondary btn-lg btn-icon"
                      aria-label="More"
                      {...triggerProps}
                    >
                      <Icon name="more" size="lg" />
                    </button>
                  )}
                />
              )}
            </div>
          </article>

          {/* Phone: proposals panel above the thread */}
          <div className="panel mt-4 flex items-center justify-between gap-3 py-3 pl-4 pr-3 md:hidden">
            <div>
              <div className="t-sm strong">Proposals</div>
              <div className="t-xs subtle">
                {props.proposals.length
                  ? props.proposals.map((p) => `#${p.number}`).join(', ')
                  : 'None yet'}
              </div>
            </div>
            <Link
              href={`/propose?request=${props.number}`}
              className="btn btn-primary btn-lg text-sm"
            >
              Start a proposal
            </Link>
          </div>

          <Thread comments={props.comments} />
        </div>

        <aside className="hidden flex-[1_1_280px] flex-col gap-7 md:flex">
          <div className="box p-4">
            <div className="label mb-2.5">Proposals</div>
            {props.proposals.length === 0 ? (
              <p className="t-sm subtle">None yet.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {props.proposals.map((p) => (
                  <Link
                    key={p.number}
                    href={`/proposals/${p.number}`}
                    className="t-sm flex items-start justify-between gap-2 hover:text-accent-text"
                  >
                    <span>
                      #{p.number} {p.title}
                    </span>
                    <Pill pill={p.pill} label={p.status} />
                  </Link>
                ))}
              </div>
            )}
            <Link href={`/propose?request=${props.number}`} className="btn btn-primary mt-3 w-full">
              Start a proposal
            </Link>
          </div>
          <div>
            <div className="label mb-2.5">Need this too</div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-semibold">{need}</span>
              <span className="t-sm subtle">people</span>
            </div>
          </div>
          <div>
            <div className="label mb-2.5">Participants</div>
            <div className="flex items-center gap-2">
              <AvatarStack handles={props.participants} link />
              <span className="t-sm subtle">{props.participants.length}</span>
            </div>
          </div>
          {props.related.length > 0 && (
            <div>
              <div className="label mb-2.5">Related</div>
              <div className="flex flex-col gap-2">
                {props.related.map((card) => (
                  <Link
                    key={card.id}
                    href={`/${card.id}`}
                    className="t-sm flex justify-between gap-2 hover:text-accent-text"
                  >
                    <span>{card.label}</span>
                    <Pill pill={card.pill} label={card.status} />
                  </Link>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>

      <DuplicateDialog
        open={duplicateOpen}
        number={props.number}
        onClose={() => setDuplicateOpen(false)}
        onConfirm={(of) => {
          setDuplicateOpen(false);
          setStatus('closed');
          toast(`Closed as duplicate of #${of}`);
        }}
      />
    </>
  );
}

function DuplicateDialog({
  open,
  number,
  onClose,
  onConfirm,
}: {
  open: boolean;
  number: number;
  onClose: () => void;
  onConfirm: (of: number) => void;
}) {
  const [value, setValue] = useState('');
  const titleId = useId();
  const inputId = useId();
  const target = Number(value.replace('#', ''));
  const valid = Number.isInteger(target) && target > 0 && target !== number;
  return (
    <Modal open={open} onClose={onClose} labelledBy={titleId} className="max-w-[420px]">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (valid) onConfirm(target);
        }}
      >
        <div className="px-6 pt-5">
          <h2 id={titleId} className="t-h3">
            Close as duplicate
          </h2>
          <label htmlFor={inputId} className="field-label mt-4">
            Duplicate of
          </label>
          <input
            id={inputId}
            className="input"
            placeholder="#38"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            inputMode="numeric"
          />
        </div>
        <div className="mt-5 flex justify-end gap-2 border-t px-6 py-4">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={!valid}>
            Close request
          </button>
        </div>
      </form>
    </Modal>
  );
}
