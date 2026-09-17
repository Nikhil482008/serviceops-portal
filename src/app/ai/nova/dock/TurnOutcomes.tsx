import { ConfirmBanner } from '../conversation/cardKit';
import { ChosenLine } from './ChosenLine';
import { useDockStore } from './proposals';

/* WHAT THE DOCK LEFT ON THIS TURN.
 *
 * Every mutate or navigate option the dock ran on this turn, in order: the chosen line, and —
 * for an action that had no card to confirm through (closing INC-0790 from a status card,
 * reopening INC-0644 from a resolution note) — the banner or the record line a card would have
 * shown in its place. A card action's banner is the card's own; only the chosen line is added.
 */
export function TurnOutcomes({ turnId }: { turnId: string }) {
  const { chosen } = useDockStore();
  const list = chosen[turnId] ?? [];
  if (!list.length) return null;
  return (
    <div className="nova-outcomes" data-turn-outcomes>
      {list.map((c) => (
        <div key={c.at} className="nova-outcome">
          <ChosenLine n={c.n} label={c.label} />
          {c.outcome?.record && (
            <p className="nova-t-body nova-record" data-record>
              <span aria-hidden="true">✓</span>
              <span>{c.outcome.record}</span>
            </p>
          )}
          {c.outcome?.banner && (
            <div className="mt-2">
              <ConfirmBanner spec={{ text: c.outcome.banner.text }} mutatedRef={c.outcome.banner.ref} onAsk={() => {}} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
