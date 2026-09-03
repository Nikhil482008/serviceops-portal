import { useState } from 'react';
import { Check, ChevronDown, ListChecks } from 'lucide-react';
import { askComplete, type FeedAsk } from '../turnModel';

/* NOVA ASKS BEFORE IT ANSWERS.
 *
 * ── WHY THIS EXISTS AT ALL ───────────────────────────────────────────────────────────────────
 * "Ring any bells?" cannot be answered from one sentence. A technician would ask three things
 * out loud before saying yes — how many people, which network, what changed — and an assistant
 * that skips them is not being fast, it is guessing. So the stream genuinely STOPS here: the
 * emitter is parked until these come back, which is what makes the questions worth answering
 * rather than a form that appears while the work carries on behind it.
 *
 * ── ONE CARD, TWO STATES, SAME ROWS ──────────────────────────────────────────────────────────
 * While it is pending, one question is open and the rest are one-line rows. Once it resolves,
 * every row is closed and the card reads as the record of what was chosen. Deliberately NOT two
 * components: the answered card is what the pending card becomes, and building them separately
 * is how the two drift into looking like different objects (law 16).
 *
 *   ROW, CLOSED    question · Answered/Skipped · chevron        44px, expands
 *   ROW, OPEN      question, then its choices as radio rows     each 44px
 *
 * ── WHY ONE AT A TIME ────────────────────────────────────────────────────────────────────────
 * Three questions with four options each is twelve simultaneous choices, which is exactly the
 * load Hick's Law describes and Miller's Law says to break up. Opening one at a time makes it
 * three choices of four. The other rows stay VISIBLE though — that is the progress (law 11) and
 * the sense of an end in sight (law 20); hiding them would trade one problem for a worse one.
 *
 * ── NO SUBMIT BUTTON ─────────────────────────────────────────────────────────────────────────
 * A pick answers a question and opens the next. The set closes on the last pick. A Submit would
 * be a step that exists only to be pressed (law 18), and every pick stays changeable right up
 * until that last one — so nothing is lost by not having a confirmation to guard.
 *
 * ⚠️ THE ONE DEVIATION FROM THE REFERENCE. The reference prints "Running Tool: Ask User
 * Question" above the card. That names an internal mechanism, and this module has spent its
 * whole life keeping those off the screen — there is no "Thinking…" anywhere in it, because a
 * named check says what is happening and a machine noun does not. The card's own header carries
 * the same information in the product's voice, so the extra line would be a second affordance
 * for one thing.
 */
