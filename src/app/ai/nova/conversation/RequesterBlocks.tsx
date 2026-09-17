import { useEffect, useRef, useState } from 'react';
import { Check, ChevronRight } from 'lucide-react';
import { useRequesterDock } from '../dock/RequesterDockCtx';
import { useTechTurn } from '../tech/TechTurnCtx';
import { ChangedCard } from '../tech/ChangedCard';
import type { ChangeResult } from '../tech/mutations';
import { NovaChip, statusFamily } from './NovaChip';
import { toast } from 'sonner';
import type { BannerSpec, DiffRow, DraftField, JargonPair, RequesterBlock } from '../scripts/registry';
import {
  addNote, addReminder, chase, closeTicket, createProblem, createTicket, escalate, getDraft,
  listOpenForUser, listSimilar, updateDraft, updateTicket, useTicketStore,
  type MockTicket,
} from '../mockTickets';
import { Callout, ChartFrame, DataTable, IncidentCards, IncidentDetail, KpiStrip, ProblemCards, kpisFor } from './LeadershipCharts';
import {
  assertTechnicianButtons, BriefCard, ChangesList, changeRows,
  HandoverDoc, HoldCard, IncidentTimeline, JargonCheck, KbCard, KbSheet,
  FieldsEditor, LinkPicker, openRef, PeopleCard, PriorityPill, QueueList, RefChip, refQuestion,
  ChasePreview, DraftBlock, IncidentBriefBlock, MatchCards, PatternBrief, ProseLines,
  MissingRefs, RecurrenceStrip, ResolvedCases, ShiftBrief, SlaBlock, TechCtx,
  TechStatChips, TicketTable, ToneToggle, UpdatesLog, VendorBriefBlock, VendorCards,
  VendorGroupsBlock, VendorRest, VendorStrip,
  VendorGroups, type Tone,
} from './TechnicianBlocks';
import { composeDraftText } from './blockText';
import { CARD, ConfirmBanner, DiscardedLine, GHOST, PRIMARY, QUIET, useProposal, useTurnInputs } from './cardKit';
import { EditableValue } from './EditableValue';
import { CardRow, CardRows, DiffRowCells } from './CardRow';
import { numberWord, statusSentences } from './statusSentences';
import { raisedLine, sortForReader, tokensToText, unresolvedSummary, type Token, type UnresolvedSummary } from './unresolvedSummary';

/* THE BLOCK RENDERER — one set of primitives, composed by data, wired to ONE store.
 *
 * A script authors `blocks` (see RequesterBlock in the registry); this file renders them. No
 * case owns a layout: REQ-01's draft card and REQ-04's "didn't work" draft card are the same
 * component fed different data, which is what keeps twenty-one cases from becoming twenty-one
 * designs. The requester primitives live here; the technician ones in TechnicianBlocks; the
 * leadership visuals in LeadershipCharts — and this switch is the only place that knows which
 * descriptor becomes which component.
 *
 * ── THE APPROVAL RULE, ENFORCED IN ONE PLACE ─────────────────────────────────────────────────
 * Every block that can change a ticket renders as a PROPOSAL. Its confirm is the ONLY click that
 * calls the store; the card is then REPLACED by a ConfirmBanner naming what happened. Nothing
 * here mutates on render, and nothing outside the store's mutation functions changes a record.
 *
 * ── AND WHERE THE CONFIRM LIVES DEPENDS ON WHO IS READING ────────────────────────────────────
 * In a REQUESTER turn no card renders a button. The card is the preview; its confirm is option 1
 * of the Next-step dock above the input, which runs the card's own committer (registered through
 * `useProposal`, so the reader's edits are what gets committed). Declines are gone with the
 * footers: nothing has happened until option 1 runs, so there is nothing to undo. A technician's
 * or leadership's turn keeps the footer it always had — the dock ends at the requester until
 * their own dock work.
 *
 * `assertNoForwardButtons` is the dev-time guard: a requester card that renders a forward-action
 * <button> throws. In-element controls — a checkbox, a radio, a tab, a list row that navigates
 * within the element — declare themselves by role or `data-in-element` and are exempt.
 *
 * ── LANGUAGE ─────────────────────────────────────────────────────────────────────────────────
 * Requester words for the requester blocks — a ticket is "being worked on", a fix "took about
 * two minutes". The technician blocks are the opposite register on purpose: refs, timestamps,
 * counts, no softening.
 */

export { ConfirmBanner };

const bannerText = (spec: BannerSpec, ref: string) => spec.text.replace(/\{ref\}/g, ref);

/* ── AnswerHead ─────────────────────────────────────────────────────────── */
export function AnswerHead({ n, text, body }: { n?: string; text: string; body?: string }) {
  return (
    <div style={{ marginTop: n ? 16 : 0 }}>
      {n && <p className="nova-t-label">{n}</p>}
      <p className="ask-text-lg leading-[1.35] text-[var(--nova-ink)] ask-w-600">{text}</p>
      {body && <p className="nova-t-body mt-1 text-[var(--nova-ink-muted)]">{body}</p>}
    </div>
  );
}

/* ── DraftCard ──────────────────────────────────────────────────────────── */
export function DraftCard({ id, title, fields, primary, secondary, banner, category, onAsk, onConfirmed }: {
  id: string; title: string; fields: DraftField[]; primary: string; secondary: string;
  banner: BannerSpec; category?: string;
  onAsk: (q: string) => void; onConfirmed?: () => void;
}) {
  useTicketStore();
  const draft = getDraft(id);
  const p = useProposal(onConfirmed, { id });
  /* CATEGORY AND SUBCATEGORY live here, not in the draft store — this pass changes no store —
     and `create()` reads them, so correcting Nova's guess reaches the ticket it raises. */
  const [routing, setRouting] = useState<Record<string, string>>({});

  if (draft.createdRef || p.phase === 'done') {
    return <ConfirmBanner spec={banner} mutatedRef={draft.createdRef ?? p.ref} onAsk={onAsk} />;
  }
  if (draft.discarded || p.phase === 'discarded') return <DiscardedLine label="Draft discarded" />;

  const valueOf = (f: DraftField) =>
    (f.label === 'Subject' ? draft.subject : f.label === 'Priority' ? draft.priority : routing[f.label]) ?? f.value;

  /* WHAT COMMITTING A FIELD DOES. Subject and Priority are the draft store's, as they always
     were; anything else the script marks editable is the card's own. */
  const commitField = (f: DraftField) => (next: string) => {
    if (f.label === 'Subject') updateDraft(id, { subject: next });
    else if (f.label === 'Priority') updateDraft(id, { priority: next });
    else setRouting((m) => ({ ...m, [f.label]: next }));
  };

  const create = () => {
    const subject = valueOf(fields.find((f) => f.label === 'Subject') ?? { label: '', value: title });
    const priority = valueOf(fields.find((f) => f.label === 'Priority') ?? { label: '', value: 'Medium' });
    const rec = createTicket({
      title: subject, priority,
      /* The reader's correction, if they made one, is what the ticket is filed under. It is the
         ROUTING, not the assignee: nobody has picked it up yet, and saying a queue "has" it was
         the old card's own invention. */
      ...(routing.Category || category ? { category: routing.Category || category } : {}),
      ...(draft.linkedAsset ? { affectedAssets: [draft.linkedAsset] } : {}),
    });
    updateDraft(id, { createdRef: rec.ref });
    p.confirm(rec.ref);
  };
  p.register(create);

  return (
    <div className={CARD} data-draft-card>
      <p className="nova-card-head">{title}</p>
      <CardRows>
        {fields.map((f) => (
          /* A field the script marks editable is a PROPOSAL; one it does not is a FACT. Two of
             the four row kinds, chosen by the same flag that has always been there. */
          <CardRow
            key={f.label}
            kind={f.editable ? 'editable' : 'value'}
            label={f.label}
            value={valueOf(f)}
            editor={f.options ? 'select' : 'text'}
            options={f.options}
            inferred={f.inferred}
            /* The subject IS the ticket, the way a title is the document — same reason
               `valueOf` already knows this field by name. */
            strong={f.label === 'Subject'}
            onCommit={f.editable ? commitField(f) : undefined}
          />
        ))}
        {draft.linkedAsset && (
          <CardRow kind="value" label="Linked asset" value={draft.linkedAsset} rowId="linked-asset" />
        )}
      </CardRows>
      {/* THE FOOTER IS THE OTHER PERSONAS'. A requester's Create is the dock's option 1, and the
          Discard that sat beside it is gone with it: nothing has happened until Create runs, so
          there is nothing to undo. (Discard wrote `drafts[id].discarded`, which nothing but this
          card read — it kept the card discarded across a re-run, and that is all it did.) */}
      {!p.dock && (
        <div className="flex items-center gap-1.5 border-t border-[var(--nova-rule)] px-4 py-3">
          <button type="button" className={PRIMARY} onClick={create}>{primary}</button>
          <button type="button" className={GHOST} onClick={() => { updateDraft(id, { discarded: true }); p.discard(); }}>{secondary}</button>
        </div>
      )}
    </div>
  );
}

