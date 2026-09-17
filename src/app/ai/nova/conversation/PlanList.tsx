import type { PlanDiff, PlanProposal, PlanStep } from '../scripts/registry';
import { Emph } from './blocks';

/* THE PLAN, AS A LIST — an `<ol>` on the surface, and never a card.
 *
 * ── WHY NOT A CARD ───────────────────────────────────────────────────────────────────────────
 * It was one: a white panel with a "Plan" head, a bordered "What will change" block under it and
 * two buttons beneath. The panel was there because the steps used to be editable and a hover
 * ground has to have somewhere to show up. The steps are not editable any more, so the surface
 * was holding nothing — and a box around a numbered list is a box that says "this is a component"
 * to a reader who is trying to read six sentences. The numbers already say it is a sequence; the
 * indent already says it is one object. Text on the page is what a plan is.
 *
 * ── THE DIFF IS A CHANGE TO THIS LIST, NOT A LIST OF CHANGES ─────────────────────────────────
 * The old revision rendered a separate block above the plan — "Removed: Attach the overnight SLA
 * clocks" — and then the plan, silently one step shorter. Two places to read, and the reader had
 * to find the gap themselves.
 *
 * Here the change is IN the list:
 *   removed   struck through, in place, at the seat it held, numbered "–"
 *   new       marked `new`, numbered with the rest
 *   changed   marked `changed`, keeping its number, because it is the same step
 * Everything else renumbers around the removals, so the numbers are always the numbers of the
 * plan that would run. The struck row is history sitting where its history happened.
 *
 * ── IDS, NOT TITLES ──────────────────────────────────────────────────────────────────────────
 * Every mark here comes from a step id in `PlanDiff`. See tech/planRevise.ts.
 */

type Mark = 'new' | 'removed' | 'changed' | null;

interface Row { step: PlanStep; mark: Mark; n: number | null }

/** Weave the removed steps back in at the seats they held, and number only the survivors. */
export function planRows(p: PlanProposal, diff?: PlanDiff): Row[] {
  const added = new Set(diff?.added ?? []);
  const changed = new Set(diff?.changed ?? []);
  const gone = diff?.gone ?? [];
  const rows: Row[] = p.steps.map((step) => ({
    step,
    mark: added.has(step.id) ? 'new' : changed.has(step.id) ? 'changed' : null,
    n: 0,
  }));
  /* Ascending, so each insertion lands at the index it was recorded at rather than being
     pushed along by the one before it. */
  [...gone].sort((a, b) => a.at - b.at).forEach(({ step, at }) => {
    rows.splice(Math.min(at, rows.length), 0, { step, mark: 'removed', n: null });
  });
  let n = 0;
  return rows.map((r) => (r.mark === 'removed' ? r : { ...r, n: (n += 1) }));
}

const PILL: Record<Exclude<Mark, null>, string> = { new: 'New', removed: 'Removed', changed: 'Changed' };

export function PlanList({ proposal, diff }: { proposal: PlanProposal; diff?: PlanDiff }) {
  const rows = planRows(proposal, diff);
  return (
    <ol className="nova-plan-list" data-plan-list={proposal.steps.length}>
      {rows.map((r) => (
        <li
          key={r.step.id}
          className="nova-plan-step"
          data-plan-step={r.step.id}
          data-mark={r.mark ?? undefined}
        >
          <span className="nova-plan-n" aria-hidden="true">{r.n === null ? '–' : r.n}</span>
          <span className="nova-plan-body">
            <span className="nova-plan-label">
              {/* A removed step is struck where it stood. The screen reader is told in words,
                  because a line through text is not something it can say. */}
              {r.mark === 'removed' ? <><span className="sr-only">Removed: </span><s>{r.step.label}</s></> : r.step.label}
              {r.mark && <span className="nova-plan-pill" data-pill={r.mark}>{PILL[r.mark]}</span>}
            </span>
            {r.step.detail && r.mark !== 'removed' && (
              <span className="nova-plan-detail"><Emph>{r.step.detail}</Emph></span>
            )}
          </span>
        </li>
      ))}
    </ol>
  );
}
