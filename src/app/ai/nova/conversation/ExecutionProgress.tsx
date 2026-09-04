import { TriangleAlert } from 'lucide-react';
import type { ExecStepState } from '../turnModel';

/* EXECUTION, OBSERVABLE — the approved plan running, step by step.
 *
 * ✓ completed · ● active · ○ upcoming · ⚠ failed. Never a spinner: the reader approved a list
 * of named actions and watches that exact list run. Status is carried by GLYPH and word, never
 * by colour alone.
 *
 * A FAILED step does not pretend: the run parks, the reason stays visible beside the step, and
 * the retry names what it retries. Success resumes from the failed step — nothing before it
 * re-runs, nothing after it is claimed early.
 */
export function ExecutionProgress({ steps, live, onRetry }: {
  steps: ExecStepState[];
  /** The parked stream can still be released. */
  live: boolean;
  onRetry: (stepId: string) => void;
}) {
  if (!steps.length) return null;
  const failed = steps.find((s) => s.status === 'failed');

  return (
    <section style={{ marginTop: 16 }} aria-label="Executing the approved plan" data-execution>
      <p className="nova-t-label">Executing the approved plan</p>
      <ul className="mt-2 space-y-1.5" role="status" aria-live="polite">
        {steps.map((s) => (
          <li
            key={s.id}
            className={`flex items-baseline gap-2 ask-text-sm ${
              s.status === 'done' ? 'text-[var(--nova-ink)]'
                : s.status === 'active' ? 'text-[var(--nova-ink)]'
                  : s.status === 'failed' ? 'text-[#8C2018]'
                    : 'text-[var(--nova-ink-faint)]'}`}
            data-exec-step={s.status}
          >
            <span aria-hidden="true" className="w-3 flex-shrink-0 text-center ask-text-sm">
              {s.status === 'done' ? <span className="text-[#12805C]">✓</span>
                : s.status === 'active' ? <span className="nova-pulse inline-block size-[6px] rounded-full bg-[#3D8BD0] align-middle" />
                  : s.status === 'failed' ? <TriangleAlert size={11} className="inline text-[#B98900]" />
                    : '○'}
            </span>
            <span className={`min-w-0 ${s.status === 'active' ? 'nova-shimmer' : ''}`}>
              {s.label}
              {s.status === 'active' && '…'}
              {/* The word, for anyone colour and glyph do not reach. */}
              <span className="sr-only">
                {s.status === 'done' ? ' — completed' : s.status === 'active' ? ' — in progress'
                  : s.status === 'failed' ? ' — failed' : ' — upcoming'}
              </span>
            </span>
          </li>
        ))}
      </ul>

      {failed && (
        <div className="mt-2 pl-5" data-exec-failed>
          <p className="nova-t-meta text-[#8C2018]">{failed.note}</p>
          <button
            type="button"
            disabled={!live}
            onClick={() => onRetry(failed.id)}
            className="nova-btn nova-btn-primary mt-2 inline-flex h-8 items-center rounded px-3 ask-text-sm ask-w-500 disabled:opacity-40"
          >
            {failed.retry ?? 'Retry'}
          </button>
        </div>
      )}
    </section>
  );
}
