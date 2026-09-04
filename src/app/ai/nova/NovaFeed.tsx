import type { Turn } from './turnModel';
import { NovaThinking } from './NovaThinking';
import { NovaWorkspace } from './NovaWorkspace';
import { NovaReveal } from './NovaReveal';
import { InvestigationState } from './conversation/InvestigationState';
import { AskUserQuestion } from './conversation/AskUserQuestion';

/* The investigation, rendered.
 *
 * PURE. It consumes no stream, owns no timers that drive step order, and knows nothing about
 * where its turn came from — every row here is folded from events by `applyEvent` in the
 * controller. Swapping the mock for SSE changes `novaStream.ts` and nothing in this file.
 *
 * ── A ROUTER, AND NOTHING ELSE ───────────────────────────────────────────────────────────────
 * It used to hold the whole step feed inline as well. That work now lives in
 * `conversation/InvestigationState`, beside the other conversation layers, so the four roles a
 * turn has — said / doing / found / concluded — are four files rather than three files and a
 * long one.
 */

export function NovaFeed({ turn, onRetry, onAnswerAsk, onPlanRespond }: {
  turn: Turn;
  onRetry?: () => void;
  onAnswerAsk?: (askId: string, answers: Record<string, string>, done: boolean) => void;
  /** Release a stream parked on a plan proposal or a failed execution step (TEC-07). */
  onPlanRespond?: (id: string, payload: Record<string, string>) => void;
}) {
  /* Two presentations of the SAME turn. The view is a property of the investigation, chosen by
     whoever produced it — so this is a render branch, not a second feature with its own state,
     its own reducer and its own chance to disagree about what happened. */
  const investigation = turn.view === 'thinking' ? <NovaThinking turn={turn} />
    : turn.view === 'workspace' ? <NovaWorkspace turn={turn} onRetry={onRetry} />
      : turn.view === 'reveal' ? <NovaReveal turn={turn} onRetry={onRetry} onPlanRespond={onPlanRespond} />
        : <InvestigationState turn={turn} onRetry={onRetry} />;

  if (!turn.asks.length) return investigation;

  /* ── WHY THE CARD SITS ABOVE THE INVESTIGATION ───────────────────────────────────────────
     While it is pending it is the only thing on screen anyone can act on, and the thing to act
     on goes first (law 9). Once it resolves the checks below it have collapsed to a single
     tally, which is a summary rather than a timeline — so nothing ends up out of order by
     being there. It is also where the reference puts it.

     ⚠️ ANSWERABLE EVEN WHEN THIS IS NOT THE NEWEST TURN. A parked stream stays parked whatever
     else the reader goes on to ask, so gating on "is this the live turn" would strand it with
     no way to release it. What DOES make it inert is the turn being stopped or failed, because
     then there is nothing left to release. */
  const answerable = !turn.stopped && turn.state !== 'error';
  return (
    <>
      {turn.asks.map((ask) => (
        <AskUserQuestion
          key={ask.id}
          ask={ask}
          live={answerable && !!onAnswerAsk}
          onAnswer={(answers, done) => onAnswerAsk?.(ask.id, answers, done)}
        />
      ))}
      {investigation}
    </>
  );
}