/* ── StatusCard ─────────────────────────────────────────────────────────── */
const STEPS = ['Logged', 'Assigned', 'In progress', 'Resolved'];
const stepOf = (t: MockTicket): number =>
  t.status === 'Resolved' || t.status === 'Closed' ? 3
    : t.status === 'In progress' || t.status === 'On hold' || t.status === 'Waiting on vendor' || t.status === 'Waiting on requester' ? 2
      : t.status === 'Pending approval' || t.status === 'Waiting on approval' ? 1 : 0;

/* THE REQUESTER'S STATUS ANSWER IS PROSE.
 *
 * "Where is my ticket" is a question with a three-sentence answer, and a card turned it into a
 * record to be inspected: a ref, a pill, a priority, a stepper, a quoted note and a footer, for
 * three facts. These are those three facts, on the drawer background, aligned to the same left
 * edge as every other answer body.
 *
 * THE STEPPER GOES WITH IT. It drew Logged → Assigned → In progress → Resolved and
 * mapped every real status onto one of those four, so a deployment's own statuses had nowhere to
 * sit. The trail renders the store's history verbatim - "Vendor engaged", "Awaiting parts" and
 * anything else need no code here at all. */

/** The status history, in order, already capped by statusSentences. The separator is decoration
 *  and wears the decoration tier; the last step is where the ticket actually is. */
function StatusTrail({ steps: shown }: { steps: string[] }) {
  return (
    <span data-status-trail>
      {shown.map((step, i) => (
        <span key={`${step}-${i}`}>
          {i > 0 && <span className="nova-trail-sep" aria-hidden="true">›</span>}
          <span className={i === shown.length - 1 ? 'nova-trail-now' : 'nova-trail-past'}>{step}</span>
        </span>
      ))}
    </span>
  );
}

/** A line is a bold lead-in, an em dash, then the rest. Split on the FIRST dash only: a note's
 *  own text may contain one, and it belongs to the quote, not to the label. */
function Lead({ text }: { text: string }) {
  const i = text.indexOf(' — ');
  if (i < 0) return <>{text}</>;
  return <><span className="nova-status-lead">{text.slice(0, i)}</span>{text.slice(i)}</>;
}

export function StatusText({ ticket: t, lead, onAsk }: {
  ticket: MockTicket;
  /** This block IS the turn's conclusion, so it carries the headline. False when the script
   *  authored one of its own - two tickets in one turn, or a framing line the state cannot
   *  give ("the messaging team wants you to confirm the fix"). */
  lead?: boolean;
  onAsk: (q: string) => void;
}) {
  /* The sentences come from statusSentences, which the clipboard reads too. */
  const s = statusSentences(t);

  return (
    <div data-status-text>
      {lead && (
        <p className="nova-headline" tabIndex={-1}>{s.headline}</p>
      )}
      <div className="nova-status-lines">
        <p className="nova-t-body" data-status-line="status">
          <span className="nova-status-lead">Status</span> —{' '}
          <button
            type="button"
            className="nova-btn nova-ref nova-ref-btn"
            data-in-element="row"
            data-ref={t.ref}
            onClick={() => onAsk(`What's happening with ${t.ref}?`)}
          >{t.ref}</button>
          {s.afterRef}{' '}
          <StatusTrail steps={s.trail} />
        </p>
        <p className="nova-t-body" data-status-line="note">
          <Lead text={s.note} />
        </p>
        <p className="nova-t-body" data-status-line="next">
          <Lead text={s.next} />
        </p>
      </div>
    </div>
  );
}

/** WHO IS READING decides which one renders. The dock context is present only in a requester
 *  turn - the same test StatusCard already used to decide whether to draw its own footer. */
function StatusBlock({ ticket, actions, lead, onAsk }: {
  ticket: MockTicket;
  actions?: Array<{ label: string; ask?: string }>;
  lead?: boolean;
  onAsk: (q: string) => void;
}) {
  const dock = useRequesterDock();
  return dock
    ? <StatusText ticket={ticket} lead={lead} onAsk={onAsk} />
    : <StatusCard ticket={ticket} actions={actions} onAsk={onAsk} />;
}

