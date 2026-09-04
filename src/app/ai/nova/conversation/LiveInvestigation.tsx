import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import {
  activeIndex, liveScope, scopeLabel, turnCounts,
  type FeedDiscovery, type ScopeCount, type Turn,
} from '../turnModel';

/* THE LIVE INVESTIGATION — scope, then the one thing happening now, then everything else
 * behind a fold.
 *
 * ── WHAT THIS REPLACES, AND WHAT IT KEEPS ────────────────────────────────────────────────────
 * The reveal view printed the whole trail as it grew: every chapter, every finished check,
 * the live one somewhere in the middle. Good for auditing, but the reader watching a live run
 * mostly wants two facts — HOW MUCH Nova is working through, and WHAT it is doing right now —
 * and both were buried under the history that produced them. So the default flips: scope and
 * the current check are always visible, and the trail (the same chapters, untouched) moves
 * behind "N checks completed". Nothing was deleted; it was re-layered (law 19).
 *
 * ── THE NUMBERS ARE DERIVED, NEVER SCHEDULED ─────────────────────────────────────────────────
 * `liveScope` sums the tallies of COMPLETED checks, so a number can only move because a named
 * check finished, and only by what that check's own copy claims it read. This component owns no
 * timer that touches a number — the one timer here clears the discovery flash, which is
 * presentation, not data.
 *
 * ── FOUR PIECES, ONE FILE ────────────────────────────────────────────────────────────────────
 * They share one visual argument the way `blocks.tsx` does. Each is usable alone; the default
 * export composes them for a turn.
 */

/** The quantified scope — the CXO-2 workspace strip's own pattern (bold value, quiet label,
 *  baseline-aligned wrap), one type step louder on the number because here the numbers ARE the
 *  content rather than a header annotation. Deliberately not a KPI row: no cards, no borders,
 *  spacing alone separates the figures. */
export function LiveInvestigationMetrics({ metrics, trailing }: {
  metrics: ScopeCount[];
  /** Rides the END of the row — the folded-history control lives here, so the past never owns
   *  a line of its own. */
  trailing?: ReactNode;
}) {
  if (!metrics.length && !trailing) return null;
  return (
    <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1" data-live-scope>
      {metrics.map((m) => (
        <span key={m.unit} className="ask-text-sm text-[var(--nova-ink-muted)]">
          {/* Keyed by the VALUE, so a change remounts the number and replays the small entrance
              — the "still gathering" cue — without any counter machinery. */}
          <b key={m.n} className="nova-live-num ask-text-base ask-w-600 text-[var(--nova-ink)]">
            {m.n}
          </b>
          {' '}{scopeLabel(m.n, m.unit)}
        </span>
      ))}
      {trailing}
    </div>
  );
}

/** The one thing happening now. The pulse dot is the module's existing activity mark — no
 *  spinner, and the label is a user-safe TASK from the script, never reasoning. */
export function CurrentInvestigationStep({ label }: { label: string }) {
  return (
    <p
      className="flex items-center gap-2 ask-text-base text-[var(--nova-ink)]"
      role="status"
      aria-live="off"
      data-live-step
    >
      <span
        className="nova-pulse inline-block size-[6px] flex-shrink-0 rounded-full bg-[#3D8BD0]"
        aria-hidden="true"
      />
      <span className="nova-shimmer min-w-0">{label}…</span>
    </p>
  );
}

/** A finding, in the current-activity slot for a moment. Same size and position as the step
 *  line it interrupts — a small discovery beat, not a notification. A GAP keeps its warning
 *  glyph and amber: "could not confirm" must never wear a success tick. */
export function InvestigationDiscovery({ d }: { d: FeedDiscovery }) {
  const gap = d.role === 'gap';
  return (
    <p
      className="nova-disc flex items-baseline gap-2 ask-text-base ask-w-500 text-[var(--nova-ink)]"
      data-live-flash
    >
      <span className={`flex-shrink-0 ${gap ? 'text-[#B98900]' : 'text-[#12805C]'}`} aria-hidden="true">
        {gap ? '⚠' : '✓'}
      </span>
      <span className="min-w-0">{d.headline}</span>
    </p>
  );
}

/** The way into the past — a compact control made to ride the end of the metrics row, so the
 *  history never owns a line of its own. The count pops the same way the metric numbers do
 *  (keyed remount), which is what keeps the row feeling live even between scope changes. The
 *  trail itself is rendered by the caller, beneath the current-activity line. */
