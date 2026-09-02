import { useEffect, useRef, useState } from 'react';
import {
  Ticket, Clock, Search, List, Zap, Users, Shield, PenLine, Inbox,
  TrendingUp, Gauge, Building2, TriangleAlert, Settings2, ArrowUp, X,
} from 'lucide-react';
import { AskAiOrb, type OrbState } from './AskAiOrb';
import { NOVA_STAGE, NOVA_DUR, prefersReducedMotion, stageAt } from './novaMotion';
import {
  ROLE_SUGGESTIONS, ROLE_SUBLINE, greetingFor,
  type UserRole, type NovaIcon,
} from './novaSuggestions';

/* The Nova drawer — the redesigned Ask AI surface.
 *
 * Deliberately a SEPARATE component from `panel/AskAiPanel.tsx`. That one works and ships; this
 * is the redesign, and building it beside rather than on top of the old one is what lets both
 * exist while the new shape is judged.
 *
 * Mock only. Nothing here calls a backend, and the input does not send.
 */

const ICONS: Record<NovaIcon, typeof Ticket> = {
  ticket: Ticket, clock: Clock, search: Search, list: List,
  zap: Zap, users: Users, shield: Shield, pen: PenLine, inbox: Inbox,
  trending: TrendingUp, gauge: Gauge, building: Building2, alert: TriangleAlert,
};

/** Which staged pieces have arrived. One flag per stage rather than a numeric "step", because
 *  the stages overlap — the grid is still settling while the greeting starts. */
interface Staged { grid: boolean; greeting: boolean; cards: number; input: boolean }
const NONE: Staged = { grid: false, greeting: false, cards: 0, input: false };

