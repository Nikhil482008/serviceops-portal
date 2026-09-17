import {
  DEMO_TODAY, getKb, listSimilar, raisedLabel, type KbArticle, type MockTicket,
} from '../mockTickets';

/* TEC-03, COMPOSED FROM THE STORE.
 *
 * "Ring any bells?" is answered by a count, a span of months, a fix and two ref lists — every one
 * of which is a fact the store already holds. The sentences here are templates; remove a resolved
 * case from the seed and the answer says "Seen 3 times", "3 of 3", and draws three dots, with no
 * edit anywhere else. That is the whole point of composing it: an authored "4" would keep saying
 * four after the data stopped agreeing.
 */

/** A month name from an "11 Feb 2026" date, which is how the store writes a resolution day. */
const monthOf = (d?: string): string => (d ?? '').split(' ')[1] ?? '';
/** That same date as a day number, for placing a dot on the axis. */
const dayOf = (d?: string): number => {
  const t = Date.parse(d ?? '');
  return Number.isNaN(t) ? NaN : t;
};

export interface MatchCase {
  ticket: MockTicket;
  /** Milliseconds, for the strip's geometry; NaN when the record has no resolution day. */
  at: number;
  month: string;
}

export interface PatternMatch {
  kb?: KbArticle;
  /** The resolved cases the article is linked to, oldest first. */
  cases: MatchCase[];
  /** Open tickets carrying the same signature, newest first. */
  open: MockTicket[];
  /** True when there is nothing to match — the caller renders the no-match variant instead. */
  empty: boolean;
  headline: string;
  /** Authored sentences; a [REF] in the text becomes a chip at render time. */
  lines: { label: string; text: string }[];
  confidence: string;
  /** "FEB–SEP" — first resolved case to today, which is the span the strip draws. */
  spanLabel: string;
  /** "Recurrence: 4 resolved cases between Feb and Jul, 2 open now." */
  ariaLabel: string;
}

/** The two clocks the strip spans: the first case, and today. */
export const stripRange = (cases: MatchCase[]): { from: number; to: number } => {
  const from = cases.length ? cases[0].at : Date.parse(DEMO_TODAY);
  return { from, to: Date.parse(DEMO_TODAY + 'T00:00:00Z') };
};

/** Where a case sits along the axis, 0–1. A single case sits at the left rather than dividing
 *  by a zero span. */
export const stripAt = (at: number, r: { from: number; to: number }): number =>
  (r.to <= r.from ? 0 : Math.min(1, Math.max(0, (at - r.from) / (r.to - r.from))));

/** THE FIX, IN THE WORDS THE RESOLUTIONS USE. Read off the article's config line rather than
 *  typed into a sentence, so a change to the lease changes what the answer recommends. */
const leasePhrase = (kb?: KbArticle): string => {
  const line = (kb?.config ?? []).find((c) => /lease/i.test(c) && /\d/.test(c));
  const secs = (line ?? '').match(/(\d+)s/g)?.map((x) => parseInt(x, 10)) ?? [];
  if (secs.length < 2) return 'extend the lease on the WLC';
  const mins = (n: number) => (n % 3600 === 0 ? `${n / 3600}h` : `${Math.round(n / 60)}-minute`);
  return `extend the ${mins(secs[0])} lease on the WLC to ${mins(secs[1])}`;
};

/** CONFIRMED SIGNATURE FIRST, THEN NEWEST. Both open tickets are about VPN at Bengaluru, but
 *  only one records the network - and the network is what makes it this pattern rather than some
 *  other VPN fault. A ticket with nothing in that field is a candidate, not a match, so it does
 *  not get to be the thing the Link action targets by default just for being a day newer. */
const signed = (t: MockTicket): number => (t.affectedScope ? 0 : 1);
const newestFirst = (a: MockTicket, b: MockTicket): number =>
  signed(a) - signed(b)
  || (Date.parse(b.createdOn ?? '') || -Infinity) - (Date.parse(a.createdOn ?? '') || -Infinity);

/** Why the default target is the default — so the action's meta can say it rather than assert
 *  "newest" over a list that was not ordered by age. */
export const targetReason = (open: MockTicket[]): string =>
  (open[0]?.affectedScope ? 'same signature' : 'newest match');

/** The open tickets that carry the signature: at the same site, still open, same subject. This is
 *  a QUERY, not a list — adding a third Bengaluru VPN ticket to the seed puts it on the turn. */
