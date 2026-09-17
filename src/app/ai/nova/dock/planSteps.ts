import { planPending, type Turn } from '../turnModel';
import type { NextStep } from './nextSteps';

/* THE PLAN'S TWO WAYS FORWARD, AS DOCK ROWS.
 *
 * A plan-first turn (TEC-07) parks the stream on the reader: the plan is on screen and nothing
 * runs until it is approved. That is an action turn like any other, so its two moves belong where
 * every other turn's do — the dock — rather than in a row of buttons the plan card draws itself.
 *
 *   BUILD THE HANDOVER · you review before it posts   [recommended, mutate]
 *   CHANGE THE PLAN                                   [ask]
 *
 * ── CHANGING IT IS STILL A MESSAGE ───────────────────────────────────────────────────────────
 * "Change the plan" does not open a form. It writes `Change the plan: ` into the box and hands
 * over the caret — and since the dock has taken the box's seat, it asks the seat to fold to the
 * band first. What the reader types is sent like any message, appears as their own turn, and the
 * revised plan arrives beneath it with its diff marked in the list.
 */
export function planStepsFor(
  turn: Turn,
  respond: (id: string, payload: Record<string, string>) => void,
  modify: () => void,
): NextStep[] {
  if (!planPending(turn) || !turn.plan) return [];
  const p = turn.plan.proposal;
  return [
    {
      id: `${turn.id}:plan-build`,
      label: p.approve,
      /* The primary names the OUTCOME and its detail names the safety. "Approve & run" named the
         mechanism and left the reader to guess whether pressing it published anything. */
      detail: p.approveMeta ?? '',
      kind: 'mutate',
      recommended: true,
      turnId: turn.id,
      run: () => respond(p.id, { action: 'approve' }),
    },
    {
      id: `${turn.id}:plan-change`,
      label: p.modify,
      detail: 'Say what to change and the plan comes back revised',
      kind: 'ask',
      recommended: false,
      turnId: turn.id,
      run: modify,
    },
  ];
}
