import type { PlanDiff, PlanProposal } from '../scripts/registry';
import { planSummary } from './planSummary';

/* WHAT APPROVING THIS DOES — four rows, all derived, and the one card in the turn.
 *
 * The plan is text on the page (PlanList). This is the only enclosed surface, and it earns that
 * because it is the object being decided about: everything above it is what Nova intends, this is
 * what will be true afterwards. One card, so "card" still means something.
 *
 *   COVERS · SOURCE · POSTS TO · CHANGES
 *
 * See planSummary.ts for where each row comes from. Nothing here is authored; removing a step
 * changes these rows because the rows ARE the steps, read a different way.
 *
 * ── THE BAND ─────────────────────────────────────────────────────────────────────────────────
 * After a revision, a row whose value now reads differently gets a tinted band and one word —
 * "changed". Not an arrow, not a before-and-after: the reader has the previous plan directly
 * above in the thread, and a summary that tried to hold both versions would stop being a summary.
 * The band's job is only to stop someone re-reading four rows to find the one that moved.
 */

export function PlanSummaryCard({ proposal, diff }: { proposal: PlanProposal; diff?: PlanDiff }) {
  const rows = planSummary(proposal);
  const moved = new Set(diff?.rows ?? []);
  return (
    <section className="nova-plan-sum" data-plan-summary aria-label="What approving this does">
      <dl className="nova-plan-sum-list">
        {rows.map((r) => (
          <div
            key={r.label}
            className="nova-plan-sum-row"
            data-row={r.label}
            data-changed={moved.has(r.label) ? 'true' : undefined}
          >
            <dt className="nova-plan-sum-k">{r.label}</dt>
            <dd className="nova-plan-sum-v">
              {r.value}
              {moved.has(r.label) && <span className="nova-plan-sum-cap">changed</span>}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
