import { MessageSquare } from 'lucide-react';

/* WHAT ELSE I COULD ASK.
 *
 * ── NO VISIBLE HEADING ───────────────────────────────────────────────────────────────────────
 * The reference has none, and it is right: a pill carrying a speech-bubble glyph and a question
 * is already self-describing. "You could also ask" above three things that obviously are things
 * you could also ask spent a line saying what the next line showed.
 *
 * ⚠️ The heading survives as `sr-only`. Shape and iconography are what identify this group
 * visually, and neither reaches a screen reader — without the hidden heading a listener meets
 * three unexplained buttons after the answer.
 *
 * ── AND THEY ARE STILL NOT ACTIONS ───────────────────────────────────────────────────────────
 * The risk with pills has always been that they look like the action buttons above them: one row
 * changes a ticket, the other asks a question. Three things keep them apart — they never fill,
 * they carry a speech bubble, and their border is the cool tint rather than the ink of a
 * control. That is a weaker separation than the fully-round shape I used before, so the glyph is
 * doing more work now and is not optional.
 */
export function FollowUpSuggestions({ questions, live, onAsk }: {
  questions: string[];
  live: boolean;
  onAsk: (question: string) => void;
}) {
  const shown = questions.slice(0, 3);
  if (!shown.length) return null;

  return (
    <section style={{ marginTop: 'var(--nova-gap-block)' }}>
      <h4 className="sr-only">You could also ask</h4>
      <div className="flex flex-wrap gap-2">
        {shown.map((q) => (
          <button
            key={q}
            type="button"
            disabled={!live}
            onClick={() => onAsk(q)}
            data-followup
            className="nova-btn nova-pill nova-hit"
          >
            <MessageSquare size={14} className="nova-pill-icon" aria-hidden="true" />
            {q}
          </button>
        ))}
      </div>
    </section>
  );
}
