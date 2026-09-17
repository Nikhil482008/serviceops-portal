import type { Turn } from '../turnModel';
import { scriptKeyOf } from '../dock/nextSteps';
import { proposalKey, type DockSnapshot } from '../dock/proposals';
import {
  CHASE_OVERDUE_DAYS, durationLabel, getKb, getTicket, listOpenAt, listQueue, listSimilar,
  listVendorPending, triageOrder, type MockTicket,
} from '../mockTickets';
import { openMatches, targetReason } from '../conversation/patternMatch';
import {
  BULK_PREVIEW_OVER, byUrgency, DRILL_FLAT_MAX, groupByVendor, isOverdue, listWords,
} from '../conversation/vendorWait';
import { changedIn, getDraft, wordsOf, type MutationInputs } from './mutations';
import type { DoIcon } from './icons';

/* WHAT A TECHNICIAN TURN OFFERS — a pure selector, per turn.
 *
 * ── ONE FUNCTION, NO STORED STATE ────────────────────────────────────────────────────────────
 * `techActionsFor(turn, conv, selection)` reads the turn, the conversation (which changes have
 * already happened), the proposal registry (which cards can run, and which have), the ticket
 * store (what is true of the tickets now) and the turn's selection, and returns the do-actions
 * attached under the turn and the ask-chips above the input. Nothing here remembers anything.
 *
 * ── THE RULES THE SETS FOLLOW ────────────────────────────────────────────────────────────────
 *   · one to three do-actions; exactly one recommended, first in the list
 *   · at most three ask-chips, at most one of them disabled
 *   · a do is executable NOW with what is on screen; an ask needs Nova to produce something first
 *   · the smart default is the single row that best matches the turn's ranking reason
 *   · a bulk action has a fixed target set; a selection-aware one relabels in place
 *   · remaining valid do-actions carry forward onto the reply
 * `finish` checks the first two in dev and complains rather than trusting each case.
 *
 * ── WHICH TURNS ──────────────────────────────────────────────────────────────────────────────
 * TEC-01 through TEC-06, their sub-scripts, and the ref / KB scripts a chip reaches. TEC-07 and
 * the legacy presentations (TEC-01/reveal, TEC-02/reveal, TEC-03/ask, TEC-07/plan) keep the
 * chips and card buttons they had.
 */

export type DoKind = 'mutate' | 'navigate';

export interface DoAction {
  id: string;
  label: string;
  /** A muted suffix after a middle dot. Never more than ~28 characters. */
  meta?: string;
  icon: DoIcon;
  kind: DoKind;
  recommended: boolean;
  disabled?: boolean;
  disabledReason?: string;
  /** The script that answers the reader's turn this action opens. */
  caseId: string;
  /** mutate — what runs on the reply's `mutate` beat: fixed inputs, or a card's registered
   *  inputs (`block`, on `onTurn`). */
  mutation?: { name: string; inputs?: MutationInputs; block?: string; onTurn?: string };
  /** navigate — the record the reply is about. */
  ref?: string;
  /** The reader's turn, when it differs from the button — a selection resolved to its refs. */
  said?: string;
}

export interface AskChip { label: string; disabled?: boolean }
export interface TechActionSet { dos: DoAction[]; asks: AskChip[] }

export interface TechConversation {
  turns: Turn[];
  proposals: DockSnapshot['proposals'];
}

/** The EARLIER technician presentations, kept reachable by their own phrasings. They are out of
 *  scope for this model and keep the chips and card buttons they had. */
const LEGACY = new Set(['TEC-01/reveal', 'TEC-02/reveal', 'TEC-03/ask', 'TEC-07/plan']);

/** The keys the action-as-turn model covers. */
export const isTechActionTurn = (key: string | undefined): boolean =>
  !!key && !LEGACY.has(key) && (/^TEC-0[1-6](\/|$)/.test(key) || key.startsWith('TEC/'));

const slug = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
const refIn = (q: string): string => q.match(/\b((?:INC|REQ|PRB|CHG|KB)-\d{3,5})\b/i)?.[1].toUpperCase() ?? '';

/** "40m to breach" / "2h 40m to breach" — the clock, short. Nothing for a paused or absent one. */
const breachIn = (t: MockTicket | undefined): string | undefined => {
  if (!t || t.slaRemainingMin === undefined || t.slaPaused) return undefined;
  const m = t.slaRemainingMin;
  return `${m < 60 ? `${m}m` : durationLabel(m)} to breach`;
};

