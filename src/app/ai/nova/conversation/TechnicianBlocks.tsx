import { NovaChip, priorityFamily, statusFamily } from './NovaChip';
import {
  createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, ChevronRight, Clock, Copy, Pencil, X } from 'lucide-react';
import type { DiffRow } from '../scripts/registry';
import {
  addToShiftLog, CHASE_OVERDUE_DAYS, changesSinceHandover, currentUser, DEMO_NOW, durationLabel, getDraft, getKb, getTicket,
  listClosedToday, listOpenAt, listQueue, listSimilar, listVendorPending, minutesOf, OVERNIGHT, postToChannel,
  SLA_WINDOW_MIN, triageOrder, updateDraft, useTicketStore, VENDOR_BOARD, type MockTicket,
} from '../mockTickets';
import { REGULATORY } from '../mockAnalytics';
import { prefersReducedMotion } from '../novaMotion';
import { CARD, ConfirmBanner, GHOST_SM, PRIMARY_SM, QUIET, useTurnInputs } from './cardKit';
import { composeDraftText } from './blockText';
import { incidentBrief } from './incidentBrief';
import { openMatches, patternMatch, raisedAgo, stripAt, stripRange } from './patternMatch';
import {
  byUrgency, daysSinceChase, daysWaiting, DRILL_FLAT_MAX, hasRef, isOverdue, vendorBrief,
  type Token as VendorToken,
} from './vendorWait';
import { CardRow, CardRows, DiffRowCells } from './CardRow';
import { useTechTurn } from '../tech/TechTurnCtx';
import { setSelection } from '../tech/techStore';
import { escClears, SelectionPill, SelectRow, useSelection } from '../tech/selection';
import { impactLine, railLevel, shiftBrief, slaMin, type Token as BriefToken } from './shiftBrief';
import { StaleTag } from '../tech/StaleTag';
import { chaseNote, kbResolutionNote, patternNote } from '../tech/mutations';

/* THE TECHNICIAN PRIMITIVES — evidence-first, precise, and NO BUTTONS.
 *
 * ── ACTION AS TURN ──────────────────────────────────────────────────────────────────────────
 * What the reader can do with a card is attached under the TURN (tech/AttachedActions.tsx),
 * derived per turn by tech/techActions.ts. A card here collects INPUTS — the hold as edited, the
 * quote as it stands, the refs as typed — and registers them with `useTurnInputs`; the attached
 * action carries them to the reply's stream, which performs the mutation and reports what
 * changed. Rows in a list are TARGETS: click opens the record (a navigate action), a checkbox
 * selects it, and the attached action relabels to the selection.
 *
 * ── IMMUTABLE ───────────────────────────────────────────────────────────────────────────────
 * A card's store data is SNAPSHOT when it mounts (`useFrozen`). A later mutation never rewrites
 * a card that already rendered; the card gains a "Changed below ↓" marker (tech/StaleTag.tsx)
 * that points at the What-changed turn instead. Outside a technician action turn — TEC-07, the
 * legacy presentations — the same components read the store live, exactly as before.
 *
 * ── THE ONLY BUTTONS A CARD MAY RENDER ──────────────────────────────────────────────────────
 * `assertTechnicianButtons` runs after every render of a technician turn's blocks in dev and
 * THROWS on any other <button>. The allow-list is the `data-in-element` values it accepts:
 *   row          a list row that OPENS its record
 *   copy         the copy icon on "Say this"
 *   editor       EditableValue's set editor "Done"
 *   disclosure   a fold inside the card (the jargon list, the KB article's title)
 *   revert       JargonCheck's "Revert"
 *   filter       the stat chips, which filter the list beneath them
 *   sort         a table's column sort
 *   chart        the chart frame's own toolbar and menus
 *   clear        the selection pill's "Clear"
 *   stale        the "Changed below ↓" marker
 * plus a role of radio, checkbox or tab (ToneToggle, the platform tabs). Everything else is a
 * forward action, and forward actions are the turn's.
 *
 * ── REGISTER ────────────────────────────────────────────────────────────────────────────────
 * Refs, timestamps, counts, no softening. Every ticket / KB ref on screen is a `RefChip` — a
 * mono chip that asks Nova to open that record, through askNova like any other question.
 * Confidence is stated in WORDS, never as a percentage.
 */

