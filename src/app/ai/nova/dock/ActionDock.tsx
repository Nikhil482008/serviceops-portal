import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ChevronUp, X } from 'lucide-react';
import { NextStepDock } from './NextStepDock';
import { DOCK_OFFER } from './nextSteps';
import { useComposeRequest } from './composeRequest';
import { NovaOrb } from '../NovaOrb';
import type { NextStep } from './nextSteps';
import { prefersReducedMotion } from '../novaMotion';

/* WHAT SITS AT THE BOTTOM OF THE DRAWER — one thing at a time, on every persona.
 *
 * There used to be two: the dock, and the input beneath it. Both are answers to "what now", and
 * a reader has to rule one out before they can act on the other. So the dock takes the input's
 * seat while there is anything named to do, and the input is a keystroke away.
 *
 * TWO SHAPES, one seat:
 *
 *   DOCK   the named actions. The box is not drawn.
 *   BAND   the dock folded to one row — "Nova can do this for you · Show all 3 actions" — fused
 *          to the top of the box, in one container.
 *
 * ── ONE SURFACE FOR EVERY PERSONA ────────────────────────────────────────────────────────────
 * This was the requester's. It is now where a TECHNICIAN's actions live too — they used to hang
 * under the turn on a └ connector, under a "NOVA RECOMMENDS" eyebrow, with a second strip of
 * question-chips floating above the box — and where a LEADERSHIP turn's follow-ups live. Three
 * personas had three answers to "what can I do from here"; the answer is one place, and the only
 * thing that varies is what is in it.
 *
 * The ONE difference by persona is the reassurance line under the open dock. A requester is being
 * offered actions on their own ticket by an assistant they did not ask for, and "nothing runs
 * until you choose" is the sentence that makes reading the list free. A technician and an
 * executive are reading a list of things they were going to do anyway; there, the line is a
 * system apologising for showing its work.
 *
 * ── BOTH EXITS LEAD TO THE BAND, AND DIFFER ONLY IN WHERE THE CARET LANDS ────────────────────
 * ✕ says "these options are not what I want right now" and leaves focus on the band. "Ask
 * something else" (and "/") says "none of these, I want to type" and puts the caret in the box.
 * Same container, same one press back to the options, different starting point — which is the
 * whole of the difference between the two intents, and the only part worth expressing.
 *
 * ⚠️ THE DRAFT HAS TO BE CARRIED. The dock TAKES this seat, so showing the options unmounts the
 * box and everything typed into it. That is why `draftRef` lives here and not in the box: a
 * half-written sentence must not be the price of glancing at the options.
 *
 * ── DISCARDED WITH THE TURN ──────────────────────────────────────────────────────────────────
 * Keyed on the option set upstream, so a new turn brings a fresh dock: no mode carried over, no
 * draft carried over. A collapsed strip that survived into the next answer would be hiding
 * options the reader has never seen.
 */

type Mode = 'dock' | 'band' | 'dismissed';

/** Which shape the seat is in. The drawer reads it so the follow-up chips under the answer can
 *  stay out of the way while the dock is open — see NovaAnswer. */
export type DockMode = Mode;

export type DockPersona = 'requester' | 'technician' | 'leadership';

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

export function ActionDock({ steps, persona, renderComposer, onRan, onMode }: {
  steps: NextStep[];
  /** Only the reassurance line reads this. Everything else is identical by design. */
  persona: DockPersona;
  renderComposer: (seat: ComposerSeat) => React.ReactNode;
  onRan?: (step: NextStep) => void;
  /** The shape changed. The drawer needs it because the follow-up chips are rendered UP in the
   *  thread, four components away, and they hide while the options are open. */
  onMode?: (mode: Mode) => void;
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

  /* ONE OFFER ON SCREEN AT A TIME. The chips under the answer read this: open, and they are not
     drawn; folded, and they come back whole. Reported rather than lifted, because the mode is
     this component's — the seat is re-keyed on the option set upstream, so a new turn resets it
     without anyone having to remember to. */
  const modeRef = useRef(onMode);
  modeRef.current = onMode;
  useEffect(() => { modeRef.current?.(mode); }, [mode]);

  /* A CORRECTION, OR A PREFIX, NEEDS A BOX. "Not what I meant?" and "Change the plan" are both
     pressed while the dock is in the input's seat, so the request folds it to the band first —
     seeding an input that is not rendered is seeding nothing. The drawer then fills it; this only
     makes somewhere for the text to land. */
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

  if (!steps.length) return null;

  return (
    <div ref={seatRef} className="nova-dockseat" data-dockseat data-persona={persona} data-mode={mode} data-h={h || undefined}>
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
          are an offer and not a queue, and that reading them costs nothing.
          REQUESTER ONLY. A technician's rows are the job; an executive's are the next question.
          Neither needs reassuring that a list is optional, and a system that says so anyway is
          explaining itself to people who were not worried. */}
      {mode === 'dock' && persona === 'requester' && (
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
               whatever the drawer is seeding, which is how "Not what I meant?" and "Change the
               plan" reach this box. */
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
