import { completionLines, TEC8_TICKET, type Tec8PlanState } from './tec8Model';

/* WHAT ACTUALLY HAPPENED.
 *
 * ── THE LIST IS DERIVED FROM THE APPROVED PLAN ───────────────────────────────
 * Not from the plan on screen, and not authored. A completion summary is the one place in this
 * flow where being wrong is indistinguishable from lying — so it is computed from the exact
 * snapshot that was authorised and executed.
 *
 * ⚠️ "Priority unchanged" IS A RESULT. It was the reader's own instruction, and a summary that
 * lists only what changed would be silent about the single thing they asked to prevent. Peak-End
 * (law 10): the end of this flow should confirm what was accomplished, and "I did not do the
 * thing you told me not to do" is part of that.
 */
export function Tec8Completion({ approved, onViewTicket, onContinue }: {
  approved: Tec8PlanState;
  onViewTicket: () => void;
  onContinue: () => void;
}) {
  const lines = completionLines(approved, 'success');

  return (
    <section className="tec8-done" style={{ marginTop: 'var(--nova-gap-block)' }}>
      <h4 className="nova-t-label tec8-done-eyebrow">Done</h4>
      {/* role=status: this one IS worth interrupting for — it is the outcome of a change to a
          real record, and it arrives after a wait. */}
      <p className="nova-headline" role="status">
        {TEC8_TICKET.id} has been escalated successfully.
      </p>

      <h5 className="nova-t-label tec8-done-sub">Changes made</h5>
      <ul className="tec8-done-list">
        {lines.map((l) => (
          <li key={l.text} className="tec8-done-item">
            <span className="tec8-done-tick" aria-hidden="true">✓</span>
            {l.text}
          </li>
        ))}
      </ul>

      <div className="tec8-plan-actions">
        {/* The ONLY intentional way out of the conversation. */}
        <button
          type="button"
          className="nova-btn nova-btn-primary tec8-btn-primary"
          onClick={onViewTicket}
        >View ticket</button>
        <button
          type="button"
          className="nova-btn nova-btn-ghost tec8-btn-secondary"
          onClick={onContinue}
        >Continue investigating</button>
      </div>
    </section>
  );
}
