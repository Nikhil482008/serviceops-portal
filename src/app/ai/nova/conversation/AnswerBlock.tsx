import type { AnswerObject } from '../novaStream';
import { Emph, NovaDataTable, NovaHeadline, NovaInsight, NovaKeyValues, NovaMetrics } from './blocks';

/* WHAT NOVA CONCLUDES — the strongest thing in the turn, and the only thing that has to be
 * readable in two seconds.
 *
 * ── THE INVERSION THIS FIXES ─────────────────────────────────────────────────────────────────
 * `title` and `text` were rendered title-first-and-bold, muted-sentence-above. For a draft that
 * put the word "New incident" in the answer's strongest slot and the actual sentence — "I can
 * log this as a new incident, here is the draft" — above it in grey. The label outranked the
 * answer.
 *
 * They are different things depending on the FORM, so the form decides:
 *   draft   `text` is the answer; `title` captions the object being proposed
 *   text    `title` IS the answer; there is no `text`
 *   report  `title` is the answer; the metric carries the number
 *
 * ── ONE SURFACE, NOT SEVEN ───────────────────────────────────────────────────────────────────
 * Exactly one filled box appears in a response: the info block holding the proposed record or
 * the key status. Everything else — the statement, the evidence, the actions — sits on the
 * drawer's own background. The moment a second box appears they stop reading as levels and
 * start reading as a form.
 */

/** Severity as a badge, so it is scannable without reading. Ink is dark on a pale tint in every
 *  case — a pale-on-pale "subtle" pill is a pill nobody can read. */
const PRIORITY_TONE: Record<string, string> = {
  critical: 'bg-[#FCEDEC] text-[#8C2018]',
  high: 'bg-[#FCEDEC] text-[#8C2018]',
  medium: 'bg-[#FBF2E3] text-[#7A5200]',
  low: 'bg-[#EDF3F9] text-[#2D5478]',
};

