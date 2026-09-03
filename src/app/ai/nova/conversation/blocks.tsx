import type { AnswerKV, AnswerMetric, AnswerTable } from '../scripts/registry';

/* THE RESPONSE BLOCKS — the pieces a Nova answer is composed from.
 *
 * One file, because they share a single visual argument and splitting them into eight files
 * would hide that argument in an import list. Each is small, each is used by AnswerBlock, and
 * none of them knows what a turn is.
 *
 * ── THE ONE RULE THEY ALL OBEY ───────────────────────────────────────────────────────────────
 * Structured information is rendered STRUCTURALLY. "INC-4471 is with the gateway supplier as of
 * yesterday afternoon, nothing is needed from you, the next update is due within two working
 * days and the SLA clock is paused" is five facts in one sentence, and a reader has to parse the
 * sentence to get at any of them. The same five facts as labelled rows can be read in any order,
 * skipped, or scanned for one value — which is what someone checking on a ticket is doing.
 */

/* ── EMPHASIS ────────────────────────────────────────────────────────────────────────────────
 * `**…**` inside authored copy, and nothing else. Not a markdown renderer: the only thing that
 * gets marked is the thing worth scanning for — a ticket id, a number, a date, a status, a
 * vendor. A full markdown parser would let a script author bold a whole sentence, and a response
 * where everything is bold has exactly the same information density as one where nothing is.
 *
 * ⚠️ It splits on the delimiter rather than interpreting anything, so authored text cannot inject
 * markup: the parts are React children, never HTML. There is no `dangerouslySetInnerHTML` here
 * and there must never be — answer text is the one string in this module that will eventually
 * come from a model. */
export function Emph({ children }: { children: string }) {
  const parts = children.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((p, i) => (p.startsWith('**') && p.endsWith('**')
        ? <b key={i} className="ask-w-500 text-[var(--nova-ink)]">{p.slice(2, -2)}</b>
        : <span key={i}>{p}</span>))}
    </>
  );
}

/* ── THE HEADLINE ────────────────────────────────────────────────────────────────────────────
 * The conclusion, and the largest thing in the response. A reader who stops here has the answer;
 * everything below is why. That is the whole progressive-disclosure argument in one element. */
export function NovaHeadline({ children }: { children: string }) {
  return <p className="nova-headline"><Emph>{children}</Emph></p>;
}

/* ── KEY / VALUE ─────────────────────────────────────────────────────────────────────────────
 * Two columns, hairline rows, no box. The label is scaffolding and stays quiet; the value is the
 * content and carries the weight. Tone is used sparingly — a paused SLA is worth colouring, an
 * owner is not. */
const TONE: Record<string, string> = {
  ok: 'text-[#0F6E4F]',
  warn: 'text-[#8A6D1F]',
  risk: 'text-[#B42318]',
};

export function NovaKeyValues({ items }: { items: AnswerKV[] }) {
  if (!items.length) return null;
  return (
    <dl className="nova-kv">
      {items.map((k) => (
        <div key={k.label} className="nova-kv-row">
          <dt className="nova-kv-label">{k.label}</dt>
          <dd className={`nova-kv-value ${k.tone ? TONE[k.tone] : ''}`}>
            <Emph>{k.value}</Emph>
          </dd>
        </div>
      ))}
    </dl>
  );
}

/* ── THE TABLE ───────────────────────────────────────────────────────────────────────────────
 * Exact values, compared across categories. `barCol` draws the magnitude BEHIND the number, so
 * the table is also the ranking chart — one object rather than a table and a bar chart that can
 * disagree about the same numbers.
 *
 * Numeric columns are right-aligned and tabular-figured, so digits line up and the eye can
 * compare column-wise without reading. */
const isNum = (v: string) => /^[\d,.]+%?$/.test(v.trim());

export function NovaDataTable({ table }: { table: AnswerTable }) {
  const max = table.barCol !== undefined
    ? Math.max(...table.rows.map((r) => parseFloat((r[table.barCol!] || '0').replace(/,/g, '')) || 0), 1)
    : 0;

  return (
    <div className="nova-table-wrap">
      <table className="nova-table">
        <thead>
          <tr>
            {table.ranked && <th scope="col" className="nova-th nova-th-rank">#</th>}
            {table.cols.map((c, i) => (
              <th
                key={c}
                scope="col"
                className={`nova-th ${table.rows.some((r) => isNum(r[i])) ? 'nova-num' : ''}`}
              >{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((r, ri) => (
            <tr key={ri}>
              {table.ranked && <td className="nova-td nova-td-rank">{ri + 1}</td>}
              {r.map((cell, ci) => {
                const bar = ci === table.barCol
                  ? ((parseFloat(cell.replace(/,/g, '')) || 0) / max) * 100
                  : null;
                return (
                  <td key={ci} className={`nova-td ${isNum(cell) ? 'nova-num' : ''}`}>
                    {/* The bar sits UNDER the number, at low alpha. It gives the column a shape
                        you can read at a glance without ever making the value harder to read —
                        which is what a separate chart beside the table would cost. */}
                    {bar !== null && (
                      <span className="nova-td-bar" style={{ width: `${bar}%` }} aria-hidden="true" />
                    )}
                    <span className="nova-td-ink"><Emph>{cell}</Emph></span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── METRIC CARDS ────────────────────────────────────────────────────────────────────────────
 * A few headline numbers, each with the movement that makes it mean something. A number with no
 * comparison is a reading, not an answer — so `delta` sits under every value that has one.
 *
 * ⚠️ DIRECTION IS NOT SENTIMENT. Fewer open tickets is good and more breaches is not, and the
 * arrow cannot tell them apart. `good` is authored per metric precisely so the colour says what
 * the reader should feel rather than which way the number moved. */
export function NovaMetrics({ items }: { items: AnswerMetric[] }) {
  if (!items.length) return null;
  return (
    <div className="nova-metrics">
      {items.map((m) => (
        <div key={m.label} className="nova-metric">
          <p className="nova-metric-label">{m.label}</p>
          <p className="nova-metric-value">{m.value}</p>
          {m.delta && (
            <p className={`nova-metric-delta ${
              m.good === undefined ? '' : m.good ? 'nova-good' : 'nova-bad'}`}
            >
              {m.direction === 'up' ? '↑' : m.direction === 'down' ? '↓' : ''} {m.delta}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

/* ── THE INSIGHT ─────────────────────────────────────────────────────────────────────────────
 * What the data means, ABOVE the data. The reader should never be handed a table and left to
 * work out the point of it — that is the difference between an assistant and a query result. */
export function NovaInsight({ children }: { children: string }) {
  return <p className="nova-insight"><Emph>{children}</Emph></p>;
}
