/* The Ask AI entry point, pinned to the bottom of the left icon rail.
 *
 * Deliberately NOT a NavItem: the rail's items are routes, and this is an action. It borrows
 * NavItem's exact geometry and states so it reads as part of the rail — same 40px block, same
 * hover fill, same selected treatment (brand fill + the 3px darker indicator + white icon).
 *
 * WHAT CHANGED, and why the comment used to say the opposite: this button was built to the brief's
 * "one quiet signal only, no idle animation", and was then asked to grab attention the way
 * Gemini's does. It now carries the product's gradient sparkle with a slow sheen sweeping across
 * it and a soft halo behind. Two things keep that from becoming wallpaper an admin resents after
 * a week: most of the cycle is REST, not movement, and the whole thing stops the moment the panel
 * is open or the pointer is on it. `prefers-reduced-motion` removes it entirely.
 *
 * The glyph is drawn as a masked CSS gradient rather than an SVG fill — see AskAiGlyph for why
 * that is what makes the animation switchable by a media query at all.
 *
 * Contrast, measured: --ai-accent on the rail's #F9FAFB is 4.72:1 and on white 4.86:1 — both
 * clear AA text and comfortably clear the 3:1 non-text threshold. The selected state paints white
 * on #3D8BD0 and needs no separate argument.
 */
import { Tooltip, TooltipContent, TooltipTrigger } from '../components/ui/tooltip';
import { AskAiGlyph } from './AskAiGlyph';
import { isAskAiEnabled } from './flags';
import { rememberOpener, useAskAiActionsOptional, useAskAiStateOptional } from './AskAiProvider';

/** ⌘ on Mac, Ctrl everywhere else. Read once — `navigator.platform` is deprecated but is what
 *  this codebase can rely on, and the value cannot change mid-session. */
const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || '');
export const ASK_AI_SHORTCUT_LABEL = isMac ? '⌘J' : 'Ctrl+J';

export function AskAiRailButton() {
  /* Called unconditionally, and absent-tolerant: Sidebar is mounted by ~23 pages, not all of
     which sit under the provider. The guard is after the hooks, never around them. */
  const actions = useAskAiActionsOptional();
  const state = useAskAiStateOptional();

  /* Flag off → the button does not render at all, and App never mounts the panel either. The
     feature is absent rather than present-and-disabled, which is this codebase's convention
     (adminData.ts filters hidden entries once, at the export). */
  if (!isAskAiEnabled() || !actions || !state) return null;

  const active = state.open;

  const button = (
    <button
      type="button"
      aria-label="Ask AI"
      aria-expanded={active}
      aria-keyshortcuts={isMac ? 'Meta+J' : 'Control+J'}
      onClick={(e) => {
        /* Closing returns focus here, so the button records itself as the opener. */
        rememberOpener(e.currentTarget);
        actions.toggle();
      }}
      className={`flex h-[40px] w-full items-center justify-center transition-colors relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#3D8BD0] ${
        active
          ? 'bg-[#3D8BD0]'
          : 'bg-transparent hover:bg-[#e9ebef]'
      }`}
    >
      {active && <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#2d6ca0]" />}
      <div className="flex items-center justify-center size-[20px]">
        {/* Selected → flat white, exactly as the rail paints its active icon, and the animation
            stops. Otherwise the gradient sparkle with its sheen: the one thing marking this as an
            action rather than a destination, and now the thing that asks to be noticed. */}
        <AskAiGlyph size={20} active={active} />
      </div>
    </button>
  );

  return (
    /* The pinned footer, divider included, lives here rather than in Sidebar so that the flag
       being off leaves NOTHING behind — not even a hairline across an empty strip.
       Absolutely positioned on purpose: the rail's module list must not become a scroll
       container, because a box with any non-visible axis clips on both, and the four hover
       flyouts are `absolute left-full`. Sidebar reserves this height with `pb-[41px]`. */
    <div className="absolute inset-x-0 bottom-0 border-t border-[#e5e7eb] bg-[#f9fafb]">
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        {/* `text-wrap` overrides TooltipContent's `text-balance`, which splits a short two-part
            label like this into two awkward lines. */}
        <TooltipContent side="right" className="text-wrap">
          Ask AI <span className="text-[#9CA3AF]">{ASK_AI_SHORTCUT_LABEL}</span>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
