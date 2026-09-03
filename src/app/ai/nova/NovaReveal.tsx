import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { activeIndex, turnCounts, type FeedDiscovery, type FeedStep, type Turn } from './turnModel';
import { prefersReducedMotion } from './novaMotion';
import { NovaContextTabs } from './NovaContextTabs';
import { NovaFailure } from './NovaFailure';

/* MYSTERY → REVEAL.
 *
 * The other views answer "what is it doing". This one answers "what has it found so far" — and
 * deliberately withholds the rest. Chapters are numbered and named, each ends on a FACT rather
 * than a verb, and a finding is teased before it is stated: "Interesting…" and then what was
 * interesting.
 *
 * ── WHY A TEASE IS NOT A GIMMICK ─────────────────────────────────────────────────────────────
 * A spinner asks the reader to wait. A tease asks them a question they now want answered, and the
 * next second is spent wanting rather than waiting — the same duration, a different experience.
 * It only works because the chapters ran first: by chapter three the reader has seen enough to
 * have formed a guess, so "Interesting…" lands on something they were already wondering.
 *
 * It also only stays honest because the tease is AUTHORED PER FINDING, in the script, beside the
 * finding it introduces. A generic "Nova found something!" injected by this component whenever a
 * discovery arrived would be the component manufacturing suspense it has no basis for.
 *
 * ⚠️ Same turn, same events, same reducer as the other three views. No timers here drive order.
 */

const COLLAPSE_DELAY_MS = 300;
const num = (i: number) => String(i + 1).padStart(2, '0');

