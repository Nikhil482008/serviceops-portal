import { useEffect, useMemo, useRef, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { activeIndex, type FeedDiscovery, type FeedStep, type Turn } from './turnModel';
import { prefersReducedMotion } from './novaMotion';
import { NovaFailure } from './NovaFailure';
import { NovaThinkingSummary } from './conversation/NovaThinkingSummary';

/* The LEADERSHIP view: a live workspace rather than a queue.
 *
 * The other views are lists — the requester's full one, the technician's two-line one. Both
 * answer "what is it doing right now". Leadership is not asking that. They are asking whether the
 * answer is worth acting on, and the thing that earns that is seeing the BREADTH: several lanes
 * of work running at once, across sources they know exist, resolving into numbers.
 *
 * So the scaffold is drawn from the `plan` event before anything has finished — every lane and
 * every pass is there from the first frame. Nothing appears late and nothing reflows; what
 * changes is that rows resolve from a verb ("Counting breaches") into a fact ("27 breached").
 *
 * ── BEHIND THE ONE ROW ──────────────────────────────────────────────────────────────────────
 * The passes used to sit in a bordered card with their own header. They are the trail now,
 * behind the same thinking row every view shares, and the card's chrome went with the header.
 *
 * ⚠️ THE SAME TURN, THE SAME EVENTS, THE SAME REDUCER as the other views. This file contains
 * no timers driving order and no content of its own — it is one more way of drawing `Turn`.
 */

export function NovaWorkspace({ turn, onRetry }: { turn: Turn; onRetry?: () => void }) {
  const live = activeIndex(turn);

  /* phase → lane → steps, in the order the plan declared them. A Map keeps insertion order, so
     the passes read top to bottom exactly as the script wrote them. */
  const passes = useMemo(() => {
    const byPhase = new Map<string, Map<string, FeedStep[]>>();
    turn.steps.forEach((s) => {
      const p = s.phase ?? 'Live analysis';
      const l = s.lane ?? 'Checks';
      if (!byPhase.has(p)) byPhase.set(p, new Map());
      const lanes = byPhase.get(p)!;
      if (!lanes.has(l)) lanes.set(l, []);
      lanes.get(l)!.push(s);
    });
    return [...byPhase.entries()].map(([phase, lanes]) => ({
      phase,
      lanes: [...lanes.entries()].map(([name, steps]) => ({ name, steps })),
      /* A pass is only shown once its first check has started — otherwise every pass would be on
         screen from the first frame and the sequence would read as one long list. */
      started: [...lanes.values()].flat().some((s) => s.status !== 'pending'),
    }));
  }, [turn.steps]);

  /* Findings that arrived after a pass finished sit between the passes, where they happened. */
  const foundAfter = useMemo(() => {
    const m = new Map<string, FeedDiscovery[]>();
    turn.discoveries.forEach((d) => {
      const key = d.afterStepId ?? '';
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(d);
    });
    return m;
  }, [turn.discoveries]);

  const trail = (
    <div className="space-y-3">
      {/* What this is working across — the authored scope, first. */}
      {!!turn.scope?.length && (
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          {turn.scope.map((s) => (
            <span key={s.label} className="ask-text-sm text-[var(--nova-text-muted)]">
              <b className="ask-w-600 text-[var(--nova-text-primary)]">{s.value}</b> {s.label}
            </span>
          ))}
        </div>
      )}

      {passes.filter((p) => p.started).map((p, pi) => (
        <section key={p.phase} className={pi > 0 ? 'nova-feed-in' : undefined}>
          <h3 className="ask-text-xs ask-w-600 uppercase tracking-[0.08em] text-[var(--nova-text-muted)]">
            {p.phase}
          </h3>
          <div className="mt-1.5 space-y-2">
            {p.lanes.map((l) => (
              <div key={l.name} className="grid grid-cols-[68px_1fr] gap-2">
                <span className="pt-[3px] ask-text-sm ask-w-500 text-[var(--nova-text-muted)]">{l.name}</span>
                <div className="space-y-0.5">
                  {l.steps.map((s) => (
                    <Row key={s.id} step={s} isLive={turn.steps.indexOf(s) === live} />
                  ))}
                </div>
              </div>
            ))}
          </div>
          {/* Findings raised by the last check in this pass. */}
          {p.lanes.flatMap((l) => l.steps).flatMap((s) => foundAfter.get(s.id) ?? []).map((d) => (
            <Found key={d.id} d={d} />
          ))}
        </section>
      ))}

      {/* Findings with no step behind them (a stream that raised one before any check finished). */}
      {(foundAfter.get('') ?? []).map((d) => <Found key={d.id} d={d} />)}
    </div>
  );

  return (
    <div>
      <NovaThinkingSummary turn={turn} history={trail} />
      <NovaFailure turn={turn} onRetry={onRetry} />
    </div>
  );
}

/** One check. The label while it runs, the number it landed on once it is done — which is the
 *  response forming in front of the reader rather than a spinner resolving into prose. */
function Row({ step, isLive }: { step: FeedStep; isLive: boolean }) {
  const complete = step.status === 'complete' && !isLive;
  return (
    <p
      {...(isLive ? { role: 'status' as const, 'aria-live': 'off' as const } : {})}
      className={`flex items-baseline gap-1.5 ask-text-sm ${
        complete ? 'text-[var(--nova-text-secondary)]' : isLive ? 'text-[var(--nova-text-primary)]' : 'text-[var(--nova-text-disabled)]'}`}
    >
      <span aria-hidden="true" className="w-2.5 flex-shrink-0 ask-text-sm">
        {complete ? <span className="text-[var(--nova-text-secondary)]">✓</span>
          : isLive ? <span className="nova-pulse inline-block size-[6px] rounded-full bg-[var(--nova-action)] align-middle" />
            : '·'}
      </span>
      {complete && step.metric
        ? <span><CountUp value={step.metric.value} /> <span className="text-[var(--nova-text-muted)]">{step.metric.label}</span></span>
        : <span className={isLive ? 'nova-shimmer' : ''}>{step.label}</span>}
    </p>
  );
}

/** The number arriving rather than simply being there.
 *
 * Counts only when the value IS a number; "Service Desk" and "3 June" are revealed whole, because
 * counting through nonsense to reach a word is worse than not animating at all. Reduced motion
 * lands on the final value immediately — the value is information, the count is decoration. */
function CountUp({ value }: { value: string }) {
  const numeric = /^[\d,]+$/.test(value);
  const target = numeric ? Number(value.replace(/,/g, '')) : 0;
  const [n, setN] = useState(() => (numeric && !prefersReducedMotion() ? 0 : target));
  const raf = useRef(0);

  useEffect(() => {
    if (!numeric || prefersReducedMotion()) { setN(target); return; }
    const started = performance.now();
    const DUR = 620;
    const tick = (now: number) => {
      const p = Math.min(1, (now - started) / DUR);
      /* Ease-out cubic: fast at first, so the magnitude is legible early and the last digits
         settle rather than race. */
      setN(Math.round(target * (1 - (1 - p) ** 3)));
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [numeric, target]);

  if (!numeric) return <b className="ask-w-500 text-[var(--nova-text-primary)]">{value}</b>;
  return <b className="ask-w-500 tabular-nums text-[var(--nova-text-primary)]">{n.toLocaleString()}</b>;
}

function Found({ d }: { d: FeedDiscovery }) {
  return (
    <div className="nova-disc mt-2.5 rounded border border-[var(--nova-border)] bg-[var(--nova-surface-subtle)] px-2.5 py-2" aria-live="polite">
      <p className="flex items-center gap-1.5 ask-text-xs ask-w-600 uppercase tracking-wider text-[var(--nova-text-secondary)]">
        <Sparkles size={11} /> Nova found something
      </p>
      <p className="mt-1 ask-text-sm ask-w-600 leading-[1.45] text-[var(--nova-text-primary)]">{d.headline}</p>
      <p className="mt-0.5 ask-text-sm leading-[1.5] text-[var(--nova-text-secondary)]">{d.detail}</p>
    </div>
  );
}
