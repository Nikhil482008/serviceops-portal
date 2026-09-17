import { listVendorPending, type MockTicket } from '../mockTickets';
import { numberWord } from './statusSentences';

/* TEC-06, COMPOSED FROM THE VENDOR QUEUE.
 *
 * The same turn has to read at nine tickets across three vendors and at sixty-two across
 * twenty-seven. That is the whole design problem: at nine you can name everything, and at
 * sixty-two naming everything is the failure. So every sentence here has a CAP, and the overflow
 * becomes a count that is a link — never a longer sentence, never a scroll.
 *
 *   prose refs      at most 3 per line, then "and N more"
 *   cards           at most 3, ordered by urgency
 *   strip segments  at most 6 — five vendors and Others
 *   bulk actions    at most 5 fire directly; above that you get a checklist first
 *
 * Nothing about which dataset is loaded is visible anywhere below. The caps do the work.
 */

/** Chases older than this are overdue. Three days is the promise the team made, not a constant
 *  chosen here — it lives in the store as CHASE_OVERDUE_DAYS and is mirrored by the rule below. */
/** What each vendor is actually doing for us — the prose says "TelcoNet's fibre work", and this
 *  is where that phrase comes from. A vendor not named here contributes plain "work". */
export const VENDOR_WORK: Record<string, string> = {
  TelcoNet: 'fibre work',
  PrintCo: 'printer parts',
  CloudMail: 'relay',
  Ricoh: 'printer parts',
  DellCare: 'hardware parts',
  SecureID: 'token replacements',
};

export const OVERDUE_DAYS = 3;
/** Above this many chases, the action shows a checklist before sending anything. Five is the most
 *  a person will read as a sentence; past it "Chase the 14 overdue" is a number, not a list. */
export const BULK_PREVIEW_OVER = 5;
/** Refs named in one prose line before the rest become "and N more". */
export const PROSE_REF_CAP = 3;
/** Vendor segments on the strip before the rest become "Others". */
export const STRIP_SEGMENTS = 5;
/** Tickets left over before "Show the other N" becomes "Show all N by vendor". */
export const DRILL_FLAT_MAX = 12;

export const daysWaiting = (t: MockTicket): number => t.waitingDays ?? 0;
/** Days since the last chase. A ticket never chased is treated as infinitely stale, which is
 *  what it is — not as zero, which is what a missing number looks like. */
export const daysSinceChase = (t: MockTicket): number =>
  (t.lastChased === undefined && t.chaseAgeDays === undefined ? Infinity : t.chaseAgeDays ?? 0);
export const hasRef = (t: MockTicket): boolean => !!t.vendorRef;
export const isOverdue = (t: MockTicket): boolean => daysSinceChase(t) > OVERDUE_DAYS;

/** THE ORDERING, EXACTLY AS SPECIFIED:
 *    daysWaiting × (vendorRef ? 1 : 1.5) × (daysSinceChase > 3 ? 1.5 : 1)
 *  Waiting is the base; a missing ref means nobody can even find it at the vendor's end; an
 *  un-chased ticket is one nobody is pushing. The two multipliers compound, which is right —
 *  a ticket that is both is the one that will still be here next week. */
export const urgency = (t: MockTicket): number =>
  daysWaiting(t) * (hasRef(t) ? 1 : 1.5) * (isOverdue(t) ? 1.5 : 1);

export const byUrgency = (rows: MockTicket[]): MockTicket[] =>
  [...rows].sort((a, b) => urgency(b) - urgency(a) || daysWaiting(b) - daysWaiting(a) || a.ref.localeCompare(b.ref));

export interface VendorGroup {
  vendor: string;
  tickets: MockTicket[];
  avgWait: number;
  overdue: number;
}

export const groupByVendor = (rows: MockTicket[]): VendorGroup[] => {
  const m = new Map<string, MockTicket[]>();
  rows.forEach((t) => m.set(t.vendor ?? '—', [...(m.get(t.vendor ?? '—') ?? []), t]));
  return [...m.entries()]
    .map(([vendor, tickets]) => ({
      vendor,
      tickets: byUrgency(tickets),
      avgWait: Math.round((tickets.reduce((a, t) => a + daysWaiting(t), 0) / tickets.length) * 10) / 10,
      overdue: tickets.filter(isOverdue).length,
    }))
    .sort((a, b) => b.tickets.length - a.tickets.length || a.vendor.localeCompare(b.vendor));
};

/** Counts up to nine in words, above in numerals — a sentence reads better with "three" and a
 *  count reads better as "62". Capitalised only where it opens a sentence, by the caller. */
const count = (n: number): string => (n <= 9 ? numberWord(n) : String(n));
/* `numberWord` stops at nine, which is right for the count-inside-a-sentence rule. A count that
   OPENS a sentence has to be spelled however large it is, so this carries the teens and tens it
   needs and falls back to numerals past ninety-nine — at which point a headline is not the place
   for the number anyway. */
