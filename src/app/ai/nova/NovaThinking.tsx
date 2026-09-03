import { useEffect, useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { activeIndex, turnCounts, type FeedDiscovery, type FeedStep, type Turn } from './turnModel';
import { prefersReducedMotion } from './novaMotion';

/* The TECHNICIAN view of an investigation.
 *
 * Collapsed it shows TWO lines and nothing else: the last thing that finished, and the thing
 * running now. Expanded it shows the whole trail — every check, the sources each one read, and
 * the findings interleaved where they actually landed.
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
  const [open, setOpen] = useState(false);
  const [userToggled, setUserToggled] = useState(false);

  /* Once the answer is in, even the two lines fold to a single summary — the same rhythm as the
     requester view, so a thread of mixed turns reads consistently. */
  const [folded, setFolded] = useState(false);
  const hasAnswer = !!turn.answer;
  useEffect(() => {
    if (!hasAnswer || userToggled) return;
    const t = window.setTimeout(() => setFolded(true), prefersReducedMotion() ? 0 : COLLAPSE_DELAY_MS);
    return () => clearTimeout(t);
  }, [hasAnswer, userToggled]);

  const live = activeIndex(turn);
  const counts = turnCounts(turn);
  const running = !turn.answer && !turn.error;

  /* The two lines. `current` is the pulsing one; `previous` is the last thing that finished
     before it. Both derived — nothing is stored about "what was showing a moment ago". */
  const current: FeedStep | undefined = live >= 0 ? turn.steps[live] : undefined;
  const previous: FeedStep | undefined = useMemo(() => {
    const done = turn.steps.filter((s, i) => s.status === 'complete' && i !== live);
    return done[done.length - 1];
  }, [turn.steps, live]);

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

  if (folded) {
    return (
      <button
        type="button"
        aria-expanded={false}
        onClick={() => { setUserToggled(true); setFolded(false); setOpen(true); }}
        className="nova-fold flex items-center gap-2 rounded px-1 py-1 ask-text-sm text-[#9CA3AF] transition-colors hover:bg-[#F5F7FA] hover:text-[#7B8FA5]"
      >
        <span className="text-[#12805C]" aria-hidden="true">✓</span>
        {counts.checks} check{counts.checks === 1 ? '' : 's'}
        {counts.findings > 0 && ` · ${counts.findings} finding${counts.findings === 1 ? '' : 's'}`}
        <ChevronDown size={12} className="-rotate-90" aria-hidden="true" />
      </button>
    );
  }

  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => { setUserToggled(true); setOpen((v) => !v); }}
        className="flex w-full items-center gap-1.5 rounded px-1 py-1 text-left ask-text-base ask-w-500 text-[#364658] transition-colors hover:bg-[#F5F7FA]"
      >
        <ChevronDown size={13} className={`text-[#9CA3AF] transition-transform ${open ? '' : '-rotate-90'}`} aria-hidden="true" />
        {running ? 'Working on it' : 'Thought it through'}
        <span className="ml-auto ask-text-sm ask-w-400 text-[#B6C1CE]">
          {open ? 'Hide trail' : `${counts.checks} check${counts.checks === 1 ? '' : 's'}`}
        </span>
      </button>

      {/* The left rule is the thread the whole trail hangs off, collapsed or not — so expanding
          adds rows to something already on screen instead of replacing one shape with another. */}
      <div className="ml-[6px] border-l border-[#E5E7EB] pl-3.5">
        {!open ? (
          <div className="space-y-0.5 py-1">
            {/* PREVIOUS — settled, quiet, no mark. It is context, not a claim. */}
            {previous && (
              <p className="truncate ask-text-sm text-[#B6C1CE]">{previous.label}</p>
            )}
            {/* CURRENT — the only line carrying the shimmer, and only while work is running. */}
            {current ? (
              <p
                className={`truncate ask-text-sm text-[#7B8FA5] ${running ? 'nova-shimmer' : ''}`}
                {...(running ? { role: 'status' as const, 'aria-live': 'off' as const } : {})}
              >
                {current.label}
              </p>
            ) : (
              !previous && <p className="ask-text-sm text-[#B6C1CE]">Starting…</p>
            )}
          </div>
        ) : (
          <div className="space-y-2 py-1.5">
            {trail.loose.map((d) => <Found key={d.id} d={d} />)}
            {trail.rows.map(({ step, found }) => (
              <div key={step.id}>
                <p className={`flex items-baseline gap-1.5 ask-text-sm ${
                  step.status === 'complete' ? 'text-[#7B8FA5]'
                    : step.status === 'active' ? 'text-[#364658]' : 'text-[#C6CFDA]'}`}
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
                      <li key={src} className="ask-text-sm leading-[1.5] text-[#B6C1CE]">{src}</li>
                    ))}
                  </ul>
                )}
                {found.map((d) => <Found key={d.id} d={d} nested />)}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* The findings, always visible — collapsed or not. Folding the WORK away is the point;
          folding away what was FOUND would be hiding the part that changes what you do next.
          This is the one live region, as in the requester view. */}
      {turn.discoveries.length > 0 && !open && (
        <div className="ml-[6px] mt-1.5 space-y-1.5 border-l border-[#E5E7EB] pl-3.5" aria-live="polite">
          {turn.discoveries.map((d) => (
            <div key={d.id} className="nova-disc">
              <p className="ask-text-sm ask-w-600 text-[#364658]">{d.headline}</p>
              <p className="ask-text-sm leading-[1.5] text-[#7B8FA5]">{d.detail}</p>
            </div>
          ))}
        </div>
      )}

      {turn.error && (
        <p className="ml-[6px] mt-1.5 border-l border-[#F3D2D2] pl-3.5 ask-text-sm text-[#B42318]">
          {turn.error.message}
        </p>
      )}
    </div>
  );
}

function Found({ d, nested = false }: { d: FeedDiscovery; nested?: boolean }) {
  return (
    <div className={`nova-disc ${nested ? 'mt-1 pl-4' : ''}`}>
      <p className="ask-text-sm ask-w-600 text-[#364658]">{d.headline}</p>
      <p className="ask-text-sm leading-[1.5] text-[#7B8FA5]">{d.detail}</p>
    </div>
  );
}
