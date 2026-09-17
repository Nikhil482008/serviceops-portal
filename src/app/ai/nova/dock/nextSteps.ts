import { SCRIPTS } from '../scripts/registry';
import type { Turn } from '../turnModel';
import type { DoIcon } from '../tech/icons';
import { closeTicket, getDraft, getTicket, listOpenForUser, updateTicket } from '../mockTickets';
import {
  choose, mark, proposalKey, runProposal, settleProposal,
  type DockSnapshot, type Outcome,
} from './proposals';

/* WHAT THE READER CAN DO NEXT — a pure selector over the conversation.
 *
 * ── ONE FUNCTION, NO STORED STATE ────────────────────────────────────────────────────────────
 * `nextStepsFor(conversation, env)` reads the turns, the dock store (which cards are pending,
 * what has already been run) and the ticket store (what is actually true of the tickets) and
 * returns the options for the conversation's CURRENT state. Nothing here remembers anything: the
 * same inputs give the same list, which is what lets the dock be re-derived on every render
 * rather than kept in step by hand.
 *
 * ── THE LAST ACTIONABLE TURN ─────────────────────────────────────────────────────────────────
 * Turns are walked newest first. A turn with a dock of its own returns it; an informational
 * turn — an explanation, a "what was tried" list, a timeline — returns null and the walk goes on
 * to the turn beneath it, so the reader is offered the step that follows the last thing they
 * could act on. An empty list is a real answer ("nothing to do — the loop is closed") and ends
 * the walk; null is "not mine to say".
 *
 * ── THE RULES THE SETS FOLLOW ────────────────────────────────────────────────────────────────
 *   · two to four options, never one, never five
 *   · option 1 is what the turn was building toward, and it is the one recommended option
 *   · imperatives with a one-line consequence in `detail`; a question mark only where the
 *     label IS the question the reader would ask
 *   · at most one demo-only option, rendered disabled
 * `finish` checks the first three in dev and complains rather than trusting each case.
 *
 * ── THREE KINDS, AND HOW EACH RUNS ───────────────────────────────────────────────────────────
 *   mutate     a card's own runner (the card above IS the preview; option 1 IS its confirm), or
 *              a store mutation with no card, which leaves a banner beneath the answer
 *   ask        askNova, as a chip did — the label becomes the reader's own turn
 *   navigate   a reply with no question above it: the chosen line stands where the question
 *              would, and the answer follows
 */

/** WHAT THE DOCK IS OFFERING, in one place. The open dock's header and the collapsed band say
 *  the same sentence, so collapsing MOVES the line rather than renaming it — and a reader who
 *  folds the dock away is not asked to learn a second name for what they just folded. Two copies
 *  of a string are two chances for that to stop being true. */
export const DOCK_OFFER = 'Nova can do this for you';

export type NextStepKind = 'mutate' | 'ask' | 'navigate';

export interface NextStep {
  id: string;
  label: string;
  /** The one-line consequence under the label. EMPTY means the row is single-line — a technician
   *  action with no meta ("Send", "Save the refs") has nothing to add and should not be given a
   *  second line of filler to say it. */
  detail: string;
  kind: NextStepKind;
  /** The AUTHORED verb, when the action declares one (every technician do-action does). It wins
   *  over the label derivation so the glyph on the row and the glyph on the reader's own turn are
   *  the same fact — see dock/stepIcon.tsx. */
  icon?: DoIcon;
  recommended?: boolean;
  disabled?: boolean;
  /** The tooltip while disabled. Absent means "Not in this demo". */
  disabledReason?: string;
  /** The turn this option acts on — where its chosen line lands, where focus goes after. */
  turnId: string;
  run: () => void | Promise<void>;
}

export interface DockConversation {
  turns: Turn[];
  dock: DockSnapshot;
}

