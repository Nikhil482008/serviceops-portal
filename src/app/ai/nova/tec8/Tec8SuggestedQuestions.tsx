import { FollowUpSuggestions } from '../conversation/FollowUpSuggestions';

/* WHAT ELSE I COULD ASK, after the work is done.
 *
 * The shared component, unchanged. Its heading is visually hidden — a pill carrying a speech
 * bubble and a question is self-describing, and the brief for this module settled that twice —
 * so a listener still hears "You could also ask" and a reader is not told what they can see.
 *
 * They stay QUIETER than the completion result above them. What actually changed on the ticket
 * is the thing a technician came back for; the next question is an offer, not the conclusion.
 */
export function Tec8SuggestedQuestions({ questions, onAsk }: {
  questions: string[];
  onAsk: (q: string) => void;
}) {
  return <FollowUpSuggestions questions={questions} live onAsk={onAsk} />;
}
