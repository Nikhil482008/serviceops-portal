import type { PlanDiff, PlanProposal } from '../scripts/registry';
import { diffPlans } from '../tech/planRevise';

/* THE FOUR ROWS — DERIVED, every one of them.
 *
 * The plan used to carry a "What will change" block authored beside it: three rows of prose that
 * happened to describe the six steps above them. Removing a step left the rows saying the old
 * thing until an author remembered to edit both. That is not a summary, it is a duplicate.
 *
 * These four are computed from the steps that are actually in the plan:
 *
 *   COVERS     what goes in the note      — every surviving step's `covers`
 *   SOURCE     where it comes from        — their `reads`, de-duplicated, in step order
 *   POSTS TO   where the note goes        — the delivery steps' `posts`
 *   CHANGES    what it touches            — nothing, and this row exists to SAY so
 *
 * "Changes" is constant and is the point of the card. Every other row grows and shrinks with the
 * plan; this one is the sentence the reader is actually looking for before pressing a button that
 * says Build, and a row that is always the same is exactly what a reassurance should be.
 *
 * A row with nothing left in it does not vanish — it says what its absence means. A plan with no
 * delivery step posts NOWHERE, and a card that simply dropped the row would let the reader read
 * past the most important consequence of what they just asked for.
 */

export interface SummaryRow {
  label: string;
  value: string;
  /** This row reads differently than it did in the plan this one replaced. */
  changed?: boolean;
}

/** "a, b and c" — the serial list, with no Oxford comma before a two-item "and". */
const listWords = (xs: string[]): string =>
  xs.length <= 1 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;

const uniq = (xs: string[]): string[] => [...new Set(xs)];

export function planSummary(p: PlanProposal): SummaryRow[] {
  const covers = p.steps.map((s) => s.covers).filter((x): x is string => !!x);
  const reads = uniq(p.steps.map((s) => s.reads).filter((x): x is string => !!x));
  const posts = p.steps.map((s) => s.posts).filter((x): x is string => !!x);
  return [
    { label: 'Covers', value: covers.length ? cap(listWords(covers)) : 'Nothing yet — every content step has been removed' },
    { label: 'Source', value: reads.length ? listWords(reads) : 'Nothing is read' },
    /* NOT OMITTED WHEN EMPTY. A plan with no delivery step tells nobody, and a card that simply
       dropped the row would let the reader read straight past the consequence of the change they
       just asked for. */
    { label: 'Posts to', value: posts.length ? cap(listWords(posts)) : 'Nobody — you will need to share it yourself' },
    /* CONSTANT, and stated rather than omitted. */
    { label: 'Changes', value: 'Nothing on the tickets themselves' },
  ];
}

const cap = (s: string): string => (s ? s[0].toUpperCase() + s.slice(1) : s);

/** The diff between two plans, WITH the summary rows that now read differently. Computed here
 *  rather than in `diffPlans` because it is a fact about the rendered summary, not about the
 *  steps — and it is derived from the same two plans, so it cannot drift from the markers. */
export function withSummaryRows(before: PlanProposal, after: PlanProposal): PlanDiff {
  const d = diffPlans(before, after);
  const was = planSummary(before);
  const now = planSummary(after);
  const rows = now.filter((r, i) => r.value !== was[i]?.value).map((r) => r.label);
  return rows.length ? { ...d, rows } : d;
}
