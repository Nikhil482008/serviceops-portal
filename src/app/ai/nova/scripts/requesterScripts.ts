/* THE REQUESTER RESPONSES — REQ-02 through REQ-07, and every functional chip's own script.
 *
 * All of them speak requester language, answer first, and compose their interactive surface
 * from `blocks` (see RequesterBlock in the registry) — no case owns a layout. Every mutation a
 * block proposes runs against the ONE mock ticket store, behind a confirm, and is visible from
 * every other case: create in REQ-01 and REQ-06 lists it; escalate in REQ-03 and the record
 * carries it.
 *
 * A CHIP IS A QUESTION. Each functional chip below has a script of its own, reached through
 * askNova exactly like a typed question — a chip cannot render an answer directly, so there is
 * no second path onto the screen.
 */
import type { Beat, Script, StepMetric, StepSource } from './registry';

/* Local copies of the registry's shorthands — TYPE-only imports above keep this module free of
   a runtime cycle (the registry imports REQUESTER_SCRIPTS from here). */
/** A check. `tally` is what completing it ADDS to the live scope strip — what this check
 *  READ, never what it concluded, and never a figure this script cannot back. */
const step = (id: string, label: string, sources?: StepSource[], tally?: Record<string, number>): Beat =>
  ({ kind: 'step', id, label, sources, tally });
/** A check that belongs to a named CHAPTER of the investigation and lands on a FACT when it
 *  finishes — the requester's copy of the registry's `lane()`, without the lane column.
 *
 *  ⚠️ THE FACT IS AUTHORED, NEVER DERIVED, and it may only say what this check actually read:
 *  the tally it declares, the source it opened, or the finding it produced. A check that read
 *  nothing countable passes `undefined` and keeps its verb — see the three that do. */
const chk = (
  id: string, phase: string, label: string,
  metric?: StepMetric, sources?: StepSource[], tally?: Record<string, number>,
): Beat => ({ kind: 'step', id, label, phase, metric, sources, tally });
const tk = (label: string, x?: Partial<StepSource>): StepSource => ({ label, kind: 'ticket', ...x });
const kb = (label: string, x?: Partial<StepSource>): StepSource => ({ label, kind: 'kb', ...x });
const doc = (label: string, x?: Partial<StepSource>): StepSource => ({ label, kind: 'doc', ...x });
const dat = (label: string, x?: Partial<StepSource>): StepSource => ({ label, kind: 'data', ...x });

/* ── REQ-02 · "Any update on my VPN issue?" ─────────────────────────────── */
const REQ_02: Script = {
  topic: 'your VPN ticket',
  match: /(any )?update on my vpn|vpn.*any update/i,
  beats: [
    chk('q2s1', 'Find', 'Finding your VPN ticket',
      { value: 'INC-0988', label: 'your unresolved VPN ticket' }, [dat('Your unresolved requests')], { ticket: 1 }),
    chk('q2s2', 'Read', 'Reading the latest activity',
      { value: '6', label: 'updates read' },
      [tk('INC-0988', { freshness: 'Updated 2 hours ago', detail: 'Status · In progress' })], { update: 6 }),
    chk('q2s3', 'Read', "Checking the technician's notes",
      { value: '3', label: 'technician notes' },
      [tk('INC-0988 · notes', { freshness: 'Updated 2 hours ago' })], { note: 3 }),
    {
      kind: 'discovery', id: 'q2d1', role: 'evidence',
      tease: 'The latest word on it',
      headline: 'Priya updated it 2 hours ago',
      detail: '"Reinstalled the certificate, monitoring for 24h."',
      support: ['INC-0988 · notes'],
    },
    {
      kind: 'answer',
      payload: {
        form: 'text',
        title: 'Your VPN ticket',
        /* NO AUTHORED HEADLINE. The status block writes it from the record, so it stays true
           when the record moves — and reads a custom status the same way. */
        blocks: [
          /* No actions on the card: "Ask Priya for an update" is the dock's. ("View ticket" had no
             `ask` and did nothing.) */
          { w: 'status', ref: 'INC-0988' },
        ],
        how: {
          reasoning: [
            '**INC-0988** is **In progress** and was updated **2 hours ago**.',
            "Priya's latest note: **reinstalled the certificate, monitoring for 24h**.",
            'Nothing on the ticket is waiting on you.',
          ],
          checked: ['Your unresolved requests', "The ticket's latest activity", "The technician's notes"],
        },
        basedOn: ['INC-0988', 'INC-0988 · notes'],
        followUps: [
          "What's been tried so far?",
          'Ask Priya for an update',
        ],
        menu: ['Copy ticket link'],
      },
    },
  ],
};

