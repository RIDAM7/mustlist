'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Icon } from '@/components/icons';
import { Menu } from '@/components/overlay';
import { useCopy, useToast } from '@/components/toast';
import { Pill, SampleBanner } from '@/components/ui';
import { openOnGitHub, useViewer } from '@/components/viewer';
import { githubLinks } from '@/lib/community/links';
import { stackName, topicName } from '@/lib/topics';
import { cn } from '@/lib/utils';
import { type CheckReport, type Problem, SECTIONS, type Section, runChecks } from './checks';
import { serializeCard, type Draft } from './draft';
import { SectionPreview } from './preview';
import {
  BasicsEditor,
  BasicsSummary,
  ChecklistEditor,
  DecisionsEditor,
  LensesEditor,
  OptionsEditor,
  type SetDraft,
  SourcesEditor,
  VerifyEditor,
  VersionsEditor,
} from './sections';
import { SubmitDialog } from './submit-dialog';

/**
 * The propose editor (design board 31): a form, never raw markdown. One section
 * at a time, live checks on the right, autosave to this browser, and a submit
 * dialog (board 32). Build step C turns "Submit for review" into a pull request.
 */

export interface EditorProps {
  initial: Draft;
  /** localStorage key for this draft. */
  storageKey: string;
  mode: 'new' | 'change';
  /** For changes: the card's current title. */
  cardTitle?: string;
}

const DOT: Record<'ok' | 'warn' | 'err', string> = {
  ok: 'var(--success)',
  warn: 'var(--warning)',
  err: 'var(--danger)',
};

const MAX_WIDTH = { maxWidth: 1376 };
const noop = () => () => {};

interface Stored {
  v: 1;
  draft: Draft;
  savedAt: string;
}

function readStored(key: string): Stored | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<Stored>;
    if (value.v !== 1 || !value.draft || !Array.isArray(value.draft.checklist)) return null;
    return value as Stored;
  } catch {
    return null;
  }
}

const timeOf = (date: Date) =>
  date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

/** Renders the editor only in the browser, where the saved draft can be read. */
export function ProposeEditor(props: EditorProps) {
  const hydrated = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
  if (!hydrated) return <EditorSkeleton />;
  return <Editor {...props} />;
}

export function EditorSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading editor">
      <div className="border-b">
        <div className="wrap flex min-h-16 items-center gap-4" style={MAX_WIDTH}>
          <div className="flex-1">
            <div className="sk h-3 w-48" />
            <div className="sk mt-2 h-4 w-72" />
          </div>
          <div className="sk h-9 w-36" />
        </div>
      </div>
      <div
        className="wrap grid gap-8 pt-6 lg:grid-cols-[220px_minmax(0,1fr)_300px]"
        style={MAX_WIDTH}
      >
        <div className="hidden flex-col gap-2 lg:flex">
          {SECTIONS.map((s) => (
            <div key={s} className="sk h-8" />
          ))}
        </div>
        <div className="flex flex-col gap-3">
          <div className="sk h-16 rounded-lg" />
          <div className="sk h-32 rounded-lg" />
          <div className="sk h-32 rounded-lg" />
        </div>
        <div className="sk h-48 rounded-lg" />
      </div>
    </div>
  );
}