export const openMatches = (tickets: MockTicket[], site: string, word: RegExp): MockTicket[] =>
  tickets.filter((t) => t.site === site && word.test(t.title)).sort(newestFirst);

export function patternMatch(kbId: string, open: MockTicket[]): PatternMatch {
  const kb = getKb(kbId);
  const cases: MatchCase[] = listSimilar(kb?.linked ?? [])
    .filter((t) => t.status === 'Resolved' || t.status === 'Closed')
    .map((t) => ({ ticket: t, at: dayOf(t.resolvedOn), month: monthOf(t.resolvedOn) }))
    .sort((a, b) => a.at - b.at);

  const n = cases.length;
  const refs = cases.map((c) => `[${c.ticket.ref}]`).join(' ');
  const months = n ? `${cases[0].month} to ${cases[n - 1].month}` : '';
  /* The network they share, if they all share one. "all on BLR wireless" is only sayable when it
     is true of every case; two sites and the line says how many instead. */
  const nets = [...new Set(cases.map((c) => (c.ticket.scope ?? '').replace(/-\d/, '')))];
  const where = nets.length === 1 && nets[0] ? `all on ${nets[0]}` : `${n} sites`;
  const spanLabel = n
    ? `${cases[0].month} – ${monthOf(DEMO_TODAY) || 'Sep'}`.toUpperCase()
    : '';

  /* THE NO-MATCH VARIANT. Never "Seen 0 times": with nothing to match, the honest answer is that
     there is no pattern, and the only thing worth saying is what to do instead. */
  if (!n) {
    return {
      kb, cases, open, empty: true,
      headline: 'No — nothing on record matches this pattern.',
      lines: [
        { label: 'Not seen before', text: 'No resolved case carries this signature. Nothing to copy a fix from.' },
        { label: 'To confirm', text: 'Move the user to wired or the guest SSID. If the drops stop on the dot, it is the lease.' },
      ],
      confidence: 'Low confidence — no similar case to compare against.',
      spanLabel: '',
      ariaLabel: `Recurrence: no resolved cases, ${open.length} open now.`,
    };
  }

  const resolvedWithFix = cases.filter((c) => /lease/i.test(c.ticket.resolution ?? '')).length;
  return {
    kb, cases, open, empty: false,
    headline: "Yes — it's the DHCP lease on the Bengaluru wireless controller.",
    lines: [
      { label: `Seen ${n} time${n === 1 ? '' : 's'}`,
        text: `${months}, ${where}. Same fix each time: ${leasePhrase(kb)}, per [${kbId}]. ${refs}` },
      { label: 'Likely open now',
        /* Lower case: the number opens a CLAUSE after the lead-in's dash, not a sentence. */
        text: open.length
          ? `${open.length === 1 ? 'one' : open.length === 2 ? 'two' : String(open.length)} Bengaluru VPN ticket${open.length === 1 ? '' : 's'} match the signature. Link one and I'll apply the fix.`
          : 'No open Bengaluru VPN ticket matches the signature yet.' },
      { label: 'To confirm',
        /* Lower case for the same reason as the line above: it continues the lead-in. */
        text: "move the user to wired or the guest SSID. If the drops stop on the dot, it's the lease." },
    ],
    confidence: `High confidence — ${resolvedWithFix} of ${n} similar cases resolved this way.`,
    spanLabel,
    ariaLabel: `Recurrence: ${n} resolved case${n === 1 ? '' : 's'} between ${cases[0].month} and ${cases[n - 1].month}, ${open.length} open now.`,
  };
}

/** "Raised 2 days ago" / "Raised yesterday" / "Raised today" — the match card's right-hand slot,
 *  computed so it cannot go stale the way a written date does. */
export const raisedAgo = (t: MockTicket): string => {
  if (!t.createdOn) return t.created ? `Raised ${t.created}` : '';
  const d = Math.floor(
    (Date.parse(DEMO_TODAY + 'T00:00:00Z') - Date.parse(t.createdOn + 'T00:00:00Z')) / 86400000,
  );
  if (d <= 0) return 'Raised today';
  if (d === 1) return 'Raised yesterday';
  if (d < 30) return `Raised ${d} days ago`;
  return `Raised ${raisedLabel(t.createdOn)}`;
};
