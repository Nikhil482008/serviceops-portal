import {
  addEvent, addNote, addReminder, chase, durationLabel, getDraft, getKb, getTicket, linkTicket,
  listSimilar, sendUpdate, setStatus, startTicket, subscribe, updateDraft, updateTicket,
  type MockTicket, type TicketStatus,
} from '../mockTickets';

/* THE TECHNICIAN'S MUTATIONS — named, and what each one reports back.
 *
 * ── A DO-ACTION IS A TURN ────────────────────────────────────────────────────────────────────
 * Clicking "Put INC-1062 on hold" appends the reader's turn and runs it through askNova like a
 * typed question. The reply is a WHAT-CHANGED turn, and the rows on its card are not authored:
 * they are derived here from the record BEFORE and AFTER the mutation ran. A script authors the
 * headline and the "what happens next" line; nothing else on that card is written by hand, so
 * the card cannot claim a change the store did not make.
 *
 * ── WHERE IT RUNS ────────────────────────────────────────────────────────────────────────────
 * In the stream, on a `mutate` beat — after the work feed's steps have shown what is being set
 * and before the answer lands. Not at click time: the feed says "Pausing the SLA clock" while
 * the clock is being paused, not after. The inputs (the hold as edited on the card, the note as
 * typed) travel in the turn's context from the card that collected them.
 *
 * ── THE RESULT IS DATA ───────────────────────────────────────────────────────────────────────
 * `kind` names what ran, `refs` names every ticket whose record changed (the stale marker on
 * earlier cards compares against these), `rows` / `groups` are the card, and `fill` carries the
 * few values a script's next-line may interpolate ("I'll remind you {{reminder}} to chase").
 */

export interface ChangedRow {
  label: string;
  /** The value before, for a state change — rendered "from → to". */
  from?: string;
  to: string;
  /** A trailing qualifier: "visible to requester", "not found in the TelcoNet feed". */
  detail?: string;
}
export interface ChangeGroup { ref: string; rows: ChangedRow[] }
export interface ChangeResult {
  kind: string;
  /** Ticket refs whose RECORD changed. A draft-only change names none. */
  refs: string[];
  rows?: ChangedRow[];
  /** One block per ticket, for a bulk action. */
  groups?: ChangeGroup[];
  /** Values the script's next-line may read. */
  fill?: Record<string, string>;
}
export type MutationInputs = Record<string, unknown>;
export interface MutationCall { name: string; inputs: MutationInputs }

const str = (v: unknown, d = ''): string => (typeof v === 'string' ? v : d);
const list = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
export const wordsOf = (n: number): string => WORDS[n] ?? String(n);

/** A vendor chase, worded from the record — the note every chase posts. */
export const chaseNote = (t: MockTicket): string =>
  `Chasing ${t.vendor} for an update on ${t.ref} (${t.title}).${t.vendorRef ? ` Your ref ${t.vendorRef}.` : ' No vendor reference on file — please advise one.'} Waiting ${t.waitingDays ?? 0} days; an ETA is needed today.`;

/** The KB's resolution as a note, and as a pattern note. */
export const kbResolutionNote = (kbId: string): string => {
  const kb = getKb(kbId);
  return kb ? `Resolution applied from ${kb.id} — ${kb.title}. ${kb.steps.join(' ')}` : `Resolution applied from ${kbId}.`;
};
export const patternNote = (kbId: string): string => {
  const kb = getKb(kbId);
  return kb ? `Pattern match: ${kb.linked.length} identical cases (${kb.linked.join(', ')}) — ${kb.title}. See ${kb.id}.` : `Pattern noted — see ${kbId}.`;
};

const slaRow = (t: MockTicket): ChangedRow => ({
  label: 'SLA',
  to: t.slaRemainingMin === undefined ? 'no clock'
    : t.slaPaused ? `${durationLabel(t.slaRemainingMin)}, paused`
      : `${durationLabel(t.slaRemainingMin)}, still running`,
});

const startOne = (ref: string): ChangeGroup | null => {
  const before = getTicket(ref);
  if (!before) return null;
  const was = before.status;
  const t = startTicket(ref)!;
  const rows: ChangedRow[] = [
    was === t.status ? { label: 'Status', to: t.status, detail: 'already' } : { label: 'Status', from: was, to: t.status },
    { label: 'Owner', to: 'you' },
    slaRow(t),
  ];
  if (t.regulatory) rows.push({ label: 'Regulatory reminder', to: 'set', detail: '30 min' });
  return { ref, rows };
};

