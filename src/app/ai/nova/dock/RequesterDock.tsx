import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ChevronUp, X } from 'lucide-react';
import { NextStepDock } from './NextStepDock';
import { DOCK_OFFER } from './nextSteps';
import { useComposeRequest } from './composeRequest';
import { NovaOrb } from '../NovaOrb';
import type { NextStep } from './nextSteps';
import { prefersReducedMotion } from '../novaMotion';

/* WHAT SITS AT THE BOTTOM OF A REQUESTER'S DRAWER — one thing at a time.
 *
 * There used to be two: the dock, and the input beneath it. Both are answers to "what now", and
 * a reader has to rule one out before they can act on the other. So the dock takes the input's
 * seat while there is anything named to do, and the input is a keystroke away.
 *
 * TWO SHAPES, one seat:
 *
 *   DOCK   the named options. The box is not drawn.
 *   BAND   the dock folded to one row — "Nova can do this for you · Show all 3 actions" — fused
 *          to the top of the box, in one container.
 *
 * ── BOTH EXITS LEAD TO THE BAND, AND DIFFER ONLY IN WHERE THE CARET LANDS ────────────────────
 * ✕ says "these options are not what I want right now" and leaves focus on the band. "Ask
 * something else" (and "/") says "none of these, I want to type" and puts the caret in the box.
 * Same container, same one press back to the options, different starting point — which is the
 * whole of the difference between the two intents, and the only part worth expressing.
 *
 * There used to be a third shape: the dock's container MORPHING into the box, with a Back
 * control and a fading ghost of the option rows. Those parts solved a problem the band does not
 * have — the band never hides the way back, so there is nothing to go Back to. Two shapes that
 * end in the same place are one shape and a focus target.
 *
 * ⚠️ THE DRAFT STILL HAS TO BE CARRIED. The dock TAKES this seat, so showing the options unmounts
 * the box and everything typed into it. That is why `draftRef` lives here and not in the box: a
 * half-written sentence must not be the price of glancing at the options.
 *
 * ── DISCARDED WITH THE TURN ──────────────────────────────────────────────────────────────────
 * Keyed on the option set upstream, so a new turn brings a fresh dock: no mode carried over, no
 * draft carried over. A collapsed strip that survived into the next answer would be hiding
 * options the reader has never seen.
 */

type Mode = 'dock' | 'band' | 'dismissed';

/** "Show all 3 actions" / "Show action". The band never renders at zero, so there is no third
 *  form to write — and no "0 actions" state for anyone to reach. */
const showLabel = (n: number): string => (n === 1 ? 'Show action' : `Show all ${n} actions`);

/** How the drawer's composer should be configured for the seat it is in. */
export interface ComposerSeat {
  /** Draw no shell of its own — the dock's container is the shell. */
  bare: boolean;
  /** Take the caret on mount. */
  autoFocus: boolean;
  placeholder?: string;
  /** Every keystroke, so a draft outlives the box being unmounted by the dock. */
  onDraft?: (t: string) => void;
  /** Hand a held draft back when the box returns. */
  seed?: { text: string; nonce: number } | null;
}

