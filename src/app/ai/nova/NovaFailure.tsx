import { RotateCcw, TriangleAlert, CircleStop } from 'lucide-react';
import type { Turn } from './turnModel';

/* An investigation that did not produce an answer — and the one way out of it.
 *
 * ── WHY THIS IS ONE COMPONENT ────────────────────────────────────────────────────────────────
 * The same fact was rendered three different ways: a bordered red card in the step feed, and a
 * bare red line in the reveal and workspace views — none of which offered a way to continue.
 * UX law 16 says one meaning gets one treatment; law 15 says a failure must be recoverable. The
 * `recoverable` flag was already travelling on every error event with NOTHING reading it, and
 * `NovaFeed` had a Try-again branch that could never render because no caller passed `onRetry`.
 *
 * ── TWO ENDINGS, TWO TONES ───────────────────────────────────────────────────────────────────
 * A FAILURE is red: unexpected, and the reader needs to know something went wrong.
 * A STOP is neutral: the reader asked for it, and dressing their own decision in alarm colours
 * tells them they made a mistake. Both offer the same single next step, because both leave the
 * person in the same place — holding a question with no answer.
 *
 * Whatever was found before the interruption stays on screen above this. It is still true, and
 * it is the only thing they have.
 */
export function NovaFailure({ turn, onRetry }: { turn: Turn; onRetry?: () => void }) {
  if (!turn.error && !turn.stopped) return null;
  const stopped = turn.stopped && !turn.error;
  /* A stop is always retryable — nothing failed. An error is retryable when the stream said so. */
  const canRetry = !!onRetry && (stopped || !!turn.error?.recoverable);

  const found = turn.discoveries.length;
  const checks = turn.steps.filter((s) => s.status === 'complete').length;

  return (
    <section
      className={`nova-disc mt-4 rounded-lg border px-3.5 py-3 ${
        stopped ? 'border-[var(--nova-rule)] bg-[#FAFBFC]' : 'border-[#F3D2D2] bg-[#FDF6F6]'}`}
    >
      <p className={`flex items-start gap-2 text-[13px] font-medium ${
        stopped ? 'text-[var(--nova-ink)]' : 'text-[#B42318]'}`}
      >
        {stopped
          ? <CircleStop size={15} className="mt-px flex-shrink-0 text-[var(--nova-ink-muted)]" />
          : <TriangleAlert size={15} className="mt-px flex-shrink-0" />}
        {stopped ? 'You stopped this' : 'Something went wrong partway through'}
      </p>

      {/* Plain language, and it names what SURVIVED — law 15 is "preserve the user's work", and
          the checks already run are the work. Silence here reads as "start over". */}
      <p className="mt-1 pl-[23px] text-[12px] leading-[1.55] text-[var(--nova-ink-muted)]">
        {stopped
          ? (checks > 0
            ? `${checks} check${checks === 1 ? '' : 's'}${found ? ` and ${found} finding${found === 1 ? '' : 's'}` : ''} `
              + 'from before you stopped are still below.'
            : 'Nothing had finished yet, so there is nothing to keep.')
          : turn.error?.message}
      </p>

      {canRetry && (
        <div className="mt-2.5 pl-[23px]">
          <button
            type="button"
            onClick={onRetry}
            className="nova-btn inline-flex h-8 items-center gap-1.5 rounded border border-[#DFE5ED] bg-white px-3 text-[12px] font-medium text-[var(--nova-ink)] hover:border-[var(--nova-primary)]"
          >
            <RotateCcw size={13} aria-hidden="true" /> Try again
          </button>
        </div>
      )}
    </section>
  );
}