const REQ02_TRIED: Script = {
  topic: 'what has been tried',
  match: /what's been tried so far/i,
  beats: [
    step('q2t1', 'Reading the ticket history', [tk('INC-0988 · history')]),
    {
      kind: 'answer',
      payload: {
        form: 'text',
        title: 'Attempts so far',
        headline: 'Two things so far',
        blocks: [
          { w: 'steps', id: 'tried', steps: ['Reset VPN client — 2 days ago', 'Reinstalled certificate — today'] },
        ],
      },
    },
  ],
};

const REQ02_NUDGE: Script = {
  topic: 'a comment for Priya',
  match: /ask priya for an update/i,
  beats: [
    step('q2n1', 'Preparing a comment', [tk('INC-0988')]),
    {
      kind: 'answer',
      payload: {
        form: 'text',
        title: 'Comment',
        headline: 'Ready to send — check the wording',
        blocks: [
          { w: 'note', id: 'nudge', ref: 'INC-0988',
            prefill: 'Hi Priya — just checking in on this one. Anything you need from me to keep it moving?',
            primary: 'Add comment', secondary: 'Discard',
            banner: { text: 'Comment added to {ref} — Priya will be notified' } },
        ],
      },
    },
  ],
};

/* ── REQ-03 · "Escalate the loans-mailbox ticket" ───────────────────────── */
const REQ_03: Script = {
  topic: 'your loans-mailbox ticket',
  match: /loans mailbox/i,
  beats: [
    chk('q3s1', 'Find', 'Finding the mailbox ticket',
      { value: 'INC-0035', label: 'open since 28 Feb' },
      [tk('INC-0035', { freshness: 'No updates since 28 Feb', detail: 'Status · Open' })]),
    /* The COMPARISON is this check's own — the finding below states the ticket's own history. */
    chk('q3s2', 'Check', "Checking how long it's been open",
      { value: '6 months', label: 'against a 5-day norm' }, [dat('Request history')], { month: 6 }),
    {
      kind: 'discovery', id: 'q3d1', role: 'evidence',
      tease: 'This is the part that matters',
      headline: 'Open since 28 Feb with no updates',
      detail: 'Nothing has moved since the day it was logged.',
      support: ['INC-0035'],
    },
    /* NO FACT — the routing finding below IS the queue's name. */
    chk('q3s3', 'Check', 'Checking the escalation route', undefined,
      [doc('Escalation guide')], { guide: 1 }),
    {
      kind: 'discovery', id: 'q3d2', role: 'routing',
      tease: 'And here is where it goes',
      headline: 'Escalation goes to the EUC escalation queue',
      detail: 'A team lead is notified automatically.',
      support: ['Escalation guide'],
    },
    {
      kind: 'answer',
      payload: {
        form: 'text',
        title: 'Escalation',
        headline: "You're right — this has been sitting. Here's the escalation",
        blocks: [
          { w: 'ageline', open: '6 months', typical: '5 days' },
          { w: 'diff', id: 'esc', title: 'Ready to escalate — INC-0035',
            rows: [
              { label: 'Priority', from: 'Medium', to: 'High', editor: 'select', options: ['Low', 'Medium', 'High'] },
              { label: 'Assignment', from: 'End User Computing', to: 'EUC escalation queue', editor: 'select',
                options: ['EUC escalation queue', 'End User Computing', 'Service Desk'] },
              /* WHO GETS TOLD is a set, and the reader may know of someone Nova does not. */
              { label: 'Notify', from: '—', to: 'Requester + Team lead', editor: 'multi',
                options: ['Requester', 'Team lead', 'Service desk manager'] },
            ],
            why: 'No movement since it was logged.',
            /* THE CARD IS THE REVIEW — it shows every value and lets three of them be argued
               with, so a button promising a further review would be promising a screen that
               does not exist. */
            primary: 'Escalate', secondary: 'Not now',
            mutation: 'escalate', ref: 'INC-0035',
            banner: { text: 'INC-0035 escalated — the team lead has been notified' } },
        ],
        how: {
          reasoning: [
            '**INC-0035** has been **open since 28 Feb** with **no updates**.',
            'Requests like this usually move within **5 days**; this one has waited **6 months**.',
            'Its escalation route is the **EUC escalation queue**, which notifies a team lead automatically.',
          ],
          checked: ['The ticket and its update history', 'Typical time for similar requests', 'The escalation guide'],
        },
        basedOn: ['INC-0035', 'Escalation guide'],
        followUps: [
          'Add a note about the business impact',
          'Who will pick this up?',
        ],
      },
    },
  ],
};

