import { ageLabel, groupByStatus, raisedLabel, type MockTicket, type StatusGroup } from '../mockTickets';
import { numberWord, Sentence, statusPhrase } from './statusSentences';

/* WHAT THE READER HAS OUTSTANDING — composed once, read by the card, the insight line and the
 * clipboard.
 *
 * ONE GROUPING CALL. `groupByStatus` runs here and nowhere else in the turn; the headline
 * number, the sub-line, the bar and the legend are all rendered from `groups`. There is no
 * second query to disagree with the first.
 *
 * "OPEN" IS A STATUS, NOT A CATEGORY. The store has a status literally named `Open`, so the
 * umbrella word for everything not yet finished is UNRESOLVED. The only place `Open` appears in
 * what Nova says is a legend entry or a phrase naming that one status.
 */

/** A line that has a clickable reference in the middle of it. The renderer draws the ref as a
 *  chip; the clipboard joins the parts with nothing between them. */
export type Token = { t: 'text'; v: string } | { t: 'ref'; v: string };

export interface UnresolvedSummary {
  total: number;
  groups: StatusGroup[];
  needs: MockTicket[];
  /** The conclusion — the turn's headline when the script authored none. */
  headline: string;
  /** "3 being worked on · 1 not picked up yet" — same array, same order as the bar. */
  subline: string;
  /** Authored per RULE, not per ticket. */
  insight: Token[];
}

/** Needs-you first, then most recently updated. The order the cards render in, and the order
 *  the insight picks its `start with` from. */
export const sortForReader = (tickets: MockTicket[]): MockTicket[] =>
  [...tickets].sort((a, b) => (a.needsYou === b.needsYou ? 0 : a.needsYou ? -1 : 1));

export function unresolvedSummary(tickets: MockTicket[]): UnresolvedSummary {
  const groups = groupByStatus(tickets);
  const total = groups.reduce((n, g) => n + g.count, 0);
  const needs = sortForReader(tickets).filter((t) => t.needsYou);
  const subline = groups.map((g) => `${g.count} ${statusPhrase(g.status)}`).join(' · ');

  const headline = total === 0 ? 'Nothing unresolved right now'
    : needs.length === 0 ? `${Sentence(numberWord(total))} unresolved — all moving without you`
      : needs.length === 1 ? `${Sentence(numberWord(total))} unresolved — one is waiting on you`
        : `${Sentence(numberWord(total))} unresolved — ${numberWord(needs.length)} are waiting on you`;

  const insight: Token[] = [];
  const text = (v: string) => insight.push({ t: 'text', v });
  if (total === 0) {
    /* Nothing to say about nothing. The headline already said it. */
  } else if (needs.length === 1) {
    const [n] = needs;
    text('The one to look at is ');
    insight.push({ t: 'ref', v: n.ref });
    /* The reason is the RECORD'S, not this function's — the flag and its explanation are one
       field apart, so they cannot come apart. */
    text(n.needsYouReason ? ` — ${n.needsYouReason}.` : '.');
    if (total > 1) text(` The other ${numberWord(total - 1)} ${total - 1 === 1 ? 'is' : 'are'} moving without you.`);
  } else if (needs.length > 1) {
    text(`${Sentence(numberWord(needs.length))} of these need something from you — start with `);
    insight.push({ t: 'ref', v: needs[0].ref });
    text('.');
  } else {
    /* Oldest by the date it was raised; a record with no date sorts last rather than first. */
    const oldest = [...tickets].sort((a, b) => (a.createdOn ?? '9999').localeCompare(b.createdOn ?? '9999'))[0];
    text('Nothing needs you right now. The oldest is ');
    insight.push({ t: 'ref', v: oldest.ref });
    text(`, raised ${raisedLabel(oldest.createdOn) || oldest.created}.`);
  }

  return { total, groups, needs, headline, subline, insight };
}

export const tokensToText = (parts: Token[]): string => parts.map((p) => p.v).join('');

/** A card's second line: where it came from and how long it has been there. */
export const raisedLine = (t: MockTicket): string => {
  const raised = raisedLabel(t.createdOn);
  const age = ageLabel(t.createdOn);
  if (!raised) return t.created;
  return `Raised ${raised} · ${age}`;
};