export function techActionsFor(turn: Turn, conv: TechConversation, selection: readonly string[]): TechActionSet | null {
  const { turns, proposals } = conv;
  const key = scriptKeyOf(turn);
  if (!isTechActionTurn(key)) return null;
  const sel = [...selection];

  // ── readers ────────────────────────────────────────────────────────────────────────────
  const tk = (ref: string) => getTicket(ref);
  const lastTurn = (k: string): Turn | undefined => [...turns].reverse().find((x) => scriptKeyOf(x) === k);
  const before = (t: Turn): Turn[] => turns.slice(0, turns.findIndex((x) => x.id === t.id));
  /** A card's proposal record — its phase and whether it can run right now. */
  const rec = (t: Turn | undefined, blockId: string) => (t ? proposals.get(proposalKey(t.id, blockId)) : undefined);

  // ── option builders ───────────────────────────────────────────────────────────────────
  const open = (ref: string, meta?: string): DoAction => ({
    id: `open-${slug(ref)}`, label: `Open ${ref}`, meta, icon: 'open', kind: 'navigate', recommended: false,
    caseId: /^KB-/.test(ref) ? 'TEC/kb-open' : 'TEC/ref-open', ref,
  });
  const nav = (id: string, label: string, icon: DoIcon, caseId: string, meta?: string): DoAction =>
    ({ id, label, meta, icon, kind: 'navigate', recommended: false, caseId });
  const act = (id: string, label: string, icon: DoIcon, caseId: string, name: string, inputs: MutationInputs, x?: Partial<DoAction>): DoAction =>
    ({ id, label, icon, kind: 'mutate', recommended: false, caseId, mutation: { name, inputs }, ...x });
  /** A card's own inputs, as the reader left them. Disabled while the card says it cannot run. */
  const card = (t: Turn | undefined, blockId: string, id: string, label: string, icon: DoIcon, caseId: string, name: string, x?: Partial<DoAction>): DoAction | null => {
    if (!t) return null;
    const p = rec(t, blockId);
    return {
      id, label, icon, kind: 'mutate', recommended: false, caseId,
      mutation: { name, block: blockId, onTurn: t.id },
      disabled: !!p && !p.canRun, disabledReason: p?.why,
      ...x,
    };
  };
  const ask = (label: string): AskChip => ({ label });
  const demo = (label: string): AskChip => ({ label, disabled: true });
  const compact = (xs: Array<DoAction | null | false | undefined>): DoAction[] => xs.filter((x): x is DoAction => !!x);
  /** Recommend the first — the thing the turn was building toward. */
  const lead = (dos: DoAction[]): DoAction[] => dos.map((d, i) => ({ ...d, recommended: i === 0 }));

  // ══ TEC-01 · triage ═══════════════════════════════════════════════════════════════════════
  const tec01 = (): TechActionSet => {
    const queue = triageOrder(listQueue(), 'triage');
    const top3 = queue.slice(0, 3).map((t) => t.ref);
    const unstarted = top3.filter((r) => !tk(r)?.active);
    const pick = unstarted[0] ?? top3[0];
    /* THE SMART DEFAULT is the first row of the ranking — regulatory clock, then SLA clock, then
       priority — that has not been started; the selection replaces it. */
    const targets = sel.length ? sel : [pick];
    const dos = compact([
      unstarted.length > 0 && act('start', sel.length === 0 ? `Start ${pick} now` : sel.length === 1 ? `Start ${sel[0]}` : `Start ${sel.length} selected`,
        'start', 'TEC-01/started', 'start', { refs: targets },
        { meta: sel.length === 0 ? breachIn(tk(pick)) : undefined, said: sel.length ? `Start ${sel.join(', ')}` : `Start ${pick} now` }),
      unstarted.length > 1 && act('start-top', 'Start the top three', 'start', 'TEC-01/started3', 'start', { refs: unstarted }, { said: 'Start the top three' }),
      /* The only thing the turn holds back: the seven it did not show. */
      queue.length > 3 && nav('rest', `Show the other ${queue.length - 3}`, 'open', 'TEC-01/rest'),
    ]);
    /* NO ASKS. The Overnight line already answers "what happened overnight", and offering it as
       a question invites the reader to ask for what they have just been told. */
    return { dos: lead(dos), asks: [] };
  };
  const tec01After = (t: Turn): TechActionSet => {
    const queue = triageOrder(listQueue(), 'triage');
    const top3 = queue.slice(0, 3).map((x) => x.ref);
    const startedNow = t.answer?.changed?.refs ?? [];
    const first = startedNow[0] ?? top3[0];
    const remaining = top3.filter((r) => !tk(r)?.active);
    const dos = compact([
      open(first),
      remaining.length > 0 && act('start-rest', remaining.length === 1 ? `Start ${remaining[0]}` : `Start the other ${wordsOf(remaining.length)}`,
        'start', 'TEC-01/started', 'start', { refs: remaining },
        { said: remaining.length === 1 ? `Start ${remaining[0]}` : `Start the other ${wordsOf(remaining.length)}` }),
    ]);
    return { dos: lead(dos), asks: [] };
  };

  // ══ TEC-02 · brief ════════════════════════════════════════════════════════════════════════
  const tec02 = (k: string, t: Turn): TechActionSet => {
    const ref = 'INC-1088';
    const briefTurn = lastTurn('TEC-02');
    const sent = changedIn(turns, 'send-update', ref);
    const subscribed = !!tk(ref)?.subscribed;
    const send = !sent && card(briefTurn, 'brief', 'send-update', 'Send Sanjay this update', 'send', 'TEC-02/sent', 'send-update', { meta: 'uses “Say this”' });
    const sub = !subscribed && act('subscribe', `Subscribe me to ${ref} updates`, 'subscribe', 'TEC-02/subscribed', 'subscribe', { ref });
    /* After Subscribe the brief's own next step is the record; the update, if still unsent,
       carries beside it. */
    const dos = k === 'TEC-02/subscribed' ? compact([open(ref), send]) : compact([send, sub, open(ref)]);
    /* The editable turn's only do is its own commit. */
    if (k === 'TEC-02/event') {
      return {
        dos: lead(compact([card(t, 'event', 'add-event', 'Add it to the timeline', 'apply', 'TEC-02/event-added', 'add-event', { meta: 'marked as yours' })])),
        asks: [ask('Who is on the bridge call?')],
      };
    }
    return {
      dos: lead(dos),
      /* NO CHIPS ON THE BRIEF ITSELF. The turn is three sentences and a line to read out; a strip
         of questions under it competes with the one thing a technician with a client on the line
         is there for. "Add something to the timeline" - the kept behaviour from the action-as-turn
         pass - stays on the turns that FOLLOW, where there is room for it. */
      asks: k === 'TEC-02' ? []
        : [ask('Who is on the bridge call?'), ask('Add something to the timeline')],
    };
  };

  // ══ TEC-03 · diagnose ═════════════════════════════════════════════════════════════════════
  const KB = 'KB-0342';
  const tec03Linked = (ref: string): TechActionSet => {
    const applied = tk(ref)?.status === 'Pending user confirmation';
    const noted = changedIn(turns, 'note-kb', ref);
    const dos = applied ? [open(ref)] : compact([
      act('apply', `Apply ${KB} to ${ref}`, 'apply', 'TEC-03/applied', 'apply-kb', { ref, kb: KB }, { meta: 'sets resolution steps' }),
      !noted && act('note-kb', 'Add the recommendation as a note', 'send', 'TEC-03/noted', 'note-kb', { ref, kb: KB }),
      open(ref),
    ]);
    return { dos: lead(dos), asks: [ask('Is anyone else in Bengaluru hitting this now?')] };
  };
  const tec03 = (k: string): TechActionSet => {
    const linked = getDraft('tec03').linkedTicket;
    if (linked) return tec03Linked(linked);
    if (k === 'TEC-03/link' || k === 'TEC-03/others') {
      /* THE PICKER. Default = the candidate whose network matches the pattern's signature — the
         BLR wireless one — and the selection (a row, or a typed ref) replaces it. */
      const options = ['INC-1109', 'INC-1115'];
      const signature = options.find((r) => /BLR-\d/.test(tk(r)?.network ?? '')) ?? options[0];
      const target = sel[0] ?? (k === 'TEC-03/link' ? signature : '');
      const valid = /^(INC|REQ)-\d{3,5}$/.test(target) && !!tk(target);
      const dos = target
        ? [act('link', `Link ${target}`, 'link', 'TEC-03/linked', 'link', { ref: target, kb: KB, draftKey: 'tec03' },
          { disabled: !valid, disabledReason: `${target} is not in this demo's ticket store` })]
        : [nav('link-pick', 'Link to a ticket', 'link', 'TEC-03/link', 'needed before I can apply')];
      return { dos: lead(dos), asks: k === 'TEC-03/link' ? [ask('Is anyone else in Bengaluru hitting this now?')] : [demo('Raise a change to fix the lease')] };
    }
    /* THE CARDS ARE THE PICKER. Default = the newest open match; a selected card replaces it,
       two selected link both. The old "Link to a ticket" turn existed only to choose between two
       tickets that were already on screen. */
    const matches = openMatches(listOpenAt('Bengaluru', /vpn/i), 'Bengaluru', /vpn/i);
    const newest = matches[0]?.ref;
    const cases = listSimilar(getKb(KB)?.linked ?? []).filter((t) => t.status === 'Resolved' || t.status === 'Closed');
    const targets = sel.length ? sel : (newest ? [newest] : []);
    const label = sel.length === 0 ? `Link ${newest}` : sel.length === 1 ? `Link ${sel[0]}` : `Link ${sel.length} selected`;
    const dos = compact([
      targets.length > 0 && act('link', label, 'link', 'TEC-03/linked', 'link',
        { ref: targets[0], refs: targets, kb: KB, draftKey: 'tec03' },
        /* The meta says WHY this one, so it has nothing to say once the reader has chosen. */
        /* SHORTER THAN THE BRIEF ASKED FOR. Its text - "newest match, then I'll offer the fix" -
           is 36 characters and this file's own guard caps a meta at ~28, because the meta has to
           sit beside the label inside a 462px drawer. Both of its facts survive: why this target,
           and that the fix is the NEXT step rather than this one. */
        { meta: sel.length === 0 ? `${targetReason(matches)} · fix next` : 'fix next',
          said: sel.length ? `Link ${sel.join(', ')}` : `Link ${newest}` }),
      open(KB),
      cases.length > 0 && nav('cases', `Show the ${cases.length} resolved cases`, 'open', 'TEC-03/resolved'),
    ]);
    /* NO ASKS. The three lines already say what was seen, what is open and how to confirm it;
       offering those back as questions invites the reader to ask for what they have just read. */
    return { dos: lead(dos), asks: [] };
  };

  // ══ TEC-04 · state change ═════════════════════════════════════════════════════════════════
  const tec04 = (k: string, t: Turn): TechActionSet => {
    const ref = 'INC-1062';
    const holdTurn = lastTurn('TEC-04');
    const held = tk(ref)?.status === 'On hold';
    const branchTold = changedIn(turns, 'send-reply', ref);
    const chased = changedIn(turns, 'send-chase', ref);
    const hold = !held && card(holdTurn, 'hold', 'hold', `Put ${ref} on hold`, 'hold', 'TEC-04/held', 'hold',
      { meta: `pauses SLA at ${durationLabel(tk(ref)?.slaRemainingMin ?? 0)}` });
    const asks = compact([!branchTold && ask('Tell the branch what to expect'), !chased && ask('Chase TelcoNet now')]) as unknown as AskChip[];
    const asksOf = (xs: Array<AskChip | false | null>): AskChip[] => xs.filter((x): x is AskChip => !!x);
    /* A COMPOSER TURN'S ONLY DO IS SEND — until it has been sent, and then the record leads. */
    if (k === 'TEC-04/branch' && !branchTold) {
      return { dos: lead(compact([card(t, 'branch', 'send-branch', 'Send', 'send', 'TEC-04/branch-sent', 'send-reply'), hold])), asks: asksOf([!chased && ask('Chase TelcoNet now')]) };
    }
    if (k === 'TEC-04/chase' && !chased) {
      return { dos: lead(compact([card(t, 'chase', 'send-chase', 'Send', 'send', 'TEC-04/chase-sent', 'send-chase'), hold])), asks: asksOf([!branchTold && ask('Tell the branch what to expect')]) };
    }
    if (k === 'TEC-04' && !held) {
      return { dos: lead(compact([hold, open(ref)])), asks: [...asks, demo('Show others waiting on TelcoNet')] };
    }
    /* Held, or a reply went out: the record leads, the hold carries while it is still to do. */
    return { dos: lead(compact([open(ref), hold])), asks };
  };

  // ══ TEC-05 · draft ════════════════════════════════════════════════════════════════════════
  const tec05 = (k: string, t: Turn): TechActionSet => {
    const ref = 'INC-1095';
    const noteTurn = lastTurn('TEC-05');
    const sent = changedIn(turns, 'send-reply', ref);
    const reminded = !!tk(ref)?.reminderAt;
    if (sent) {
      const dos = compact([open(ref), !reminded && act('remind', 'Set a follow-up reminder', 'reminder', 'TEC-05/reminded', 'remind', { ref, when: 'in 2 days' })]);
      return { dos: lead(dos), asks: [] };
    }
    /* Both read the SAME card — the reply as it stands. Saving a draft does not retire it: the
       next turn still offers Send, which is the brief's own check. */
    const send = card(noteTurn, 'reply', 'send-reply', 'Send to the requester', 'send', 'TEC-05/sent', 'send-reply', { meta: 'posts as you' });
    const save = card(noteTurn, 'reply', 'save-draft', 'Save as draft', 'save', 'TEC-05/saved', 'save-draft');
    const appendedAlready = changedIn(turns, 'append-draft');
    if (k === 'TEC-05/credit' && !appendedAlready) {
      return {
        dos: lead(compact([card(t, 'credit', 'append', 'Add to the draft', 'apply', 'TEC-05/appended', 'append-draft', { meta: 'one sentence' }), send, save])),
        asks: [demo('Send as SMS too')],
      };
    }
    return {
      dos: lead(compact([send, save])),
      /* NO CHIPS ON THE DRAFT TURN. The turn is a headline, two sentences and the draft; a
         strip of questions under it competes with the one thing the reader is there to do.
         "Add the expected credit time" survives as a typed question and keeps its script - it
         is simply not offered here. */
      asks: k === 'TEC-05' ? []
        : appendedAlready ? [] : [ask('Add the expected credit time')],
    };
  };

  // ══ TEC-06 · vendor list ══════════════════════════════════════════════════════════════════
  const tec06 = (k: string, t: Turn): TechActionSet => {
    const pending = listVendorPending();
    /* `isOverdue`, not `>= CHASE_OVERDUE_DAYS`: the rule is OLDER than three days, and the old
       test counted a chase sent exactly three days ago as overdue — so this action and the
       sentence above it could disagree about the same tickets. */
    const overdue = byUrgency(pending.filter(isOverdue));
    /* MISSING A REF is not the same as OVERDUE FOR A CHASE. Chasing resets the clock, so gating
       the refs on the overdue set made them vanish the moment the chase ran — and the brief has
       them carried forward onto exactly that turn. A ticket with no reference still has none. */
    const missing = pending.filter((x) => !x.vendorRef);
    const rest = pending.length - 3;
    /* WHO the chases go to, as a phrase — "TelcoNet x2, PrintCo x1". At five or fewer that is the
       whole list and a reader can check it; above five it becomes a vendor COUNT instead, because
       nine names is not something anyone verifies before clicking. */
    const chaseGroups = groupByVendor(overdue);
    const whoMeta = listWords(chaseGroups.map((g) => `${g.vendor} ×${g.tickets.length}`));
    const bulk = overdue.length > BULK_PREVIEW_OVER;
    const targets = sel.length ? sel : overdue.map((x) => x.ref);
    /* SELECTION ALWAYS FIRES DIRECTLY. The preview exists because a number is not a list — and a
       reader who has ticked two cards has already made the list. */
    const chase = (overdue.length > 0 || sel.length > 0) && (sel.length === 0 && bulk
      ? nav('chase', `Chase the ${overdue.length} overdue`, 'chase', 'TEC-06/preview',
        `preview first · ${chaseGroups.length} vendors`)
      : act('chase',
        sel.length === 0 ? `Chase the ${wordsOf(overdue.length)} overdue` : sel.length === 1 ? `Chase ${sel[0]}` : `Chase ${sel.length} selected`,
        'chase', 'TEC-06/chased', 'chase', { refs: targets },
        { meta: sel.length === 0 ? whoMeta : undefined, said: sel.length ? `Chase ${sel.join(', ')}` : `Chase the ${wordsOf(overdue.length)} overdue` }));
    /* Two refs can be named; more than two is a count and a turn with rows to fill. */
    const refs = missing.length > 0 && (missing.length <= 2
      ? nav('refs', `Add vendor refs to ${listWords(missing.map((x) => x.ref))}`, 'refs', 'TEC-06/refs')
      : nav('refs', `Add missing vendor refs · ${missing.length} tickets`, 'refs', 'TEC-06/allrefs'));
    /* THE THING THE TURN DELIBERATELY DOES NOT SHOW. This replaced "Open INC-1055 · longest
       silent", which opened a record already sitting on the first card. */
    const more = rest > 0 && (rest > DRILL_FLAT_MAX
      ? nav('rest', `Show all ${pending.length} by vendor`, 'open', 'TEC-06/all')
      : nav('rest', `Show the other ${rest}`, 'open', 'TEC-06/rest'));
    if (k === 'TEC-06/refs' && missing.length > 0) {
      return { dos: lead(compact([card(t, 'refs', 'save-refs', 'Save the refs', 'save', 'TEC-06/refs-saved', 'save-refs')])), asks: [ask('Which of these are close to breaching?')] };
    }
    if (k === 'TEC-06/eta') {
      return { dos: lead(compact([card(t, 'eta', 'set-eta', 'Record the ETAs', 'save', 'TEC-06/eta-set', 'set-eta', { meta: 'as the vendor gave them' })])), asks: [ask('Which of these are close to breaching?')] };
    }
    /* After the chase: the refs are what is left to do, and lead. After the refs: the chase
       leads if any are still overdue; otherwise the record. */
    /* The preview's own turn has ONE action: send what is still ticked. */
    if (k === 'TEC-06/preview') {
      return {
        dos: lead(compact([card(t, 'chases', 'send-chases', `Send ${ticked(t)} chases`, 'chase', 'TEC-06/chased', 'chase')])),
        asks: [],
      };
    }
    if (k === 'TEC-06/allrefs' && missing.length > 0) {
      return {
        dos: lead(compact([card(t, 'refs', 'save-refs', `Save ${filledRefs(t) || missing.length} refs`, 'save', 'TEC-06/refs-saved', 'save-refs')])),
        asks: [],
      };
    }
    if (k === 'TEC-06/chased') {
      return { dos: lead(compact([refs, more])), asks: [] };
    }
    if (k === 'TEC-06/refs-saved') {
      return { dos: lead(compact([chase, more])), asks: [] };
    }
    /* NO ASKS on the answer itself. The three lines already say what is stuck, what is overdue
       and what is moving; offering those back as questions asks the reader to request what they
       have just read. */
    return { dos: lead(compact([chase, refs, more])), asks: [] };
  };

  /* THE TALLY, not the payload. The record carries how much the card would do and emits when
     that changes, which is what makes the label recompute as boxes are unticked; calling the card
     for its inputs gives the same number but tells nobody it moved. The payload is still fetched
     by calling it, at the moment the action actually runs. */
  function ticked(t: Turn): number {
    return rec(t, 'chases')?.tally ?? 0;
  }
  /** How many reference rows have something in them. */
  function filledRefs(t: Turn): number {
    return rec(t, 'refs')?.tally ?? 0;
  }

  // ══ the ref and KB turns ══════════════════════════════════════════════════════════════════
  const refTurn = (k: string, t: Turn): TechActionSet | null => {
    const ref = refIn(t.question) || (typeof t.context?.ref === 'string' ? t.context.ref : '');
    if (k === 'TEC/ref-open') {
      const inherited = carry(t);
      return { dos: inherited?.dos ?? lead([open(ref)]), asks: ref ? [ask(`Show the updates on ${ref}`), ask(`Add a note to ${ref}`)] : [] };
    }
    if (k === 'TEC/ref-note' && !changedIn(turns, 'add-note', ref)) {
      return { dos: lead(compact([card(t, 'refnote', 'add-note', 'Add the note', 'send', 'TEC/note-added', 'add-note'), open(ref)])), asks: [] };
    }
    if (k === 'TEC/ref-followup' && !changedIn(turns, 'remind', ref)) {
      return { dos: lead(compact([card(t, 'fu', 'followup', 'Set the follow-up', 'reminder', 'TEC/followup-set', 'remind'), open(ref)])), asks: [] };
    }
    if (k === 'TEC/note-added' || k === 'TEC/followup-set' || k === 'TEC/ref-note' || k === 'TEC/ref-followup') {
      const r = t.answer?.changed?.refs[0] ?? ref;
      return { dos: lead([open(r)]), asks: r ? [ask(`Show the updates on ${r}`)] : [] };
    }
    return null;
  };

  // ── the walk: this turn's own set, else the last actionable turn's, re-derived now ───────
  const own = (t: Turn): TechActionSet | null => {
    const k = scriptKeyOf(t) ?? '';
    switch (k) {
      case 'TEC-01': return tec01();
      case 'TEC-01/started': case 'TEC-01/started3': return tec01After(t);
      case 'TEC-02': case 'TEC-02/sent': case 'TEC-02/subscribed': case 'TEC-02/event': case 'TEC-02/event-added': return tec02(k, t);
      case 'TEC-03': case 'TEC-03/link': case 'TEC-03/linked': case 'TEC-03/applied':
      case 'TEC-03/noted': case 'TEC-03/others': case 'TEC-03/resolved': return tec03(k);
      case 'TEC-04': case 'TEC-04/held': case 'TEC-04/branch': case 'TEC-04/chase': case 'TEC-04/branch-sent': case 'TEC-04/chase-sent': return tec04(k, t);
      case 'TEC-05': case 'TEC-05/sent': case 'TEC-05/saved': case 'TEC-05/reminded': case 'TEC-05/credit': case 'TEC-05/appended': return tec05(k, t);
      case 'TEC-06': case 'TEC-06/chased': case 'TEC-06/refs': case 'TEC-06/refs-saved':
      case 'TEC-06/eta': case 'TEC-06/eta-set':
      /* The four turns the caps open. Without these the drill, the checklist and the refs turn
         all fell through to the default branch and inherited the ANSWER's three actions — so a
         checklist of fourteen chases offered "Chase the 14 overdue" again. */
      case 'TEC-06/preview': case 'TEC-06/allrefs': case 'TEC-06/rest': case 'TEC-06/all':
        return tec06(k, t);
      case 'TEC/ref-open': case 'TEC/ref-note': case 'TEC/ref-followup': case 'TEC/note-added': case 'TEC/followup-set': return refTurn(k, t);
      /* Informational — an overnight list, the bridge roster, a breach table, the article, the
         updates log: it inherits the last actionable turn's actions, minus the question it
         answered. */
      default: return null;
    }
  };
  /** The last actionable turn before `t`, re-derived against what is true now. */
  const carry = (t: Turn): TechActionSet | null => {
    const prev = before(t);
    for (let i = prev.length - 1; i >= 0; i--) {
      const s = own(prev[i]);
      if (s) return { dos: s.dos, asks: s.asks.filter((a) => a.label !== t.question) };
    }
    return null;
  };

  const set = own(turn) ?? carry(turn);
  /* NOTHING TO OFFER is a real answer, and the surface says so by not being there. */
  if (!set || (!set.dos.length && !set.asks.length)) return null;
  return finish(turn, set);
}

