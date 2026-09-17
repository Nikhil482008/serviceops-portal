import { MessageSquare } from 'lucide-react';
import type { FollowUp } from '../scripts/registry';

/* WHAT ELSE I COULD ASK.
 *
 * ── TWO OR THREE, UPFRONT ────────────────────────────────────────────────────────────────────
 * The suggestions render together, capped at three: white pills, fully round, with a plain
 * hairline outline in the theme's border token. (The cool→warm gradient border was retired on
 * feedback — the shape and the speech-bubble glyph carry the identity; the gradient was the one
 * gradient outside the orb, and the orb is supposed to be the only one.)
 *
 * ── EVERY CHIP IS LIVE ───────────────────────────────────────────────────────────────────────
 * There is no disabled variant. A chip that cannot be answered is not authored at all: a reader
 * reads it, weighs it, reaches for it and is told it was never going to work, which costs more
 * attention than the visible intent was worth. `FollowUp` has no `disabled` member, so this is
 * enforced at the type rather than trusted to the author.
 *
 * ── A LOCAL CHIP NEVER OPENS A TURN ──────────────────────────────────────────────────────────
 * A chip authored `{ label, local }` is a variant switch on THIS answer (TEC-05's "Make it
 * shorter" swaps the draft's tone). It calls `onLocal`, never askNova — the one exception to
 * "every chip is a question", declared on the fixture rather than sniffed from the label.
 *
 * ── THEY BELONG TO THE NEWEST ANSWER ONLY ────────────────────────────────────────────────────
 * Asking something else takes them away. They used to stay on screen greyed out, on the argument
 * that removing them rewrites the history the reader is scrolling through — but a suggestion is
 * not history. It is an offer about what to do NEXT, and once the reader has done something
 * next the offer has been answered: a column of dead pills between every pair of turns is the
 * thread telling you about roads not taken. The answers stay; only the offers go.
 *
 * ── NO VISIBLE HEADING ───────────────────────────────────────────────────────────────────────
 * A pill carrying a speech-bubble glyph and a question is self-describing. The heading survives
 * as `sr-only` because shape and iconography reach no screen reader — without it a listener
 * meets unexplained buttons after the answer.
 */
export function FollowUpSuggestions({ questions, live, onAsk, onLocal }: {
  questions: FollowUp[];
  /** False once a newer turn exists — and then there are no suggestions at all. */
  live: boolean;
  onAsk: (question: string) => void;
  /** A local variant switch — `key` is the authored `local` value. */
  onLocal?: (key: string) => void;
}) {
  /* A PAST ANSWER MAKES NO OFFERS. Not disabled, not faded — gone, so the thread reads as
     question · answer · question · answer with nothing dead between the pairs. */
  if (!live) return null;
  const shown = questions.slice(0, 3);
  if (!shown.length) return null;

  return (
    <section style={{ marginTop: 'var(--nova-gap-block)' }}>
      <h4 className="sr-only">You could also ask</h4>
      <div className="flex flex-wrap gap-2">
        {shown.map((q) => {
          const label = typeof q === 'string' ? q : q.label;
          const local = typeof q !== 'string' && 'local' in q ? q.local : undefined;
          return (
            <button
              key={label}
              type="button"
              onClick={() => (local ? onLocal?.(local) : onAsk(label))}
              data-followup
              data-local={local}
              className="nova-btn nova-pill nova-hit"
            >
              <MessageSquare size={12} className="nova-pill-icon" aria-hidden="true" />
              {label}
            </button>
          );
        })}
      </div>
    </section>
  );
}

/** The role this component plays in the trust-experience component set. One implementation. */
export { FollowUpSuggestions as NovaSuggestedQuestions };
