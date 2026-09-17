import type { PlanDiff, PlanProposal, PlanStep } from '../scripts/registry';

/* CHANGING A PLAN, AND SAYING WHAT CHANGED.
 *
 * ── WHY IDS, NEVER TITLES ────────────────────────────────────────────────────────────────────
 * The old diff was authored as strings: `removed: ['Attach the overnight SLA clocks']`. That is
 * a second copy of a step's title living somewhere the step cannot see, and it is wrong in both
 * directions. Retitle a step and the diff reports one step gone and another arrived, when the
 * reader changed a word. Author two steps whose titles happen to match and the diff cannot tell
 * them apart at all. A step's identity is its `id`; `diffPlans` compares nothing else, and the
 * titles it renders are read off the steps themselves, so a title can never disagree with what
 * the diff says about it.
 *
 * ── FIVE INSTRUCTIONS, AND AN HONEST NO ──────────────────────────────────────────────────────
 * This is a mock and says so. Five phrasings are understood; each maps to an operation on step
 * IDS, so they compose — "drop the SLA clocks" then "don't notify" leaves four steps, not the
 * second revision applied to the original. Anything else comes back as ONE LINE saying what can
 * be changed, with the plan untouched. A prototype that silently applied a canned revision to
 * whatever was typed would be teaching the reader that Nova understood them.
 */

/** One understood instruction. `test` is checked in order, most specific first. */
interface Instruction {
  id: string;
  test: (s: string) => boolean;
  /** Applied to the plan AS IT STANDS, so instructions compose across revisions. */
  apply: (p: PlanProposal) => PlanProposal;
}

const has = (s: string, re: RegExp): boolean => re.test(s);

/** Drop steps by id, and every summary claim those steps were the reason for. */
const without = (p: PlanProposal, ids: string[]): PlanProposal => ({
  ...p,
  steps: p.steps.filter((s) => !ids.includes(s.id)),
  impact: p.impact.filter((i) => !i.stepId || !ids.includes(i.stepId)),
});

export const INSTRUCTIONS: Instruction[] = [
  /* FIRST, because it is the only one that names more than one thing and would otherwise be
     caught by a narrower test — "burning and regulator only" contains neither "don't" nor
     "shorter", but it does mean "drop the other two". */
  {
    id: 'burning-regulator-only',
    test: (s) => has(s, /burning/i) && has(s, /regulat/i) && has(s, /\bonly\b|\bjust\b|nothing else/i),
    apply: (p) => without(p, ['p2', 'p4', 'p7']),
  },
  {
    id: 'no-notify',
    test: (s) => has(s, /(don'?t|do not|no|without|skip|drop|remove)\b[^.]{0,16}\bnotif/i),
    apply: (p) => without(p, ['p6']),
  },
  {
    id: 'drop-sla',
    test: (s) => has(s, /\bsla\b|clock/i),
    apply: (p) => without(p, ['p4']),
  },
  {
    id: 'add-closed',
    test: (s) => has(s, /clos(ed|ing)/i),
    apply: (p) => (p.addable && !p.steps.some((s) => s.id === p.addable!.id)
      /* The added step goes before the delivery steps, not at the end: a plan that posts and then
         gathers more is not a plan anyone would approve. */
      ? { ...p, steps: insertBefore(p.steps, p.addable, 'p5'), addable: undefined }
      : p),
  },
  {
    id: 'shorter',
    /* SHORTER IS ABOUT THE PLAN, NOT THE HANDOVER. It strips each step's explanatory line and
       leaves the step, because what the reader is saying is "I know what these do". */
    test: (s) => has(s, /short|brief|concise|terse|tighten|trim|less detail/i),
    apply: (p) => ({ ...p, steps: p.steps.map((s) => (s.detail ? { ...s, detail: undefined } : s)) }),
  },
];

function insertBefore(steps: PlanStep[], add: PlanStep, beforeId: string): PlanStep[] {
  const at = steps.findIndex((s) => s.id === beforeId);
  if (at < 0) return [...steps, add];
  return [...steps.slice(0, at), add, ...steps.slice(at)];
}

/** What Nova says when it did not understand. One line, and it names what it CAN do rather than
 *  apologising — a refusal that lists the alternatives is a menu, not a dead end. */
export const REVISE_ASK =
  "I can add today's closed tickets, drop the SLA clocks, narrow it to burning and regulator, "
  + 'skip the notification, or make it shorter — which of those did you mean?';

export interface Revision {
  /** The revised plan. The SAME object when nothing was understood. */
  proposal: PlanProposal;
  /** Set when nothing was understood: the plan is unchanged and this is the whole reply. */
  ask?: string;
  /** Which instruction fired, for the suite and for dev logging. */
  matched?: string;
}

export function revisePlan(current: PlanProposal, text: string): Revision {
  const hit = INSTRUCTIONS.find((i) => i.test(text));
  if (!hit) return { proposal: current, ask: REVISE_ASK };
  const next = hit.apply(current);
  /* An instruction that matched but changed nothing — "drop the SLA clocks" twice — is still an
     honest no: there is nothing to show as a diff, so say so rather than render an empty one. */
  if (same(current, next)) return { proposal: current, ask: `That is already the plan — ${REVISE_ASK}`, matched: hit.id };
  return { proposal: next, matched: hit.id };
}

const sig = (p: PlanProposal): string => p.steps.map((s) => `${s.id}:${s.label}:${s.detail ?? ''}`).join('|');
const same = (a: PlanProposal, b: PlanProposal): boolean => sig(a) === sig(b);

/* ── THE DIFF ────────────────────────────────────────────────────────────────────────────── */

/** THE ONLY COMPARISON. Ids decide what is the same step; titles are read off the steps and are
 *  never matched on. A step whose title changed is CHANGED, in place, keeping its number. */
export function diffPlans(before: PlanProposal, after: PlanProposal): PlanDiff {
  const wasById = new Map(before.steps.map((s) => [s.id, s]));
  const nowIds = new Set(after.steps.map((s) => s.id));

  const added = after.steps.filter((s) => !wasById.has(s.id)).map((s) => s.id);
  const changed = after.steps
    .filter((s) => { const w = wasById.get(s.id); return !!w && (w.label !== s.label || w.detail !== s.detail); })
    .map((s) => s.id);
  /* REMOVED STEPS KEEP THEIR SEAT. `at` is the index the step held in the plan the reader
     approved-or-reviewed, so the list can strike it in place instead of listing it somewhere
     else and asking the reader to work out where it used to be. */
  const gone = before.steps
    .map((s, at) => ({ step: s, at }))
    .filter(({ step }) => !nowIds.has(step.id));

  return {
    added: added.length ? added : undefined,
    removed: gone.length ? gone.map((g) => g.step.id) : undefined,
    changed: changed.length ? changed : undefined,
    gone: gone.length ? gone : undefined,
  };
}

/** Is this diff worth rendering? A revision that moved nothing should not paint markers. */
export const diffIsEmpty = (d: PlanDiff | undefined): boolean =>
  !d || (!d.added?.length && !d.removed?.length && !d.changed?.length);