const REQ03_IMPACT: Script = {
  topic: 'the business impact',
  match: /note about the business impact/i,
  beats: [
    step('q3i1', 'Preparing the note', [tk('INC-0035')]),
    {
      kind: 'answer',
      payload: {
        form: 'text',
        title: 'Business impact',
        headline: 'Ready to add — say what it blocks',
        blocks: [
          { w: 'note', id: 'imp', ref: 'INC-0035',
            prefill: 'This blocks the loans team from reaching the shared mailbox — customer replies are going unanswered.',
            primary: 'Add note', secondary: 'Discard',
            banner: { text: 'Note added to {ref} — the escalation team will see it' } },
        ],
      },
    },
  ],
};

const REQ03_WHO: Script = {
  topic: 'the escalation queue',
  match: /who will pick this up/i,
  beats: [
    step('q3w1', 'Checking the escalation queue', [dat('EUC escalation queue')]),
    {
      kind: 'answer',
      payload: {
        form: 'text',
        title: 'The queue',
        headline: 'The EUC escalation queue — currently 3 people',
        blocks: [
          { w: 'team', heading: 'EUC escalation queue',
            members: [
              { name: 'Sana K.', onShift: true, load: '2 tickets' },
              { name: 'Marcus D.', onShift: true, load: '4 tickets' },
              { name: 'Lena P.', onShift: false, load: '1 ticket' },
            ] },
        ],
      },
    },
  ],
};

/* ── REQ-04 · "Password changed, VPN says authentication failed" ────────── */
const REQ_04: Script = {
  topic: 'your VPN sign-in failure',
  match: /(changed|reset).{0,30}password.{0,60}vpn|vpn.{0,40}authentication failed/i,
  beats: [
    /* NO FACT on the first one: nothing in this script says what reading the reader's recent
       requests turned up, so it ends on its verb rather than on a number nobody authored. */
    chk('q4s1', 'Check', 'Checking your recent requests', undefined, [dat('Your recent requests')]),
    chk('q4s2', 'Check', 'Searching VPN guides',
      { value: 'VPN sign-in guide', label: 'the one that applies' }, [kb('VPN sign-in guide')], { guide: 1 }),
    chk('q4s3', 'Compare', 'Finding similar incidents',
      { value: '8', label: 'similar cases' }, [dat('Similar incidents · VPN')], { 'similar case': 8 }),
    {
      kind: 'discovery', id: 'q4d1', role: 'evidence',
      tease: 'A pattern worth knowing',
      headline: '6 of 8 similar cases were fixed the same way',
      detail: 'Clearing the saved sign-in details sorted it without a ticket.',
      support: ['Similar incidents · VPN'],
    },
    /* The COUNT is this check's own; WHAT changed and WHEN is the finding below it. */
    chk('q4s4', 'Compare', 'Checking your account activity',
      { value: '1', label: 'recent account change' },
      [dat('Your account activity')], { 'account change': 1 }),
    {
      kind: 'discovery', id: 'q4d2', role: 'evidence',
      tease: 'And this is why it started',
      headline: 'Your password changed 2 days ago',
      detail: 'The VPN may still be holding the old one.',
      support: ['Your account activity'],
    },
    {
      kind: 'answer',
      payload: {
        form: 'text',
        title: 'Likely cause',
        headline: 'Your VPN is probably still using your old password',
        text: 'This is common right after a password change and takes about two minutes to fix.',
        blocks: [
          { w: 'confidence', text: 'High confidence — 6 similar cases resolved this way' },
          { w: 'steps', id: 'fix', tickable: true,
            windows: [
              'Disconnect from the VPN',
              'Open the VPN client and choose "Forget saved credentials"',
              'Reconnect and enter your NEW password',
              'If prompted, approve the sign-in on your phone',
            ],
            mac: [
              'Disconnect from the VPN',
              'Open the VPN app and remove the saved login under Settings, then Accounts',
              'Reconnect and sign in with your NEW password',
              'If prompted, approve the sign-in on your phone',
            ],
            short: [
              'Forget the saved credentials in your VPN client',
              'Reconnect with your new password',
            ],
            detail: 'What is actually happening: the VPN keeps its own saved copy of your password, separate from your computer login. Changing your main password does not update that copy, so the VPN keeps offering the old one until you clear it.' },
          /* "Did this fix it?" is the dock's: That fixed it / It didn't work are its options 1 and 2. */
        ],
        how: {
          reasoning: [
            'Your password changed **2 days ago**.',
            '**6 of 8 similar cases** had the same sign-in failure right after a password change.',
            'All six were fixed by **clearing the saved sign-in details** — no ticket needed.',
          ],
          conclusion: 'Your VPN is most likely still holding your **old password**.',
          checked: ['Your recent requests', 'Your account activity', 'Similar VPN incidents', 'The VPN sign-in guide'],
          unverified: ['Which VPN client is on your device — the steps below cover **Windows and Mac**.'],
        },
        basedOn: ['Similar incidents · VPN', 'Your account activity'],
        followUps: [
          "It didn't work",
          'Why did this happen?',
        ],
        followUpsAfter: [
          'Why did this happen?',
        ],
        menu: ['Make it shorter', 'Show technical details', 'Copy steps'],
      },
    },
  ],
};

