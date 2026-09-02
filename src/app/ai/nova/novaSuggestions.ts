/* What the drawer offers before anything is asked.
 *
 * The cards differ by ROLE because the three personas want different things from the same estate:
 * a requester wants their own thing dealt with, a technician wants the shift compressed,
 * leadership wants the shape of the month. Offering a technician "what's still open for me" is
 * offering the wrong product.
 *
 * The role comes from the auth object as a prop. There is deliberately NO role selector in the
 * UI — a person has one role, and a control to change it would be asking them to configure
 * something the system already knows.
 *
 * These questions are drawn from the same 20-case benchmark the module is judged against
 * (`components/askAiUseCases.ts`), so what the drawer suggests and what it is measured on cannot
 * drift into two different products.
 */

export type UserRole = 'requester' | 'technician' | 'leadership';

/** Icon names, not components — this module renders lucide by name so the data stays plain and
 *  can be serialised, logged, or eventually served. */
export type NovaIcon =
  | 'ticket' | 'clock' | 'search' | 'list'
  | 'zap' | 'users' | 'shield' | 'pen' | 'inbox'
  | 'trending' | 'gauge' | 'building' | 'alert';

export interface NovaSuggestion {
  icon: NovaIcon;
  title: string;
  /** One line. It says what the answer will BE, not what the feature is. */
  subtitle: string;
  /** What is actually asked when the card is pressed. Written as a person would type it. */
  prompt: string;
}

/** The subline under the greeting — what this person is being offered, in their own terms. */
export const ROLE_SUBLINE: Record<UserRole, string> = {
  requester: 'Ask about your requests, or start a new one.',
  technician: 'Your queue, your shift, and the things waiting on someone else.',
  leadership: 'How the service is running, and what is driving it.',
};

export const ROLE_SUGGESTIONS: Record<UserRole, NovaSuggestion[]> = {
  requester: [
    {
      icon: 'ticket', title: 'Log a request',
      subtitle: 'Describe it once; a draft comes back ready to submit',
      prompt: 'My laptop screen flickers whenever I put it on the docking station. Can you log a ticket for me?',
    },
    {
      icon: 'clock', title: 'Where has mine got to',
      subtitle: 'The ones still open, and what each is waiting on',
      prompt: "What's still open for me right now?",
    },
    {
      icon: 'search', title: 'Fix it myself',
      subtitle: 'The steps for the thing that just stopped working',
      prompt: 'I changed my domain password and now VPN says authentication failed. What do I do?',
    },
    {
      icon: 'pen', title: 'Add to a request',
      subtitle: 'New detail on something already raised',
      prompt: "On my ticket about the passbook printer fading — the branch says counter 3's printer is now doing it too. Add that to the ticket.",
    },
  ],
  technician: [
    {
      icon: 'zap', title: 'Start my shift',
      subtitle: 'What to pick up first, and why it is first',
      prompt: 'I just started my shift. What should I look at first?',
    },
    {
      icon: 'users', title: 'Brief me before this call',
      subtitle: 'Thirty seconds on a ticket someone is asking about',
      prompt: 'I have the corporate banking RM on the line about the bulk salary upload failures. Give me a 30-second brief.',
    },
    {
      icon: 'search', title: 'Seen this before?',
      subtitle: 'Matching symptoms across the estate and what fixed them',
      prompt: 'User in Bengaluru says VPN drops every 30 minutes on the dot and reconnects fine. Ring any bells?',
    },
    {
      icon: 'pen', title: 'Draft the reply',
      subtitle: 'In plain language, ready to send',
      prompt: 'Draft a reply to the requester on the merchant settlement ticket: transmission fault found, file will go in a supplementary run today, credits by evening. Keep it professional, no jargon.',
    },
    {
      icon: 'inbox', title: 'Write my handover',
      subtitle: "What's burning, what's blocked, what the regulator cares about",
      prompt: "Write my handover for the night shift: what's burning, what's blocked, and anything the regulator cares about.",
    },
  ],
  leadership: [
    {
      icon: 'trending', title: 'This month versus last',
      subtitle: 'Volumes, what changed, and what drove it',
      prompt: 'Walk me through June versus May — volumes, what changed, and what drove it.',
    },
    {
      icon: 'gauge', title: 'Are we meeting our SLAs',
      subtitle: 'Where we breach, and how often',
      prompt: 'Are we meeting our SLAs? Where do we breach most?',
    },
    {
      icon: 'building', title: 'Which vendors are hurting us',
      subtitle: 'Ranked by the service quality they cost us',
      prompt: 'Which vendors are hurting our service quality the most?',
    },
    {
      icon: 'shield', title: 'Anything reportable',
      subtitle: 'Open items we have flagged to the regulator',
      prompt: "What's currently open that we've flagged as regulatory reportable?",
    },
    {
      icon: 'alert', title: 'What keeps coming back',
      subtitle: 'Repeat problems worth fixing rather than patching',
      prompt: 'What problems keep coming back that we should fix permanently instead of patching?',
    },
  ],
};

/** Morning / afternoon / evening, from the clock.
 *
 * Takes an optional date so the greeting can be tested and demonstrated at any hour rather than
 * only at the hour the suite happens to run — a time-aware string checked against the real clock
 * is a check that passes for eight hours a day. */
export const greetingFor = (now: Date = new Date()): string => {
  const h = now.getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
};
