import { useMemo } from 'react';
import { useNovaConversationOptional } from '../NovaConversationProvider';
import { useDockStore } from '../dock/proposals';
import { useTicketStore } from '../mockTickets';
import { techActionsFor, type TechActionSet } from './techActions';
import { useTechStore } from './techStore';
import type { Turn } from '../turnModel';

/* THE ACTION SET FOR ONE TURN, re-derived on every render.
 *
 * The selector is pure; this is the only place the four stores it reads are subscribed. Both
 * consumers use it — the attached do-actions under the turn, and the ask-chips above the input —
 * so the two can never disagree about what this turn offers.
 */
export function useTechActions(turn: Turn | undefined): TechActionSet | null {
  const conv = useNovaConversationOptional();
  const dock = useDockStore();
  const tech = useTechStore();
  const tickets = useTicketStore();
  const turns = conv?.turns;
  const selection = turn ? (tech.selection[turn.id] ?? []) : [];
  return useMemo(
    () => (turn && turns ? techActionsFor(turn, { turns, proposals: dock.proposals }, selection) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `tickets` is the store's snapshot: a new one means re-derive
    [turn, turns, dock, selection, tickets],
  );
}