const REQ04_NOTWORK: Script = {
  topic: 'a ticket for your VPN issue',
  match: /didn't work/i,
  beats: [
    step('q4n1', 'Checking what else it could be', [kb('VPN sign-in guide')]),
    step('q4n2', 'Preparing a ticket draft'),
    {
      kind: 'discovery', id: 'q4nd1', role: 'gap',
      headline: "The quick fix didn't take",
      detail: 'A technician needs to look at your VPN setup.',
    },
    {
      kind: 'answer',
      payload: {
        form: 'text',
        title: 'New incident',
        headline: "Let's get someone on it — the draft is ready",
        blocks: [
          { w: 'draft', id: 'req04', title: 'New incident',
            fields: [
              { label: 'Type', value: 'Incident' },
              { label: 'Subject', value: 'VPN authentication failed after password change', editable: true },
              { label: 'Category', value: 'Network & VPN', inferred: true, editable: true, options: ['End User Computing', 'Network & VPN', 'Access & Identity', 'Payments & Cards', 'Branch Systems', 'HR Services'] },
              { label: 'Priority', value: 'Medium', inferred: true, editable: true, options: ['Low', 'Medium', 'High'] },
              { label: 'Requester', value: 'you' },
            ],
            primary: 'Create ticket', secondary: 'Discard',
            banner: { text: '{ref} created — the network team will pick it up' } },
        ],
      },
    },
  ],
};

const REQ04_WHY: Script = {
  topic: 'why this happened',
  match: /why did this happen/i,
  beats: [
    step('q4w1', 'Checking the password policy', [doc('Password policy')]),
    {
      kind: 'answer',
      payload: {
        form: 'text',
        title: 'The cause',
        headline: 'The VPN caches your password separately',
        text: 'The VPN keeps its own saved copy of your sign-in, and changing your main password does not update it. Clearing the saved copy once puts the two back in step.',
      },
    },
  ],
};

/* ── REQ-05 · "Counter 3's printer is doing it too" ─────────────────────── */
const REQ_05: Script = {
  topic: 'your printer ticket',
  match: /passbook printer|counter 3/i,
  beats: [
    chk('q5s1', 'Find', 'Finding the printer ticket',
      { value: 'INC-0871', label: 'already open, in progress' },
      [tk('INC-0871', { detail: 'Status · In progress' })], { ticket: 1 }),
    /* The REGISTER is this check's own; that the two are the same model is the finding. */
    chk('q5s2', 'Find', "Looking up counter 3's printer",
      { value: '2', label: 'printers on the branch register' },
      [dat('Asset register · printers')], { printer: 2 }),
    {
      kind: 'discovery', id: 'q5d1', role: 'evidence',
      tease: 'The same fault, twice',
      headline: "Counter 3's printer is PRN-0314, same model",
      detail: 'Same model as the one already on the ticket.',
      support: ['Asset register · printers'],
    },
    /* NO FACT: preparing a note reads nothing — the note itself is the result. */
    chk('q5s3', 'Decide', 'Preparing the update'),
    {
      kind: 'answer',
      payload: {
        form: 'text',
        title: 'Ticket update',
        headline: "I'll add counter 3 to INC-0871 — check the note first",
        blocks: [
          { w: 'note', id: 'ctr3', ref: 'INC-0871',
            prefill: "Branch reports counter 3's printer (PRN-0314) is now showing the same fading. Affected printers: PRN-0311, PRN-0314.",
            primary: 'Add to ticket', secondary: 'Edit',
            banner: { text: 'Note added to INC-0871 — Priya will see it' },
            changes: [
              { label: 'Affected assets', from: '1', to: '2 (PRN-0311, PRN-0314)', patch: 'assets' },
              { label: 'Affected users', from: '1', to: '2' },
            ] },
        ],
        how: {
          reasoning: [
            '**INC-0871** is already open for the branch printer and **In progress**.',
            "Counter 3's printer is **PRN-0314** — the **same model** as the one on the ticket.",
            'Adding it keeps one fault on one ticket, rather than opening a second for the same problem.',
          ],
          checked: ['The open printer ticket', "The asset register for counter 3's printer"],
        },
        basedOn: ['INC-0871', 'Asset register · printers'],
        followUps: [
          'Should this be higher priority now?',
          "Tell Priya it's urgent",
        ],
        menu: ['Edit note'],
      },
    },
  ],
};