const TEENS = ['ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen',
  'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const spell = (n: number): string => {
  if (n <= 9) return numberWord(n);
  if (n < 20) return TEENS[n - 10];
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? `-${numberWord(n % 10)}` : '');
  return String(n);
};
/** The same count where it STARTS a sentence. "14 need chasing today." opens on a numeral, which
 *  nobody writes; the numerals rule is for counts inside a sentence. */
const opener = (n: number): string => cap1(spell(n));

/** "hold half" — the nearest of a third / half / most / almost all. A share is a FEELING at this
 *  point in a sentence; "50.4%" would be a different, more precise, less useful claim. */
const shareWord = (share: number): string => {
  const marks: Array<[number, string]> = [[0.33, 'a third'], [0.5, 'half'], [0.75, 'most'], [0.95, 'almost all']];
  let best = marks[0];
  for (const m of marks) if (Math.abs(share - m[0]) < Math.abs(share - best[0])) best = m;
  return `hold ${best[1]}`;
};

/** An English list: "A", "A and B", "A, B and C". */
export const listWords = (xs: string[]): string =>
  (xs.length <= 1 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

export type Token =
  | { t: 'text'; v: string }
  | { t: 'ref'; v: string }
  /** "and 11 more" — a count that opens the drill turn rather than a longer sentence. */
  | { t: 'more'; v: string; n: number };

/** Up to `cap` refs as chips, then one "and N more" link. The cap is the point of this file. */
const refTokens = (rows: MockTicket[], cap = PROSE_REF_CAP): Token[] => {
  const out: Token[] = [];
  const shown = Math.min(cap, rows.length);
  const spills = rows.length > cap;
  rows.slice(0, cap).forEach((t, i) => {
    /* The "and" belongs to the LAST item — and when the list spills, the last item is the count,
       not a ref. Otherwise the line reads "A, B and C and 11 more". */
    if (i) out.push({ t: 'text', v: !spills && i === shown - 1 ? ' and ' : ', ' });
    out.push({ t: 'ref', v: t.ref });
  });
  if (spills) out.push({ t: 'more', v: ` and ${rows.length - cap} more`, n: rows.length - cap });
  return out;
};

export interface VendorBrief {
  rows: MockTicket[];
  groups: VendorGroup[];
  ranked: MockTicket[];
  /** The three the cards show. */
  top: MockTicket[];
  overdue: MockTicket[];
  missingRef: MockTicket[];
  dueTomorrow: MockTicket[];
  /** Vendors with three or more tickets and nothing overdue. */
  onTime: string[];
  vendorsWithoutFeed: string[];
  headline: string;
  lines: Array<{ label: string; parts: Token[] }>;
  footnote: string;
  /** The strip: at most five vendors, then Others. */
  segments: Array<{ vendor: string; n: number; avgWait: number; others?: number }>;
  stripLabel: string;
  cardsLabel: string;
}

export function vendorBrief(rows = listVendorPending()): VendorBrief {
  const groups = groupByVendor(rows);
  const ranked = byUrgency(rows);
  const top = ranked.slice(0, 3);
  const overdue = byUrgency(rows.filter(isOverdue));
  const missingRef = byUrgency(rows.filter((t) => !hasRef(t)));
  const dueTomorrow = rows.filter((t) => t.eta === 'tomorrow');
  const onTime = groups.filter((g) => g.tickets.length >= 3 && g.overdue === 0).map((g) => g.vendor);
  const vendorsWithoutFeed = [...new Set(rows.filter((t) => t.vendorHasPortalFeed === false).map((t) => t.vendor ?? ''))];

  // ── the headline ────────────────────────────────────────────────────────────────────────────
  /* TWO FORMS, and the rule that picks between them is about whether naming every vendor is
     still possible. At three vendors the honest answer names all three; past that, naming them
     all is a list nobody reads, so it names only as many as cover half the queue. */
  const top3 = groups.slice(0, 3);
  const top3Share = top3.reduce((a, g) => a + g.tickets.length, 0) / (rows.length || 1);
  const small = groups.length <= 3 && top3Share >= 0.5;
  let headline: string;
  if (small) {
    /* A TALLY, not a sentence — commas all the way, no "and". The three counts are one fact
       said three times, and "and" would make the last one sound like a conclusion. */
    const parts = groups.map((g) => `${count(g.tickets.length)} on ${g.vendor}`);
    headline = `${opener(rows.length)} — ${parts.join(', ')}. ${opener(overdue.length)} need chasing today.`;
  } else {
    /* Name vendors only while they CUMULATIVELY cover half, and never more than three. */
    const named: VendorGroup[] = [];
    let acc = 0;
    for (const g of groups) {
      if (named.length >= 3 || acc / rows.length >= 0.5) break;
      named.push(g);
      acc += g.tickets.length;
    }
    headline = `${rows.length}, spread across ${groups.length} vendors — ${listWords(named.map((g) => g.vendor))} `
      + `${shareWord(acc / (rows.length || 1))}. ${opener(overdue.length)} need chasing today.`;
  }

  // ── the three lines ─────────────────────────────────────────────────────────────────────────
  const lines: VendorBrief['lines'] = [];

  /* 1 · STUCK LONGEST — the vendor holding the oldest tickets, and the two oldest by name. */
  const oldest = ranked[0];
  const oldestVendor = oldest?.vendor ?? '';
  const oldestTwo = byUrgency(rows.filter((t) => t.vendor === oldestVendor)).slice(0, 2);
  const work = VENDOR_WORK[oldestVendor] ?? 'work';
  const stuck: Token[] = [{ t: 'text', v: `${oldestVendor}'s ${work}. ` }];
  oldestTwo.forEach((t, i) => {
    stuck.push({ t: 'ref', v: t.ref });
    stuck.push({ t: 'text', v: i === 0 ? ` has waited ${daysWaiting(t)} days and ` : ` ${daysWaiting(t)}` });
  });
  /* Both bracketed clauses in the brief render only when they are true of THIS data. */
  if (oldestTwo.length === 2 && oldestTwo.every((t) => !hasRef(t))) {
    stuck.push({ t: 'text', v: '; neither has a vendor ref.' });
  } else {
    stuck.push({ t: 'text', v: '.' });
  }
  /* Only when it says something the clause before it did not: more tickets than the two just
     named, AND more vendors than the one this line is about. */
  const refVendors = new Set(missingRef.map((t) => t.vendor)).size;
  if (missingRef.length > oldestTwo.filter((t) => !hasRef(t)).length && refVendors > 1) {
    stuck.push({ t: 'text', v: ` ${missingRef.length} tickets across ${refVendors} vendors are missing refs altogether.` });
  }
  lines.push({ label: 'Stuck longest', parts: stuck });

  /* 2 · OVERDUE FOR A CHASE — and when the overdue set is mostly what line 1 just named, it says
     "those two plus X" rather than printing the same refs again eight words later. */
  const named = new Set(oldestTwo.map((t) => t.ref));
  const fresh = overdue.filter((t) => !named.has(t.ref));
  const reused = overdue.filter((t) => named.has(t.ref)).length;
  const chase: Token[] = [{ t: 'text', v: `${count(overdue.length)}. ` }];
  if (reused >= 2 && fresh.length <= 2) {
    chase.push({ t: 'text', v: 'Those two plus ' });
    fresh.forEach((t, i) => {
      if (i) chase.push({ t: 'text', v: ' and ' });
      chase.push({ t: 'ref', v: t.ref });
      chase.push({ t: 'text', v: ` at ${t.vendor}` });
    });
  } else {
    refTokens(overdue).forEach((x) => chase.push(x));
  }
  const noEta = overdue.every((t) => !t.eta);
  chase.push({ t: 'text', v: `. None chased in over ${OVERDUE_DAYS} days${noEta ? ', none with an ETA' : ''}.` });
  lines.push({ label: 'Overdue for a chase', parts: chase });

  /* 3 · MOVING — the ones that are fine, said briefly, because a queue described only by its
     failures reads worse than it is. */
  const moving = rows.filter((t) => hasRef(t) && !!t.eta);
  const move: Token[] = [{ t: 'text', v: `${count(moving.length)} have refs and ETAs. ` }];
  if (dueTomorrow.length) {
    refTokens(dueTomorrow, 2).forEach((x) => move.push(x));
    move.push({ t: 'text', v: dueTomorrow.length === 1 ? ' is due tomorrow' : ' are due tomorrow' });
  } else {
    move.push({ t: 'text', v: 'None has a date yet' });
  }
  if (onTime.length) {
    move.push({ t: 'text', v: `; ${listWords(onTime.slice(0, 2))} ${onTime.length === 1 ? 'is' : 'are'} on time across the board.` });
  } else {
    move.push({ t: 'text', v: '.' });
  }
  lines.push({ label: 'Moving', parts: move });

  // ── footnote, strip, labels ─────────────────────────────────────────────────────────────────
  const footnote = 'Chase dates are from ticket notes, not the vendor portals.'
    + (vendorsWithoutFeed.length ? ` ${vendorsWithoutFeed.length} vendors have no portal feed at all.` : '');

  const head = groups.slice(0, STRIP_SEGMENTS);
  const tail = groups.slice(STRIP_SEGMENTS);
  const segments = head.map((g) => ({ vendor: g.vendor, n: g.tickets.length, avgWait: g.avgWait }));
  if (tail.length) {
    const n = tail.reduce((a, g) => a + g.tickets.length, 0);
    segments.push({
      vendor: 'Others',
      n,
      avgWait: Math.round((tail.reduce((a, g) => a + g.avgWait * g.tickets.length, 0) / n) * 10) / 10,
      others: tail.length,
    });
  }

  return {
    rows, groups, ranked, top, overdue, missingRef, dueTomorrow, onTime, vendorsWithoutFeed,
    headline, lines, footnote, segments,
    stripLabel: `Waiting by vendor: ${groups[0]?.vendor ?? 'no vendor'} holds ${groups[0]?.tickets.length ?? 0} of ${rows.length} tickets.`,
    cardsLabel: `Needs a chase · ${overdue.length}${overdue.length > 3 ? ' · showing the 3 most urgent' : ''}`,
  };
}

function cap1(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
