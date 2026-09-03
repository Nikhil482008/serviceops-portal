import { UserMessage } from '../conversation/UserMessage';

/* The reader's turn in TEC-8.
 *
 * A WRAPPER, not a reimplementation. `UserMessage` already owns what the reader's side looks
 * like — the bounded box, the hover actions, the visually-hidden "You asked" heading — and
 * TEC-8's whole argument is that an agentic flow is the SAME conversation, not a separate
 * surface. A second user-message component would be the first place the two drifted apart.
 */
export function Tec8UserMessage({ text, onEdit }: {
  text: string;
  /** TEC-8's prompts are fixed, so editing is a no-op here rather than a missing affordance —
   *  the control stays where the reader expects it across every use case. */
  onEdit?: (text: string) => void;
}) {
  return <UserMessage question={text} onEditQuery={onEdit ?? (() => {})} />;
}