const REQ05_PRIO: Script = {
  topic: 'the right priority',
  match: /higher priority now/i,
  beats: [
    step('q5p1', 'Checking how priorities are set', [doc('Priority guide')]),
    {
      kind: 'answer',
      payload: {
        form: 'text',
        title: 'Priority check',
        headline: 'Two printers affected — Medium still fits',
        blocks: [
          { w: 'diff', id: 'prio', title: 'Priority check — INC-0871',
            rows: [{ label: 'Priority', from: 'Medium', to: 'Medium (no change)' }],
            why: 'Two printers at one branch is still a limited fault — it is worked at the same speed either way.',
            primary: 'Raise to High anyway', secondary: 'Keep Medium',
            mutation: 'raise-priority', ref: 'INC-0871',
            banner: { text: 'INC-0871 raised to High' } },
        ],
      },
    },
  ],
};

const REQ05_URGENT: Script = {
  topic: 'a comment for Priya',
  match: /tell priya it's urgent/i,
  beats: [
    step('q5u1', 'Preparing a comment', [tk('INC-0871')]),
    {
      kind: 'answer',
      payload: {
        form: 'text',
        title: 'Comment',
        headline: 'Ready to send',
        blocks: [
          { w: 'note', id: 'urg', ref: 'INC-0871',
            prefill: 'The branch is asking about this daily now — both counters are affected. Anything that helps speed this up would be appreciated.',
            primary: 'Add comment', secondary: 'Discard',
            banner: { text: 'Comment added to {ref} — Priya will be notified' } },
        ],
      },
    },
  ],
};

/* ── REQ-06 · "What's still open for me right now?" ─────────────────────── */
const REQ_06: Script = {
  topic: 'your open requests',
  match: /what's still open for me|still open .*right now/i,
  beats: [
    /* ⚠️ NO CHAPTERS ON THIS ONE, and no facts either.
       A chapter earns its heading by GROUPING checks. This investigation is two checks long, so
       naming a chapter for each would be two headings over two lines — ceremony where the whole
       trail already fits in a glance. The renderer draws an unnamed run when no check names a
       phase, which is exactly right here.
       And no fact on this check for the reason the comment below gives: the list is LIVE, so any
       figure it landed on would be wrong the moment a ticket is raised in this session. */
    chk('q6s1', '', 'Finding your unresolved requests', undefined,
      [dat('Your unresolved requests')], { 'data source': 1 }),
    /* NO COUNT OF THE LIST ITSELF: it is LIVE - a ticket raised in this session joins it -
       which is why the answer's headline is count-free too, and a strip that stated a number
       would be the drift that comment exists to prevent. The source and the flag are stable. */
    /* NO FACT — the gap below IS "one request is waiting on you", and this is a two-check
       investigation: printing the conclusion first leaves the finding nothing to reveal. */
    chk('q6s2', '', 'Checking which need your input', undefined,
      [dat('Waiting-on-you flags')], { flag: 1 }),
    {
      kind: 'discovery', id: 'q6d1', role: 'gap',
      tease: 'One of them needs you',
      headline: 'One request is waiting on you',
      detail: 'The messaging team asked you to confirm a fix.',
      support: ['Waiting-on-you flags'],
    },
    {
      kind: 'answer',
      payload: {
        form: 'text',
        title: 'What is outstanding',
        /* NO AUTHORED HEADLINE. The count and whether any of them needs the reader are both
           live - a ticket raised in this session joins the set - so the block writes the
           conclusion from the same grouping call the card renders. */
        blocks: [
          { w: 'summary' },
        ],
        how: {
          reasoning: [
            'Every request under your name that is **not yet resolved**, grouped by the status it is in.',
            '**One** of them is flagged **waiting on you**: the messaging team asked you to confirm a fix.',
          ],
          checked: ['Your unresolved requests', 'Waiting-on-you flags'],
        },
        basedOn: ['Your unresolved requests'],
        menu: ['Copy list'],
        followUps: [
          'Which one needs me?',
          'Close the ones that are fixed',
        ],
      },
    },
  ],
};

