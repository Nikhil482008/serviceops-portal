/* The right-edge Ask AI strip.
 *
 * A 5px ribbon of flowing AI gradient down the full height of the window. Hovering widens it to
 * 15px and fades in a vertical "Ask AI"; clicking opens the assistant, exactly as the rail button
 * does.
 *
 * TWO THINGS ALREADY LIVE AT THIS EXACT POSITION, and both are handled here rather than left to
 * be discovered:
 *
 * 1. `MinimizedDrawerRail` is `fixed right-0 top-0 h-screen w-7 hover:w-9 … z-50` — the strip a
 *    minimised ticket/asset drawer collapses to. This strip sits at z-40, BELOW it, so an open
 *    record always wins the edge. When a drawer is minimised the 28px opaque rail simply covers
 *    this one, which is the right precedence: a record you are working on beats a launcher.
 *
 * 2. The main content area's scrollbar. Every list page ends in `flex-1 overflow-auto` running to
 *    the viewport's right edge, and theme.css gives those an 8px gutter. A 5px strip covers 5 of
 *    those 8, and widening to 15px covers all of it — triggered by the very gesture of reaching
 *    for the thumb. There is no way to have both flush against the same edge. This is built as
 *    specified, flush; if it fights scrolling in practice the fix is one line — `right-[8px]`
 *    here, which clears the gutter at the cost of not being flush.
 */
import { isAskAiEnabled } from './flags';
import { rememberOpener, useAskAiActionsOptional, useAskAiStateOptional } from './AskAiProvider';

export function AskAiEdge() {
  /* Unconditional hooks, absent-tolerant — this renders from App, but the same rule that applies
     to the rail button applies here. */
  const actions = useAskAiActionsOptional();
  const state = useAskAiStateOptional();

  if (!isAskAiEnabled() || !actions || !state) return null;

  /* Hidden while the assistant is actually on screen: in sidebar and full screen the panel covers
     this edge anyway, and in floating a launcher for something already open is just clutter.
     MINIMISED is deliberately not "on screen" — the strip comes back as a second way in, beside
     the pill. */
  if (state.open && !state.minimized) return null;

  return (
    <button
      type="button"
      aria-label="Ask AI"
      title="Ask AI"
      onClick={(e) => {
        rememberOpener(e.currentTarget);
        /* Opens in whatever layout was last chosen rather than forcing Sidebar. The layout menu
           exists precisely so that preference is the user's; a launcher that silently overrode it
           would make the setting feel broken. */
        actions.open();
      }}
      className="askai-edge group fixed right-0 top-0 z-40 h-screen w-[5px] cursor-pointer overflow-hidden transition-[width] duration-200 ease-out hover:w-[15px] focus-visible:w-[15px] focus-visible:outline-none"
    >
      {/* The label only exists at 15px — at 5px there is nowhere to put it, so it fades with the
          width rather than being clipped. `aria-hidden` because the button is already labelled;
          this is the same words twice to a screen reader otherwise. */}
      <span aria-hidden="true" className="askai-edge-label">Ask AI</span>
    </button>
  );
}
