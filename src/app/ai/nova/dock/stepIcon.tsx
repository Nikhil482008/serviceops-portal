import {
  ArrowUpRight, CheckCircle2, ChevronsUp, Clock, List, MessageCircle, Pencil, PlusCircle,
  Link2, RotateCcw, Sparkles, type LucideIcon,
} from 'lucide-react';
import type { NextStep } from './nextSteps';

/* WHAT KIND OF THING THIS OPTION DOES — one glyph, derived, never authored.
 *
 * ── WHY DERIVED ──────────────────────────────────────────────────────────────────────────────
 * `NextStep.kind` is `mutate | ask | navigate`: three values describing what the option does to
 * the SYSTEM, which is the right vocabulary for the dock's plumbing and the wrong one for its
 * face. "Close INC-0790" and "Escalate INC-0035" are both mutations and are not remotely the
 * same request. What the reader is scanning for is the VERB.
 *
 * So the verb is read off the label — presentation only, deriving from data that already exists
 * rather than asking every author to also declare an icon. An icon nobody has to remember to set
 * is an icon that cannot be forgotten, and the labels are imperative sentences by construction:
 * they are what the reader's own turn will say.
 *
 * ── THE ORDER MATTERS ────────────────────────────────────────────────────────────────────────
 * Most specific first. "Email is working — close it" contains both "working" and "close"; it is a
 * close. "Still broken — add a note" is a note. A question mark beats everything, because a label
 * that ends in "?" is a question whatever verb it opens with — "Should this be higher priority?"
 * is not an escalation, it is asking about one.
 *
 * ── AND THEN THE KIND, AND ONLY THEN A SHRUG ─────────────────────────────────────────────────
 * An unmatched label still knows whether it asks, navigates or changes something, so that is the
 * second tier. `Sparkles` is the last resort and means exactly "this is an assistant action and
 * nothing more specific is known" — it should be rare, and if it is not, this map is short a row.
 */

type Rule = { icon: LucideIcon; test: RegExp };

const VERBS: Rule[] = [
  /* A QUESTION IS A QUESTION whatever verb opens it. */
  { icon: MessageCircle, test: /\?\s*$/ },
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
];

/** The second tier: what it does to the system, when the words did not say. */
const BY_KIND: Record<NextStep['kind'], LucideIcon> = {
  ask: MessageCircle,
  navigate: ArrowUpRight,
  mutate: Sparkles,
};

export function stepIcon(step: Pick<NextStep, 'label' | 'kind'>): LucideIcon {
  const hit = VERBS.find((r) => r.test.test(step.label));
  return hit ? hit.icon : (BY_KIND[step.kind] ?? Sparkles);
}

/** For the suite and for dev: which rule fired, by name. */
export function stepIconName(step: Pick<NextStep, 'label' | 'kind'>): string {
  const i = VERBS.findIndex((r) => r.test.test(step.label));
  if (i >= 0) return VERBS[i].icon.displayName ?? String(i);
  return `kind:${step.kind}`;
}
