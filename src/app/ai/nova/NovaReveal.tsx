import { answerVisible, type Turn } from './turnModel';
import { NovaFailure } from './NovaFailure';
import { InvestigationTrail } from './conversation/InvestigationTrail';
import { NovaThinkingSummary } from './conversation/NovaThinkingSummary';
import { PlanCard } from './conversation/PlanCard';
import { ExecutionProgress } from './conversation/ExecutionProgress';

/* MYSTERY → REVEAL — plus the two plan-first surfaces.
 *
 * The other views answer "what is it doing". This one answers "what has it found so far" — and
 * deliberately withholds the rest. Chapters are numbered and named, each ends on a FACT rather
 * than a verb, and a finding is teased before it is stated: "Interesting…" and then what was
 * interesting.
 *
 * ── WHY A TEASE IS NOT A GIMMICK ─────────────────────────────────────────────────────────────
 * A spinner asks the reader to wait. A tease asks them a question they now want answered, and the
 * next second is spent wanting rather than waiting — the same duration, a different experience.
 * It only works because the chapters ran first: by chapter three the reader has seen enough to
 * have formed a guess, so "Interesting…" lands on something they were already wondering.
 *
 * It also only stays honest because the tease is AUTHORED PER FINDING, in the script, beside the
 * finding it introduces. A generic "Nova found something!" injected whenever a discovery arrived
 * would be a component manufacturing suspense it has no basis for.
 *
 * ── WHAT IS LEFT IN THIS FILE ────────────────────────────────────────────────────────────────
 * The chapters moved to `InvestigationTrail`, which every view now opens onto — that presentation
 * was the good one and there was no reason only this view had it. What remains here is the ONE
 * thing this view does that the linear view does not: the plan-first surfaces, a proposal that
 * parks the stream and the execution that follows the reader approving it.
 *
 * ⚠️ Same turn, same events, same reducer as the other views. No timers here drive order.
 */

export function NovaReveal({ turn, onRetry, onPlanRespond, onAsk }: {
  turn: Turn;
  onRetry?: () => void;
  /** Release a stream parked on a FAILED EXECUTION STEP. The plan proposal itself is released
   *  from the dock; what is left here is the retry inside the execution list. */
  onPlanRespond?: (id: string, payload: Record<string, string>) => void;
  /** A reference in a row or a finding is a chip that opens that record — through askNova. */
  onAsk?: (q: string) => void;
}) {
  const hasAnswer = answerVisible(turn);
  /* A REVISION REPLY performed no checks of its own — they belonged to the question above it — so
     while its plan is under review the plan IS the reply. Once an answer lands the trail returns,
     behind the row, because at that point it is provenance rather than a claim of live work. */
  const planOnly = !!turn.plan && !hasAnswer && (!!turn.revisionOf || turn.steps.length === 0);

  /* THE PLAN IS READ HERE AND ACTED ON IN THE DOCK. Approving it and changing it are this
     turn's two actions, and a technician turn's actions are the ActionDock's — see
     dock/planSteps.ts, which reads the same `planPending` this card's own liveness used to. */
  const plan = turn.plan && <PlanCard plan={turn.plan} />;
  const execution = turn.execution && (
    <ExecutionProgress
      steps={turn.execution.steps}
      live={!turn.stopped && turn.state !== 'error' && !!onPlanRespond}
      onRetry={(stepId) => onPlanRespond?.(`retry:${stepId}`, { action: 'retry' })}
    />
  );

  if (planOnly) {
    return (
      <div data-plan-reply>
        {plan}
        {execution}
        <NovaFailure turn={turn} onRetry={onRetry} />
      </div>
    );
  }

  return (
    <div>
      {/* THE ROW, with the chapters behind it. No Context card on this path: its outputs and
          sources are the same facts the answer derives under "How Nova knows" (EvidenceBlock
          reads the same steps), and a second copy of one provenance is how the two drift. */}
      <NovaThinkingSummary
        turn={turn}
        history={<InvestigationTrail turn={turn} dense onAsk={onAsk} />}
      />
      {/* THE PLAN-FIRST SURFACES. The proposal parks the stream, so between planning and
          execution the card is the only live thing on screen; both are inert once the turn
          stopped or failed, exactly like a parked ask. */}
      {plan}
      {execution}
      {/* The failure card carries its own top margin — it used to sit in a wrapper with one,
          which left a blank 16px under every successful turn. */}
      <NovaFailure turn={turn} onRetry={onRetry} />
    </div>
  );
}
