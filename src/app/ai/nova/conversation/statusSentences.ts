import { statusLabel, type MockTicket } from '../mockTickets';

/* WHERE A TICKET STANDS, IN SENTENCES.
 *
 * The requester's status answer is prose, and prose has to survive being copied. This is the one
 * place the sentences are composed: `StatusText` renders them (with the ref as a clickable chip
 * and the trail as spans it can colour), and `blocksToText` joins them for the clipboard. Two
 * readers, one wording — the copy cannot quietly say something the screen does not.
 *
 * Nothing here invents a time, a team or a note. Every branch is a fact on the record or the
 * absence of one, said plainly.
 */

/** THE STATUS IN THE READER'S WORDS, in the two shapes the product needs:
 *
 *   headline  a whole clause  — "It's being worked on", for REQ-02's conclusion
 *   phrase    a bare fragment — "being worked on", for REQ-06's "3 being worked on"
 *
 * One entry per status so the two can never drift apart. A status that is NOT here renders AS
 * ITSELF (lowercased for the fragment), which is what lets a deployment's own statuses through
 * with no code at all. */
export const STATUS_WORDS: Record<string, { headline: string; phrase: string }> = {
  Logged: { headline: "It's logged and waiting to be picked up", phrase: 'not picked up yet' },
  Open: { headline: "It's logged and waiting to be picked up", phrase: 'not picked up yet' },
  Assigned: { headline: 'Someone has picked it up', phrase: 'picked up' },
  'In progress': { headline: "It's being worked on", phrase: 'being worked on' },
  'On hold': { headline: "It's paused", phrase: 'paused' },
  'Pending approval': { headline: "It's waiting for approval", phrase: 'waiting for approval' },
  'Waiting on approval': { headline: "It's waiting for approval", phrase: 'waiting for approval' },
  'Waiting on requester': { headline: "It's waiting on you", phrase: 'waiting on you' },
  'Waiting on vendor': { headline: 'Waiting on the supplier', phrase: 'waiting on the supplier' },
  'Vendor engaged': { headline: 'The supplier has it', phrase: 'with the supplier' },
  'Awaiting parts': { headline: 'Waiting on a part', phrase: 'waiting on a part' },
  'Pending user confirmation': { headline: 'Fixed — waiting for you to confirm', phrase: 'waiting for you to confirm' },
  Resolved: { headline: "It's been fixed", phrase: 'fixed' },
  Closed: { headline: "It's closed", phrase: 'closed' },
};

/** The clause form — for a headline. */
export const statusHeadline = (status: string): string => STATUS_WORDS[status]?.headline ?? status;
/** The fragment form — for "<count> <phrase>". */
export const statusPhrase = (status: string): string =>
  STATUS_WORDS[status]?.phrase ?? status.toLowerCase();

const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
/** Words to nine, numerals above — how a person writes a small count in a sentence. */
export const numberWord = (n: number): string => (n <= 9 ? WORDS[n] : String(n));
export const Sentence = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/** "Priya S. (Service Desk)" → the person and their team. A bare name or a queue name has no
 *  team, and nothing invents one. */
export const whoAndTeam = (assignee: string): { who: string; team?: string } => {
  const m = assignee.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  return m ? { who: m[1].trim(), team: m[2].trim() } : { who: assignee.trim() };
};

/** Six at most: the first, an ellipsis, then the last four. Where it started and what has
 *  happened lately are what a reader orients by; the middle of a long history is not. */
export const trailShown = (steps: string[]): string[] =>
  (steps.length > 6 ? [steps[0], '…', ...steps.slice(-4)] : steps);

export interface StatusSentences {
  /** The state plus recency — the turn's conclusion when the script authored none. */
  headline: string;
  /** What follows the ref chip on the status line, the chip's own text excluded. */
  afterRef: string;
  /** The history as rendered, current last. */
  trail: string[];
  /** The whole note line, lead-in included — there is nothing inline to interrupt it. */
  note: string;
  next: string;
}

export function statusSentences(t: MockTicket): StatusSentences {
  const now = statusLabel(t);
  const { who, team } = whoAndTeam(t.assignee);
  /* The most recent note the REQUESTER can see. An internal note is never one of them. */
  const ext = [...t.notes].reverse().find((n) => n.external);
  const note = ext?.text ?? t.latestNote;
  const noteWhen = ext?.when ?? t.lastUpdate;
  const done = t.status === 'Resolved' || t.status === 'Closed';
  return {
    headline: `${statusHeadline(now)} — updated ${t.lastUpdate}`,
    afterRef: who ? ` is with ${who}${team ? ` from ${team}` : ''}.` : ' is logged and not yet assigned.',
    trail: trailShown(t.statusTrail ?? [now]),
    note: note ? `Latest note, ${noteWhen} — “${note}”` : 'Latest note — none yet.',
    /* NEVER AN INVENTED TIME. The ticket's own next-update field, else the vendor's quoted ETA,
       else the absence said plainly. A finished ticket is owed no next update at all. */
    next: `Next update — ${
      t.nextUpdate ? `expected ${t.nextUpdate}`
        : t.vendor && t.eta ? `when the part ships. ${t.vendor} quoted ${t.eta}.`
          : done ? "none needed — it's finished."
            : "no time set yet. I'll tell you when it changes."}`,
  };
}

/** The same answer as flat lines — for the clipboard, where there are no chips to click. */
export const statusPlainLines = (t: MockTicket): string[] => {
  const s = statusSentences(t);
  return [s.headline, `Status — ${t.ref}${s.afterRef} ${s.trail.join(' › ')}`, s.note, s.next];
};
