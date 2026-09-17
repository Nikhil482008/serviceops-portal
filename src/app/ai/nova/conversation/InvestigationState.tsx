import { type Turn } from '../turnModel';
import { NovaFailure } from '../NovaFailure';
import { InvestigationTrail } from './InvestigationTrail';
import { NovaThinkingSummary } from './NovaThinkingSummary';

/* WHAT NOVA IS DOING — one line, and the trail behind it.
 *
 * ── THE ROW IS THE SURFACE; THE TRAIL IS ONE CLICK IN ───────────────────────────────────────
 * This used to print the whole checklist as it ran — nine rows ticking over, the live one
 * somewhere among them — and then folded it behind a scope strip, a current-check line and a
 * tally. Each of those was a dedicated region. The one thing on screen now is the sentence
 * `NovaThinkingSummary` draws — how long, and what is happening — and `InvestigationTrail` is
 * what opens beneath it. Nothing was removed; the list moved one layer back (law 19).
 *
 * ── AND THE TRAIL IS THE SAME TRAIL EVERY VIEW SHOWS ────────────────────────────────────────
 * It used to be a flat list of verbs with every finding repeated at the bottom under one
 * heading, while the reveal view drew numbered chapters whose checks resolve into facts and
 * whose findings sit where they landed. The second is better, and the difference was never a
 * decision about the reader — it was two components. There is one now.
 *
 * ── THE DENSE VARIANT ────────────────────────────────────────────────────────────────────────
 * The technician's feed is THIS component, with two differences and no third: step labels name
 * the source and its size ("Reading INC-1088 — 14 updates" — authored, not derived), and every
 * reference in a label or a finding renders as a clickable mono chip that opens that record
 * through askNova. Same stream, same pacing, same row.
 *
 * ── WHAT IS NOT SHOWN ────────────────────────────────────────────────────────────────────────
 * Every row here is a user-safe TASK — "Checking recent ticket activity" — never reasoning about
 * how a conclusion was reached. The step labels come from the script; nothing in this component
 * can surface anything the script did not choose to say.
 */

export function InvestigationState({ turn, onRetry, dense, onAsk }: {
  turn: Turn; onRetry?: () => void;
  /** The technician variant — refs as chips. */
  dense?: boolean;
  onAsk?: (q: string) => void;
}) {
  return (
    <div data-feed-dense={dense ? 'true' : 'false'}>
      <NovaThinkingSummary
        turn={turn}
        history={<InvestigationTrail turn={turn} dense={dense} onAsk={onAsk} />}
      />
      {turn.ended && !turn.answer && !turn.error && !turn.stopped && turn.steps.length > 0 && (
        /* The stream ended with neither an answer nor an error. `activeIndex` is still holding
           the last row, so this says why rather than leaving it looking like a hang. */
        <p className="nova-t-meta mt-2">Still working on the last check…</p>
      )}
      {/* A failure keeps its context one click away rather than on screen: the card says what
          went wrong, and the trail behind the row says what was learned before it. */}
      <NovaFailure turn={turn} onRetry={onRetry} />
    </div>
  );
}
