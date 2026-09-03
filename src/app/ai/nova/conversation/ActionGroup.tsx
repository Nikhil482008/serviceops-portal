import { useState } from 'react';
import { Check, RotateCcw } from 'lucide-react';
import type { AnswerObject } from '../novaStream';

/* WHAT I CAN DO — under its own heading, so it cannot be mistaken for more prose.
 *
 * ── THESE BUTTONS USED TO DO NOTHING ─────────────────────────────────────────────────────────
 * A solid primary with no `onClick`: the last thing in the flow, the thing the whole
 * investigation exists to earn, and pressing it did nothing at all. What it CANNOT do is write a
 * record — there is no backend — so it confirms and says plainly that nothing was written. A
 * confident fake confirmation would be worse than the dead button it replaces.
 *
 * ── AND THEY WERE NOT ALL THE SAME KIND OF THING ─────────────────────────────────────────────
 * Ten labels across six scripts, rendered identically: create a record, open one, run an export,
 * and five times out of ten ask Nova another question. The script now DECLARES which it is
 * (`runAsks` / `cancelAsks`), so an alternative question opens a new turn instead of silently
 * dismissing the answer. The alternative was sniffing the label with `toLowerCase().includes()`,
 * which is the pattern this module exists to replace.
 *
 * ── APPROVAL, FOR THE ONE THAT COMMITS ───────────────────────────────────────────────────────
 * A primary that changes something asks once, in place, naming what it will do. Not a modal: a
 * dialog for a two-word confirmation is heavier than the thing being confirmed.
 */

/** The Doherty ceiling. Feedback is instant — the label changes on the press — and this is how
 *  long the "working" state is held before the result, not a delay invented to look busy. */
const ACK_MS = 400;

export function ActionGroup({ answer: a, onAsk, onDiscard }: {
  answer: AnswerObject;
  onAsk: (question: string) => void;
  onDiscard: () => void;
}) {
  const [phase, setPhase] = useState<'idle' | 'confirm' | 'busy' | 'done'>('idle');
  if (!a.footer) return null;
  const f = a.footer;

  /* An ask is not a commitment: it opens a turn and this group is unchanged. Only the primary
     that COMMITS goes through review → approve → execute → confirm. */
  const commits = !f.runAsks;

  if (phase === 'done') {
    return (
      <section style={{ marginTop: 'var(--nova-gap-block)' }}>
        <p className="flex items-center gap-1.5 ask-text-base ask-w-500 text-[#0F6E4F]">
          <Check size={14} aria-hidden="true" />
          {f.run}
        </p>
        <p className="nova-devnote mt-2 rounded-r px-2.5 py-1.5">
          <span className="nova-t-label mr-2 align-middle text-[#8A6D1F]">Dev</span>
          Prototype — nothing was created, changed or opened. This confirms the interaction, not
          a record.
        </p>
      </section>
    );
  }

  return (
    <section style={{ marginTop: 'var(--nova-gap-block)' }}>
      <h4 className="nova-t-label">Available actions</h4>

      {phase === 'confirm' ? (
        /* Review → approve. Named, so "Confirm" is never the only word on screen. */
        <div className="mt-2">
          <p className="nova-t-body">
            {f.run} — this cannot be undone from here.
          </p>
          <div className="mt-2 flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                setPhase('busy');
                window.setTimeout(() => setPhase('done'), ACK_MS);
              }}
              className="nova-btn nova-btn-primary inline-flex h-9 items-center rounded px-4 ask-text-base ask-w-500"
            >Confirm</button>
            <button
              type="button"
              onClick={() => setPhase('idle')}
              className="nova-btn nova-btn-ghost inline-flex h-9 items-center rounded px-3 ask-text-base"
            >Back</button>
          </div>
        </div>
      ) : (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            disabled={phase === 'busy'}
            onClick={() => {
              if (f.runAsks) { onAsk(f.run); return; }
              setPhase('confirm');
            }}
            /* §14 — the ONE action that commits gets a real primary: 36px, 14px label. The
               suggestion pills below are the same height but never fill, so the two read as
               different kinds of thing rather than as a loud one and a quiet one. */
            className="nova-btn nova-btn-primary inline-flex h-9 items-center rounded px-4 ask-text-base ask-w-500"
          >{phase === 'busy' ? 'Working…' : f.run}</button>

          <button
            type="button"
            disabled={phase === 'busy'}
            onClick={() => { if (f.cancelAsks) onAsk(f.cancel); else onDiscard(); }}
            className="nova-btn nova-btn-ghost inline-flex h-9 items-center rounded px-3 ask-text-base"
          >{f.cancel}</button>

          {commits && (
            <span className="nova-t-meta w-full">Nova will not act until you confirm.</span>
          )}
        </div>
      )}
    </section>
  );
}

/** The discarded state, and the way back out of it. Discarding a draft someone watched nine
 *  checks produce, with no undo, is the one irreversible thing on this screen. */
export function DiscardedNotice({ onUndo }: { onUndo: () => void }) {
  return (
    <div className="flex items-center gap-2" style={{ marginTop: 'var(--nova-gap-block)' }}>
      <span className="nova-t-body text-[var(--nova-ink-muted)]">Discarded.</span>
      <button
        type="button"
        onClick={onUndo}
        className="nova-btn nova-btn-ghost inline-flex h-7 items-center gap-1 rounded px-2 ask-text-sm ask-w-500"
      ><RotateCcw size={12} aria-hidden="true" /> Undo</button>
    </div>
  );
}