export const MUTATIONS: Record<string, (inputs: MutationInputs) => ChangeResult> = {
  /* TEC-01 · start one or several. One ticket is a flat card; several are one group each. */
  start(inputs) {
    const refs = list(inputs.refs);
    const groups = refs.map(startOne).filter((g): g is ChangeGroup => !!g);
    return groups.length === 1
      ? { kind: 'start', refs: [groups[0].ref], rows: groups[0].rows }
      : { kind: 'start', refs: groups.map((g) => g.ref), groups };
  },

  /* TEC-02 · the talking line, sent to the person on the phone. */
  'send-update'(inputs) {
    const ref = str(inputs.ref); const to = str(inputs.to); const text = str(inputs.text);
    const t = sendUpdate(ref, to, text);
    if (!t) return { kind: 'send-update', refs: [] };
    return {
      kind: 'send-update', refs: [ref],
      rows: [
        { label: 'Update sent', to: `to ${to}` },
        { label: 'Note posted', to: `on ${ref}`, detail: 'visible to requester' },
      ],
    };
  },

  subscribe(inputs) {
    const ref = str(inputs.ref);
    const t = subscribe(ref);
    if (!t) return { kind: 'subscribe', refs: [] };
    return { kind: 'subscribe', refs: [ref], rows: [{ label: 'Updates', to: `You'll get updates on ${ref}`, detail: 'in-app and email' }] };
  },

  /* TEC-03 · link the pattern to the user's ticket. */
  link(inputs) {
    const ref = str(inputs.ref); const kbId = str(inputs.kb); const draftKey = str(inputs.draftKey);
    const t = linkTicket(ref, kbId);
    if (!t) return { kind: 'link', refs: [] };
    if (draftKey) updateDraft(draftKey, { linkedTicket: ref });
    const kb = getKb(kbId);
    const evidence = listSimilar(kb?.linked ?? []).length;
    return {
      kind: 'link', refs: [ref],
      rows: [
        { label: 'Linked', to: `to ${ref}` },
        { label: 'Evidence', to: `${evidence} similar incidents attached` },
        { label: 'Article', to: `${kbId} referenced` },
      ],
    };
  },

  'apply-kb'(inputs) {
    const ref = str(inputs.ref); const kbId = str(inputs.kb);
    const before = getTicket(ref);
    if (!before) return { kind: 'apply-kb', refs: [] };
    const was = before.status;
    const kb = getKb(kbId);
    addNote(ref, kbResolutionNote(kbId));
    const t = setStatus(ref, 'Pending user confirmation', { notifyRequester: true })!;
    return {
      kind: 'apply-kb', refs: [ref],
      rows: [
        { label: 'Resolution steps', to: `added (${kb?.steps.length ?? 0})` },
        { label: 'Status', from: was, to: t.status },
        { label: 'Requester', to: 'notified' },
      ],
    };
  },

  'note-kb'(inputs) {
    const ref = str(inputs.ref); const kbId = str(inputs.kb);
    const t = addNote(ref, patternNote(kbId));
    if (!t) return { kind: 'note-kb', refs: [] };
    return { kind: 'note-kb', refs: [ref], rows: [{ label: 'Note posted', to: `on ${ref}`, detail: 'internal' }] };
  },

  /* TEC-04 · the hold, the note and the reminder — one action, as the card showed it. */
  hold(inputs) {
    const ref = str(inputs.ref);
    const before = getTicket(ref);
    if (!before) return { kind: 'hold', refs: [] };
    const was = before.status;
    const status = str(inputs.status, 'On hold') as TicketStatus;
    const pendingReason = str(inputs.pendingReason);
    const vendorRef = str(inputs.vendorRef);
    const unverified = !!inputs.vendorRefUnverified;
    const note = str(inputs.note);
    const reminder = str(inputs.reminder);
    const t = setStatus(ref, status, { pendingReason, vendorRef, vendorRefUnverified: unverified, pauseSla: true })!;
    if (note) addNote(ref, note);
    if (reminder) addReminder(ref, reminder);
    const rows: ChangedRow[] = [
      { label: 'Status', from: was, to: t.status },
      { label: 'Pending reason', to: pendingReason || 'none' },
      { label: 'Vendor ref', to: vendorRef ? `${vendorRef} recorded` : 'none', detail: vendorRef && unverified ? 'not found in the TelcoNet feed' : undefined },
      { label: 'SLA clock', to: `paused at ${durationLabel(t.slaRemainingMin ?? 0)}` },
    ];
    if (reminder) rows.push({ label: 'Reminder', to: 'set', detail: reminder });
    if (note) rows.push({ label: 'Note', to: 'posted', detail: 'internal' });
    return { kind: 'hold', refs: [ref], rows, fill: reminder ? { reminder: `tomorrow at ${reminder.replace(/^tomorrow /, '')}` } : {} };
  },

  /* TEC-05, TEC-04 · a reply the requester sees. `await` moves the ticket to wait on them. */
  'send-reply'(inputs) {
    const ref = str(inputs.ref); const text = str(inputs.text);
    const before = getTicket(ref);
    if (!before) return { kind: 'send-reply', refs: [] };
    const was = before.status;
    addNote(ref, text, { external: true });
    const rows: ChangedRow[] = [
      { label: 'Reply', to: `posted on ${ref}`, detail: 'visible to requester' },
      /* WHICH WORDS WENT. The draft block offers three authored tones and lets the reader write
         their own; the record of what was sent should say which of those it was. */
      ...(inputs.tone ? [{ label: 'Tone', to: str(inputs.tone) }] : []),
      { label: 'Requester', to: 'notified by email' },
    ];
    if (inputs.await) {
      const t = setStatus(ref, 'Waiting on requester', { notifyRequester: true })!;
      rows.push({ label: 'Status', from: was, to: t.status });
    } else {
      updateTicket(ref, { requesterNotified: true });
    }
    return { kind: 'send-reply', refs: [ref], rows };
  },

  'save-draft'(inputs) {
    const ref = str(inputs.ref); const draftId = str(inputs.draftId); const text = str(inputs.text);
    if (draftId) updateDraft(draftId, { edited: text });
    return { kind: 'save-draft', refs: [], rows: [{ label: 'Draft', to: `saved on ${ref}` }] };
  },

  remind(inputs) {
    const ref = str(inputs.ref);
    const when = str(inputs.when, 'tomorrow 10:00');
    const t = addReminder(ref, when);
    if (!t) return { kind: 'remind', refs: [] };
    return { kind: 'remind', refs: [ref], rows: [{ label: 'Reminder', to: 'set', detail: when }], fill: { when } };
  },

  /* TEC-06 · chase several vendors at once. */
  chase(inputs) {
    const refs = list(inputs.refs);
    const rows: ChangedRow[] = [];
    const done: string[] = [];
    for (const ref of refs) {
      const before = getTicket(ref);
      if (!before) continue;
      const t = chase(ref, chaseNote(before))!;
      rows.push({ label: 'Chase sent', to: `to ${t.vendor}`, detail: ref });
      done.push(ref);
    }
    if (done.length) rows.push({ label: 'Last chased', to: done.length === 1 ? 'updated · today' : `updated on all ${wordsOf(done.length)}` });
    return { kind: 'chase', refs: done, rows };
  },

  /* TEC-04 · one chase, with the note as the reader left it. */
  'send-chase'(inputs) {
    const ref = str(inputs.ref); const text = str(inputs.text);
    const t = chase(ref, text);
    if (!t) return { kind: 'send-chase', refs: [] };
    return {
      kind: 'send-chase', refs: [ref],
      rows: [{ label: 'Chase sent', to: `to ${t.vendor ?? 'the vendor'}`, detail: ref }, { label: 'Last chased', to: 'updated · today' }],
    };
  },

  'append-draft'(inputs) {
    const ref = str(inputs.ref); const draftId = str(inputs.draftId); const sentence = str(inputs.sentence);
    if (draftId && sentence) updateDraft(draftId, { appended: sentence });
    return { kind: 'append-draft', refs: [], rows: [{ label: 'Draft', to: `updated on ${ref}`, detail: sentence ? `“${sentence}” added` : undefined }] };
  },

  'add-note'(inputs) {
    const ref = str(inputs.ref); const text = str(inputs.text);
    const t = addNote(ref, text);
    if (!t) return { kind: 'add-note', refs: [] };
    return { kind: 'add-note', refs: [ref], rows: [{ label: 'Note', to: `posted on ${ref}`, detail: 'internal' }] };
  },

  /* TEC-06 · the vendor refs the reader typed, recorded on each ticket. */
  'save-refs'(inputs) {
    const rows: ChangedRow[] = [];
    const done: string[] = [];
    for (const [ref, value] of typed(inputs)) {
      const t = updateTicket(ref, { vendorRef: value, vendorRefUnverified: false });
      if (!t) continue;
      rows.push({ label: 'Vendor ref', to: `recorded on ${ref}`, detail: value });
      done.push(ref);
    }
    return { kind: 'save-refs', refs: done, rows };
  },

  /* TEC-06 · the date a vendor PROMISED. Nothing else on this surface writes one, which is why
     the row's Set-ETA button is kept as a chip rather than deleted with the rest. */
  'set-eta'(inputs) {
    const rows: ChangedRow[] = [];
    const done: string[] = [];
    for (const [ref, value] of typed(inputs)) {
      const before = getTicket(ref);
      if (!before) continue;
      const was = before.eta;
      updateTicket(ref, { eta: value });
      rows.push(was ? { label: 'ETA', from: was, to: value, detail: ref } : { label: 'ETA', to: value, detail: ref });
      done.push(ref);
    }
    return { kind: 'set-eta', refs: done, rows };
  },

  /* TEC-02 · a mark on the incident timeline. Nothing else adds one, and the timeline still
     renders them as "added by you" — so this is kept as a chip too. */
  'add-event'(inputs) {
    const ref = str(inputs.ref);
    const vals = Object.fromEntries(typed(inputs));
    const time = (vals.time ?? '').trim();
    const label = (vals.label ?? '').trim();
    if (!ref || !/^\d{1,2}:\d{2}$/.test(time) || !label) {
      return { kind: 'add-event', refs: [], rows: [{ label: 'Nothing added', to: 'a time (HH:MM) and what happened are both needed' }] };
    }
    const t = addEvent(ref, time.padStart(5, '0'), label);
    if (!t) return { kind: 'add-event', refs: [] };
    return {
      kind: 'add-event', refs: [ref],
      rows: [{ label: 'Timeline', to: `${time} ${label}`, detail: `on ${ref}` }],
      fill: { time },
    };
  },
};