export function AskUserQuestion({ ask, live, onAnswer }: {
  ask: FeedAsk;
  /** False when the turn was stopped, failed, or has been overtaken. The card stays readable —
   *  it is a record of what was asked — but nothing in it is operable. */
  live: boolean;
  onAnswer: (answers: Record<string, string>, done: boolean) => void;
}) {
  /* An override, not the source of truth. Null means "whatever is next", which is what makes the
     card advance by itself without a step counter to keep in step with the answers. */
  const [opened, setOpened] = useState<string | null>(null);

  const pending = ask.status === 'pending';
  const operable = pending && live;
  const answeredCount = ask.questions.filter((q) => !!ask.answers[q.id]).length;
  const next = ask.questions.find((q) => !ask.answers[q.id]);
  const openId = opened ?? (operable ? next?.id ?? null : null);

  const pick = (questionId: string, choiceId: string) => {
    const merged = { ...ask.answers, [questionId]: choiceId };
    const done = ask.questions.every((q) => !!merged[q.id]);
    /* Only the delta travels. The turn owns the accumulation — see `recordAsk`. */
    onAnswer({ [questionId]: choiceId }, done);
    setOpened(null);
  };

  return (
    <section
      className="nova-ask"
      aria-labelledby={`${ask.id}-title`}
      style={{ marginTop: 'var(--nova-gap-block)' }}
    >
      {/* Worth interrupting a screen reader for, which is the test DiscoveryBlock's live region
          is held to — and this one clears it more easily than a finding does, because nothing
          further happens until it is dealt with. */}
      {operable && (
        <p role="status" className="sr-only">
          Nova needs {ask.questions.length} {ask.questions.length === 1 ? 'detail' : 'details'}
          {' '}before it can answer.
        </p>
      )}

      <div className="nova-ask-head">
        <ListChecks size={14} className="nova-ask-glyph" aria-hidden="true" />
        <div className="min-w-0">
          <h4 id={`${ask.id}-title`} className="nova-ask-title">
            {pending ? 'A few questions first' : 'Answered questions'}
          </h4>
          {/* Law 20 — while it is running this is the distance left, and it is specific. Once it
              is done the same slot names what the rows below now are. */}
          <p className="nova-ask-sub">
            {pending
              ? `${answeredCount} of ${ask.questions.length} answered`
              : 'You chose'}
          </p>
        </div>
      </div>

      <ol className="nova-ask-list">
        {ask.questions.map((q) => {
          const chosen = ask.answers[q.id];
          const choice = q.choices.find((c) => c.id === chosen);
          const open = openId === q.id;
          /* Everything after the open one, before it has been reached. Shown, but quiet — it is
             the road ahead, not a control. */
          const ahead = pending && !open && !chosen;

          return (
            <li key={q.id} className="nova-ask-row" data-open={open ? 'true' : 'false'}>
              {open ? (
                <fieldset className="nova-ask-open">
                  <legend className="nova-ask-q">{q.question}</legend>
                  <div className="nova-ask-choices">
                    {q.choices.map((c) => (
                      <label
                        key={c.id}
                        className="nova-ask-choice"
                        data-picked={chosen === c.id ? 'true' : 'false'}
                      >
                        {/* A REAL radio. Arrow-key movement within the group, the right
                            announcement, and the label's whole box as the target come free;
                            re-implementing them on buttons is how the keyboard case gets lost. */}
                        <input
                          type="radio"
                          className="sr-only"
                          name={`${ask.id}-${q.id}`}
                          value={c.id}
                          checked={chosen === c.id}
                          disabled={!operable}
                          onChange={() => pick(q.id, c.id)}
                        />
                        <span className="nova-ask-dot" aria-hidden="true">
                          {chosen === c.id && <Check size={11} strokeWidth={3} />}
                        </span>
                        <span className="min-w-0">
                          <span className="nova-ask-choice-label">{c.label}</span>
                          {/* What picking it MEANS, where that is not obvious from the label.
                              Never a restatement — a second line that says the same thing again
                              is a line the reader pays for twice. */}
                          {c.detail && <span className="nova-ask-choice-detail">{c.detail}</span>}
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              ) : (
                <button
                  type="button"
                  className="nova-ask-closed"
                  aria-expanded={false}
                  /* Nothing to expand once the whole set has been answered and the row is not
                     the record of a choice — an inert row should not offer a press. */
                  disabled={ahead || (!operable && !chosen)}
                  onClick={() => setOpened(q.id)}
                >
                  <span className="nova-ask-q" data-ahead={ahead ? 'true' : 'false'}>
                    {q.question}
                  </span>
                  <span className="nova-ask-tail">
                    {chosen ? (
                      <span className="nova-ask-badge">Answered</span>
                    ) : pending ? null : (
                      <span className="nova-ask-badge" data-skipped="true">Skipped</span>
                    )}
                    {!ahead && (
                      <ChevronDown size={13} className="nova-chev" data-open="false" aria-hidden="true" />
                    )}
                  </span>
                </button>
              )}

              {/* The choice itself, under its question, once the row is closed. This is the whole
                  point of the resolved card: not that it was answered, but WHAT was answered. */}
              {!open && choice && <p className="nova-ask-chosen">{choice.label}</p>}
            </li>
          );
        })}
      </ol>

      {/* Law 15 — a question that cannot be got past is a trap, and this one is holding a stream
          open. Quiet, because it is the way out and not the way through (law 7). */}
      {operable && !askComplete(ask) && (
        <div className="nova-ask-foot">
          <button
            type="button"
            className="nova-btn nova-btn-ghost nova-ask-skip"
            onClick={() => onAnswer({}, true)}
          >
            {answeredCount > 0 ? 'Carry on without the rest' : 'Skip these and carry on'}
          </button>
        </div>
      )}
    </section>
  );
}
