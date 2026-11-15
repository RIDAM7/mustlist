import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon, type IconName } from '@/components/icons';
import { LIBRARY_URL, SITE_NAME } from '@/lib/site';
import { cn } from '@/lib/utils';

export const metadata: Metadata = {
  title: { absolute: `How it works | ${SITE_NAME}` },
  description: 'From a missing card to a verified one: request, proposal, checks, review, accept.',
  alternates: { canonical: `${LIBRARY_URL}/how-it-works` },
};

const NODES = [
  {
    num: '1',
    name: 'Request',
    line: 'Discussion · Need this too',
    pill: 'p-accent',
    label: 'Open',
  },
  {
    num: '2',
    name: 'Proposal',
    line: 'The card, written in a form',
    pill: 'p-accent',
    label: 'In review',
  },
  {
    num: '3',
    name: 'Checks',
    line: 'Format · Safety · Links',
    pill: 'p-success',
    label: 'Passing',
  },
  {
    num: '4',
    name: 'Review',
    line: 'Approve · Request changes · Comment',
    pill: 'p-success',
    label: 'Approved',
  },
  {
    num: '5',
    name: 'Accept',
    line: '2 approvals, 1 from a maintainer',
    pill: 'p-solid',
    label: 'Accepted',
  },
  {
    num: 'Result',
    name: 'Verified card',
    line: 'Served to agents',
    pill: 'p-success',
    label: 'Verified',
  },
];

const RULES: { icon: IconName; title: string; sub: string }[] = [
  { icon: 'arrowUp', title: 'Votes never verify', sub: 'Need this too only ranks requests.' },
  {
    icon: 'file',
    title: 'Card text is reference material',
    sub: 'Data for agents, never instructions. Checks block agent-directed text.',
  },
  {
    icon: 'checkCircle',
    title: 'Only verified cards reach agents',
    sub: 'Drafts and proposals stay on the site.',
  },
  {
    icon: 'clock',
    title: 'Cards expire',
    sub: 'After 180 days, or a new major version, a card is re-checked.',
  },
];

const STATUSES: { label: string; pills: [string, string][] }[] = [
  {
    label: 'Request',
    pills: [
      ['p-accent', 'Open'],
      ['p-warning', 'In progress'],
      ['p-success', 'Resolved'],
      ['p-neutral', 'Closed'],
    ],
  },
  {
    label: 'Proposal',
    pills: [
      ['p-outline', 'Draft'],
      ['p-accent', 'In review'],
      ['p-warning', 'Changes requested'],
      ['p-success', 'Approved'],
      ['p-solid', 'Accepted'],
      ['p-neutral', 'Closed'],
    ],
  },
  {
    label: 'Card',
    pills: [
      ['p-success', 'Verified'],
      ['p-warning', 'Being re-checked'],
      ['p-outline', 'Draft'],
      ['p-accent', 'Proposed'],
    ],
  },
  {
    label: 'Checks',
    pills: [
      ['p-success', 'Passing'],
      ['p-danger', 'Failing'],
      ['p-accent p-running', 'Running'],
    ],
  },
];