export function InvestigationHistory({ open, onToggle, checks, findings }: {
  open: boolean;
  onToggle: () => void;
  checks: number;
  findings: number;
}) {
  return (
    <button
      type="button"
      aria-expanded={open}
      onClick={onToggle}
      className="nova-btn nova-hit inline-flex items-center gap-1 rounded px-1 ask-text-sm text-[var(--nova-ink-muted)] hover:bg-[#F5F7FA] hover:text-[var(--nova-ink)]"
      data-live-history
    >
      <b key={checks} className="nova-live-num ask-w-600 text-[var(--nova-ink)]">{checks}</b>
      {' '}check{checks === 1 ? '' : 's'}
      {findings > 0 && ` · ${findings} finding${findings === 1 ? '' : 's'}`}
      <ChevronDown
        size={12}
        className="nova-chev flex-shrink-0"
        data-open={open ? 'true' : 'false'}
        aria-hidden="true"
      />
    </button>
  );
}

/** How long a discovery holds the current-activity slot before the next check's label returns. */
const FLASH_MS = 2400;

/** The composed live block: scope → current activity (or a discovery beat) → foldable history.
 *
 * `history` is passed in as a node rather than rendered here, because the trail belongs to the
 * VIEW — the reveal view's chapters, another view's lanes — and this component must not need to
 * know which one it is sitting in.
 */
export function LiveInvestigation({ turn, history, onHide }: {
  turn: Turn;
  history: ReactNode;
  /** Fold the whole investigation away — offered by the view once there is an answer, in the
   *  same row as everything else, because this block owns no chrome of its own. */
  onHide?: () => void;
}) {
  const running = !turn.answer && !turn.error && !turn.stopped;
  const scope = liveScope(turn);
  const counts = turnCounts(turn);
  const li = activeIndex(turn);
  const [histOpen, setHistOpen] = useState(false);
  const [flash, setFlash] = useState<FeedDiscovery | null>(null);

  /* Flash only discoveries that arrive AFTER mount — a settled turn re-rendering must not
     replay its findings. The ref starts at the mounted count for exactly that reason. */
  const seen = useRef(turn.discoveries.length);
  useEffect(() => {
    if (turn.discoveries.length <= seen.current) return;
    seen.current = turn.discoveries.length;
    if (turn.answer) return;                    // the answer beat owns the screen from here
    setFlash(turn.discoveries[turn.discoveries.length - 1]);
    const t = window.setTimeout(() => setFlash(null), FLASH_MS);
    return () => clearTimeout(t);
  }, [turn.discoveries.length, turn.answer, turn.discoveries]);

  const current = li >= 0 ? turn.steps[li] : null;

  const trailOpen = histOpen || !!turn.answer;

  return (
    <div>
      {/* LINE ONE of the three: the scope, with the fold and (once answered) Hide riding its
          end — nothing below this row but the current activity, until the reader asks. */}
      <LiveInvestigationMetrics
        metrics={scope}
        trailing={(counts.checks > 0 || onHide) ? (
          <span className="flex items-center gap-2">
            {counts.checks > 0 && (
              <InvestigationHistory
                open={trailOpen}
                onToggle={() => setHistOpen((v) => !v)}
                checks={counts.checks}
                findings={counts.findings}
              />
            )}
            {onHide && (
              <button
                type="button"
                aria-expanded
                onClick={onHide}
                className="nova-btn nova-hit rounded px-1 ask-text-sm text-[#9CA3AF] hover:bg-[#F5F7FA] hover:text-[#7B8FA5]"
              >
                Hide
              </button>
            )}
          </span>
        ) : undefined}
      />

      {/* ONE live region for the moments worth interrupting for — the discovery beats. The
          per-step ticks stay silent, same rule as every other view. */}
      <div className="mt-2" aria-live="polite">
        {running && flash ? (
          <InvestigationDiscovery d={flash} />
        ) : running && current ? (
          <CurrentInvestigationStep label={current.label} />
        ) : running && turn.plan ? (
          /* PLANNING IS OVER — the plan card (or the execution list) below is what is alive now,
             and the strip must say so rather than leave a "Checking…" line standing. */
          <p className="flex items-center gap-2 ask-text-base ask-w-500 text-[var(--nova-ink)]">
            <span className="text-[#12805C]" aria-hidden="true">✓</span>
            Planning complete
            {counts.findings > 0
              && ` · ${counts.findings} finding${counts.findings === 1 ? '' : 's'}`}
          </p>
        ) : !running && turn.answer ? (
          /* §: never leave a "Checking…" line standing after the work is over. */
          <p className="flex items-center gap-2 ask-text-base ask-w-500 text-[var(--nova-ink)]">
            <span className="text-[#12805C]" aria-hidden="true">✓</span>
            Investigation complete
            {counts.findings > 0
              && ` · ${counts.findings} finding${counts.findings === 1 ? '' : 's'}`}
          </p>
        ) : null}
      </div>

      {/* The trail, when asked for — and once there is an answer the fold opens itself: a
          reader expanding a settled investigation came for the trail, and making them click
          twice to reach it would be disclosure for its own sake. */}
      {trailOpen && counts.checks > 0 && <div className="mt-3">{history}</div>}
    </div>
  );
}
