import { planImpact, type Tec8PlanState } from './tec8Model';

/* WHAT WILL CHANGE — the line between reading a proposal and authorising one.
 *
 * DERIVED from the same settings the steps are built from, so it cannot describe a plan other
 * than the one above it. Authoring this list separately would be two descriptions of one thing,
 * and on an approval screen the wrong one being right is the failure that matters.
 *
 * A row appears for EVERY setting, including the ones nothing happens to. "Priority — No
 * change" is the single most important line in the revised plan: it is the thing the reader
 * asked not to happen, and the only way to show it was heard is to say it.
 */
export function Tec8ImpactSummary({ settings, heading = 'What will change' }: {
  /** The whole plan, not just its settings — a removed step has to remove its consequence. */
  settings: Tec8PlanState;
  heading?: string;
}) {
  const rows = planImpact(settings);
  return (
    <section className="tec8-impact">
      <h4 className="nova-t-label">{heading}</h4>
      <dl className="nova-kv">
        {rows.map((r) => (
          <div key={r.label} className="nova-kv-row">
            <dt className="nova-kv-label">{r.label}</dt>
            <dd className={`nova-kv-value ${r.changed ? '' : 'tec8-nochange'}`}>{r.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