/** The five-step flow and the rules (design board 37). */
export default function HowItWorksPage() {
  return (
    <div className="wrap pb-24 pt-10 md:pt-14">
      <h1 className="t-h1 max-md:text-[30px] max-md:leading-9">How it works</h1>
      <p className="t-lead muted mt-2 max-md:text-base">From a missing card to a verified one.</p>

      {/* Desktop diagram: the six steps share the width, no scrolling. */}
      <div
        className="mt-12 hidden pb-4 lg:block"
        role="img"
        aria-label="Request, then Proposal, Checks, Review and Accept give a Verified card. Changes requested go back to the proposal; old cards come back as re-checks."
      >
        <div className="grid grid-cols-[repeat(5,minmax(0,1fr)_28px)_minmax(0,1fr)]">
          {NODES.map((node, i) => (
            <div key={node.name} className="contents">
              <div
                className={cn(
                  'box flex min-h-[132px] flex-col gap-1.5 p-4',
                  i === NODES.length - 1 && 'opt-rec bg-accent-soft',
                )}
              >
                <span
                  className={cn(
                    'mono t-xs',
                    i === NODES.length - 1 ? 'text-accent-text' : 'subtle',
                  )}
                >
                  {node.num}
                </span>
                <span className="text-base font-semibold">{node.name}</span>
                <span className="t-sm muted">{node.line}</span>
                <span className="mt-auto">
                  <span className={cn('pill', node.pill)}>{node.label}</span>
                </span>
              </div>
              {i < NODES.length - 1 && (
                <div className="flex items-center justify-center text-fg-subtle" aria-hidden="true">
                  <Icon name="arrowRight" />
                </div>
              )}
            </div>
          ))}
          <div className="relative col-[3/8] mx-20 h-10 rounded-b-lg border-[1.5px] border-t-0 border-dashed border-warning">
            <Icon name="caretUp" size="sm" className="absolute -left-2 -top-1.5 text-warning" />
            <span className="t-xs absolute -bottom-2.5 left-1/2 -translate-x-1/2 bg-bg px-2 font-medium text-warning">
              Changes requested
            </span>
          </div>
          <div className="relative col-[1/12] mx-20 mt-6 h-10 rounded-b-lg border-[1.5px] border-t-0 border-dashed border-border-strong">
            <Icon name="caretUp" size="sm" className="absolute -left-2 -top-1.5 text-fg-subtle" />
            <span className="t-xs subtle absolute -bottom-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap bg-bg px-2">
              Re-check · older than 180 days, or a new major version
            </span>
          </div>
        </div>
      </div>

      {/* Phone and tablet: vertical steps */}
      <ol className="mt-8 flex flex-col lg:hidden">
        {NODES.map((node, i) => (
          <li key={node.name} className="grid grid-cols-[24px_minmax(0,1fr)] gap-3.5">
            <span className="flex flex-col items-center">
              <span className={cn('step-dot', i === NODES.length - 1 ? 'step-cur' : 'step-done')}>
                {i === NODES.length - 1 ? <Icon name="check" size="sm" /> : node.num}
              </span>
              {i < NODES.length - 1 && <span className="min-h-5 w-px flex-1 bg-border" />}
            </span>
            <div className="pb-5">
              <div className="flex items-center gap-2">
                <span className="font-semibold">{node.name}</span>
                <span className={cn('pill', node.pill)}>{node.label}</span>
              </div>
              <p className="t-sm muted mt-0.5">{node.line}</p>
            </div>
          </li>
        ))}
        <li className="t-xs subtle mt-1 border-t pt-3">
          <span className="font-medium text-warning">Changes requested</span> go back to the
          proposal. Re-check after 180 days, or a new major version.
        </li>
      </ol>

      <div className="mt-[72px] flex flex-wrap gap-x-8 gap-y-10 max-md:mt-12">
        <section className="min-w-0 flex-[1_1_420px]">
          <h2 className="sec-h mb-3.5">Rules</h2>
          <ul className="rows">
            {RULES.map((rule) => (
              <li key={rule.title} className="row items-start gap-3 py-3.5">
                <span className="flex size-7 flex-none items-center justify-center rounded-lg bg-bg-muted text-fg-muted">
                  <Icon name={rule.icon} size="sm" />
                </span>
                <div className="min-w-0">
                  <div className="row-title">{rule.title}</div>
                  <div className="t-sm muted">{rule.sub}</div>
                </div>
              </li>
            ))}
          </ul>
        </section>
        <section className="min-w-0 flex-[1_1_420px]">
          <h2 className="sec-h mb-3.5">Statuses</h2>
          <dl className="rows m-0">
            {STATUSES.map((row) => (
              <div
                key={row.label}
                className="row grid grid-cols-[80px_minmax(0,1fr)] items-start gap-3 py-3"
              >
                <dt className="t-sm subtle">{row.label}</dt>
                <dd className="m-0 flex flex-wrap gap-1.5">
                  {row.pills.map(([pill, label]) => (
                    <span key={label} className={cn('pill', pill)}>
                      {label}
                    </span>
                  ))}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      </div>

      <div className="panel mt-14 flex items-center gap-4 px-6 py-5 max-md:flex-col max-md:items-stretch">
        <span className="flex-1 text-[15px] font-medium">Missing a card?</span>
        <Link href="/requests/new" className="btn btn-primary">
          Start a request
        </Link>
      </div>
    </div>
  );
}
