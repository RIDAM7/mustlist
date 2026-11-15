'use client';

import { Icon } from '@/components/icons';
import { useToast } from '@/components/toast';
import { Mark } from '@/components/mark';
import { Avatar, Pill } from '@/components/ui';
import { useViewer } from '@/components/viewer';
import { formatDateTime } from '@/lib/format';
import { getPerson, roleLabel } from '@/lib/community';
import { CHECKS_STATE } from '@/lib/status';
import { topicName } from '@/lib/topics';
import { cn } from '@/lib/utils';
import { ApprovalBar, ChecksGlyph } from './bits';
import { useProposalState } from './proposal-state';

/* ── Checks ─────────────────────────────────────────────── */

export function ChecksBox() {
  const { proposal } = useProposalState();
  const overall = CHECKS_STATE[proposal.checks];
  return (
    <section className="box" aria-labelledby="ck-h">
      <div className="box-h">
        <h2 id="ck-h" className="t-sm strong">
          Checks
        </h2>
        <Pill pill={overall.pill} label={overall.label} />
      </div>
      <ul className="py-1">
        {proposal.checkRuns.map((run) => (
          <li
            key={run.name}
            className="grid grid-cols-[16px_minmax(0,1fr)_auto] items-start gap-2.5 px-4 py-2.5"
          >
            <ChecksGlyph state={run.state} className={cn('mt-0.5', CHECKS_STATE[run.state].tone)} />
            <div>
              <div className="t-sm font-medium">{run.name}</div>
              <div className="t-xs subtle">{run.note}</div>
            </div>
            <span className="t-xs subtle">
              {run.seconds !== undefined ? `${run.seconds}s` : ''}
            </span>
          </li>
        ))}
      </ul>
      <div className="t-xs subtle border-t px-4 py-2.5">
        Revision {proposal.revisions} · {formatDateTime(proposal.checkedAt)}
      </div>
    </section>
  );
}

/* ── Approvals ──────────────────────────────────────────── */

