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
import type { Beat, Script, StepSource } from './registry';

/* Local copies of the registry's shorthands — TYPE-only imports above keep this module free of
   a runtime cycle (the registry imports REQUESTER_SCRIPTS from here). */
const step = (id: string, label: string, sources?: StepSource[]): Beat =>
  ({ kind: 'step', id, label, sources });
const tk = (label: string, x?: Partial<StepSource>): StepSource => ({ label, kind: 'ticket', ...x });
const kb = (label: string, x?: Partial<StepSource>): StepSource => ({ label, kind: 'kb', ...x });
const doc = (label: string, x?: Partial<StepSource>): StepSource => ({ label, kind: 'doc', ...x });
const dat = (label: string, x?: Partial<StepSource>): StepSource => ({ label, kind: 'data', ...x });

/* ── REQ-02 · "Any update on my VPN issue?" ─────────────────────────────── */
const REQ_02: Script = {
  topic: 'your VPN ticket',
  match: /(any )?update on my vpn|vpn.*any update/i,
  beats: [
    step('q2s1', 'Finding your VPN ticket', [dat('Your open requests')]),
    step('q2s2', 'Reading the latest activity',
      [tk('INC-0988', { freshness: 'Updated 2 hours ago', detail: 'Status · In progress' })]),
    step('q2s3', "Checking the technician's notes", [tk('INC-0988 · notes', { freshness: 'Updated 2 hours ago' })]),
    {
      kind: 'discovery', id: 'q2d1', role: 'evidence',
      headline: 'Priya updated it 2 hours ago',
      detail: '"Reinstalled the certificate, monitoring for 24h."',
      support: ['INC-0988 · notes'],
    },
    {
      kind: 'answer',
      payload: {
        form: 'text',
        title: 'Your VPN ticket',
        headline: "It's being worked on — updated 2 hours ago",
        blocks: [
          { w: 'status', ref: 'INC-0988',
            actions: [{ label: 'View ticket' }, { label: 'Add a comment', ask: 'Ask Priya for an update' }] },
        ],
        basedOn: ['INC-0988', 'INC-0988 · notes'],
        menu: ['Show full history', 'Copy ticket link'],
        followUps: [
          "What's been tried so far?",
          'Ask Priya for an update',
          { label: 'When will it be fixed?', disabled: true },
        ],
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
    step('q3s1', 'Finding the mailbox ticket',
      [tk('INC-0035', { freshness: 'No updates since 28 Feb', detail: 'Status · Open' })]),
    step('q3s2', "Checking how long it's been open", [dat('Request history')]),
    {
      kind: 'discovery', id: 'q3d1', role: 'evidence',
      headline: 'Open since 28 Feb with no updates',
      detail: 'Nothing has moved since the day it was logged.',
      support: ['INC-0035'],
    },
    step('q3s3', 'Checking the escalation route', [doc('Escalation guide')]),
    {
      kind: 'discovery', id: 'q3d2', role: 'routing',
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
          { w: 'agebar', open: '6 months', typical: '5 days', pct: 4 },
          { w: 'diff', id: 'esc', title: 'Ready to escalate — INC-0035',
            rows: [
              { label: 'Priority', from: 'Medium', to: 'High' },
              { label: 'Assignment', from: 'End User Computing', to: 'EUC escalation queue' },
              { label: 'Notify', from: '—', to: 'Requester + Team lead' },
            ],
            why: 'No movement since it was logged.',
            primary: 'Review & escalate', secondary: 'Not now',
            mutation: 'escalate', ref: 'INC-0035',
            banner: {
              text: 'INC-0035 escalated — the team lead has been notified',
              actions: [
                { label: 'View ticket' },
                { label: 'Add business impact', ask: 'Add a note about the business impact' },
              ],
            } },
        ],
        basedOn: ['INC-0035', 'Escalation guide'],
        menu: ['Edit escalation', 'Escalate without notifying'],
        followUps: [
          'Add a note about the business impact',
          'Who will pick this up?',
          { label: 'Show the ticket history', disabled: true },
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
    step('q4s1', 'Checking your recent requests', [dat('Your recent requests')]),
    step('q4s2', 'Searching VPN guides', [kb('VPN sign-in guide')]),
    step('q4s3', 'Finding similar incidents', [dat('Similar incidents · VPN')]),
    {
      kind: 'discovery', id: 'q4d1', role: 'evidence',
      headline: '6 of 8 similar cases were fixed the same way',
      detail: 'Clearing the saved sign-in details sorted it without a ticket.',
      support: ['Similar incidents · VPN'],
    },
    step('q4s4', 'Checking your account activity', [dat('Your account activity')]),
    {
      kind: 'discovery', id: 'q4d2', role: 'evidence',
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
          { w: 'yesno', id: 'fixed', prompt: 'Did this fix it?',
            yes: { record: 'Glad that worked — nothing else needed.' },
            no: { ask: "It didn't work" } },
        ],
        basedOn: ['Similar incidents · VPN', 'Your account activity'],
        menu: ['Make it shorter', 'Show technical details', 'Copy steps'],
        followUps: [
          "It didn't work",
          'Why did this happen?',
          { label: 'Change my password again', disabled: true },
        ],
        followUpsAfter: [
          'Why did this happen?',
          { label: 'Change my password again', disabled: true },
          { label: 'Check my other tickets', disabled: true },
        ],
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
              { label: 'Category', value: 'Network & VPN', inferred: true },
              { label: 'Priority', value: 'Medium', inferred: true, editable: true, options: ['Low', 'Medium', 'High'] },
              { label: 'Requester', value: 'you' },
            ],
            primary: 'Create ticket', secondary: 'Discard',
            banner: { text: '{ref} created — the network team will pick it up', actions: [{ label: 'View ticket' }] } },
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
    step('q5s1', 'Finding the printer ticket', [tk('INC-0871', { detail: 'Status · In progress' })]),
    step('q5s2', "Looking up counter 3's printer", [dat('Asset register · printers')]),
    {
      kind: 'discovery', id: 'q5d1', role: 'evidence',
      headline: "Counter 3's printer is PRN-0314, same model",
      detail: 'Same model as the one already on the ticket.',
      support: ['Asset register · printers'],
    },
    step('q5s3', 'Preparing the update'),
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
            banner: { text: 'Note added to INC-0871 — Priya will see it', actions: [{ label: 'View ticket' }] },
            changes: [
              { label: 'Affected assets', from: '1', to: '2 (PRN-0311, PRN-0314)', patch: 'assets' },
              { label: 'Affected users', from: '1', to: '2' },
            ] },
        ],
        basedOn: ['INC-0871', 'Asset register · printers'],
        menu: ['Edit note', 'Log as a separate ticket instead'],
        followUps: [
          'Should this be higher priority now?',
          "Tell Priya it's urgent",
          { label: 'Is this happening elsewhere?', disabled: true },
        ],
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
    step('q6s1', 'Finding your open requests', [dat('Your open requests')]),
    step('q6s2', 'Checking which need your input', [dat('Waiting-on-you flags')]),
    {
      kind: 'discovery', id: 'q6d1', role: 'gap',
      headline: 'One request is waiting on you',
      detail: 'The messaging team asked you to confirm a fix.',
      support: ['Waiting-on-you flags'],
    },
    {
      kind: 'answer',
      payload: {
        form: 'text',
        title: 'Your open requests',
        /* Count-free on purpose: the list below is LIVE (a ticket created in this session
           appears in it), and a written number would drift the moment it did. */
        headline: "Here's everything still open — one is waiting on you",
        blocks: [
          { w: 'statchips' },
          { w: 'list' },
        ],
        basedOn: ['Your open requests'],
        menu: ['Show closed too', 'Sort by oldest', 'Copy list'],
        followUps: [
          'Which one needs me?',
          'Close the ones that are fixed',
          { label: 'Show closed ones too', disabled: true },
        ],
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
          { w: 'status', ref: 'INC-0790' },
          { w: 'yesno', id: 'emailok', prompt: 'Is email working now?',
            yes: { record: 'Confirmed — closing it is one click away.', askAfter: 'Close INC-0790 for me' },
            no: { ask: 'Email is still bouncing' } },
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
    step('q6c1', 'Checking which are in progress', [dat('Your open requests')]),
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
    step('q7s1', 'Finding the bounce ticket', [tk('INC-0790', { detail: 'Fix waiting for your confirmation' })]),
    step('q7s2', 'Finding the fuel-station ticket', [tk('INC-0644', { detail: 'Resolved 19 days ago' })]),
    step('q7s3', 'Reading both outcomes', [dat('Resolution notes')]),
    {
      kind: 'discovery', id: 'q7d1', role: 'evidence',
      headline: 'The messaging team fixed the relay rule 2 days ago and asked you to confirm',
      detail: 'The ticket has been waiting on your word since.',
      support: ['INC-0790'],
    },
    {
      kind: 'discovery', id: 'q7d2', role: 'evidence',
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
          { w: 'resolution', ref: 'INC-0644',
            action: { label: "Reopen if it's happening again", ask: 'Reopen the fuel-station ticket' } },
        ],
        basedOn: ['INC-0790', 'INC-0644'],
        menu: ['Close without a note', 'Show both tickets'],
        followUps: [
          'Reopen the fuel-station ticket',
          'What was the fix?',
          { label: 'Show both tickets', disabled: true },
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
            rows: [{ label: 'Status', from: 'Resolved', to: 'Open' }],
            why: 'Reported recurring.',
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
        headline: 'Just logged — waiting to be picked up',
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
        headline: "Here's where it stands",
        blocks: [{ w: 'status', ref: '$question' }],
      },
    },
  ],
};

/** Chip scripts are reached by their QUESTION — they carry no case id, and live in the same
 *  registry map so `scriptForQuestion` finds them and the honesty sweep covers them. */
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
  'REQ-05/prio': REQ05_PRIO,
  'REQ-05/urgent': REQ05_URGENT,
  'REQ-06/needs': REQ06_NEEDS,
  'REQ-06/stillbounce': REQ06_STILLBOUNCE,
  'REQ-06/closeall': REQ06_CLOSEALL,
  'REQ-07/reopen': REQ07_REOPEN,
  'REQ-07/fix': REQ07_FIX,
  'REQ/status-any': REQ_STATUS_ANY,
};
