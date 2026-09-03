import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { TEC8_EVIDENCE } from './tec8Model';

/* WHY THIS PLAN — collapsed, and secondary on purpose.
 *
 * ⚠️ THIS IS EVIDENCE, NOT REASONING. Every line is a checkable fact about the ticket — how
 * long it has been open, what the SLA says, what happened to comparable incidents. None of them
 * narrates how a conclusion was arrived at, and none of them should ever be allowed to: the
 * reader is being asked to judge whether the FACTS justify the plan, which they cannot do if
 * what they are shown is Nova talking to itself.
 *
 * Collapsed because the plan and its impact are what a decision needs; the justification is what
 * a doubt needs, and only then.
 */
export function Tec8PlanEvidence() {
  const [open, setOpen] = useState(false);
  return (
    <section className="tec8-why">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="nova-btn nova-btn-ghost flex min-h-[44px] w-full items-center gap-2 rounded px-2 text-left"
      >
        <ChevronDown
          size={12}
          className="nova-chev flex-shrink-0 text-[var(--nova-ink-muted)]"
          data-open={open ? 'true' : 'false'}
          aria-hidden="true"
        />
        <span className="nova-t-proc">Why Nova recommends this plan</span>
      </button>
      {open && (
        <ul className="tec8-why-list">
          {TEC8_EVIDENCE.map((e) => (
            <li key={e} className="tec8-why-item">{e}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