function Editor({ initial, storageKey, mode, cardTitle }: EditorProps) {
  const router = useRouter();
  const toast = useToast();
  const copy = useCopy();
  const { mode: source, requireViewer } = useViewer();
  const [stored] = useState(() => readStored(storageKey));
  const [draft, setDraftState] = useState<Draft>(() => stored?.draft ?? initial);
  const [savedAt, setSavedAt] = useState<{ at: Date; restored: boolean } | null>(() =>
    stored ? { at: new Date(stored.savedAt), restored: true } : null,
  );
  const [section, setSection] = useState<Section>(
    mode === 'new' && !initial.topic ? 'Basics' : 'Checklist',
  );
  const [view, setView] = useState<'edit' | 'preview'>('edit');
  const [submitting, setSubmitting] = useState(false);
  const mainRef = useRef<HTMLDivElement>(null);
  const pendingFocus = useRef<string | null>(null);
  const touched = useRef(false);

  const setDraft: SetDraft = (update) => {
    touched.current = true;
    setDraftState(update);
  };

  const report = useMemo(() => runChecks(draft), [draft]);

  // Autosave half a second after the last change.
  useEffect(() => {
    if (!touched.current) return;
    const timer = setTimeout(() => {
      const at = new Date();
      try {
        localStorage.setItem(
          storageKey,
          JSON.stringify({ v: 1, draft, savedAt: at.toISOString() } satisfies Stored),
        );
        setSavedAt({ at, restored: false });
      } catch {
        // Storage is full or blocked: the draft lives in this tab only.
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [draft, storageKey]);

  // Focus the field a problem points at, once its section is on screen.
  useEffect(() => {
    const id = pendingFocus.current;
    if (!id) return;
    pendingFocus.current = null;
    requestAnimationFrame(() => {
      const element = document.getElementById(id);
      element?.scrollIntoView({ block: 'center' });
      element?.focus({ preventScroll: true });
    });
  }, [section, view]);

  function open(next: Section) {
    setSection(next);
    const top = mainRef.current?.getBoundingClientRect().top ?? 0;
    if (top < 0) mainRef.current?.scrollIntoView({ block: 'start' });
  }

  function go(problem: Problem) {
    pendingFocus.current = problem.field ?? null;
    setView('edit');
    if (problem.section === section && view === 'edit' && problem.field) {
      const element = document.getElementById(problem.field);
      element?.scrollIntoView({ block: 'center' });
      element?.focus({ preventScroll: true });
      pendingFocus.current = null;
      return;
    }
    setSection(problem.section);
  }

  const topicLabel = draft.topic ? topicName(draft.topic) : 'New card';
  const stackLabel = draft.stack ? stackName(draft.stack) : 'stack';
  const heading = `${mode === 'new' ? 'New card' : 'Change'}: ${topicLabel} · ${stackLabel}`;
  const hasErrors = report.errors > 0;

  function submit() {
    setSubmitting(false);
    if (source === 'github') {
      // Proposals are pull requests: copy the card file, then open GitHub's editor for it.
      void copy(serializeCard(draft), 'Copied · paste the card on GitHub');
      openOnGitHub(
        draft.cardId
          ? githubLinks.editCardFile(draft.cardId)
          : githubLinks.newCardFile(draft.topic),
      );
      return;
    }
    requireViewer('submit a proposal', () => {
      toast('Proposal opened');
      router.push('/proposals');
    });
  }

  return (
    <>
      {/* Sub-header */}
      <div className="sticky top-0 z-20 border-b bg-bg">
        <div
          className="wrap flex min-h-16 flex-wrap items-center gap-x-4 gap-y-2 py-2"
          style={MAX_WIDTH}
        >
          <div className="min-w-0 flex-1 basis-60">
            <div className="crumbs">
              <Link href="/proposals">Proposals</Link>
              <span aria-hidden="true">/</span>
              <span>{mode === 'new' ? 'New card' : 'Change'}</span>
              {draft.request !== null && (
                <>
                  <span aria-hidden="true">·</span>
                  <Link href={`/requests/${draft.request}`} className="link">
                    from request #{draft.request}
                  </Link>
                </>
              )}
              {mode === 'change' && draft.cardId && (
                <>
                  <span aria-hidden="true">·</span>
                  <Link href={`/${draft.cardId}`} className="link">
                    {cardTitle ?? draft.cardId}
                  </Link>
                </>
              )}
            </div>
            <div className="mt-0.5 flex items-center gap-2.5">
              <span className="truncate text-base font-semibold">
                {topicLabel} · {stackLabel}
              </span>
              <Pill pill="p-outline" label="Draft" />
            </div>
          </div>
          <span className="t-sm subtle inline-flex items-center gap-1.5" role="status">
            {savedAt ? (
              <>
                <Icon name="check" size="sm" className="ok" />
                {savedAt.restored ? 'Restored' : 'Saved'} · {timeOf(savedAt.at)}
              </>
            ) : (
              'Not saved yet'
            )}
          </span>
          <div className="seg" role="tablist" aria-label="Mode">
            <button
              type="button"
              role="tab"
              aria-selected={view === 'edit'}
              className={cn('seg-b', view === 'edit' && 'seg-on')}
              onClick={() => setView('edit')}
            >
              Edit
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={view === 'preview'}
              className={cn('seg-b', view === 'preview' && 'seg-on')}
              onClick={() => setView('preview')}
            >
              <Icon name="eye" size="sm" />
              Preview
            </button>
          </div>
          <button
            type="button"
            className={cn('btn btn-primary', hasErrors && 'btn-disabled')}
            aria-disabled={hasErrors}
            onClick={() => {
              if (!hasErrors) setSubmitting(true);
            }}
          >
            Submit for review
          </button>
        </div>
      </div>

      {source === 'sample' && (
        <div className="wrap pt-4" style={MAX_WIDTH}>
          <SampleBanner />
        </div>
      )}

      <div
        className="wrap grid gap-8 pb-24 pt-6 lg:grid-cols-[200px_minmax(0,1fr)_280px] xl:grid-cols-[220px_minmax(0,760px)_320px] xl:justify-between"
        style={MAX_WIDTH}
      >
        {/* Section nav (desktop) */}
        <nav aria-label="Card sections" className="hidden lg:block">
          <div className="sticky top-[88px] flex flex-col gap-0.5">
            {SECTIONS.map((s) => (
              <button
                key={s}
                type="button"
                className={cn('side', s === section && 'side-on')}
                aria-current={s === section ? 'step' : undefined}
                onClick={() => open(s)}
              >
                <span className="flex items-center gap-2">
                  <span className="dot" style={{ background: DOT[report.status[s]] }} />
                  {s}
                </span>
                <span className="mono t-xs subtle">{report.counts[s]}</span>
              </button>
            ))}
          </div>
        </nav>

        <div ref={mainRef} className="min-w-0 scroll-mt-24">
          {/* Section picker (phone and tablet) */}
          <div className="mb-4 lg:hidden">
            <Menu
              label="Card sections"
              align="left"
              className="w-full"
              minWidth={240}
              items={SECTIONS.map((s) => ({
                label: report.counts[s] ? `${s} · ${report.counts[s]}` : s,
                selected: s === section,
                icon: <span className="dot" style={{ background: DOT[report.status[s]] }} />,
                onSelect: () => open(s),
              }))}
              trigger={(props) => (
                <button type="button" className="select h-11 w-full justify-between" {...props}>
                  <span className="flex items-center gap-2">
                    <span className="dot" style={{ background: DOT[report.status[section]] }} />
                    <span className="k">Section</span> {section}
                  </span>
                  <Icon name="chevronDown" size="sm" />
                </button>
              )}
            />
          </div>

          {view === 'edit' && section === 'Basics' ? (
            <BasicsEditor draft={draft} set={setDraft} locked={mode === 'change'} />
          ) : (
            <BasicsSummary
              draft={draft}
              onEdit={() => {
                setView('edit');
                open('Basics');
              }}
            />
          )}

          {view === 'edit' ? (
            section !== 'Basics' && (
              <div className="mt-8">
                <SectionEditor section={section} draft={draft} set={setDraft} />
              </div>
            )
          ) : (
            <section className="mt-8" aria-label={`${section} preview`}>
              <div className="panel t-sm subtle mb-5 px-3 py-2">
                Preview · as reviewers and agents will see it
              </div>
              <SectionPreview section={section} draft={draft} />
            </section>
          )}
        </div>

        <aside>
          <ChecksPanel report={report} onGo={go} />
        </aside>
      </div>

      <SubmitDialog
        open={submitting}
        draft={draft}
        heading={heading}
        report={report}
        onClose={() => setSubmitting(false)}
        onSubmit={submit}
      />
    </>
  );
}

function SectionEditor({ section, draft, set }: { section: Section; draft: Draft; set: SetDraft }) {
  switch (section) {
    case 'Checklist':
      return <ChecklistEditor draft={draft} set={set} />;
    case 'Decisions':
      return <DecisionsEditor draft={draft} set={set} />;
    case 'Options':
      return <OptionsEditor draft={draft} set={set} />;
    case 'Lenses':
      return <LensesEditor draft={draft} set={set} />;
    case 'Versions':
      return <VersionsEditor draft={draft} set={set} />;
    case 'Verify':
      return <VerifyEditor draft={draft} set={set} />;
    case 'Sources':
      return <SourcesEditor draft={draft} set={set} />;
    default:
      return null;
  }
}

const VISIBLE_PROBLEMS = 6;

function ChecksPanel({ report, onGo }: { report: CheckReport; onGo: (problem: Problem) => void }) {
  const [showAll, setShowAll] = useState(false);
  const order = (p: Problem) => SECTIONS.indexOf(p.section) * 2 + (p.level === 'err' ? 0 : 1);
  const problems = [...report.problems].sort((a, b) => order(a) - order(b));
  const visible = showAll ? problems : problems.slice(0, VISIBLE_PROBLEMS);
  const failing = report.errors > 0;

  const row = (label: string, state: { ok: boolean; note: string }, idle = false) => (
    <li className="flex items-center gap-2">
      {idle ? (
        <span className="dot mx-[3px]" />
      ) : state.ok ? (
        <Icon name="checkCircle" size="sm" className="ok" />
      ) : (
        <Icon name="xCircle" size="sm" className="bad" />
      )}
      <span className="flex-1">{label}</span>
      <span className="t-xs subtle">{state.note}</span>
    </li>
  );

  return (
    <section className="box lg:sticky lg:top-[88px]" aria-labelledby="live-checks">
      <div className="box-h">
        <h2 id="live-checks" className="t-sm strong">
          Checks
        </h2>
        <Pill pill={failing ? 'p-danger' : 'p-success'} label={failing ? 'Failing' : 'Passing'} />
      </div>
      {problems.length > 0 && (
        <ul className="p-1.5">
          {visible.map((problem, index) => (
            <li key={`${problem.section}-${problem.where}-${problem.what}-${index}`}>
              <button
                type="button"
                className="menu-item h-auto min-h-11 items-start px-2.5 py-2"
                onClick={() => onGo(problem)}
              >
                <Icon
                  name={problem.level === 'err' ? 'xCircle' : 'alertCircle'}
                  className={cn('mt-0.5', problem.level === 'err' ? 'bad' : 'warn')}
                />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="t-sm font-medium">{problem.where}</span>
                  <span className="t-xs subtle">{problem.what}</span>
                </span>
                <Icon name="chevronRight" size="sm" className="subtle mt-[3px]" />
              </button>
            </li>
          ))}
          {problems.length > VISIBLE_PROBLEMS && (
            <li>
              <button
                type="button"
                className="btn btn-ghost btn-sm w-full"
                onClick={() => setShowAll(!showAll)}
              >
                {showAll ? 'Show fewer' : `Show ${problems.length - VISIBLE_PROBLEMS} more`}
              </button>
            </li>
          )}
        </ul>
      )}
      <ul className="t-sm flex flex-col gap-2 border-t px-4 pb-3 pt-2">
        {row('Format', report.format)}
        {row('Safety', report.safety)}
        {row(
          'Links',
          { ok: report.links.ok, note: report.links.note },
          report.links.total === 0 && report.links.ok,
        )}
      </ul>
    </section>
  );
}
