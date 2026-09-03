/* The right-edge tabs: Ask AI, and chat.
 *
 * Two half-circles flush to the right edge, vertically centred — 26px of protrusion on a 52px
 * face, so the flat side is the viewport edge and the curve bulges into the page.
 *
 * This replaces a full-height 5px ribbon, and the change fixes a real problem rather than only
 * looking different. Every list page ends in `flex-1 overflow-auto` running to this same edge with
 * an 8px scrollbar gutter; a full-height strip sat over the whole track, so reaching for the thumb
 * widened the strip instead. Two 52px tabs leave the rest of the track clear.
 *
 * STILL TRUE, and handled: `MinimizedDrawerRail` is `fixed right-0 top-0 h-screen w-7 hover:w-9 …
 * z-50` — the strip a minimised record collapses to. These tabs sit at z-40, BELOW it, so an open
 * record always wins the edge.
 */
import { MessageSquare } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '../components/ui/tooltip';
import { isAskAiEnabled, isNovaShell } from './flags';
import { rememberOpener, useAskAiActionsOptional, useAskAiStateOptional } from './AskAiProvider';

export function AskAiEdge() {
  /* Unconditional hooks, absent-tolerant — the same rule the rail button follows. */
  const actions = useAskAiActionsOptional();
  const state = useAskAiStateOptional();

  if (!isAskAiEnabled() || !actions || !state) return null;

  /* Hidden while the assistant is actually on screen. MINIMISED is deliberately not "on screen":
     the tabs come back as a second way in, beside the pill. */
  /* Nova flies its orb back to whatever opened it, and it measures that element's rect at the
     moment of closing — so the trigger has to still BE there. It sits under the drawer, which
     covers this edge, so staying mounted costs nothing visually.
     The old panel keeps the original behaviour: it has no flight to come home to. */
  if (state.open && !state.minimized && !isNovaShell()) return null;

  const openWith = (el: HTMLElement, mode?: 'sidebar' | 'floating') => {
    rememberOpener(el);
    /* `setMode` also un-minimises, and `open` clears it too — either path lands you in the panel
       rather than back at the pill. */
    if (mode) actions.setMode(mode);
    actions.open();
  };

  return (
    <div className="fixed right-0 top-1/2 z-40 flex -translate-y-1/2 flex-col gap-2">
      {/* Ask AI — the animated one. Its outline is a conic gradient rotating around the tab, so
          the colour travels the curve rather than sliding across it; on a shape this small a
          sweep would read as a flicker. */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label="Ask AI"
            onClick={(e) => openWith(e.currentTarget)}
            className="askai-tab askai-tab-ai group flex h-[52px] w-[26px] cursor-pointer items-center justify-center rounded-l-full pr-px transition-[width] duration-200 ease-out hover:w-[32px] focus-visible:w-[32px] focus-visible:outline-none"
          >
            {/* Two letters is all that fits inside 26px, and it is the only text the shape can
                carry without turning into a label with a tab attached. */}
            <span aria-hidden="true" className="askai-tab-text">AI</span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="left" className="text-wrap">Ask AI</TooltipContent>
      </Tooltip>

      {/* Chat. Quiet by comparison — one animated thing on an edge is a signal, two competing is
          noise, and this is the secondary of the pair. */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label="Chat"
            onClick={(e) => openWith(e.currentTarget, 'floating')}
            className="askai-tab askai-tab-chat group flex h-[52px] w-[26px] cursor-pointer items-center justify-center rounded-l-full pr-px transition-[width] duration-200 ease-out hover:w-[32px] focus-visible:w-[32px] focus-visible:outline-none"
          >
            <MessageSquare size={14} className="text-[#6B7280] transition-colors group-hover:text-[#364658]" />
          </button>
        </TooltipTrigger>
        {/* Named for what it does, not for a service that does not exist. There is no separate
            chat backend in this product — this opens the same assistant in its floating window,
            which is the chat-shaped one of the three layouts. If a distinct support chat is
            wanted, that is its own feature with its own thing behind it. */}
        <TooltipContent side="left" className="text-wrap">Chat window</TooltipContent>
      </Tooltip>
    </div>
  );
}
