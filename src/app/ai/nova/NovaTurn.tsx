import { NovaFeed } from './NovaFeed';
import { NovaAnswer } from './NovaAnswer';
import { UserMessage } from './conversation/UserMessage';
import { NovaMessage } from './conversation/NovaMessage';
import type { Turn } from './turnModel';

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
export function NovaTurn({ turn, live, onFollowUp, onEditQuery, onRetry }: {
  turn: Turn;
  /** This is the newest turn. Older turns keep their suggestions visible but inert. */
  live: boolean;
  onFollowUp: (question: string, fromTurnId: string) => void;
  /** Put this question back in the composer for editing. */
  onEditQuery: (question: string) => void;
  /** Run this same question again, in place. Every turn gets one — a failure two turns back is
   *  still a question that never got answered. */
  onRetry: () => void;
}) {
  const working = turn.state === 'investigating' || turn.state === 'answering';

  return (
    <article>
      <UserMessage question={turn.question} onEditQuery={onEditQuery} />

      <div style={{ marginTop: 'var(--nova-gap-turn)' }}>
        <NovaMessage startedAt={turn.startedAt} working={working}>
          <NovaFeed turn={turn} onRetry={onRetry} />
          <NovaAnswer turn={turn} live={live} onFollowUp={(q) => onFollowUp(q, turn.id)} />
        </NovaMessage>
      </div>
    </article>
  );
}
