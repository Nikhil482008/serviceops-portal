import { useSyncExternalStore } from 'react';

/* ONE REQUEST: "put this in the box and let me fix it."
 *
 * "Not what I meant?" lives at the bottom of an expanded thinking trail, four components down
 * from the drawer that owns the composer. Threading a callback through all four would make every
 * view in between carry a prop about a thing none of them do — the same reason selection and
 * focus live in `techStore` rather than in the card that draws a checkbox.
 *
 * So it is a store with one slot: the text to put in the box, and where the caret should land in
 * it. The drawer reads it, seeds the composer and clears the slot.
 *
 * TWO CALLERS, OPPOSITE INSTRUCTIONS. "Not what I meant?" is a CORRECTION and hands the text back
 * SELECTED, because the next keystroke should replace it. "Change the plan" hands back a PREFIX
 * with the caret at the end, because the next keystroke continues it — the dock has taken the
 * box's seat, so the old fill-the-input path has to come through here too.
 */
export interface ComposeRequest {
  text: string;
  /** So the same text can be requested twice — comparing the string alone would ignore the
   *  second press. */
  nonce: number;
  /** Where the caret lands. `all` for a CORRECTION — the next keystroke should replace what is
   *  there. `end` for a PREFIX the reader is expected to finish ("Change the plan: "), which is
   *  the opposite instruction and would be destroyed by a selection. */
  select: 'all' | 'end';
}

let pending: ComposeRequest | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function requestCompose(text: string, select: 'all' | 'end' = 'all'): void {
  pending = { text, nonce: (pending?.nonce ?? 0) + 1, select };
  emit();
}

export function clearCompose(): void {
  if (!pending) return;
  pending = null;
  emit();
}

const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
const getSnapshot = () => pending;

export const useComposeRequest = (): ComposeRequest | null =>
  useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

/** For harnesses. */
export const resetCompose = (): void => { pending = null; emit(); };