export interface DockEnv {
  /** A question, as a chip was: the label becomes the reader's turn, answered by `caseId`. */
  ask: (label: string, caseId: string) => void;
  /** A reply with no question: the chosen line (number `n`, the label) stands in for one.
   *  `ref` is the record the reply is about, for scripts that read `$question`. */
  navigate: (label: string, caseId: string, n: number, ref?: string) => void;
}

/** Which script answered a turn — the case it was opened with, or the one its words reach. */
export const scriptKeyOf = (t: Turn): string | undefined =>
  t.caseId ?? Object.keys(SCRIPTS).find((k) => SCRIPTS[k].match?.test(t.question));

interface Draft {
  label: string;
  detail: string;
  kind: NextStepKind;
  recommended?: boolean;
  disabled?: boolean;
  disabledReason?: string;
  /** The turn the option acts on when it is not the one being read (REQ-03's escalate from the
   *  business-impact reply). */
  on?: Turn;
  go?: (n: number) => void;
}

const slug = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

export function nextStepsFor(conv: DockConversation, env: DockEnv): NextStep[] {
  const { turns, dock } = conv;

  // ── readers ────────────────────────────────────────────────────────────────────────────
  const phaseOf = (t: Turn, blockId: string) => dock.proposals.get(proposalKey(t.id, blockId))?.phase ?? 'idle';
  const pending = (t: Turn, blockId: string) => phaseOf(t, blockId) === 'idle';
  const isMarked = (t: Turn, fact: string) => !!dock.marks[t.id]?.includes(fact);
  const lastTurn = (key: string): Turn | undefined => [...turns].reverse().find((x) => scriptKeyOf(x) === key);
  /** A note was posted for this ref by some turn's note card. */
  const noted = (blockId: string) => [...dock.proposals.values()].some((p) => p.blockId === blockId && p.phase === 'done');

  // ── option builders ───────────────────────────────────────────────────────────────────
  const ask = (label: string, caseId: string, detail: string, recommended = false): Draft =>
    ({ label, detail, kind: 'ask', recommended, go: () => env.ask(label, caseId) });
  const nav = (label: string, caseId: string, detail: string, recommended = false, ref?: string): Draft =>
    ({ label, detail, kind: 'navigate', recommended, go: (n) => env.navigate(label, caseId, n, ref) });
  /** Authored but not in this demo — shown, disabled, so the intent is visible. */
  const demo = (label: string, detail: string): Draft => ({ label, detail, kind: 'ask', disabled: true });
  /** A card's own committer. Disabled while the card says it cannot run (empty note, no pick). */
  const card = (t: Turn, blockId: string, label: string, detail: string, recommended = false): Draft => {
    const p = dock.proposals.get(proposalKey(t.id, blockId));
    return {
      label, detail, kind: 'mutate', recommended, on: t,
      disabled: !!p && !p.canRun, disabledReason: p?.why,
      go: (n) => { if (runProposal(proposalKey(t.id, blockId))) choose(t.id, { n, label }); },
    };
  };
  /** A store mutation with no card of its own — what it leaves behind is the outcome. */
  const act = (t: Turn, label: string, detail: string, recommended: boolean, fn: () => Outcome | undefined): Draft =>
    ({ label, detail, kind: 'mutate', recommended, on: t, go: (n) => choose(t.id, { n, label, outcome: fn() }) });
  /** Settle a proposal WITHOUT running it — "Keep it Medium". Navigation in kind: nothing changes. */
  const decline = (t: Turn, blockId: string, label: string, detail: string, recommended = false): Draft =>
    ({ label, detail, kind: 'navigate', recommended, on: t,
      go: (n) => { settleProposal(proposalKey(t.id, blockId), 'discarded'); choose(t.id, { n, label }); } });

  const escalated = () => getTicket('INC-0035')?.assignee === 'EUC escalation queue';
  const showTicket = (ref: string, detail: string, recommended = false) =>
    nav('Show me the ticket', 'REQ/status-any', detail, recommended, ref);
  const backToList = () => nav('Back to my list', 'REQ-06', 'Everything still open, as it stands now');

  // ── the sets ──────────────────────────────────────────────────────────────────────────
  const dockFor = (t: Turn): Draft[] | null => {
    switch (scriptKeyOf(t)) {
      /* ── REQ-01 · Create ─────────────────────────────────────────────── */
      case 'REQ-01': {
        const created = getDraft('req01').createdRef;
        if (!created) return [
          card(t, 'req01', 'Create the ticket', 'Goes to End User Computing as drafted above', true),
          ask('Add my docking station first', 'REQ-01/asset', 'Link the dock so the ticket references it'),
          ask('What happens after I create it?', 'REQ-01/after', 'Who picks it up and how long it usually takes'),
        ];
        return [
          nav('Show me its status', 'REQ-01/status', `Where ${created} is right now`, true, created),
          ...(noted('n1042') ? [] : [ask('Add a note to INC-1042', 'REQ-01/note', 'Anything the technician should know')]),
          demo('Notify my manager', 'Sends them the ticket link'),
        ];
      }
      case 'REQ-01/asset': {
        if (!pending(t, 'dockpick')) return null;
        const draftTurn = lastTurn('REQ-01');
        const created = getDraft('req01').createdRef;
        return [
          card(t, 'dockpick', 'Link this dock', 'Added to the draft above so the technician knows the model', true),
          draftTurn && !created
            ? card(draftTurn, 'req01', 'Create the ticket', 'Goes to End User Computing as drafted above')
            : ask('What happens after I create it?', 'REQ-01/after', 'Who picks it up and how long it usually takes'),
        ];
      }
      case 'REQ-01/note': {
        if (!pending(t, 'n1042')) return null;
        return [
          card(t, 'n1042', 'Post the note', 'Goes on INC-1042 as you', true),
          nav('Show me its status', 'REQ-01/status', 'Where INC-1042 is right now', false, 'INC-1042'),
        ];
      }

      /* ── REQ-02 · Status ─────────────────────────────────────────────── */
      case 'REQ-02': return [
        ask("What's been tried so far?", 'REQ-02/tried', 'Every attempt, with dates', true),
        ask('Ask Priya for an update', 'REQ-02/nudge', "I'll draft a polite nudge"),
        demo('When will it be fixed?', 'An estimate from similar tickets'),
      ];
      case 'REQ-02/nudge': {
        if (!pending(t, 'nudge')) return null;
        return [
          card(t, 'nudge', 'Send the comment', 'Priya will be notified', true),
          ask("What's been tried so far?", 'REQ-02/tried', 'Every attempt, with dates'),
        ];
      }

      /* ── REQ-03 · Escalate ───────────────────────────────────────────── */
      case 'REQ-03': {
        if (pending(t, 'esc') && !escalated()) return [
          card(t, 'esc', 'Escalate INC-0035', 'Priority High, EUC escalation queue, team lead notified', true),
          ask('Add the business impact first', 'REQ-03/impact', "I'll attach it to the escalation"),
          ask('Who will pick this up?', 'REQ-03/who', "The queue and who's on it"),
        ];
        return [
          ask('Add a note about the impact', 'REQ-03/impact', 'Helps the team lead prioritise', true),
          showTicket('INC-0035', 'INC-0035, as it stands now'),
          demo('Show the ticket history', 'Every update since it was logged'),
        ];
      }
      case 'REQ-03/impact': {
        if (!pending(t, 'imp')) return null;
        const escTurn = lastTurn('REQ-03');
        return [
          card(t, 'imp', 'Post the note', 'Goes on INC-0035 as you', true),
          escTurn && pending(escTurn, 'esc') && !escalated()
            ? card(escTurn, 'esc', 'Escalate INC-0035', 'Priority High, EUC escalation queue, team lead notified')
            : showTicket('INC-0035', 'INC-0035, as it stands now'),
        ];
      }

      /* ── REQ-04 · Fix ────────────────────────────────────────────────── */
      case 'REQ-04': {
        /* The loop is closed: nothing to offer, and the dock says so by not being there. */
        if (isMarked(t, 'fixed')) return [];
        return [
          act(t, 'That fixed it', "I'll note it and close the loop", true, () => {
            mark(t.id, 'fixed');
            return { record: 'Glad that worked — nothing else needed.' };
          }),
          ask("It didn't work", 'REQ-04/notwork', "I'll log a ticket with what we tried"),
          ask('Why did this happen?', 'REQ-04/why', 'Two sentences, no jargon'),
        ];
      }
      case 'REQ-04/notwork': {
        const created = getDraft('req04').createdRef;
        if (!created) return [
          card(t, 'req04', 'Create the ticket', 'Goes to Network with the steps attached', true),
          ask('Show me similar fixes', 'REQ-04/similar', 'How the other eight were resolved'),
          demo('Make it high priority', 'Raise it before it is created'),
        ];
        return [
          nav('Show me its status', 'REQ/status-any', `Where ${created} is right now`, true, created),
          ask('Why did this happen?', 'REQ-04/why', 'Two sentences, no jargon'),
        ];
      }

      /* ── REQ-05 · Update ─────────────────────────────────────────────── */
      case 'REQ-05': {
        if (pending(t, 'ctr3')) return [
          card(t, 'ctr3', 'Add the note to INC-0871', 'Priya will see it; affected assets become 2', true),
          ask('Should this be higher priority?', 'REQ-05/prio', "I'll check the rules"),
          ask("Tell Priya it's urgent", 'REQ-05/urgent', "I'll draft the message"),
        ];
        return [
          showTicket('INC-0871', 'INC-0871, as it stands now', true),
          ask("Tell Priya it's urgent", 'REQ-05/urgent', "I'll draft the message"),
          demo('Is this happening elsewhere?', 'Other branches with the same printer'),
        ];
      }
      case 'REQ-05/prio': {
        if (!pending(t, 'prio')) return null;
        return [
          decline(t, 'prio', 'Keep it Medium', 'Two printers still fits Medium', true),
          card(t, 'prio', 'Raise to High anyway', 'Goes through the usual approval'),
        ];
      }
      case 'REQ-05/urgent': {
        if (!pending(t, 'urg')) return null;
        return [
          card(t, 'urg', 'Send the comment', 'Priya will be notified', true),
          showTicket('INC-0871', 'INC-0871, as it stands now'),
        ];
      }

      /* ── REQ-06 · List ───────────────────────────────────────────────── */
      case 'REQ-06': {
        const open = listOpenForUser();
        const needs = open.find((x) => x.needsYou);
        /* "open tickets" is the READER'S phrase and the dock is their voice - it is the words
           they would type. Everything NOVA says about the set calls it unresolved, because
           `Open` is one of the statuses inside it. */
        return [
          ...(needs ? [nav('Show me the one that needs me', 'REQ-06/needs', `${needs.ref} is waiting on your confirmation`, true)] : []),
          ask('Show my open tickets', 'REQ-06/tickets', `All ${open.length}, one by one`, !needs),
          ask('Close the ones that are fixed', 'REQ-06/closeall', "I'll show a checklist"),
        ];
      }
      /* Turn 2 has already listed them, so listing them again is not on offer. */
      case 'REQ-06/tickets': {
        const needs = listOpenForUser().find((x) => x.needsYou);
        return [
          ...(needs ? [nav('Show me the one that needs me', 'REQ-06/needs', `${needs.ref} is waiting on your confirmation`, true)] : []),
          ask('Close the ones that are fixed', 'REQ-06/closeall', "I'll show a checklist", !needs),
          demo('Show closed ones too', 'Everything resolved this month'),
        ];
      }
      case 'REQ-06/needs': {
        const tk = getTicket('INC-0790');
        if (!tk || tk.status === 'Closed') return null;
        return [
          act(t, 'Email is working — close it', 'INC-0790 closes with your confirmation on it', true, () => {
            closeTicket('INC-0790', 'Confirmed working by requester.');
            return { banner: { text: 'INC-0790 closed', ref: 'INC-0790' } };
          }),
          ask('Still broken — add a note', 'REQ-06/stillbounce', "I'll tell the messaging team it isn't fixed"),
          backToList(),
        ];
      }
      case 'REQ-06/stillbounce': {
        if (!pending(t, 'bounce')) return null;
        return [
          card(t, 'bounce', 'Send the comment', 'The messaging team will be notified', true),
          backToList(),
        ];
      }
      case 'REQ-06/closeall': {
        if (!pending(t, 'cl')) return null;
        return [
          card(t, 'cl', 'Close selected', 'Only the ones you ticked', true),
          backToList(),
        ];
      }

      /* ── REQ-07 · Mixed ──────────────────────────────────────────────── */
      case 'REQ-07': {
        const closed790 = getTicket('INC-0790')?.status === 'Closed';
        const reopened644 = getTicket('INC-0644')?.status === 'Open';
        const out: Draft[] = [];
        if (!closed790) out.push(card(t, 'close790', 'Close INC-0790', 'With the resolution note above'));
        if (!reopened644) out.push(act(t, 'Reopen the fuel-station ticket', "If it's declining again", false, () => {
          updateTicket('INC-0644', { status: 'Open' });
          return { banner: { text: 'INC-0644 reopened — Finance/IT will take another look', ref: 'INC-0644' } };
        }));
        out.push(ask('What was the fix for the card?', 'REQ-07/fix', 'The resolution note, in plain words'));
        if (out.length < 2) out.push(nav('Show me both tickets', 'REQ-07/both', 'INC-0790 and INC-0644, as they stand now'));
        out[0].recommended = true;
        return out;
      }
      case 'REQ-07/reopen': {
        if (!pending(t, 'reopen')) return null;
        return [
          card(t, 'reopen', 'Reopen the fuel-station ticket', "If it's declining again", true),
          ask('What was the fix for the card?', 'REQ-07/fix', 'The resolution note, in plain words'),
        ];
      }

      /* Everything else — a timeline, an explanation, a status card, a list of attempts — is
         informational and inherits the dock of the last actionable turn beneath it. */
      default: return null;
    }
  };

  // ── the walk ──────────────────────────────────────────────────────────────────────────
  for (let i = turns.length - 1; i >= 0; i--) {
    const t = turns[i];
    if (!t.answer || (t.state !== 'settled' && t.state !== 'answering')) continue;
    const set = dockFor(t);
    if (set) return finish(t, set);
  }
  return [];
}

/** Number the options, wire each runner to its number, and — in dev — check the rules. */
function finish(t: Turn, drafts: Draft[]): NextStep[] {
  const out = drafts.map<NextStep>((d, i) => ({
    id: `${(d.on ?? t).id}:${slug(d.label)}`,
    label: d.label, detail: d.detail, kind: d.kind,
    recommended: !!d.recommended, disabled: !!d.disabled, disabledReason: d.disabledReason,
    turnId: (d.on ?? t).id,
    run: () => { if (!d.disabled) d.go?.(i + 1); },
  }));
  if (import.meta.env.DEV && out.length) {
    if (out.length < 2 || out.length > 4) console.error(`Next-step dock: ${out.length} options for ${scriptKeyOf(t)} — the rule is two to four`);
    const rec = out.filter((s) => s.recommended).length;
    if (rec !== 1) console.error(`Next-step dock: ${rec} recommended options for ${scriptKeyOf(t)} — exactly one`);
    if (out.filter((s) => s.disabled && !s.disabledReason).length > 1) console.error(`Next-step dock: more than one demo-only option for ${scriptKeyOf(t)}`);
  }
  return out;
}
