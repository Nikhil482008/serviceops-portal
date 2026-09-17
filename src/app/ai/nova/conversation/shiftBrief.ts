import {
  currentUser, DEMO_NOW, durationLabel, listQueue, minutesOf, OVERNIGHT, type MockTicket,
} from '../mockTickets';
import { numberWord, Sentence } from './statusSentences';

/* THE START OF A SHIFT, COMPOSED FROM THE QUEUE.
 *
 * Everything TEC-01 says about the queue is derived here: which ticket is first and why, the
 * three sentences that justify the ordering, and the impact line on each card. A technician who
 * changes a ticket's clock changes what the answer says about it, because nothing in this turn
 * is a sentence somebody typed next to a ticket.
 */

/** The consequence, by unit. A unit not here is simply " affected" - the honest default, and
 *  the reason an unknown unit is a shrug rather than a wrong verb. */
const UNIT_PHRASE: Record<string, string> = {
  customers: ' affected',
  salaries: ' pending',
  staff: ' offline',
  clients: ' affected',
  /* A USER IS NOT "AFFECTED" BY THEIR OWN TICKET - they are the ticket. "1 user" is the whole
     fact, and " affected" after it would be the sentence padding itself. */
  users: '',
};

/** "1 user", "3 users". Every count so far has been a crowd, so the unit was simply printed;
 *  a single user is the first n === 1 this has had to say. */
const unitOf = (n: number, unit: string): string =>
  (n === 1 && unit.endsWith('s') ? unit.slice(0, -1) : unit);
/** The one context-sensitive case: customers of an ATM are not "affected", they cannot get cash. */
const atmCustomers = (t: MockTicket) => t.category === 'ATM' && t.affectedCount?.unit === 'customers';

/** "3 branches · ~1,800 customers without ATM access · Retail Banking" — COMPOSED, never
 *  authored per ticket. A part the record does not carry is left out rather than guessed. */
export function impactLine(t: MockTicket): string {
  const parts: string[] = [];
  if (t.affectedScope) parts.push(t.affectedScope);
  if (t.affectedCount) {
    const { n, unit, approx } = t.affectedCount;
    const phrase = atmCustomers(t) ? ' without ATM access' : (UNIT_PHRASE[unit] ?? ' affected');
    parts.push(`${approx ? '~' : ''}${n.toLocaleString('en-US')} ${unitOf(n, unit)}${phrase}`);
  }
  if (t.department) parts.push(t.department);
  return parts.join(' · ');
}

/** Minutes left on the clock, or Infinity when a ticket carries none — so "soonest" sorting and
 *  the rail thresholds both read one number. */
export const slaMin = (t: MockTicket): number => t.slaRemainingMin ?? Infinity;
/** THE CARD'S RAIL, and the colour of the clock beside it. Under an hour is red; under three,
 *  amber. Named for the rail, not for the SLA: TechnicianBlocks already has an `slaLevel` that
 *  answers a different question (how a countdown bar should read) with different levels. */
export const railLevel = (t: MockTicket): 'breach' | 'soon' | 'none' =>
  (slaMin(t) < 60 ? 'breach' : slaMin(t) < 180 ? 'soon' : 'none');

/** Regulatory clock first, then the SLA clock, then priority — the rule the ordering line
 *  states, applied rather than described. */
export const triageOrder = (queue: MockTicket[]): MockTicket[] => [...queue].sort((a, b) => {
  const reg = (t: MockTicket) => (t.regulatory && (t.regulatoryOverdueDays ?? 0) > 0 ? 0 : 1);
  const pri = (t: MockTicket) => parseInt(String(t.priority ?? 'P9').replace(/\D/g, ''), 10) || 9;
  return (reg(a) - reg(b)) || (slaMin(a) - slaMin(b)) || (pri(a) - pri(b));
});

export type Token = { t: 'text'; v: string } | { t: 'ref'; v: string };

export interface ShiftBrief {
  queue: MockTicket[];
  /** The whole queue in triage order; the turn shows the first three. */
  ranked: MockTicket[];
  top: MockTicket[];
  rest: MockTicket[];
  headline: string;
  lines: { label: string; parts: Token[] }[];
  /** The ticket whose regulatory moment the footnote is about, if any is unverified. */
  caveat?: { ref: string; at: string };
}

