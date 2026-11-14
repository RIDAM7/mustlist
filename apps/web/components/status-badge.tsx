import type { Status } from '@mustlist/schema/constants';
import { Badge } from '@/components/ui/badge';

const LABELS: Record<Status, string> = {
  verified: 'Verified',
  stale: 'Being re-checked',
  proposed: 'Proposed',
  draft: 'Draft',
};

const COLORS: Record<Status, string> = {
  verified: 'bg-green-600 text-white dark:bg-green-500 dark:text-green-950',
  stale: 'bg-amber-500 text-amber-950',
  proposed: 'bg-muted text-muted-foreground',
  draft: 'bg-muted text-muted-foreground',
};

export function statusLabel(status: Status): string {
  return LABELS[status];
}

export function StatusBadge({ status }: { status: Status }) {
  return <Badge className={COLORS[status]}>{LABELS[status]}</Badge>;
}
