import { fill } from '../mockAnalytics';
import { scriptKeyOf, type NextStep } from './nextSteps';
import type { Turn } from '../turnModel';

/* WHAT A LEADERSHIP TURN OFFERS.
 *
 * ── AUTHORED FROM WHAT THE CASE ALREADY DECLARES ─────────────────────────────────────────────
 * Every row here is one of the case's own `followUps`, which is to say a script that already
 * exists and a question the reader could already ask. Nothing new is invented: the dock changes
 * WHERE the offer is made, not what the product can do. The `detail` lines are the one thing
 * written here, because a chip carried no second line and a dock row has one.
 *
 * ── ONE SENTENCE, NO EXCLAMATION ─────────────────────────────────────────────────────────────
 * Leadership keeps its register. A detail says what the reader gets, in the fewest words that
 * are still specific — "The breaches themselves, newest first", not "See all the breaches".
 *
 * ── THE DRILLS STAY IN THE CHART ─────────────────────────────────────────────────────────────
 * Clicking a bar is a drill into THAT segment: the action is inseparable from the mark that was
 * pressed, so it cannot be a row in a list under the answer — a row would have to name a segment,
 * and then there would be one row per bar. Same for the breadcrumb, which says where the reader
 * IS. Neither is a conversation action, and neither is duplicated here.
 *
 * ── AFTER A DRILL ────────────────────────────────────────────────────────────────────────────
 * A drill turn and a follow-up turn author no set of their own, so the walk carries the CASE's
 * set forward, minus anything the thread has already asked — the same rule the requester's dock
 * follows for an informational turn. An exhausted set is a real answer: no dock, and the box
 * asks "Anything else?".
 */

interface Offer {
  label: string;
  detail: string;
  caseId: string;
}

/** Matched on letters and digits only, so a filled numeral or an apostrophe cannot make one
 *  question look like two. Same normaliser the follow-up chips use. */
const plain = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, '');

const CASES: Record<string, Offer[]> = {
  'CXO-01': [
    { label: 'What caused the VPN increase?', caseId: 'CXO-01/cause',
      detail: 'The tickets behind the jump, and when it started' },
    { label: 'Which team took the hit?', caseId: 'CXO-01/team',
      detail: 'Where the extra volume landed' },
  ],
  'CXO-02': [
    { label: 'Show the {{breaches}} breached tickets', caseId: 'CXO-02/tickets',
      detail: 'The breaches themselves, newest first' },
    { label: 'How does Network compare to the other teams?', caseId: 'CXO-02/network',
      detail: 'Network against the other three, on the same scale' },
  ],
  'CXO-03': [
    { label: "Draft a note to TelcoNet's account manager", caseId: 'CXO-03/note',
      detail: 'A note you read before it goes anywhere' },
    { label: 'Which tickets are waiting on TelcoNet?', caseId: 'CXO-03/tickets',
      detail: 'Everything that vendor is holding' },
  ],
  'CXO-04': [
    { label: 'Notify the owners of the overdue and due-soon ones', caseId: 'CXO-04/notify',
      detail: 'One message per owner, for your review' },
    { label: 'What happened on INC-1077?', caseId: 'CXO-04/inc1077',
      detail: 'The overdue one, in full' },
  ],
  'CXO-05': [
    { label: 'Tell me more about the phishing one', caseId: 'CXO-05/phish',
      detail: 'What was reached, and what has changed since' },
    { label: 'What are the two still under investigation?', caseId: 'CXO-05/open',
      detail: 'The open cases and who holds them' },
  ],
  'CXO-06': [
    { label: 'Raise a problem record for the VPN one', caseId: 'CXO-06/prb-vpn',
      detail: 'The largest of the three, as a problem record' },
    { label: 'How much would fixing all three save?', caseId: 'CXO-06/save',
      detail: 'Hours and tickets, over a year' },
  ],
  'CXO-07': [
    { label: 'What are people asking about payroll?', caseId: 'CXO-07/payroll',
      detail: 'The biggest type, broken out' },
    { label: 'Which location has the most?', caseId: 'CXO-07/location',
      detail: 'HR cases by location' },
  ],
};

/** The case a turn belongs to — its own, or the one its drill or follow-up came from. */
export const leadershipCaseOf = (t: Turn): string | undefined =>
  scriptKeyOf(t)?.match(/^(CXO-\d{2})/)?.[1];

export function leadershipStepsFor(
  turns: Turn[],
  ask: (label: string, caseId: string) => void,
): NextStep[] {
  const asked = new Set(turns.map((t) => plain(t.question)));
  for (let i = turns.length - 1; i >= 0; i--) {
    const t = turns[i];
    if (!t.answer || (t.state !== 'settled' && t.state !== 'answering')) continue;
    const offers = CASES[leadershipCaseOf(t) ?? ''];
    if (!offers) continue;
    /* NOTHING TWICE. A question the thread has already put is not an offer, and a dock that
       re-offers it is asking the reader to read the same answer again. */
    const left = offers.map((o) => ({ ...o, label: fill(o.label) }))
      .filter((o) => !asked.has(plain(o.label)));
    return left.map<NextStep>((o, n) => ({
      id: `${t.id}:${o.caseId}`,
      label: o.label,
      detail: o.detail,
      kind: 'ask',
      /* THE FIRST IS THE DEFAULT. The scripts author their follow-ups in priority order, and the
         leading one is the drill the case was built to invite. */
      recommended: n === 0,
      turnId: t.id,
      run: () => ask(o.label, o.caseId),
    }));
  }
  return [];
}
