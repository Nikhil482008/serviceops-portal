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
 * ── EXACTLY FOUR PER ROLE ────────────────────────────────────────────────────────────────────
 * Four, not five. Five was one scroll of reading before the input, and two of the technician
 * cards ("Brief me before this call", "Write my handover") were written from the benchmark's
 * long tail rather than from what the UX context says technicians actually keep asking for. The
 * most repeated concern in that document — SLA breach risk — had no card at all, which is the
 * clearest sign the set was chosen by availability rather than by need.
 *
 * ⚠️ SUBTITLES MUST FIT ONE LINE at the drawer's 420px width. The card renders them with
 * `truncate`, so a long one is cut rather than wrapped — a wrapped subtitle changes the card's
 * height and breaks the deal-out stagger's even rhythm. Keep them under about 45 characters.
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
  /** Imperative, and never a question. The card IS the asking; a question mark on it makes the
   *  reader answer rather than press. */
  title: string;
  /** One line. It says what the answer will BE, not what the feature is. */
  subtitle: string;
  /** What is actually asked when the card is pressed. Written as a person would type it. */
  prompt: string;
}

/** The greeting's second line: what this person is being invited to do, phrased as the question
 *  they would actually be asked.
 *
 *  It replaced ROLE_SUBLINE, which described the FEATURE ("Your queue, your shift, and the things
 *  waiting on someone else") rather than making an offer. A description tells you what a surface
 *  contains; a question hands you the turn. The whole screen is trying to get someone to type,
 *  and a question is the only sentence on it that asks them to. */
export const ROLE_QUESTION: Record<UserRole, string> = {
  requester: 'What can I help you fix?',
  technician: 'What should we work on?',
  leadership: 'What would you like to understand?',
};

/** The subline under the greeting — what this person is being offered, in their own terms. */
export const ROLE_SUBLINE: Record<UserRole, string> = {
  requester: 'Ask about your requests, or start a new one.',
  technician: 'Your queue, your shift, and the things waiting on someone else.',
  leadership: 'How the service is running, and what is driving it.',
};

export const ROLE_SUGGESTIONS: Record<UserRole, NovaSuggestion[]> = {
  requester: [
    {
      icon: 'alert', title: "Something's not working",
      subtitle: "Let's try to fix it now",
      prompt: 'I changed my domain password and now VPN says authentication failed. What do I do?',
    },
    {
      icon: 'clock', title: "Where's my request",
      subtitle: 'Status and what happens next',
      prompt: "What's still open for me right now?",
    },
    {
      icon: 'ticket', title: 'Raise a request',
      subtitle: "I'll fill in what I can",
      prompt: 'My laptop screen flickers whenever I put it on the docking station. Can you log a ticket for me?',
    },
    {
      icon: 'shield', title: 'I need access',
      subtitle: 'To a system, file or tool',
      prompt: 'I need access to the shared finance drive for the quarter-end close. How do I request it?',
    },
  ],
  technician: [
    {
      icon: 'zap', title: 'Start my shift',
      subtitle: 'What to pick up first, and why',
      prompt: 'I just started my shift. What should I look at first?',
    },
    {
      /* The card the old set was missing. SLA breach risk is the most repeated technician
         concern in the UX context, and nothing in the drawer answered it. */
      icon: 'alert', title: "What's about to breach",
      subtitle: 'Tickets of mine closest to SLA',
      prompt: 'Which of my tickets are closest to breaching SLA, soonest first?',
    },
    {
      icon: 'search', title: 'Seen this before',
      subtitle: 'Similar incidents and what fixed them',
      prompt: 'User in Bengaluru says VPN drops every 30 minutes on the dot and reconnects fine. Ring any bells?',
    },
    {
      icon: 'pen', title: 'Draft the update',
      subtitle: 'In plain language, ready to send',
      prompt: 'Draft a reply to the requester on the merchant settlement ticket: transmission fault found, file will go in a supplementary run today, credits by evening. Keep it professional, no jargon.',
    },
  ],
  leadership: [
    {
      icon: 'gauge', title: 'How are we doing',
      subtitle: 'This month at a glance',
      prompt: 'Give me this month at a glance — volumes, SLA attainment, and anything unusual.',
    },
    {
      icon: 'alert', title: "What's slipping",
      subtitle: 'SLA breaches and where',
      prompt: 'Where are we breaching SLA, and which teams and services are they in?',
    },
    {
      icon: 'trending', title: 'What changed',
      subtitle: 'Versus last month, and why',
      prompt: 'Walk me through this month versus last — what changed, and what drove it.',
    },
    {
      icon: 'building', title: 'Which service hurts',
      subtitle: 'Biggest driver of incidents',
      prompt: 'Which service is driving the most incidents right now, and what is behind it?',
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
