/* How the panel presents itself: Sidebar · Floating · Full screen.
 *
 * A real menu, not a row of toggle buttons — three mutually exclusive layouts is a choice with a
 * current value, and a menu is the control that says "one of these is true" while a button group
 * at this size would just be three more icons in a header that already has four.
 *
 * Full screen sits below a divider because it is a different kind of thing: Sidebar and Floating
 * both leave the page usable behind them, and Full screen does not.
 */
import { useEffect, useRef } from 'react';
import { Check, PanelRight, PictureInPicture2, Square } from 'lucide-react';
import type { AskAiMode } from '../AskAiProvider';

const MODES: { id: AskAiMode; label: string; Icon: typeof PanelRight; hint: string }[] = [
  { id: 'sidebar', label: 'Sidebar', Icon: PanelRight, hint: 'Docked to the right edge, resizable' },
  { id: 'floating', label: 'Floating', Icon: PictureInPicture2, hint: 'A window you can drag anywhere' },
  { id: 'fullscreen', label: 'Full screen', Icon: Square, hint: 'Fills the window' },
];

export function AskAiModeMenu({ mode, onPick, onClose }: {
  mode: AskAiMode;
  onPick: (m: AskAiMode) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    /* Escape closes the MENU and must not reach the panel's own Escape handler, or picking a
       layout and changing your mind would shut the whole assistant. */
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
    };
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('mousedown', onDown);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      role="menu"
      aria-label="Panel layout"
      className="absolute right-0 top-full z-30 mt-1 w-[196px] rounded-lg border border-[#DFE5ED] bg-white py-1 shadow-lg"
    >
      {MODES.map((m, i) => (
        <div key={m.id}>
          {/* Full screen is the one that takes the page away. The rule says so before you pick. */}
          {i === MODES.length - 1 && <div className="my-1 border-t border-[#F0F2F5]" />}
          <button
            type="button"
            role="menuitemradio"
            aria-checked={mode === m.id}
            title={m.hint}
            onClick={() => { onPick(m.id); onClose(); }}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] text-[#364658] transition-colors hover:bg-[#F5F7FA]"
          >
            <m.Icon size={15} className="flex-shrink-0 text-[#6B7280]" />
            <span className="flex-1">{m.label}</span>
            {/* The tick, not a highlighted row: the current mode is a fact about state, and a
                fill would read as hover. */}
            {mode === m.id && <Check size={14} className="flex-shrink-0 text-[#3D8BD0]" />}
          </button>
        </div>
      ))}
    </div>
  );
}
