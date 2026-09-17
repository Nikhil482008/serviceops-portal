import type { NovaContext } from './novaSources';
import type { UserRole } from './novaSuggestions';

/* ENHANCE PROMPT — make the question easier to answer well, and say what was added.
 *
 * The sparkle used to open a list of suggested prompts. Prompts already have two homes (the
 * greeting's cards, and the header menu's Saved prompts), so a third was a duplicate. What the
 * composer can do that neither of those can is take the question ALREADY TYPED and sharpen it.
 *
 * ── IT ADDS WHAT THE SYSTEM ALREADY KNOWS. IT NEVER INVENTS FACTS ────────────────────────────
 * Every rule below either removes noise, or fills in something Nova can see without asking: the
 * record open behind the drawer, who is asking, a window a vague time word left open, and what a
 * good answer has to contain. None of them states anything about the estate — an enhancer that
 * guessed "the P1 from this morning" would be putting a claim in the reader's mouth.
 *
 * ── AND IT SHOWS ITS WORKING ────────────────────────────────────────────────────────────────
 * Every rule that fires returns a NOTE, and the composer prints them beside an Undo. Silently
 * rewriting someone's words is the thing to avoid: they pressed a button, so they are owed a
 * sentence saying what it did and one click to take it back.
 *
 * Returns null when nothing applies — a prompt that is already specific is left alone and told
 * so, rather than being padded to prove the button works.
 */

export interface Enhanced {
  text: string;
  /** What each rule that fired contributed, in the order applied. */
  notes: string[];
}

/** Openers that carry no information. "Can you show me my tickets" is the same request as
 *  "show me my tickets", one of them shorter. */
const THROAT = /^(?:hey\s+nova[,\s]+|hi\s+nova[,\s]+|nova[,\s]+|please\s+|can\s+you\s+|could\s+you\s+|would\s+you\s+|i\s+want\s+to\s+know\s+|i\s+was\s+wondering\s+|i\s+need\s+to\s+know\s+|just\s+)/i;

/** Deixis the drawer can resolve, because it knows what is open behind it. */
const DEICTIC = /\bthis (ticket|incident|request|problem|change|dashboard|board|page|one|record)\b/i;

/** A time word that names no time. */
const VAGUE_TIME = /\b(recently|lately|these days|at the moment|nowadays|of late)\b/i;
/** A window that is already concrete, so rule 4 leaves it alone. */
const REAL_TIME = /\b(today|yesterday|this (week|month|quarter|year)|last (week|month|quarter|year|\d+)|\d+\s*(h|hr|hrs|hours|d|days|weeks|months)\b|since|between|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/i;

/** The reader is already in it. POSSESSIVES only: a bare "me" is usually the dative — "show
 *  me tickets" says nothing about whose they are, and reading it as ownership is what stopped
 *  rule 3 from firing on the most common phrasing there is. */
const OWNED = /\b(my|mine|our|ours|assigned to me|for me|of mine)\b/i;
/** Words that mean tickets in the plural — what rule 3 scopes. */
const WORKLOAD = /\b(tickets|incidents|requests|queue|cases|alerts)\b/i;

/** The prompt already says what shape the answer should take. */
const HAS_SHAPE = /\b(list|order|rank|sort|compare|summari[sz]e|draft|steps?|table|chart|breakdown|top \d|in order of|group(ed)? by)\b/i;

const WINDOW: Record<UserRole, string> = {
  requester: 'as of today',
  technician: 'in the last 24 hours',
  leadership: 'this month, against last month',
};

/* One shape per role would put a queue's sentence on a question about a single record — "what
   is happening with INC-0035? Put them in order of SLA risk" is worse than adding nothing. */
const SHAPE: Record<UserRole, { one: string; many: string }> = {
  requester: {
    one: 'Tell me what is happening and whether anything is waiting on me.',
    many: 'Tell me what is happening with each, and whether anything is waiting on me.',
  },
  technician: {
    one: 'Say what it needs from me next, and when it breaches.',
    many: 'Put them in order of SLA risk and say what each one needs from me.',
  },
  leadership: {
    one: 'Give me the number, what moved, and what is driving it.',
    many: 'Give me the numbers, what moved, and what is driving them.',
  },
};

/** Is the question about more than one thing? What rule 5 reads to choose its sentence. */
const PLURAL = /\b(them|all|each|which ones|every)\b/i;

const SCOPE: Record<UserRole, string> = {
  requester: 'my ',
  technician: 'my ',
  leadership: '',
};

/** Does this read as a question? Used for the terminator, in one place, so rule 5 and the tidy
 *  step cannot disagree about it. */
const INTERROGATIVE = /^(what|why|when|where|who|which|how|is|are|was|were|do|does|did|can|could|should|will|would|any)\b/i;

/** A prompt long enough to have said what it wants already. */
const DETAILED_WORDS = 18;

export function enhancePrompt(raw: string, opts: { role: UserRole; context?: NovaContext | null }): Enhanced | null {
  const { role, context } = opts;
  let s = raw.trim().replace(/\s+/g, ' ');
  if (!s) return null;
  const notes: string[] = [];

  /* 1 · the throat-clearing, as many times as it stacks ("Hey Nova, can you…"). */
  for (let i = 0; i < 3; i++) {
    const t = s.replace(THROAT, '');
    if (t === s) break;
    s = t;
    if (!notes.includes('trimmed the preamble')) notes.push('trimmed the preamble');
  }

  /* 2 · the record open behind the drawer, named. "Summarise this ticket" means nothing on its
     own; "Summarise INC-0035" can be answered by anyone who reads it. */
  if (context && DEICTIC.test(s) && !s.includes(context.label)) {
    s = s.replace(DEICTIC, context.label);
    notes.push(`named ${context.label}`);
  }

  /* 3 · whose. A technician asking about "tickets" means the ones assigned to them; the estate
     has thousands. */
  if (SCOPE[role] && WORKLOAD.test(s) && !OWNED.test(s)) {
    s = s.replace(WORKLOAD, (m) => `${SCOPE[role]}${m}`);
    notes.push(role === 'technician' ? 'scoped it to your queue' : 'scoped it to your own requests');
  }

  /* 4 · a window, where a vague word left one open. */
  if (VAGUE_TIME.test(s) && !REAL_TIME.test(s)) {
    s = s.replace(VAGUE_TIME, WINDOW[role]);
    notes.push('pinned the time window');
  }

  /* 5 · what a good answer contains — only for a short prompt that has not said. A detailed
     question has already made its own shape clear, and appending to it is padding. */
  const words = s.split(' ').filter(Boolean).length;
  if (!HAS_SHAPE.test(s) && words < DETAILED_WORDS) {
    const many = WORKLOAD.test(s) || PLURAL.test(s);
    const q = /\?$/.test(raw.trim()) || INTERROGATIVE.test(s);
    s = `${s.replace(/[.?!]+$/, '')}${q ? '?' : '.'} ${SHAPE[role][many ? 'many' : 'one']}`;
    notes.push('said what a good answer includes');
  }

  if (!notes.length) return null;

  /* Tidy: one capital at the front, one terminator at the end. Never reported — it is grammar,
     not a change worth a line of the reader's attention. */
  s = s.charAt(0).toUpperCase() + s.slice(1);
  if (!/[.?!]$/.test(s)) s += INTERROGATIVE.test(s) ? '?' : '.';
  return { text: s, notes };
}
