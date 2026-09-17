import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { MODIFY_COMMAND, type TurnPlan } from '../turnModel';
import { PlanList } from './PlanList';
import { PlanSummaryCard } from './PlanSummaryCard';

/* THE PLAN — what Nova intends, what approving it does, and two ways forward.
 *
 * ── WHAT THIS STOPPED BEING ──────────────────────────────────────────────────────────────────
 * A card. A white panel headed "Plan", holding the steps; each step with a pencil and an ✕ on
 * hover; a declared "+ Add step" beneath them; a bordered "What will change" block under that;
 * and two buttons of its own at the bottom. Six controls and three surfaces for a thing whose
 * entire job is to be READ and then approved.
 *
 * Every one of those controls was a second way to do what the composer already does better. A
 * pencil edits one step's words with no way to say why; "Add step" could only ever append the
 * ONE extra step the script declared, which is a button that pretends to be a capability. And a
 * plan you can silently edit in place is a plan nobody reviewed — the approval boundary is the
 * whole point of this surface.
 *
 * So: the steps are TEXT (PlanList), what approving does is ONE card (PlanSummaryCard), and the
 * two ways forward are DOCK ROWS — the same surface every other turn's actions use, on every
 * persona, so "where do I act from" has one answer everywhere.
 *
 *   BUILD THE HANDOVER · you review before it posts   [recommended, mutate]
 *   CHANGE THE PLAN                                   [ask]
 *
 * The primary names the OUTCOME and its meta names the safety. "Approve & run" named the
 * mechanism and left the reader to guess whether pressing it published anything.
 *
 * ── CHANGING IT IS A MESSAGE ─────────────────────────────────────────────────────────────────
 * "Change the plan" writes `Change the plan: ` into the composer and hands over the caret — it
 * does not open a form. What the reader types is sent like any message, appears as their own
 * turn, and the revised plan arrives beneath it with its diff marked IN the list. Escape clears
 * the draft. One live plan at a time, and a thread that reads top to bottom.
 *
 * ── EVIDENCE, NOT REASONING ──────────────────────────────────────────────────────────────────
 * "Why Nova recommends this" lists user-safe facts the investigation established. No "I decided",
 * no chain-of-thought — the same rule the whole module follows.
 */

/** The optional evidence fold — points only, the same tertiary treatment as "How Nova knows". */
export function PlanEvidence({ points }: { points: string[] }) {
  const [open, setOpen] = useState(false);
  if (!points.length) return null;
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="nova-btn nova-hit nova-tertiary -ml-1"
      >
        <ChevronDown size={12} aria-hidden="true" style={{ transform: open ? 'rotate(180deg)' : undefined, transition: 'transform .15s' }} />
        Why Nova recommends this
      </button>
      {open && (
        <ul className="mt-1.5 space-y-1" data-plan-evidence>
          {points.map((p) => (
            <li key={p} className="nova-t-meta flex gap-2">
              <span aria-hidden="true">·</span>
              <span>{p}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function PlanCard({ plan }: { plan: TurnPlan }) {
  const p = plan.proposal;

  /* Once approved the proposal freezes into a quiet record — the execution list below it is
     what is alive now. */
  if (plan.status === 'approved') {
    return (
      <p className="flex items-center gap-1.5 ask-text-sm text-[var(--nova-ink-muted)]" style={{ marginTop: 16 }} data-plan-approved>
        <span className="text-[var(--nova-text-secondary)]" aria-hidden="true">✓</span>
        Plan approved · {p.steps.length} step{p.steps.length === 1 ? '' : 's'}
      </p>
    );
  }
  /* A plan a later reply replaced. It stays in the thread — the reader asked for it and reviewed
     it — but it is history, and history has no actions. */
  if (plan.status === 'superseded') {
    return (
      <p className="flex items-center gap-1.5 ask-text-sm text-[var(--nova-ink-muted)]" style={{ marginTop: 16 }} data-plan-superseded>
        <span aria-hidden="true">↓</span>
        Plan revised · {p.steps.length} step{p.steps.length === 1 ? '' : 's'} · see the updated plan below
      </p>
    );
  }

  return (
    <section style={{ marginTop: 16 }} aria-label="Proposed plan" data-plan-card>
      {/* The one line above the plan — "Here's how I'll handle this." / "Plan updated." — is a
          live announcement: the plan arriving IS the event. */}
      <p className="ask-text-base ask-w-600 text-[var(--nova-ink)]" role="status" aria-live="polite">
        {p.intro}
      </p>

      {/* AN HONEST NO. One line, in place of a diff, when the change asked for is not one this
          prototype can make. It names what it CAN change rather than apologising. */}
      {plan.note && (
        <p className="nova-plan-note" data-plan-note style={{ marginTop: 8 }}>{plan.note}</p>
      )}

      <div style={{ marginTop: 10 }}>
        <PlanList proposal={p} diff={plan.diff} />
      </div>

      <div style={{ marginTop: 14 }}>
        <PlanSummaryCard proposal={p} diff={plan.diff} />
      </div>

      <div style={{ marginTop: 12 }}>
        <PlanEvidence points={p.evidence ?? []} />
      </div>

      {/* THE TWO WAYS FORWARD ARE THE DOCK'S — see dock/planSteps.ts. They were rows here, and
          before that they were two buttons this card drew itself; both times they were the one
          turn in the product whose actions lived somewhere other than where every other turn's
          do. The labels are still the script's (`p.approve` / `p.modify`), and the sentence below
          still names the boundary, because the reader reads that HERE, above the plan, not down
          in the dock. */}
      <p className="nova-t-meta" style={{ marginTop: 16 }}>
        Nothing is posted until you press {p.approve} — and you see the note first.
      </p>
      <span className="sr-only">{`Type your change after "${MODIFY_COMMAND}"`}</span>
    </section>
  );
}
