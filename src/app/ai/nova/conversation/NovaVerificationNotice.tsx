import { TriangleAlert } from 'lucide-react';
import type { FeedDiscovery } from '../turnModel';
import { RefText } from './TechnicianBlocks';

/* NOT VERIFIED — a limit on the answer, said out loud.
 *
 * A gap renders ABOVE the evidence fold, always visible: hiding a limit behind a toggle is how a
 * reader trusts something further than it deserves. And it stays deliberately small — one
 * unverified detail does not make the whole answer unreliable, and a caveat dressed as a warning
 * banner would claim exactly that.
 */
export function NovaVerificationNotice({ gap, dense, onAsk }: {
  gap: FeedDiscovery; dense?: boolean; onAsk?: (q: string) => void;
}) {
  return (
    <div className="nova-caveat">
      {/* CAUTION, not warning. Nothing has gone wrong — this is a claim the reader should weigh
          before acting on it, and the palette has a family for exactly that. */}
      <TriangleAlert size={13} className="nova-caveat-icon mt-[1px] flex-shrink-0" aria-hidden="true" />
      <p className="nova-caveat-body">
        <span className="nova-t-label mr-2 align-middle">Not verified</span>
        {dense ? <RefText text={`${gap.headline}. ${gap.detail}`} onAsk={onAsk} /> : `${gap.headline}. ${gap.detail}`}
      </p>
    </div>
  );
}
