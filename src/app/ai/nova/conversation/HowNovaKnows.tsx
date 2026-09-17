import type { HowKnows } from '../scripts/registry';
import { Emph } from './blocks';

/* HOW NOVA KNOWS — the requester's expanded fold.
 *
 * Answers one question in five to ten seconds of scanning: WHY DID NOVA GIVE ME THIS ANSWER?
 *
 *   REASONING               why the answer makes sense — the strongest section, 2–4 lines
 *   WHAT I CHECKED          the information considered — nouns, not an activity log
 *   WHAT I COULDN'T VERIFY  only when something materially limits the answer
 *
 * ── REASONING IS NOT CHAIN-OF-THOUGHT ────────────────────────────────────────────────────────
 * Each line is a fact and what it implies for the answer — "INC-0988 is In progress and was
 * updated 2 hours ago" — never "I considered", "I decided", "I first thought". The facts a reader
 * scans for (ids, counts, dates, statuses) are the only things in bold; whole sentences never
 * are. Where the answer is an INFERENCE, the conclusion is stated beneath the facts and labelled
 * as one, so an inference never wears a record's clothes.
 *
 * ── EACH LAYER HAS ONE JOB ───────────────────────────────────────────────────────────────────
 * The answer says what is true. Reasoning says why Nova believes it. Checked says what was
 * considered. Unverified says what is still uncertain. Nothing is said twice: a limit that
 * changes what the reader should DO is already on screen above the fold as the verification
 * notice, and is not repeated here.
 *
 * ── AND THE FOLD DOES NOT COUNT ITS SOURCES ──────────────────────────────────────────────────
 * WHERE to inspect is the row this fold hangs from, not a section inside it. That row already
 * carries the kind marks and the count, as the control that opens the drawer; the fold used to
 * repeat both, three sections down, reachable only by reading past everything it exists to say.
 * One count, in the one place that can act on it.
 *
 * ── THIS IS NOT THE THINKING PROCESS ─────────────────────────────────────────────────────────
 * The investigation trail answers "what is Nova doing right now"; this answers "why does Nova
 * believe this". The trail is untouched, and none of it is replayed here.
 *
 * Content is authored per case (`AnswerObject.how`) — each requester answer has its own
 * evidence, so no generic text is shared across them. Cases without it keep the generic fold.
 */
export function HowNovaKnows({ how }: { how: HowKnows }) {
  return (
    <div className="nova-hnk" data-hnk>
      <ReasoningEvidence items={how.reasoning} conclusion={how.conclusion} />
      <CheckedContext items={how.checked} />
      {!!how.unverified?.length && <UnverifiedEvidence items={how.unverified} />}
    </div>
  );
}

/** WHY the answer makes sense. A ✓ here means confirmed evidence — never "an activity happened". */
export function ReasoningEvidence({ items, conclusion }: { items: string[]; conclusion?: string }) {
  return (
    <section data-hnk-section="reasoning">
      <p className="nova-t-label">Reasoning</p>
      <ul className="nova-hnk-list">
        {items.map((t, i) => (
          <li key={i}>
            <span className="nova-hnk-mark nova-hnk-ok" aria-hidden="true">✓</span>
            <span className="nova-hnk-reason"><Emph>{t}</Emph></span>
          </li>
        ))}
      </ul>
      {conclusion && (
        <div className="nova-hnk-conclusion" data-hnk-conclusion>
          <p className="nova-t-label">Likely conclusion</p>
          <p className="nova-hnk-reason mt-1">
            <Emph>{conclusion}</Emph>
            <span className="nova-ev-type ml-2" data-authority="inference">AI inference</span>
          </p>
        </div>
      )}
    </section>
  );
}

/** WHAT was considered. Plain marks, not ticks: these are the records read, not evidence. */
export function CheckedContext({ items }: { items: string[] }) {
  return (
    <section data-hnk-section="checked">
      <p className="nova-t-label">What I checked</p>
      <ul className="nova-hnk-list nova-hnk-list-tight">
        {items.map((t, i) => (
          <li key={i}>
            <span className="nova-hnk-mark nova-hnk-dot" aria-hidden="true">·</span>
            <span className="nova-hnk-checked">{t}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** WHAT could not be verified — what is missing, and what that costs the answer. Rendered only
 *  when there is something to say. */
export function UnverifiedEvidence({ items }: { items: string[] }) {
  return (
    <section data-hnk-section="unverified">
      <p className="nova-t-label">What I couldn&rsquo;t verify</p>
      <ul className="nova-hnk-list">
        {items.map((t, i) => (
          <li key={i}>
            <span className="nova-hnk-mark nova-hnk-warn" aria-hidden="true">⚠</span>
            <span className="nova-hnk-reason"><Emph>{t}</Emph></span>
          </li>
        ))}
      </ul>
    </section>
  );
}

