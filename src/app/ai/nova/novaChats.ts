import { SCRIPTS } from './scripts/registry';
import type { Turn } from './turnModel';
import type { UserRole } from './novaSuggestions';

/* CHATS — return to previous work.
 *
 * A chat is a conversation as it stood when the reader left it: every turn, with its steps,
 * findings, answer, plan and timestamps, because a `Turn` is plain data and restoring one is
 * handing the same array back to the provider. Nothing here re-runs anything.
 *
 * ── A SEEDED CHAT CARRIES ITS QUESTIONS, NOT A PICTURE OF ITS ANSWERS ───────────────────────
 * Conversations from before this session are seeded with the questions that made them. The
 * first time one is opened, those questions are replayed through the same scripted
 * investigation, instantly, stamped with the chat's own time — so what appears is the real
 * conversation, produced by the same code, never a stored screenshot that drifts from it.
 *
 * ── THE TITLE IS THE SUBJECT, NOT THE QUESTION ──────────────────────────────────────────────
 * The header names the conversation by what it is about. Every authored case has a title here
 * (28 characters or fewer, so the header never truncates a demo case); anything unauthored is
 * titled by its own words with the question words stripped — see `autoTitle`. "New
 * conversation" appears only before anything has been asked.
 */

export interface NovaChat {
  id: string;
  title: string;
  /** Whose kind of conversation this is — read off the case its first question reached. */
  role: UserRole | null;
  createdAt: number;
  /** When it was last active — the newest turn's time, NOT when it was last looked at. Opening
   *  a chat to read it must not move it to the top of the list. */
  updatedAt: number;
  /** The conversation itself. Empty on a seeded chat until it is first opened. */
  turns: Turn[];
  /** A conversation from before this session: the questions that made it. */
  seed?: { questions: string[] };
}

export const ROLE_LABEL: Record<UserRole, string> = {
  requester: 'Requester', technician: 'Technician', leadership: 'Leadership',
};

/** The BASE case a question reaches — `TEC-01/overnight` is TEC-01's — by id when there is one,
 *  otherwise by the same word-match a typed question gets. Null for an unauthored question. */
export const caseIdFor = (question: string, caseId?: string): string | null => {
  const key = caseId ?? Object.keys(SCRIPTS).find((k) => SCRIPTS[k].match?.test(question)) ?? null;
  return key ? key.split('/')[0] : null;
};

export const roleOfCase = (caseId: string | null): UserRole | null => {
  if (!caseId) return null;
  if (caseId.startsWith('REQ-')) return 'requester';
  if (caseId.startsWith('TEC-')) return 'technician';
  if (caseId.startsWith('CXO-')) return 'leadership';
  return null;
};

/** One title per authored case. Twenty-eight characters or fewer, each — the header's
 *  truncation limit at the drawer's normal width — so no demo case ever shows an ellipsis. */
export const CHAT_TITLES: Record<string, string> = {
  'REQ-01': 'Laptop screen flicker',
  'REQ-02': 'VPN issue',
  'REQ-03': 'Shared mailbox escalation',
  'REQ-04': 'VPN after password change',
  'REQ-05': 'Counter 3 printer',
  'REQ-06': 'My open requests',
  'REQ-07': 'Closing fixed tickets',
  'TEC-01': 'Shift start priorities',
  'TEC-02': 'Bulk salary upload brief',
  'TEC-03': 'Bengaluru VPN drops',
  'TEC-04': 'Commercial Street on hold',
  'TEC-05': 'Merchant settlement update',
  'TEC-06': 'Vendor-pending tickets',
  'TEC-07': 'Night-shift handover',
  'CXO-01': 'June vs May volume',
  'CXO-02': 'SLA performance',
  'CXO-03': 'Vendor impact',
  'CXO-04': 'Regulatory incidents',
  'CXO-05': 'Security incidents',
  'CXO-06': 'Recurring problems',
  'CXO-07': 'Trending HR cases',
};

/* THE AUTO-TITLE.
 *   1. strip the question words from the front, as many times as they stack
 *      ("Any update on my VPN issue?" → "my VPN issue" → "VPN issue")
 *   2. keep at most five words of what is left
 *   3. drop a dangling function word from the end ("…tickets are" → "…tickets")
 *   4. sentence-case the FIRST letter only — an acronym stays an acronym
 * Falls back to the first five words when nothing is stripped. */
const LEAD = /^(?:any updates? on|what's|what is|what are|can you|could you|would you|please|show me|tell me|give me|find me|i need|i want|i'd like|is there|are there|do i have|help me|my|the|a|an)\s+/i;
const TAIL = new Set(['is', 'are', 'was', 'were', 'the', 'a', 'an', 'to', 'for', 'of', 'and', 'on', 'in', 'with', 'my', 'me', 'it', 'now', 'please', 'right', 'so', 'that', 'this']);

export const autoTitle = (question: string): string => {
  let s = question.trim().replace(/[?.!,;:]+$/, '').trim();
  for (let i = 0; i < 4; i++) {
    const t = s.replace(LEAD, '');
    if (t === s) break;
    s = t;
  }
  const words = s.split(/\s+/).filter(Boolean).slice(0, 5);
  while (words.length > 1 && TAIL.has(words[words.length - 1].toLowerCase())) words.pop();
  if (!words.length) return 'New conversation';
  const out = words.join(' ');
  return out.charAt(0).toUpperCase() + out.slice(1);
};

/** The title a question earns: its case's, or its own subject. */
export const titleFor = (question: string, caseId?: string): string => {
  const id = caseIdFor(question, caseId);
  return (id && CHAT_TITLES[id]) || autoTitle(question);
};

