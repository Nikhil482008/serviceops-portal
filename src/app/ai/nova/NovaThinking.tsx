import { useMemo } from 'react';
import { type FeedDiscovery, type Turn } from './turnModel';
import { NovaThinkingSummary } from './conversation/NovaThinkingSummary';

/* The TECHNICIAN view of an investigation.
 *
 * Collapsed it is the one thinking row every view shares — how long, and what is happening now.
 * Expanded it shows the whole trail — every check, the sources each one read, and the findings
 * interleaved where they actually landed.
 *
 * ── WHY TWO LINES AND NOT THE LIST ───────────────────────────────────────────────────────────
 * A technician knows what a triage looks like. The running list that reassures a requester —
 * look, work is happening — is noise to someone who does this forty times a shift, and by turn
 * three it has pushed every answer off the screen. What they DO want, occasionally and urgently,
 * is to audit one answer: where did this come from, and what did you not check. So the trail is
 * never deleted, only folded, and the fold is one click.
 *
 * Same turn, same events, same reducer as the requester view. Only the rendering differs — which
 * is the point of the feed being a pure function of turn state.
 */

const COLLAPSE_DELAY_MS = 300;

export function NovaThinking({ turn }: { turn: Turn }) {
  /* The expanded trail: every step, with its findings sitting under the step they followed. */
  const trail = useMemo(() => {
    const loose = turn.discoveries.filter((d) => !d.afterStepId);
    return {
      loose,
      rows: turn.steps.map((s) => ({
        step: s,
        found: turn.discoveries.filter((d) => d.afterStepId === s.id),
      })),
    };
  }, [turn.steps, turn.discoveries]);

  const body = (
    <div className="space-y-2">
      {trail.loose.map((d) => <Found key={d.id} d={d} />)}
      {trail.rows.map(({ step, found }) => (
        <div key={step.id}>
          <p className={`flex items-baseline gap-1.5 ask-text-sm ${
            step.status === 'complete' ? 'text-[var(--nova-text-secondary)]'
              : step.status === 'active' ? 'text-[var(--nova-text-primary)]' : 'text-[var(--nova-text-disabled)]'}`}
          >
            <span aria-hidden="true" className="ask-text-sm">
              {step.status === 'complete' ? '✓' : step.status === 'active' ? '◷' : '·'}
            </span>
            {step.label}
          </p>
          {/* SOURCES — what this check actually read. Absent when the script did not say,
              rather than filled with a plausible guess. */}
          {!!step.sources?.length && (
            <ul className="mt-0.5 space-y-0.5 pl-4">
              {step.sources.map((src) => (
                <li key={src.label} className="ask-text-sm leading-[1.5] text-[var(--nova-text-muted)]">{src.label}</li>
              ))}
            </ul>
          )}
          {found.map((d) => <Found key={d.id} d={d} nested />)}
        </div>
      ))}
    </div>
  );

  /* THE ROW is the surface — the same sentence every other view shows — and the two-line
     summary this view used to draw is gone with it: the row's activity IS the current line. */
  return (
    <div>
      <NovaThinkingSummary turn={turn} history={body} />
      {turn.error && (
        <p className="mt-1.5 border-l border-[var(--nova-error-border)] pl-3.5 ask-text-sm text-[var(--nova-error)]">
          {turn.error.message}
        </p>
      )}
    </div>
  );
}

function Found({ d, nested = false }: { d: FeedDiscovery; nested?: boolean }) {
  return (
    <div className={`nova-disc ${nested ? 'mt-1 pl-4' : ''}`}>
      <p className="ask-text-sm ask-w-600 text-[var(--nova-text-primary)]">{d.headline}</p>
      <p className="ask-text-sm leading-[1.5] text-[var(--nova-text-secondary)]">{d.detail}</p>
    </div>
  );
}