/** The non-empty fields of an editable turn, as [key, value]. */
function typed(inputs: MutationInputs): Array<[string, string]> {
  const vals = (inputs.values && typeof inputs.values === 'object' ? inputs.values : {}) as Record<string, unknown>;
  return Object.entries(vals).map(([k, v]) => [k, str(v).trim()] as [string, string]).filter(([, v]) => !!v);
}

/* ONCE PER TURN. A regenerated What-changed turn replays its stream, and replaying a chase
   would chase twice. The first run's result is kept by turn id and handed back on every replay,
   so the reply says what happened rather than doing it again. */
const results = new Map<string, ChangeResult>();

export function runMutationOnce(turnId: string | undefined, call: MutationCall): ChangeResult {
  const key = turnId ?? `${call.name}:${JSON.stringify(call.inputs)}`;
  const cached = results.get(key);
  if (cached) return cached;
  const fn = MUTATIONS[call.name];
  const res = fn ? fn(call.inputs) : { kind: call.name, refs: [] };
  results.set(key, res);
  return res;
}

/** For harnesses — the ticket store has a reset too. */
export function resetMutationCache(): void { results.clear(); }

/** Did a change of this kind, touching this ref (or any, when omitted), happen in these turns? */
export const changedIn = (
  turns: ReadonlyArray<{ answer: { changed?: ChangeResult } | null }>, kind: string, ref?: string,
): boolean => turns.some((t) => {
  const c = t.answer?.changed;
  return !!c && c.kind === kind && (!ref || c.refs.includes(ref));
});

/** The draft the reader is shaping, by key — re-exported so the selector reads it without
 *  reaching into the store module for one accessor. */
export { getDraft };
