/* The Ask AI entry point, pinned to the bottom of the left icon rail.
 *
 * Deliberately NOT a NavItem: the rail's items are routes, and this is an action. It borrows
 * NavItem's exact geometry and states so it reads as part of the rail — same 40px block, same
 * hover fill, same selected treatment (brand fill + the 3px darker indicator + white icon) — and
 * differs in exactly one quiet way: at rest its glyph is the AI accent instead of the rail's
 * #364658 ink. One signal, no idle animation, no glow, no gradient at 20px.
 *
 * Glyph is lucide's Sparkles rather than the product's gradient `AiSparkle`, for two reasons.
 * The rail's other seventeen icons are flat currentColor, so a multi-colour glyph would be the
 * only one; and `AiSparkle` paints a fixed gradient fill, which would ignore the white the rail
 * paints its selected icon with. Sidebar already imports Sparkles for the AI Components row, so
 * this is the rail's own glyph, not a new one.
 *
 * Contrast, measured: --ai-accent on the rail's #F9FAFB is 4.72:1 and on white 4.86:1 — both
 * clear AA text and comfortably clear the 3:1 non-text threshold. The selected state paints white
 * on #3D8BD0 and needs no separate argument.
 */
import { Sparkles } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '../components/ui/tooltip';
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
        <Sparkles
          size={20}
          /* Selected → white, exactly as the rail paints its active icon. Otherwise the accent,
             which is the one thing marking this as an action rather than a destination. */
          style={active ? undefined : { color: 'var(--ai-accent)' }}
          className={active ? 'text-white' : undefined}
        />
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
