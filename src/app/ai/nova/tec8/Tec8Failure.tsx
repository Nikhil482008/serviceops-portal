import { completionLines, type Tec8PlanState } from './tec8Model';

/* WHEN PART OF IT DID NOT WORK.
 *
 * ⚠️ THE WHOLE POINT IS THAT IT DOES NOT ROUND UP. Three of four things happened and one did
 * not, and an agent that reports that as "escalated successfully" has destroyed the only thing
 * this pattern is trying to build — a reader who can believe the summary without going and
 * checking the ticket.
 *
 * So the heading says PARTIALLY, the failed line is marked as failed with a glyph AND a word,
 * and the primary action is the one that fixes the specific thing that broke (law 15). Nothing
 * here is styled as a catastrophe: three of four steps DID land, and the ticket is in a better
 * state than it was.
 */
export function Tec8Failure({ approved, onRetry, onViewTicket }: {
  approved: Tec8PlanState;
  onRetry: () => void;
  onViewTicket: () => void;
}) {
  const lines = completionLines(approved, 'partial');
  const failed = lines.find((l) => !l.ok);

  return (
    <section className="tec8-done" style={{ marginTop: 'var(--nova-gap-block)' }}>
      <h4 className="nova-t-label tec8-done-eyebrow">Partially completed</h4>
      <p className="nova-headline" role="status">
        Escalation partially completed — one step did not finish.
      </p>

      <ul className="tec8-done-list">
        {lines.map((l) => (
          <li key={l.text} className="tec8-done-item" data-failed={l.ok ? 'false' : 'true'}>
            <span className={l.ok ? 'tec8-done-tick' : 'tec8-done-warn'} aria-hidden="true">
              {l.ok ? '✓' : '⚠'}
            </span>
            {l.text}
            {!l.ok && <span className="tec8-done-failed">failed</span>}
          </li>
        ))}
      </ul>

      <div className="tec8-plan-actions">
        <button
          type="button"
          className="nova-btn nova-btn-primary tec8-btn-primary"
          onClick={onRetry}
        >{failed ? 'Retry notification' : 'Retry'}</button>
        <button
          type="button"
          className="nova-btn nova-btn-ghost tec8-btn-secondary"
          onClick={onViewTicket}
        >View ticket</button>
      </div>
    </section>
  );
}
