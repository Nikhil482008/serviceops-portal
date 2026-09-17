import {
  ArrowUpRight, Bell, Bookmark, CheckCircle2, ChevronsUp, CirclePause, CirclePlay, Clock, Eye,
  Hash, List, MessageCircle, Pencil, PlusCircle, Link2, RotateCcw, Send, Sparkles,
  type LucideIcon,
} from 'lucide-react';
import type { DoIcon } from '../tech/icons';
import type { NextStep } from './nextSteps';

/* WHAT KIND OF THING THIS OPTION DOES — one glyph, for every persona's dock.
 *
 * ── TWO SOURCES, IN ORDER, AND THAT IS DELIBERATE ────────────────────────────────────────────
 * 1. THE AUTHORED VERB. A technician action already declares one (`DoIcon`, in tech/icons.tsx):
 *    it travels in the turn's context so the reader's own turn can wear the same glyph as the
 *    row they pressed. Two glyphs for one press would be a drift waiting to happen, so when an
 *    action names its verb, that verb wins.
 * 2. THE LABEL. Everything else — requester options, the plan's two rows, leadership follow-ups —
 *    derives from the words, because the labels are imperative sentences by construction: they
 *    are what the reader's own turn will say. An icon nobody has to remember to set is an icon
 *    that cannot be forgotten.
 *
 * `NextStep.kind` is `mutate | ask | navigate`: three values describing what the option does to
 * the SYSTEM, which is the right vocabulary for the dock's plumbing and the wrong one for its
 * face. "Close INC-0790" and "Escalate INC-0035" are both mutations and are not remotely the
 * same request. What the reader is scanning for is the VERB.
 *
 * ── THE ORDER MATTERS ────────────────────────────────────────────────────────────────────────
 * Most specific first. "Email is working — close it" contains both "working" and "close"; it is a
 * close. "Still broken — add a note" is a note. A QUESTION beats everything, because a label that
 * asks is a question whatever verb it opens with — "Should this be higher priority?" is not an
 * escalation, it is asking about one, and "Tell me more about the phishing one" is not drafting.
 *
 * The TECHNICIAN VERBS are appended AFTER the rules that were already here rather than merged
 * into them. Every one of those verbs also reaches the dock as an authored `icon`, so the
 * appended rules are the safety net, not the path — and putting them in front would have
 * repainted requester rows that have not changed ("Send the comment" is a written message, and
 * has always worn the pencil).
 *
 * ── AND THEN THE KIND, AND ONLY THEN A SHRUG ─────────────────────────────────────────────────
 * An unmatched label still knows whether it asks, navigates or changes something, so that is the
 * second tier. `Sparkles` is the last resort and means exactly "this is an assistant action and
 * nothing more specific is known" — it should be rare, and if it is not, this map is short a row.
 */

type Rule = { icon: LucideIcon; test: RegExp };

/** THE AUTHORED VERB → its glyph. The same twelve names `tech/icons.tsx` draws, as components
 *  rather than elements, because a dock row sizes its own icon. */
const BY_VERB: Record<DoIcon, LucideIcon> = {
  start: CirclePlay,
  open: ArrowUpRight,
  send: Send,
  hold: CirclePause,
  apply: CheckCircle2,
  link: Link2,
  chase: Bell,
  subscribe: Eye,
  save: Bookmark,
  reminder: Clock,
  refs: Hash,
  revise: Pencil,
};

const VERBS: Rule[] = [
  /* A QUESTION IS A QUESTION whatever verb opens it — the mark, or the word that opens it when
     the sentence carries none ("Tell me more about the phishing one"). */
  { icon: MessageCircle, test: /\?\s*$/ },
  { icon: MessageCircle, test: /^(what|which|who|when|why|how)\b|^tell me more\b/i },
  /* Reopen before close, or "Reopen the fuel-station ticket" reads as a close. */
  { icon: RotateCcw, test: /\breopen|\bundo\b|\brestore\b/i },
  { icon: CheckCircle2, test: /\bclose\b|closed\b|\bresolve|that fixed it|\bkeep it\b|\bconfirm\b|is working/i },
  { icon: ChevronsUp, test: /\bescalat|\braise\b|higher priority|high priority|\burgent\b/i },
  { icon: Clock, test: /how long|\bwhen will|\beta\b|\bremind|follow[- ]up|\bwait\b/i },
  /* Writing something: a note, a comment, a message to a person. */
  { icon: Pencil, test: /\bnote\b|\bcomment\b|\bdraft\b|\breply\b|\bnotify\b|\btell\b|\bask [A-Z]|\bpost\b|\bsend\b|\bmessage\b/i },
  /* ATTACHING one existing thing to another is not the same as making a new one, and on
     this turn the two sit next to each other: "Create the ticket" above "Add my docking
     station first", whose own detail reads "Link the dock so the ticket references it".
     Two identical plus signs on adjacent rows is an icon column that has stopped
     discriminating. */
  { icon: Link2, test: /\blink\b|\battach\b|\badd (my|the) (docking|dock|asset|device|laptop)/i },
  /* Bringing something INTO existence, or onto the record. */
  { icon: PlusCircle, test: /\bcreate\b|\blog\b|\braise a\b|\badd (a|the) (business impact|note)/i },
  { icon: List, test: /\bmy list\b|\bmy (open|unresolved) |\blist\b|\ball of them\b/i },
  { icon: ArrowUpRight, test: /\bshow\b|\bopen\b|\bview\b|\bsee\b|\bstatus\b|\bhistory\b/i },

  /* ── the technician's verbs, merged in from the attached actions ──────────────────────── */
  { icon: CirclePlay, test: /\bstart\b/i },
  { icon: CirclePause, test: /\bon hold\b|\bhold\b|\bpause\b/i },
  { icon: Bell, test: /\bchase\b/i },
  { icon: Eye, test: /\bsubscribe\b|\bwatch\b/i },
  { icon: Bookmark, test: /\bsave\b/i },
  { icon: Hash, test: /\bvendor refs?\b|\brefs\b|\breference numbers?\b/i },
  { icon: CheckCircle2, test: /\bbuild\b|\bapply\b/i },
  { icon: Pencil, test: /\bchange\b|\bedit\b|\brevise\b|\brecord the\b/i },
];

/** The second tier: what it does to the system, when the words did not say. */
const BY_KIND: Record<NextStep['kind'], LucideIcon> = {
  ask: MessageCircle,
  navigate: ArrowUpRight,
  mutate: Sparkles,
};

export function stepIcon(step: Pick<NextStep, 'label' | 'kind'> & { icon?: DoIcon }): LucideIcon {
  if (step.icon && BY_VERB[step.icon]) return BY_VERB[step.icon];
  const hit = VERBS.find((r) => r.test.test(step.label));
  return hit ? hit.icon : (BY_KIND[step.kind] ?? Sparkles);
}

/** For the suite and for dev: which rule fired, by name. */
export function stepIconName(step: Pick<NextStep, 'label' | 'kind'> & { icon?: DoIcon }): string {
  if (step.icon && BY_VERB[step.icon]) return `verb:${step.icon}`;
  const i = VERBS.findIndex((r) => r.test.test(step.label));
  if (i >= 0) return VERBS[i].icon.displayName ?? String(i);
  return `kind:${step.kind}`;
}