/** Give every option a stable id per turn, and — in dev — check the rules. */
function finish(t: Turn, set: TechActionSet): TechActionSet {
  const out: TechActionSet = {
    dos: set.dos.map((d) => ({ ...d, id: `${t.id}:${d.id}` })),
    asks: set.asks.slice(0, 3),
  };
  if (import.meta.env.DEV) {
    const k = scriptKeyOf(t);
    if (out.dos.length < 1 || out.dos.length > 3) console.error(`Technician actions: ${out.dos.length} do-actions for ${k} — the rule is one to three`);
    const rec = out.dos.filter((d) => d.recommended).length;
    if (out.dos.length && rec !== 1) console.error(`Technician actions: ${rec} recommended for ${k} — exactly one`);
    if (out.dos.length && !out.dos[0].recommended) console.error(`Technician actions: the recommended action is not first for ${k}`);
    if (set.asks.length > 3) console.error(`Technician actions: ${set.asks.length} ask-chips for ${k} — at most three`);
    if (out.asks.filter((a) => a.disabled).length > 1) console.error(`Technician actions: more than one disabled ask-chip for ${k}`);
    out.dos.forEach((d) => { if (d.meta && d.meta.length > 30) console.error(`Technician actions: meta "${d.meta}" is longer than ~28 characters`); });
  }
  return out;
}
