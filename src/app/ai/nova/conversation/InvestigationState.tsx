import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { activeIndex, collapseSteps, turnCounts, type FeedStep, type Turn } from '../turnModel';
import { prefersReducedMotion } from '../novaMotion';
import { NovaFailure } from '../NovaFailure';
import { DiscoveryBlock } from './DiscoveryBlock';

/* WHAT NOVA IS DOING — deliberately the SECOND-loudest thing in the turn.
 *
 * ── THE TWO SHAPES ───────────────────────────────────────────────────────────────────────────
 * WHILE IT RUNS it is open, and it is the only thing there: a topic line and a list of checks
 * that tick over. That is the whole waiting experience, and it is why there is no "Thinking…"
 * anywhere in this module — a spinner says a machine is busy, a named check says what it is
 * busy WITH.
 *
 * ONCE THERE IS AN ANSWER it folds to one line — "✓ 8 checks · 3 findings" — because at that
 * moment the reader wants the conclusion, not the trail. The trail is still one click away and
 * the click is the same control, in the same place, in both states.
 *
 * ── WHAT IS NOT SHOWN ────────────────────────────────────────────────────────────────────────
 * Every row here is a user-safe TASK — "Checking recent ticket activity" — never reasoning about
 * how a conclusion was reached. The step labels come from the script; nothing in this component
 * can surface anything the script did not choose to say.
 *
 * ── DERIVED, NOT SCHEDULED ───────────────────────────────────────────────────────────────────
 * Something is always pulsing while the turn is open. That is `activeIndex`, and it covers the
 * stall, the ordinary gap between steps, AND the hold while the minimum-visible floor runs down
 * — one expression, no special cases.
 */

const DISCOVERY_GATE = 2;
/** The answer lands, the reader registers it, and THEN the work folds away. Simultaneous would
 *  put a collapse animation under the thing they are trying to read. */
const COLLAPSE_DELAY_MS = 300;

