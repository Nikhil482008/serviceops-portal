import { useEffect, useId, useRef } from 'react';
import { ChevronRight, Keyboard, X } from 'lucide-react';
import { DOCK_OFFER, type NextStep } from './nextSteps';
import { stepIcon } from './stepIcon';
import { NovaOrb } from '../NovaOrb';

/* THE NEXT-ACTION DOCK.
 *
 * One block at the bottom of the drawer, holding every forward action the reader can take from
 * the conversation's CURRENT state — what the cards' footers, the banners' inline actions and the
 * follow-up chips used to hold between them, in three places, in three shapes. It is always about
 * the last actionable turn; `nextStepsFor` decides what that is.
 *
 * ── IT IS NOT ABOVE THE INPUT. IT IS THE INPUT'S SEAT ────────────────────────────────────────
 * While there is anything to do, the dock sits where the box sits and the box is not drawn. Two
 * things at the bottom of a drawer are two answers to "what now", and the reader has to rule one
 * out before doing anything. The box is one keystroke away — "Ask something else", or "/" — and
 * that is the right distance for the thing you reach for when none of the named options fit.
 *
 * ── CLICK IS GO ──────────────────────────────────────────────────────────────────────────────
 * No selection state, no separate confirm. Option 1 for a mutate turn IS the confirm step, and
 * the card above the dock is the preview — which is the approval rule, kept by the structure
 * rather than by a second button.
 *
 * ── THE HEADER CARRIES ONE CONTROL ───────────────────────────────────────────────────────────
 * It used to carry three keycaps — 1 · 2 · 3 — restating the number already printed on the left
 * of every row. A hint that repeats what is beside it teaches nothing and costs the only corner
 * the header has. That corner now holds the one thing the reader might actually want from a block
 * that has taken the input's place: the way to put the input back.
 *
 * ── KEYBOARD ─────────────────────────────────────────────────────────────────────────────────
 * Digits 1–4 run the matching option when focus is not in a text field; "/" folds the dock and
 * takes the caret to the box.
 * Both are live only while the options are ON SCREEN — a shortcut that fires an option the reader
 * cannot see is a surprise, not a shortcut. The options are real buttons in DOM order, so Tab
 * reaches them after the thread.
 */
export function NextStepDock({ steps, onType, onRan, onHide }: {
  steps: NextStep[];
  /** "Ask something else" / "/" — folds the dock to the band and puts the caret in the box. */
  onType: () => void;
  /** An option ran — the drawer moves focus to what it produced. */
  onRan?: (step: NextStep) => void;
  /** The × — collapse to the strip and give the reader the plain box back. */
  onHide: () => void;
}) {
  const uid = useId();
  const stepsRef = useRef(steps);
  stepsRef.current = steps;

  const run = (s: NextStep) => {
    if (s.disabled) return;
    void s.run();
    onRan?.(s);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      /* Never while typing: a "1" in the composer is a character, and "/" is a path. */
      const typing = !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
      if (typing) return;
      /* Nor under a popover, a modal or the evidence drawer — those own the keyboard. */
      if (document.querySelector('.nova-pop, .nova-modal-scrim, [data-evidence-drawer]')) return;
      /* CAPTURE, ON WINDOW, AND STOPPED: the product binds "/" to global search, and with the
         drawer open — a modal dialog — that shortcut must not reach past it. Same for a digit. */
      if (e.key === '/') { e.preventDefault(); e.stopPropagation(); onType(); return; }
      if (/^[1-4]$/.test(e.key)) {
        const s = stepsRef.current[Number(e.key) - 1];
        if (!s || s.disabled) return;
        e.preventDefault();
        e.stopPropagation();
        run(s);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onType, onRan]);

  if (!steps.length) return null;

  /* Re-keyed on the option SET, so a new set remounts the rows and they rise in; a re-render
     with the same set does not replay the motion. */
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
              data-kind={s.kind}
              data-recommended={s.recommended ? 'true' : undefined}
              aria-disabled={s.disabled || undefined}
              aria-describedby={detailId}
              /* THE DIGIT IS NOT PRINTED, and this is where it survives. The shortcut is real and
                 a listener should hear it; drawing 1 · 2 · 3 back onto the tiles would restore
                 exactly the numbered-checklist reading this change exists to remove. */
              aria-keyshortcuts={i < 4 ? String(i + 1) : undefined}
              title={s.disabled ? (s.disabledReason ?? 'Not in this demo') : undefined}
              style={{ ['--i' as string]: i }}
              onClick={() => run(s)}
            >
              {/* WHAT KIND OF THING THIS DOES, derived from the label — see stepIcon.tsx. It
                  replaced a boxed number, which told the reader the row's POSITION: the one fact
                  about a set of choices that is never the one being chosen between. */}
              <span className="nova-dock-tile" aria-hidden="true"><Verb size={17} strokeWidth={1.75} /></span>
              <span className="nova-dock-text">
                <span className="nova-dock-label">
                  {s.label}
                  {s.recommended && <span className="sr-only"> · Nova recommends this</span>}
                </span>
                <span id={detailId} className="nova-dock-detail">{s.detail}</span>
              </span>
              {/* SAME WORDS AS THE TECHNICIAN'S ATTACHED ACTIONS. One recommender, one way of saying so -
                  "Recommended" here and "Nova recommends" there read as two different systems. */}
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
