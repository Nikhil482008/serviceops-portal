import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { RefText } from './TechnicianBlocks';
import {
  activeIndex, answerVisible, liveScope, pendingAsk, scopeLabel, thoughtFor, turnCounts, wasTyped,
  type FeedDiscovery, type ScopeCount, type Turn,
} from '../turnModel';
import { checkRephrase, rephraseFor, REPHRASE_MS, type Rephrase } from '../novaRephrase';
import { requestCompose, useComposeRequest } from '../dock/composeRequest';

/* WHAT NOVA IS DOING — one sentence in the conversation, not a panel beside it.
 *
 *     Thought for 14s   Preparing the recommendation   ›
 *
 * ── WHAT THIS REPLACES ───────────────────────────────────────────────────────────────────────
 * The live block had three lines and a divider: a strip of bold numbers, the current check with
 * a pulsing dot and a shimmer running through it, and a fold reading "✓ 9 checks · 4 findings" —
 * then a hairline before the answer. Each was defensible on its own. Together they were a
 * MODULE: a region with its own hierarchy, sitting between the reader and the thing they asked
 * for. What a reader needs while waiting is two facts — that Nova is working, and on what — and
 * both fit in one line of ordinary text.
 *
 * ── THE ROW IS A SENTENCE ────────────────────────────────────────────────────────────────────
 * Duration, then activity, then a chevron. The duration is muted and the activity is ink, so the
 * eye lands on the words that change. No tick, no dot, no spinner, no shimmer: the clock ticking
 * and the activity changing ARE the liveness, and the identity row above already carries the one
 * animated thinking mark this drawer has. Hover moves colour, never a ground. Collapsed is the
 * default in every state — the trail is one click away, and the answer is what the reader came
 * for.
 *
 * ── DERIVED, NOT SCHEDULED ───────────────────────────────────────────────────────────────────
 * Nothing here decides what Nova does or when. The activity is the label of whichever step
 * `activeIndex` says is live; the clock reads two stamps the controller writes (`thoughtFor`);
 * the summary after completion is spelled from the scope the checks tallied. The trail behind
 * the chevron is rendered by the VIEW that owns it — chapters, lanes, a checklist — and handed in
 * as a node, so this component does not know which of the four it is sitting in.
 *
 * ── WHAT IS NEVER SHOWN ──────────────────────────────────────────────────────────────────────
 * Every activity is a user-safe TASK from the script — "Checking recent ticket activity" — never
 * reasoning about how a conclusion was reached. Nothing in this file can print anything the
 * script did not choose to say.
 */

/** How long a finding holds the activity slot before the current check's label returns. */
const FLASH_MS = 2400;
/** How often the clock re-reads. The label only changes on a whole second, so this is the
 *  worst-case lag between a boundary and the row noticing it — not a render cadence anyone sees. */
const TICK_MS = 500;

export type ThinkingStatus = 'working' | 'complete' | 'stopped' | 'error';

/** "Thought for 14s". Whole seconds, rounded UP, so the row never claims less time than has
 *  passed and never reads "0s" while a clock is running. Minutes only once there are minutes. */
