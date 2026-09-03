import type { ReactNode } from 'react';
import { NovaMessage } from '../conversation/NovaMessage';

/* Nova's turn in TEC-8 — the shared identity row, unchanged.
 *
 * `working` keeps the Core in its investigating state, so the identity row carries the liveness
 * for the whole message and nothing below it needs a spinner of its own. That is true while Nova
 * is investigating AND while it is executing an approved plan: both are Nova doing work.
 */
export function Tec8NovaMessage({ working, startedAt, children }: {
  working: boolean;
  startedAt: number;
  children: ReactNode;
}) {
  return (
    <NovaMessage startedAt={startedAt} working={working}>{children}</NovaMessage>
  );
}
