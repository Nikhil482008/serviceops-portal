import { useNovaConversationOptional } from '../NovaConversationProvider';
import { prefersReducedMotion } from '../novaMotion';
import { answerVisible } from '../turnModel';
import { useTechTurn } from './TechTurnCtx';

/* "CHANGED BELOW ↓" — the stale marker on a past card.
 *
 * A turn is never edited after it renders. When a later What-changed turn alters something an
 * earlier card shows — a queue row's status, a ticket's hold state — the earlier card keeps its
 * data exactly as it was and gains this tag, top-right, which scrolls to where the truth now is.
 *
 * DERIVED, NOT STORED: the card says which refs it renders, and this compares them against the
 * `changed.refs` of every later turn's answer. The refs come from the mutation's own return
 * value, so a card is marked stale by what actually changed and never by what a label claimed. */
export function StaleTag({ refs }: { refs: readonly string[] }) {
  const tech = useTechTurn();
  const conv = useNovaConversationOptional();
  if (!tech || !conv || !refs.length) return null;
  const turns = conv.turns;
  const i = turns.findIndex((t) => t.id === tech.turnId);
  if (i < 0) return null;
  const later = turns.slice(i + 1).find((t) => answerVisible(t) && !!t.answer?.changed?.refs.some((r) => refs.includes(r)));
  if (!later) return null;
  return (
    <button
      type="button"
      className="nova-stale"
      data-stale
      data-stale-target={later.id}
      data-in-element="stale"
      title="This card shows the state before a later action changed it"
      onClick={() => {
        document.querySelector(`[data-turn="${later.id}"]`)?.scrollIntoView({
          block: 'start', behavior: prefersReducedMotion() ? 'auto' : 'smooth',
        });
      }}
    >Changed below ↓</button>
  );
}
