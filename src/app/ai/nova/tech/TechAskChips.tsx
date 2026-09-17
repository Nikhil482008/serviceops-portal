import { useLayoutEffect, useRef } from 'react';
import { MessageSquare } from 'lucide-react';
import type { AskChip } from './techActions';

/* THE ASK-CHIPS, ABOVE THE INPUT.
 *
 * An ask needs Nova to produce content or a choice before anything can be done with it — draft a
 * message, pick a ticket, explain — so it is a question, not an action: it produces a normal
 * answer turn in the ordinary style. The chips keep the product's existing pill exactly; only
 * where they sit has changed, from under the answer to beside the box you would otherwise type
 * the same question into.
 *
 * At most three, at most one of them disabled (authored but not in this demo).
 */
export function TechAskChips({ chips, onAsk, onHeight }: {
  chips: AskChip[];
  onAsk: (q: string) => void;
  /* The drawer measures the overlay these live in - see NovaDrawer's overlayRef. */
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !onHeight) return;
    const report = () => onHeight(Math.ceil(el.getBoundingClientRect().height));
    report();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(report) : null;
    ro?.observe(el);
    return () => { ro?.disconnect(); onHeight(0); };
  }, [onHeight, chips.length]);

  if (!chips.length) return null;

  return (
    <div ref={ref} className="nova-askchips-wrap" data-ask-chips>
      <h4 className="sr-only">You could also ask</h4>
      <div className="nova-askchips">
        {chips.slice(0, 3).map((c) => (
          <button
            key={c.label}
            type="button"
            className="nova-btn nova-pill nova-hit"
            data-followup
            disabled={c.disabled}
            title={c.disabled ? 'Not in this demo' : undefined}
            onClick={() => { if (!c.disabled) onAsk(c.label); }}
          >
            <MessageSquare size={12} className="nova-pill-icon" aria-hidden="true" />
            {c.label}
          </button>
        ))}
      </div>
    </div>
  );
}
