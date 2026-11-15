import { ChangesView } from '@/components/proposals/changes';

/** Field-by-field changes (board 27). The proposal comes from the layout's state provider. */
// Blocking: unknown proposal ids get a real 404 (see the layout).
export const instant = false;

export default function ProposalChanges() {
  return <ChangesView />;
}
