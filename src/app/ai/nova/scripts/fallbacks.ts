/* What runs when a question has no authored script — which is almost all of them.
 *
 * Twenty hand-written scripts would be twenty chances to disagree about pacing, and pacing is the
 * thing under evaluation. So three cases are authored (registry.ts) and everything else resolves
 * to its INTENT: three steps, no discoveries, a placeholder answer that says what it is.
 *
 * ⚠️ The fallbacks deliberately carry NO discoveries. That makes them the case that proves the
 * evidence footer degrades honestly — a turn with nothing found renders no footer at all, rather
 * than an empty box or three invented rows.
 */
import type { AnswerObject, Script } from './registry';

export type Intent =
  | 'troubleshoot'
  | 'status'
  | 'create'
  | 'escalate'
  | 'update'
  | 'analysis';

/** Ordered most-specific first. A question mentioning both "escalate" and "open" is an escalation
 *  — the verb the person used is what they want done, and the noun is only context. */
const INTENT_PATTERNS: Array<[Intent, RegExp]> = [
  ['escalate', /\bescalat|\burgent\b|\bchase\b|been sitting|months|priorit(y|ise|ize)/i],
  ['create', /\blog (a|this)\b|\braise\b|\bcreate\b|\bnew (ticket|request|incident)\b|book\b/i],
  ['update', /\badd (that|this|it)\b|\bnote that\b|\bput .* on hold\b|\bupdate the\b|\bclose (that|this|it)\b|draft a repl/i],
  ['status', /\bany update\b|\bwhat'?s (still )?open\b|\bstatus\b|\bwhere('?s| is)\b|\bhow (are|is) we\b|\bwaiting on\b/i],
  ['analysis', /\bversus\b|\bcompare\b|\btrend|\bwhy do\b|\bkeep(s)? coming back\b|\bbreach|\bat a glance\b|\bmost\b/i],
  ['troubleshoot', /\bfail|\berror\b|\bnot working\b|\bbroken\b|\bcan'?t\b|\bwon'?t\b|\bdrops?\b|\bflicker|\bslow\b|\bstuck\b/i],
];

/** Best-effort, and honest about it: an unmatched question is `analysis`, which is the intent
 *  whose fallback promises the least. */
export const intentOf = (question: string): Intent => {
  for (const [intent, re] of INTENT_PATTERNS) if (re.test(question)) return intent;
  return 'analysis';
};

const LABELS: Record<Intent, [string, string, string]> = {
  troubleshoot: ['Reading your description', 'Searching similar incidents', 'Checking the knowledge base'],
  status: ['Finding your open requests', 'Reading the latest activity', 'Checking who each is waiting on'],
  create: ['Reading your description', 'Checking your assigned assets', 'Working out where it should go'],
  escalate: ['Finding the ticket', 'Reading its history', 'Checking the escalation path'],
  update: ['Finding the ticket', 'Reading the current state', 'Preparing the change'],
  analysis: ['Gathering the relevant tickets', 'Comparing against the period before', 'Working out what moved'],
};

const TOPICS: Record<Intent, string> = {
  troubleshoot: 'what is going wrong',
  status: 'where your requests stand',
  create: 'what you want raised',
  escalate: 'how to escalate this',
  update: 'the ticket you mean',
  analysis: 'the shape of this',
};

/** The placeholder answer. It says plainly that this path is not authored, because a mock that
 *  invents a confident answer for an unscripted question is exactly how a prototype teaches
 *  people to trust something that was never computed. */
const placeholder = (intent: Intent): AnswerObject => ({
  form: 'text',
  /* The PRIMARY line, in the answer register — it is the honest headline for this case. */
  title: 'No authored answer for this one yet',
  /* And the explanation as what it is: a note to whoever is building this, marked as
     scaffolding rather than dressed up as a response. */
  devNote: `Resolved to the “${intent}” fallback — three generic checks and this placeholder. `
    + 'Only REQ-01, REQ-02, REQ-04, TEC-01, TEC-02, CXO-02 and CXO-07 have authored scripts; the '
    + 'rest of the set exists to exercise pacing, not content.',
  followUps: ['Ask something else', 'Show me what is authored'],
});

export const fallbackScript = (intent: Intent): Script => ({
  topic: TOPICS[intent],
  beats: [
    { kind: 'step', id: `${intent}-1`, label: LABELS[intent][0] },
    { kind: 'step', id: `${intent}-2`, label: LABELS[intent][1] },
    { kind: 'step', id: `${intent}-3`, label: LABELS[intent][2] },
    { kind: 'answer', payload: placeholder(intent) },
  ],
});
