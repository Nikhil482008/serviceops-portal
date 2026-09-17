import { useMemo } from 'react';
import { activeIndex, type FeedDiscovery, type FeedStep, type Turn } from '../turnModel';
import { RefText } from './TechnicianBlocks';

/* THE TRAIL — what the thinking row opens onto, and the ONE shape it has in every case.
 *
 *     01 — READ
 *      ✓  14 updates read
 *      ✓  4 on the bridge
 *      ┃ The fix is already in
 *      ┃ Fix applied 11:20, re-run started 11:35, ETA 12:30  INC-1088
 *      ┃ Payments applied the fix; the first file has processed cleanly.
 *
 * ── WHY IT IS ONE FILE ───────────────────────────────────────────────────────────────────────
 * There were two trails. The reveal view drew numbered chapters whose checks resolve from a verb
 * into a FACT, with each finding teased where it landed; the linear view drew a flat list of
 * verbs and then every finding again at the bottom under one heading. The first is better and
 * the difference was never a decision about the reader — it was two components. So this is the
 * trail, and both views hand it the same turn.
 *
 * ── A CHECK ENDS ON A FACT ───────────────────────────────────────────────────────────────────
 * A chapter that ends on "Measuring SLA clocks" has told the reader nothing; "6 inside two hours
 * of breach" has. So a completed check shows `step.metric` — authored beside the check, in the
 * script, never derived here — and falls back to its own label when the script did not claim a
 * figure. A check that read nothing countable stays a verb rather than inventing a number.
 *
 * ── A FINDING SITS WHERE IT LANDED ───────────────────────────────────────────────────────────
 * `afterStepId` is recorded by the reducer at apply time, so a finding is printed at the foot of
 * the CHAPTER whose check produced it — close to the work that turned it up, rather than in a
 * separate column of findings the reader has to re-align by hand. NOT after the individual row:
 * a chapter is the unit a reader takes in, and breaking one open mid-list to insert a three-line
 * card turns a scannable run of checks into a stack of interruptions.
 *
 * Its `tease` is authored per finding, beside the finding — a generic "Nova found something!"
 * written here would be this component manufacturing suspense it has no basis for.
 */

const num = (i: number) => String(i + 1).padStart(2, '0');

export function InvestigationTrail({ turn, dense, onAsk }: {
  turn: Turn;
  /** The technician's register: a reference in a label, a fact or a finding is a chip that opens
   *  that record. Unset, the same id renders as plain words. The CALLER decides — `NovaDrawer`
   *  turns it on for a thread read by a technician, whichever case the thread holds. */
  dense?: boolean;
  onAsk?: (q: string) => void;
}) {
  const live = activeIndex(turn);
  /* ⚠️ `RefText` defaults to chips, so an UNSET `dense` would hand out the technician's register
     to a caller that never asked for it. Opt-in, like every other use of `dense`. */
  const chips = !!dense;

  /* Chapters, in the order the plan declared them. Numbering comes from the FULL list so a
     chapter keeps its number as later ones appear — 04 does not become 03 because 02 is done.
     A script that names no chapters gets one unnamed run of checks rather than a heading it
     never asked for. */
  const chapters = useMemo(() => {
    const by = new Map<string, FeedStep[]>();
    turn.steps.forEach((s) => {
      /* A leadership script names its groups LANES and a technician script names them PHASES —
         the same idea authored under two words, so one chapter list can read either. */
      const c = s.phase ?? s.lane ?? '';
      if (!by.has(c)) by.set(c, []);
      by.get(c)!.push(s);
    });
    return [...by.entries()].map(([name, steps], i) => ({
      name, steps, n: num(i),
      /* Shown only once it has begun. Revealing every chapter up front would print the ending on
         the first frame, which is the one thing the reveal exists not to do. */
      started: steps.some((s) => s.status !== 'pending'),
    }));
  }, [turn.steps]);

  const foundAfter = useMemo(() => {
    const m = new Map<string, FeedDiscovery[]>();
    turn.discoveries.forEach((d) => {
      const k = d.afterStepId ?? '';
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(d);
    });
    return m;
  }, [turn.discoveries]);

  return (
    <div className="space-y-3" data-trail>
      {chapters.filter((c) => c.started).map((c) => (
        <section key={c.name || 'checks'} data-chapter={c.name || undefined}>
          {/* ⚠️ The separator is LITERAL TEXT, not a flex gap between three children. A gap is
              not whitespace: the accessible name of a gapped heading is "01—Understand", which
              is what a screen reader reads out and what any text assertion sees. */}
          {!!c.name && (
            <h4 className="ask-text-xs ask-w-600 uppercase tracking-[0.06em] text-[var(--nova-text-muted)]">
              <span className="tabular-nums text-[var(--nova-text-disabled)]">{c.n}</span>
              {' — '}
              {c.name}
            </h4>
          )}
          <div className={c.name ? 'mt-1 space-y-0.5' : 'space-y-0.5'}>
            {c.steps.map((st) => (
              <TrailRow
                key={st.id}
                step={st}
                isLive={turn.steps.indexOf(st) === live}
                chips={chips}
                onAsk={onAsk}
              />
            ))}
          </div>
          {c.steps.flatMap((st) => foundAfter.get(st.id) ?? []).map((d) => (
            <TrailFinding key={d.id} d={d} chips={chips} onAsk={onAsk} />
          ))}
        </section>
      ))}
      {/* A finding with no completed check behind it — a stream that raised one before anything
          finished. It belongs at the top of the trail, which is where it happened. */}
      {(foundAfter.get('') ?? []).map((d) => <TrailFinding key={d.id} d={d} chips={chips} onAsk={onAsk} />)}
    </div>
  );
}

