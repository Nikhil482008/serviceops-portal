import { useSyncExternalStore } from 'react';

/* WHAT THE DOCK CAN RUN, AND WHAT IT ALREADY RAN.
 *
 * ── TWO THINGS, ONE STORE ────────────────────────────────────────────────────────────────────
 *   PROPOSALS   every card in a requester turn that can commit something registers here: its
 *               phase (idle · done · discarded), whether it can run right now (a note with no
 *               text cannot), and its RUNNER — the card's own `run`, so the reader's edits on the
 *               card are what gets committed. The dock's option 1 IS that runner.
 *   CHOSEN      what the dock ran on each turn — the number, the label, and for an action with no
 *               card of its own (close INC-0790 from a status card) the banner or record line
 *               that stands in for the card's confirmation.
 *
 * ── WHY NOT REACT STATE IN THE CARD ──────────────────────────────────────────────────────────
 * `useProposal` used to hold the phase in the card, and the card's own button read it. The
 * dock sits outside every turn, so it has to read every card's phase and call every card's
 * runner without being handed either through props — the same reason `mockTickets` is a store
 * rather than a prop. Same shape as that store: mutations write, `useSyncExternalStore` reads.
 *
 * ⚠️ NOTHING HERE DECIDES WHAT THE DOCK OFFERS. The selector (`nextSteps.ts`) reads this and the
 * ticket store and derives the options; this file only records facts.
 */

export type ProposalPhase = 'idle' | 'done' | 'discarded';

export interface ProposalRec {
  /** `${turnId}:${blockId}` — one card, in one turn. */
  key: string;
  turnId: string;
  blockId: string;
  phase: ProposalPhase;
  /** What the mutation produced — the created ref, the closed refs. */
  ref?: string;
  /** The card can commit right now. False for a note with no text, a picker with no pick. */
  canRun: boolean;
  /** Why it cannot — the dock's tooltip while it is disabled. */
  why?: string;
  /** HOW MUCH it would do, if the size is something the reader changes: boxes still ticked, rows
   *  filled in. The action's label reads this, so "Send 12 chases" can be true. Not the payload —
   *  that is fetched by calling the card; two copies of one fact would eventually disagree. */
  tally?: number;
}

/** What a dock action left behind when it had no card to confirm through. */
export interface Outcome {
  /** A confirmation banner — the same one a card would have shown. */
  banner?: { text: string; ref: string };
  /** A quiet record line — "Glad that worked — nothing else needed." */
  record?: string;
}

export interface Chosen {
  n: number;
  label: string;
  at: number;
  outcome?: Outcome;
}

export interface DockSnapshot {
  proposals: ReadonlyMap<string, ProposalRec>;
  chosen: Readonly<Record<string, readonly Chosen[]>>;
  /** Turn-level facts a dock action asserted that no ticket carries — REQ-04's "That fixed it"
   *  has no ticket to close, so the fact lives here. */
  marks: Readonly<Record<string, readonly string[]>>;
}

const proposals = new Map<string, ProposalRec>();
/* A runner COMMITS (the requester's card: the dock's option 1 runs it) or REPORTS (the
   technician's card: it hands back the inputs the attached action carries to its reply). */
const runners = new Map<string, () => unknown>();
let chosen: Record<string, Chosen[]> = {};
let marks: Record<string, string[]> = {};
const listeners = new Set<() => void>();
let snapshot: DockSnapshot = { proposals: new Map(proposals), chosen, marks };

const emit = () => {
  snapshot = { proposals: new Map(proposals), chosen: { ...chosen }, marks: { ...marks } };
  listeners.forEach((l) => l());
};

export const proposalKey = (turnId: string, blockId: string): string => `${turnId}:${blockId}`;

export function registerProposal(key: string, turnId: string, blockId: string, run: () => unknown): void {
  runners.set(key, run);
  if (!proposals.has(key)) {
    proposals.set(key, { key, turnId, blockId, phase: 'idle', canRun: true });
    emit();
  }
}

/** A card leaving the screen takes its runner with it; its PHASE stays, because "the note was
 *  posted" is still true after the card that posted it has gone. */
export function unregisterRunner(key: string): void {
  runners.delete(key);
}

export function setProposalCanRun(key: string, canRun: boolean, why?: string): void {
  const p = proposals.get(key);
  if (!p || (p.canRun === canRun && p.why === why)) return;
  proposals.set(key, { ...p, canRun, why });
  emit();
}

/** Publish how much the card would do. Emits only on a change, like `setProposalCanRun`. */
export function setProposalTally(key: string, tally: number): void {
  const p = proposals.get(key);
  if (!p || p.tally === tally) return;
  proposals.set(key, { ...p, tally });
  emit();
}

export function settleProposal(key: string, phase: ProposalPhase, ref?: string): void {
  const p = proposals.get(key);
  if (!p) { proposals.set(key, { key, turnId: key.split(':')[0], blockId: key.slice(key.indexOf(':') + 1), phase, ref, canRun: false }); emit(); return; }
  proposals.set(key, { ...p, phase, ref, canRun: false });
  emit();
}

/** Run a registered card's own committer. False when there is nothing registered — which the
 *  selector should already have turned into a disabled option. */
export function runProposal(key: string): boolean {
  const run = runners.get(key);
  if (!run) return false;
  run();
  return true;
}

/** Call a registered runner and hand back what it returned — a technician card's inputs, as the
 *  reader left them. `found: false` when nothing is registered under the key. */
export function callProposal(key: string): { found: boolean; value?: unknown } {
  const run = runners.get(key);
  if (!run) return { found: false };
  return { found: true, value: run() };
}

export const proposalOf = (turnId: string, blockId: string): ProposalRec | undefined =>
  proposals.get(proposalKey(turnId, blockId));

export function choose(turnId: string, entry: Omit<Chosen, 'at'>): void {
  chosen = { ...chosen, [turnId]: [...(chosen[turnId] ?? []), { ...entry, at: Date.now() }] };
  emit();
}

export const chosenOf = (turnId: string): readonly Chosen[] => chosen[turnId] ?? [];

export function mark(turnId: string, fact: string): void {
  if (marks[turnId]?.includes(fact)) return;
  marks = { ...marks, [turnId]: [...(marks[turnId] ?? []), fact] };
  emit();
}

export const marked = (turnId: string, fact: string): boolean => !!marks[turnId]?.includes(fact);

const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
const getSnapshot = () => snapshot;

/** Subscribe a component to the dock store. The snapshot's identity changes on every write. */
export const useDockStore = (): DockSnapshot => useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

/** For harnesses and the dev reset — the ticket store has one of these too. */
export function resetDockStore(): void {
  proposals.clear();
  runners.clear();
  chosen = {};
  marks = {};
  emit();
}
