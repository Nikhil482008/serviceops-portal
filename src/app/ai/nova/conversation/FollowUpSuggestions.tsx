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
 * ── A DISABLED CHIP IS STILL SHOWN ───────────────────────────────────────────────────────────
 * A chip authored `{ label, disabled: true }` renders muted with "Not in this demo" — the intent
 * stays visible, the dead end is honest. It never gets hover, and the cursor says so.
 *
 * ── NO VISIBLE HEADING ───────────────────────────────────────────────────────────────────────
 * A pill carrying a speech-bubble glyph and a question is self-describing. The heading survives
 * as `sr-only` because shape and iconography reach no screen reader — without it a listener
 * meets unexplained buttons after the answer.
 */
export function FollowUpSuggestions({ questions, live, onAsk }: {
  questions: FollowUp[];
  /** False once a newer turn exists. Old suggestions stay VISIBLE but inert — removing them
   *  would rewrite the history the reader is scrolling through. */
  live: boolean;
  onAsk: (question: string) => void;
}) {
  const shown = questions.slice(0, 3);
  if (!shown.length) return null;

  return (
    <section style={{ marginTop: 'var(--nova-gap-block)' }}>
      <h4 className="sr-only">You could also ask</h4>
      <div className="flex flex-wrap gap-2">
        {shown.map((q) => {
          const label = typeof q === 'string' ? q : q.label;
          const off = typeof q !== 'string' && q.disabled;
          return (
            <button
              key={label}
              type="button"
              disabled={!live || off}
              title={off ? 'Not in this demo' : undefined}
              aria-disabled={off || undefined}
              onClick={() => onAsk(label)}
              data-followup
              data-demo-disabled={off ? 'true' : undefined}
              className={`nova-btn nova-pill nova-hit ${off ? 'nova-pill-off' : ''}`}
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