export function NovaDrawer({
  open, closing, onClose, userRole, orbState, orbSlotRef, now,
}: {
  open: boolean;
  /** Playing the exit. Held separately from `open` so the drawer can animate OUT before it is
   *  unmounted — an element removed on the same tick has nothing left to animate. */
  closing: boolean;
  onClose: () => void;
  /** From the auth object. There is no role selector in this UI by design. */
  userRole: UserRole;
  orbState: OrbState;
  /** Where the flying orb comes to rest. The drawer owns the slot; the host owns the orb. */
  orbSlotRef: React.RefObject<HTMLDivElement | null>;
  /** Injectable clock, so the greeting can be demonstrated at any hour. */
  now?: Date;
}) {
  const [staged, setStaged] = useState<Staged>(NONE);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const cards = ROLE_SUGGESTIONS[userRole];

  /* The choreography. Each stage is its own timer against the shared schedule, so the order is
     readable here rather than inferred from a chain of nested callbacks.

     Under reduced motion every offset collapses to 0 (`stageAt`), so all of this lands on the
     same tick and the only thing that happens is the 120ms opacity fade the stylesheet allows. */
  useEffect(() => {
    if (!open || closing) { setStaged(NONE); return; }
    const timers: number[] = [];
    const at = (ms: number, fn: () => void) => timers.push(window.setTimeout(fn, stageAt(ms)));

    at(NOVA_STAGE.grid, () => setStaged((s) => ({ ...s, grid: true })));
    at(NOVA_STAGE.greeting, () => setStaged((s) => ({ ...s, greeting: true })));
    cards.forEach((_, i) => at(NOVA_STAGE.cards + i * NOVA_STAGE.cardStagger,
      () => setStaged((s) => ({ ...s, cards: Math.max(s.cards, i + 1) }))));
    at(NOVA_STAGE.input, () => {
      setStaged((s) => ({ ...s, input: true }));
      /* Focus lands with the input, not before it — moving focus to something still transparent
         is how a screen reader gets ahead of the screen. */
      inputRef.current?.focus();
    });

    return () => timers.forEach(clearTimeout);
  }, [open, closing, cards]);

  /* Esc closes; Tab is trapped. The trap is a wrap rather than a guard on every element: the
     drawer is modal while it is open, so the first and last focusable are the whole contract. */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }
      if (e.key !== 'Tab') return;
      const root = panelRef.current;
      if (!root) return;
      const f = [...root.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      )].filter((el) => !el.hasAttribute('disabled'));
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open && !closing) return null;

  const shown = open && !closing;
  const rise = (on: boolean, px: number, extra = '') =>
    ({ className: `nova-rise ${extra}`, 'data-in': on ? 'true' : 'false', style: { '--rise': `${px}px` } as React.CSSProperties });

  return (
    <>
      {/* Scrim. Click closes — the same instruction as Esc, and a modal surface that cannot be
          dismissed by the space around it reads as stuck. */}
      <div
        className="nova-scrim fixed inset-0 z-[10015] bg-[#364658]/20"
        data-open={shown ? 'true' : 'false'}
        data-closing={closing ? 'true' : 'false'}
        onClick={onClose}
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Ask AI"
        className="nova-drawer fixed right-0 top-0 z-[10020] flex h-screen w-[420px] max-w-[95vw] flex-col overflow-hidden border-l border-[#e5e7eb] bg-white shadow-2xl"
        data-open={shown ? 'true' : 'false'}
        data-closing={closing ? 'true' : 'false'}
      >
        {/* The dotted ground. `inset-0` and behind everything, so settling it from 1.03 moves a
            background rather than the content standing on it. */}
        <div className="nova-grid pointer-events-none absolute inset-0" data-in={staged.grid ? 'true' : 'false'} />

        <div className="relative flex items-center justify-end px-4 pt-3">
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex size-8 items-center justify-center rounded text-[#7B8FA5] transition-colors hover:bg-[#F3F4F6] hover:text-[#364658]"
          ><X size={16} /></button>
        </div>

        <div className="relative flex min-h-0 flex-1 flex-col overflow-y-auto px-6 pb-4">
          {/* The orb's landing slot. Empty on purpose — the orb itself is a fixed layer the host
              flies into this rect, so that one element is continuous between FAB and drawer
              instead of two that cross-fade. */}
          <div ref={orbSlotRef} className="mx-auto mt-2 size-[120px] flex-shrink-0" aria-hidden="true" />

          <div {...rise(staged.greeting, 8, 'mt-4 text-center')}>
            <h2 className="text-[20px] font-semibold text-[#364658]">{greetingFor(now)}</h2>
            <p className="mt-1 text-[13px] text-[#7B8FA5]">{ROLE_SUBLINE[userRole]}</p>
          </div>

          <div className="mt-6 space-y-2">
            {cards.map((c, i) => {
              const Icon = ICONS[c.icon];
              return (
                <button
                  key={c.title}
                  {...rise(staged.cards > i, 10,
                    'flex w-full items-start gap-3 rounded-lg border border-[#E5E7EB] bg-white/80 px-3.5 py-3 text-left backdrop-blur-sm hover:border-[#3D8BD0] hover:bg-white')}
                  /* Not focusable until it has arrived. A card that is still transparent is not
                     yet on screen, and tabbing into it would move focus somewhere invisible. */
                  tabIndex={staged.cards > i ? 0 : -1}
                  title={c.prompt}
                >
                  <span className="mt-0.5 flex-shrink-0 text-[#7B8FA5]"><Icon size={16} /></span>
                  <span className="min-w-0">
                    <span className="block text-[13px] font-medium text-[#364658]">{c.title}</span>
                    <span className="mt-0.5 block text-[12px] leading-[1.5] text-[#7B8FA5]">{c.subtitle}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* The input. Last to arrive and the thing focus lands on — by then the drawer has finished
            explaining itself and the next move is the reader's. */}
        <div {...rise(staged.input, 8, 'relative border-t border-[#E5E7EB] bg-white px-4 py-3')}>
          <div className="flex items-center gap-2 rounded-lg border border-[#DFE5ED] bg-white px-3 py-2 focus-within:border-[#3D8BD0] focus-within:ring-1 focus-within:ring-[#3D8BD0]">
            <button
              aria-label="Assistant settings"
              title="Assistant settings"
              tabIndex={staged.input ? 0 : -1}
              className="flex size-6 flex-shrink-0 items-center justify-center rounded text-[#9CA3AF] transition-colors hover:bg-[#F3F4F6] hover:text-[#364658]"
            ><Settings2 size={14} /></button>
            <input
              ref={inputRef}
              type="text"
              placeholder="Ask about your requests…"
              tabIndex={staged.input ? 0 : -1}
              className="min-w-0 flex-1 bg-transparent text-[13px] text-[#364658] placeholder:text-[#9ca3af] focus:outline-none"
            />
            <button
              aria-label="Send"
              tabIndex={staged.input ? 0 : -1}
              className="flex size-7 flex-shrink-0 items-center justify-center rounded-full text-white"
              style={{ background: 'var(--ai-gradient)' }}
            ><ArrowUp size={14} /></button>
          </div>
        </div>
      </div>
    </>
  );
}

/** Exported so the host can hold the exit open for exactly as long as the stylesheet does. */
export const NOVA_EXIT_MS = NOVA_DUR.exit;
export { prefersReducedMotion };
