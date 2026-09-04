import { TriangleAlert } from 'lucide-react';
import type { FeedDiscovery } from '../turnModel';

/* NOT VERIFIED — a limit on the answer, said out loud.
 *
 * A gap renders ABOVE the evidence fold, always visible: hiding a limit behind a toggle is how a
 * reader trusts something further than it deserves. And it stays deliberately small — one
 * unverified detail does not make the whole answer unreliable, and a caveat dressed as a warning
 * banner would claim exactly that.
 */
export function NovaVerificationNotice({ gap }: { gap: FeedDiscovery }) {
  return (
    <div className="nova-caveat">
      <TriangleAlert size={13} className="mt-[1px] flex-shrink-0 text-[#B98900]" aria-hidden="true" />
      <p className="nova-caveat-body">
        <span className="nova-t-label mr-2 align-middle text-[#8A6D1F]">Not verified</span>
        {gap.headline}. {gap.detail}
      </p>
    </div>
  );
}
