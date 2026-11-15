'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useId, useMemo, useState } from 'react';
import { stackTitle } from '@mustlist/schema/site';
import { githubLinks } from '@/lib/community/links';
import { STACK_CHOICES, techName, topicName } from '@/lib/topics';
import { cn } from '@/lib/utils';
import { Icon } from '../icons';
import { useCopy, useToast } from '../toast';
import { openOnGitHub, useViewer } from '../viewer';

export interface DuplicateSource {
  kind: 'card' | 'request';
  key: string;
  topic: string;
  stack: string;
  title: string;
  meta: string;
  pill: string;
  status: string;
  href: string;
  number?: number;
}

const WHAT_MAX = 600;

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

function StepDot({ state, n }: { state: 'done' | 'cur' | 'todo'; n: number }) {
  return (
    <span
      className={cn('step-dot', state === 'done' && 'step-done', state === 'cur' && 'step-cur')}
    >
      {state === 'done' ? (
        <svg className="i i-sm" viewBox="0 0 24 24" aria-hidden="true">
          <path d="m5 12 4.5 4.5L19 7" />
        </svg>
      ) : (
        n
      )}
    </span>
  );
}

/** Ask for a card in 3 steps, with live possible duplicates (design board 23). */
export function NewRequestForm({
  topics,
  sources,
}: {
  topics: string[];
  sources: DuplicateSource[];
}) {
  const params = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const { mode, requireViewer } = useViewer();
  const copy = useCopy();
  const topicId = useId();
  const whatId = useId();

  const initialStack = (params.get('stack') ?? '').split('-').filter(Boolean);
  const [topic, setTopic] = useState(() => {
    const slug = params.get('topic');
    return slug ? topicName(slug) : '';
  });
  const [stack, setStack] = useState<string[]>(initialStack);
  const [extra, setExtra] = useState<Record<string, string[]>>(() => {
    const known = new Set(STACK_CHOICES.flatMap((g) => g.items));
    const unknown = initialStack.filter((slug) => !known.has(slug));
    const initial: Record<string, string[]> = {};
    if (unknown.length) initial.Framework = unknown;
    return initial;
  });
  const [adding, setAdding] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [what, setWhat] = useState('');

  const topicSlug = slugify(topic);
  const order = STACK_CHOICES.flatMap((g) => [...g.items, ...(extra[g.label] ?? [])]);
  const stackSlug = order.filter((slug) => stack.includes(slug)).join('-');
  const step = !topicSlug ? 1 : stack.length === 0 ? 2 : 3;

  const duplicates = useMemo(() => {
    if (!topicSlug) return [];
    return sources
      .filter((s) => s.topic === topicSlug)
      .map((s) => {
        const parts = s.stack.split('-');
        const overlap = parts.filter((p) => stack.includes(p)).length;
        return {
          s,
          score: (s.stack === stackSlug ? 10 : 0) + overlap + (s.kind === 'request' ? 0.5 : 0),
        };
      })
      .filter(({ score }) => stack.length === 0 || score >= 1)
      .sort((a, b) => b.score - a.score)
      .map(({ s }) => s)
      .slice(0, 4);
  }, [sources, topicSlug, stack, stackSlug]);
  const topRequest = duplicates.find((d) => d.kind === 'request');

  const toggle = (slug: string) =>
    setStack((current) =>
      current.includes(slug) ? current.filter((s) => s !== slug) : [...current, slug],
    );

  const submit = () => {
    if (step < 3 || !what.trim() || what.length > WHAT_MAX) return;
    if (mode === 'github') {
      // Requests are GitHub Discussions: copy the answers, then open the request form there.
      const title = `${topicName(topicSlug)} · ${stackTitle(stackSlug)}`;
      const text = `${title}

Topic: ${topicSlug}
Stack: ${stackSlug}

${what.trim()}
`;
      void copy(text, 'Copied · paste it into the request on GitHub');
      openOnGitHub(githubLinks.newRequest);
      return;
    }
    requireViewer('request a card', () => {
      toast('Request #52 created');
      router.push('/requests');
    });
  };

  return (
    <div className="mt-8 flex flex-wrap gap-14 max-md:mt-6 max-md:gap-8">
      <form
        className="min-w-0 max-w-[720px] flex-[999_1_560px]"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <ol>
          <li className="grid grid-cols-[24px_minmax(0,1fr)] gap-4 pb-8">
            <span className="flex flex-col items-center">
              <StepDot state={topicSlug ? 'done' : 'cur'} n={1} />
              <span className="mt-1.5 w-px flex-1 bg-border" />
            </span>
            <div>
              <label htmlFor={topicId} className="block text-base font-semibold leading-6">
                Topic
              </label>
              <div className="relative mt-3">
                <input
                  id={topicId}
                  className="input h-10 pr-40"
                  value={topic}
                  placeholder="Auth, Background jobs, Search…"
                  onChange={(event) => setTopic(event.target.value)}
                />
                {topicSlug && (
                  <span className="mono subtle absolute right-3 top-[11px] text-xs">
                    {topicSlug}
                  </span>
                )}
              </div>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {topics.map((slug) => {
                  const on = slug === topicSlug;
                  return (
                    <button
                      key={slug}
                      type="button"
                      aria-pressed={on}
                      className={cn(
                        'tag h-7 cursor-pointer max-md:h-9',
                        on && 'tag-topic shadow-[inset_0_0_0_1px_var(--fg)]',
                      )}
                      onClick={() => setTopic(topicName(slug))}
                    >
                      {topicName(slug)}
                    </button>
                  );
                })}
              </div>
            </div>
          </li>

          <li className="grid grid-cols-[24px_minmax(0,1fr)] gap-4 pb-8">
            <span className="flex flex-col items-center">
              <StepDot state={stack.length ? 'done' : step === 2 ? 'cur' : 'todo'} n={2} />
              <span className="mt-1.5 w-px flex-1 bg-border" />
            </span>
            <div>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-base font-semibold leading-6">Stack</span>
                <span className="mono t-xs subtle truncate">
                  {topicSlug || '…'}/{stackSlug || '…'}
                </span>
              </div>
              <div className="mt-3 flex flex-col gap-3.5">
                {STACK_CHOICES.map((group) => (
                  <fieldset
                    key={group.label}
                    className="m-0 grid grid-cols-[96px_minmax(0,1fr)] items-start gap-3 border-0 p-0 max-md:grid-cols-1 max-md:gap-1.5"
                  >
                    <legend className="t-sm subtle float-left p-0 leading-8">{group.label}</legend>
                    <div className="flex flex-wrap gap-1.5">
                      {[...group.items, ...(extra[group.label] ?? [])].map((slug) => {
                        const on = stack.includes(slug);
                        return (
                          <button
                            key={slug}
                            type="button"
                            aria-pressed={on}
                            className={cn(
                              'btn btn-sm h-8 max-md:h-10',
                              on ? 'btn-pressed' : 'btn-secondary',
                            )}
                            onClick={() => toggle(slug)}
                          >
                            {techName(slug)}
                          </button>
                        );
                      })}
                      {adding === group.label ? (
                        <input
                          autoFocus
                          className="input h-8 w-32 text-[13px]"
                          aria-label={`Other ${group.label.toLowerCase()}`}
                          placeholder="e.g. remix"
                          value={draft}
                          onChange={(event) => setDraft(event.target.value)}
                          onBlur={() => setAdding(null)}
                          onKeyDown={(event) => {
                            if (event.key === 'Escape') setAdding(null);
                            if (event.key === 'Enter') {
                              event.preventDefault();
                              const slug = slugify(draft).replace(/-/g, '');
                              if (slug) {
                                setExtra({
                                  ...extra,
                                  [group.label]: [...(extra[group.label] ?? []), slug],
                                });
                                setStack((s) => [...s, slug]);
                              }
                              setDraft('');
                              setAdding(null);
                            }
                          }}
                        />
                      ) : (
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm h-8 max-md:h-10"
                          onClick={() => setAdding(group.label)}
                        >
                          <Icon name="plus" size="sm" />
                          Other
                        </button>
                      )}
                    </div>
                  </fieldset>
                ))}
              </div>
            </div>
          </li>

          <li className="grid grid-cols-[24px_minmax(0,1fr)] gap-4">
            <StepDot
              state={what.trim() && step === 3 ? 'done' : step === 3 ? 'cur' : 'todo'}
              n={3}
            />
            <div>
              <label htmlFor={whatId} className="block text-base font-semibold leading-6">
                What are you building?
              </label>
              <textarea
                id={whatId}
                className={cn('input mt-3', what.length > WHAT_MAX && 'input-err')}
                rows={4}
                value={what}
                placeholder="App type, how it is deployed, what you need first."
                onChange={(event) => setWhat(event.target.value)}
              />
              <div className="mt-1.5 flex justify-between">
                <span className="hint">Shown to proposers. No secrets.</span>
                <span
                  className={cn(
                    'counter',
                    what.length > WHAT_MAX
                      ? 'counter-err'
                      : what.length >= WHAT_MAX * 0.9 && 'counter-warn',
                  )}
                >
                  {what.length} / {WHAT_MAX}
                </span>
              </div>
            </div>
          </li>
        </ol>
        <div className="mt-8 flex justify-end gap-2 border-t pt-5">
          <Link href="/requests" className="btn btn-ghost">
            Cancel
          </Link>
          <button
            type="submit"
            className="btn btn-primary"
            aria-disabled={step < 3 || !what.trim() || what.length > WHAT_MAX}
          >
            {mode === 'github' ? (
              <>
                Submit on GitHub
                <Icon name="external" size="sm" />
              </>
            ) : (
              'Submit request'
            )}
          </button>
        </div>
      </form>

      <aside className="flex-[1_1_320px]">
        <div className="box sticky top-6">
          <div className="box-h">
            <span className="t-sm strong">Possible duplicates</span>
            <span className="count">{duplicates.length}</span>
          </div>
          <div className="p-2" aria-live="polite">
            {duplicates.length === 0 ? (
              <p className="t-sm subtle px-2.5 py-3">
                {topicSlug ? 'None found.' : 'Pick a topic to check.'}
              </p>
            ) : (
              duplicates.map((d) => (
                <Link key={d.key} href={d.href} className="tile block rounded-md border-0 p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="t-xs subtle">
                      {d.kind === 'card' ? 'Card' : `Request #${d.number}`}
                    </span>
                    <span className={cn('pill', d.pill)}>{d.status}</span>
                  </div>
                  <div className="mt-1 text-sm font-medium">{d.title}</div>
                  <div className="t-xs subtle mt-0.5">{d.meta}</div>
                </Link>
              ))
            )}
          </div>
          {topRequest && (
            <div className="border-t px-4 pb-4 pt-3">
              <Link href={topRequest.href} className="btn btn-secondary w-full">
                <Icon name="arrowUp" />
                Need #{topRequest.number} too instead
              </Link>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
