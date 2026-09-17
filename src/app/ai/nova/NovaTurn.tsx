import { NovaFeed } from './NovaFeed';
import { NovaAnswer } from './NovaAnswer';
import { UserMessage } from './conversation/UserMessage';
import { NovaMessage } from './conversation/NovaMessage';
import { hasThinkingRow } from './conversation/NovaThinkingSummary';
import { ChosenLine } from './dock/ChosenLine';
import { doIcon, isDoIcon } from './tech/icons';
import { planPending, type Turn } from './turnModel';

/* ONE TURN: what I said, then what Nova did about it — and never any doubt about which is
 * which.
 *
 * ── THE PROBLEM THIS REPLACES ────────────────────────────────────────────
 * Both speakers wrote at the same left edge, in the same dark ink, on the same dotted canvas,
 * with the question set LARGER than the answer. A 32px gutter with a silent avatar and a hairline
 * running down it was supposed to fix that. It did not: it marked that a speaker had changed
 * without saying who, and the spine welded question, working and answer into one object — the
 * wall this brief describes.
 *
 * The replacement uses three independent signals, any one of which is enough on its own:
 *
 *   THE READER    right-aligned, filled bubble, 13px, initials above it
 *   NOVA          left, no surface at all, named identity row, 14px answer beneath
 *
 * Nothing Nova produces is ever right-aligned and nothing the reader says ever gets a name row,
 * so the two can never be confused even at a glance, even scrolled past at speed.
 *
 * ── SCREEN READERS ───────────────────────────────────────────────────────
 * Alignment and fill carry nothing to a listener, so each half keeps its own visually-hidden
 * heading and the reading order stays "You asked … / Nova replied …" rather than an
 * undifferentiated run of text. The avatar and the orb are decoration and are `aria-hidden`.
 */
export function NovaTurn(
  { turn, live, onFollowUp, onEditQuery, onSavePrompt, onRetry, onAnswerAsk, onPlanRespond, onPlanModify, onRegenerate, leadership, technician, requester, offered }: {
  turn: Turn;
  /** This is the newest turn. */
  live: boolean;
  /** A requester turn — its forward actions are the Next-step dock's. See NovaAnswer. */
  requester?: boolean;
  /** Labels the dock is already offering — the follow-up chips drop anything in this list. */
  offered?: string[];
  onFollowUp: (question: string, fromTurnId: string, context?: Record<string, unknown>) => void;
  /** Put this question back in the composer for editing. */
  onEditQuery: (question: string) => void;
  /** "Save prompt" beside the question — hands the text to the drawer's save dialog. */
  onSavePrompt?: (question: string) => void;
  /** Run this same question again, in place. Every turn gets one — a failure two turns back is
   *  still a question that never got answered. */
  onRetry: () => void;
  /** What the reader chose on a clarifying question set. `done` closes the set and releases the
   *  parked stream; until then each pick is just recorded. */
  onAnswerAsk: (askId: string, answers: Record<string, string>, done: boolean) => void;
  /** Release a stream parked on a plan proposal or a failed execution step (TEC-07/plan). */
  onPlanRespond?: (id: string, payload: Record<string, string>) => void;
  /** "Modify plan" — seed the composer with `/modify plan ` and focus it. */
  onPlanModify?: () => void;
  /** The ••• menu's Regenerate — same as onRetry but with the pacing skipped. */
  onRegenerate?: () => void;
  /** Leadership reads the Command Centre feed — lanes scanning in parallel. */
  leadership?: boolean;
  /** Technicians read the linear feed's dense variant — refs as chips, precise labels. */
  technician?: boolean;
  },
) {
  /* A TURN WAITING ON THE READER IS NOT WORKING. `plan_proposed` completes the live steps but
     leaves `state` at 'investigating', because the stream really is still open - it is parked.
     The HEADER must not read that as activity: it put the thinking mark in the gutter and left
     it there until someone approved the plan, which is the black cube in the Part 0 bug. */
  const working = (turn.state === 'investigating' || turn.state === 'answering') && !planPending(turn);
  const tallied = turn.steps.some((s) => !!s.tally);
  /* TWO plan-first phases now, not three. PLANNING is the script's own action phrase and
     EXECUTING is the approved plan running - both are Nova doing something. PLAN READY was the
     third, and it was the row announcing that it had stopped: a label that says "your move"
     above a plan whose every control already says so. It is gone, with the working state that
     kept it on screen. */
  const phase = working && turn.plan && turn.execution
    ? 'Executing the approved plan'
    : working && tallied && turn.activity
      ? turn.activity
      : undefined;
  /* Only a turn whose script quantifies itself moved its topic up here - its own header
     line is gone, so the identity row is the topic's one home. Untallied turns keep
     "Working" and their view's own header, exactly as before. */
  const activity = working && !phase && tallied
    ? turn.topic || undefined : undefined;
  const ask = (q: string) => onFollowUp(q, turn.id);
  /* THE ROW LEADS once the answer is on screen (or the turn failed or was stopped) — see
     NovaMessage. Not while a clarifying question's card sits above the row: that card is the
     column's first line, and a header made of a question would be the wrong header. */
  const lead = turn.state !== 'investigating' && hasThinkingRow(turn) && turn.asks.length === 0;
  /* A NAVIGATE OPTION'S REPLY. The reader chose a numbered option rather than asking a question,
     so the chosen line stands where their question would — beneath the answer it acted on — and
     Nova's reply follows it. */
  const chosen = turn.context?.chosen as { n: number; label: string } | undefined;
  /* A TECHNICIAN ACTION opened this turn: the reader's words are the label they clicked, and it
     carries that action's icon. */
  const act = turn.context?.action as { icon?: unknown } | undefined;
  const icon = isDoIcon(act?.icon) ? doIcon(act.icon, 12) : undefined;

  return (
    <article data-turn={turn.id}>
      {chosen
        ? <ChosenLine n={chosen.n} label={chosen.label} />
        : <UserMessage question={turn.question} icon={icon} onEditQuery={onEditQuery} onSavePrompt={onSavePrompt} />}

      <div style={{ marginTop: 'var(--nova-gap-turn)' }}>
        <NovaMessage startedAt={turn.startedAt} working={working} activity={activity} phase={phase} lead={lead}>
          <NovaFeed
            turn={turn}
            onRetry={onRetry}
            onAnswerAsk={onAnswerAsk}
            onPlanRespond={onPlanRespond}
            onPlanModify={onPlanModify}
            leadership={leadership}
            technician={technician}
            onAsk={ask}
          />
          <NovaAnswer
            turn={turn}
            live={live}
            dense={technician}
            requester={requester}
            offered={offered}
            onFollowUp={(q, ctx) => onFollowUp(q, turn.id, ctx)}
            onRetry={onRegenerate ?? onRetry}
          />
        </NovaMessage>
      </div>
    </article>
  );
}
