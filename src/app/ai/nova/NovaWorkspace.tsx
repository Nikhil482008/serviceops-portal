import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Sparkles } from 'lucide-react';
import { activeIndex, turnCounts, type FeedDiscovery, type FeedStep, type Turn } from './turnModel';
import { prefersReducedMotion } from './novaMotion';
import { NovaFailure } from './NovaFailure';

/* The LEADERSHIP view: a live workspace rather than a queue.
 *
 * The other two views are lists — the requester's full one, the technician's two-line one. Both
 * answer "what is it doing right now". Leadership is not asking that. They are asking whether the
 * answer is worth acting on, and the thing that earns that is seeing the BREADTH: several lanes
 * of work running at once, across sources they know exist, resolving into numbers.
 *
 * So the scaffold is drawn from the `plan` event before anything has finished — every lane and
 * every pass is there from the first frame. Nothing appears late and nothing reflows; what
 * changes is that rows resolve from a verb ("Counting breaches") into a fact ("27 breached").
 *
 * ⚠️ THE SAME TURN, THE SAME EVENTS, THE SAME REDUCER as the other two views. This file contains
 * no timers driving order and no content of its own — it is a third way of drawing `Turn`.
 */

const COLLAPSE_DELAY_MS = 300;

export function NovaWorkspace({ turn, onRetry }: { turn: Turn; onRetry?: () => void }) {
  const [open, setOpen] = useState(true);
  const [userToggled, setUserToggled] = useState(false);
  const hasAnswer = !!turn.answer;

  useEffect(() => {
    if (!hasAnswer || userToggled) return;
    const t = window.setTimeout(() => setOpen(false), prefersReducedMotion() ? 0 : COLLAPSE_DELAY_MS);
    return () => clearTimeout(t);
  }, [hasAnswer, userToggled]);

  const live = activeIndex(turn);
  const counts = turnCounts(turn);

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

  if (!open) {
    return (
      <button
        type="button"
        aria-expanded={false}
        onClick={() => { setUserToggled(true); setOpen(true); }}
        className="nova-fold flex items-center gap-2 rounded px-1 py-1 ask-text-sm text-[#9CA3AF] transition-colors hover:bg-[#F5F7FA] hover:text-[#7B8FA5]"
      >
        <span className="text-[#12805C]" aria-hidden="true">✓</span>
        {counts.checks} check{counts.checks === 1 ? '' : 's'} across {passes.length} pass{passes.length === 1 ? '' : 'es'}
        {counts.findings > 0 && ` · ${counts.findings} finding${counts.findings === 1 ? '' : 's'}`}
        <ChevronDown size={12} className="-rotate-90" aria-hidden="true" />
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-[#E5E7EB] bg-white/70 backdrop-blur-sm">
      {/* ── the header: what this is working across ─────────────────── */}
      <div className="border-b border-[#EEF2F6] px-3.5 py-2.5">
        <div className="flex items-baseline gap-2">
          <p className="ask-text-base ask-w-600 text-[#364658]">
            Investigating {turn.topic || 'your question'}
          </p>
          {hasAnswer && (
            <button
              type="button"
              aria-expanded
              onClick={() => { setUserToggled(true); setOpen(false); }}
              className="ml-auto rounded px-1.5 py-0.5 ask-text-sm text-[#9CA3AF] transition-colors hover:bg-[#F5F7FA] hover:text-[#7B8FA5]"
            >
              Hide
            </button>
          )}
        </div>
        {!!turn.scope?.length && (
          <div className="mt-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            {turn.scope.map((s) => (
              <span key={s.label} className="ask-text-sm text-[#9CA3AF]">
                <b className="ask-w-600 text-[#364658]">{s.value}</b> {s.label}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-3 px-3.5 py-3">
        {passes.filter((p) => p.started).map((p, pi) => (
          <section key={p.phase} className={pi > 0 ? 'nova-feed-in' : undefined}>
            <h3 className="ask-text-xs ask-w-600 uppercase tracking-[0.08em] text-[#B6C1CE]">
              {p.phase}
            </h3>
            <div className="mt-1.5 space-y-2">
              {p.lanes.map((l) => (
                <div key={l.name} className="grid grid-cols-[68px_1fr] gap-2">
                  <span className="pt-[3px] ask-text-sm ask-w-500 text-[#9CA3AF]">{l.name}</span>
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

        <NovaFailure turn={turn} onRetry={onRetry} />
      </div>
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
        complete ? 'text-[#7B8FA5]' : isLive ? 'text-[#364658]' : 'text-[#C6CFDA]'}`}
    >
      <span aria-hidden="true" className="w-2.5 flex-shrink-0 ask-text-sm">
        {complete ? <span className="text-[#12805C]">✓</span>
          : isLive ? <span className="nova-pulse inline-block size-[6px] rounded-full bg-[#3D8BD0] align-middle" />
            : '·'}
      </span>
      {complete && step.metric
        ? <span><CountUp value={step.metric.value} /> <span className="text-[#9CA3AF]">{step.metric.label}</span></span>
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

  if (!numeric) return <b className="ask-w-500 text-[#364658]">{value}</b>;
  return <b className="ask-w-500 tabular-nums text-[#364658]">{n.toLocaleString()}</b>;
}

function Found({ d }: { d: FeedDiscovery }) {
  return (
    <div className="nova-disc mt-2.5 rounded border border-[#E7DEF9] bg-[#FAF7FF] px-2.5 py-2" aria-live="polite">
      <p className="flex items-center gap-1.5 ask-text-xs ask-w-600 uppercase tracking-wider text-[#7B5BD6]">
        <Sparkles size={11} /> Nova found something
      </p>
      <p className="mt-1 ask-text-sm ask-w-600 leading-[1.45] text-[#364658]">{d.headline}</p>
      <p className="mt-0.5 ask-text-sm leading-[1.5] text-[#7B8FA5]">{d.detail}</p>
    </div>
  );
}
