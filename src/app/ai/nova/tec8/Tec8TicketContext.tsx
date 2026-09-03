import { TEC8_TICKET } from './tec8Model';

/* THE TICKET, compactly.
 *
 * Deliberately not a dashboard card. Everything here exists to answer one question — is this
 * the right ticket, and does it look like it needs escalating — so it is four facts, three
 * things already tried, and nothing else. Anything more would compete with the plan, which is
 * the thing the reader is actually here to judge.
 *
 * ⚠️ "At risk" is marked with a glyph as well as a colour. A reader who cannot separate amber
 * from grey still has to be able to see that the SLA is the reason this is urgent.
 */
export function Tec8TicketContext() {
  const t = TEC8_TICKET;
  const facts: Array<[string, string, boolean]> = [
    ['Status', t.status, false],
    ['Priority', t.priority, false],
    ['Age', t.age, false],
    ['SLA', t.sla, true],
  ];

  return (
    <section className="tec8-ctx" style={{ marginTop: 'var(--nova-gap-block)' }}>
      <h4 className="tec8-ctx-id">
        {t.id}
        <span className="tec8-ctx-title">{t.title}</span>
      </h4>

      <dl className="tec8-ctx-grid">
        {facts.map(([label, value, warn]) => (
          <div key={label} className="tec8-ctx-cell">
            <dt className="nova-t-label">{label}</dt>
            <dd className={`tec8-ctx-value ${warn ? 'tec8-warn' : ''}`}>
              {warn && <span aria-hidden="true">⚠ </span>}{value}
            </dd>
          </div>
        ))}
      </dl>

      <div className="tec8-ctx-tried">
        <h5 className="nova-t-label">Previous troubleshooting</h5>
        <ul className="tec8-chips">
          {t.tried.map((x) => <li key={x} className="tec8-chip">{x}</li>)}
        </ul>
      </div>
    </section>
  );
}