/** Turn 2 - the tickets themselves, once the reader has asked for them. */
const REQ06_TICKETS: Script = {
  topic: 'your unresolved tickets',
  match: /show my open tickets/i,
  beats: [
    step('q6t1', 'Listing your unresolved tickets', [dat('Your unresolved requests')]),
    {
      kind: 'answer',
      payload: {
        form: 'text',
        title: 'Your tickets',
        blocks: [{ w: 'ticketcards' }],
        basedOn: ['Your unresolved requests'],
      },
    },
  ],
};

const REQ06_NEEDS: Script = {
  topic: 'the one waiting on you',
  match: /which one needs me/i,
  beats: [
    step('q6n1', 'Reading the outstanding request', [tk('INC-0790', { detail: 'Waiting for your confirmation' })]),
    {
      kind: 'answer',
      payload: {
        form: 'text',
        title: 'Waiting on you',
        headline: 'INC-0790 — the messaging team wants you to confirm the fix',
        blocks: [
          /* "Is email working now?" is the dock's: close it / add a note are its options 1 and 2. */
          { w: 'status', ref: 'INC-0790' },
        ],
      },
    },
  ],
};

const REQ06_STILLBOUNCE: Script = {
  topic: 'telling the messaging team',
  match: /email is still bouncing/i,
  beats: [
    step('q6b1', 'Preparing an update for the messaging team', [tk('INC-0790')]),
    {
      kind: 'answer',
      payload: {
        form: 'text',
        title: 'Update',
        headline: "I'll let them know it isn't fixed",
        blocks: [
          { w: 'note', id: 'bounce', ref: 'INC-0790',
            prefill: 'Still seeing bounces to the counterparty after the relay fix — please take another look.',
            primary: 'Send update', secondary: 'Discard',
            banner: { text: 'Update added to {ref} — the messaging team will be notified' } },
        ],
      },
    },
  ],
};

const REQ06_CLOSEALL: Script = {
  topic: 'closing what is fixed',
  match: /close the ones that are fixed/i,
  beats: [
    step('q6c1', 'Checking which are in progress', [dat('Your unresolved requests')]),
    {
      kind: 'answer',
      payload: {
        form: 'text',
        title: 'Close requests',
        headline: 'Pick the ones that are done',
        blocks: [
          { w: 'closelist', id: 'cl', primary: 'Close selected',
            banner: { text: 'Closed {ref}' } },
        ],
      },
    },
  ],
};

/* ── REQ-07 · close the bounce ticket + fuel-card status ────────────────── */
const REQ_07: Script = {
  topic: 'your two tickets',
  match: /bounce problem.*closed|counterparty.*closed|fuel.?station.*(fixed|decline)|close inc-0790/i,
  beats: [
    chk('q7s1', 'Find', 'Finding the bounce ticket',
      { value: 'INC-0790', label: 'the bounce ticket' },
      [tk('INC-0790', { detail: 'Fix waiting for your confirmation' })], { ticket: 1 }),
    chk('q7s2', 'Find', 'Finding the fuel-station ticket',
      { value: 'INC-0644', label: 'the fuel-station ticket' },
      [tk('INC-0644', { detail: 'Resolved 19 days ago' })], { ticket: 1 }),
    chk('q7s3', 'Read', 'Reading both outcomes',
      { value: '2', label: 'resolution notes read' }, [dat('Resolution notes')], { 'resolution note': 2 }),
    {
      kind: 'discovery', id: 'q7d1', role: 'evidence',
      tease: 'One is waiting on you',
      headline: 'The messaging team fixed the relay rule 2 days ago and asked you to confirm',
      detail: 'The ticket has been waiting on your word since.',
      support: ['INC-0790'],
    },
    {
      kind: 'discovery', id: 'q7d2', role: 'evidence',
      tease: 'The other is already done',
      headline: 'The card issue was resolved 19 days ago',
      detail: 'Card limit reset after finance approval.',
      support: ['INC-0644'],
    },
    {
      kind: 'answer',
      payload: {
        form: 'text',
        title: 'Both tickets',
        headline: 'Good news on both',
        blocks: [
          { w: 'head', n: '1 · Email bounces', text: 'Yes — you can close it now' },
          { w: 'note', id: 'close790', ref: 'INC-0790', title: 'Resolution note', close: true,
            prefill: 'Confirmed working by requester. Relay rule corrected.',
            primary: 'Close INC-0790', secondary: 'Keep it open',
            banner: { text: 'INC-0790 closed' } },
          { w: 'head', n: '2 · Fuel-station card', text: 'The card issue was fixed 19 days ago' },
          /* No action on the note: reopening is the dock's option 2. */
          { w: 'resolution', ref: 'INC-0644' },
        ],
        how: {
          reasoning: [
            '**INC-0790**: the messaging team fixed the relay rule **2 days ago** and asked you to confirm.',
            '**INC-0644** was **resolved 19 days ago** — finance reset the card limit.',
            'Closing INC-0790 is the only thing still waiting, and it is waiting on you.',
          ],
          checked: ['Both tickets', 'Their resolution notes'],
        },
        basedOn: ['INC-0790', 'INC-0644'],
        followUps: [
          'Reopen the fuel-station ticket',
          'What was the fix?',
        ],
      },
    },
  ],
};

