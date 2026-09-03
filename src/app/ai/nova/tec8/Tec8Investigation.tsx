import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { TEC8_CHECKS } from './tec8Model';

/* WHAT NOVA IS CHECKING — never how it is reasoning.
 *
 * Every row is a task a person could have performed: finding tickets, reading a history,
 * checking an SLA. None of them reports an inference, a comparison being weighed, or a
 * conclusion being reached. That distinction is the whole rule for this surface, and it is why
 * the rows are authored in `tec8Model` as a fixed list rather than generated from anything.
 *
 * The row states are the module's existing investigation language — tick, pulse, hollow ring —
 * so a technician who has watched Nova investigate anything else recognises this immediately.
 * There is no indeterminate spinner anywhere in it.
 *
 * ONCE THE PLAN IS READY it folds to one line, exactly as `InvestigationState` does: at that
 * moment the reader wants the proposal, not the trail, and the trail is one click away.
 */
export function Tec8Investigation({ index, done }: {
  /** How many checks have finished. The row at this index is the one running. */
  index: number;
  /** The investigation is over — fold to the tally. */
  done: boolean;
}) {
  const [open, setOpen] = useState(false);
  const shown = done ? open : true;

  return (
    <section style={{ marginTop: 'var(--nova-gap-block)' }}>
      {done ? (
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="nova-btn nova-btn-ghost -ml-2 flex min-h-[44px] w-[calc(100%+16px)] items-center gap-2 rounded px-2 text-left"
        >
          <ChevronDown
            size={12}
            className="nova-chev flex-shrink-0 text-[var(--nova-ink-muted)]"
            data-open={open ? 'true' : 'false'}
            aria-hidden="true"
          />
          <span className="flex-shrink-0 ask-text-sm text-[#0F6E4F]" aria-hidden="true">✓</span>
          <span className="nova-t-proc min-w-0 truncate">
            {TEC8_CHECKS.length} checks
          </span>
        </button>
      ) : (
        <h4 className="nova-t-label">Working on it</h4>
      )}

      {shown && (
        <ol className={done ? 'mt-2 space-y-0.5' : 'mt-2 space-y-0.5'}>
          {TEC8_CHECKS.map((label, i) => {
            const complete = done || i < index;
            const live = !done && i === index;
            return (
              <li
                key={label}
                {...(live ? { role: 'status' as const, 'aria-live': 'off' as const } : {})}
                className={`nova-t-step flex items-start gap-2.5 px-1 py-[3px] transition-colors ${
                  live ? 'text-[var(--nova-ink)]'
                    : complete ? 'text-[var(--nova-ink-muted)]' : 'text-[var(--nova-ink-faint)]'}`}
              >
                <span className="mt-[3px] flex size-3.5 flex-shrink-0 items-center justify-center" aria-hidden="true">
                  {complete ? (
                    <svg viewBox="0 0 16 16" className="size-3 text-[#12805C]" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <path className="nova-tick" d="M3.5 8.4 6.6 11.5 12.5 5" pathLength={1} />
                    </svg>
                  ) : live ? (
                    <span className="nova-pulse block size-[6px] rounded-full bg-[#3D8BD0]" />
                  ) : (
                    <span className="block size-[6px] rounded-full border border-[#D7DEE7]" />
                  )}
                </span>
                <span className={live ? 'ask-w-500' : ''}>{label}</span>
                {/* Never colour or shape alone — the state is also said, for a screen reader and
                    for anyone who cannot tell a tick from a ring at 12px. */}
                <span className="sr-only">
                  {complete ? ' — done' : live ? ' — in progress' : ' — not started'}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
