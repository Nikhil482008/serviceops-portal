import { useSyncExternalStore } from 'react';

/* WHAT THE TECHNICIAN HAS SELECTED, PER TURN — and one focus request.
 *
 * Selection lives on the TURN, not in the card: the attached action beneath the list has to read
 * it to relabel ("Start 2 selected"), and the two are siblings, not parent and child. Same shape
 * as the proposal registry and the ticket store — mutations write, `useSyncExternalStore` reads —
 * and cleared for a turn the moment that turn goes past.
 *
 * `focusTurn` is the one thing here that is not selection: an action opened a reply, and once it
 * lands the drawer moves focus to its headline. The drawer reads and clears it.
 */
export interface TechSnapshot {
  selection: Readonly<Record<string, readonly string[]>>;
  focusTurn: string | null;
}

let selection: Record<string, string[]> = {};
let focusTurn: string | null = null;
const listeners = new Set<() => void>();
let snapshot: TechSnapshot = { selection, focusTurn };

const emit = () => {
  snapshot = { selection: { ...selection }, focusTurn };
  listeners.forEach((l) => l());
};

export const selectionOf = (turnId: string): readonly string[] => selection[turnId] ?? [];

export function toggleSelected(turnId: string, ref: string, single = false): void {
  const cur = selection[turnId] ?? [];
  const next = cur.includes(ref) ? cur.filter((r) => r !== ref) : single ? [ref] : [...cur, ref];
  selection = { ...selection, [turnId]: next };
  emit();
}

export function setSelection(turnId: string, refs: string[]): void {
  selection = { ...selection, [turnId]: refs };
  emit();
}

export function clearSelection(turnId: string): void {
  if (!selection[turnId]?.length) return;
  const { [turnId]: _gone, ...rest } = selection;
  void _gone;
  selection = rest;
  emit();
}

export function requestFocus(turnId: string): void { focusTurn = turnId; emit(); }
export function clearFocus(): void { if (focusTurn === null) return; focusTurn = null; emit(); }

const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
const getSnapshot = () => snapshot;

export const useTechStore = (): TechSnapshot => useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

/** For harnesses. */
export function resetTechStore(): void {
  selection = {};
  focusTurn = null;
  emit();
}