const REQ07_REOPEN: Script = {
  topic: 'reopening the card ticket',
  match: /reopen the fuel.?station/i,
  beats: [
    step('q7r1', 'Reading the closed ticket', [tk('INC-0644')]),
    {
      kind: 'answer',
      payload: {
        form: 'text',
        title: 'Reopen',
        headline: 'I can reopen it — confirm and it goes back to the team',
        blocks: [
          { w: 'diff', id: 'reopen', title: 'Reopen INC-0644',
            /* STATUS IS FIXED: reopening a ticket is the one thing this card does, so its
               after-value is not a choice. The WHY is the reader's own — they are the one who
               knows why it needs reopening — so that is the field they can write. */
            rows: [{ label: 'Status', from: 'Resolved', to: 'Open' }],
            why: 'Reported recurring.', whyEditable: true,
            primary: 'Reopen ticket', secondary: 'Not now',
            mutation: 'reopen', ref: 'INC-0644',
            banner: { text: 'INC-0644 reopened — Finance/IT will take another look' } },
        ],
      },
    },
  ],
};

const REQ07_FIX: Script = {
  topic: 'what the fix was',
  match: /what was the fix/i,
  beats: [
    step('q7f1', 'Reading the resolution', [tk('INC-0644 · resolution')]),
    {
      kind: 'answer',
      payload: {
        form: 'text',
        title: 'The fix',
        headline: 'Finance reset the card limit',
        text: 'The card had hit its monthly limit, which is why the pump declined it. Finance approved a higher limit and reset the card, and it has worked since.',
      },
    },
  ],
};

/* ── REQ-01's chip scripts (the case itself stays in the registry) ──────── */
const REQ01_ASSET: Script = {
  topic: 'your docking station',
  match: /docking station's asset tag/i,
  beats: [
    step('q1a1', 'Checking your assets', [dat('Your assigned assets')]),
    step('q1a2', 'Searching the asset register', [dat('Asset register · docks')]),
    {
      kind: 'discovery', id: 'q1ad1', role: 'gap',
      headline: 'No docking station is registered to you',
      detail: 'You can link one so the technician knows the model.',
    },
    {
      kind: 'answer',
      payload: {
        form: 'text',
        title: 'Dock lookup',
        headline: "I couldn't find a dock registered to you",
        text: "Pick yours and I'll add it to the draft above.",
        blocks: [
          { w: 'picker', id: 'dockpick', prompt: 'Which dock is yours?',
            options: ['DOCK-2291 · Dell WD19', 'DOCK-2307 · Dell WD22TB4', 'DOCK-2144 · HP G5'],
            confirm: 'Link this dock', draftId: 'req01',
            banner: { text: '{ref} linked — added to your draft above' } },
        ],
      },
    },
  ],
};

const REQ01_AFTER: Script = {
  topic: 'what happens next',
  match: /what happens after i create it/i,
  beats: [
    step('q1w1', 'Checking routing rules', [doc('Routing rules')]),
    step('q1w2', 'Looking at recent times for this category', [dat('Recent EUC tickets')]),
    {
      kind: 'answer',
      payload: {
        form: 'text',
        title: 'After you create it',
        headline: 'It goes to End User Computing',
        blocks: [
          { w: 'timeline',
            steps: [
              { label: 'Picked up', note: 'usually within 4 hours' },
              { label: 'Contacted', note: 'within 1 day' },
              { label: 'Fixed', note: 'typically 3 days' },
            ],
            footer: 'Based on the last 20 similar tickets.' },
        ],
      },
    },
  ],
};