export const chatTitleOf = (turns: Turn[]): string =>
  titleFor(turns[0]?.question ?? '', turns[0]?.caseId);

/* ── when ───────────────────────────────────────────────────────────────────────────────── */
export type ChatGroup = 'Today' | 'Yesterday' | 'Previous 7 days' | 'Older';

const DAY = 86_400_000;
const HOUR = 3_600_000;
const MIN = 60_000;
const dayStart = (ts: number): number => { const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime(); };

export const groupOf = (ts: number, now: number): ChatGroup => {
  const today = dayStart(now);
  if (ts >= today) return 'Today';
  if (ts >= today - DAY) return 'Yesterday';
  if (ts >= today - 7 * DAY) return 'Previous 7 days';
  return 'Older';
};

/** The menu's two parts. Four groups is the right answer for a browsing list; a shelf of six
 *  rows only has to separate what happened today from what did not. */
export const isToday = (ts: number, now: number): boolean => groupOf(ts, now) === 'Today';

/** What a Recent-chats row says at its right edge. Under a TODAY heading the word "today" is
 *  the heading again, so a today row says the clock time it happened at instead. */
export const agoLabel = (ts: number, now: number): string => {
  const g = groupOf(ts, now);
  if (g === 'Today') return new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (g === 'Yesterday') return 'yesterday';
  return new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric' });
};

/** THE LINE UNDER A TITLE. A conversation that reached an answer is described by that
 *  answer's own headline — the sentence the reader came away with. One that did not is
 *  described by the words it started with, which are the reader's own. Nothing is summarised
 *  here: both are strings that already exist. */
export const chatPreview = (c: NovaChat): string => {
  for (let i = c.turns.length - 1; i >= 0; i--) {
    const a = c.turns[i].answer;
    const h = a?.headline ?? a?.title;
    if (h) return h;
  }
  const q = c.turns[0]?.question ?? c.seed?.questions[0];
  return q ? `Started with \u201c${q}\u201d` : '';
};

/** WHAT SEARCHING A CHAT MEANS — the title, and the reader's own questions. Never Nova's
 *  replies: nobody quotes an answer back to find the chat it was in. One function because the
 *  shelf and the full history both search, and two copies of this rule would drift. */
export const chatMatches = (c: NovaChat, needle: string): boolean =>
  !needle || [c.title, ...c.turns.map((t) => t.question), ...(c.seed?.questions ?? [])]
    .join('\n').toLowerCase().includes(needle);

/* ── the seeded history ─────────────────────────────────────────────────────────────────── */
const seed = (id: string, caseId: string, role: UserRole, at: number, questions: string[]): NovaChat =>
  ({ id, title: CHAT_TITLES[caseId], role, createdAt: at, updatedAt: at, turns: [], seed: { questions } });

/** FOURTEEN conversations from before this session, each a real authored case, asked in the
 *  words the use-case table uses so each one replays through its own script, and titled by the
 *  same table the header uses. Times are offsets from now, so "today" is never a time that has
 *  not happened yet.
 *
 *  Fourteen and not five because of what reads them: four date groups and a "Show all" cannot
 *  be judged on a list short enough to fit on the shelf whole. They span all four groups. */
export const seededChats = (now: number): NovaChat[] => [
  /* Today. */
  seed('seed-vpn', 'REQ-02', 'requester', now - 25 * MIN, ['Any update on my VPN ticket?']),
  seed('seed-open', 'REQ-06', 'requester', now - 80 * MIN, ["What's still open for me right now?"]),
  seed('seed-dock', 'REQ-01', 'requester', now - 110 * MIN,
    ['My laptop screen flickers whenever I put it on the docking station. Can you log a ticket for me?']),
  seed('seed-brief', 'TEC-02', 'technician', now - 3 * HOUR,
    ['I have the corporate banking RM on the line about the bulk salary upload failures. Give me a 30-second brief.']),
  /* Yesterday. */
  seed('seed-mailbox', 'REQ-03', 'requester', now - DAY - 3 * HOUR, ['Escalate the loans mailbox ticket']),
  seed('seed-vendor', 'TEC-06', 'technician', now - DAY - 6 * HOUR,
    ['Which of the pending tickets are stuck waiting on vendors, and for what?']),
  seed('seed-sla', 'CXO-02', 'leadership', now - DAY - 8 * HOUR, ['Are we meeting our SLAs? Where do we breach most?']),
  /* Previous 7 days. */
  seed('seed-hr', 'CXO-07', 'leadership', now - 2 * DAY, ['Show me the trending HR cases.']),
  seed('seed-handover', 'TEC-07', 'technician', now - 3 * DAY,
    ["Write my handover for the night shift: what's burning, what's blocked, and anything the regulator cares about."]),
  seed('seed-shift', 'TEC-01', 'technician', now - 5 * DAY,
    ['I just started my shift. What should I look at first?', 'What happened overnight?']),
  seed('seed-blr', 'TEC-03', 'technician', now - 6 * DAY,
    ['User in Bengaluru says VPN drops every 30 minutes on the dot and reconnects fine. Ring any bells?']),
  /* Older. */
  seed('seed-june', 'CXO-01', 'leadership', now - 11 * DAY, ['Walk me through June versus May.']),
  seed('seed-recurring', 'CXO-06', 'leadership', now - 16 * DAY,
    ['What problems keep coming back that we should fix permanently instead of patching?']),
  seed('seed-security', 'CXO-05', 'leadership', now - 24 * DAY,
    ['Any security incidents this year I should be worried about? Did we lose money or data in any of them?']),
];
