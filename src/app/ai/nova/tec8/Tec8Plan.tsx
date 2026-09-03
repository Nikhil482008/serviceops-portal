import {
  movedOrder, planDiff, planSteps,
  type Tec8PlanState, type Tec8Settings,
} from './tec8Model';
import { Tec8PlanStep } from './Tec8PlanStep';
import { Tec8ImpactSummary } from './Tec8ImpactSummary';
import { Tec8PlanEvidence } from './Tec8PlanEvidence';

/* THE PLAN — the object the whole use case exists to put in front of someone.
 *
 * ── IT IS A PROPOSAL, NOT A FORM ───────────────────────────────────────────
 * Numbered prose with a quiet edit affordance, not labelled inputs in boxes. A form says "fill
 * this in"; this has to say "here is what I intend to do" — the reader's job is to JUDGE it,
 * and everything about the shape should invite reading first and editing second.
 *
 * ── THE ORDER IS THE ARGUMENT ────────────────────────────────────────────
 * What I will do → what will change → why → the decision. Impact sits ABOVE the justification
 * because consequence is what a decision needs and justification is what a doubt needs (law 9),
 * and the two buttons come last because that is where a reader who has finished reading is
 * looking (law 10).
 *
 * ── ONE DOMINANT ACTION ──────────────────────────────────────────────────
 * Approve is filled; Modify is quiet (law 7). They are NOT equal weight, because they are not
 * equally likely and not equally consequential — and the revised plan's button reads "Approve &
 * run" rather than "Approve", because by then the word has to carry the fact that things will
 * actually happen when it is pressed.
 */
export function Tec8Plan({
  plan, previous, revised, editable, actions, onPlan, onModify, onApprove,
}: {
  plan: Tec8PlanState;
  /** The plan before the last modification — drives the diff and the "Updated" marks. */
  previous: Tec8PlanState | null;
  /** This is the revised plan: different eyebrow, different heading, different approve label. */
  revised: boolean;
  /** Can individual steps be edited, removed or moved? */
  editable: boolean;
  /** Does this block own the Modify / Approve pair? Only the NEWEST plan does — an approve
   *  button on a superseded revision would authorise a plan that has been replaced. */
  actions: boolean;
  onPlan: (p: Tec8PlanState) => void;
  onModify: () => void;
  onApprove: () => void;
}) {
  const steps = planSteps(plan);
  const diff = previous ? planDiff(previous, plan) : null;
  const before = previous ? new Set(planSteps(previous).map((s) => s.title)) : null;

  return (
    <section className="tec8-plan" aria-labelledby="tec8-plan-head">
      <h4 className="nova-t-label">{revised ? 'Plan updated' : 'Plan'}</h4>
      <p id="tec8-plan-head" className="nova-headline">
        {revised ? "Here's the revised plan" : "Here's how I'll handle it"}
      </p>

      {diff && (
        /* WHAT MOVED, before the list itself. A reader who asked for three changes wants to know
           they landed — re-reading six steps to find out is work the screen should have done. */
        <dl className="nova-kv tec8-diff">
          {diff.map((d) => (
            <div key={d.label} className="nova-kv-row">
              <dt className="nova-kv-label">{d.label}</dt>
              <dd className="nova-kv-value">
                {d.value}
                {d.moved && <span className="tec8-step-upd">Updated</span>}
              </dd>
            </div>
          ))}
        </dl>
      )}

      <ol className="tec8-steps">
        {steps.map((s, i) => (
          <Tec8PlanStep
            key={s.id}
            n={i + 1}
            step={s}
            plan={plan}
            updated={!!before && !before.has(s.title)}
            editable={editable}
            first={i === 0}
            last={i === steps.length - 1}
            onSettings={(settings: Tec8Settings) => onPlan({ ...plan, settings })}
            onRemove={() => onPlan({ ...plan, dropped: [...plan.dropped, s.id] })}
            onMove={(dir) => onPlan({ ...plan, order: movedOrder(plan, s.id, dir) })}
          />
        ))}
      </ol>

      <Tec8ImpactSummary settings={plan} />
      <Tec8PlanEvidence />

      {actions && (
        <div className="tec8-plan-actions">
          <button
            type="button"
            className="nova-btn nova-btn-ghost tec8-btn-secondary"
            onClick={onModify}
          >{revised ? 'Modify again' : 'Modify plan'}</button>
          <button
            type="button"
            className="nova-btn nova-btn-primary tec8-btn-primary"
            onClick={onApprove}
          >{revised ? 'Approve & run' : 'Approve plan'}</button>
        </div>
      )}
    </section>
  );
}