export function ApprovalsBox() {
  const { approvals, approvedCount, people } = useProposalState();
  return (
    <section className="box" aria-labelledby="ap-h">
      <div className="box-h">
        <h2 id="ap-h" className="t-sm strong">
          Approvals
        </h2>
        <span className="t-sm">{approvedCount} of 2</span>
      </div>
      <div className="px-4 pb-1.5 pt-3.5">
        <ApprovalBar count={approvedCount} />
        <p className="t-xs subtle mt-2">2 approvals needed, 1 from a maintainer.</p>
      </div>
      <ul className="pb-2 pt-1">
        {approvals.length === 0 && <li className="t-sm subtle px-4 py-2">No reviewers yet</li>}
        {approvals.map((approval) => (
          <li key={approval.handle} className="flex items-center gap-2.5 px-4 py-2">
            <Avatar handle={approval.handle} />
            <span className="t-sm flex-1">
              @{approval.handle}{' '}
              <span className="subtle">· {roleLabel(getPerson(people, approval.handle).role)}</span>
            </span>
            {approval.state === 'approved' ? (
              <span className="t-sm ok inline-flex items-center gap-1">
                <Icon name="check" size="sm" />
                Approved
              </span>
            ) : (
              <span className="t-sm subtle inline-flex items-center gap-1">
                <Icon name="clock" size="sm" />
                Requested
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ── Accept (maintainers) ───────────────────────────────── */

function Requirement({ done, children }: { done: boolean; children: React.ReactNode }) {
  return (
    <li className={cn('flex items-center gap-2', !done && 'subtle')}>
      <Mark
        size={16}
        name={done ? 'tick' : 'ring'}
        className={done ? 'ok' : 'text-border-strong'}
      />
      {children}
    </li>
  );
}

export function AcceptBox({ size }: { size?: 'lg' }) {
  const { mode, viewer } = useViewer();
  const toast = useToast();
  const {
    proposal,
    approvals,
    approvedCount,
    maintainerApproved,
    acceptable,
    accepted,
    approve,
    accept,
  } = useProposalState();
  if (mode === 'github') return <GitHubAcceptBox size={size} />;
  if (viewer?.role !== 'maintainer') return null;

  const viewerApproved = approvals.some(
    (a) => a.handle === viewer.handle && a.state === 'approved',
  );
  const canApprove = !accepted && !viewerApproved && proposal.author !== viewer.handle;
  const version = proposal.toVersion ?? proposal.fromVersion;

  return (
    <section className="box p-4" aria-labelledby="ac-h">
      <div className="flex items-center justify-between">
        <h2 id="ac-h" className="t-sm strong">
          Accept
        </h2>
        <span className="badge">Maintainers</span>
      </div>
      <ul className="t-sm mt-3 flex flex-col gap-1.5">
        <Requirement done={proposal.checks === 'passing'}>Checks passing</Requirement>
        <Requirement done={approvedCount >= 2}>
          2 approvals ({Math.min(approvedCount, 2)} of 2)
        </Requirement>
        <Requirement done={maintainerApproved}>1 from a maintainer</Requirement>
      </ul>
      <div className="panel t-xs muted mt-3.5 px-3 py-2.5">
        Result: {topicName(proposal.topic)} → <span className="strong text-fg">Verified</span>
        {version && (
          <>
            {' '}
            · <span className="mono">v{version}</span>
          </>
        )}
      </div>
      <button
        type="button"
        className={cn(
          'btn btn-primary mt-3 w-full',
          size === 'lg' && 'btn-lg',
          !acceptable && 'btn-disabled',
        )}
        aria-disabled={!acceptable}
        onClick={() => {
          if (!acceptable) return;
          accept(viewer.handle);
          toast('Accepted · card is now Verified');
        }}
      >
        Accept proposal
      </button>
      {canApprove && (
        <button
          type="button"
          className={cn('btn btn-secondary mt-2 w-full', size === 'lg' && 'btn-lg')}
          onClick={() => approve(viewer.handle)}
        >
          Approve as maintainer
        </button>
      )}
      {accepted && (
        <p className="t-xs ok mt-2.5" role="status">
          Accepted · card is now Verified.
        </p>
      )}
    </section>
  );
}

/** GitHub mode: the accept rule, and the pull request where maintainers merge. */
function GitHubAcceptBox({ size }: { size?: 'lg' }) {
  const { proposal, approvedCount, maintainerApproved, accepted, status } = useProposalState();
  if (status === 'closed') return null;
  return (
    <section className="box p-4" aria-labelledby="ac-h">
      <div className="flex items-center justify-between">
        <h2 id="ac-h" className="t-sm strong">
          Accept
        </h2>
        <span className="badge">Maintainers</span>
      </div>
      <ul className="t-sm mt-3 flex flex-col gap-1.5">
        <Requirement done={proposal.checks === 'passing'}>Checks passing</Requirement>
        <Requirement done={approvedCount >= 2}>
          2 approvals ({Math.min(approvedCount, 2)} of 2)
        </Requirement>
        <Requirement done={maintainerApproved}>1 from a maintainer</Requirement>
      </ul>
      {accepted ? (
        <p className="t-xs ok mt-2.5" role="status">
          Accepted.
        </p>
      ) : (
        proposal.url && (
          <a
            href={proposal.url}
            target="_blank"
            rel="noopener noreferrer"
            className={cn('btn btn-secondary mt-3.5 w-full', size === 'lg' && 'btn-lg')}
          >
            Open on GitHub
            <Icon name="external" size="sm" />
          </a>
        )
      )}
    </section>
  );
}

/** Desktop aside: Checks, Approvals and (for maintainers) Accept. */
export function ProposalSide({ showAccept = true }: { showAccept?: boolean }) {
  return (
    <div className="flex flex-col gap-4">
      <ChecksBox />
      <ApprovalsBox />
      {showAccept && <AcceptBox />}
    </div>
  );
}

/** Phone: two small boxes in place of the side panels (board 29). */
export function PhoneStatusBoxes() {
  const { proposal, approvedCount } = useProposalState();
  const checks = CHECKS_STATE[proposal.checks];
  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <div className="box p-3">
          <div className="label">Checks</div>
          <div className={cn('t-sm mt-1.5 flex items-center gap-1.5 font-medium', checks.tone)}>
            <ChecksGlyph state={proposal.checks} />
            {checks.label}
          </div>
          <div className="t-xs subtle mt-0.5">Format · Safety · Links</div>
        </div>
        <div className="box p-3">
          <div className="label">Approvals</div>
          <div className="t-sm mt-1.5 font-medium">{approvedCount} of 2</div>
          <ApprovalBar count={approvedCount} className="mt-2" />
        </div>
      </div>
      <p className="t-xs subtle">2 approvals needed, 1 from a maintainer.</p>
    </>
  );
}