export function InvestigationState({ turn, onRetry }: { turn: Turn; onRetry?: () => void }) {
  const [stepsOpen, setStepsOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  /* Once the reader has an opinion about this section, the automatic collapse stops having one. */
  const [userToggled, setUserToggled] = useState(false);
  const bodyRef = useRef<HTMLDivElement | null>(null);

  const hasAnswer = !!turn.answer;
  useEffect(() => {
    if (!hasAnswer || userToggled) return;
    const t = window.setTimeout(
      () => setCollapsed(true),
      prefersReducedMotion() ? 0 : COLLAPSE_DELAY_MS,
    );
    return () => clearTimeout(t);
  }, [hasAnswer, userToggled]);

  const live = activeIndex(turn);
  const counts = turnCounts(turn);
  const showFound = turn.discoveries.length > 0 && counts.checks >= DISCOVERY_GATE;
  const { hidden, shown } = useMemo(() => collapseSteps(turn.steps), [turn.steps]);
  const hiddenOffset = turn.steps.length - shown.length;
  const running = !turn.answer && !turn.error && !turn.stopped;

  /* Height is animated from a MEASURED value, not a guess. Only applied once there is an answer:
     a permanent max-height would clip a section that is still growing. */
  const [maxH, setMaxH] = useState<number | null>(null);
  useEffect(() => {
    if (prefersReducedMotion()) { setMaxH(null); return; }
    const el = bodyRef.current;
    if (el) setMaxH(el.scrollHeight);
  }, [collapsed, turn.steps, turn.discoveries]);

  /* ONE control, both states — the affordance never appears or disappears, only the label
     changes. Running it names the work; settled it becomes the tally. */
  const label = running
    ? (turn.topic ? `Investigating ${turn.topic}` : 'Investigating…')
    : `${counts.checks} check${counts.checks === 1 ? '' : 's'}`
      + (counts.findings > 0 ? ` · ${counts.findings} finding${counts.findings === 1 ? '' : 's'}` : '');

  const header = (
    <button
      type="button"
      aria-expanded={!collapsed}
      onClick={() => { setUserToggled(true); setCollapsed((v) => !v); }}
      /* 40px collapsed. It is the SUMMARY of the work, not the work — it must be reachable
         without being a section of its own. */
      className="nova-btn nova-btn-ghost -ml-2 flex min-h-[44px] w-[calc(100%+16px)] items-center gap-2 rounded px-2 text-left"
    >
      {/* ONE CONTROL. This row briefly carried three affordances for one action — the chevron,
          the label, and a redundant expand link on the right. The chevron plus the label IS the
          button; a second affordance for one action reads as two actions. */}
      <ChevronDown
        size={12}
        className="nova-chev flex-shrink-0 text-[var(--nova-ink-muted)]"
        data-open={collapsed ? 'false' : 'true'}
        aria-hidden="true"
      />
      {!running && (
        <span className="flex-shrink-0 ask-text-sm text-[#0F6E4F]" aria-hidden="true">✓</span>
      )}
      <span className={`nova-t-proc min-w-0 truncate ${running ? 'nova-shimmer' : ''}`}>{label}</span>
      {/* Law 11 — progress stays visible even when the reader has folded the trail away mid-run.
          An ORDINAL, not a fraction: the steps view receives no plan, so the total is genuinely
          unknown until the stream ends. "4 checks done" is true; "4 of 9" would be invented. */}
      {running && collapsed && counts.checks > 0 && (
        <span className="nova-t-meta ml-auto flex-shrink-0">{counts.checks} done</span>
      )}
    </button>
  );

  if (collapsed) return <div>{header}</div>;

  return (
    <div>
      <div
        className="nova-fold-body"
        ref={bodyRef}
        style={maxH !== null && hasAnswer ? { maxHeight: maxH } : undefined}
      >
        {header}

        {/* §5 — WHAT was checked, never HOW anything was reasoned. Every row below is a task
            the investigation performed; naming the section says so explicitly, so an expanded
            trail cannot be read as Nova narrating its own thinking. */}
        {!running && <h5 className="nova-t-label mt-3">Checks performed</h5>}
        <ol className="mt-2 space-y-0.5">
          {hidden.length > 0 && (
            <li>
              <button
                type="button"
                onClick={() => setStepsOpen((v) => !v)}
                aria-expanded={stepsOpen}
                className="nova-btn nova-btn-ghost nova-t-meta flex w-full items-center gap-2 rounded px-1 py-1 text-left"
              >
                <span className="flex size-4 flex-shrink-0 items-center justify-center">
                  <ChevronDown size={13} className="nova-chev" data-open={stepsOpen ? 'true' : 'false'} />
                </span>
                {hidden.length} check{hidden.length === 1 ? '' : 's'} completed
              </button>
              {stepsOpen && (
                <ol className="mt-0.5 space-y-0.5">
                  {hidden.map((s) => <StepRow key={s.id} step={s} isLive={false} />)}
                </ol>
              )}
            </li>
          )}
          {shown.map((s, i) => (
            <StepRow key={s.id} step={s} isLive={hiddenOffset + i === live} />
          ))}
        </ol>

        {/* Findings belong to the WAIT. Once there is an answer they are justification and
            EvidenceBlock owns them — see DiscoveryBlock's note on why they are not in both. */}
        {showFound && running && <DiscoveryBlock discoveries={turn.discoveries} />}

        <NovaFailure turn={turn} onRetry={onRetry} />

        {turn.ended && !turn.answer && !turn.error && !turn.stopped && turn.steps.length > 0 && (
          /* The stream ended with neither. The list above is STILL pulsing — that is
             `activeIndex` — so this says why rather than leaving it looking like a hang. */
          <p className="nova-t-meta mt-2">Still working on the last check…</p>
        )}
      </div>
    </div>
  );
}

/** One check. `isLive` comes from the derived index, never the stored status, so the stalled
 *  case reuses this component untouched. */
function StepRow({ step, isLive }: { step: FeedStep; isLive: boolean }) {
  const complete = step.status === 'complete' && !isLive;
  return (
    <li
      /* role="status" as specified, with announcements OFF. The role is what makes this the
         current status semantically; `aria-live` is what would read every tick aloud, and that
         is ruled out in the same breath. The discoveries region does the announcing. */
      {...(isLive ? { role: 'status' as const, 'aria-live': 'off' as const } : {})}
      className={`nova-t-step flex items-start gap-2.5 px-1 py-[3px] transition-colors ${
        isLive ? 'text-[var(--nova-ink)]'
          : complete ? 'text-[var(--nova-ink-muted)]' : 'text-[var(--nova-ink-faint)]'}`}
    >
      <span className="mt-[3px] flex size-3.5 flex-shrink-0 items-center justify-center" aria-hidden="true">
        {complete ? (
          <svg viewBox="0 0 16 16" className="size-3 text-[#12805C]" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path className="nova-tick" d="M3.5 8.4 6.6 11.5 12.5 5" pathLength={1} />
          </svg>
        ) : isLive ? (
          <span className="nova-pulse block size-[6px] rounded-full bg-[#3D8BD0]" />
        ) : (
          <span className="block size-[6px] rounded-full border border-[#D7DEE7]" />
        )}
      </span>
      <span className={isLive ? 'ask-w-500' : ''}>{step.label}</span>
      {isLive && <span className="sr-only"> — in progress</span>}
    </li>
  );
}
