import type { Review, TimelineStep } from '@/lib/community';
import { CHECKS_STATE, type ChecksState } from '@/lib/status';
import { cn } from '@/lib/utils';
import { Icon } from '@/components/icons';

/** Check-state glyph: circle-check, circle-x or spinner, coloured by state. */
export function ChecksGlyph({ state, className }: { state: ChecksState; className?: string }) {
  if (state === 'passing') return <Icon name="checkCircle" size="sm" className={className} />;
  if (state === 'failing') return <Icon name="xCircle" size="sm" className={className} />;
  return <Icon name="spinner" size="sm" className={cn('spin', className)} />;
}

/** "✓ Passing" in the row colour of its state. */
export function ChecksMeta({ state, className }: { state: ChecksState; className?: string }) {
  const info = CHECKS_STATE[state];
  return (
    <span className={cn('meta', info.glyph, className)}>
      <ChecksGlyph state={state} />
      {info.label}
    </span>
  );
}

/** Two-segment progress bar for "n of 2" approvals. */
export function ApprovalBar({ count, className }: { count: number; className?: string }) {
  return (
    <span className={cn('bar', className)} aria-hidden="true">
      <span className={count >= 1 ? 'on' : undefined} />
      <span className={count >= 2 ? 'on' : undefined} />
    </span>
  );
}

const VERDICT: Record<Review['verdict'], { pill: string; label: string }> = {
  approved: { pill: 'p-success', label: 'Approved' },
  comment: { pill: 'p-outline', label: 'Comment' },
  changes: { pill: 'p-warning', label: 'Changes requested' },
};

export function VerdictPill({ verdict }: { verdict: Review['verdict'] }) {
  const info = VERDICT[verdict];
  return <span className={cn('pill', info.pill)}>{info.label}</span>;
}

/** The status timeline (board 25): dots joined by a thin line. */
export function Timeline({ steps }: { steps: TimelineStep[] }) {
  return (
    <ol>
      {steps.map((step, index) => (
        <li key={`${step.label}-${index}`} className="grid grid-cols-[24px_minmax(0,1fr)] gap-3.5">
          <span className="flex flex-col items-center">
            <span
              className={cn(
                'step-dot mt-0.5 h-5 w-5',
                step.state === 'next' ? 'step-cur' : 'step-done',
              )}
            >
              {step.state !== 'next' && (
                <svg
                  className="i"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  style={{ width: 12, height: 12, strokeWidth: 2.5 }}
                >
                  <path d="m5 12 4.5 4.5L19 7" />
                </svg>
              )}
            </span>
            {index < steps.length - 1 && <span className="min-h-5 w-px flex-1 bg-border" />}
          </span>
          <div className="pb-[22px]">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium">{step.label}</span>
              <span className="t-sm subtle">{step.meta}</span>
            </div>
            {step.note && <p className="t-sm muted mt-1">{step.note}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}