/* ══ THE GUARD ═════════════════════════════════════════════════════════════════════════════ */
const DEV: boolean = (() => {
  try { return !!(import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV; } catch { return false; }
})();

export const IN_ELEMENT_ALLOW = ['row', 'copy', 'editor', 'disclosure', 'revert', 'filter', 'sort', 'chart', 'clear', 'stale'] as const;

export function assertTechnicianButtons(root: HTMLElement | null): void {
  if (!root) return;
  const stray = [...root.querySelectorAll('button')].filter((b) => {
    const role = b.getAttribute('role') ?? '';
    if (['tab', 'radio', 'checkbox'].includes(role)) return false;
    const mark = b.closest('[data-in-element]')?.getAttribute('data-in-element') ?? '';
    return !(IN_ELEMENT_ALLOW as readonly string[]).includes(mark);
  });
  if (stray.length) {
    throw new Error(`A technician card rendered a <button> ("${(stray[0].textContent ?? '').trim().slice(0, 40)}") — forward actions are attached under the turn`);
  }
}

/** The action rule the handover document still keeps: an empty action list is an authoring bug. */
export function assertActions(card: string, actions: readonly unknown[] | undefined): void {
  if (Array.isArray(actions) && actions.length > 0) return;
  const msg = `[Nova] ${card} rendered with no actions — every card carries at least one (Part 2, the action rule).`;
  console.error(msg);
  if (DEV) throw new Error(msg);
}

/** An affordance with nothing behind it is an AUTHORING bug, reported to the author (loudly, in
 *  dev) rather than to the reader as "Not in this demo". */
export function assertRunnable(what: string, runnable: boolean): void {
  if (runnable) return;
  const msg = `[Nova] "${what}" has nothing behind it — give it a behaviour or do not author it.`;
  console.error(msg);
  if (DEV) throw new Error(msg);
}

export interface TechApi {
  onAsk: (q: string, context?: Record<string, unknown>) => void;
  variants: Record<string, unknown>;
}
export const TechCtx = createContext<TechApi>({ onAsk: () => {}, variants: {} });
export const useTech = (): TechApi => useContext(TechCtx);

/** OPEN A RECORD — the navigate action a row click is. The reader's turn shows the label with the
 *  open icon, and the reply is the record's status card. */
export const openRef = (onAsk: TechApi['onAsk'], ref: string): void =>
  onAsk(refQuestion(ref), { action: { icon: 'open', kind: 'navigate' } });

/** SNAPSHOT ON MOUNT inside a technician action turn; live everywhere else. */
export function useFrozen<T>(read: () => T): T {
  const tech = useTechTurn();
  const store = useTicketStore();
  const [snap] = useState(read);
  void store;
  return tech ? snap : read();
}

/* ══ THE HANDOVER'S ACTION BAR (TEC-07 — untouched) ════════════════════════════════════════ */
export type ActionKind = 'primary' | 'secondary' | 'quiet';
export interface BannerOut { text: string; actions?: Array<{ label: string; ask?: string }>; ref?: string }
export interface CardAction {
  label: string;
  kind: ActionKind;
  /** Runs once (after the confirm step when required). Return a banner to show in place. */
  onRun: () => BannerOut | void;
  /** preview → confirm → ConfirmBanner, handled by CardActionBar. */
  requiresConfirm?: boolean;
  /** The line the confirm step shows — WHAT will change. Defaults to the label. */
  preview?: string;
  disabled?: boolean;
  /** Why it is disabled — shown as the tooltip. */
  title?: string;
}
/** A non-empty list. `actions={[]}` does not type-check. */
export type Actions = readonly [CardAction, ...CardAction[]];

const KIND_CLS: Record<ActionKind, string> = { primary: PRIMARY_SM, secondary: GHOST_SM, quiet: QUIET };

/** The one place approval lives for the handover document. */
export function CardActionBar({ card, actions, onDone, dense, keep }: {
  card: string; actions: Actions; onDone?: () => void; dense?: boolean;
  /** A document's actions stay available after one of them lands (post, THEN save) — the
   *  banner renders above the bar instead of replacing it. */
  keep?: boolean;
}) {
  assertActions(card, actions);
  const { onAsk } = useTech();
  const [confirming, setConfirming] = useState<CardAction | null>(null);
  const [banner, setBanner] = useState<BannerOut | null>(null);
  if (banner && !keep) {
    return <ConfirmBanner spec={{ text: banner.text, actions: banner.actions }} mutatedRef={banner.ref ?? ''} onAsk={onAsk} />;
  }
  const run = (a: CardAction) => {
    const r = a.onRun();
    setConfirming(null);
    if (r) { setBanner(r); onDone?.(); }
  };
  const kept = banner && keep
    ? <div className="mb-2"><ConfirmBanner spec={{ text: banner.text, actions: banner.actions }} mutatedRef={banner.ref ?? ''} onAsk={onAsk} /></div>
    : null;
  if (confirming) {
    return (
      <div data-confirm-step className="rounded border border-[var(--nova-rule)] bg-white px-3 py-2">
        <p className="nova-t-body">{confirming.preview ?? confirming.label}</p>
        <p className="nova-t-meta mt-0.5">Nova will not act until you confirm.</p>
        <div className="mt-2 flex items-center gap-1.5">
          <button type="button" className={PRIMARY_SM} onClick={() => run(confirming)}>Confirm</button>
          <button type="button" className={GHOST_SM} onClick={() => setConfirming(null)}>Cancel</button>
        </div>
      </div>
    );
  }
  return (
    <div data-card-actions-wrap>
    {kept}
    <div className={`flex flex-wrap items-center ${dense ? 'gap-0.5' : 'gap-1.5'}`} data-card-actions>
      {actions.map((a) => (
        <button
          key={a.label}
          type="button"
          className={KIND_CLS[a.kind]}
          disabled={a.disabled}
          aria-disabled={a.disabled || undefined}
          title={a.disabled ? (a.title ?? 'Not available yet') : a.title}
          data-action={a.label}
          onClick={() => (a.requiresConfirm ? setConfirming(a) : run(a))}
        >{a.label}</button>
      ))}
    </div>
    </div>
  );
}

/* ══ REFS ═══════════════════════════════════════════════════════════════════════════════════ */
/** A ticket / KB / problem / change reference, optionally written `[INC-0611]` by a script. The
 *  brackets are authoring convention and never render; `[[citation]]` tokens are left alone. */
export const REF_RE = /(?<![[\w-])\[?((?:INC|REQ|PRB|CHG|KB)-\d{3,5})\]?(?![\]\w-])/g;
export const refQuestion = (id: string): string => `Open ${id}`;

export function RefChip({ id, onAsk }: { id: string; onAsk?: (q: string) => void }) {
  if (!onAsk) return <span className="nova-ref" data-ref={id}>{id}</span>;
  return (
    <button
      type="button"
      className="nova-ref nova-ref-btn"
      data-ref={id}
      data-in-element="row"
      onClick={(e) => { e.stopPropagation(); onAsk(refQuestion(id)); }}
    >{id}</button>
  );
}

/** Text with every ref rendered as a chip (dense) or as plain text (not dense). */
export function RefText({ text, onAsk, dense = true }: { text: string; onAsk?: (q: string) => void; dense?: boolean }) {
  const parts: ReactNode[] = [];
  let last = 0; let i = 0;
  for (const m of text.matchAll(REF_RE)) {
    const start = m.index ?? 0;
    if (start > last) parts.push(<span key={i++}>{text.slice(last, start)}</span>);
    parts.push(dense ? <RefChip key={i++} id={m[1]} onAsk={onAsk} /> : <span key={i++}>{m[1]}</span>);
    last = start + m[0].length;
  }
  if (last < text.length) parts.push(<span key={i++}>{text.slice(last)}</span>);
  return <>{parts}</>;
}

/* ══ SMALL SHARED PIECES ════════════════════════════════════════════════════════════════════ */
const Label = ({ children }: { children: ReactNode }) => <p className="nova-t-label">{children}</p>;

/** A priority, as the palette's chip. The family is NovaChip's decision, so this and the draft
 *  card's priority row can never disagree about what a P2 looks like. `data-p` is kept: the
 *  suites and the queue's own styling find a priority by it. */
export function PriorityPill({ p }: { p?: string }) {
  if (!p) return null;
  return <span data-p={p} className="contents"><NovaChip family={priorityFamily(p)} size="sm">{p}</NovaChip></span>;
}

/** A status, as the palette's chip. */
export function StatusPill({ s }: { s: string }) {
  return <span data-status={s} className="contents"><NovaChip family={statusFamily(s)} size="sm">{s}</NovaChip></span>;
}

/* ── SlaCountdown ───────────────────────────────────────────────────────── */
export function slaLevel(remainingMin: number | undefined, windowMin: number, paused?: boolean): 'ok' | 'warn' | 'risk' | 'paused' | 'none' {
  if (remainingMin === undefined) return 'none';
  if (paused) return 'paused';
  const pct = (remainingMin / windowMin) * 100;
  return pct <= 10 ? 'risk' : pct <= 25 ? 'warn' : 'ok';
}
export function SlaCountdown({ remainingMin, windowMin, paused, compact, label }: {
  remainingMin?: number; windowMin: number; paused?: boolean; compact?: boolean; label?: string;
}) {
  const level = slaLevel(remainingMin, windowMin, paused);
  const pct = remainingMin === undefined ? 0 : Math.max(2, Math.min(100, (remainingMin / windowMin) * 100));
  const text = remainingMin === undefined ? 'no clock'
    : paused ? `paused · ${durationLabel(remainingMin)} preserved`
      : `${durationLabel(remainingMin)} left`;
  return (
    <span className={`nova-sla ${compact ? 'nova-sla-compact' : ''}`} data-sla data-level={level} title={label ? `${label}: ${text}` : text}>
      <span className="nova-sla-track" aria-hidden="true"><span className="nova-sla-bar" style={{ width: `${pct}%` }} /></span>
      <span className="nova-sla-text tabular-nums">{text}</span>
    </span>
  );
}

/* ══ STAT CHIPS — the technician set, each chip a FILTER ═══════════════════════════════════ */
export type ChipSet = 'tec01' | 'tec06' | 'tec07';
export interface ChipSpec { key: string; n: number; label: string; warn?: boolean }
const running = (t: MockTicket) => t.slaRemainingMin !== undefined && !t.slaPaused;

export function chipsFor(set: ChipSet): ChipSpec[] {
  if (set === 'tec01') {
    const q = listQueue();
    return [
      { key: 'all', n: q.length, label: 'assigned' },
      { key: 'breaching', n: q.filter((t) => running(t) && t.slaRemainingMin! < 180).length, label: 'breaching < 3h', warn: true },
      { key: 'awaiting', n: q.filter((t) => t.awaitingYou).length, label: 'waiting on you' },
      { key: 'escalated', n: q.filter((t) => !!t.escalatedAt).length, label: 'escalated overnight' },
    ];
  }
  if (set === 'tec06') {
    const p = listVendorPending();
    const vendors = (VENDOR_BOARD as readonly string[]).filter((v) => p.some((t) => t.vendor === v));
    return [
      ...vendors.map((v) => ({ key: v, n: p.filter((t) => t.vendor === v).length, label: v })),
      { key: 'overdue', n: p.filter((t) => (t.chaseAgeDays ?? 99) >= CHASE_OVERDUE_DAYS).length, label: `not chased > ${CHASE_OVERDUE_DAYS}d`, warn: true },
    ];
  }
  const doc = buildHandover({});
  const n = (id: string) => doc.find((s) => s.id === id)?.lines.length ?? 0;
  return [
    { key: 'burning', n: n('burning'), label: 'burning', warn: true },
    { key: 'blocked', n: listVendorPending().length, label: 'blocked' },
    { key: 'regulator', n: n('regulator'), label: 'regulatory' },
    { key: 'decision', n: n('decision'), label: n('decision') === 1 ? 'needs decision' : 'need decisions', warn: true },
  ];
}

export function TechStatChips({ set, active, onPick }: { set: ChipSet; active: string | null; onPick: (key: string | null) => void }) {
  /* Frozen inside an action turn: the counts are what was true when the answer landed. */
  const chips = useFrozen(() => chipsFor(set));
  return (
    <p className="flex flex-wrap gap-1.5" data-stat-chips data-set={set} role="group" aria-label="Filters">
      {chips.map((c) => {
        const on = active === c.key;
        return (
          <button
            key={c.key}
            type="button"
            aria-pressed={on}
            data-chip={c.key}
            data-in-element="filter"
            onClick={() => onPick(on ? null : c.key)}
            className={`nova-btn nova-hit nova-statchip ${c.warn ? 'nova-statchip-warn' : ''}`}
          ><b className="ask-w-600">{c.n}</b> {c.label}</button>
        );
      })}
    </p>
  );
}

/* ══ QUEUE LIST ═════════════════════════════════════════════════════════════════════════════ */
/** TEC-01's ranked queue. Rows are targets: click opens, the checkbox selects; the attached
 *  Start action reads the selection. Re-ranking re-sorts in place with a ~200ms FLIP move;
 *  none under reduced motion. The rows are a SNAPSHOT of the queue at the time of the answer. */
/* == TRIAGE CARDS =============================================================================
 *
 * ONE CARD, FOUR THINGS: which ticket, how urgent, what it is, who it hits. The impact line is
 * COMPOSED from the record's scope/count/department - nobody writes a sentence next to a ticket,
 * so a ticket whose count changes changes its own card.
 *
 * Two modes, one card. In the technician's OWN queue the right-hand slot is the SLA clock and a
 * rail colours the edge by how close it is. For a ticket that is merely a match - TEC-03's open
 * lookalikes - there is no clock of the reader's to run out, so the slot carries the age and
 * there is no rail. Same four things either way. */

export function TriageCard({ ticket: t, mode = 'queue' }: {
  ticket: MockTicket;
  /** `queue` = your own work, with a clock and an urgency rail. `match` = somebody else's
   *  open ticket that looks like this one. `resolved` = a case already closed, where the
   *  resolution IS the interesting line. `vendor` = a ticket somebody ELSE is sitting on, where
   *  the question is who and for how long. */
  mode?: 'queue' | 'match' | 'resolved' | 'vendor';
}) {
  const { sel, live, toggle, clear } = useSelection();
  const { onAsk } = useContext(TechCtx);
  const picked = sel.includes(t.ref);
  /* The rail answers a different question per mode, so it reads a different number. On a vendor
     ticket nothing is breaching — what is wrong is how long somebody else has had it. */
  const level = mode === 'queue' ? railLevel(t)
    : mode === 'vendor' ? (daysWaiting(t) > 5 ? 'breach' : daysWaiting(t) > 3 ? 'soon' : 'none')
      : 'none';
  return (
    <li className="nova-triage-wrap" data-triage-wrap={t.ref} onKeyDown={escClears(clear, sel.length > 0)}>
      <button
        type="button"
        className="nova-triage"
        data-in-element="row"
        data-triage-card={t.ref}
        data-level={level}
        data-selected={picked ? 'true' : undefined}
        disabled={!live}
        onClick={() => onAsk?.(openRef(t.ref))}
      >
        <span className="nova-triage-top">
          <span className="nova-ref" data-ref={t.ref}>{t.ref}</span>
          {/* THE VENDOR REPLACES THE PRIORITY. On this turn the priority is not what sorts the
              queue or what the reader is deciding about — the vendor is both. */}
          {mode === 'vendor'
            ? <span className="nova-triage-vendor" data-vendor={t.vendor}>{t.vendor}</span>
            : t.priority && <span className="nova-triage-pri" data-pri={t.priority}>{t.priority}</span>}
          <span className="nova-triage-clock" data-level={level}>
            {mode === 'queue'
              ? <><Clock size={13} aria-hidden="true" />{durationLabel(slaMin(t))}</>
              /* A MATCH IS NOT IN YOUR QUEUE, so there is no clock of yours on it; its age is
                 the thing that says which one to link first. `resolved` cases show when they
                 were closed, because that is the only date that matters about them. */
              : mode === 'resolved' ? (t.resolvedAgo ? `Resolved ${t.resolvedAgo}` : '')
                : mode === 'vendor'
                  ? <><Clock size={13} aria-hidden="true" /><span className="nova-num">{daysWaiting(t)}</span> days</>
                  : raisedAgo(t)}
          </span>
        </span>
        {/* NEVER TRUNCATED - the title is the only thing that says what the ticket is. */}
        <span className="nova-triage-title">{t.title}</span>
        {/* A RESOLVED CASE'S IMPACT IS ITS RESOLUTION — what was done, which is what a
            reader scanning four old cases is actually looking for. */}
        <span className="nova-triage-impact">
          {mode === 'resolved' ? (t.resolution ?? '') : mode === 'vendor' ? <VendorState t={t} /> : impactLine(t)}
        </span>
      </button>
      {/* A SIBLING, not a child: a button inside a button is not a thing. It sits over the
          card's bottom-right corner and appears on hover or focus. */}
      <span
        role="checkbox"
        aria-checked={picked}
        aria-label={`Select ${t.ref}`}
        tabIndex={live ? 0 : -1}
        className="nova-triage-pick"
        data-in-element="row"
        data-pick={t.ref}
        onClick={(e) => { e.stopPropagation(); toggle(t.ref); }}
        onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggle(t.ref); } }}
      >
        {picked && <Check size={11} aria-hidden="true" />}
      </span>
    </li>
  );
}

export function TriageCardList({ tickets, mode = 'queue' }: {
  tickets: MockTicket[]; mode?: 'queue' | 'match' | 'resolved';
}) {
  const { sel, clear } = useSelection();
  if (!tickets.length) return null;
  return (
    <div onKeyDown={escClears(clear, sel.length > 0)}>
      {/* WHAT IS SELECTED, said once above the list - the same count pill the selectable rows
          carry, because the action beneath reads the same selection. */}
      {sel.length > 0 && (
        <p className="nova-list-head"><SelectionPill n={sel.length} onClear={clear} /></p>
      )}
      <ul className="nova-triage-list" data-triage-list>
        {/* A LATER TURN CHANGED ONE OF THESE. The cards do not update - this turn is what it
            was - so the list says where the newer truth is. */}
        <StaleTag refs={tickets.map((t) => t.ref)} />
        {tickets.map((t) => <TriageCard key={t.ref} ticket={t} mode={mode} />)}
      </ul>
    </div>
  );
}

/** A line whose refs are chips. The prose is composed elsewhere; this only draws it. */
export function ProseLine({ label, parts }: { label: string; parts: BriefToken[] }) {
  const { onAsk } = useContext(TechCtx);
  return (
    <p className="nova-t-body" data-prose-line={label}>
      <span className="nova-prose-lead">{label}</span> —{' '}
      {parts.map((p, i) => (p.t === 'ref'
        ? <RefChip key={`${p.v}-${i}`} id={p.v} onAsk={onAsk} />
        : <span key={`t-${i}`}>{p.v}</span>))}
    </p>
  );
}

/** AUTHORED prose lines, where a [REF] in the text becomes a chip. The composed lines (TEC-01's)
 *  arrive as tokens already; these arrive as sentences a script wrote, and the marker is how a
 *  script names a record without knowing what a chip is. */
