import { useSyncExternalStore } from 'react';

/* ONE REQUEST: "put this in the box and let me fix it."
 *
 * "Not what I meant?" lives at the bottom of an expanded thinking trail, four components down
 * from the drawer that owns the composer. Threading a callback through all four would make every
 * view in between carry a prop about a thing none of them do — the same reason selection and
 * focus live in `techStore` rather than in the card that draws a checkbox.
 *
 * So it is a store with one slot: the text to put in the box. The drawer reads it, seeds the
 * composer, selects the text (this is a correction — the next keystroke SHOULD replace it, which
 * is the opposite of the editing seed's caret-at-the-end rule) and clears the slot.
 */
export interface ComposeRequest {
  text: string;
  /** So the same text can be requested twice — comparing the string alone would ignore the
   *  second press. */
  nonce: number;
}

let pending: ComposeRequest | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function requestCompose(text: string): void {
  pending = { text, nonce: (pending?.nonce ?? 0) + 1 };
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