export function shiftBrief(): ShiftBrief {
  const queue = listQueue();
  const ranked = triageOrder(queue);
  const [first] = ranked;
  const top = ranked.slice(0, 3);
  const rest = ranked.slice(3);

  /* THE HEADLINE names the first ticket and why it is first. Under three hours the clock is a
     threat ("breaches in"); above it, it is just a budget ("has ... left"). */
  /* PROSE, NOT A DASHBOARD. "0h 40m" is right on a card where clocks line up in a column and
     wrong in a sentence, so an hour-less duration loses its leading zero here. */
  const spoken = (min: number) => durationLabel(min).replace(/^0h /, '');
  const clock = slaMin(first) < 180
    ? `it breaches in ${spoken(slaMin(first))}`
    : `it has ${spoken(slaMin(first))} left`;
  const overdue = !!first?.regulatory && (first.regulatoryOverdueDays ?? 0) > 0;
  const headline = `Start with ${first.ref} — ${clock}${overdue ? ' and its regulatory window has already closed' : ''}`;

  const lines: ShiftBrief['lines'] = [];
  const line = (label: string, build: (push: (v: string) => void, ref: (v: string) => void) => void) => {
    const parts: Token[] = [];
    build((v) => parts.push({ t: 'text', v }), (v) => parts.push({ t: 'ref', v }));
    lines.push({ label, parts });
  };

  /* YOUR QUEUE — the counts, and only the ones that are not zero. */
  const breaching = queue.filter((t) => slaMin(t) < 180).length;
  const waiting = queue.filter((t) => t.awaitingYou).length;
  const escalated = queue.filter((t) => t.escalatedAt).length;
  line('Your queue', (text) => {
    const clauses: string[] = [];
    if (breaching) clauses.push(`${numberWord(breaching)} breach${breaching === 1 ? 'es' : ''} within 3 hours`);
    if (waiting) clauses.push(`${numberWord(waiting)} ${waiting === 1 ? 'is' : 'are'} waiting on you`);
    if (escalated) clauses.push(`${numberWord(escalated)} was escalated overnight`);
    text(clauses.length
      ? `${queue.length} tickets. ${Sentence(clauses.join(', '))}.`
      : `${queue.length} tickets. Nothing is breaching and nothing needs you right now.`);
  });

  /* WHY THIS ORDER — the rule, and the one exception that needs defending. A P1 sitting below a
     P2 is the kind of thing a reader stops on, so the record says why. */
  const outranked = ranked.find((t, i) => t.rankingNote
    && ranked.slice(0, i).some((above) => (parseInt(String(above.priority ?? 'P9').replace(/\D/g, ''), 10) || 9)
      > (parseInt(String(t.priority ?? 'P9').replace(/\D/g, ''), 10) || 9)));
  line('Why this order', (text, ref) => {
    text('regulatory clock first, then SLA remaining, then priority.');
    if (outranked) {
      text(' ');
      ref(outranked.ref);
      text(` is ${outranked.priority} but ${outranked.rankingNote} and ${spoken(slaMin(outranked))}; it can go second.`);
    }
  });

  /* OVERNIGHT — what landed on the reader while they were away. */
  const landed = queue.filter((t) => t.newSinceHandover);
  line('Overnight', (text, ref) => {
    if (!landed.length) { text('nothing new landed on you.'); return; }
    if (landed.length > 1) {
      text(`${landed.length} tickets landed on you; `);
      ref(landed[0].ref);
      text(' is the one to check first.');
      return;
    }
    const [t] = landed;
    const at = OVERNIGHT.find((o) => o.refs.includes(t.ref))?.at ?? t.created;
    ref(t.ref);
    text(` was auto-assigned to you at ${at.replace(/^today /, '')}. Nobody has looked at it.`);
  });

  const unverified = top.find((t) => t.regulatoryUnverified && t.regulatoryClosedAt);
  return {
    queue, ranked, top, rest, headline, lines,
    caveat: unverified ? { ref: unverified.ref, at: unverified.regulatoryClosedAt! } : undefined,
  };
}

/** "in 25m" / "in 2h 55m" — how far ahead a future moment is, from the demo clock. */
export const aheadLabel = (hhmm: string, now = DEMO_NOW): string =>
  `in ${durationLabel(Math.max(0, minutesOf(hhmm) - minutesOf(now))).replace(/^0h /, '')}`;

void currentUser;
