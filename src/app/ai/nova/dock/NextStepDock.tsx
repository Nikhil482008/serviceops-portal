import { useEffect, useId, useRef, useState } from 'react';
import { ChevronRight, Keyboard, X } from 'lucide-react';
import { DOCK_OFFER, type NextStep } from './nextSteps';
import { stepIcon } from './stepIcon';
import { NovaOrb } from '../NovaOrb';
import { prefersReducedMotion } from '../novaMotion';

/* THE DOCK'S ROWS — the expanded state of ActionDock, for every persona.
 *
 * One block at the bottom of the drawer, holding every forward action the reader can take from
 * the conversation's CURRENT state — what the cards' footers, the attached button stacks, the
 * banners' inline actions and the follow-up chips used to hold between them, in four places, in
 * four shapes. It is always about the LATEST turn; the selectors decide what that offers.
 *
 * ── IT IS NOT ABOVE THE INPUT. IT IS THE INPUT'S SEAT ────────────────────────────────────────
 * While there is anything to do, the dock sits where the box sits and the box is not drawn. Two
 * things at the bottom of a drawer are two answers to "what now", and the reader has to rule one
 * out before doing anything. The box is one keystroke away — "Ask something else", or "/" — and
 * that is the right distance for the thing you reach for when none of the named options fit.
 *
 * ── CLICK IS GO ──────────────────────────────────────────────────────────────────────────────
 * No selection state, no separate confirm. The recommended row on a mutate turn IS the confirm
 * step, and the card above the dock is the preview — which is the approval rule, kept by the
 * structure rather than by a second button.
 *
 * ── THE LABEL CAN CHANGE UNDER THE READER ────────────────────────────────────────────────────
 * Selecting cards in the turn above relabels the recommended row IN PLACE — "Start INC-1077 now"
 * → "Start 2 selected" — with a 120ms crossfade. The row is not re-mounted and its height does
 * not change: the thing that moved is the reader's own selection, and a dock that jumped under
 * their cursor would be arguing with them about it.
 *
 * ── KEYBOARD ─────────────────────────────────────────────────────────────────────────────────
 * Digits 1–4 run the matching row, Cmd/Ctrl+Enter runs the recommended one, and "/" folds the
 * dock and takes the caret to the box — all only while focus is NOT in a text field.
 * They are live only while the options are ON SCREEN: a shortcut that fires an option the reader
 * cannot see is a surprise, not a shortcut. The options are real buttons in DOM order, so Tab
 * reaches them after the thread.
 */

/** THE LABEL, CROSSFADING IN PLACE. The outgoing text fades over the incoming one for 120ms; the
 *  button is not re-mounted, so nothing above it moves and the row keeps its height. */
function Relabel({ text }: { text: string }) {
  const [prev, setPrev] = useState<string | null>(null);
  const last = useRef(text);
  useEffect(() => {
    if (last.current === text) return;
    const from = last.current;
    last.current = text;
    /* On this setting the label simply IS the new one. A crossfade is the response, and the
       response is what someone asked us not to draw. */
    if (prefersReducedMotion()) return;
    setPrev(from);
    const t = window.setTimeout(() => setPrev(null), 120);
    return () => clearTimeout(t);
  }, [text]);
  return (
    <span className="nova-do-text" data-relabel={prev !== null ? 'true' : 'false'}>
      <span key={text} className="nova-do-text-in">{text}</span>
      {prev !== null && <span className="nova-do-text-out" aria-hidden="true">{prev}</span>}
    </span>
  );
}

