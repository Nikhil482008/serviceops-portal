import { deriveRequester } from '../../../components/TicketPropertiesPanel';
import { greetingFor, ROLE_QUESTION, type UserRole } from '../novaSuggestions';

/* WHO IS HERE, AND WHAT THEY ARE BEING OFFERED.
 *
 * ── THE HIERARCHY WAS INVERTED ───────────────────────────────────────────────────────────────
 * "Nova / SERVICEOPS AI" sat above a 19px greeting and the two competed; between them they made
 * the product's own name the loudest text on a screen whose subject is the person reading it.
 * Nobody opens an assistant to be told what it is called.
 *
 * So the identity becomes an EYEBROW — one small tracked line, present for recognition and for
 * nothing else — and the greeting is the hero. The role question sits under it in body size,
 * because it is the actual offer and it should read as a sentence rather than a heading.
 *
 * ── THE NAME ─────────────────────────────────────────────────────────────────────────────────
 * ⚠️ There is no auth object in this prototype. `deriveRequester()` returns a HARDCODED
 * placeholder identity ("Arnav Desai") and it is the same placeholder the ticket panel and the
 * conversation avatar already use. Using it here is consistent rather than invented — but the
 * name on this screen is not a logged-in user, and the moment there is a real one this is the
 * single line that has to change.
 */
const ME = deriveRequester();
const FIRST = ME.name.split(/\s+/)[0];

export function NovaGreeting({ userRole, now, context }: {
  userRole: UserRole;
  now?: Date;
  /** One true sentence about this person's estate, or nothing at all.
   *
   *  ⚠️ NOT FABRICATED. The brief asks for "You have 3 tickets approaching SLA" — and there is
   *  no honest source for that number in this prototype, so nothing is printed rather than a
   *  plausible one being invented. A made-up count on the hero screen is the one thing here
   *  that would actually cost the user trust, and it would cost it in a demo. */
  context?: string | null;
}) {
  return (
    <div className="text-center">
      {/* Identity, demoted to an eyebrow. Small, tracked, quiet — recognition, not billing. */}
      <p className="nova-eyebrow">
        Nova
        <span aria-hidden="true"> · </span>
        <span className="nova-eyebrow-sub">ServiceOps AI</span>
      </p>

      <h2 className="nova-hello">{greetingFor(now)}, {FIRST}.</h2>
      <p className="nova-hello-sub">{ROLE_QUESTION[userRole]}</p>

      {context && <p className="nova-hello-ctx">{context}</p>}
    </div>
  );
}