export function AnswerBlock({ answer: a }: { answer: AnswerObject }) {
  const draft = a.form === 'draft';
  /* THE ORDER IS THE ARGUMENT.
       headline   the conclusion, biggest thing on screen
       insight    what it MEANS — above the data, never below it
       metrics    the headline numbers
       table      the evidence for them
       kv         the structured facts
       text       the supporting prose, last of the primary layer
     A reader who stops after the first two lines still has the answer. */
  const lead = draft ? undefined : a.text;

  return (
    <section>
      <h4 className="nova-t-label">Your answer</h4>

      {/* LEVEL 1 — the conclusion. When a script authors a headline it leads and `title` drops to
          being the caption of whatever object sits below it. */}
      {a.headline
        ? <NovaHeadline>{a.headline}</NovaHeadline>
        : (!draft && <NovaHeadline>{a.title}</NovaHeadline>)}

      {/* LEVEL 2 — the reading of the data, BEFORE the data. */}
      {a.insight && <NovaInsight>{a.insight}</NovaInsight>}

      {!!a.metrics?.length && <NovaMetrics items={a.metrics} />}
      {a.table && <NovaDataTable table={a.table} />}
      {!!a.kv?.length && <NovaKeyValues items={a.kv} />}

      {/* LEVEL 3 — supporting explanation. Emphasis is inline and selective: ticket ids,
          numbers, dates, statuses. Never a whole sentence. */}
      {/* 8px under the conclusion — supporting text belongs TO the headline, so it sits inside
          the same group rather than being spaced away from it. */}
      {lead && (
        <p className="nova-t-body mt-2 text-[var(--nova-ink-muted)]"><Emph>{lead}</Emph></p>
      )}
      {draft && a.text && <p className="nova-t-body mt-2 text-[var(--nova-ink-muted)]"><Emph>{a.text}</Emph></p>}

      {/* ── the draft ───────────────────────────────────────────────
          The proposed record. THE one filled surface in a response. */}
      {!!a.fields?.length && (
        <div className="mt-4 overflow-hidden rounded-lg border border-[var(--nova-rule)] bg-[var(--nova-surface)]">
          {draft && a.title && (
            <p className="nova-t-label border-b border-[var(--nova-rule)] px-4 py-3">{a.title}</p>
          )}
          <dl className="px-4 py-1">
            {a.fields.map((f, i) => {
              const isPriority = f.label.toLowerCase() === 'priority';
              const isSubject = f.label.toLowerCase() === 'subject';
              return (
                <div
                  key={f.label}
                  className={`flex items-baseline gap-4 py-2 ${
                    i > 0 ? 'border-t border-[var(--nova-rule)]' : ''}`}
                >
                  <dt className="nova-t-label w-[104px] flex-shrink-0">{f.label}</dt>
                  <dd className="min-w-0 flex-1">
                    {isPriority ? (
                      <span className={`inline-flex items-center rounded-full px-2 py-[1px] text-[11px] font-medium ${
                        PRIORITY_TONE[f.value.toLowerCase()] ?? PRIORITY_TONE.low}`}
                      >{f.value}</span>
                    ) : (
                      /* Subject carries slightly more weight than its siblings — it is the one
                         value a reader checks before pressing the primary action. */
                      <span className={`nova-t-body ${isSubject ? 'font-medium' : ''}`}>{f.value}</span>
                    )}
                    {f.inferred && (
                      <span className="nova-t-meta ml-2">· inferred</span>
                    )}
                  </dd>
                </div>
              );
            })}
          </dl>
        </div>
      )}

      {/* ── the report form ───────────────────────────────────────── */}
      {a.form === 'report' && a.metric && (
        <div className="mt-3 rounded-lg border border-[var(--nova-rule)] bg-[var(--nova-surface)] px-3 py-2.5">
          <p className="flex items-baseline gap-1.5">
            <span className="nova-t-label">{a.metric.label}</span>
            <span className={`text-[18px] font-semibold ${
              a.metric.direction === 'up' ? 'text-[#8C2018]' : 'text-[#0F6E4F]'}`}
            >
              {a.metric.direction === 'up' ? '↑' : a.metric.direction === 'down' ? '↓' : ''}
              {a.metric.value}
            </span>
          </p>
          {!!a.chart?.length && (() => {
            const max = Math.max(...a.chart.map((c) => c.value)) || 1;
            return (
              <div
                className="mt-2 flex h-[54px] items-end gap-1.5"
                role="img"
                aria-label={a.chart.map((c) => `${c.label} ${c.value}`).join(', ')}
              >
                {a.chart.map((c, i) => (
                  <span key={c.label} className="flex flex-1 flex-col items-center gap-1">
                    <span
                      className="nova-bar w-full rounded-sm"
                      style={{
                        height: `${Math.round((c.value / max) * 40)}px`,
                        background: i === a.chart!.length - 1 ? 'var(--nova-primary)' : '#D7E3F2',
                        animationDelay: `${i * 60}ms`,
                      }}
                    />
                    <span className="nova-t-meta text-[9px]">{c.label}</span>
                  </span>
                ))}
              </div>
            );
          })()}
          {a.driver && (
            <p className="nova-t-meta mt-2">
              Primary driver: <b className="font-semibold text-[var(--nova-ink)]">{a.driver}</b>
            </p>
          )}
        </div>
      )}

      {a.aside && <p className="nova-t-meta mt-4">{a.aside}</p>}

      {a.recommendation && (
        <p className="nova-t-body mt-4">
          <span className="nova-t-label mr-2 align-middle">Recommended</span>
          <Emph>{a.recommendation}</Emph>
        </p>
      )}

      {/* Scaffolding, visibly marked. Smaller, muted, behind a label, so nobody reads it as
          something Nova concluded. */}
      {a.devNote && (
        <p className="nova-devnote mt-4 rounded-r px-3 py-2">
          <span className="nova-t-label mr-2 align-middle text-[#8A6D1F]">Dev</span>
          {a.devNote}
        </p>
      )}
    </section>
  );
}