export function RequesterDock({ steps, renderComposer, onRan }: {
  steps: NextStep[];
  renderComposer: (seat: ComposerSeat) => React.ReactNode;
  onRan?: (step: NextStep) => void;
}) {
  const [mode, setMode] = useState<Mode>('dock');
  /* WHERE THE CARET GOES when the band arrives. ✕ leaves it on the band — folding the options
     away is not a request to start typing. "Ask something else" puts it in the box, because that
     IS the request. Same shape, different starting point. */
  const [toBox, setToBox] = useState(false);
  /* HELD ONE LEVEL UP, because the dock takes this seat and unmounts the box with whatever was
     in it. A sentence someone was halfway through is not something to lose because they looked
     at the options. */
  const draftRef = useRef('');
  const [draft, setDraft] = useState('');
  const [seedNonce, setSeedNonce] = useState(0);
  const seatRef = useRef<HTMLDivElement | null>(null);
  const fromH = useRef<number | null>(null);

  /* THE SEAT IS IN FLOW. It takes the input's place rather than floating over the thread, so
     the last message cannot be behind it at any option count, in any of the three shapes,
     mid-animation included. What still overlays the thread is the fade this seat sits on, and
     the drawer measures that — see NovaDrawer's overlayRef. The height is published anyway, so
     a test can read what the seat actually measured rather than trusting the layout. */
  const [h, setH] = useState(0);
  useLayoutEffect(() => {
    const el = seatRef.current;
    if (!el) return;
    const read = () => setH(Math.ceil(el.getBoundingClientRect().height));
    read();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(read) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, []);

  const reduced = prefersReducedMotion();

  /* A CORRECTION NEEDS A BOX. "Not what I meant?" is pressed while the dock is in the input's
     seat, so the request folds it to the band first — seeding an input that is not rendered is
     seeding nothing. The drawer then fills it; this only makes somewhere for the text to land. */
  const compose = useComposeRequest();
  const composeNonce = useRef(compose?.nonce);
  useEffect(() => {
    if (!compose || compose.nonce === composeNonce.current) return;
    composeNonce.current = compose.nonce;
    setToBox(true);
    setMode('band');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compose?.nonce]);

  const go = (next: Mode, caretInBox = false) => {
    if (next === mode && toBox === caretInBox) return;
    if (!reduced) fromH.current = seatRef.current?.getBoundingClientRect().height ?? null;
    /* Catch whatever is in the box on the way out, and bump the nonce so the same text can be
       handed back more than once. */
    setDraft(draftRef.current);
    setSeedNonce((n) => n + 1);
    setToBox(caretInBox);
    setMode(next);
  };

  /* THE HEIGHT ANIMATION. From what the seat measured a frame ago to what it measures now —
     never from an authored number, because the dock's height is however many options this turn
     produced. */
  useLayoutEffect(() => {
    const el = seatRef.current;
    const from = fromH.current;
    fromH.current = null;
    if (!el || from == null) return;
    const to = el.getBoundingClientRect().height;
    if (Math.abs(to - from) < 1) return;
    const ms = 180;
    el.style.height = `${from}px`;
    el.style.overflow = 'hidden';
    void el.offsetHeight;                                   // commit the start, or there is no transition
    el.style.transition = `height ${ms}ms cubic-bezier(.2,.7,.3,1)`;
    el.style.height = `${to}px`;
    const t = window.setTimeout(() => {
      el.style.height = ''; el.style.transition = ''; el.style.overflow = '';
    }, ms + 40);
    return () => window.clearTimeout(t);
  }, [mode]);

  /* FOCUS FOLLOWS WHAT THE PRESS MEANT. ✕ says "not these options right now" and leaves the
     reader on the band — folding something away is not a request to start typing. "Ask something
     else" says "none of these, I want to type", so the caret goes to the box. One shape, two
     intents, and the only thing that distinguishes them is where you end up. */
  useEffect(() => {
    if (mode !== 'band') return;
    const id = requestAnimationFrame(() => {
      const root = seatRef.current;
      const target = toBox
        ? root?.querySelector<HTMLElement>('textarea')
        : root?.querySelector<HTMLElement>('[data-dock-band-open]');
      target?.focus();
    });
    return () => cancelAnimationFrame(id);
  }, [mode, toBox]);

  const keepDraft = (t: string) => { draftRef.current = t; };
  const toDock = () => { setDraft(draftRef.current); go('dock'); };

  if (!steps.length) return null;

  return (
    <div ref={seatRef} className="nova-dockseat" data-dockseat data-mode={mode} data-h={h || undefined}>
      {/* ── the options ───────────────────────────────────────────────────────────────── */}
      {mode === 'dock' && (
        <section
          className="nova-dock"
          aria-label="Next action"
          data-next-step-dock
          data-count={steps.length}
        >
          {/* BOTH CONTROLS FOLD IT TO THE BAND. They differ only in where the caret lands: ✕
              leaves it on the band, "Ask something else" puts it in the box. */}
          <NextStepDock
            steps={steps}
            onType={() => go('band', true)}
            onRan={onRan}
            onHide={() => go('band')}
          />
        </section>
      )}
      {/* ONE LINE, on the drawer surface rather than inside the dock's border — it is about the
          dock, not part of it. It says the thing the rows cannot say about themselves: that they
          are an offer and not a queue, and that reading them costs nothing. Only while the
          options are up; on the band there is nothing yet to decline. */}
      {mode === 'dock' && (
        <p className="nova-dock-note" data-dock-note>Pick any one — or none. Nothing runs until you choose.</p>
      )}

      {/* ── folded: ONE container — the band, a hairline, and the box ─────────────────────
          Not a strip floating above an input. Two rounded surfaces stacked on each other are two
          things, and the reader has to decide which one they are looking at; fused, the band
          reads as the input's own header — the place the assistant speaks from, with the place
          you speak from directly beneath it. */}
      {mode === 'band' && (
        <div className="nova-band-box" data-band-box>
          <div className="nova-band" data-dock-band>
            {/* A STRETCHED HIT, not a button wrapping the row's contents. The whole band opens
                the dock and the × does not, which is a button inside a button — invalid HTML, and
                announced inconsistently. So the band's hit area is one absolutely-positioned
                button UNDER the content, the content does not take pointer events, and the × sits
                back on top of it. Same behaviour, same tab order (band, then ×), valid markup. */}
            <button
              type="button"
              className="nova-band-hit"
              data-dock-band-open
              aria-expanded={false}
              aria-label={`${DOCK_OFFER}. ${showLabel(steps.length)}.`}
              onClick={() => go('dock')}
            />
            <NovaOrb size={14} still state="settled" className="nova-band-orb" />
            {/* THE SAME SENTENCE as the open dock's header — see DOCK_OFFER. Collapsing moves the
                line; it does not rename it. */}
            <span className="nova-band-title">{DOCK_OFFER}</span>
            <span className="nova-band-link" data-dock-band-link>
              {showLabel(steps.length)}
              <ChevronUp size={13} strokeWidth={2} aria-hidden="true" />
            </span>
            <button
              type="button"
              className="nova-band-x"
              data-dock-band-dismiss
              aria-label="Dismiss"
              title="Dismiss"
              /* The one part of the band that is not "open the dock". */
              onClick={(e) => { e.stopPropagation(); go('dismissed'); }}
            ><X size={15} aria-hidden="true" /></button>
          </div>
          {renderComposer({
            bare: true,
            autoFocus: toBox,
            placeholder: 'Ask Nova anything…',
            onDraft: (t) => { draftRef.current = t; },
            /* `undefined`, not `null`, when there is nothing held — the seat must FALL THROUGH to
               whatever the drawer is seeding, which is how "Not what I meant?" reaches this box. */
            seed: draft ? { text: draft, nonce: seedNonce } : undefined,
          })}
        </div>
      )}

      {/* ── dismissed: the plain box, plain border. For THIS turn only — the seat is keyed on
          the option set upstream, so the next answer brings its band back without anything here
          having to remember. */}
      {mode === 'dismissed' && renderComposer({
        bare: false,
        autoFocus: false,
        placeholder: 'Ask Nova anything…',
        onDraft: (t) => { draftRef.current = t; },
        seed: draft ? { text: draft, nonce: seedNonce } : undefined,
      })}
    </div>
  );
}
