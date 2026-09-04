import { useState } from 'react';
import { Check, ChevronDown, ListChecks } from 'lucide-react';
import { askComplete, type FeedAsk } from '../turnModel';
import type { AskQuestion } from '../novaStream';

/* NOVA ASKS BEFORE IT ANSWERS.
 *
 * ── WHY THIS EXISTS AT ALL ───────────────────────────────────────────────────────────────────
 * "Ring any bells?" cannot be answered from one sentence. A technician would ask three things
 * out loud before saying yes — how many people, which network, what changed — and an assistant
 * that skips them is not being fast, it is guessing. So the stream genuinely STOPS here: the
 * emitter is parked until these come back, which is what makes the questions worth answering
 * rather than a form that appears while the work carries on behind it.
 *
 * ── ONE QUESTION ON SCREEN, ANSWERED ONES ABOVE IT ───────────────────────────────────────────
 * While pending, the card shows what has been answered (one line each) and the question being
 * asked now — and NOTHING ELSE. The unreached questions used to render as bare grey rows, and
 * they read as exactly what they were: dead text with no badge, no control and no reason to be
 * there. The "N of M answered" counter already carries how much is left, so the rows carried
 * nothing. Removed on feedback.
 *
 * Once the set resolves, every row is a one-line record of what was chosen — which is the same
 * card, finished, not a second design (law 16).
 *
 * ── "SOMETHING ELSE" IS A REAL OPTION ────────────────────────────────────────────────────────
 * A fixed list is a guess about the answer, and the person answering is the one who knows.
 * A choice authored with `other: true` opens a text field; the typed text IS the answer, stored
 * in the same map as a picked choice id, and echoed back on the collapsed row like any other
 * choice. Free text does not auto-submit — an empty or half-typed sentence is not an answer, so
 * it confirms with Enter or its own button.
 *
 * ── NO SUBMIT BUTTON ON THE SET ──────────────────────────────────────────────────────────────
 * A pick answers a question and opens the next; the set closes on the last answer. A set-level
 * Submit would be a step that exists only to be pressed (law 18), and every answer stays
 * changeable right up until the last one lands.
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
  /* The free-text draft, per question — kept locally until confirmed, because an unfinished
     sentence must not release a parked stream. */
  const [draft, setDraft] = useState<{ q: string; text: string } | null>(null);

  const pending = ask.status === 'pending';
  const operable = pending && live;
  const answeredCount = ask.questions.filter((q) => !!ask.answers[q.id]).length;
  const next = ask.questions.find((q) => !ask.answers[q.id]);
  const openId = opened ?? (operable ? next?.id ?? null : null);

  const pick = (questionId: string, value: string) => {
    const merged = { ...ask.answers, [questionId]: value };
    const done = ask.questions.every((q) => !!merged[q.id]);
    /* Only the delta travels. The turn owns the accumulation — see `recordAsk`. */
    onAnswer({ [questionId]: value }, done);
    setOpened(null);
    setDraft(null);
  };

  /** The stored answer, read back as words: a choice's label, or the free text itself. */
  const said = (q: AskQuestion): string | null => {
    const v = ask.answers[q.id];
    if (!v) return null;
    return q.choices.find((c) => c.id === v)?.label ?? v;
  };

  /* Answered rows and the open question. The unreached ones are NOT rendered — the counter in
     the header is what says how much is left. Resolved shows everything, skipped included. */
  const visible = pending
    ? ask.questions.filter((q) => !!ask.answers[q.id] || q.id === openId)
    : ask.questions;

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
        {visible.map((q) => {
          const chosen = ask.answers[q.id];
          const matched = q.choices.find((c) => c.id === chosen);
          /* An answer that matches no choice id IS the free text the reader typed. */
          const isFree = !!chosen && !matched;
          const open = openId === q.id;
          const typing = draft?.q === q.id;

          return (
            <li key={q.id} className="nova-ask-row" data-open={open ? 'true' : 'false'}>
              {open ? (
                <fieldset className="nova-ask-open">
                  <legend className="nova-ask-q">{q.question}</legend>
                  <div className="nova-ask-choices">
                    {q.choices.map((c) => {
                      const picked = chosen === c.id || (c.other && (isFree || typing));
                      return (
                        <div key={c.id}>
                          <label
                            className="nova-ask-choice"
                            data-picked={picked ? 'true' : 'false'}
                          >
                            {/* A REAL radio. Arrow-key movement within the group, the right
                                announcement, and the label's whole box as the target come free;
                                re-implementing them on buttons is how the keyboard case gets
                                lost. */}
                            <input
                              type="radio"
                              className="sr-only"
                              name={`${ask.id}-${q.id}`}
                              value={c.id}
                              checked={!!picked}
                              disabled={!operable}
                              onChange={() => {
                                if (c.other) {
                                  /* Opens the field; the ANSWER is the confirmed text. */
                                  setDraft({ q: q.id, text: isFree ? chosen! : '' });
                                } else {
                                  pick(q.id, c.id);
                                }
                              }}
                            />
                            <span className="nova-ask-dot" aria-hidden="true">
                              {picked && <Check size={11} strokeWidth={3} />}
                            </span>
                            <span className="min-w-0">
                              <span className="nova-ask-choice-label">{c.label}</span>
                              {/* What picking it MEANS, where that is not obvious from the
                                  label. Never a restatement. */}
                              {c.detail && <span className="nova-ask-choice-detail">{c.detail}</span>}
                            </span>
                          </label>

                          {c.other && (typing || isFree) && (
                            <div className="nova-ask-other">
                              <label className="sr-only" htmlFor={`${ask.id}-${q.id}-other`}>
                                Your own answer
                              </label>
                              <input
                                id={`${ask.id}-${q.id}-other`}
                                type="text"
                                className="nova-ask-other-input"
                                placeholder="Type it here…"
                                value={typing ? draft!.text : chosen ?? ''}
                                disabled={!operable}
                                autoFocus={typing && !draft!.text}
                                onChange={(e) => setDraft({ q: q.id, text: e.target.value })}
                                onKeyDown={(e) => {
                                  const t = (typing ? draft!.text : chosen ?? '').trim();
                                  if (e.key === 'Enter' && t) pick(q.id, t);
                                }}
                              />
                              {/* 36px tall to sit level with the field; .nova-hit pads the
                                  pressable area back out to 44px. */}
                              <button
                                type="button"
                                className="nova-btn nova-btn-primary nova-hit nova-ask-other-go"
                                disabled={!operable || !(typing ? draft!.text.trim() : chosen)}
                                onClick={() => {
                                  const t = (typing ? draft!.text : chosen ?? '').trim();
                                  if (t) pick(q.id, t);
                                }}
                              >Use this</button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </fieldset>
              ) : (
                <button
                  type="button"
                  className="nova-ask-closed"
                  aria-expanded={false}
                  /* A row with nothing behind it should not offer a press — only a recorded
                     choice, or a still-changeable answer, earns the chevron. */
                  disabled={!operable && !chosen}
                  onClick={() => setOpened(q.id)}
                >
                  <span className="nova-ask-q">{q.question}</span>
                  <span className="nova-ask-tail">
                    {chosen ? (
                      <span className="nova-ask-badge">Answered</span>
                    ) : pending ? null : (
                      <span className="nova-ask-badge" data-skipped="true">Skipped</span>
                    )}
                    {(operable || chosen) && (
                      <ChevronDown size={13} className="nova-chev" data-open="false" aria-hidden="true" />
                    )}
                  </span>
                </button>
              )}

              {/* The choice itself, under its question, once the row is closed. This is the whole
                  point of the resolved card: not that it was answered, but WHAT was answered. */}
              {!open && said(q) && <p className="nova-ask-chosen">{said(q)}</p>}
            </li>
          );
        })}
      </ol>

      {/* Law 15 — a question that cannot be got past is a trap, and this one is holding a stream
          open. A TERTIARY button: quieter than an answer, but unmistakably pressable — the
          previous ghost treatment made the way out nearly invisible, which is its own kind of
          trap. */}
      {operable && !askComplete(ask) && (
        <div className="nova-ask-foot">
          <button
            type="button"
            className="nova-btn nova-ask-skip"
            onClick={() => onAnswer({}, true)}
          >
            {answeredCount > 0 ? 'Carry on without the rest' : 'Skip these and carry on'}
          </button>
        </div>
      )}
    </section>
  );
}
