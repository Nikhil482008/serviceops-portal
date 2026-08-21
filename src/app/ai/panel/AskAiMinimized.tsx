/* Minimised: still open, just out of the way.
 *
 * Distinct from closed, and the distinction is the point — the conversation is intact behind this
 * pill, so it says "Ask AI" rather than showing an empty launcher. The app already has this idea
 * for detail drawers (`MinimizedDrawerRail`, a 28px strip on the right edge); a bottom-right pill
 * is the same move for something that is a window rather than a full-height drawer.
 */
import { ChevronUp } from 'lucide-react';
import { AskAiGlyph } from '../AskAiGlyph';

export function AskAiMinimized({ onRestore, subtitle }: {
  onRestore: () => void;
  /** The thread's title, so the pill says which conversation is waiting rather than just that
   *  one is. Absent on an empty thread — there is nothing to name yet. */
  subtitle?: string;
}) {
  return (
    <button
      type="button"
      onClick={onRestore}
      aria-label={subtitle ? `Restore Ask AI — ${subtitle}` : 'Restore Ask AI'}
      className="fixed bottom-4 right-4 z-[10020] flex max-w-[280px] items-center gap-2 rounded-full border border-[#DFE5ED] bg-white py-2 pl-3 pr-3.5 shadow-lg transition-shadow hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3D8BD0]"
    >
      <AskAiGlyph size={16} />
      <span className="min-w-0 flex-1 truncate text-left text-[13px] font-medium text-[#364658]">
        {subtitle || 'Ask AI'}
      </span>
      <ChevronUp size={14} className="flex-shrink-0 text-[#7B8FA5]" />
    </button>
  );
}
