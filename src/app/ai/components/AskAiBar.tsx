/* The "Ask AI for insights, summaries, and actions…" entry bar.
 *
 * Lifted from TicketPropertiesPanel (was ~line 3600). It is the product's most recognisable AI
 * affordance — the gradient-bordered pill with a sparkle — and it appears in two more places as
 * a dead copy wired to `toast('Ask AI is not wired up in this prototype')`
 * (AiComponentDrawer.tsx:432, ComponentDrawer.tsx:1002), each with its own border colour. Those
 * are left alone here, but this is the component they should become.
 *
 * TWO DOM CONTRACTS LIVE ON THIS MARKUP. DrawerShortcuts' Alt+I handler finds the chat by
 * regex-matching the placeholder (`/ask ai/i`) and closes it via `button[title="Close AI"]`
 * (DrawerShortcuts.tsx:59-67). The placeholder is therefore load-bearing text, not decoration —
 * `PLACEHOLDER` is exported so the shortcut can match against the same constant instead of a
 * string typed twice.
 *
 * One deliberate colour change: the sparkle was `#7B4EFB`, which appears exactly ONCE in the
 * whole codebase and is not one of the gradient's stops (`#731EFB` is, at 57 sites). It reads as
 * a typo that shipped. The token is the gradient's purple, so this glyph shifts by a few percent
 * of hue and now matches the border it sits inside.
 */
import { Sparkles } from 'lucide-react';

/** The exact string DrawerShortcuts matches on. Changing it breaks Alt+I. */
export const ASK_AI_PLACEHOLDER = 'Ask AI for insights, summaries, and actions...';

export interface AskAiBarProps {
  onOpen: () => void;
  /** Hidden — not unmounted — while the chat itself is open, because the shortcut's "is the bar
   *  visible?" check is what tells it whether to open or close. */
  hidden?: boolean;
}

export function AskAiBar({ onOpen, hidden }: AskAiBarProps) {
  return (
    <div
      className="flex items-center gap-2 p-2.5 rounded-lg shadow-md cursor-pointer hover:shadow-lg transition-shadow"
      style={{
        background: 'var(--ai-border-gradient)',
        border: '2px solid transparent',
        display: hidden ? 'none' : 'flex',
      }}
      onClick={onOpen}
    >
      <Sparkles size={16} className="flex-shrink-0" style={{ color: 'var(--ai-accent)' }} />
      <input
        type="text"
        placeholder={ASK_AI_PLACEHOLDER}
        className="flex-1 text-sm text-[#364658] placeholder:text-[#7B8FA5] bg-transparent border-none outline-none cursor-pointer"
        readOnly
      />
    </div>
  );
}