/** A check. Its VERB while it runs, the FACT it landed on once it is done. `isLive` comes from
 *  the derived index, never the stored status, so the stalled case reuses this untouched. */
function TrailRow({ step, isLive, chips, onAsk }: {
  step: FeedStep; isLive: boolean; chips: boolean; onAsk?: (q: string) => void;
}) {
  const complete = step.status === 'complete' && !isLive;
  return (
    <p
      {...(isLive ? { role: 'status' as const, 'aria-live': 'off' as const } : {})}
      className={`nova-t-step flex items-baseline gap-2 ${
        complete ? 'text-[var(--nova-ink)]'
          : isLive ? 'text-[var(--nova-ink)]' : 'text-[var(--nova-ink-faint)]'}`}
      data-trail-step={step.status}
    >
      <span aria-hidden="true" className="w-3 flex-shrink-0 text-center">
        {complete ? <span className="text-[var(--nova-text-secondary)]">✓</span>
          : isLive ? <span className="nova-pulse inline-block size-[6px] rounded-full bg-[var(--nova-action)] align-middle" />
            : <span className="text-[var(--nova-text-disabled)]">·</span>}
      </span>
      {complete && step.metric
        ? (
          <span>
            <b className="ask-w-600"><RefText text={step.metric.value} onAsk={onAsk} dense={chips} /></b>
            {' '}
            <span className="text-[var(--nova-ink-muted)]">{step.metric.label}</span>
          </span>
        )
        : (
          <span className={isLive ? 'nova-shimmer' : ''}>
            <RefText text={step.label} onAsk={onAsk} dense={chips} />
          </span>
        )}
      {isLive && <span className="sr-only"> — in progress</span>}
    </p>
  );
}

/** The finding, introduced by its own authored line. A GAP keeps the warning colour: "could not
 *  confirm" must never read like a result. */
function TrailFinding({ d, chips, onAsk }: {
  d: FeedDiscovery; chips: boolean; onAsk?: (q: string) => void;
}) {
  const gap = d.role === 'gap';
  return (
    <div
      className={`nova-disc mt-2 border-l-2 pl-3 ${gap ? 'border-[var(--nova-warning-border)]' : 'border-[var(--nova-g400)]'}`}
      data-discovery={d.role}
      data-finding
    >
      {d.tease && (
        <p className={`ask-text-sm ask-w-500 italic ${gap ? 'text-[var(--nova-warning)]' : 'text-[var(--nova-text-secondary)]'}`}>
          {d.tease}
        </p>
      )}
      <p className="mt-0.5 ask-text-base ask-w-600 leading-[1.45] text-[var(--nova-text-primary)]">
        <RefText text={d.headline} onAsk={onAsk} dense={chips} />
      </p>
      {!!d.detail && (
        <p className="mt-0.5 ask-text-sm leading-[1.5] text-[var(--nova-text-secondary)]">
          <RefText text={d.detail} onAsk={onAsk} dense={chips} />
        </p>
      )}
    </div>
  );
}
