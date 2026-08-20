/* Ask AI — timing constants.
 *
 * `AI_TYPE_SPEED_MS` existed twice in TicketPropertiesPanel as an unnamed `8`: once as the
 * typewriter's interval (`:1174`) and once inside `responseText.length * 8 + 500` (`:1056`), the
 * hand-computed delay before the follow-up pills appear. Two copies of one number, where the
 * second is a GUESS at how long the first will take — change the speed and the pills desync.
 *
 * Naming it does not fix that coupling, and this commit does not try to: the follow-up scheduler
 * belongs to the canned-response model, which the service layer replaces. It does mean the guess
 * and the thing it is guessing about can no longer drift apart silently.
 */

/** Milliseconds per character in the ticket panel's canned-answer typewriter. */
export const AI_TYPE_SPEED_MS = 8;

/* Deliberately NOT here: a shared `useTypewriter` hook.
 *
 * The plan called for one, and on inspection the two surfaces do not share the need. The ticket
 * panel reveals text it already has — it knows the full string up front and animates a prefix of
 * it. The docked panel renders deltas as they arrive off a stream; there is no full string to
 * reveal and nothing to animate. Writing one hook over both would mean the streaming panel
 * pretending to know an ending it has not been told yet.
 *
 * What the two DO share is the cadence, which is why the constant is here: the mock adapter emits
 * its deltas at this rate so the demo reads at the speed the product already types at.
 */