export const thoughtLabel = (ms: number): string => {
  const s = Math.max(1, Math.ceil(ms / 1000));
  if (s < 60) return `Thought for ${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `Thought for ${m}m${r ? ` ${r}s` : ''}`;
};

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** "5 tickets, 6 data sources and 1 KB article". */
const listOf = (xs: string[]): string =>
  (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

/** "9 checks · 4 findings" — the tally that used to be the default state, now the first line of
 *  the expanded one. */
export function countsLine(t: Turn): string {
  const c = turnCounts(t);
  return plural(c.checks, 'check') + (c.findings ? ` · ${plural(c.findings, 'finding')}` : '');
}

/** What the completed row says. Spelled from what the checks CLAIMED to read — the same tallies
 *  the live strip used to show as bold numbers — else the topic the investigation named, else the
 *  bare count. Never a sentence this component made up about what was concluded. */
export function completedSummary(t: Turn, scope: ScopeCount[] = liveScope(t)): string {
  if (scope.length) {
    return `Reviewed ${listOf(scope.map((m) => `${m.n.toLocaleString()} ${scopeLabel(m.n, m.unit)}`))}`;
  }
  if (t.topic) return `Looked into ${t.topic}`;
  return countsLine(t);
}

/** Does this turn draw a thinking row at all? A bare fallback answer — no checks, no plan — is
 *  the whole message, and a row reading "0 checks" above it would be noise. NovaTurn reads the
 *  same rule to decide whether the identity row yields to the row, so the two cannot disagree. */
export const hasThinkingRow = (t: Turn): boolean => t.steps.length > 0 || !!t.plan;

/** Re-reads the turn's two stamps every TICK_MS while the clock is running. `null` when nothing
 *  was measured — the row leaves the clock out rather than print zero. */
function useThoughtMs(turn: Turn): number | null {
  const ticking = turn.thinkingSince !== undefined;
  const [, bump] = useState(0);
  useEffect(() => {
    if (!ticking) return;
    const id = window.setInterval(() => bump((n) => n + 1), TICK_MS);
    return () => clearInterval(id);
  }, [ticking]);
  return thoughtFor(turn);
}

/** THE ROW, presentational. Everything it shows arrives as a prop, so any surface can draw the
 *  same line the conversation does — it takes a duration and a phrase, never a turn. */
/** WHAT WAS WRITTEN, AND WHAT WAS READ — the first thing in an expanded trail, above the
 *  checks, because it is the first thing that happened. Both in quotes and in the same ink: they
 *  are two versions of one sentence, and giving the reading more weight than the sentence would
 *  be the assistant promoting its own paraphrase over what a person actually said. */
function ReadingBlock({ question, r }: { question: string; r: Rephrase }) {
  return (
    <div className="nova-read" data-reading data-mode={r.mode}>
      <p className="nova-read-k">You wrote</p>
      <p className="nova-read-q">“{question}”</p>
      <p className="nova-read-k nova-read-k2">Nova read it as</p>
      <p className="nova-read-q">“{r.text}”</p>
      {/* SCAFFOLDING, SAID SO. A generated restatement that looked authored would be the
          prototype teaching someone to trust a paraphrase nothing produced. */}
      {r.mode === 'placeholder' && (
        <p className="nova-read-dev" data-reading-dev>
          Generated placeholder — only the seven requester cases have an authored restatement.
        </p>
      )}
      {/* THE CORRECTION, where the mistake is visible. Quiet, because most of the time the
          reading is right and a loud "wrong?" beside every answer would be the assistant asking
          to be doubted. */}
      <button
        type="button"
        className="nova-read-fix"
        data-reading-fix
        aria-label="Not what I meant? Put my message back in the box"
        onClick={() => requestCompose(question)}
      >Not what I meant?</button>
    </div>
  );
}

export function ThinkingRow({ status, duration, activity, activityKey, discovery, readingLine, meta, announce, reading, children }: {
  status: ThinkingStatus;
  /** Milliseconds, or null when nothing was measured — the clock is left out, not printed as 0. */
  duration: number | null;
  /** The one line: what Nova is doing now, or what it did. Plain words, never reasoning — and
   *  never a chip: this sits inside a button, so a reference is spelled, not linked. */
  activity: ReactNode;
  /** Changes when the activity is genuinely a NEW activity — that is what replays the swap. A
   *  clock tick or a re-render with the same step must not. */
  activityKey: string;
  /** The activity slot is showing a finding rather than a check, and which kind. */
  discovery?: string;
  /** The activity slot is showing the READING — one line, truncated, in the quieter ink. */
  readingLine?: boolean;
  /** The first line of the expanded state — the tally. */
  meta?: string;
  /** Read aloud, once, when it changes. Findings qualify; the ticks do not. */
  announce?: string;
  /** The reading block, when this turn was typed — the first thing in the expanded trail. */
  reading?: ReactNode;
  /** The trail — rendered by whoever owns it, shown inside the 100px window. */
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  /* A CORRECTION CLOSES THE TRAIL. The reader has stopped reading how the answer was reached and
     started rewriting the question; leaving twenty checks open above the box would be the trail
     insisting on being read while they retype. */
  const compose = useComposeRequest();
  const composeSeen = useRef(compose?.nonce);
  useEffect(() => {
    if (!compose || compose.nonce === composeSeen.current) return;
    composeSeen.current = compose.nonce;
    setOpen(false);
  }, [compose]);
  const win = useRef<HTMLDivElement | null>(null);
  /* Pinned to the tail until the reader scrolls away from it. */
  const pinned = useRef(true);
  const working = status === 'working';

  /* THE WINDOW FOLLOWS THE LIVE CHECK, the way a log follows its tail — while the reader is AT
     the tail. Scrolling up releases it (the listener below), scrolling back to the bottom pins it
     again, and nothing drags them mid-read. Runs every render deliberately: the trail arrives as
     children this component cannot diff, so "did it grow" is answered by measuring. */
  useEffect(() => {
    const w = win.current;
    if (!w || !open || !working || !pinned.current) return;
    w.scrollTop = w.scrollHeight;
  });
  /* Opening always starts at the tail — that is where the live check is. */
  useEffect(() => { if (open) pinned.current = true; }, [open]);
  const onScroll = () => {
    const w = win.current;
    if (w) pinned.current = w.scrollHeight - w.scrollTop - w.clientHeight < 8;
  };

  return (
    <div data-thinking data-state={status}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="nova-think nova-hit"
        data-thinking-row
      >
        {duration !== null && (
          <span className="nova-think-clock" data-thinking-clock>{thoughtLabel(duration)}</span>
        )}
        {/* A REAL SPACE between the parts. Flex gaps are not whitespace: without this the
            button's text — and its accessible name — read "Thought for 2sChecking…". A
            whitespace-only text node is not a flex item, so it costs nothing visually. */}
        {' '}
        {/* Keyed by the activity, not the tick — the swap animation plays when the WORDS change
            and at no other time. A button's descendants are presentational to assistive tech,
            so the only semantics here are the button's own: its name is this sentence. */}
        <span
          key={activityKey}
          className="nova-think-act"
          data-thinking-activity
          {...(discovery ? { 'data-discovery': discovery } : {})}
          {...(readingLine ? { 'data-reading-line': 'true' } : {})}
        >
          {activity}
        </span>
        {' '}
        <ChevronDown
          size={12}
          className="nova-chev flex-shrink-0"
          data-open={open ? 'true' : 'false'}
          aria-hidden="true"
        />
      </button>

      {/* ONE live region, for the moments worth interrupting for — a finding — and never for
          the ticks. Steps change several times a minute; announcing each would make the drawer
          unusable with a screen reader. */}
      <span className="sr-only" aria-live="polite">{announce ?? ''}</span>

      {/* THE EXPANDED STATE: the tally first, then the trail in a fixed window. A hundred pixels
          that scroll cost the answer nothing — twenty checks used to push it off the screen. */}
      {open && (
        <div className="nova-think-body" data-thinking-body>
          {reading}
          {meta && <p className="nova-t-meta" data-thinking-meta>{meta}</p>}
          {children && (
            <div ref={win} onScroll={onScroll} className="nova-trail-window mt-2" data-trail-window>{children}</div>
          )}
        </div>
      )}
    </div>
  );
}

/** THE ROW, from a turn. Reads the turn and nothing else — no state of its own beyond the
 *  fold and the discovery beat, both presentation. */
export function NovaThinkingSummary({ turn, history, metaExtra }: {
  turn: Turn;
  /** The view's own trail. */
  history?: ReactNode;
  /** One more fact for the tally line, when the view has one the counts do not carry — the
   *  command centre's source count. */
  metaExtra?: string;
}) {
  const shown = answerVisible(turn);
  const status: ThinkingStatus = turn.error ? 'error'
    : turn.stopped ? 'stopped'
      : shown ? 'complete' : 'working';
  const working = status === 'working';
  const li = activeIndex(turn);
  const current = li >= 0 ? turn.steps[li] : null;
  const scope = liveScope(turn);
  const counts = turnCounts(turn);
  const duration = useThoughtMs(turn);

  /* THE READING, for the first two seconds. Typed turns only: everything else opens with a
     sentence Nova wrote. `null` the rest of the time, so nothing below has to know about it. */
  const typed = wasTyped(turn);
  const reading = typed ? rephraseFor(turn.question, turn.caseId) : null;
  const [readingUp, setReadingUp] = useState(typed);
  useEffect(() => { if (reading) checkRephrase(turn.question, reading); },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [turn.id, reading?.text]);
  useEffect(() => {
    if (!typed) return;
    /* A FLOOR MEASURED FROM THE TURN, not from this mount: a re-render at 1.9s must not restart
       the two seconds, and a settled turn re-rendering must not replay them at all. */
    const left = REPHRASE_MS - (Date.now() - turn.startedAt);
    if (left <= 0) { setReadingUp(false); return; }
    const t = window.setTimeout(() => setReadingUp(false), left);
    return () => window.clearTimeout(t);
  }, [typed, turn.startedAt]);
  /* Only while the work is still ahead of it. An answer that has already landed owns the line. */
  const showReading = !!reading && readingUp && !answerVisible(turn) && !turn.stopped && !turn.error;

  /* A finding, for a moment, in the activity slot — a small discovery beat, not a notification.
     Only discoveries that arrive AFTER mount: a settled turn re-rendering must not replay them.
     The ref starts at the mounted count for exactly that reason. */
  const [flash, setFlash] = useState<FeedDiscovery | null>(null);
  const seen = useRef(turn.discoveries.length);
  useEffect(() => {
    if (turn.discoveries.length <= seen.current) return;
    seen.current = turn.discoveries.length;
    if (turn.answer) return;                    // the answer beat owns the screen from here
    setFlash(turn.discoveries[turn.discoveries.length - 1]);
    const t = window.setTimeout(() => setFlash(null), FLASH_MS);
    return () => clearTimeout(t);
  }, [turn.discoveries.length, turn.answer, turn.discoveries]);

  /* Nothing to say about a turn that never investigated — see hasThinkingRow. */
  if (!working && !hasThinkingRow(turn)) return null;

  const activity = showReading ? reading.line
    : !working
    ? (status === 'stopped' ? 'Stopped'
      : status === 'error' ? 'Could not finish'
        : completedSummary(turn, scope))
    : flash ? flash.headline
      : current ? current.label
        /* PARKED ON THE READER. Nothing is running, and the row says so rather than leaving a
           check's label standing as though it were. */
        : pendingAsk(turn) ? 'Waiting for your answer'
          /* PLANNING IS OVER — the plan card below is what is alive now. */
          : turn.plan ? 'Planning complete'
            : 'Getting started';

  /* Keyed so the crossfade plays exactly once, when the reading hands the line over. */
  const activityKey = showReading ? 'reading'
    : working && flash ? `d:${flash.id}`
      : working && current ? `s:${current.id}`
        : activity;

  /* The tally line. While the work runs it also carries the scope the checks have earned so far
     — the numbers the live strip used to show — because that is where a reader who opened the
     trail mid-run expects to find them. Once complete, the summary line has already spelled them. */
  const meta = working
    ? [
      `${plural(counts.checks, 'check')} done`,
      ...(counts.findings ? [plural(counts.findings, 'finding')] : []),
      ...scope.map((m) => `${m.n.toLocaleString()} ${scopeLabel(m.n, m.unit)}`),
      ...(metaExtra ? [metaExtra] : []),
    ].join(' · ')
    : [countsLine(turn), ...(metaExtra ? [metaExtra] : [])].join(' · ');

  return (
    <ThinkingRow
      status={status}
      duration={duration}
      /* The plain reading of a reference — "INC-1088", not "[INC-1088]" and not a chip. */
      activity={<RefText text={activity} dense={false} />}
      activityKey={activityKey}
      discovery={working && flash ? flash.role : undefined}
      readingLine={showReading}
      meta={meta}
      /* THE READING IS ANNOUNCED, the ticks are not. It is the one thing on this row a listener
         has to hear in time to correct — the step labels change several times a minute and
         announcing each would make the drawer unusable. */
      announce={showReading ? reading.line : working && flash ? flash.headline : undefined}
      reading={reading ? <ReadingBlock question={turn.question} r={reading} /> : undefined}
    >
      {history}
    </ThinkingRow>
  );
}
