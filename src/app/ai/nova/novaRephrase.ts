import { intentOf, type Intent } from './scripts/fallbacks';

/* WHAT NOVA THINKS YOU ASKED — said out loud, before it answers.
 *
 * ── THE PROBLEM ──────────────────────────────────────────────────────────────────────────────
 * Between a typed sentence and the work that follows there is a step nobody sees: the assistant
 * decides what the sentence MEANT. When it gets that right, nothing is lost by saying so. When
 * it gets it wrong, the reader finds out at the end — after the waiting, after the answer, from
 * an answer to a question they did not ask. The cost of being wrong is paid entirely at the
 * point where it is most expensive to fix.
 *
 * So the reading comes first, in the two seconds before the checks start, where correcting it
 * costs one click.
 *
 * ── AN OPERATIONAL RESTATEMENT, NOT A PARAPHRASE ─────────────────────────────────────────────
 * "Log an incident: laptop screen flickers when docked." Intent verb, object, and the one
 * qualifier that decides the work — docked, not "sometimes", not "on my ThinkPad". A paraphrase
 * that returns the sentence in different words proves nothing: the reader already knows what
 * they wrote. What they cannot see is which of the things they said Nova treated as the task.
 *
 * ── IT NEVER CHANGES WHAT RUNS ───────────────────────────────────────────────────────────────
 * This module is display only. `detectIntent`/`scriptForQuestion` still run on the ORIGINAL
 * message, and if the two disagree the original wins — the rephrase is a claim about the work,
 * and a claim that could redirect the work would not be a claim, it would be the work. The
 * disagreement is logged in dev so it shows up as the defect it is rather than as a mystery.
 *
 * ── AND IT IS MOCKED, WHICH IS WHY IT IS AUTHORED ────────────────────────────────────────────
 * Seven requester cases have a written restatement. Anything else gets a PLACEHOLDER —
 * "<intent>: <first eight words>…" — which is marked dev-only where it is shown, because a
 * generated restatement that looks authored is a prototype teaching someone to trust a
 * paraphrase nothing produced.
 */

export type RephraseMode =
  /** Written for this case. */
  | 'authored'
  /** Already an operational request — there is nothing to restate. */
  | 'as-written'
  /** Generated scaffolding. Marked as such wherever it is shown. */
  | 'placeholder';

export interface Rephrase {
  /** What goes after "Reading it as:" and inside the NOVA READ IT AS quotes. */
  text: string;
  mode: RephraseMode;
  /** The collapsed line, for the first two seconds. */
  line: string;
}

/** THE SEVEN, one per requester case. Keyed by case id where the turn carries one, and matched
 *  by phrase otherwise — a reader typing REQ-01's question by hand gets REQ-01's reading. */
const AUTHORED: Array<{ case: string; match: RegExp; text: string }> = [
  { case: 'REQ-01', match: /flicker|docking station|dock(ed|ing)?\b.*screen|screen.*dock/i,
    text: 'Log an incident: laptop screen flickers when docked.' },
  { case: 'REQ-02', match: /\bvpn\b.*(ticket|request|update|status)|(ticket|request).*\bvpn\b/i,
    text: 'Status of my VPN ticket.' },
  { case: 'REQ-03', match: /shared mailbox|mailbox.*(escalat|urgent|weeks|sitting)|escalat.*mailbox/i,
    text: 'Escalate my shared-mailbox ticket.' },
  { case: 'REQ-04', match: /authentication failed|password.*(vpn|chang)|vpn.*(auth|password)/i,
    text: 'Fix VPN authentication failing after a password change.' },
  { case: 'REQ-05', match: /counter 3|passbook|printer.*counter|counter.*printer/i,
    text: "Add counter 3's printer to my passbook-printer ticket." },
  { case: 'REQ-06', match: /unresolved|still open|my (open|outstanding) (tickets|requests)|what'?s open/i,
    text: 'List my unresolved tickets.' },
  { case: 'REQ-07', match: /bounce|fuel card|email.*bounc/i,
    text: 'Close the email-bounce ticket; status of the fuel-card ticket.' },
];

/** The verbs that make a sentence already operational. Same vocabulary the intent map is built
 *  from, so "precise" means the same thing in both places. */
const OPENERS = /^(log|raise|create|open|close|escalate|chase|show|list|find|check|update|add|set|assign|cancel|reopen|status)\b/i;

/** How the intent reads in a placeholder. */
const INTENT_LABEL: Record<Intent, string> = {
  troubleshoot: 'Troubleshoot',
  status: 'Status',
  create: 'Create',
  escalate: 'Escalate',
  update: 'Update',
  analysis: 'Analyse',
};

/** ALREADY PRECISE: short, and it starts with a verb the intent map knows. Both conditions, not
 *  either — "escalate the thing that has been going on since the migration, which by the way…"
 *  starts with a verb and is not an operational request. */
export const isOperational = (q: string): boolean => {
  const words = q.trim().split(/\s+/).filter(Boolean);
  return words.length < 8 && OPENERS.test(q.trim());
};

export function rephraseFor(question: string, caseId?: string): Rephrase {
  const q = question.trim();
  if (!q) return { text: 'Taken as written.', mode: 'as-written', line: 'Reading it as written' };

  const said = (hit: { text: string }): Rephrase =>
    ({ text: hit.text, mode: 'authored', line: `Reading it as: ${hit.text}` });

  /* A CASE ID IS EXPLICIT — the turn was opened as that case, so its reading is that case's. */
  const byCase = caseId ? AUTHORED.find((a) => caseId.startsWith(a.case)) : undefined;
  if (byCase) return said(byCase);

  /* NOTHING TO RESTATE, and this is checked BEFORE the phrase match. "Show my open tickets" is
     already the operational form of REQ-06's question; matching it to REQ-06 and handing back
     "List my unresolved tickets." would be the assistant rewording a sentence that needed no
     rewording — which is the one thing a restatement must never do. */
  if (isOperational(q)) return { text: 'Taken as written.', mode: 'as-written', line: 'Reading it as written' };

  const hit = AUTHORED.find((a) => a.match.test(q));
  if (hit) return said(hit);

  const words = q.split(/\s+/).filter(Boolean);
  const head = words.slice(0, 8).join(' ');
  const text = `${INTENT_LABEL[intentOf(q)]}: ${head}${words.length > 8 ? '…' : ''}`;
  return { text, mode: 'placeholder', line: `Reading it as: ${text}` };
}

/** How long the reading holds the collapsed line before the checks take it — a floor, not a
 *  duration. Two seconds is long enough to read one clause and short enough that nobody waiting
 *  for an answer notices they waited. */
export const REPHRASE_MS = 2000;

/** THE DISAGREEMENT, SURFACED. The reading is display only — `scriptForQuestion` and `intentOf`
 *  run on the ORIGINAL message and the original always wins. But a restatement that classifies
 *  the sentence differently from the thing that ran is a real defect in the restatement, and one
 *  that is invisible by construction: the reader sees a sensible line above a sensible answer and
 *  never learns the two were about different questions. So it is said out loud in dev, once per
 *  turn, where it reads as the bug it is rather than as a mystery. */
export function checkRephrase(question: string, r: Rephrase): void {
  if (!import.meta.env?.DEV || r.mode !== 'authored') return;
  const ran = intentOf(question);
  const read = intentOf(r.text);
  if (ran === read) return;
  // eslint-disable-next-line no-console
  console.warn(
    `[nova] the reading and the work disagree: "${question}" runs as "${ran}", `
    + `but is read as "${r.text}" ("${read}"). The original wins — fix the restatement.`,
  );
}
