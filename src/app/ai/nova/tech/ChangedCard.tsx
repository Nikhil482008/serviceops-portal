import { CARD } from '../conversation/cardKit';
import { RefChip, RefText } from '../conversation/TechnicianBlocks';
import { StaleTag } from './StaleTag';
import type { ChangedRow, ChangeResult } from './mutations';

/* WHAT CHANGED — the card on a mutate action's reply.
 *
 * One row per changed field, from the mutation's return value: "Status  In progress → On hold",
 * "SLA clock  paused at 1d 4h", "Reminder  set · tomorrow 10:00". Refs are mono chips; a state
 * change keeps its from → to (this is a record of something that happened, not a proposal, so
 * the arrow is the right grammar here). A bulk action renders one group per ticket. Under it,
 * the one "what happens next" line the script authored — specific, and honest. */

const fillNext = (next: string, fill: Record<string, string> | undefined, fallback?: string): string | null => {
  let missing = false;
  const out = next.replace(/\{\{(\w+)\}\}/g, (m, k) => { if (fill && k in fill) return fill[k]; missing = true; return m; });
  if (!missing) return out;
  return fallback ?? null;
};

function Row({ r, onAsk }: { r: ChangedRow; onAsk: (q: string) => void }) {
  return (
    <div className="nova-row nova-row-changed" data-row-kind="changed" data-changed-row={r.label}>
      <dt className="nova-row-label">{r.label}</dt>
      <dd className="nova-row-val nova-changed-val">
        {r.from !== undefined && (
          <>
            <span className="nova-changed-from"><RefText text={r.from} onAsk={onAsk} /></span>
            <span className="nova-arrow" aria-hidden="true">→</span>
            <span className="sr-only">to</span>
          </>
        )}
        <span className="nova-changed-to"><RefText text={r.to} onAsk={onAsk} /></span>
        {r.detail && <span className="nova-changed-detail">· <RefText text={r.detail} onAsk={onAsk} /></span>}
      </dd>
    </div>
  );
}

export function ChangedCard({ changed, next, nextFallback, onAsk }: {
  changed?: ChangeResult;
  /** The authored "what happens next" line. May read `{{key}}` from the result's `fill`. */
  next: string;
  /** What to say when the next-line's `{{key}}` has no value — the reminder that was not set. */
  nextFallback?: string;
  onAsk: (q: string) => void;
}) {
  if (!changed) {
    return (
      <p className="nova-t-meta" data-changed-empty>
        Nothing was changed — this reply was opened without an action behind it.
      </p>
    );
  }
  const line = fillNext(next, changed.fill, nextFallback);
  const empty = !changed.rows?.length && !changed.groups?.length;
  return (
    <div data-changed>
      <div className={CARD} data-changed-card data-kind={changed.kind}>
        <StaleTag refs={changed.refs} />
        {empty && <p className="nova-t-meta px-4 py-3">No record changed.</p>}
        {changed.groups?.map((g) => (
          <section key={g.ref} className="border-b border-[var(--nova-rule)] last:border-b-0" data-changed-group={g.ref}>
            <p className="nova-card-head flex items-center gap-2"><RefChip id={g.ref} onAsk={onAsk} /></p>
            <dl className="nova-rows">{g.rows.map((r) => <Row key={r.label} r={r} onAsk={onAsk} />)}</dl>
          </section>
        ))}
        {!!changed.rows?.length && (
          <dl className="nova-rows">{changed.rows.map((r) => <Row key={r.label} r={r} onAsk={onAsk} />)}</dl>
        )}
      </div>
      {line && <p className="nova-t-body nova-next-line" data-next-line>{line}</p>}
    </div>
  );
}
