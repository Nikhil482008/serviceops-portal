import { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { AUTHORITY_LABEL, evidenceOf, sourceAuthority, type Turn } from '../turnModel';
import { NovaVerificationNotice } from './NovaVerificationNotice';

/* HOW NOVA KNOWS — the ONE trust gateway. Replaced "Why Nova says this" (framing), the
 * "Context N outputs · M sources" card (mechanics), and then the "Based on" strip + its
 * "View sources" buttons (repetition): a reader was meeting the same source mechanism twice
 * between the answer and the action, and the action drifted out of reach.
 *
 * ── THE TRUST LADDER THIS SITS ON ─────────────────────────────────────────────
 *   1 SCAN         the answer — most readers stop there
 *   2 VERIFY       this fold: the key findings with WHERE each one came from and HOW FRESH
 *                  that record is, then the sources themselves as chips
 *   3 INVESTIGATE  the evidence drawer (opened from an inline citation or a source chip
 *                  here), and from it the original records
 *
 * ── WHAT A FINDING ROW SAYS ────────────────────────────────────────────────────
 * The claim, then its provenance in one muted line — "INC-4471 · System record · Updated 3h
 * ago". An INFERENCE says so instead: its line is the evidence strength in words ("Strong
 * evidence · same vendor, same failure signature"), because Nova's conclusion must never wear a
 * record's clothes — and never a made-up percentage.
 *
 * A GAP is never in the fold. It renders above, always visible, right after the object it
 * qualifies — see NovaVerificationNotice.
 *
 * ── AND HONESTY HAS AN EMPTY STATE ───────────────────────────────────────────────────────────
 * An answer with no sources says so, in words, rather than rendering nothing and hoping nobody
 * asks. "No external sources were consulted" is itself trust information.
 */
export function EvidenceBlock({ turn, onViewSources, openSignal }: {
  turn: Turn;
  /** Open the evidence drawer — level 3, focused on a source when a chip was the way in. */
  onViewSources: (focus?: string) => void;
  /** Bump to expand the fold from outside — "Elaborate" reveals the supporting reasoning
   *  rather than inventing prose the script never authored. The reader can still collapse. */
  openSignal?: number;
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => { if (openSignal) setOpen(true); }, [openSignal]);
  const ev = evidenceOf(turn);
  const byLabel = new Map(ev.sources.map((s) => [s.label, s]));
  const a = turn.answer;

  if (!ev.sources.length && !ev.findings.length) {
    return (
      <section style={{ marginTop: 16 }}>
        {/* A gap is a limit on the answer — it renders even when there is nothing to fold. */}
        {ev.gaps.map((g) => <NovaVerificationNotice key={g.id} gap={g} />)}
        <p className="nova-t-meta" data-basedon-empty>
          Based on available ticket context — no external sources were consulted for this answer.
        </p>
      </section>
    );
  }

  /* The curated few — the answer's own `basedOn` when a completed check actually read it,
     else the first sources the investigation opened. The full trail lives in the drawer. */
  const known = new Set(ev.sources.map((s) => s.label));
  const curated = (a?.basedOn ?? []).filter((l) => known.has(l));
  const chips = curated.length ? curated : ev.sources.slice(0, 3).map((s) => s.label);

  return (
    <section style={{ marginTop: 16 }}>
      {ev.gaps.map((g) => <NovaVerificationNotice key={g.id} gap={g} />)}

      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="nova-btn nova-hit nova-tertiary -ml-1 mt-1"
      >
        <ChevronDown
          size={12}
          className="nova-chev flex-shrink-0"
          data-open={open ? 'true' : 'false'}
          aria-hidden="true"
        />
        How Nova knows
      </button>

      {open && (
        <div className="mt-2 pl-1.5" data-how-knows>
          {/* Analytics only: the population behind the numbers, counted and dated. What turns
              "18% up" from an assertion into a checkable statement about 1,284 real tickets. */}
          {a?.dataScope && (
            <>
              <p className="nova-t-label">Data analyzed</p>
              <p className="nova-t-meta mt-1" style={{ marginBottom: 12 }}>{a.dataScope}</p>
            </>
          )}
          {ev.findings.length > 0 && (
            <p className="nova-t-label">
              {ev.findings.length} key finding{ev.findings.length === 1 ? '' : 's'}
            </p>
          )}
          <ul className="mt-1.5 space-y-2.5">
            {ev.findings.map((f) => {
              const src = f.support?.map((l) => byLabel.get(l)).find(Boolean);
              const meta = f.inference && f.basis
                ? f.basis
                : src
                  ? [src.label, AUTHORITY_LABEL[sourceAuthority(src)], src.freshness]
                    .filter(Boolean).join(' · ')
                  : null;
              return (
                <li key={f.id}>
                  <p className="nova-t-body flex items-start gap-2 text-[var(--nova-ink)]">
                    <span className="mt-[1px] flex-shrink-0 ask-text-sm text-[#12805C]" aria-hidden="true">✓</span>
                    <span className="min-w-0">
                      {f.headline}
                      {f.inference && (
                        <span className="nova-ev-type ml-2" data-authority="inference">AI inference</span>
                      )}
                    </span>
                  </p>
                  {meta && <p className="nova-ev-meta">{meta}</p>}
                </li>
              );
            })}
          </ul>
          {chips.length > 0 && (
            <>
              <p className="nova-t-label" style={{ marginTop: 12 }}>Sources</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                {chips.map((label) => (
                  <button
                    key={label}
                    type="button"
                    className="nova-src nova-src-btn"
                    onClick={() => onViewSources(label)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