export function StatusCard({ ticket, actions, onAsk }: {
  ticket: MockTicket;
  actions?: Array<{ label: string; ask?: string }>;
  onAsk: (q: string) => void;
}) {
  const cur = stepOf(ticket);
  const note = ticket.notes.length ? ticket.notes[ticket.notes.length - 1].text : ticket.latestNote;
  /* A requester's "Add a comment" is the dock's; the card only says where the ticket stands. */
  const dock = useRequesterDock();
  const shown = dock ? [] : (actions ?? []);
  return (
    <div className={CARD} data-status-card>
      <div className="px-4 py-3">
        <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="nova-t-label">{ticket.ref}</span>
          {ticket.tech && ticket.priority && <PriorityPill p={ticket.priority} />}
          <span className="nova-t-body ask-w-500 text-[var(--nova-ink)]">{ticket.title}</span>
          {/* The status wears its family — a parked ticket and a resolved one no longer look
              alike at a glance. The word is always there; the colour is never the only signal. */}
          <span className="ml-auto" data-status-pill>
            <NovaChip family={statusFamily(ticket.status)} size="sm">{ticket.status}</NovaChip>
          </span>
        </p>
        <p className="nova-t-meta mt-1.5">
          With {ticket.assignee}{ticket.owner ? ` · owner ${ticket.owner}` : ''} · updated {ticket.lastUpdate}
          {ticket.nextUpdate && ` · next update ${ticket.nextUpdate}`}
          {ticket.slaPaused && ' · SLA clock paused'}
          {ticket.vendorRef && ` · vendor ref ${ticket.vendorRef}`}
          {ticket.reminderAt && ` · reminder ${ticket.reminderAt}`}
        </p>
        {/* The stepper — where this sits on its way to fixed. */}
        <div className="mt-3 flex items-center" aria-label={`Progress: ${STEPS[cur]}`} role="img">
          {STEPS.map((s, i) => (
            <div key={s} className="flex flex-1 flex-col items-start">
              <div className="flex w-full items-center">
                <span
                  aria-hidden="true"
                  className={`size-[10px] flex-shrink-0 rounded-full border-2 ${
                    i < cur ? 'border-[var(--nova-action)] bg-[var(--nova-action)]'
                      : i === cur ? 'border-[var(--nova-action)] bg-white'
                        : 'border-[var(--nova-border)] bg-white'}`}
                />
                {i < STEPS.length - 1 && (
                  <span aria-hidden="true" className={`mx-1 h-[2px] flex-1 rounded ${i < cur ? 'bg-[var(--nova-action)]' : 'bg-[var(--nova-border)]'}`} />
                )}
              </div>
              <span className={`mt-1 ask-text-sm ${i === cur ? 'ask-w-500 text-[var(--nova-ink)]' : 'text-[var(--nova-ink-faint)]'}`}>{s}</span>
            </div>
          ))}
        </div>
        {note && (
          <p className="nova-t-body mt-3 border-l-2 border-[var(--nova-rule)] pl-3 text-[var(--nova-ink-muted)]" data-latest-note>
            “{note}”
          </p>
        )}
      </div>
      {shown.length > 0 && (
        <div className="flex flex-wrap gap-1.5 border-t border-[var(--nova-rule)] px-4 py-2.5">
          {shown.map((x) => (
            <button key={x.label} type="button" className={QUIET}
              onClick={() => { if (x.ask) onAsk(x.ask); }}
            >{x.label}</button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── DiffCard ───────────────────────────────────────────────────────────── */
type DiffMutation = Extract<RequesterBlock, { w: 'diff' }>['mutation'];

/* WHAT THE AFTER COLUMN IS AFTER — declared per mutation, because the mutation IS the card's
   primary action. Reading it off the button's label would print "AFTER RAISE TO HIGH ANYWAY";
   reading it off a row's label would print "AFTER PRIORITY". Both are the same mistake: the
   header names the act, and only the card knows what act it performs. */
const AFTER_VERB: Record<DiffMutation, string> = {
  escalate: 'After escalation',
  reopen: 'After reopen',
  'raise-priority': 'After raising',
  'raise-prb': 'After raising',
  'notify-owners': 'After notifying',
  'append-draft': 'After adding',
  remind: 'After the reminder',
};

export function DiffCard({ id, title, rows, why, whyEditable, primary, secondary, banner, mutation, refId, refs, draftId, sentence, onAsk, onConfirmed }: {
  id: string; title: string; rows: DiffRow[]; why: string; whyEditable?: boolean; primary: string; secondary: string;
  banner: BannerSpec; mutation: DiffMutation;
  refId: string; refs?: string[]; draftId?: string; sentence?: string;
  onAsk: (q: string) => void; onConfirmed?: () => void;
}) {
  const p = useProposal(onConfirmed, { id });
  /* WHAT THE READER DECIDED, keyed by row label. The card used to show a proposal and then apply
     the script's values whatever the screen said; now the screen is the source. Card-local — no
     store changes in this pass. */
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [whyText, setWhyText] = useState(why);
  const rowValue = (r: DiffRow) => edits[r.label] ?? r.to;
  const byLabel = (re: RegExp) => {
    const r = rows.find((x) => re.test(x.label));
    return r ? rowValue(r) : undefined;
  };
  /* IN A TECHNICIAN TURN the action is attached under the turn and reads the card as it stands —
     the sentence to append, the follow-up the reader chose. */
  useTurnInputs(id, () => ({
    ref: refId, refs, draftId, sentence,
    when: byLabel(/follow|remind/i) ?? 'tomorrow 10:00',
  }));
  if (p.phase === 'done') return <ConfirmBanner spec={banner} mutatedRef={p.ref} onAsk={onAsk} />;
  /* Under the dock a declined proposal keeps its card — the chosen line beneath the answer is
     the record of the decision, and the card stays as what was decided against. */
  if (p.phase === 'discarded' && !p.dock) return <DiscardedLine label={secondary} />;

  const run = () => {
    if (mutation === 'escalate') { escalate(refId); p.confirm(refId); return; }
    if (mutation === 'reopen') { updateTicket(refId, { status: 'Open' }); p.confirm(refId); return; }
    if (mutation === 'raise-prb') {
      /* refId carries the problem title; the linked-ticket count is the second row's target. */
      const linked = parseInt(String(byLabel(/linked/i) ?? '0'), 10) || 0;
      const owner = byLabel(/owner/i) ?? 'Service Desk';
      const rec = createProblem({ title: refId, linkedTickets: linked, owner });
      p.confirm(rec.ref);
      return;
    }
    if (mutation === 'notify-owners') {
      (refs ?? [refId]).forEach((r) => addNote(r, 'Owner notified: regulatory reporting deadline.'));
      p.confirm(String((refs ?? [refId]).length));
      return;
    }
    /* ── the two a technician script still previews as a diff ──────────────
       `start`, `assign` and `chase-refs` were here too. They are ACTIONS now — attached under
       the turn and performed by the reply's stream (tech/mutations.ts) — so the card that used
       to apply them no longer exists. */
    if (mutation === 'append-draft') {
      if (draftId && sentence) updateDraft(draftId, { appended: sentence });
      p.confirm(refId);
      return;
    }
    if (mutation === 'remind') {
      const when = byLabel(/follow|remind/i) ?? 'tomorrow 10:00';
      addReminder(refId, when);
      p.confirm(refId);
      return;
    }
    updateTicket(refId, { priority: 'High' });
    p.confirm(refId);
  };
  p.register(run);

  return (
    <div className={CARD} data-diff-card>
      <p className="nova-card-head">{title}</p>
      <CardRows after={AFTER_VERB[mutation]}>
        {rows.map((r) => <DiffRowCells key={r.label} row={r} value={rowValue(r)} onCommit={setEdits} />)}
        {/* THE REASON, when it is the reader's to give. On a reopen they are the one who knows
            why; on an escalation it is Nova's justification, and stays the line below. */}
        {whyEditable && (
          <CardRow kind="editable" label="Why" value={whyText} editor="text" onCommit={setWhyText} />
        )}
      </CardRows>
      {!whyEditable && (
        <p className="nova-t-meta border-t border-[var(--nova-rule)] px-4 py-2.5">Why: {why}</p>
      )}
      {!p.dock && (
        <div className="flex items-center gap-1.5 border-t border-[var(--nova-rule)] px-4 py-3">
          <button type="button" className={PRIMARY} onClick={run}>{primary}</button>
          <button type="button" className={GHOST} onClick={p.discard}>{secondary}</button>
        </div>
      )}
    </div>
  );
}

/* ── StepList ───────────────────────────────────────────────────────────── */
export function StepList({ steps, windows, mac, tickable, short, detail, variant }: {
  steps?: string[]; windows?: string[]; mac?: string[]; tickable?: boolean;
  short?: string[]; detail?: string;
  variant?: 'default' | 'short' | 'detail';
}) {
  const [platform, setPlatform] = useState<'windows' | 'mac'>('windows');
  const [ticked, setTicked] = useState<Set<number>>(new Set());
  const both = !!windows && !!mac;
  const list = variant === 'short' && short ? short
    : (both ? (platform === 'windows' ? windows! : mac!) : (steps ?? []));

  return (
    <div data-step-list data-variant={variant ?? 'default'}>
      {both && variant !== 'short' && (
        <div className="mb-2 inline-flex rounded border border-[var(--nova-rule)] p-0.5" role="tablist" aria-label="Platform">
          {(['windows', 'mac'] as const).map((pl) => (
            <button
              key={pl}
              type="button"
              role="tab"
              aria-selected={platform === pl}
              onClick={() => setPlatform(pl)}
              className={`nova-btn rounded px-2.5 py-1 ask-text-sm ${
                platform === pl ? 'bg-[var(--nova-surface-pressed)] ask-w-500 text-[var(--nova-ink)]' : 'text-[var(--nova-ink-muted)] hover:bg-[var(--nova-surface-hover)]'}`}
            >{pl === 'windows' ? 'Windows' : 'Mac'}</button>
          ))}
        </div>
      )}
      <ol className="space-y-1.5">
        {list.map((s, i) => (
          <li key={s} className="flex items-start gap-2.5">
            {tickable ? (
              <button
                type="button"
                role="checkbox"
                aria-checked={ticked.has(i)}
                aria-label={`Step ${i + 1} done`}
                onClick={() => setTicked((prev) => {
                  const n = new Set(prev);
                  if (n.has(i)) n.delete(i); else n.add(i);
                  return n;
                })}
                className={`nova-btn mt-[3px] flex size-4 flex-shrink-0 items-center justify-center rounded border ${
                  ticked.has(i) ? 'border-[var(--nova-action)] bg-[var(--nova-action)] text-white' : 'border-[var(--nova-g400)] bg-white hover:border-[var(--nova-border-strong)]'}`}
              >
                {ticked.has(i) && <Check size={11} aria-hidden="true" />}
              </button>
            ) : (
              <span className="w-4 flex-shrink-0 text-right ask-text-sm tabular-nums text-[var(--nova-ink-faint)]" aria-hidden="true">{i + 1}</span>
            )}
            <span className={`min-w-0 nova-t-body ${tickable && ticked.has(i) ? 'text-[var(--nova-ink-faint)] line-through' : 'text-[var(--nova-ink)]'}`}>
              {s}
            </span>
          </li>
        ))}
      </ol>
      {variant === 'detail' && detail && (
        <p className="nova-t-meta mt-2 border-l-2 border-[var(--nova-rule)] pl-3" data-step-detail>{detail}</p>
      )}
    </div>
  );
}

/* ── NoteComposer ───────────────────────────────────────────────────────── */
type NoteBlock = Extract<RequesterBlock, { w: 'note' }>;

export function NoteComposer({ id, refId, prefill, title, primary, secondary, banner, changes, close, outbox, tones, tone: defaultTone, draftId, external, chase: isChase, awaits, target, to, jargon, focusSignal, preview, toneSignal, onAsk, onConfirmed }: {
  id: string; refId: string; prefill: string; title?: string; primary: string; secondary: string;
  banner: BannerSpec; changes?: Array<DiffRow & { patch?: 'assets' }>;
  /** Sending it moves the ticket to Waiting on requester — read by the attached action. */
  awaits?: boolean;
  /** A resolution note — confirming also closes the ticket. */
  close?: boolean;
  /** A draft for someone outside the ticket system — saved to the outbox, no ticket touched. */
  outbox?: boolean;
  /* ── technician ───────────────────────────────────────────────────── */
  tones?: NoteBlock['tones']; tone?: Tone; draftId?: string; external?: boolean; chase?: boolean;
  target?: 'handover'; to?: string; jargon?: JargonPair[];
  /** Bumped by the ••• "Edit note" — focuses the textarea. */
  focusSignal?: number;
  /** The ••• "Show what the requester will see". */
  preview?: boolean;
  /** A chip's LOCAL tone switch (TEC-05 "Make it shorter") — a nonce plus the tone it asks for. */
  toneSignal?: { tone: Tone; nonce: number };
  onAsk: (q: string) => void; onConfirmed?: () => void;
}) {
  const store = useTicketStore();
  /* Present only in a requester turn - the same test every primitive here uses. */
  const dock = useRequesterDock();
  const draft = draftId ? getDraft(draftId) : {};
  const composed = draftId ? composeDraftText({ tones, tone: defaultTone, prefill, jargon }, draft) : null;
  const [local, setLocal] = useState(prefill);
  const text = composed ? composed.text : local;
  const tone: Tone = composed ? composed.tone : (defaultTone ?? 'formal');
  /* An empty note cannot be posted — the dock (or the attached action) shows its option
     disabled and says why. */
  const p = useProposal(onConfirmed, { id, canRun: !!text.trim(), why: 'The note is empty' });
  /* IN A TECHNICIAN TURN the send is attached under the turn, and reads the note AS IT STANDS. */
  useTurnInputs(id, () => ({ ref: refId, text, draftId, await: !!awaits }), !!text.trim(), 'The note is empty');
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  /* `focusSignal` is handed to the EditableValue below, which opens its own editor — the ref
     that used to focus a permanently-mounted textarea has nothing to point at now. */
  const [editSignal, setEditSignal] = useState(0);
  useEffect(() => {
    if (draftId && toneSignal?.nonce) updateDraft(draftId, { tone: toneSignal.tone, edited: undefined });
  }, [draftId, toneSignal?.nonce, toneSignal?.tone]);
  void store;

  if (p.phase === 'done') return <ConfirmBanner spec={banner} mutatedRef={p.ref} onAsk={onAsk} />;
  if (p.phase === 'discarded') return <DiscardedLine label={secondary} />;

  const setText = (v: string) => {
    if (draftId) updateDraft(draftId, { edited: v.replace(draft.appended ? ` ${draft.appended}` : '', '') });
    else setLocal(v);
  };
  const run = () => {
    if (outbox) { toast('Draft saved to outbox'); p.confirm(refId); return; }
    if (target === 'handover') { if (draftId) updateDraft(draftId, { note: text }); p.confirm(refId); return; }
    if (isChase) { chase(refId, text); p.confirm(refId); return; }
    /* A note the REQUESTER writes on their own ticket is one they can see - the flag means
       "visible to the requester", and theirs qualifies by definition. Read from the dock
       context, which exists only in a requester turn, so a technician's internal note stays
       internal. */
    addNote(refId, text, external || dock ? { external: true } : undefined);
    if (changes?.some((c) => c.patch === 'assets')) {
      updateTicket(refId, { affectedAssets: ['PRN-0311', 'PRN-0314'], affectedUsers: 2 });
    }
    if (close) closeTicket(refId, text);
    p.confirm(refId);
  };
  p.register(run);
  const secondaryClick = () => {
    if (secondary === 'Edit') { setEditSignal((n) => n + 1); return; }
    if (secondary === 'Save as draft') {
      if (draftId) updateDraft(draftId, { edited: text.replace(draft.appended ? ` ${draft.appended}` : '', '') });
      setSaved(true); window.setTimeout(() => setSaved(false), 1600);
      return;
    }
    p.discard();
  };

  return (
    <div className={CARD} data-note-composer data-tone={tones ? tone : undefined}>
      {(title || to) && (
        <p className="nova-t-label flex flex-wrap items-center gap-2 border-b border-[var(--nova-rule)] px-4 py-3">
          <span>{title ?? to}</span>
          {title && to && <span className="normal-case tracking-normal text-[var(--nova-ink-faint)]">· {to}</span>}
        </p>
      )}
      <div className="px-4 py-3">
        {tones && (
          <div className="mb-2">
            <ToneToggle tone={tone} custom={!!draft.edited} onChange={(t) => { if (draftId) updateDraft(draftId, { tone: t, edited: undefined }); }} />
          </div>
        )}
        {/* THE NOTE READS AS A NOTE, not as a form field. It was an always-open textarea —
            the only card whose resting state was an editor — which made a drafted paragraph
            look like something the reader was expected to fill in. Clicking it still opens the
            same field, in place; `focusSignal` (the ••• "Edit note") opens it too. */}
        <CardRows className="nova-rows-flush">
          <CardRow
            kind="note"
            label="Note"
            value={text}
            rows={tones ? 5 : 3}
            focusSignal={(focusSignal ?? 0) + editSignal}
            onCommit={setText}
          />
        </CardRows>
        {preview && (
          <div className="mt-2 rounded border border-[var(--nova-rule)] bg-white px-3 py-2" data-requester-preview>
            <p className="nova-t-label">What the requester will see</p>
            <p className="nova-t-meta mt-1">Re: {refId} — {refId ? (store.tickets.find((t) => t.ref === refId)?.title ?? '') : ''}</p>
            <p className="nova-t-body mt-1.5 whitespace-pre-line text-[var(--nova-ink)]">{text}</p>
          </div>
        )}
        {!!changes?.length && (
          <div className="mt-2" data-note-changes>
            <p className="nova-t-label">This update also changes</p>
            {/* WHAT ELSE THIS DOES — consequences of sending the note, not offers. Diff rows
                with no editor: two columns, and no pencil in either. */}
            <CardRows className="nova-rows-flush" after="After the update">
              {changes.map((c) => (
                <CardRow key={c.label} kind="diff" label={c.label} before={c.from} value={c.to} />
              ))}
            </CardRows>
          </div>
        )}
      </div>
      {!!jargon?.length && draftId && (
        <JargonCheck
          pairs={jargon}
          reverted={draft.reverted ?? []}
          onRevert={(term) => {
            const cur = draft.reverted ?? [];
            updateDraft(draftId, { reverted: cur.includes(term) ? cur.filter((x) => x !== term) : [...cur, term], edited: undefined });
          }}
        />
      )}
      {/* A requester's Post is the dock's option 1; the note's "Edit" was the pencil's job all
          along, and Discard undid nothing. The technician keeps the footer — tones, copy, save. */}
      {!p.dock && (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-[var(--nova-rule)] px-4 py-3">
          <button type="button" className={PRIMARY} disabled={!text.trim()} onClick={run}>{primary}</button>
          <button type="button" className={GHOST} onClick={secondaryClick}>{saved ? 'Draft saved' : secondary}</button>
          {tones && (
            <button type="button" className={QUIET} data-copy-note onClick={async () => {
              try { await navigator.clipboard?.writeText(text); } catch { /* denied */ }
              setCopied(true); window.setTimeout(() => setCopied(false), 1600);
            }}>{copied ? 'Copied' : 'Copy'}</button>
          )}
        </div>
      )}
    </div>
  );
}

/* ── recency ────────────────────────────────────────────── */
const recency = (t: MockTicket): number =>
  t.lastUpdate === 'just now' ? 0
    : /hour/.test(t.lastUpdate) ? 1
      : /day/.test(t.lastUpdate) ? 2 + (parseInt(t.lastUpdate, 10) || 0) / 100 : 9;

/* == REQ-06 - WHAT IS STILL OUTSTANDING ======================================================
 *
 * TWO TURNS. The first answers the question - how many, and is any of them yours to move. The
 * second enumerates, and only when asked for. A list of five rows was never the answer to "what
 * is still open for me"; it was the raw material for one.
 *
 * ONE GROUPING CALL. `unresolvedSummary` runs `groupByStatus` once and everything on screen -
 * the big number, the sub-line, every bar segment, every legend count - renders from that one
 * array in that one order. There is no second query that could disagree with the first.
 *
 * "UNRESOLVED", NOT "OPEN". `Open` is a status in this store. Using it as the umbrella word for
 * everything unfinished would make "5 open, 1 of them Open" a sentence someone had to write. */

/* Accent, then two lighter tints of it, then neutrals. Order, not hue, carries the ranking -
 * the biggest group is the strongest colour because it is first, and a legend entry names every
 * segment in words, so the colour is never the only thing saying which is which. */
const BAR_TINTS = ['var(--nova-accent)', 'var(--ng-blue-40)', 'var(--ng-blue-20)', 'var(--nova-g500)', 'var(--nova-g400)'];
const tintOf = (i: number) => BAR_TINTS[Math.min(i, BAR_TINTS.length - 1)];

/** A line with a clickable reference inside it. */
function TokenLine({ parts, onAsk }: { parts: Token[]; onAsk: (q: string) => void }) {
  return (
    <>
      {parts.map((p, i) => (p.t === 'ref'
        ? (
          <button
            key={`${p.v}-${i}`}
            type="button"
            className="nova-btn nova-ref nova-ref-btn"
            data-in-element="row"
            data-ref={p.v}
            onClick={() => onAsk(`What's happening with ${p.v}?`)}
          >{p.v}</button>
        )
        : <span key={`t-${i}`}>{p.v}</span>))}
    </>
  );
}

export function SummaryCard({ summary: u, lead, onAsk }: {
  summary: UnresolvedSummary;
  /** This block is the turn's conclusion, so it carries the headline. */
  lead?: boolean;
  onAsk: (q: string) => void;
}) {
  if (u.total === 0) {
    /* Nothing outstanding: the headline IS the whole answer, and a card of zeroes would be
       ceremony around an empty set. */
    return lead ? <p className="nova-headline" tabIndex={-1} data-summary-empty>{u.headline}</p> : null;
  }
  return (
    <div data-summary-turn>
      {lead && <p className="nova-headline" tabIndex={-1}>{u.headline}</p>}
      <div className="nova-summary" data-summary-card>
        <div className="nova-summary-top">
          <p className="nova-summary-count">
            <span className="nova-summary-n">{u.total}</span>
            <span className="nova-summary-unit">unresolved</span>
          </p>
          <p className="nova-summary-sub" data-summary-sub>{u.subline}</p>
        </div>
        <div className="nova-summary-bottom">
          <p className="nova-summary-label">By status</p>
          {/* The bar is a picture of the same array the legend names; it carries no information
              the legend does not, which is why it needs no interaction. */}
          <span className="nova-summary-bar" role="img" data-summary-bar
            aria-label={u.groups.map((g) => `${g.status} ${g.count}`).join(', ')}
          >
            {u.groups.map((g, i) => (
              <span key={g.status} data-segment={g.status}
                style={{ flexGrow: g.count, background: tintOf(i) }} />
            ))}
          </span>
          <p className="nova-summary-legend" data-summary-legend>
            {u.groups.map((g, i) => (
              <span key={g.status} className="nova-summary-key" data-legend-key={g.status}>
                <span className="nova-summary-swatch" style={{ background: tintOf(i) }} aria-hidden="true" />
                {g.status}<b>{g.count}</b>
              </span>
            ))}
          </p>
        </div>
      </div>
      {!!u.insight.length && (
        <p className="nova-t-body nova-summary-insight" data-summary-insight>
          <TokenLine parts={u.insight} onAsk={onAsk} />
        </p>
      )}
    </div>
  );
}

/** TURN 2. One card per ticket: what it is, when it was raised, and whether it wants the reader.
 *  No status pill, no assignee, no priority - the summary above already said the shape of it,
 *  and a card that repeats it is a card nobody finishes reading. */
export function TicketCardList({ lead, onAsk }: { lead?: boolean; onAsk: (q: string) => void }) {
  useTicketStore();
  const rows = sortForReader(listOpenForUser())
    .sort((a, b) => (a.needsYou === b.needsYou ? recency(a) - recency(b) : a.needsYou ? -1 : 1));
  const head = rows.length === 1 ? 'Your one unresolved ticket' : `Your ${numberWord(rows.length)} unresolved tickets`;
  return (
    <div data-ticket-cards>
      {lead && <p className="nova-headline" tabIndex={-1}>{head}</p>}
      <div className="nova-tcards">
        {rows.map((t) => (
          <button
            key={t.ref}
            type="button"
            className="nova-btn nova-tcard"
            /* A TARGET, not a forward action: clicking it opens the ticket, the same category
               as the list row it replaces. The guard is right to ask. */
            data-in-element="row"
            data-ticket-card={t.ref}
            data-needs-you={t.needsYou ? 'true' : undefined}
            onClick={() => onAsk(`What's happening with ${t.ref}?`)}
          >
            <span className="nova-tcard-body">
              {/* NEVER TRUNCATED. The title is the only thing on the card that says what the
                  ticket IS; an ellipsis here costs the reader the whole row. */}
              <span className="nova-tcard-title">{t.title}</span>
              <span className="nova-tcard-meta">
                <span className="nova-ref">{t.ref}</span>
                <span>{raisedLine(t)}</span>
                {t.needsYou && <span className="nova-tcard-tag">Needs you</span>}
              </span>
            </span>
            <ChevronRight size={13} aria-hidden="true" className="nova-tcard-chev" />
          </button>
        ))}
      </div>
    </div>
  );
}

export function AgeLine({ open, typical }: { open: string; typical: string }) {
  /* ONE SENTENCE, where there used to be two bars on a shared scale.
     The bars were a real graphic — a full-width bar beside a 4% one said "far longer than it
     should be" before a word was read — but they were the FIRST thing under the headline, so
     the answer opened on a diagram, and the sentence underneath then said the same thing in
     words. A line says it once, in the register the rest of the answer is written in.

     Only the number wears the warning colour. The norm beside it is ordinary text: it is the
     thing being compared against, not the thing that is wrong. */
  return (
    <p className="nova-t-body" data-age-line>
      Open for <span className="nova-age-long">{open}</span>. Tickets like this usually resolve in {typical}.
    </p>
  );
}

/* ── ResolutionNote ─────────────────────────────────────────────────────── */
export function ResolutionNote({ ticket, action, onAsk }: {
  ticket: MockTicket;
  action?: { label: string; ask: string };
  onAsk: (q: string) => void;
}) {
  /* "Reopen if it's happening again" is a forward action — the dock's, in a requester turn. */
  const dock = useRequesterDock();
  return (
    <div className="border-l-2 border-[var(--nova-rule)] pl-3" data-resolution-note>
      <p className="nova-t-meta">Resolved by {ticket.resolvedBy ?? ticket.assignee} · {ticket.resolvedAgo}</p>
      <p className="nova-t-body mt-0.5 text-[var(--nova-ink)]">{ticket.resolution}</p>
      {action && !dock && (
        <button type="button" className="nova-btn nova-hit nova-tertiary mt-1.5 -ml-1" onClick={() => onAsk(action.ask)}>
          {action.label}
        </button>
      )}
    </div>
  );
}

/* ── the small one-offs that are still shared shapes ────────────────────── */
function Timeline({ steps, footer }: { steps: Array<{ label: string; note: string }>; footer: string }) {
  return (
    <div data-timeline>
      <ol className="space-y-2">
        {steps.map((s, i) => (
          <li key={s.label} className="flex items-start gap-2.5">
            <span className="mt-[2px] flex size-5 flex-shrink-0 items-center justify-center rounded-full bg-[var(--nova-surface-pressed)] ask-text-sm text-[var(--nova-text-secondary)]" aria-hidden="true">{i + 1}</span>
            <span className="min-w-0">
              <span className="nova-t-body ask-w-500 text-[var(--nova-ink)]">{s.label}</span>
              <span className="nova-t-meta ml-2">{s.note}</span>
            </span>
          </li>
        ))}
      </ol>
      <p className="nova-t-meta mt-2">{footer}</p>
    </div>
  );
}

function AssetPicker({ id, prompt, options, confirm, draftId, banner, onAsk, onConfirmed }: {
  id: string; prompt: string; options: string[]; confirm: string; draftId: string; banner: BannerSpec;
  onAsk: (q: string) => void; onConfirmed?: () => void;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  const p = useProposal(onConfirmed, { id, canRun: !!picked, why: 'Pick a dock first' });
  const link = () => {
    const asset = picked!.split(' ')[0];
    updateDraft(draftId, { linkedAsset: asset });
    p.confirm(asset);
  };
  p.register(link);
  if (p.phase === 'done') return <ConfirmBanner spec={banner} mutatedRef={p.ref} onAsk={onAsk} />;
  return (
    <div className={CARD} data-asset-picker>
      <p className="nova-card-head">{prompt}</p>
      <ul className="px-4 py-1" role="radiogroup" aria-label={prompt}>
        {options.map((o, i) => (
          <li key={o} className={i > 0 ? 'border-t border-[var(--nova-rule)]' : ''}>
            <button
              type="button"
              role="radio"
              aria-checked={picked === o}
              onClick={() => setPicked(o)}
              className="nova-btn flex w-full items-center gap-2 py-2 text-left ask-text-base text-[var(--nova-ink)] hover:bg-[var(--nova-surface-hover)]"
            >
              <span aria-hidden="true" className={`size-[10px] flex-shrink-0 rounded-full border-2 ${picked === o ? 'border-[var(--nova-action)] bg-[var(--nova-action)]' : 'border-[var(--nova-g400)]'}`} />
              {o}
            </button>
          </li>
        ))}
      </ul>
      {!p.dock && (
        <div className="border-t border-[var(--nova-rule)] px-4 py-3">
          <button type="button" className={PRIMARY.replace('h-9', 'h-8')} disabled={!picked} onClick={link}>{confirm}</button>
        </div>
      )}
    </div>
  );
}

function TeamCard({ heading, members }: { heading: string; members: Array<{ name: string; onShift: boolean; load: string }> }) {
  return (
    <div className={CARD} data-team-card>
      <p className="nova-card-head">{heading}</p>
      <ul className="px-4 py-1">
        {members.map((m, i) => (
          <li key={m.name} className={`flex items-baseline gap-2 py-2 ${i > 0 ? 'border-t border-[var(--nova-rule)]' : ''}`}>
            <span aria-hidden="true" className={`size-2 flex-shrink-0 self-center rounded-full ${m.onShift ? 'bg-[var(--nova-success)]' : 'bg-[var(--nova-g400)]'}`} />
            <span className="nova-t-body text-[var(--nova-ink)]">{m.name}</span>
            <span className="nova-t-meta">{m.onShift ? 'on shift' : 'off shift'} · {m.load}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CloseList({ id, primary, banner, onAsk, onConfirmed }: {
  id: string; primary: string; banner: BannerSpec; onAsk: (q: string) => void; onConfirmed?: () => void;
}) {
  useTicketStore();
  const [sel, setSel] = useState<Set<string>>(new Set());
  const p = useProposal(onConfirmed, { id, canRun: sel.size > 0, why: 'Tick at least one request' });
  const closeSelected = () => {
    [...sel].forEach((ref) => closeTicket(ref, 'Closed by requester — confirmed fixed.'));
    p.confirm([...sel].join(', '));
  };
  p.register(closeSelected);
  if (p.phase === 'done') return <ConfirmBanner spec={banner} mutatedRef={p.ref} onAsk={onAsk} />;
  const rows = listOpenForUser().filter((t) => t.status === 'In progress');
  return (
    <div className={CARD} data-close-list>
      <ul className="px-4 py-1">
        {rows.map((t, i) => (
          <li key={t.ref} className={i > 0 ? 'border-t border-[var(--nova-rule)]' : ''}>
            <label className="flex cursor-pointer items-baseline gap-2.5 py-2">
              <input
                type="checkbox"
                checked={sel.has(t.ref)}
                onChange={() => setSel((prev) => {
                  const n = new Set(prev);
                  if (n.has(t.ref)) n.delete(t.ref); else n.add(t.ref);
                  return n;
                })}
                className="mt-[3px] size-4 self-start accent-[var(--nova-action)]"
              />
              <span className="nova-t-label">{t.ref}</span>
              <span className="nova-t-body text-[var(--nova-ink)]">{t.title}</span>
            </label>
          </li>
        ))}
      </ul>
      {!p.dock && (
        <div className="border-t border-[var(--nova-rule)] px-4 py-3">
          <button type="button" className={PRIMARY.replace('h-9', 'h-8')} disabled={!sel.size} onClick={closeSelected}>{primary}</button>
        </div>
      )}
    </div>
  );
}

/** THE GUARD. A requester card may not render a forward-action <button>: the dock holds every
 *  one of them. In-element controls are exempt by declaring what they are — a role of tab, radio
 *  or checkbox, or `data-in-element` on a control (a list row) that only navigates within its
 *  own element. Dev-time only; it throws, so a regression cannot ship quietly. */
export function assertNoForwardButtons(root: HTMLElement | null): void {
  if (!root) return;
  const stray = [...root.querySelectorAll('button')].filter((b) => {
    const role = b.getAttribute('role') ?? '';
    return !['tab', 'radio', 'checkbox'].includes(role) && !b.closest('[data-in-element]');
  });
  if (stray.length) {
    throw new Error(`A requester card rendered a <button> ("${(stray[0].textContent ?? '').trim().slice(0, 40)}") — forward actions belong in the Next-step dock`);
  }
}

/* ── the renderer — blocks in, primitives out ───────────────────────────── */
export function RequesterBlocks({ blocks, question, context, variants = {}, changed, headline, onAsk, onConfirmed, stepsVariant, tables }: {
  blocks: RequesterBlock[];
  /** What this turn's action changed — the `changed` block renders it. */
  changed?: ChangeResult;
  /** The answer's own headline, if the script authored one — a status block leading a turn
   *  without one supplies the conclusion itself. */
  headline?: string;
  /** The turn's own question — a `status` block whose ref is `$question` reads it from here. */
  question: string;
  /** The turn's context — a drill turn carries `filter.segment`. */
  context?: Record<string, unknown>;
  /** The ••• menu's in-place variants for THIS turn — shorter, technical, plain, closedToday,
   *  rank, fullQueue, fullLog, noReminder, preview, focusNote, kbOpen, tone. */
  variants?: Record<string, unknown>;
  onAsk: (q: string, context?: Record<string, unknown>) => void;
  /** The answer's MAIN proposal was confirmed — the parent swaps the chip set. */
  onConfirmed?: () => void;
  stepsVariant?: 'default' | 'short' | 'detail';
  /** The ••• "Show as table" — every ChartFrame in the turn renders its table. */
  tables?: boolean;
}) {
  const store = useTicketStore();
  const segment = (context?.filter as { segment?: string } | undefined)?.segment;
  /* THE GUARDS RUN AFTER EVERY RENDER of a requester or technician turn's blocks — a requester
     card may render no forward-action <button> at all, and a technician card only the ones on
     the allow-list. See assertNoForwardButtons / assertTechnicianButtons. */
  const dock = useRequesterDock();
  const tech = useTechTurn();
  const rootRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    if (dock) assertNoForwardButtons(rootRef.current);
    else if (tech) assertTechnicianButtons(rootRef.current);
  });
  /* Per-turn state the technician blocks share: the chip filter and the KB sheet. */
  const [filter, setFilter] = useState<string | null>(null);
  const [kbOpen, setKbOpen] = useState<string | null>(null);
  useEffect(() => { if (variants.kbOpen) setKbOpen(String(variants.kbOpen)); }, [variants.kbOpen, variants.kbNonce]);

  const resolveRef = (ref: string): string => {
    if (ref !== '$question') return ref;
    const m = question.match(/\b((?:INC|REQ|PRB|CHG|KB)-\d+)\b/i);
    if (m) return m[1].toUpperCase();
    /* A navigate option's reply has no question to read the ref from — "Show me the ticket"
       names nothing — so the dock carries it in the turn's context instead. */
    return typeof context?.ref === 'string' ? context.ref : '';
  };
  const ticket = (ref: string) => store.tickets.find((x) => x.ref === resolveRef(ref));

  return (
    <TechCtx.Provider value={{ onAsk, variants }}>
    <div ref={rootRef} className="space-y-4" style={{ marginTop: 12 }} data-requester-blocks>
      {blocks.map((b, i) => {
        const key = `b${i}`;
        switch (b.w) {
          case 'head': return <AnswerHead key={key} n={b.n} text={b.text} body={b.body} />;
          case 'confidence': return (
            <p key={key} className="nova-t-meta" data-confidence>{b.text}</p>
          );
          case 'draft': return (
            <DraftCard key={key} id={b.id} title={b.title} fields={b.fields} category={b.category}
              primary={b.primary} secondary={b.secondary} banner={b.banner}
              onAsk={onAsk} onConfirmed={onConfirmed} />
          );
          case 'status': {
            const t = ticket(b.ref);
            const ref = resolveRef(b.ref);
            /* THE BLOCK CARRIES THE CONCLUSION only when it leads a turn the script left
               unheadlined. Otherwise the authored headline is the conclusion and this renders
               the three lines beneath it. */
            return t
              ? <StatusBlock key={key} ticket={t} actions={b.actions} lead={i === 0 && !headline} onAsk={onAsk} />
              : <p key={key} className="nova-t-meta" data-status-missing>{ref || 'That ticket'} isn't in this demo's ticket store.</p>;
          }
          case 'diff': return (
            <DiffCard key={key} id={b.id} title={b.title} rows={b.rows} why={b.why} whyEditable={b.whyEditable}
              primary={b.primary} secondary={b.secondary} banner={b.banner}
              mutation={b.mutation} refId={resolveRef(b.ref)} refs={b.refs} draftId={b.draftId} sentence={b.sentence}
              onAsk={onAsk} onConfirmed={onConfirmed} />
          );
          case 'steps': return (
            <StepList key={key} steps={b.steps} windows={b.windows} mac={b.mac}
              tickable={b.tickable} short={b.short} detail={b.detail} variant={stepsVariant} />
          );
          case 'note': return (
            <NoteComposer key={key} id={b.id} refId={resolveRef(b.ref)} prefill={b.prefill} title={b.title}
              primary={b.primary} secondary={b.secondary} banner={b.banner} changes={b.changes}
              close={b.close} outbox={b.outbox}
              tones={b.tones} tone={b.tone} draftId={b.draftId} external={b.external} chase={b.chase}
              awaits={b.awaits} target={b.target} to={b.to} jargon={b.jargon}
              focusSignal={variants.focusNote as number | undefined}
              preview={!!variants.preview}
              toneSignal={variants.toneSignal as { tone: Tone; nonce: number } | undefined}
              onAsk={onAsk} onConfirmed={onConfirmed} />
          );
          case 'summary': return (
            <SummaryCard key={key} summary={unresolvedSummary(listOpenForUser())}
              lead={i === 0 && !headline} onAsk={onAsk} />
          );
          case 'ticketcards': return <TicketCardList key={key} lead={i === 0 && !headline} onAsk={onAsk} />;
          case 'shift': return <ShiftBrief key={key} lead={i === 0 && !headline} rest={b.rest} />;
          case 'prose': return <ProseLines key={key} lines={b.lines} onAsk={onAsk} />;
          case 'patternbrief': return <PatternBrief key={key} lead={i === 0 && !headline} />;
          case 'vendorbrief': return <VendorBriefBlock key={key} lead={i === 0 && !headline} />;
          case 'vendorcards': return <VendorCards key={key} />;
          case 'vendorstrip': return <VendorStrip key={key} />;
          case 'vendorrest': return <VendorRest key={key} />;
          case 'vendorgroups2': return <VendorGroupsBlock key={key} />;
          case 'chasepreview': return <ChasePreview key={key} id={b.id} />;
          case 'missingrefs': return <MissingRefs key={key} id={b.id} />;
          case 'matchcards': return <MatchCards key={key} />;
          case 'recurrence': return <RecurrenceStrip key={key} />;
          case 'resolvedcases': return <ResolvedCases key={key} />;
          case 'incbrief': return (
            <IncidentBriefBlock key={key} refId={resolveRef(b.ref)} sayThis={b.sayThis} lead={i === 0 && !headline} />
          );
          case 'draftblk': return (
            <DraftBlock key={key} id={b.id} refId={resolveRef(b.ref)} label={b.label}
              tones={b.tones} tone={b.tone} prefill={b.prefill} jargon={b.jargon} draftId={b.draftId}
              awaits={b.awaits} />
          );
          case 'ageline': return <AgeLine key={key} open={b.open} typical={b.typical} />;
          case 'resolution': {
            const t = store.tickets.find((x) => x.ref === b.ref);
            return t ? <ResolutionNote key={key} ticket={t} action={b.action} onAsk={onAsk} /> : null;
          }
          case 'timeline': return <Timeline key={key} steps={b.steps} footer={b.footer} />;
          case 'picker': return (
            <AssetPicker key={key} id={b.id} prompt={b.prompt} options={b.options} confirm={b.confirm}
              draftId={b.draftId} banner={b.banner} onAsk={onAsk} onConfirmed={onConfirmed} />
          );
          case 'team': return <TeamCard key={key} heading={b.heading} members={b.members} />;
          case 'closelist': return (
            <CloseList key={key} id={b.id} primary={b.primary} banner={b.banner} onAsk={onAsk} onConfirmed={onConfirmed} />
          );
          /* ── leadership ─────────────────────────────────────────────── */
          case 'kpis': return <KpiStrip key={key} items={kpisFor(b.set, segment)} />;
          case 'callout': return <Callout key={key} text={b.text} />;
          case 'chart': return (
            <ChartFrame key={key} block={b} segment={segment} forceTable={tables} onAsk={onAsk}
              compact={b.compact} onPickRef={(ref) => openRef(onAsk, ref)} />
          );
          case 'incidents': return <IncidentCards key={key} />;
          case 'problems': return <ProblemCards key={key} onAsk={onAsk} />;
          case 'incident-detail': return <IncidentDetail key={key} id={b.id} />;
          /* ── technician ─────────────────────────────────────────────── */
          /* NO ACTION LISTS HERE. Every technician card's forward action is attached under the
             TURN (tech/AttachedActions.tsx); a card collects the inputs and renders no button. */
          case 'techchips': return <TechStatChips key={key} set={b.set} active={filter} onPick={setFilter} />;
          case 'queue': return (
            <QueueList key={key} top={b.top ?? 3} why={b.why} full={!!variants.fullQueue}
              rank={(variants.rank as 'triage' | 'sla' | 'priority') ?? 'triage'} filter={filter} onAsk={onAsk} />
          );
          case 'brief': return (
            <BriefCard key={key} refId={b.ref} to={b.to} what={b.what} impact={b.impact} status={b.status}
              sayThis={b.sayThis} short={b.short} shorter={!!variants.shorter} onAsk={onAsk} />
          );
          case 'inctimeline': {
            const t = ticket(b.ref);
            return t ? <IncidentTimeline key={key} ticket={t} fullLog={!!variants.fullLog} onAsk={onAsk} /> : null;
          }
          case 'sla': {
            const t = ticket(b.ref);
            return t ? <SlaBlock key={key} ticket={t} label={b.label} /> : null;
          }
          case 'kb': {
            const id = resolveRef(b.id);
            return (
              <KbCard key={key} id={id} linked={b.linkKey ? getDraft(b.linkKey).linkedTicket : undefined}
                onOpen={() => setKbOpen(id)} onAsk={onAsk} />
            );
          }
          case 'linkpicker': return <LinkPicker key={key} options={b.options} onAsk={onAsk} />;
          case 'tickettable': return <TicketTable key={key} preset={b.preset} single={b.single} onAsk={onAsk} />;
          case 'hold': return (
            <HoldCard key={key} refId={b.ref} rows={b.rows} why={b.why} note={b.note} reminder={b.reminder}
              pendingReason={b.pendingReason} vendorRef={b.vendorRef} vendorRefUnverified={b.vendorRefUnverified}
              noReminder={!!variants.noReminder} focusSignal={variants.focusNote as number | undefined} />
          );
          case 'vendorlist': return <VendorGroups key={key} filter={filter} onAsk={onAsk} />;
          /* WHAT CHANGED — the rows come from the mutation's return value, never from a script. */
          case 'changed': return <ChangedCard key={key} changed={changed} next={b.next} nextFallback={b.nextFallback} onAsk={onAsk} />;
          case 'fieldsedit': return (
            <FieldsEditor key={key} id={b.id} title={b.title} rows={b.rows} note={b.note}
              noteFilled={b.noteFilled} refId={b.ref} />
          );
          case 'handover': return (
            <HandoverDoc key={key} id={b.id} closedToday={!!variants.closedToday} plain={!!variants.plain}
              shorter={!!variants.shorter} focusSection={filter} onAsk={onAsk} />
          );
          case 'changes': return <ChangesList key={key} rows={changeRows(b.set)} onAsk={onAsk} />;
          case 'people': {
            const t = ticket(b.ref);
            return t?.bridge ? <PeopleCard key={key} heading={b.heading} people={t.bridge.people} /> : null;
          }
          case 'updates': {
            const t = ticket(b.ref);
            return t ? <UpdatesLog key={key} ticket={t} onAsk={onAsk} /> : null;
          }
          default: return null;
        }
      })}
      {kbOpen && <KbSheet id={kbOpen} onClose={() => setKbOpen(null)} />}
    </div>
    </TechCtx.Provider>
  );
}

/* Kept for the technician table fallback — a DataTable of the store's vendor rows. */
export { DataTable, RefChip };
