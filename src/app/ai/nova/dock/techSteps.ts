import { callProposal, proposalKey } from './proposals';
import { clearSelection, requestFocus } from '../tech/techStore';
import type { DoAction, TechActionSet } from '../tech/techActions';
import type { MutationCall } from '../tech/mutations';
import type { Turn } from '../turnModel';
import type { NextStep } from './nextSteps';

/* A TECHNICIAN TURN'S ACTIONS, AS DOCK ROWS.
 *
 * ── NOTHING ABOUT WHAT AN ACTION MEANS IS DECIDED HERE ───────────────────────────────────────
 * `techActionsFor` still decides that, unchanged: same labels, same kinds, same order, same
 * recommended flag, same selection-awareness. This file is the ADAPTER — it turns that set into
 * the one shape the dock renders, so a technician turn's actions arrive at the reader through
 * exactly the surface a requester's do.
 *
 * ── THE META BECOMES THE DETAIL LINE ─────────────────────────────────────────────────────────
 * "· 40m to breach", "· preview first · 3 vendors", "· posts as you" used to trail the label
 * after a middle dot, because an attached button is one line and had nowhere else to put them.
 * A dock row has a second line, which is where a consequence belongs. No meta means NO detail
 * line and a single-line row — an empty second line is not a smaller row, it is a row that looks
 * like it lost something.
 *
 * ── THE CAP ──────────────────────────────────────────────────────────────────────────────────
 * Four rows, plus "Ask something else". Do-actions outrank asks, because a do is executable now
 * with what is on screen and an ask is a question the reader could also simply type — and typing
 * is one keystroke away on the row below. Asks are dropped from the END of their own authored
 * order, which is also where the demo-only ones sit.
 */

/** The reader's turn, opened by a press. Exactly what `AttachedActions.run` did. */
export type AskNova = (q: string, opts?: { caseId?: string; context?: Record<string, unknown> }) => string | null | undefined;

const MAX_ROWS = 4;

function runDo(turnId: string, d: DoAction, askNova: AskNova): void {
  if (d.disabled) return;
  let mutation: MutationCall | undefined;
  if (d.kind === 'mutate' && d.mutation) {
    if (d.mutation.block) {
      /* The card's inputs, AS THEY STAND — with the reader's edits. This is why Send in the dock
         posts the text the reader typed into the block above it: the row does not carry a copy
         of the draft, it asks the card for one at the moment it runs. */
      const key = proposalKey(d.mutation.onTurn ?? turnId, d.mutation.block);
      const r = callProposal(key);
      if (!r.found) return;
      mutation = { name: d.mutation.name, inputs: (r.value as Record<string, unknown>) ?? {} };
      /* The card is NOT settled. A technician turn is immutable — the card stays exactly as it
         was, and whether this has already run is read from the conversation. */
    } else {
      mutation = { name: d.mutation.name, inputs: d.mutation.inputs ?? {} };
    }
  }
  const id = askNova(d.said ?? d.label, {
    caseId: d.caseId,
    context: {
      action: { icon: d.icon, kind: d.kind },
      ...(mutation ? { mutation } : {}),
      ...(d.ref ? { ref: d.ref } : {}),
    },
  });
  clearSelection(turnId);
  if (id) requestFocus(id);
}

export function techStepsFor(turn: Turn, set: TechActionSet, askNova: AskNova): NextStep[] {
  const dos = set.dos.slice(0, MAX_ROWS).map<NextStep>((d) => ({
    /* ALREADY UNIQUE PER TURN — `finish` in techActions stamped `${turn.id}:${d.id}` — and stable
       across a selection change, which is what keeps a relabelling row from remounting. */
    id: d.id,
    label: d.label,
    detail: d.meta ?? '',
    kind: d.kind,
    icon: d.icon,
    recommended: d.recommended,
    disabled: d.disabled,
    disabledReason: d.disabledReason,
    turnId: turn.id,
    run: () => runDo(turn.id, d, askNova),
  }));
  /* WHAT GOES FIRST IS WHAT COULD NOT HAVE RUN. Over the cap, a demo-only ask (authored, shown
     disabled, "not in this demo") is dropped before a real one — it is the only row on the list
     that was never going to do anything. After that, from the end of the authored order. */
  const room = Math.max(0, MAX_ROWS - dos.length);
  const kept = [...set.asks];
  const dropped: string[] = [];
  while (kept.length > room) {
    let i = kept.length - 1;
    for (let j = kept.length - 1; j >= 0; j--) if (kept[j].disabled) { i = j; break; }
    dropped.push(kept[i].label);
    kept.splice(i, 1);
  }
  const asks = kept.map<NextStep>((a) => ({
    id: `${turn.id}:ask:${a.label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    label: a.label,
    detail: '',
    kind: 'ask',
    recommended: false,
    disabled: a.disabled,
    turnId: turn.id,
    run: () => { if (!a.disabled) askNova(a.label); },
  }));
  if (import.meta.env.DEV && dropped.length) {
    console.warn(`Action dock: ${dropped.length} ask(s) dropped by the four-row cap on ${turn.caseId ?? turn.id} — ${dropped.join(' · ')}`);
  }
  return [...dos, ...asks];
}
