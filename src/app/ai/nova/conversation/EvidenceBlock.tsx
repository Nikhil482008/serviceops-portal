import { useMemo, useState } from 'react';
import { ChevronDown, TriangleAlert } from 'lucide-react';
import type { Turn } from '../turnModel';
import type { StepSource } from '../scripts/registry';

/* HOW NOVA GOT THERE — one click away, never in the way.
 *
 * ── COLLAPSED, WITH ONE EXCEPTION ────────────────────────────────────────────────────────────
 * Justification is what a reader wants SECOND. It used to be a permanently-open list between the
 * answer and the actions, which pushed the commitment below the fold and made the response read
 * as one continuous run of assertions.
 *
 * The exception is a GAP. "Your docking station isn't in your asset list" is not supporting
 * evidence — it is a LIMIT on the answer, and hiding a limit behind a toggle is how a reader
 * trusts something further than it deserves. Gaps render above the toggle, always visible.
 *
 * ⚠️ AND IT MUST NOT DOMINATE. The caveat used to be a full bordered card with a 13px heading in
 * red-adjacent ink, which gave a footnote the same weight as the conclusion. It is now the
 * smallest type in the response behind a 2px amber rule: visible at a glance, subordinate by
 * construction, and impossible to mistake for the answer.
 *
 * ── SOURCES ARE DERIVED ──────────────────────────────────────────────────────────────────────
 * Read off the steps that actually reported them, deduped — not authored beside the answer. A
 * source list written by hand next to a conclusion is a claim; this one cannot name anything the
 * investigation did not open.
 */

const KIND_LABEL: Record<StepSource['kind'], string> = {
  ticket: 'Ticket', kb: 'Knowledge', doc: 'Document', data: 'Data',
};

export function EvidenceBlock({ turn }: { turn: Turn }) {
  const [open, setOpen] = useState(false);

  const gaps = turn.discoveries.filter((d) => d.role === 'gap');
  const reasons = turn.discoveries.filter((d) => d.role !== 'gap');

  const sources = useMemo(() => {
    const seen = new Map<string, StepSource>();
    turn.steps.forEach((s) => s.sources?.forEach((src) => {
      if (!seen.has(src.label)) seen.set(src.label, src);
    }));
    return [...seen.values()];
  }, [turn.steps]);

  const checks = turn.steps.filter((s) => s.status === 'complete').length;
  if (!gaps.length && !reasons.length && !sources.length) return null;

  return (
    <section style={{ marginTop: 'var(--nova-gap-block)' }}>
      {/* ── the limits, always visible, deliberately small ───────── */}
      {gaps.map((d) => (
        <div key={d.id} className="nova-caveat">
          <TriangleAlert size={13} className="mt-[1px] flex-shrink-0 text-[#B98900]" aria-hidden="true" />
          <p className="nova-caveat-body">
            <span className="nova-t-label mr-2 align-middle text-[#8A6D1F]">Not verified</span>
            {d.headline}. {d.detail}
          </p>
        </div>
      ))}

      {(reasons.length > 0 || sources.length > 0) && (
        <>
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="nova-btn nova-btn-ghost -ml-2 mt-1 flex items-center gap-1.5 rounded px-1.5 py-1 text-left"
          >
            <ChevronDown
              size={12}
              className="nova-chev flex-shrink-0 text-[var(--nova-ink-muted)]"
              data-open={open ? 'true' : 'false'}
              aria-hidden="true"
            />
            <span className="nova-t-proc">Why Nova says this</span>
          </button>

          {open && (
            <div className="mt-1 pl-1.5">
              {reasons.map((d) => (
                <p key={d.id} className="nova-t-body flex items-start gap-2 py-[3px] text-[var(--nova-ink-muted)]">
                  <span className="mt-[1px] flex-shrink-0 text-[11px] text-[#12805C]" aria-hidden="true">✓</span>
                  <span>{d.headline}</span>
                </p>
              ))}

              {sources.length > 0 && (
                <div className="mt-2">
                  {/* Based on N checks — the scale of the work, stated once, in one line. It was
                      "Computed live from 150 tickets · just now", which is a sentence pretending
                      to be provenance. */}
                  <p className="nova-t-meta">
                    Based on <b className="font-semibold text-[var(--nova-ink)]">{checks} checks</b>
                    {' · '}updated just now
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {sources.map((s) => (
                      <span key={s.label} className="nova-src">
                        {s.label}
                        <span className="nova-src-kind">{KIND_LABEL[s.kind]}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
