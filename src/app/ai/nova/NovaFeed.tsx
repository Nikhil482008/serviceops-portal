import type { Turn } from './turnModel';
import { NovaThinking } from './NovaThinking';
import { NovaWorkspace } from './NovaWorkspace';
import { NovaReveal } from './NovaReveal';
import { InvestigationState } from './conversation/InvestigationState';

/* The investigation, rendered.
 *
 * PURE. It consumes no stream, owns no timers that drive step order, and knows nothing about
 * where its turn came from — every row here is folded from events by `applyEvent` in the
 * controller. Swapping the mock for SSE changes `novaStream.ts` and nothing in this file.
 *
 * ── A ROUTER, AND NOTHING ELSE ───────────────────────────────────────────────────────────────
 * It used to hold the whole step feed inline as well. That work now lives in
 * `conversation/InvestigationState`, beside the other conversation layers, so the four roles a
 * turn has — said / doing / found / concluded — are four files rather than three files and a
 * long one.
 */

export function NovaFeed({ turn, onRetry }: { turn: Turn; onRetry?: () => void }) {
  /* Two presentations of the SAME turn. The view is a property of the investigation, chosen by
     whoever produced it — so this is a render branch, not a second feature with its own state,
     its own reducer and its own chance to disagree about what happened. */
  if (turn.view === 'thinking') return <NovaThinking turn={turn} />;
  if (turn.view === 'workspace') return <NovaWorkspace turn={turn} onRetry={onRetry} />;
  if (turn.view === 'reveal') return <NovaReveal turn={turn} onRetry={onRetry} />;
  return <InvestigationState turn={turn} onRetry={onRetry} />;
}
