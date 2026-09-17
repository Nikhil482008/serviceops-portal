import { NovaChip, priorityFamily } from './NovaChip';
import type { AnswerObject } from '../novaStream';
import { CardRows } from './CardRow';
import { Emph, NovaDataTable, NovaHeadline, NovaInsight, NovaKeyValues, NovaMetrics } from './blocks';
import { DEFAULT_VIEW, type AnswerView } from './ResponseUtilityBar';

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
 *   text    `title` IS the answer; `text`, where a script writes one, is the line that
 *           supports the headline — an assumption behind its number, or a commitment
 *   report  `title` is the answer; the metric carries the number
 *
 * ── ONE SURFACE, NOT SEVEN ───────────────────────────────────────────────────────────────────
 * Exactly one filled box appears in a response: the info block holding the proposed record or
 * the key status. Everything else — the statement, the evidence, the actions — sits on the
 * drawer's own background. The moment a second box appears they stop reading as levels and
 * start reading as a form.
 */

/* Severity was a private tone table here. It is the palette's chip now, and the family a
   priority wears is decided once, in NovaChip's table, for every card that shows one. */

export function AnswerBlock({ answer: a, view = DEFAULT_VIEW, titleLed = true }: {
  answer: AnswerObject;
  /** False when a block below supplies the turn's conclusion. Without a headline the title is
   *  normally promoted into that slot; a requester status answer writes its own from the record,
   *  and two headlines is one too many. */
  titleLed?: boolean;
  /** The reader's chosen rendering of THIS answer — density (••• "Make it shorter") and
   *  visual (••• "Change visual"). The facts never change; only how much prose surrounds
   *  them and which shape the data takes. */
  view?: AnswerView;
}) {
  const draft = a.form === 'draft';
  /* THE ORDER IS THE ARGUMENT.
       headline   the conclusion, biggest thing on screen
       insight    what it MEANS — above the data, never below it
       metrics    the headline numbers
       table      the evidence for them
       kv         the structured facts
       text       the supporting prose, last of the primary layer
     A reader who stops after the first two lines still has the answer. */
  /* CONCISE keeps every number, conclusion, caveat and citation — the supporting prose and the
     aside are what an executive summary drops. Never a truncation. */
  const concise = view.density === 'concise';
  const lead = draft || concise ? undefined : a.text;

  /* CHANGE VISUAL — derived transforms of the SAME data, so the two shapes cannot disagree.
     A table becomes summary cards (label column + the column its bar reads, or the last one);
     metric cards become a two-column table. */
  let metrics = a.metrics;
  let table = a.table;
  if (view.visual === 'cards' && a.table) {
    const valueCol = a.table.barCol ?? a.table.cols.length - 1;
    metrics = a.table.rows.map((r) => ({ label: r[0], value: r[valueCol] }));
    table = undefined;
  } else if (view.visual === 'table' && a.metrics?.length) {
    table = {
      cols: ['Metric', 'Value', 'Change'],
      rows: a.metrics.map((m) => [m.label, m.value, m.delta ?? '—']),
    };
    metrics = undefined;
  }

  return (
    <section>
      {/* NO "YOUR ANSWER" EYEBROW. It labelled a block that is unmistakably the answer — it is
          the largest thing in the turn and it follows the checks row — and a label directly
          above a headline competes with the one element allowed to be prominent. */}
      {/* LEVEL 1 — the conclusion. When a script authors a headline it leads and `title` drops to
          being the caption of whatever object sits below it. */}
      {a.headline
        ? <NovaHeadline>{a.headline}</NovaHeadline>
        : (!draft && titleLed && <NovaHeadline>{a.title}</NovaHeadline>)}

      {/* LEVEL 2 — the reading of the data, BEFORE the data. */}
      {a.insight && <NovaInsight>{a.insight}</NovaInsight>}

      {!!metrics?.length && <NovaMetrics items={metrics} />}
      {table && <NovaDataTable table={table} />}
      {!!a.kv?.length && <NovaKeyValues items={a.kv} />}

      {/* LEVEL 3 — supporting explanation. Emphasis is inline and selective: ticket ids,
          numbers, dates, statuses. Never a whole sentence. */}
      {/* 8px under the conclusion — supporting text belongs TO the headline, so it sits inside
          the same group rather than being spaced away from it. */}
      {lead && (
        <p className="nova-t-body mt-2 text-[var(--nova-ink-muted)]"><Emph>{lead}</Emph></p>
      )}
      {draft && !concise && a.text && <p className="nova-t-body mt-2 text-[var(--nova-ink-muted)]"><Emph>{a.text}</Emph></p>}

      {/* ── the draft ───────────────────────────────────────────────
          The proposed record. THE one filled surface in a response. */}
      {!!a.fields?.length && (
        <div className="mt-4 overflow-hidden rounded-lg border border-[var(--nova-rule)] bg-[var(--nova-surface)]">
          {draft && a.title && (
            <p className="nova-card-head">{a.title}</p>
          )}
          <CardRows>
            {a.fields.map((f) => {
              const isPriority = f.label.toLowerCase() === 'priority';
              const isSubject = f.label.toLowerCase() === 'subject';
              return (
                <div key={f.label} className="nova-row" data-row-kind="value">
                  <dt className="nova-row-label">{f.label}</dt>
                  <dd className="nova-row-val">
                    {isPriority ? (
                      <NovaChip family={priorityFamily(f.value)}>{f.value}</NovaChip>
                    ) : (
                      /* Subject carries slightly more weight than its siblings — it is the one
                         value a reader checks before pressing the primary action. */
                      <span className={`nova-t-body ${isSubject ? 'ask-w-500' : ''}`}>{f.value}</span>
                    )}
                    {f.inferred && (
                      <span className="nova-t-meta ml-2">· inferred</span>
                    )}
                  </dd>
                </div>
              );
            })}
          </CardRows>
        </div>
      )}

      {/* ── the report form ───────────────────────────────────────── */}
      {a.form === 'report' && a.metric && (
        <div className="mt-3 rounded-lg border border-[var(--nova-rule)] bg-[var(--nova-surface-subtle)] px-3 py-2.5">
          <p className="flex items-baseline gap-1.5">
            <span className="nova-t-label">{a.metric.label}</span>
            <span className={`ask-text-lg ask-w-600 ${
              a.metric.direction === 'up' ? 'text-[var(--nova-error)]' : 'text-[var(--nova-success)]'}`}
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
                        background: i === a.chart!.length - 1 ? 'var(--nova-primary)' : 'var(--nova-g300)',
                        animationDelay: `${i * 60}ms`,
                      }}
                    />
                    <span className="nova-t-meta ask-text-sm">{c.label}</span>
                  </span>
                ))}
              </div>
            );
          })()}
          {a.driver && (
            <p className="nova-t-meta mt-2">
              Primary driver: <b className="ask-w-500 text-[var(--nova-ink)]">{a.driver}</b>
            </p>
          )}
        </div>
      )}

      {a.aside && !concise && <p className="nova-t-meta mt-4">{a.aside}</p>}

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
          <span className="nova-t-label mr-2 align-middle text-[var(--nova-warning)]">Dev</span>
          {a.devNote}
        </p>
      )}
    </section>
  );
}