export function NextStepDock({ steps, onType, onRan, onHide }: {
  steps: NextStep[];
  /** "Ask something else" / "/" — folds the dock to the band and puts the caret in the box. */
  onType: () => void;
  /** An option ran — the drawer moves focus to what it produced. */
  onRan?: (step: NextStep) => void;
  /** The × — collapse to the band and give the reader the plain box back. */
  onHide: () => void;
}) {
  const uid = useId();
  const stepsRef = useRef(steps);
  stepsRef.current = steps;
  const ranRef = useRef(onRan);
  ranRef.current = onRan;

  const run = (s: NextStep) => {
    if (s.disabled) return;
    void s.run();
    ranRef.current?.(s);
  };
  const runRef = useRef(run);
  runRef.current = run;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      /* Never while typing: a "1" in the composer is a character, and "/" is a path. */
      const typing = !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
      if (typing) return;
      /* Nor under a popover, a modal or the evidence drawer — those own the keyboard. */
      if (document.querySelector('.nova-pop, .nova-modal-scrim, [data-evidence-drawer], [data-kb-sheet]')) return;
      /* THE RECOMMENDED ONE, from anywhere in the drawer. The same chord the attached actions
         carried, kept when they became rows: the default should be reachable without aiming. */
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey) {
        const rec = stepsRef.current.find((s) => s.recommended && !s.disabled);
        if (!rec) return;
        e.preventDefault();
        e.stopPropagation();
        runRef.current(rec);
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      /* CAPTURE, ON WINDOW, AND STOPPED: the product binds "/" to global search, and with the
         drawer open — a modal dialog — that shortcut must not reach past it. Same for a digit. */
      if (e.key === '/') { e.preventDefault(); e.stopPropagation(); onType(); return; }
      if (/^[1-4]$/.test(e.key)) {
        const s = stepsRef.current[Number(e.key) - 1];
        if (!s || s.disabled) return;
        e.preventDefault();
        e.stopPropagation();
        runRef.current(s);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onType]);

  if (!steps.length) return null;

  /* Re-keyed on the option SET, so a new set remounts the rows and they rise in; a re-render
     with the same set — a relabel, a selection — does not replay the motion. */
  const setKey = steps.map((s) => s.id).join('|');

  return (
    <>
      <div className="nova-dock-head">
          {/* THE SAME OBJECT AT 8px. It was a gradient-filled span wearing the brand colours
              by hand; now it is the orb, held still. One place the identity is drawn means the
              dot beside a label cannot drift from the mark beside a message. */}
        <NovaOrb size={8} still state="settled" className="nova-dock-dot" />
        {/* A SENTENCE, not a section tag. "NEXT ACTION" named a slot in a sequence — which is
            what the numbered rows underneath were also saying, twice. This says what is on
            offer, and the rows below are the offer. Sentence case on purpose: the uppercase
            eyebrow system is for labels, and this stopped being a label. */}
        <span className="nova-dock-title">{DOCK_OFFER}</span>
        {/* THE ONE CONTROL. 16px mark, 28px pressable — law 2: the thing you keep missing is
            worse than the thing that is not there, because people stop trying. */}
        <button
          type="button"
          className="nova-dock-hide"
          data-dock-hide
          aria-label="Hide actions"
          title="Hide actions"
          onClick={onHide}
        ><X size={16} aria-hidden="true" /></button>
      </div>
      <div className="nova-dock-list" key={setKey}>
        {steps.map((s, i) => {
          const detailId = `${uid}-d${i}`;
          const Verb = stepIcon(s);
          return (
            <button
              key={s.id}
              type="button"
              className="nova-dock-opt"
              data-dock-option={i + 1}
              data-step={s.id}
              data-kind={s.kind}
              data-recommended={s.recommended ? 'true' : undefined}
              aria-disabled={s.disabled || undefined}
              aria-describedby={s.detail ? detailId : undefined}
              /* THE DIGIT IS NOT PRINTED, and this is where it survives. The shortcut is real and
                 a listener should hear it; drawing 1 · 2 · 3 back onto the tiles would restore
                 exactly the numbered-checklist reading this change exists to remove. */
              aria-keyshortcuts={i < 4 ? String(i + 1) : undefined}
              title={s.disabled ? (s.disabledReason ?? 'Not in this demo') : undefined}
              style={{ ['--i' as string]: i }}
              onClick={() => run(s)}
            >
              {/* WHAT KIND OF THING THIS DOES — the action's own verb where it declares one, and
                  otherwise read off the label. See stepIcon.tsx. It replaced a boxed number, which
                  told the reader the row's POSITION: the one fact about a set of choices that is
                  never the one being chosen between. */}
              <span className="nova-dock-tile" aria-hidden="true"><Verb size={17} strokeWidth={1.75} /></span>
              <span className="nova-dock-text">
                <span className="nova-dock-label">
                  <Relabel text={s.label} />
                  {s.recommended && <span className="sr-only"> · Nova recommends this</span>}
                </span>
                {/* NO EMPTY SECOND LINE. A row with nothing to add is a one-line row, not a
                    two-line row with a blank in it. */}
                {!!s.detail && <span id={detailId} className="nova-dock-detail">{s.detail}</span>}
              </span>
              {/* SAME WORDS EVERYWHERE. One recommender, one way of saying so. */}
              {s.recommended ? <span className="nova-dock-pill" aria-hidden="true">Nova recommends</span> : <span />}
              {/* THE GO. Decorative: the whole row is the button, and a screen reader that
                  announced an arrow after every label would be reading the furniture. */}
              <span className="nova-dock-go" aria-hidden="true"><ChevronRight size={15} strokeWidth={2} /></span>
            </button>
          );
        })}
        {/* THE LAST ROW IS THE INPUT. It said "Something else", with an ellipsis — the label of a
            menu's escape hatch, which is not what this is. It is the way to type, and a keyboard
            says that in one glyph. The "/" keycap stays: this row is where the shortcut is
            learned, and it is the only keycap left in the dock that teaches something. */}
        <button
          type="button"
          className="nova-dock-else"
          data-dock-else
          style={{ ['--i' as string]: steps.length }}
          onClick={onType}
        >
          {/* THE SAME 34px SLOT as the option icons, so the left edge is one line down the
              whole dock and this row reads as the last of the set rather than a footer. */}
          <span className="nova-dock-tile nova-dock-tile-kb" aria-hidden="true"><Keyboard size={17} strokeWidth={1.75} /></span>
          <span className="nova-dock-else-label">Ask something else</span>
          <span className="nova-keycap nova-keycap-xs" aria-hidden="true">/</span>
        </button>
      </div>
    </>
  );
}
