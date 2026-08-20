/* The gradient-tinted prompt pill.
 *
 * One component replacing three copy-pasted shapes in TicketPropertiesPanel: the six Quick-AI
 * pills (was lines 3460-3559, six near-identical 17-line Tooltip blocks), the welcome-screen
 * prompts (3053-3071, which already used `.map`), and the follow-up pills (3596-3644). All three
 * rendered the same 8%-tint recipe inline; it now comes from `--ai-tint-8`.
 *
 * The inline style previously ended in `var(--Core-White, #FFF)` — a Figma-export leftover that
 * is defined nowhere in this repo and survived on its fallback. The token spells the white out,
 * so the computed background is identical and one more phantom variable is gone.
 */
import type { ReactNode } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../components/ui/tooltip';

/** Two shapes, because the product already had two and they do different jobs.
 *  `compact` is the horizontal scrolling row above the composer; `block` is the full-width
 *  stacked list on the empty state, where there is room to read and nothing else competing. */
export type AiChipVariant = 'compact' | 'block';

const CHIP_CLASS: Record<AiChipVariant, string> = {
  compact: 'group flex items-center gap-1.5 px-3 py-2 rounded text-[#364658] text-xs font-medium whitespace-nowrap hover:text-[#3D8BD0] hover:shadow-sm transition-all duration-200',
  block: 'group w-full flex items-center gap-2 px-4 py-2.5 rounded-lg text-[#364658] text-[13px] font-medium hover:text-[#3D8BD0] hover:shadow-sm transition-all duration-200 cursor-pointer',
};

export interface AiSuggestionChipProps {
  label: string;
  icon?: ReactNode;
  /** Tooltip copy. Omitted → no tooltip wrapper at all, rather than an empty one. */
  tip?: string;
  variant?: AiChipVariant;
  /** Where the tooltip sits. The two existing rows differ: the compact row points up, the block
   *  list points right, because a tip above a full-width row would cover the row above it. */
  tipSide?: 'top' | 'right' | 'bottom' | 'left';
  onClick: () => void;
}

export function AiSuggestionChip({
  label, icon, tip, variant = 'compact', tipSide = 'top', onClick,
}: AiSuggestionChipProps) {
  const button = (
    <button
      onClick={onClick}
      style={{ background: 'var(--ai-tint-8)' }}
      className={CHIP_CLASS[variant]}
    >
      {icon}
      <span>{label}</span>
    </button>
  );

  if (!tip) return button;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      {/* `text-xs` matches the call sites this replaced. Note TooltipContent applies
          `text-balance`, which splits a long string into equal short lines — override with
          `text-wrap` at a call site if a tip ever grows past a line. */}
      <TooltipContent side={tipSide} className="text-xs">{tip}</TooltipContent>
    </Tooltip>
  );
}

/** The icon treatment every pill used: 13px, no shrink, grows slightly with the pill's hover.
 *  Exported so call sites can't drift on the size. */
export const AI_CHIP_ICON = 'flex-shrink-0 group-hover:scale-110 transition-transform duration-200';
