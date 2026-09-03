import { execRows, type Tec8Outcome, type Tec8Step } from './tec8Model';

/* EXECUTING THE APPROVED PLAN.
 *
 * ⚠️ NO INDETERMINATE SPINNER, ANYWHERE. A spinner says "a machine is busy"; these rows say
 * which of six named things is happening and how many are left. That is the difference between
 * waiting and watching, and on a surface that is changing a real ticket it is also the
 * difference between trusting it and not.
 *
 * ── THIS RENDERS THE APPROVED PLAN ───────────────────────────────────────
 * The steps come from the snapshot taken at approval, never from the live plan. Approval
 * authorises one exact plan; showing anything else here would be describing work that was not
 * agreed to.
 *
 * ── ANNOUNCEMENTS ─────────────────────────────────────────────────────
 * The list does NOT announce each tick — six interruptions in eight seconds is unusable. The
 * region is announced ONCE on arrival ("Executing 6 steps"), and the outcome announces itself
 * when it replaces this. Same rule the investigation feed follows.
 */
export function Tec8ExecutionProgress({ steps, index, outcome, finished }: {
  steps: Tec8Step[];
  index: number;
  outcome: Tec8Outcome;
  finished: boolean;
}) {
  const rows = execRows(steps, index, outcome, finished);
  const total = steps.length;

  return (
    <section className="tec8-exec" style={{ marginTop: 'var(--nova-gap-block)' }}>
      <h4 className="nova-t-label">Plan approved</h4>
      <p className="tec8-exec-lead" role="status">
        {finished ? `Ran ${total} steps` : `Executing ${total} steps`}
      </p>

      <ol className="tec8-exec-list">
        {rows.map((r, i) => (
          <li
            key={r.step.id}
            className="tec8-exec-row"
            data-status={r.status}
            /* aria-live OFF, deliberately — see the note above. */
            {...(r.status === 'running' ? { role: 'status' as const, 'aria-live': 'off' as const } : {})}
          >
            <span className="tec8-exec-n" aria-hidden="true">{i + 1} / {total}</span>
            <span className="tec8-exec-glyph" aria-hidden="true">
              {r.status === 'done' ? '✓'
                : r.status === 'failed' ? '⚠'
                  : r.status === 'running' ? <span className="nova-pulse tec8-exec-dot" />
                    : <span className="tec8-exec-ring" />}
            </span>
            <span className="tec8-exec-label">{r.step.running}</span>
            {/* Shape and colour are never the only carrier of a status. */}
            <span className="sr-only">
              {r.status === 'done' ? ' — completed'
                : r.status === 'failed' ? ' — failed'
                  : r.status === 'running' ? ' — in progress' : ' — upcoming'}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
