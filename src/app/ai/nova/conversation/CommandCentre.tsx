import { useMemo } from 'react';
import { type FeedDiscovery, type FeedStep, type Turn } from '../turnModel';
import { NovaFailure } from '../NovaFailure';
import { NovaThinkingSummary } from './NovaThinkingSummary';

/* THE COMMAND CENTRE — the leadership investigation's TRAIL.
 *
 * Leadership does not watch a checklist. They watch the ESTATE being scanned: a 2-column grid
 * of SOURCE LANES that progress in parallel — several lanes lit at once, each resolving from a
 * verb into a number — with findings beneath under NOVA FOUND.
 *
 * ── BEHIND THE ONE ROW ──────────────────────────────────────────────────────────────────────
 * That grid used to BE the surface, which made leadership's "what is Nova doing" a different
 * shape from everyone else's. It is the trail now, behind the same sentence every case shows —
 * how long, and what is happening — and the lanes still say what only they can say, that four
 * sources are being read at once, one click away.
 *
 * ⚠️ SAME EVENT STREAM, SAME REDUCER, SAME askNova as the requester feed. This is a fourth way
 * of drawing `Turn`: lanes are `step.lane`, parallelism is the reducer keeping one active step
 * per lane, and nothing here holds a timer that drives order.
 *
 * prefers-reduced-motion: rows swap with a 100ms fade and the pulse is stilled (theme.css).
 */

export function CommandCentre({ turn, onRetry }: { turn: Turn; onRetry?: () => void }) {
  const running = !turn.answer && !turn.error && !turn.stopped;

  /* Lanes in the order the plan declared them; only started rows show. */
  const lanes = useMemo(() => {
    const by = new Map<string, FeedStep[]>();
    turn.steps.forEach((s) => {
      const l = s.lane ?? 'Checks';
      if (!by.has(l)) by.set(l, []);
      by.get(l)!.push(s);
    });
    return [...by.entries()].map(([name, steps]) => ({ name, steps }));
  }, [turn.steps]);

  /* NEVER FINISH BEFORE THE ANSWER: while running with nothing active, the most recently
     completed row keeps pulsing — the same rule `activeIndex` enforces for the linear feed. */
  const anyActive = turn.steps.some((s) => s.status === 'active');
  const lastDone = [...turn.steps].reverse().find((s) => s.status === 'complete');
  const isLive = (s: FeedStep) => s.status === 'active' || (running && !anyActive && lastDone?.id === s.id);

  const sources = lanes.length;

  /* THE LANES — the trail this component exists for. */
  const trail = (
    <div>
      <div className="nova-cc-grid" data-cc-lanes>
        {lanes.map((l) => (
          <section key={l.name} className="nova-cc-lane" data-lane={l.name}>
            <h4 className="ask-text-xs ask-w-600 uppercase tracking-[0.08em] text-[var(--nova-text-muted)]">{l.name}</h4>
            <ul className="mt-1 space-y-0.5">
              {l.steps.filter((s) => s.status !== 'pending').map((s) => {
                const live = isLive(s);
                const done = s.status === 'complete' && !live;
                return (
                  <li
                    key={s.id}
                    className={`nova-cc-row flex items-baseline gap-1.5 ask-text-sm ${done ? 'text-[var(--nova-ink)]' : 'text-[var(--nova-ink-muted)]'}`}
                    data-row={done ? 'done' : 'active'}
                    {...(live ? { role: 'status' as const, 'aria-live': 'off' as const } : {})}
                  >
                    <span aria-hidden="true" className="w-3 flex-shrink-0 text-center">
                      {done ? <span className="text-[var(--nova-text-secondary)]">✓</span>
                        : <span className="nova-pulse inline-block size-[6px] rounded-full bg-[var(--nova-action)] align-middle" />}
                    </span>
                    {done && s.metric
                      ? <span><span className="ask-w-600 tabular-nums">{s.metric.value}</span> {s.metric.label}</span>
                      : <span className={live ? 'nova-shimmer' : ''}>{s.label}{live ? '…' : ''}</span>}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      {turn.discoveries.length > 0 && running && (
        /* Findings belong to the WAIT. Once there is an answer they are justification and
           EvidenceBlock owns them — the same rule the other views follow. */
        <div className="mt-3" data-cc-found>
          <p className="ask-text-xs ask-w-600 uppercase tracking-[0.08em] text-[var(--nova-text-muted)]">Nova found</p>
          <ul className="mt-1 space-y-1.5">
            {turn.discoveries.map((d) => <Found key={d.id} d={d} />)}
          </ul>
        </div>
      )}
    </div>
  );

  return (
    <div data-command-centre>
      {/* The source count rides the tally line — it is the one fact about a leadership
          investigation that the checks alone do not carry. */}
      <NovaThinkingSummary
        turn={turn}
        history={trail}
        metaExtra={sources ? `${sources} source${sources === 1 ? '' : 's'}` : undefined}
      />
      <NovaFailure turn={turn} onRetry={onRetry} />
    </div>
  );
}

function Found({ d }: { d: FeedDiscovery }) {
  const gap = d.role === 'gap';
  return (
    <li className={`nova-disc border-l-2 pl-3 ${gap ? 'border-[var(--nova-warning-border)]' : 'border-[var(--nova-g400)]'}`}>
      <p className="ask-text-base ask-w-600 leading-[1.45] text-[var(--nova-text-primary)]">{d.headline}</p>
      {d.detail && <p className="ask-text-sm leading-[1.5] text-[var(--nova-text-secondary)]">{d.detail}</p>}
    </li>
  );
}