export function NovaReveal({ turn, onRetry }: { turn: Turn; onRetry?: () => void }) {
  const [open, setOpen] = useState(true);
  const [userToggled, setUserToggled] = useState(false);
  const hasAnswer = !!turn.answer;

  useEffect(() => {
    if (!hasAnswer || userToggled) return;
    const t = window.setTimeout(() => setOpen(false), prefersReducedMotion() ? 0 : COLLAPSE_DELAY_MS);
    return () => clearTimeout(t);
  }, [hasAnswer, userToggled]);

  const live = activeIndex(turn);
  const counts = turnCounts(turn);

  /* Chapters, in the order the plan declared them. Numbering comes from the FULL list so a
     chapter keeps its number as later ones appear — 04 does not become 03 because 02 is done. */
  const chapters = useMemo(() => {
    const by = new Map<string, FeedStep[]>();
    turn.steps.forEach((s) => {
      const c = s.phase ?? 'Looking into it';
      if (!by.has(c)) by.set(c, []);
      by.get(c)!.push(s);
    });
    return [...by.entries()].map(([name, steps], i) => ({
      name, steps, n: num(i),
      /* Shown only once it has begun. Revealing every chapter up front would print the ending on
         the first frame, which is the one thing this view exists not to do. */
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

  if (!open) {
    return (
      <button
        type="button"
        aria-expanded={false}
        onClick={() => { setUserToggled(true); setOpen(true); }}
        className="nova-fold flex items-center gap-2 rounded px-1 py-1 ask-text-sm text-[#9CA3AF] transition-colors hover:bg-[#F5F7FA] hover:text-[#7B8FA5]"
      >
        <span className="text-[#12805C]" aria-hidden="true">✓</span>
        {counts.checks} check{counts.checks === 1 ? '' : 's'}
        {counts.findings > 0 && ` · ${counts.findings} finding${counts.findings === 1 ? '' : 's'}`}
        <ChevronDown size={12} className="-rotate-90" aria-hidden="true" />
      </button>
    );
  }

  return (
    <div>
      <p className="flex items-center gap-1.5 ask-text-base ask-w-500 text-[#7B8FA5]">
        <Search size={13} className="text-[#9CA3AF]" aria-hidden="true" />
        Nova is looking into <span className="text-[#364658]">{turn.topic || 'this'}</span>
        {hasAnswer && (
          <button
            type="button"
            aria-expanded
            onClick={() => { setUserToggled(true); setOpen(false); }}
            className="ml-auto rounded px-1.5 py-0.5 ask-text-sm ask-w-400 text-[#9CA3AF] transition-colors hover:bg-[#F5F7FA] hover:text-[#7B8FA5]"
          >
            Hide
          </button>
        )}
      </p>

      <div className="mt-3 space-y-3.5">
        {chapters.filter((c) => c.started).map((c, ci) => (
          <section key={c.name} className={ci > 0 ? 'nova-feed-in' : undefined}>
            {/* ⚠️ The separator is LITERAL TEXT, not a flex gap between three children. A gap is
                not whitespace: the accessible name of a gapped heading is "01—Understand", which
                is what a screen reader reads out and what any text assertion sees. This is the
                same trap that produced "Dateis withinLast 30 days" elsewhere in this codebase. */}
            <h3 className="ask-text-xs ask-w-600 uppercase tracking-[0.06em] text-[#9CA3AF]">
              <span className="tabular-nums text-[#C6CFDA]">{c.n}</span>
              {' — '}
              {c.name}
            </h3>
            <div className="mt-1 space-y-0.5">
              {c.steps.map((s) => (
                <Row key={s.id} step={s} isLive={turn.steps.indexOf(s) === live} />
              ))}
            </div>
            {c.steps.flatMap((s) => foundAfter.get(s.id) ?? []).map((d) => <Tease key={d.id} d={d} />)}
          </section>
        ))}

        {(foundAfter.get('') ?? []).map((d) => <Tease key={d.id} d={d} />)}

        {/* The reference section: what came out, and what it read. Collapsed by default so it
            never competes with the reveal while the reveal is still happening. */}
        <NovaContextTabs turn={turn} />

        <NovaFailure turn={turn} onRetry={onRetry} />
      </div>
    </div>
  );
}

/** A check. Its VERB while it runs, the FACT it landed on once it is done — a chapter that ends
 *  on "Measuring SLA clocks" has told you nothing; "6 inside two hours of breach" has. */
function Row({ step, isLive }: { step: FeedStep; isLive: boolean }) {
  const complete = step.status === 'complete' && !isLive;
  return (
    <div>
      <p
        {...(isLive ? { role: 'status' as const, 'aria-live': 'off' as const } : {})}
        className={`flex items-baseline gap-2 ask-text-sm ${
          complete ? 'text-[#364658]' : isLive ? 'text-[#7B8FA5]' : 'text-[#C6CFDA]'}`}
      >
        <span aria-hidden="true" className="w-3 flex-shrink-0 ask-text-sm">
          {complete ? <span className="text-[#12805C]">✓</span>
            : isLive ? <span className="nova-pulse inline-block size-[6px] rounded-full bg-[#3D8BD0] align-middle" />
              : '·'}
        </span>
        {complete && step.metric
          ? <span><b className="ask-w-600">{step.metric.value}</b>{' '}
            <span className="text-[#7B8FA5]">{step.metric.label}</span></span>
          : <span className={isLive ? 'nova-shimmer' : ''}>{step.label}</span>}
      </p>
      {/* Sources are NOT listed inline any more — they are in the Context panel's Sources tab.
          Printing them under every row put four lines of provenance between each chapter and the
          next, which is exactly the noise the reveal exists to avoid; a reference belongs in a
          reference section. Nothing was dropped: the same `step.sources` feeds that tab. */}
    </div>
  );
}

/** The finding, introduced by its own authored line. */
function Tease({ d }: { d: FeedDiscovery }) {
  const gap = d.role === 'gap';
  return (
    <div
      className={`nova-disc mt-2.5 border-l-2 pl-3 ${gap ? 'border-[#E8CE8F]' : 'border-[#C9B6F0]'}`}
      aria-live="polite"
    >
      {d.tease && (
        <p className={`ask-text-sm ask-w-500 italic ${gap ? 'text-[#B98900]' : 'text-[#7B5BD6]'}`}>
          {d.tease}
        </p>
      )}
      <p className="mt-0.5 ask-text-base ask-w-600 leading-[1.45] text-[#364658]">{d.headline}</p>
      <p className="mt-0.5 ask-text-sm leading-[1.5] text-[#7B8FA5]">{d.detail}</p>
    </div>
  );
}
