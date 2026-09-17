import { NovaOrb } from './nova/NovaOrb';
import { ASK_AI_SHORTCUT_LABEL } from './AskAiRailButton';

/* THE HANDLE — the orb, tucked into the right edge, and what it becomes when you reach for it.
 *
 * ── AT REST IT IS THE ORB AND NOTHING ELSE ───────────────────────────────────────────────────
 * What replaced a 26×52px half-circle carrying the letters "AI": two characters were all that
 * shape could hold, and "AI" is the category, not the thing. Nova has a mark of its own, and a
 * mark that is already the product's identity does not need a label beside it at rest — it needs
 * to be RECOGNISED, which is what an orb does and what two letters cannot.
 *
 * So at rest the handle is the orb in a white rim, most of it past the viewport edge: present,
 * unmistakable, and costing about twenty pixels of a page nobody opened to look at chrome.
 *
 * ── ON HOVER IT SAYS WHAT IT IS ──────────────────────────────────────────────────────────────
 * It slides out into a pill — orb, "Ask Nova", and the keystroke — because the moment a pointer
 * arrives is the moment a name is worth its width, and not one moment earlier. The slide has a
 * little overshoot: the handle is coming to MEET the pointer, and a spring is what that reads as.
 * Everything else is calm.
 *
 * ── THE PARTS THAT ARE NOT THE ORB ───────────────────────────────────────────────────────────
 * The glow behind it and the update pip are wrappers, deliberately: the orb is one shared
 * component with one job, and an entry point's attention-seeking is the entry point's business.
 * `siri-orb` knows nothing about either.
 *
 * ── THE KEYSTROKE IS THE REAL ONE ────────────────────────────────────────────────────────────
 * It prints whatever `ASK_AI_SHORTCUT_LABEL` resolves to — ⌘J on a Mac, Ctrl+J elsewhere — and
 * not a nicer-looking ⌘K, which in this product opens global search. A shortcut printed on a
 * control has to be the shortcut that works, or the control is teaching people a wrong thing
 * every time they look at it.
 */
export function NovaHandle({ open, onOpen, nudge }: {
  /** The assistant is on screen — the handle stands down. */
  open: boolean;
  onOpen: (el: HTMLElement) => void;
  /** Something is waiting. Grows the handle to 44px for a second line and lights the pip. */
  nudge?: { line: string } | null;
}) {
  return (
    <button
      type="button"
      className="nova-handle"
      data-nova-handle
      data-nudge={nudge ? 'true' : undefined}
      aria-label={`Ask Nova${nudge ? ` — ${nudge.line}` : ''}`}
      aria-keyshortcuts={ASK_AI_SHORTCUT_LABEL.startsWith('⌘') ? 'Meta+J' : 'Control+J'}
      aria-expanded={open}
      onClick={(e) => onOpen(e.currentTarget)}
    >
      {/* Behind the orb, outside it, and faster when reached for. */}
      <span className="nova-handle-glow" aria-hidden="true" />
      <span className="nova-handle-orb">
        {/* The rim is the handle's, not the orb's — see .nova-handle-orb. */}
        <NovaOrb size={26} state={open ? 'settled' : 'idle'} />
        {nudge && <span className="nova-handle-pip" aria-hidden="true" />}
      </span>
      <span className="nova-handle-body">
        <span className="nova-handle-label">Ask Nova</span>
        {/* One line, only when there is something to say. This is the whole of the 44px state. */}
        {nudge && <span className="nova-handle-line">{nudge.line}</span>}
      </span>
      <span className="nova-handle-key" aria-hidden="true">{ASK_AI_SHORTCUT_LABEL}</span>
    </button>
  );
}
