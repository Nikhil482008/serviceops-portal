import { Check } from 'lucide-react';

/* WHAT WAS CHOSEN, WHERE IT WAS CHOSEN.
 *
 * When the dock runs a mutate or a navigate option, this line goes beneath the answer it acted
 * on: a green check, the option's number in a keycap, the option's label. It is the record that
 * the reader decided — a question they asked renders as their own turn instead, exactly as a
 * chip used to, so an `ask` option never produces one of these.
 *
 * Focusable (tabIndex -1) so the drawer can land focus on it after an in-turn action, where
 * there is no new answer headline to land on.
 */
export function ChosenLine({ n, label }: { n: number; label: string }) {
  return (
    <p className="nova-chosen" data-chosen-line data-n={n} tabIndex={-1}>
      <Check size={12} className="nova-chosen-check" aria-hidden="true" />
      <span className="nova-keycap nova-keycap-sm" aria-hidden="true">{n}</span>
      <span className="sr-only">You chose option {n}: </span>
      <span className="nova-chosen-label">{label}</span>
    </p>
  );
}
