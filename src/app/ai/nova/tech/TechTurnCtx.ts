import { createContext, useContext } from 'react';

/* IS THIS A TECHNICIAN ACTION TURN?
 *
 * The technician's forward actions are attached under the turn, not drawn by the cards. Inside
 * one of these turns a card renders no footer, registers the INPUTS its action needs (the hold as
 * edited, the note as typed) with the proposal registry, snapshots the store data it shows so a
 * later mutation cannot rewrite it, and may carry a stale marker. Outside one — a requester turn,
 * a leadership turn, TEC-07 — every card is exactly what it was.
 *
 * A context, for the same reason the requester's dock uses one: threading a flag through nine
 * components to reach a banner three levels down is how the one that gets missed ships a button.
 */
export interface TechTurn {
  turnId: string;
  /** This is the newest turn. A past turn's actions are inactive and its selection is cleared. */
  live: boolean;
}

export const TechTurnCtx = createContext<TechTurn | null>(null);

export const useTechTurn = (): TechTurn | null => useContext(TechTurnCtx);
