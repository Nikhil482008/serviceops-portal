import { useState } from 'react';
import type { Turn } from './turnModel';
import { AnswerBlock } from './conversation/AnswerBlock';
import { EvidenceBlock } from './conversation/EvidenceBlock';
import { ActionGroup, DiscardedNotice } from './conversation/ActionGroup';
import { FollowUpSuggestions } from './conversation/FollowUpSuggestions';

/* The response, in the order a reader wants it.
 *
 *   1. ANSWER      what Nova concludes            AnswerBlock
 *   2. EVIDENCE    how it got there, collapsed    EvidenceBlock
 *   3. ACTIONS     what I can do                  ActionGroup
 *   4. FOLLOW-UP   what else I could ask          FollowUpSuggestions
 *
 * This file is now only the ORDER, and the one piece of state that spans it. Everything that
 * knows how a layer LOOKS lives in its own component, which is what makes the same four layers
 * reusable across the requester, technician and leadership views: the depth, the content and the
 * available actions change; the sequence does not.
 *
 * It replaced a single 216-line component that rendered all four as one run of markup with the
 * evidence in the middle and the actions buried above it — which is precisely why the response
 * read as a wall.
 *
 * ⚠️ THIS COMPONENT TAKES A TURN, NOT AN ANSWER. It cannot be handed a canned answer object
 * and told to render it — there is no prop for one. The only route onto the screen is through
 * the machine, and the guard below is the last link: `answering | settled`, and `settled` is
 * unreachable except from `answering` (turnModel.setState).
 */
export function NovaAnswer({ turn, live, onFollowUp }: {
  turn: Turn;
  /** False once a newer turn exists. Old suggestions stay VISIBLE but stop working — removing
   *  them would rewrite the history the reader is scrolling through. */
  live: boolean;
  onFollowUp: (question: string) => void;
}) {
  const [discarded, setDiscarded] = useState(false);

  /* The state machine is the gate. Not a convenience check — the whole enforcement. */
  if (turn.state !== 'answering' && turn.state !== 'settled') return null;
  const a = turn.answer;
  if (!a) return null;

  if (discarded) return <DiscardedNotice onUndo={() => setDiscarded(false)} />;

  return (
    <div style={{ marginTop: 'var(--nova-gap-block)' }}>
      {/* The transition from "what I did" to "what I found". One hairline across Nova’s own
          content column — it separates two layers of ONE message, not two speakers. */}
      {turn.steps.length > 0 && (
        <div className="mb-3 border-t border-[var(--nova-rule)]" aria-hidden="true" />
      )}

      <AnswerBlock answer={a} />
      <EvidenceBlock turn={turn} />
      <ActionGroup answer={a} onAsk={onFollowUp} onDiscard={() => setDiscarded(true)} />
      <FollowUpSuggestions questions={a.followUps ?? []} live={live} onAsk={onFollowUp} />
    </div>
  );
}
