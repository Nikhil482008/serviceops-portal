import { createContext, useContext } from 'react';

/* IS THIS TURN'S FORWARD ACTION IN THE DOCK?
 *
 * The card primitives (DraftCard, DiffCard, NoteComposer, the picker, the close list, the
 * confirmation banner) serve three personas. For a requester turn their forward actions —
 * Create, Escalate, Post, the banner's "Add a note" — live in the Next-step dock above the
 * input, so the card renders no button and REGISTERS its runner instead. For a technician or
 * leadership turn the same card keeps its footer exactly as it always had.
 *
 * A context rather than a prop, because the alternative was threading `dock` through nine
 * components to reach a banner three levels down — and the one that got missed would have
 * rendered a button in a requester turn. Reading it where it is needed cannot be forgotten.
 */
export interface RequesterDock {
  /** The turn these cards belong to — the key the proposal registry files them under. */
  turnId: string;
}

export const RequesterDockCtx = createContext<RequesterDock | null>(null);

/** Null outside a requester turn — which is what makes every primitive's default the old one. */
export const useRequesterDock = (): RequesterDock | null => useContext(RequesterDockCtx);