export function ProseLines({ lines, onAsk }: {
  lines: Array<{ label: string; text: string }>;
  onAsk?: (q: string) => void;
}) {
  return (
    <div className="nova-prose-lines">
      {lines.map((l) => (
        <p key={l.label} className="nova-t-body" data-prose-line={l.label}>
          <span className="nova-prose-lead">{l.label}</span> —{' '}
          {l.text.split(/(\[(?:INC|REQ|PRB|CHG|KB)-\d+\])/).map((bit, i) => (/^\[/.test(bit)
            ? <RefChip key={i} id={bit.slice(1, -1)} onAsk={onAsk} />
            : <span key={i}>{bit}</span>))}
        </p>
      ))}
    </div>
  );
}

/* TEC-01 - the start of a shift. Headline, three sentences that justify an ordering, the first
   three tickets, and one footnote where a fact came from the ticket rather than from the source
   that would settle it. */
export function ShiftBrief({ lead, rest }: { lead?: boolean; rest?: boolean }) {
  useTicketStore();
  const b = useFrozen(() => shiftBrief());
  if (rest) return <TriageCardList tickets={b.rest} />;
  return (
    <div data-shift-brief>
      {lead && <p className="nova-headline" tabIndex={-1}>{b.headline}</p>}
      <div className="nova-prose-lines">
        {b.lines.map((l) => <ProseLine key={l.label} label={l.label} parts={l.parts} />)}
      </div>
      <p className="nova-list-label">First three</p>
      <TriageCardList tickets={b.top} />
      {b.caveat && (
        /* A FOOTNOTE, not a banner. The fact is on the ticket; what is missing is the feed that
           would confirm it, and that is worth one muted line rather than a yellow block. */
        <p className="nova-t-meta nova-footnote" data-caveat>
          <span className="nova-footnote-tag">Not verified</span>
          {b.caveat.ref}&rsquo;s reporting window closed {b.caveat.at} — from the ticket, not the regulator feed.
        </p>
      )}
    </div>
  );
}

export function QueueList({ top = 3, why, full, rank = 'triage', filter, onAsk }: {
  top?: number; why?: Record<string, string>; full?: boolean;
  rank?: 'triage' | 'sla' | 'priority'; filter?: string | null;
  onAsk: TechApi['onAsk'];
}) {
  const rows = useFrozen(() => listQueue().map((t) => ({ ...t })));
  const { sel, live, toggle, clear } = useSelection();
  const [reordering, setReordering] = useState(false);
  const filtered = rows.filter((t) => (
    filter === 'breaching' ? running(t) && t.slaRemainingMin! < 180
      : filter === 'awaiting' ? !!t.awaitingYou
        : filter === 'escalated' ? !!t.escalatedAt
          : true));
  const all = triageOrder(filtered, rank);
  const shown = full ? all : all.slice(0, top);
  const hidden = all.length - shown.length;

  /* FLIP: remember where each row was, and slide it from there when the order changes. */
  const refs = useRef(new Map<string, HTMLLIElement>());
  const prev = useRef(new Map<string, number>());
  const orderKey = all.map((t) => t.ref).join('|');
  const lastOrder = useRef(orderKey);
  useLayoutEffect(() => {
    const changed = lastOrder.current !== orderKey;
    lastOrder.current = orderKey;
    const reduced = prefersReducedMotion();
    refs.current.forEach((el, ref) => {
      const top0 = prev.current.get(ref);
      const now = el.getBoundingClientRect().top;
      if (changed && !reduced && top0 !== undefined && top0 !== now) {
        el.style.transition = 'none';
        el.style.transform = `translateY(${top0 - now}px)`;
        const raf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : (cb: () => void) => setTimeout(cb, 16);
        raf(() => { el.style.transition = 'transform 200ms var(--ai-ease-move, ease)'; el.style.transform = ''; });
      }
      prev.current.set(ref, now);
    });
    if (changed && !reduced) {
      setReordering(true);
      const t = window.setTimeout(() => setReordering(false), 220);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [orderKey]);

  return (
    <div className={CARD} data-queue-list data-rank={rank} data-reordering={reordering ? 'true' : 'false'} onKeyDown={escClears(clear, sel.length > 0)}>
      <StaleTag refs={rows.map((t) => t.ref)} />
      <div className="nova-list-head">
        <span className="nova-t-label">Your queue · {all.length}</span>
        <SelectionPill n={sel.length} onClear={clear} />
      </div>
      <ol className="px-2 py-1">
        {shown.map((t, i) => {
          const reason = i < top ? why?.[t.ref] : undefined;
          return (
            <SelectRow
              key={t.ref}
              refId={t.ref}
              selected={sel.includes(t.ref)}
              live={live}
              onToggle={() => toggle(t.ref)}
              onOpen={() => openRef(onAsk, t.ref)}
              className={`nova-queue-row ${i > 0 ? 'border-t border-[var(--nova-rule)]' : ''}`}
              rowProps={{
                ref: (el: HTMLLIElement | null) => { if (el) refs.current.set(t.ref, el); else refs.current.delete(t.ref); },
                'data-queue-row': t.ref,
                'data-expanded': i < top || !!full ? 'true' : 'false',
              }}
            >
              {/* THE NAME, on its own line. Only the title can shrink, so anything else sharing
                  this line takes the title's width first — which is how it collapsed to a
                  letter when the status pill joined it. */}
              <span className="flex w-full items-center gap-x-2">
                <span className="w-4 flex-shrink-0 text-right ask-text-sm tabular-nums text-[var(--nova-ink-faint)]" aria-hidden="true">{i + 1}</span>
                <span className="nova-ref flex-shrink-0" data-ref={t.ref}>{t.ref}</span>
                <PriorityPill p={t.priority} />
                <span className="min-w-0 flex-1 truncate nova-t-body text-left text-[var(--nova-ink)]">{t.title}</span>
              </span>
              {/* WHAT IS TRUE OF IT — the state and the clock, beside the reason it is ranked
                  here. Facts about the row, not part of its name. */}
              <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 pl-6 text-left">
                <StatusPill s={t.status} />
                <SlaCountdown remainingMin={t.slaRemainingMin} windowMin={SLA_WINDOW_MIN[t.priority ?? 'P3'] ?? 2880} paused={t.slaPaused} compact />
                {reason && <span className="nova-t-meta" data-why>{reason}</span>}
              </span>
            </SelectRow>
          );
        })}
      </ol>
      {hidden > 0 && (
        <p className="border-t border-[var(--nova-rule)] px-4 py-2 nova-t-meta" data-queue-more>{hidden} more</p>
      )}
    </div>
  );
}

/* ══ SLA BLOCK — a countdown to the client cut-off (TEC-02) ═════════════════════════════════ */
export function SlaBlock({ ticket, label }: { ticket: MockTicket; label: string }) {
  const d = ticket.detail;
  const remaining = d ? minutesOf(d.cutoff) - minutesOf(DEMO_NOW) : ticket.slaRemainingMin;
  const window = d ? minutesOf(d.cutoff) - minutesOf(d.detected) : SLA_WINDOW_MIN[ticket.priority ?? 'P3'];
  return (
    <div className={`${CARD} px-4 py-3`} data-sla-block>
      <StaleTag refs={[ticket.ref]} />
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="nova-t-label">{label}</span>
        <SlaCountdown remainingMin={remaining} windowMin={window} label={label} />
      </div>
    </div>
  );
}

/* ══ BRIEF CARD — a 30-second talk-track ═══════════════════════════════════════════════════ */
export function BriefCard({ refId, to, what, impact, status, sayThis, short, shorter, onAsk }: {
  refId: string; to: string; what: string; impact: string; status: string; sayThis: string;
  short: { status: string; sayThis: string }; shorter?: boolean; onAsk: TechApi['onAsk'];
}) {
  const [copied, setCopied] = useState(false);
  const quote = shorter ? short.sayThis : sayThis;
  /* The attached "Send Sanjay this update" sends THIS line — the one on screen. */
  useTurnInputs('brief', () => ({ ref: refId, to, text: quote }));
  const copyQuote = async () => {
    try { await navigator.clipboard?.writeText(quote); } catch { /* denied */ }
    setCopied(true); window.setTimeout(() => setCopied(false), 1600);
  };
  const rows: Array<[string, string]> = shorter
    ? [['Status', short.status]]
    : [["What's happening", what], ['Impact', impact], ['Status', status]];
  return (
    <div className={CARD} data-brief-card data-shorter={shorter ? 'true' : 'false'}>
      <StaleTag refs={[refId]} />
      <dl className="px-4 py-1">
        {rows.map(([k, v], i) => (
          <div key={k} className={`py-2 ${i > 0 ? 'border-t border-[var(--nova-rule)]' : ''}`}>
            <dt className="nova-t-label">{k}</dt>
            <dd className="nova-t-body mt-0.5 text-[var(--nova-ink)]"><RefText text={v} onAsk={onAsk} /></dd>
          </div>
        ))}
        <div className="border-t border-[var(--nova-rule)] py-2">
          <dt className="nova-t-label">Say this</dt>
          <dd className="mt-1 flex items-start gap-2">
            <blockquote className="nova-say min-w-0 flex-1" data-say-this>“{quote}”</blockquote>
            <button type="button" className={QUIET} aria-label="Copy the talking line" data-copy-say data-in-element="copy" onClick={copyQuote}>
              {copied ? <Check size={12} aria-hidden="true" /> : <Copy size={12} aria-hidden="true" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </dd>
        </div>
      </dl>
    </div>
  );
}

/* ══ INCIDENT TIMELINE ═════════════════════════════════════════════════════════════════════ */
interface TimelineMark { t: string; label: string; future: boolean; now?: boolean; added?: boolean }

export function timelineOf(t: MockTicket): TimelineMark[] {
  const d = t.detail;
  const nowMin = minutesOf(DEMO_NOW);
  const marks: TimelineMark[] = [];
  if (d) {
    marks.push({ t: d.detected, label: 'Detected', future: false });
    marks.push({ t: d.declared, label: 'P1 declared', future: false });
    marks.push({ t: d.fixAt, label: `Fix applied (${d.fixBy})`, future: false });
    marks.push({ t: d.rerunAt, label: 'Re-run started', future: false });
    marks.push({ t: d.eta, label: 'ETA credits', future: true });
    marks.push({ t: d.cutoff, label: 'Client cut-off', future: true });
  }
  (t.events ?? []).forEach((e) => marks.push({ t: e.t, label: e.label, future: minutesOf(e.t) > nowMin, added: true }));
  marks.push({ t: DEMO_NOW, label: 'Now', future: false, now: true });
  return marks.sort((a, b) => minutesOf(a.t) - minutesOf(b.t) || (a.now ? 1 : 0) - (b.now ? 1 : 0));
}

/** "1h 55m" / "25m" — a wait, written. */
const gapLabel = (min: number): string =>
  (min >= 60 ? `${Math.floor(min / 60)}h${min % 60 ? ` ${min % 60}m` : ''}` : `${min}m`);
/** Only a wait worth naming gets its own marker; anything shorter is noise on a rail. */
const GAP_MIN = 45;
/** `Fix applied (Payments)` -> the event, and a quiet trailing note: the parenthesis stops
 *  lengthening the one line that has to fit. */
const splitNote = (s: string): [string, string | null] => {
  const m = /^(.+?) \(([^()]+)\)$/.exec(s);
  return m ? [m[1], m[2]] : [s, null];
};

/** THE WORDS TO SAY OUT LOUD. DraftBlock's sibling - same container, same header, same copy
 *  button - minus the tone control and the footer, because a spoken line has nothing to choose
 *  and nothing to report. No quotation marks: the block IS the quote. */
export function SayThisBlock({ text, label = 'Say this' }: { text: string; label?: string }) {
  return (
    <div className="nova-blk" data-say-this data-copy-target>
      <div className="nova-blk-head">
        <span className="nova-blk-label">{label}</span>
        <span className="nova-blk-tools"><CopyButton text={text} /></span>
      </div>
      <p className="nova-blk-body" data-copy-body data-say-text>{text}</p>
    </div>
  );
}

/** TEC-02 - the thirty-second brief. Headline, three facts off the record, and the sentence. */
export function IncidentBriefBlock({ refId, sayThis, lead }: {
  refId: string; sayThis: string; lead?: boolean;
}) {
  useTicketStore();
  const { onAsk } = useContext(TechCtx);
  const b = useFrozen(() => incidentBrief(refId));
  if (!b) return null;
  return (
    <div data-incident-brief={refId}>
      {lead && <p className="nova-headline" tabIndex={-1}>{b.headline}</p>}
      <div className="nova-prose-lines">
        {b.lines.map((l) => (
          <p key={l.label} className="nova-t-body" data-prose-line={l.label}>
            <span className="nova-prose-lead">{l.label}</span> —{' '}
            {l.parts.map((p, i) => (p.t === 'ref'
              ? <RefChip key={`${p.v}-${i}`} id={p.v} onAsk={onAsk} />
              : <span key={`t-${i}`}>{p.v}</span>))}
          </p>
        ))}
      </div>
      {/* THE SENTENCE the attached action sends, and the one the reader can copy - one string,
          registered so "Send Sanjay this update" posts exactly what is on screen. */}
      <SayThisBlock text={sayThis} />
      <SayThisInputs refId={refId} text={sayThis} />
    </div>
  );
}

/** Registered separately so the block above stays a pure rendering. */
function SayThisInputs({ refId, text }: { refId: string; text: string }) {
  useTurnInputs('brief', () => ({ ref: refId, text, to: 'Sanjay P. (RM liaison)' }));
  return null;
}

/* ── TEC-03 · THE PATTERN MATCH ─────────────────────────────────────────────────────────────
   One question — "ring any bells?" — and the answer is a count, a span, a fix and two lists.
   Every one of those is read from the store by `patternMatch`, so removing a resolved case from
   the seed changes the sentence, the confidence and the drawing together. */

/** WHERE THE TURN LOOKS. The signature is "open, at this site, about this thing"; it is a query
 *  rather than a list of two refs, so a third matching ticket appears without an edit here. */
const SIGNATURE = { kb: 'KB-0342', site: 'Bengaluru', word: /vpn/i };

const usePattern = () => {
  useTicketStore();
  return useFrozen(() => patternMatch(SIGNATURE.kb, openMatches(listOpenAt(SIGNATURE.site, SIGNATURE.word), SIGNATURE.site, SIGNATURE.word)));
};

/** The headline, three sentences and the confidence line. No card, no border: this is the
 *  answer's own prose, and putting a panel round it would make it look like a citation. */
export function PatternBrief({ lead }: { lead?: boolean }) {
  const { onAsk } = useContext(TechCtx);
  const p = usePattern();
  return (
    <div data-pattern-brief={p.empty ? 'none' : 'match'}>
      {lead && <p className="nova-headline" tabIndex={-1}>{p.headline}</p>}
      <ProseLines lines={p.lines} onAsk={onAsk} />
      {/* WORDS, NEVER A PERCENTAGE. "High confidence" is a claim a reader can argue with;
          "87%" is a number nobody can. The count behind it is stated so they can. */}
      <p className="nova-t-meta nova-confidence" data-confidence>{p.confidence}</p>
    </div>
  );
}

/** The open tickets that match, as the same card TEC-01 uses. */
export function MatchCards() {
  const p = usePattern();
  if (!p.open.length) return null;
  return (
    <div data-match-cards>
      <p className="nova-match-label">Open now · same pattern</p>
      <TriageCardList tickets={p.open.slice(0, 3)} mode="match" />
    </div>
  );
}

/** The four resolved cases, when the reader asks for them. */
export function ResolvedCases() {
  const p = usePattern();
  return <TriageCardList tickets={p.cases.map((c) => c.ticket)} mode="resolved" />;
}

/** HOW OFTEN, AND IS IT HAPPENING NOW. One axis, filled dots behind, hollow amber ones at Now.
 *  Positions come from the resolution dates, so the gaps between them are real gaps. */
export function RecurrenceStrip() {
  const p = usePattern();
  if (!p.cases.length) return null;
  const range = stripRange(p.cases);
  const open = p.open.slice(0, 3);
  /* LABELS MAY BE DROPPED, DOTS NEVER. Two dots closer together than a month label is wide would
     print overlapping text; the dot still marks the case, and the month is in the prose above. */
  const MIN_GAP = 0.13;
  let lastLabel = -1;
  const shown = p.cases.map((c, i) => {
    const at = stripAt(c.at, range);
    const room = at - lastLabel >= MIN_GAP || i === 0;
    if (room) lastLabel = at;
    return { c, at, label: room };
  });
  return (
    <figure className="nova-rec" data-recurrence aria-label={p.ariaLabel}>
      <figcaption className="nova-rec-head">
        <span className="nova-rec-title">Recurrence · {p.spanLabel}</span>
        <span className="nova-t-meta">{p.cases.length} resolved · {open.length} open</span>
      </figcaption>
      <div className="nova-rec-strip" aria-hidden="true">
        <span className="nova-rec-axis" />
        {shown.map(({ c, at, label }) => (
          <span key={c.ticket.ref} className="nova-rec-mark" style={{ left: `${(at * 100).toFixed(2)}%` }}>
            <span className="nova-rec-dot" data-kind="resolved" />
            {label && <span className="nova-rec-tick">{c.month}</span>}
          </span>
        ))}
        {/* NOW, offset so several open matches do not stack into one dot. */}
        {open.map((t, i) => (
          <span key={t.ref} className="nova-rec-mark" style={{ left: `${100 - i * 4}%` }}>
            <span className="nova-rec-dot" data-kind="open" />
            {i === 0 && <span className="nova-rec-tick">Now</span>}
          </span>
        ))}
      </div>
      <p className="nova-rec-key nova-t-meta">
        <span className="nova-rec-dot" data-kind="resolved" aria-hidden="true" /> Resolved with {SIGNATURE.kb}
        <span className="nova-rec-sep" aria-hidden="true" />
        <span className="nova-rec-dot" data-kind="open" aria-hidden="true" /> Open, same signature
      </p>
    </figure>
  );
}

/* ── TEC-06 · WAITING ON VENDORS ─────────────────────────────────────────────────────────────
   Nine tickets across three vendors, or sixty-two across twenty-seven — the same turn either way.
   Everything that could grow with the data has a cap, and the overflow is always a count that is
   a link rather than a longer sentence. */

/** Line 3 of a vendor card. AMBER ON THE TWO ABSENCES — no ref, never chased — because those are
 *  the two things that make a ticket invisible at the vendor's end, and they are the two the
 *  urgency score multiplies by. Everything else is plain. */
function VendorState({ t }: { t: MockTicket }) {
  const chased = daysSinceChase(t);
  return (
    <span data-vendor-state={t.ref}>
      {hasRef(t)
        ? <>Ref {t.vendorRef}</>
        : <span className="nova-warn-text" data-no-ref>No vendor ref</span>}
      <span className="nova-mid-dot" aria-hidden="true" />
      {chased === Infinity
        ? <span className="nova-warn-text" data-never-chased>never chased</span>
        : <span data-chased={isOverdue(t) ? 'overdue' : 'ok'}>
          chased {chased === 0 ? 'today' : `${chased} day${chased === 1 ? '' : 's'} ago`}
        </span>}
      <span className="nova-mid-dot" aria-hidden="true" />
      {t.eta ? <>ETA {t.eta}</> : <>no ETA</>}
    </span>
  );
}

const useVendors = () => {
  useTicketStore();
  return useFrozen(() => vendorBrief());
};

/** A composed line whose refs are chips and whose overflow count is a link into the drill turn. */
function VendorLine({ label, parts }: { label: string; parts: VendorToken[] }) {
  const { onAsk } = useContext(TechCtx);
  const b = useVendors();
  const drill = b.rows.length - 3 > DRILL_FLAT_MAX
    ? `Show all ${b.rows.length} by vendor` : `Show the other ${b.rows.length - 3}`;
  return (
    <p className="nova-t-body" data-prose-line={label}>
      <span className="nova-prose-lead">{label}</span> —{' '}
      {parts.map((p, i) => {
        if (p.t === 'ref') return <RefChip key={`${p.v}-${i}`} id={p.v} onAsk={onAsk} />;
        /* THE OVERFLOW IS A DOOR, not a full stop. "and 11 more" opens the same turn the third
           attached action opens, so the reader never has to find it twice. */
        if (p.t === 'more') {
          return (
            <button key={`m-${i}`} type="button" className="nova-more-link" data-in-element="row"
              data-more={p.n} onClick={() => onAsk?.(drill)}>{p.v}</button>
          );
        }
        return <span key={`t-${i}`}>{p.v}</span>;
      })}
    </p>
  );
}

/** The headline and three lines. */
export function VendorBriefBlock({ lead }: { lead?: boolean }) {
  const b = useVendors();
  return (
    <div data-vendor-brief={b.rows.length}>
      {lead && <p className="nova-headline" tabIndex={-1}>{b.headline}</p>}
      <div className="nova-prose-lines">
        {b.lines.map((l) => <VendorLine key={l.label} label={l.label} parts={l.parts} />)}
      </div>
    </div>
  );
}

/** The three most urgent, and the count of everything that needs a chase. */
export function VendorCards() {
  const b = useVendors();
  if (!b.top.length) return null;
  return (
    <div data-vendor-cards>
      <p className="nova-match-label" data-cards-label>{b.cardsLabel}</p>
      <TriageCardList tickets={b.top} mode="vendor" />
      {/* THE LIMIT ON THE ANSWER, under the thing it limits. Chase dates come from notes a person
          typed, so they are as current as that person was. */}
      <p className="nova-t-meta nova-vendor-foot" data-vendor-foot>
        <span className="nova-t-label nova-warn-text">Not verified</span> {b.footnote}
      </p>
    </div>
  );
}

/** WHO IS HOLDING THE QUEUE. Five vendors and an Others — never more, at any scale. A segment is
 *  a filter, which is the only interaction a drawing like this earns. */
export function VendorStrip() {
  const { onAsk } = useContext(TechCtx);
  const b = useVendors();
  if (!b.segments.length) return null;
  const total = b.rows.length;
  const go = (vendor: string, others?: number) => () => onAsk?.(others
    ? (total - 3 > DRILL_FLAT_MAX ? `Show all ${total} by vendor` : `Show the other ${total - 3}`)
    : `What is waiting on ${vendor}?`);
  return (
    <figure className="nova-vs" data-vendor-strip aria-label={b.stripLabel}>
      <figcaption className="nova-vs-head">
        <span className="nova-vs-title">Waiting by vendor</span>
        <span className="nova-t-meta">
          {total} tickets{b.groups.length > 3 ? ` · ${b.groups.length} vendors` : ''}
        </span>
      </figcaption>
      <div className="nova-vs-bar" aria-hidden="true">
        {b.segments.map((sg, i) => (
          <button
            key={sg.vendor}
            type="button"
            className="nova-vs-seg"
            data-in-element="row"
            data-seg={sg.vendor}
            data-tone={sg.others ? 'others' : String(i)}
            style={{ flexGrow: sg.n }}
            title={`${sg.vendor} · ${sg.n}`}
            onClick={go(sg.vendor, sg.others)}
          />
        ))}
      </div>
      <ul className="nova-vs-legend">
        {b.segments.map((sg, i) => (
          <li key={sg.vendor}>
            <button type="button" className="nova-vs-row" data-in-element="row" data-legend={sg.vendor}
              onClick={go(sg.vendor, sg.others)}>
              <span className="nova-vs-swatch" data-tone={sg.others ? 'others' : String(i)} aria-hidden="true" />
              <span className="nova-vs-name">
                {sg.vendor}{sg.others ? ` · ${sg.others} vendors` : ''}
                <span className="nova-vs-n"> · {sg.n}</span>
              </span>
              <span className="nova-vs-avg nova-num">avg {sg.avgWait} days</span>
            </button>
          </li>
        ))}
      </ul>
    </figure>
  );
}

/** The rest of the queue, flat — used when there are few enough of them to just show. */
export function VendorRest() {
  const b = useVendors();
  return <TriageCardList tickets={b.ranked.slice(3)} mode="vendor" />;
}

/** The whole queue, one collapsed group per vendor. THIS turn holds the volume; nothing else on
 *  TEC-06 does, which is what lets every other part keep its cap. */
export function VendorGroupsBlock() {
  const b = useVendors();
  const [open, setOpen] = useState<string | null>(b.groups[0]?.vendor ?? null);
  return (
    <div data-vendor-groups-list>
      {b.groups.map((g) => (
        <div key={g.vendor} className="nova-vg" data-vg={g.vendor}>
          <button
            type="button"
            className="nova-vg-head"
            data-in-element="disclosure"
            aria-expanded={open === g.vendor}
            onClick={() => setOpen(open === g.vendor ? null : g.vendor)}
          >
            <ChevronRight size={14} className="nova-vg-chev" aria-hidden="true" />
            <span className="nova-vg-name">{g.vendor}</span>
            <span className="nova-t-meta nova-vg-meta">
              <span className="nova-num">{g.tickets.length}</span> · avg <span className="nova-num">{g.avgWait}</span> days
              {g.overdue > 0 && <> · <span className="nova-warn-text">{g.overdue} overdue</span></>}
            </span>
          </button>
          {open === g.vendor && <TriageCardList tickets={g.tickets} mode="vendor" />}
        </div>
      ))}
    </div>
  );
}

/** The chases about to be sent, all ticked, grouped by vendor — the preview the bulk action opens
 *  above five. Unticking relabels the action, because the action sends what is ticked. */
export function ChasePreview({ id }: { id: string }) {
  const b = useVendors();
  const [off, setOff] = useState<string[]>([]);
  const on = b.overdue.filter((t) => !off.includes(t.ref));
  useTurnInputs(id, () => ({ refs: on.map((t) => t.ref) }), on.length > 0, 'Nothing is ticked', on.length);
  const groups = groupOf(on.length ? b.overdue : b.overdue);
  return (
    <div data-chase-preview={on.length}>
      {groups.map((g) => (
        <div key={g.vendor} className="nova-vg" data-preview-group={g.vendor}>
          <p className="nova-match-label">{g.vendor} · {g.tickets.length}</p>
          <ul className="nova-triage-list">
            {g.tickets.map((t) => (
              <li key={t.ref} className="nova-triage-wrap">
                <label className="nova-chase-row" data-chase-row={t.ref}>
                  <input
                    type="checkbox"
                    checked={!off.includes(t.ref)}
                    onChange={() => setOff((xs) => (xs.includes(t.ref) ? xs.filter((r) => r !== t.ref) : [...xs, t.ref]))}
                  />
                  <span className="nova-chase-ref">{t.ref}</span>
                  <span className="nova-chase-title">{t.title}</span>
                  <span className="nova-t-meta nova-num">{daysSinceChase(t)}d silent</span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );

  function groupOf(rows: MockTicket[]) {
    const m = new Map<string, MockTicket[]>();
    b.overdue.forEach((t) => m.set(t.vendor ?? '—', [...(m.get(t.vendor ?? '—') ?? []), t]));
    void rows;
    return [...m.entries()].map(([vendor, tickets]) => ({ vendor, tickets: byUrgency(tickets) }))
      .sort((a, b2) => b2.tickets.length - a.tickets.length);
  }
}

/** Every ticket with no vendor ref, grouped by who you have to ask. One editable row each; only
 *  the rows that were filled are saved, so a half-finished pass is a half-finished pass and not a
 *  set of blanked references. */
export function MissingRefs({ id }: { id: string }) {
  const b = useVendors();
  const [values, setValues] = useState<Record<string, string>>({});
  const filled = Object.entries(values).filter(([, v]) => v.trim());
  useTurnInputs(id, () => ({ values: Object.fromEntries(filled) }), filled.length > 0,
    'No reference has been entered yet', filled.length);
  const groups = new Map<string, typeof b.missingRef>();
  b.missingRef.forEach((t) => groups.set(t.vendor ?? '—', [...(groups.get(t.vendor ?? '—') ?? []), t]));
  return (
    <div data-missing-refs={b.missingRef.length} data-filled={filled.length}>
      {[...groups.entries()].map(([vendor, rows]) => (
        <div key={vendor} className={CARD} data-ref-group={vendor}>
          <p className="nova-card-head">{vendor} · {rows.length}</p>
          <CardRows>
            {rows.map((t) => (
              <CardRow key={t.ref} kind="editable" rowId={t.ref} label={t.ref}
                value={values[t.ref] || 'none yet'} editor="text"
                onCommit={(v) => setValues((m) => ({ ...m, [t.ref]: /^none yet$/i.test(v) ? '' : v }))} />
            ))}
          </CardRows>
        </div>
      ))}
      <p className="nova-t-meta nova-vendor-foot">
        {filled.length === 0
          ? `${b.missingRef.length} tickets have no reference on file. Blank rows are left alone.`
          : `${filled.length} of ${b.missingRef.length} entered. The rest are left alone.`}
      </p>
    </div>
  );
}

export function IncidentTimeline({ ticket, fullLog, onAsk }: {
  ticket: MockTicket; fullLog?: boolean; onAsk: TechApi['onAsk'];
}) {
  /* FROZEN, like every other card in an action turn: a mark added by a LATER turn belongs on
     that turn, and this one gains the "Changed below" tag instead of quietly growing a row. */
  const marks = useFrozen(() => timelineOf(ticket));
  const updates = useFrozen(() => [...ticket.updates]);
  const nowMin = minutesOf(DEMO_NOW);
  const done = marks.filter((m) => !m.now && !m.future).length;
  const ahead = marks.filter((m) => m.future).length;
  /* THE NEXT ONE COMING is the only future event worth colouring - the rest are simply later. */
  const nextFuture = marks.find((m) => m.future)?.t;
  return (
    <div className="nova-itl-card" data-incident-timeline>
      <StaleTag refs={[ticket.ref]} />
      <div className="nova-itl-head">
        <span className="nova-itl-title">Timeline</span>
        <RefChip id={ticket.ref} onAsk={onAsk} />
        <span className="nova-t-meta nova-itl-count" data-itl-count>{done} done · {ahead} ahead</span>
      </div>
      {/* A REAL LIST, so the reading order and the drawing order are one thing. */}
      <ol className="nova-itl">
        {marks.map((m, i) => {
          const [label, note] = splitNote(m.label);
          const ahead_ = Math.max(0, minutesOf(m.t) - nowMin);
          const next = m.future && m.t === nextFuture;
          const name = [m.t, label, m.now ? 'current' : m.future ? `in ${gapLabel(ahead_)}` : note].filter(Boolean).join(', ');
          return (
            <li
              key={`${m.t}-${i}`}
              className="nova-itl-row"
              data-itl-row={m.now ? 'now' : m.future ? 'future' : 'past'}
              data-next={next ? 'true' : undefined}
              aria-current={m.now ? 'step' : undefined}
              aria-label={name}
            >
              <span className="nova-itl-time">{m.t}</span>
              {/* The line is drawn by the dot column, so it starts and ends at a dot's centre. */}
              <span className="nova-itl-dot" aria-hidden="true" data-first={i === 0 ? 'true' : undefined}
                data-last={i === marks.length - 1 ? 'true' : undefined} />
              <span className="nova-itl-label">{label}</span>
              <span className="nova-itl-right">
                {m.now ? null : m.future ? `in ${gapLabel(ahead_)}` : (m.added ? 'added by you' : note)}
              </span>
            </li>
          );
        })}
      </ol>
      {fullLog && (
        <div className="nova-itl-log">
          <Label>Full incident log · {updates.length} updates</Label>
          <ol className="mt-1 space-y-0.5">
            {updates.map((x, i) => (
              <li key={`${x.at}-${i}`} className="nova-t-meta">
                <span className="nova-itl-log-at">{x.at}</span> {x.text}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

export function LinkPicker({ options, onAsk }: { options: string[]; onAsk: TechApi['onAsk'] }) {
  const { turnId, sel, live, toggle, clear } = useSelection();
  const [other, setOther] = useState('');
  const typedValid = /^(INC|REQ)-\d{3,5}$/.test(other.trim().toUpperCase());
  const typing = other.trim().length > 0;
  return (
    <div className={CARD} data-link-picker onKeyDown={escClears(clear, sel.length > 0)}>
      <div className="nova-list-head">
        <span className="nova-t-label">Which ticket is the user's?</span>
        <SelectionPill n={sel.length} onClear={clear} />
      </div>
      <ul className="px-2 py-1" role="radiogroup" aria-label="Ticket to link">
        {options.map((o, i) => {
          const t = getTicket(o);
          return (
            <SelectRow
              key={o}
              refId={o}
              single
              selected={sel.includes(o)}
              live={live}
              onToggle={() => toggle(o, true)}
              onOpen={() => openRef(onAsk, o)}
              className={i > 0 ? 'border-t border-[var(--nova-rule)]' : ''}
            >
              <span className="flex w-full flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className="nova-ref" data-ref={o}>{o}</span>
                <span className="min-w-0 flex-1 nova-t-body text-[var(--nova-ink)]">{t?.title}</span>
              </span>
              <span className="nova-t-meta mt-0.5 block text-left">
                {t?.site} · {t?.network ?? 'network not recorded'} · opened {t?.created} · updated {t?.lastUpdate}
              </span>
            </SelectRow>
          );
        })}
        <li className="border-t border-[var(--nova-rule)] px-2 py-2" data-enter-ref>
          <label className="flex flex-wrap items-center gap-2">
            <span className="nova-t-meta">Enter a ref</span>
            <input
              value={other}
              disabled={!live}
              onChange={(e) => {
                const v = e.target.value;
                setOther(v);
                const up = v.trim().toUpperCase();
                if (turnId && live) setSelection(turnId, /^(INC|REQ)-\d{3,5}$/.test(up) ? [up] : []);
              }}
              placeholder="INC-…"
              aria-label="Ticket reference"
              className="h-8 w-40 rounded border border-[var(--nova-rule)] bg-white px-2 ask-text-sm text-[var(--nova-ink)] outline-none focus:border-[var(--nova-primary)]"
            />
            {typing && !typedValid && <span className="nova-t-meta text-[var(--nova-warning)]">Not a ticket reference yet</span>}
          </label>
        </li>
      </ul>
    </div>
  );
}

/* ══ FACTS AND RECOMMENDATION ══════════════════════════════════════════════════════════════ */
export function KbSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const kb = getKb(id);
  const { onAsk } = useTech();
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); onClose(); } };
    window.addEventListener('keydown', key, true);
    return () => window.removeEventListener('keydown', key, true);
  }, [onClose]);
  return createPortal(
    <aside className="nova-ev-sheet" role="dialog" aria-modal="true" aria-label={kb ? `${kb.id} — ${kb.title}` : id} data-kb-sheet>
      <header className="flex items-start gap-2 border-b border-[var(--nova-rule)] px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="nova-t-label">{id} · Knowledge article</p>
          <h3 className="ask-text-base ask-w-600 text-[var(--nova-ink)]">{kb?.title ?? 'Article not in this dataset'}</h3>
          {kb && <p className="nova-t-meta mt-0.5">Last verified {kb.verified} · {kb.linked.length} linked incidents</p>}
        </div>
        <button type="button" aria-label="Close article" onClick={onClose} className="nova-btn nova-btn-icon flex size-8 items-center justify-center rounded">
          <X size={15} aria-hidden="true" />
        </button>
      </header>
      {kb && (
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          <p className="nova-t-body text-[var(--nova-ink)]">{kb.summary}</p>
          <Label>Resolution</Label>
          <ol className="mt-1.5 space-y-1">
            {kb.steps.map((s, i) => (
              <li key={i} className="flex gap-2.5 nova-t-body text-[var(--nova-ink)]">
                <span className="w-4 flex-shrink-0 text-right ask-text-sm tabular-nums text-[var(--nova-ink-faint)]" aria-hidden="true">{i + 1}</span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
          <p className="nova-t-label mt-3">Controller change</p>
          <pre className="nova-mono mt-1">{kb.config.join('\n')}</pre>
          <p className="nova-t-label mt-3">Linked incidents</p>
          <p className="mt-1 flex flex-wrap gap-1">{kb.linked.map((r) => <RefChip key={r} id={r} onAsk={(q) => { onClose(); onAsk(q); }} />)}</p>
        </div>
      )}
    </aside>,
    document.body,
  );
}

/** The article's card. The title OPENS the article (a disclosure within the card, not a
 *  forward action); applying it is the turn's. */
export function KbCard({ id, linked, onOpen, onAsk }: { id: string; linked?: string; onOpen: () => void; onAsk: TechApi['onAsk'] }) {
  const kb = getKb(id);
  return (
    <div className={CARD} data-kb-card>
      <StaleTag refs={[id, ...(kb?.linked ?? [])]} />
      <div className="px-4 py-3">
        <p className="flex flex-wrap items-baseline gap-x-2">
          <RefChip id={id} onAsk={onAsk} />
          <button type="button" className="nova-btn nova-kb-title text-left" data-in-element="disclosure" data-kb-open onClick={onOpen}>
            {kb?.title ?? 'Article not in this demo'}
          </button>
        </p>
        {kb && <p className="nova-t-meta mt-1">Last verified {kb.verified} · {kb.linked.length} linked incidents</p>}
        {linked && <p className="nova-t-meta mt-1" data-kb-linked>Applies to <RefChip id={linked} onAsk={onAsk} /></p>}
      </div>
    </div>
  );
}

/* ══ SIMILAR INCIDENTS — rows open their record ════════════════════════════════════════════ */
export interface JargonPair { term: string; replacement: string; note?: string }

/* == THE COPYABLE BLOCK =======================================================================
 *
 * A body of text whose purpose is to leave the screen - spoken to a caller, or sent to a
 * requester. Treated like a code block in a chat UI: a container, a header that says what it is
 * and offers to copy it, and nothing inside the body but the words.
 *
 * CopyButton is shared. The clipboard API is unavailable in plenty of real contexts (an insecure
 * origin, a locked-down browser, a headless run), so the fallback SELECTS the text: Ctrl/Cmd+C
 * then does what the button would have done, and the reader can see that it is selected. */

export function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  const run = async () => {
    let ok = false;
    try {
      if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); ok = true; }
    } catch { /* denied, or no permission in this context */ }
    if (!ok) {
      /* THE FALLBACK IS A SELECTION, not a silent failure: the words end up highlighted, so the
         reader's own Ctrl/Cmd+C finishes the job and they can see why. */
      const el = document.querySelector(`[data-copy-body="${CSS.escape(text.slice(0, 24))}"]`);
      const node = el ?? document.activeElement?.closest('[data-copy-target]')?.querySelector('[data-copy-body]');
      const sel = window.getSelection();
      if (node && sel) { const r = document.createRange(); r.selectNodeContents(node); sel.removeAllRanges(); sel.addRange(r); }
    }
    setDone(true);
    window.setTimeout(() => setDone(false), 2000);
  };
  return (
    <>
      <button type="button" className={`nova-btn nova-blk-btn ${done ? 'is-done' : ''}`}
        data-in-element="copy" data-copy onClick={run}>
        {done ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
        {done ? 'Copied' : label}
      </button>
      {/* Announced once, when it happens - not a label that is always on the page. */}
      <span className="sr-only" role="status" aria-live="polite">{done ? 'Copied to clipboard' : ''}</span>
    </>
  );
}

const TONE_PILLS: Array<{ id: Tone; label: string }> = [
  { id: 'formal', label: 'Formal' }, { id: 'friendly', label: 'Friendly' }, { id: 'shorter', label: 'Shorter' },
];

export function DraftBlock({ id, refId, label, tones, tone: authored, prefill, jargon, draftId, awaits }: {
  id: string; refId: string; label: string;
  tones?: Partial<Record<Tone, string>>; tone?: Tone; prefill: string;
  jargon?: JargonPair[]; draftId?: string;
  /** Sending it moves the ticket to Waiting on requester. */
  awaits?: boolean;
}) {
  useTicketStore();
  const draft = draftId ? getDraft(draftId) : ({} as ReturnType<typeof getDraft>);
  const composed = draftId ? composeDraftText({ tones, tone: authored, prefill, jargon }, draft) : null;
  const text = composed ? composed.text : prefill;
  const tone: Tone = composed ? composed.tone : (authored ?? 'formal');
  const custom = !!draft?.edited || !!(draft?.reverted ?? []).length;
  const [editing, setEditing] = useState(false);
  const [buf, setBuf] = useState(text);
  const [openJargon, setOpenJargon] = useState(false);
  const editRef = useRef<HTMLButtonElement | null>(null);
  const areaRef = useRef<HTMLTextAreaElement | null>(null);
  const pairs = jargon ?? [];
  const reverted = draft?.reverted ?? [];
  const simplified = pairs.length - reverted.length;

  /* THE ATTACHED ACTIONS READ THIS, so what is sent is what is on screen - including an edit the
     reader made a second ago and has not "saved" anywhere. */
  /* `text` is the key send-reply and save-draft read - the SAME key the composer this block
     replaces used, so the attached actions did not have to learn a new one. `await` carries the
     script's `awaits`: sending moves the ticket to wait on the requester. */
  useTurnInputs(id, () => ({
    ref: refId, draftId, text, await: !!awaits,
    tone: custom ? 'Custom' : TONE_PILLS.find((p) => p.id === tone)?.label,
  }), !!text.trim(), 'The draft is empty');

  const startEdit = () => { setBuf(text); setEditing(true); };
  const commit = () => {
    const v = buf.trim();
    if (draftId && v) updateDraft(draftId, { edited: v });
    setEditing(false);
    editRef.current?.focus();
  };
  const cancel = () => { setEditing(false); editRef.current?.focus(); };
  useEffect(() => { if (editing) areaRef.current?.focus(); }, [editing]);

  return (
    <div className="nova-blk" data-draft-block={id} data-copy-target>
      <div className="nova-blk-head">
        <span className="nova-blk-label">{label}</span>
        <span className="nova-blk-tools">
          <CopyButton text={text} />
          <button ref={editRef} type="button" className="nova-btn nova-blk-btn"
            data-in-element="editor" data-edit-toggle
            onClick={() => (editing ? commit() : startEdit())}>
            <Pencil size={14} aria-hidden="true" />{editing ? 'Done' : 'Edit'}
          </button>
        </span>
      </div>

      {/* THE TONE, on the block it changes. Disabled while editing: the reader's own words are
          not a tone, and swapping one underneath them would discard what they typed. */}
      <div className="nova-blk-tones" role="radiogroup" aria-label="Tone" data-tone-toggle data-custom={custom ? 'true' : 'false'}>
        {TONE_PILLS.map((p) => (
          <button key={p.id} type="button" role="radio" aria-checked={!custom && tone === p.id}
            className="nova-btn nova-tone-pill" data-in-element="editor" data-tone={p.id}
            disabled={editing}
            onClick={() => draftId && updateDraft(draftId, { tone: p.id, edited: undefined, reverted: [] })}
          >{p.label}</button>
        ))}
        {custom && <span className="nova-tone-pill is-custom" data-tone="custom">Custom</span>}
      </div>

      {editing
        ? (
          <textarea
            ref={areaRef}
            className="nova-blk-edit"
            data-editor
            value={buf}
            onChange={(e) => setBuf(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cancel(); }
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); commit(); }
            }}
          />
        )
        : <p className="nova-blk-body" data-copy-body data-draft-text>{text}</p>}

      <div className="nova-blk-foot">
        <span>{custom ? 'Edited by you' : 'Drafted by Nova'}</span>
        {pairs.length > 0 && (
          <button type="button" className="nova-btn nova-blk-expand" aria-expanded={openJargon}
            data-in-element="disclosure" data-jargon-expand onClick={() => setOpenJargon((v) => !v)}>
            {simplified} term{simplified === 1 ? '' : 's'} simplified
            <ChevronRight size={12} aria-hidden="true" className="nova-blk-chev" data-open={openJargon ? 'true' : 'false'} />
          </button>
        )}
      </div>

      {openJargon && (
        <div className="nova-blk-jargon" data-jargon-check>
          {pairs.map((p) => {
            const back = reverted.includes(p.term);
            return (
              <div key={p.term} className="nova-jargon-row" data-jargon-row={p.term}>
                <span className="nova-jargon-from">{p.term}</span>
                <span className="nova-jargon-arrow" aria-hidden="true">→</span>
                <span className="nova-jargon-to">{back ? p.term : p.replacement}</span>
                <button type="button" className="nova-btn nova-jargon-revert" data-in-element="revert"
                  onClick={() => draftId && updateDraft(draftId, {
                    reverted: back ? reverted.filter((x) => x !== p.term) : [...reverted, p.term],
                  })}
                >{back ? 'Undo' : 'Revert'}</button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function JargonCheck({ pairs, reverted, onRevert }: {
  pairs: JargonPair[]; reverted: string[]; onRevert: (term: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const n = pairs.length - reverted.length;
  return (
    <div className="border-t border-[var(--nova-rule)]" data-jargon-check>
      <button type="button" aria-expanded={open} data-in-element="disclosure" onClick={() => setOpen((v) => !v)}
        className="nova-btn nova-btn-ghost flex min-h-[40px] w-full items-center gap-2 px-4 text-left ask-text-sm">
        <ChevronDown size={12} className="nova-chev flex-shrink-0" data-open={open ? 'true' : 'false'} aria-hidden="true" />
        <span data-jargon-count>{n} term{n === 1 ? '' : 's'} simplified</span>
      </button>
      {open && (
        <ul className="px-4 pb-2">
          {pairs.map((p, i) => {
            const back = reverted.includes(p.term);
            return (
              <li key={p.term} className={`flex flex-wrap items-center gap-x-2 gap-y-1 py-1.5 ${i > 0 ? 'border-t border-[var(--nova-rule)]' : ''}`} data-jargon-row={p.term} data-reverted={back ? 'true' : 'false'}>
                <span className="ask-text-sm text-[var(--nova-ink-muted)]">{p.term}</span>
                <span aria-hidden="true" className="text-[var(--nova-ink-faint)]">→</span>
                <span className={`ask-text-sm ${back ? 'text-[var(--nova-ink-faint)] line-through' : 'ask-w-500 text-[var(--nova-ink)]'}`}>{p.replacement}</span>
                {p.note && <span className="nova-t-meta">· {p.note}</span>}
                <button type="button" className={`${QUIET} ml-auto`} data-in-element="revert" onClick={() => onRevert(p.term)}>{back ? 'Simplify again' : 'Revert'}</button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export type Tone = 'formal' | 'friendly' | 'shorter';
export const TONES: Array<{ id: Tone; label: string }> = [
  { id: 'formal', label: 'Formal' }, { id: 'friendly', label: 'Friendly' }, { id: 'shorter', label: 'Shorter' },
];
export function ToneToggle({ tone, custom, onChange }: { tone: Tone; custom?: boolean; onChange: (t: Tone) => void }) {
  /* ONCE THE READER HAS WRITTEN THEIR OWN WORDS, no authored tone is selected — the toggle
     would otherwise keep claiming the text is Nova's "Formal" version when it is the
     technician's. Picking a tone again replaces the edit, which is what `onChange` already
     does (it clears `edited`), so the way back is the toggle itself. */
  return (
    <div className="nova-seg" role="radiogroup" aria-label="Tone" data-tone-toggle data-custom={custom ? 'true' : 'false'}>
      {TONES.map((t) => (
        <button key={t.id} type="button" role="radio" aria-checked={!custom && tone === t.id} data-tone={t.id}
          onClick={() => onChange(t.id)} className="nova-btn nova-seg-btn">{t.label}</button>
      ))}
      {custom && <span className="nova-seg-custom" data-tone-custom>Custom</span>}
    </div>
  );
}

/* ══ HOLD CARD — TEC-04's diff + note, ONE action ══════════════════════════════════════════ */
/** The preview of the hold. The after-values are editable; the note is a row of its own. The
 *  attached "Put INC-1062 on hold" reads the card AS IT STANDS. */
export function HoldCard({ refId, rows, why, note, reminder, pendingReason, vendorRef, vendorRefUnverified, noReminder, focusSignal }: {
  refId: string; rows: DiffRow[]; why: string; note: string; reminder: string;
  pendingReason: string; vendorRef: string; vendorRefUnverified?: boolean;
  noReminder?: boolean; focusSignal?: number;
}) {
  const [text, setText] = useState(note);
  /* What the reader decided, keyed by row label — the hold that gets applied is the one on the
     screen, not the one the script proposed. */
  const [edits, setEdits] = useState<Record<string, string>>({});
  const shownRows = noReminder ? rows.filter((r) => !/follow-up|reminder/i.test(r.label)) : rows;
  const rowValue = (r: DiffRow) => edits[r.label] ?? r.to;
  const byLabel = (re: RegExp) => {
    const r = rows.find((x) => re.test(x.label));
    return r ? rowValue(r) : undefined;
  };
  /* "no reminder" is one of the follow-up row's choices, so choosing it has to mean the same
     thing as the card being rendered without that row at all. */
  const followUp = byLabel(/follow|remind/i) ?? '';
  const when = noReminder || /^no reminder$/i.test(followUp) ? ''
    : /48/.test(followUp) ? 'the day after tomorrow 10:00' : reminder;
  useTurnInputs('hold', () => ({
    ref: refId,
    status: byLabel(/^status$/i) ?? 'On hold',
    pendingReason: byLabel(/pending/i) ?? pendingReason,
    vendorRef: byLabel(/vendor ref/i) ?? vendorRef,
    vendorRefUnverified: !!vendorRefUnverified && (byLabel(/vendor ref/i) ?? vendorRef) === vendorRef,
    note: text,
    reminder: when,
  }), !!text.trim(), 'The note is empty');
  return (
    <div className="space-y-4" data-hold-card>
      <div className={CARD} data-diff-card>
        <StaleTag refs={[refId]} />
        <p className="nova-card-head">{refId}</p>
        <CardRows after="After hold">
          {shownRows.map((r) => <DiffRowCells key={r.label} row={r} value={rowValue(r)} onCommit={setEdits} />)}
        </CardRows>
        <p className="nova-t-meta border-t border-[var(--nova-rule)] px-4 py-2.5">Why: {why}</p>
      </div>
      <div className={CARD} data-note-composer>
        <p className="nova-card-head">Note on {refId}</p>
        <div className="px-4 py-1">
          {/* The note is the fourth row kind: prose, its own width, no label column. The •••
              "Edit note" arrives as the signal. */}
          <CardRows>
            <CardRow kind="note" label="Note" value={text} rows={3} focusSignal={focusSignal} onCommit={setText} />
          </CardRows>
        </div>
      </div>
    </div>
  );
}

/* ══ PEOPLE CARD — who is on the bridge ════════════════════════════════════════════════════ */
export function PeopleCard({ heading, people }: {
  heading: string; people: Array<{ name: string; role: string; onCall?: boolean }>;
}) {
  return (
    <div className={CARD} data-people-card>
      <p className="nova-card-head">{heading}</p>
      <ul className="px-4 py-1">
        {people.map((p, i) => (
          <li key={p.name} className={`flex flex-wrap items-center gap-x-2 gap-y-1 py-2 ${i > 0 ? 'border-t border-[var(--nova-rule)]' : ''}`}>
            <span aria-hidden="true" className={`size-2 flex-shrink-0 rounded-full ${p.onCall ? 'bg-[var(--nova-success)]' : 'bg-[var(--nova-g400)]'}`} />
            <span className="nova-t-body text-[var(--nova-ink)]">{p.name}</span>
            <span className="nova-t-meta">{p.role}{p.onCall ? ' · on call' : ''}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ══ CHANGES LIST — overnight, or since the last handover; rows open their record ══════════ */
export interface ChangeRow { key: string; at: string; refs: string[]; text: string; kind: string }

export function changeRows(set: 'overnight' | 'sinceHandover'): ChangeRow[] {
  if (set === 'overnight') return OVERNIGHT.map((o, i) => ({ key: `o${i}`, at: o.at, refs: o.refs, text: o.text, kind: o.kind }));
  return changesSinceHandover().map((c, i) => ({
    key: `c${i}`, at: c.at, refs: [c.ticket.ref], kind: c.kind,
    text: `${c.kind === 'new' ? 'New' : c.kind === 'resolved' ? 'Resolved' : 'Escalated'} — ${c.ticket.title}${c.kind === 'escalated' ? ` (now ${c.ticket.priority})` : ''}`,
  }));
}

export function ChangesList({ rows, onAsk }: { rows: ChangeRow[]; onAsk: TechApi['onAsk'] }) {
  return (
    <div className={CARD} data-changes-list>
      <StaleTag refs={rows.flatMap((r) => r.refs)} />
      <ol className="px-2 py-1">
        {rows.map((r, i) => (
          <li key={r.key} className={`${i > 0 ? 'border-t border-[var(--nova-rule)]' : ''}`} data-change={r.kind}>
            <button type="button" className="nova-btn nova-sel-open nova-open-row" data-in-element="row" data-open-row={r.refs[0]} aria-label={`Open ${r.refs[0]}`} onClick={() => openRef(onAsk, r.refs[0])}>
              <span className="flex w-full flex-wrap items-center gap-x-2 gap-y-1">
                <span className="w-[108px] flex-shrink-0 ask-text-sm tabular-nums text-[var(--nova-ink-muted)]">{r.at}</span>
                <span className="flex flex-wrap gap-1">{r.refs.map((x) => <span key={x} className="nova-ref" data-ref={x}>{x}</span>)}</span>
                <span className="min-w-0 flex-1 nova-t-body text-[var(--nova-ink)]">{r.text}</span>
              </span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}

/* ══ TICKET TABLE — a store query, rows selectable and clickable ═══════════════════════════ */
export type TablePreset = 'blrOpenVpn' | 'vendorSla';

export function tablePreset(preset: TablePreset): { columns: string[]; rows: MockTicket[]; cells: (t: MockTicket) => Array<string | number>; risk?: (t: MockTicket) => boolean } {
  if (preset === 'blrOpenVpn') {
    const rows = listOpenAt('Bengaluru', /vpn/i);
    return {
      columns: ['Ref', 'Title', 'Network', 'Assigned to', 'Same signature?'],
      rows,
      cells: (t) => [t.ref, t.title, t.network ?? '—', t.assignee,
        /BLR-\d/.test(t.network ?? '') ? 'Yes — 30-minute drops on wireless' : 'Likely — wireless, interval not logged'],
    };
  }
  const rows = [...listVendorPending()].sort((a, b) => (a.slaRemainingMin ?? 1e9) - (b.slaRemainingMin ?? 1e9));
  return {
    columns: ['Ref', 'Vendor', 'Title', 'SLA remaining', 'Priority'],
    rows,
    cells: (t) => [t.ref, t.vendor ?? '', t.title, t.slaRemainingMin === undefined ? 'no clock' : durationLabel(t.slaRemainingMin), t.priority ?? ''],
    risk: (t) => (t.slaRemainingMin ?? 1e9) < 720,
  };
}

export function TicketTable({ preset, single, onAsk }: { preset: TablePreset; single?: boolean; onAsk: TechApi['onAsk'] }) {
  const p = useFrozen(() => { const x = tablePreset(preset); return { ...x, rows: x.rows.map((t) => ({ ...t })) }; });
  const { sel, live, toggle, clear } = useSelection();
  return (
    <div data-ticket-table data-preset={preset} className="relative" onKeyDown={escClears(clear, sel.length > 0)}>
      <StaleTag refs={p.rows.map((t) => t.ref)} />
      <div className="nova-list-head nova-list-head-bare">
        <span className="nova-t-label">{p.rows.length} ticket{p.rows.length === 1 ? '' : 's'}</span>
        <SelectionPill n={sel.length} onClear={clear} />
      </div>
      <div className="nova-table-wrap" data-data-table>
        <table className="nova-table nova-sel-table">
          <thead>
            <tr>
              <th scope="col" className="nova-sel-th"><span className="sr-only">Select</span></th>
              {p.columns.map((c) => <th key={c} scope="col">{c}</th>)}
            </tr>
          </thead>
          <tbody>
            {p.rows.map((t) => {
              const cells = p.cells(t);
              const selected = sel.includes(t.ref);
              return (
                <tr
                  key={t.ref}
                  className={`nova-sel-tr ${p.risk && p.risk(t) ? 'nova-row-risk' : ''}`}
                  data-sel-row={t.ref}
                  data-selected={selected ? 'true' : 'false'}
                  onClick={() => { if (live) openRef(onAsk, t.ref); }}
                >
                  <td className="nova-sel-td">
                    <span className="nova-sel-box">
                      <input
                        type="checkbox"
                        role={single ? 'radio' : undefined}
                        className="nova-sel-check"
                        aria-label={`Select ${t.ref}`}
                        checked={selected}
                        disabled={!live}
                        tabIndex={live ? 0 : -1}
                        onClick={(e) => e.stopPropagation()}
                        onChange={() => toggle(t.ref, single)}
                      />
                    </span>
                  </td>
                  {cells.map((cell, ci) => (
                    <td key={ci} className={typeof cell === 'number' ? 'tabular-nums' : undefined}>
                      {ci === 0 ? (
                        <button
                          type="button"
                          className="nova-btn nova-ref nova-ref-btn"
                          data-in-element="row"
                          data-open-row={t.ref}
                          disabled={!live}
                          tabIndex={live ? 0 : -1}
                          aria-label={`Open ${t.ref}`}
                          onClick={(e) => { e.stopPropagation(); openRef(onAsk, t.ref); }}
                          onKeyDown={(e) => { if (e.key === ' ') { e.preventDefault(); e.stopPropagation(); toggle(t.ref, single); } }}
                        >{t.ref}</button>
                      ) : cell}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ══ VENDOR GROUPS — one section per vendor (TEC-06), rows selectable ══════════════════════ */
export function VendorGroups({ filter, onAsk }: { filter?: string | null; onAsk: TechApi['onAsk'] }) {
  const pending = useFrozen(() => listVendorPending().map((t) => ({ ...t })));
  const { sel, live, toggle, clear } = useSelection();
  const overdue = (t: MockTicket) => (t.chaseAgeDays ?? 99) >= CHASE_OVERDUE_DAYS;
  const vendors = (VENDOR_BOARD as readonly string[]).filter((v) => pending.some((t) => t.vendor === v));
  const visible = pending.filter((t) => (filter === 'overdue' ? overdue(t) : filter ? t.vendor === filter : true));
  return (
    <div className={CARD} data-vendor-groups onKeyDown={escClears(clear, sel.length > 0)}>
      <StaleTag refs={pending.map((t) => t.ref)} />
      <div className="nova-list-head">
        <span className="nova-t-label">Waiting on vendors · {visible.length}</span>
        <SelectionPill n={sel.length} onClear={clear} />
      </div>
      {vendors.map((v) => {
        const mine = visible.filter((t) => t.vendor === v);
        if (!mine.length) return null;
        return (
          <section key={v} className="border-t border-[var(--nova-rule)]" data-vendor={v}>
            <p className="nova-t-label px-4 pt-2.5">{v} · {mine.length}</p>
            <ul className="px-2 pb-1">
              {mine.map((t) => {
                const late = overdue(t);
                return (
                  <SelectRow
                    key={t.ref}
                    refId={t.ref}
                    selected={sel.includes(t.ref)}
                    live={live}
                    onToggle={() => toggle(t.ref)}
                    onOpen={() => openRef(onAsk, t.ref)}
                    className="border-t border-[var(--nova-rule)] first:border-t-0"
                    rowProps={{ 'data-vendor-row': t.ref, 'data-overdue-chase': late ? 'true' : 'false' }}
                  >
                    <span className="flex w-full flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <span className="nova-ref" data-ref={t.ref}>{t.ref}</span>
                      <span className="min-w-0 flex-1 nova-t-body text-[var(--nova-ink)]">{t.title}</span>
                    </span>
                    <span className="nova-t-meta mt-0.5 flex flex-wrap gap-x-3 text-left">
                      <span>waiting {t.waitingDays ?? 0}d</span>
                      <span className={t.vendorRef ? '' : 'nova-flag'}>{t.vendorRef ? `ref ${t.vendorRef}` : 'no ref'}</span>
                      <span className={late ? 'nova-flag' : ''}>{t.chaseAgeDays === undefined ? 'never chased' : t.chaseAgeDays === 0 ? 'chased today' : `chased ${t.chaseAgeDays}d ago`}</span>
                      <span>{t.eta ? `ETA ${t.eta}` : 'ETA none'}</span>
                    </span>
                  </SelectRow>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

/* ══ THE EDITABLE TURN ═════════════════════════════════════════════════════════════════════ */
/** A short form the TURN's own action commits — the vendor references, the ETAs a vendor gave,
 *  a mark for an incident timeline. One field per row; the attached action reads what was typed
 *  and is disabled until at least one field has something in it. */
export function FieldsEditor({ id, title, rows, note, noteFilled, refId }: {
  id: string; title: string; rows: Array<{ key: string; label: string }>;
  note: string; noteFilled?: string;
  /** The record this form is about, when it edits one rather than several. */
  refId?: string;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const filled = rows.filter((r) => (values[r.key] ?? '').trim());
  useTurnInputs(id, () => ({
    ref: refId,
    values: Object.fromEntries(rows.map((r) => [r.key, (values[r.key] ?? '').trim()])),
  }), filled.length > 0, 'Nothing has been entered yet');
  return (
    <div className={CARD} data-fields-editor={id} data-filled={filled.length}>
      <p className="nova-card-head">{title}</p>
      <CardRows>
        {rows.map((r) => (
          <CardRow key={r.key} kind="editable" rowId={r.key} label={r.label} value={values[r.key] || 'none yet'} editor="text"
            onCommit={(v) => setValues((m) => ({ ...m, [r.key]: /^none yet$/i.test(v) ? '' : v }))} />
        ))}
      </CardRows>
      <p className="nova-t-meta border-t border-[var(--nova-rule)] px-4 py-2.5">
        {filled.length === 0 ? note : (noteFilled ?? `${filled.length} of ${rows.length} entered.`)}
      </p>
    </div>
  );
}

/* ══ UPDATES LOG ═══════════════════════════════════════════════════════════════════════════ */
export function UpdatesLog({ ticket, onAsk }: { ticket: MockTicket; onAsk: TechApi['onAsk'] }) {
  const updates = useFrozen(() => [...ticket.updates]);
  return (
    <div className={CARD} data-updates-log>
      <StaleTag refs={[ticket.ref]} />
      <p className="nova-card-head">{ticket.ref} · {updates.length} update{updates.length === 1 ? '' : 's'}</p>
      <ol className="px-4 py-2 space-y-1">
        {updates.map((x, i) => (
          <li key={i} className="flex gap-3 ask-text-sm">
            <span className="w-28 flex-shrink-0 tabular-nums text-[var(--nova-ink-muted)]">{x.at}</span>
            <span className="text-[var(--nova-ink)]"><RefText text={x.text} onAsk={onAsk} /></span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/* ══ THE HANDOVER — built LIVE from the store (TEC-07, untouched) ══════════════════════════ */
export interface DocLine { key: string; ref?: string; text: string }
export interface DocSection { id: string; title: string; lines: DocLine[] }

const shortTitle = (t: MockTicket) => t.title.split(' — ')[0];

export function buildHandover({ closedToday, note }: { closedToday?: boolean; note?: string }): DocSection[] {
  const queue = listQueue();
  /* Open OR in progress: a P2 nobody has pressed Start on is burning all the same. */
  const burning = queue.filter((t) => /^P[12]$/.test(t.priority ?? '') && (t.status === 'In progress' || t.status === 'Open') && running(t) && t.slaRemainingMin! < 180);
  const burningLines: DocLine[] = burning.map((t) => {
    if (t.detail) {
      return { key: t.ref, ref: t.ref, text: `${t.ref} ${t.priority} ${shortTitle(t)} — re-run started ${t.detail.rerunAt}, ETA ${t.detail.eta}; watch for client confirmation; bridge call owner ${t.bridge?.owner ?? 'unknown'}` };
    }
    if (t.regulatory) {
      return { key: t.ref, ref: t.ref, text: `${t.ref} ${t.priority} ${shortTitle(t)} — SLA ${durationLabel(t.slaRemainingMin!)}, regulatory report OVERDUE by ${t.regulatoryOverdueDays ?? 0} day${(t.regulatoryOverdueDays ?? 0) === 1 ? '' : 's'}; needs a decision on interim report` };
    }
    return { key: t.ref, ref: t.ref, text: `${t.ref} ${t.priority} ${shortTitle(t)} — SLA ${durationLabel(t.slaRemainingMin!)}` };
  });

  const pending = listVendorPending();
  const vendors = (VENDOR_BOARD as readonly string[]).filter((v) => pending.some((t) => t.vendor === v));
  const blockedLines: DocLine[] = vendors.map((v) => {
    const mine = pending.filter((t) => t.vendor === v);
    const detail = mine
      .filter((t) => t.assignee === currentUser || t.status === 'On hold' || !!t.reminderAt)
      .map((t) => `${t.ref} ${t.status === 'On hold' ? 'on hold' : t.status.toLowerCase()}${t.vendorRef ? `, ref ${t.vendorRef}` : ', no vendor ref'}${t.reminderAt ? `, chase ${t.reminderAt}` : ''}`);
    return { key: `v-${v}`, ref: detail.length ? mine.find((t) => t.assignee === currentUser || t.status === 'On hold' || !!t.reminderAt)!.ref : undefined,
      text: `${mine.length} on ${v}${detail.length ? ` (${detail.join('; ')})` : ''}` };
  });
  queue.filter((t) => t.status === 'Waiting on requester').forEach((t) => {
    blockedLines.push({ key: t.ref, ref: t.ref, text: `${t.ref} waiting on requester ${t.waitingDays ?? 0} day${t.waitingDays === 1 ? '' : 's'}` });
  });

  const regLines: DocLine[] = [...REGULATORY].sort((a, b) => a.dueDays - b.dueDays).map((r) => ({
    key: r.ref, ref: r.ref,
    text: `${r.ref} ${r.title} · ${r.owner} · ${r.dueDays < 0 ? `overdue by ${-r.dueDays} day${-r.dueDays === 1 ? '' : 's'}` : `due in ${r.dueDays} day${r.dueDays === 1 ? '' : 's'}`}`,
  }));

  const decisionLines: DocLine[] = queue
    .filter((t) => t.regulatory && (t.regulatoryOverdueDays ?? 0) > 0 && running(t))
    .map((t) => ({ key: t.ref, ref: t.ref, text: `${t.ref} — file interim report or wait for full RCA?` }));

  const sections: DocSection[] = [
    { id: 'burning', title: 'Burning', lines: burningLines },
    { id: 'blocked', title: 'Blocked', lines: blockedLines },
    { id: 'regulator', title: 'Regulator', lines: regLines },
    { id: 'decision', title: 'Needs a decision tonight', lines: decisionLines },
  ];
  if (closedToday) {
    sections.push({ id: 'closed', title: 'Closed today', lines: listClosedToday().map((t) => ({ key: t.ref, ref: t.ref, text: `${t.ref} ${t.title} — closed ${t.closedAt}` })) });
  }
  if (note) sections.push({ id: 'note', title: 'Note for the night lead', lines: [{ key: 'note', text: note }] });
  return sections;
}

export function handoverText(sections: DocSection[]): string {
  return sections.map((s) => `${s.title.toUpperCase()}\n${s.lines.map((l) => `· ${l.text}`).join('\n')}`).join('\n\n')
    + `\n\nBuilt from live ticket data at ${DEMO_NOW}`;
}

export function HandoverDoc({ id, closedToday, plain, shorter, focusSection, onAsk }: {
  id: string; closedToday?: boolean; plain?: boolean; shorter?: boolean; focusSection?: string | null; onAsk: TechApi['onAsk'];
}) {
  const store = useTicketStore();
  const note = getDraft(id).note;
  const built = useMemo(() => buildHandover({ closedToday, note }), [store, closedToday, note]);
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [added, setAdded] = useState<Record<string, string[]>>({});
  const [adding, setAdding] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [copied, setCopied] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!focusSection) return;
    rootRef.current?.querySelector(`[data-doc-section="${focusSection}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [focusSection]);
  const sections: DocSection[] = built.map((s) => ({
    ...s,
    lines: [
      ...s.lines.filter((l) => !removed.has(`${s.id}/${l.key}`)),
      ...(added[s.id] ?? []).map((t, i) => ({ key: `added-${i}`, text: t })),
    ].slice(0, shorter ? 2 : undefined),
  }));
  const text = handoverText(sections);
  const refs = [...new Set(sections.flatMap((s) => s.lines.map((l) => l.ref)).filter((r): r is string => !!r))];
  const lineCount = sections.reduce((n, s) => n + s.lines.length, 0);
  const actions: Actions = [
    { label: 'Post to shift channel', kind: 'primary', requiresConfirm: true,
      preview: `Post the handover (${sections.length} sections, ${lineCount} lines) to #shift-handover`,
      onRun: () => { postToChannel('#shift-handover', text); return { text: 'Posted to #shift-handover' }; } },
    { label: 'Copy as text', kind: 'secondary',
      onRun: () => { void navigator.clipboard?.writeText(text).catch(() => {}); setCopied(true); window.setTimeout(() => setCopied(false), 1600); } },
    { label: 'Save to shift log', kind: 'secondary', requiresConfirm: true,
      preview: `Save the handover to the shift log and notify the night lead — ${refs.length} tickets named`,
      onRun: () => { addToShiftLog({ title: 'Night-shift handover', text, refs }); return { text: 'Saved — night lead notified' }; } },
  ];
  return (
    <div className={CARD} data-handover-doc data-plain={plain ? 'true' : 'false'} ref={rootRef}>
      {plain ? (
        <pre className="nova-mono nova-plain px-4 py-3" data-plain-text>{text}</pre>
      ) : sections.map((s) => (
        <section key={s.id} className="border-b border-[var(--nova-rule)] px-4 py-2.5" data-doc-section={s.id} data-focus={focusSection === s.id ? 'true' : 'false'}>
          <div className="flex items-center justify-between gap-2">
            <p className="nova-t-label">{s.title}</p>
            <button type="button" className={QUIET} onClick={() => { setAdding(s.id); setDraft(''); }} data-add-line={s.id}>Add a line</button>
          </div>
          {s.lines.length === 0 && <p className="nova-t-meta mt-1">Nothing in this section.</p>}
          <ul className="mt-1 space-y-1">
            {s.lines.map((l) => (
              <li key={l.key} className="flex items-start gap-2" data-doc-line>
                <span aria-hidden="true" className="text-[var(--nova-ink-faint)]">·</span>
                <span className="min-w-0 flex-1 nova-t-body text-[var(--nova-ink)]"><RefText text={l.text} onAsk={onAsk} /></span>
                <button type="button" className="nova-btn nova-btn-icon nova-hit flex size-6 flex-shrink-0 items-center justify-center rounded" aria-label={`Remove line: ${l.text.slice(0, 40)}`}
                  onClick={() => setRemoved((r) => new Set(r).add(`${s.id}/${l.key}`))}>
                  <X size={11} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
          {adding === s.id && (
            <div className="mt-1.5 flex items-center gap-1.5" data-add-line-form>
              <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="New line" aria-label="New line"
                className="h-8 min-w-0 flex-1 rounded border border-[var(--nova-rule)] bg-white px-2 ask-text-sm text-[var(--nova-ink)] outline-none focus:border-[var(--nova-primary)]" />
              <button type="button" className={PRIMARY_SM} disabled={!draft.trim()}
                onClick={() => { setAdded((a) => ({ ...a, [s.id]: [...(a[s.id] ?? []), draft.trim()] })); setAdding(null); }}>Add</button>
              <button type="button" className={GHOST_SM} onClick={() => setAdding(null)}>Cancel</button>
            </div>
          )}
        </section>
      ))}
      <p className="nova-t-meta px-4 pt-2" data-doc-freshness>Built from live ticket data at {DEMO_NOW}{copied ? ' · Copied' : ''}</p>
      <div className="px-4 py-3"><CardActionBar card="HandoverDoc" actions={actions} keep /></div>
    </div>
  );
}

/* The notes a mutation posts live beside the mutations now (tech/mutations.ts); re-exported so
   the copy-as-text helpers keep one import. */
export { chaseNote, kbResolutionNote, patternNote };
export { getDraft as techDraft, getTicket as techTicket, listSimilar, listQueue, listVendorPending };