const REQ01_NOTE: Script = {
  topic: 'a note for your new ticket',
  match: /add a note to inc-1042/i,
  beats: [
    step('q1n1', 'Opening your new ticket', [tk('INC-1042')]),
    {
      kind: 'answer',
      payload: {
        form: 'text',
        title: 'Note',
        headline: 'Ready when you are',
        blocks: [
          { w: 'note', id: 'n1042', ref: 'INC-1042',
            prefill: 'One more detail: the flicker only happens on the external monitor, not the laptop screen itself.',
            primary: 'Add note', secondary: 'Discard',
            banner: { text: 'Note added to {ref}' } },
        ],
      },
    },
  ],
};

const REQ01_STATUS: Script = {
  topic: 'your new ticket',
  match: /show me its status/i,
  beats: [
    step('q1t1', 'Reading your new ticket', [tk('INC-1042')]),
    {
      kind: 'answer',
      payload: {
        form: 'text',
        title: 'INC-1042',
        blocks: [{ w: 'status', ref: 'INC-1042' }],
      },
    },
  ],
};

/** A row click in REQ-06's list — the same StatusCard, for whichever ticket was clicked. */
const REQ_STATUS_ANY: Script = {
  topic: 'that ticket',
  match: /what's happening with (inc|req)-\d+/i,
  beats: [
    step('qs1', 'Reading the ticket', [dat('Your requests')]),
    {
      kind: 'answer',
      payload: {
        form: 'text',
        title: 'Where it stands',
        blocks: [{ w: 'status', ref: '$question' }],
      },
    },
  ],
};

/* ── Two replies the dock reaches that no chip ever did ─────────────────── */
const REQ04_SIMILAR: Script = {
  topic: 'similar fixes',
  match: /show me similar fixes/i,
  beats: [
    step('q4m1', 'Reading the similar incidents', [dat('Similar incidents · VPN')]),
    {
      kind: 'answer',
      payload: {
        form: 'text',
        title: 'Similar fixes',
        headline: 'Six of the eight were fixed the same way',
        text: 'Clearing the saved sign-in details — the steps above. The other two needed a technician to reset the VPN profile on the device, which is what the ticket asks for.',
        blocks: [
          { w: 'steps', id: 'similar', steps: ['6 — cleared the saved sign-in details, no ticket', '2 — VPN profile reset by a technician'] },
        ],
      },
    },
  ],
};

const REQ07_BOTH: Script = {
  topic: 'both tickets',
  match: /show me both tickets/i,
  beats: [
    step('q7b1', 'Reading both tickets', [tk('INC-0790'), tk('INC-0644')]),
    {
      kind: 'answer',
      payload: {
        form: 'text',
        title: 'Both tickets',
        headline: 'Where both stand now',
        blocks: [{ w: 'status', ref: 'INC-0790' }, { w: 'status', ref: 'INC-0644' }],
      },
    },
  ],
};

/** Chip scripts are reached by their QUESTION — they carry no case id, and live in the same
 *  registry map so `scriptForQuestion` finds them and the honesty sweep covers them. The dock
 *  reaches them by case id instead, so its labels need not match their patterns. */
export const REQUESTER_SCRIPTS: Record<string, Script> = {
  'REQ-02': REQ_02,
  'REQ-03': REQ_03,
  'REQ-04': REQ_04,
  'REQ-05': REQ_05,
  'REQ-06': REQ_06,
  'REQ-07': REQ_07,
  'REQ-01/asset': REQ01_ASSET,
  'REQ-01/after': REQ01_AFTER,
  'REQ-01/note': REQ01_NOTE,
  'REQ-01/status': REQ01_STATUS,
  'REQ-02/tried': REQ02_TRIED,
  'REQ-02/nudge': REQ02_NUDGE,
  'REQ-03/impact': REQ03_IMPACT,
  'REQ-03/who': REQ03_WHO,
  'REQ-04/notwork': REQ04_NOTWORK,
  'REQ-04/why': REQ04_WHY,
  'REQ-04/similar': REQ04_SIMILAR,
  'REQ-05/prio': REQ05_PRIO,
  'REQ-05/urgent': REQ05_URGENT,
  'REQ-06/tickets': REQ06_TICKETS,
  'REQ-06/needs': REQ06_NEEDS,
  'REQ-06/stillbounce': REQ06_STILLBOUNCE,
  'REQ-06/closeall': REQ06_CLOSEALL,
  'REQ-07/reopen': REQ07_REOPEN,
  'REQ-07/fix': REQ07_FIX,
  'REQ-07/both': REQ07_BOTH,
  'REQ/status-any': REQ_STATUS_ANY,
};
