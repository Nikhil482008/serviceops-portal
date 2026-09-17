/* THE TECHNICIAN RESPONSES — TEC-01 through TEC-07, every functional chip's own script, the
 * What-changed replies the attached actions open, and the ref / KB scripts a mono chip reaches.
 *
 * Technically precise, evidence-first. Step labels name the SOURCE and its SIZE ("Reading
 * INC-1088 — 14 updates"); discoveries carry their references inline as `[INC-0611]` tokens,
 * which the dense feed renders as clickable chips. Confidence is stated in words.
 *
 * ── ACTION AS TURN (TEC-01..06) ─────────────────────────────────────────────────────────────
 * A card here renders no button. What the reader can DO is attached under the turn by
 * `tech/techActions.ts`; clicking an action appends their turn and opens one of the What-changed
 * scripts below. Those scripts author a short work feed (1–3 steps, 600–900ms each), a `mutate`
 * beat on which the emitter performs the action, and a past-tense headline plus ONE "what
 * happens next" line. The rows of the What-changed card are never authored: they come from the
 * mutation's return value (`tech/mutations.ts`). `{{cref}}` / `{{crefs}}` name the records it
 * changed; `{{qref}}` / `{{qrefs}}` the records the reader's turn named.
 *
 * A CHIP IS A QUESTION. Each ask-chip has a script of its own, reached through askNova exactly
 * like a typed question, and answered in the ordinary style.
 *
 * TEC-07 is untouched by this: it keeps its plan-first surface, its chips and its document.
 */
import type { Beat, DiscoveryRole, Script, StepMetric, StepSource } from './registry';

/* Local copies of the registry's shorthands — TYPE-only imports above keep this module free of
   a runtime cycle (the registry imports TECHNICIAN_SCRIPTS from here). */
const step = (id: string, label: string, sources?: StepSource[]): Beat =>
  ({ kind: 'step', id, label, sources });
const tk = (label: string, x?: Partial<StepSource>): StepSource => ({ label, kind: 'ticket', ...x });
const kb = (label: string, x?: Partial<StepSource>): StepSource => ({ label, kind: 'kb', ...x });
const doc = (label: string, x?: Partial<StepSource>): StepSource => ({ label, kind: 'doc', ...x });
const dat = (label: string, x?: Partial<StepSource>): StepSource => ({ label, kind: 'data', ...x });
const m = (value: string, label: string): StepMetric => ({ value, label });
/** A CHAPTER check for the reveal view — which chapter it belongs to, the FACT it lands on once
 *  done, what it read, and (for the live-scope strip) what it adds to the scope. */
const ch = (id: string, phase: string, label: string, metric?: StepMetric, sources?: StepSource[], tally?: Record<string, number>): Beat =>
  ({ kind: 'step', id, label, phase, metric, sources, tally });
/** A TEASED finding — the eyebrow the reveal view shows before the finding itself. */
const T = (id: string, role: DiscoveryRole, tease: string, headline: string, detail: string, support?: string[]): Beat =>
  ({ kind: 'discovery', id, role, tease, headline, detail, support });

/** A WHAT-CHANGED reply. The steps are the work feed; the mutation runs after them; the headline
 *  is past tense with the ref; `next` is the one line under the card.
 *
 *  ⚠️ `basedOn` is DERIVED from the sources the steps read. A reply cannot name a source its own
 *  checks never opened — which is the one thing a provenance strip must never do, and exactly
 *  what four of these scripts did when the lists were written by hand. */
const changed = (
  topic: string, activity: string, steps: Array<[string, string]>, headline: string, next: string,
  sources: StepSource[], x?: { nextFallback?: string },
): Script => ({
  topic,
  activity,
  pace: [600, 900],
  beats: [
    ...steps.map(([id, label]) => step(id, label, sources)),
    { kind: 'mutate' },
    {
      kind: 'answer',
      payload: {
        form: 'text', title: 'What changed', headline,
        blocks: [{ w: 'changed', next, nextFallback: x?.nextFallback }],
        basedOn: sources.map((src) => src.label),
      },
    },
  ],
});


/* ── TEC-01 · "I just started my shift. What should I look at first?" ──────────────────── */
const MY_QUEUE = dat('My queue', { freshness: 'Live', detail: '10 assigned to you' });
const SLA_CLOCKS = dat('SLA clock service', { freshness: 'Checked just now' });
const OVERNIGHT_SRC = dat('Shift roster · overnight', { freshness: 'Updated 06:10', detail: '4 changes since 20:00' });

const TEC_01: Script = {
  topic: 'what needs you first',
  activity: 'Triaging your queue',
  view: 'reveal',
  match: /(start(ed|ing)?|beginning).{0,20}(my )?shift|what should I (look at|pick up) first/i,
  beats: [
    ch('t1s1', 'Take stock', 'Reading your queue — 10 tickets', m('10', 'tickets assigned to you'), [MY_QUEUE], { ticket: 10 }),
    ch('t1s2', 'Take stock', 'Checking SLA clocks — 10', m('2', 'breaching inside 3 hours'), [SLA_CLOCKS], { 'SLA clock': 10 }),
    ch('t1s3', 'Overnight', 'Reading overnight changes — 4', m('4', 'changes since 20:00'), [OVERNIGHT_SRC], { 'overnight change': 4 }),
    T('t1d1', 'gap', 'One clock outranks the rest', 'INC-1077 breaches in 40 minutes and is already past its regulatory window [INC-1077]',
      'The reporting window closed yesterday 23:55; the SLA clock has 0h 40m left.', ['SLA clock service']),
    ch('t1s4', 'Decide', 'Ranking — regulatory clock, then SLA clock, then priority', m('INC-1077', 'first'), [doc('Triage rule · regulatory before SLA')]),
    T('t1d2', 'evidence', 'And one nobody has touched', 'INC-1112 landed on you overnight, unassigned until 06:10 [INC-1112]',
      'Logged 05:52 by the branch manager. Nobody has looked at it.', ['Shift roster · overnight']),
    {
      kind: 'answer',
      payload: {
        form: 'text',
        title: 'Triage',
        /* NO AUTHORED HEADLINE. Which ticket is first, and why, are both read off the queue -
           so a clock that moves moves the sentence with it. */
        blocks: [
          { w: 'shift' },
        ],
        basedOn: ['My queue', 'SLA clock service', 'Shift roster · overnight'],
        menu: ['Re-rank by SLA only', 'Re-rank by priority only', 'Show full queue'],
        /* NO CHIPS AUTHORED HERE. What the reader can ask next is the attached-action set's,
           in tech/techActions.ts, beside the do-actions it belongs with. */
      },
    },
  ],
};

const TEC01_OVERNIGHT: Script = {
  topic: 'what changed overnight',
  activity: 'Reading the overnight changes',
  match: /what happened overnight/i,
  beats: [
    step('t1o1', 'Reading updates since 20:00 — 4 changes', [OVERNIGHT_SRC]),
    {
      kind: 'answer',
      payload: {
        form: 'text', title: 'Overnight', headline: 'Four things',
        blocks: [{ w: 'changes', set: 'overnight' }],
        basedOn: ['Shift roster · overnight'],
      },
    },
  ],
};

/* Start one or several — the selection-aware action, and "Start the other two". */
/** "Show the other N" - the rest of the queue, as the same cards. */
const TEC01_REST: Script = {
  topic: 'the rest of your queue',
  activity: 'Listing the rest of your queue',
  match: /show the other \d+|show the rest of (my|the) queue/i,
  beats: [
    step('t1r1', 'Reading the rest of your queue', [MY_QUEUE]),
    {
      kind: 'answer',
      payload: {
        form: 'text', title: 'The rest', headline: 'The rest of your queue',
        blocks: [{ w: 'shift', rest: true }],
        basedOn: ['My queue'],
      },
    },
  ],
};

const TEC01_STARTED = changed('starting {{qrefs}}', 'Starting {{qrefs}}',
  [['t1a1', 'Setting {{qrefs}} to In progress'], ['t1a2', 'Checking the clock and the regulatory flag']],
  'Started {{crefs}}', "I'll warn you at 15 minutes to breach", [MY_QUEUE, SLA_CLOCKS]);
/* The bulk action — a fixed target set. */
const TEC01_STARTED3 = changed('starting the top three', 'Starting the top three',
  [['t1b1', 'Setting the top three to In progress'], ['t1b2', 'Checking clocks and regulatory flags']],
  'Started the top three', "I'll warn you at 15 minutes to breach", [MY_QUEUE, SLA_CLOCKS]);

/* ── TEC-02 · the corporate banking RM on the line ─────────────────────────────────────── */
const INC1088 = tk('INC-1088', { freshness: 'Updated 12:00', detail: 'P1 · In progress · bridge call live' });
const BRIDGE = dat('Bridge call · INC-1088', { freshness: 'Live', detail: '4 people · since 09:10' });
const CLIENT_SLA = doc('Client SLA · corporate payroll', { detail: 'Cut-off 15:00' });

const TEC_02: Script = {
  topic: 'the bulk salary upload failures',
  activity: 'Briefing you on INC-1088',
  view: 'reveal',
  match: /bulk salary|salary upload|corporate banking RM|30.second brief/i,
  beats: [
    /* TALLIED — the live scope strip counts what each check read as it lands. */
    ch('t2s1', 'Read', 'Reading INC-1088 — 14 updates', m('14', 'updates read'), [INC1088], { update: 14 }),
    ch('t2s2', 'Read', 'Checking the bridge call — 4 people', m('4', 'on the bridge'), [BRIDGE], { 'bridge member': 4 }),
    T('t2d1', 'evidence', 'The fix is already in', 'Fix applied 11:20, re-run started 11:35, ETA 12:30 [INC-1088]',
      'Payments applied the fix; the first file has already processed cleanly (412 employees).', ['INC-1088']),
    ch('t2s3', 'Verify', 'Checking the client cut-off — 15:00', m('15:00', 'client cut-off'), [CLIENT_SLA], { 'data source': 1 }),
    T('t2d2', 'evidence', 'And there is margin', 'Client cut-off is 15:00 — 2h 55m of margin',
      'ETA 12:30 leaves 2h 30m before the cut-off even if the re-run slips.', ['Client SLA · corporate payroll']),
    {
      kind: 'answer',
      payload: {
        form: 'text',
        title: 'Your 30 seconds',
        /* NO AUTHORED HEADLINE, and no authored facts. Both are read off INC-1088's incident
           record, so a change to the record changes what the brief says about it. */
        blocks: [
          { w: 'incbrief', ref: 'INC-1088',
            sayThis: 'Files are being reprocessed now. Credits by 12:30, well ahead of the 3 PM cut-off. Nothing needed from the client.' },
          { w: 'inctimeline', ref: 'INC-1088' },
        ],
        basedOn: ['INC-1088', 'Bridge call · INC-1088', 'Client SLA · corporate payroll'],
        menu: ['Make it shorter', 'Show the full incident log', 'Copy talking points'],
      },
    },
  ],
};

const TEC02_BRIDGE: Script = {
  topic: 'the bridge call',
  activity: 'Reading the bridge roster',
  match: /who is on the bridge call/i,
  beats: [
    step('t2b1', 'Reading the bridge call — 4 people', [BRIDGE]),
    {
      kind: 'answer',
      payload: {
        form: 'text', title: 'Bridge call', headline: 'Four on the bridge — Meera K. owns it',
        blocks: [{ w: 'people', heading: 'Bridge call · INC-1088 · since 09:10', ref: 'INC-1088' }],
        basedOn: ['Bridge call · INC-1088'],
      },
    },
  ],
};

/* KEPT FROM A DELETED BUTTON. "Add an event" wrote `ticket.events`, and nothing else does —
   the timeline still renders them as "added by you". It is a chip now: the reader asks for it,
   fills the two fields, and the turn's own action commits them. */
const TEC02_EVENT: Script = {
  topic: 'a mark on the INC-1088 timeline',
  activity: 'Opening the timeline',
  match: /^add something to the timeline$/i,
  beats: [
    step('t2e1', 'Reading the INC-1088 timeline — 6 marks and Now', [INC1088]),
    {
      kind: 'answer',
      payload: {
        form: 'text', title: 'Timeline', headline: 'What happened, and when?',
        blocks: [{ w: 'fieldsedit', id: 'event', ref: 'INC-1088', title: 'New mark on INC-1088',
          rows: [{ key: 'time', label: 'Time' }, { key: 'label', label: 'What happened' }],
          note: 'A 24-hour time (HH:MM) and one line. It lands on the timeline above, marked as yours.',
          noteFilled: 'It lands on the timeline above, marked as yours.' }],
        basedOn: ['INC-1088'],
      },
    },
  ],
};

const TEC02_EVENT_ADDED = changed('the timeline mark', 'Adding the mark',
  [['t2f1', 'Adding the mark to INC-1088']],
  'Timeline updated on INC-1088', 'It sits on the timeline at {{time}}, marked as yours',
  [INC1088], { nextFallback: 'Nothing was added — a time and a line are both needed' });

const TEC02_SENT = changed('the update to Sanjay P.', 'Sending the update',
  [['t2a1', 'Sending the update to Sanjay P.'], ['t2a2', 'Posting the note on INC-1088']],
  'Update sent to Sanjay P.', "I'll send the next update when the re-run completes at 12:30",
  [INC1088, BRIDGE]);
const TEC02_SUBSCRIBED = changed('your INC-1088 subscription', 'Subscribing you',
  [['t2u1', 'Subscribing you to INC-1088']],
  'Subscribed to INC-1088 updates', 'First one at 12:30', [INC1088]);

/* ── TEC-03 · the Bengaluru VPN pattern ─────────────────────────────────────────────────── */
const CASES = [
  tk('INC-0611', { authority: 'history', freshness: 'Resolved Feb 2026', detail: 'BLR-2 wireless · DHCP lease 30 min on BLR-2 WLC' }),
  tk('INC-0702', { authority: 'history', freshness: 'Resolved Apr 2026', detail: 'BLR-2 wireless · same' }),
  tk('INC-0839', { authority: 'history', freshness: 'Resolved Jun 2026', detail: 'BLR-2 wireless · same' }),
  tk('INC-0917', { authority: 'history', freshness: 'Resolved Jul 2026', detail: 'BLR-1 wireless · lease copied to BLR-1' }),
];
const KB0342 = kb('KB-0342', { freshness: 'Verified 14 Jul 2026', detail: 'VPN drops at a fixed interval — DHCP lease on the WLC · 4 linked incidents' });
const BLR_OPEN = [tk('INC-1109', { detail: 'Open · Network · BLR-2 wireless' }), tk('INC-1115', { detail: 'Open · Service Desk · network not recorded' })];

const TEC_03: Script = {
  topic: 'the Bengaluru VPN drops',
  activity: 'Matching the pattern',
  view: 'reveal',
  match: /vpn.*(drop|disconnect).*(30|thirty)|every 30 minutes.*vpn|ring any bells/i,
  beats: [
    ch('t3s1', 'Search', 'Searching similar incidents — 4 matches', m('4', 'identical cases'), CASES, { 'similar case': 4 }),
    ch('t3s2', 'Search', 'Searching KB — 1 match', m('KB-0342', 'verified 14 Jul'), [KB0342], { 'KB article': 1 }),
    T('t3d1', 'evidence', 'Seen this before', '4 identical cases, all BLR wireless, same fix [INC-0611] [INC-0702] [INC-0839] [INC-0917]',
      'Every one resolved by extending the DHCP lease on the wireless controller from 30 minutes to 8 hours.',
      ['INC-0611', 'INC-0702', 'INC-0839', 'INC-0917']),
    ch('t3s3', 'Verify', 'Checking Bengaluru — 2 open VPN tickets', m('2', 'open at Bengaluru'), BLR_OPEN, { 'open ticket': 2 }),
    T('t3d2', 'evidence', 'And the article is current', 'KB-0342 covers it, verified 14 Jul [KB-0342]',
      'The article names the lease, the controllers, and the four incidents.', ['KB-0342']),
    ch('t3s4', 'Verify', 'Reading resolutions — 4', m('4 of 4', 'the same fix'), undefined, { resolution: 4 }),
    /* NO GAP BEAT. It rendered a Not-verified caveat saying "you haven't linked the ticket" -
       which is not a limit on the ANSWER, it is the next step, and the recommended action under
       the turn already is that step. Two statements of one thing, and the yellow one made a
       complete diagnosis look doubtful. */
    {
      kind: 'answer',
      payload: {
        form: 'text',
        title: 'Pattern match',
        /* NO AUTHORED HEADLINE AND NO AUTHORED FACTS. Both are read off the KB article and the
           cases it is linked to, so removing a case changes the sentence, the confidence line
           and the strip together instead of leaving three copies of a "4" to fall out of step. */
        blocks: [
          { w: 'patternbrief' },
          { w: 'matchcards' },
          { w: 'recurrence' },
        ],
        basedOn: ['KB-0342', 'INC-0611', 'INC-0917'],
        menu: ['Show technical details', 'Open KB-0342', 'Copy resolution steps'],
      },
    },
  ],
};

/* The picker turn — "Link to a ticket" opens it. Two candidate rows and "enter a ref"; the pick
   is the turn's selection, and the attached action relabels to "Link INC-1109". */
const TEC03_LINK: Script = {
  topic: "the user's ticket",
  activity: 'Finding the ticket to link',
  match: /^link to a ticket$/i,
  beats: [
    step('t3l1', "Finding the user's ticket — 2 candidates at Bengaluru", BLR_OPEN),
    {
      kind: 'answer',
      payload: {
        form: 'text', title: 'Link', headline: 'Which one is theirs?',
        text: 'INC-1109 is on BLR-2 wireless — the same signature. INC-1115 has no network recorded.',
        blocks: [{ w: 'linkpicker', options: ['INC-1109', 'INC-1115'] }],
        basedOn: ['INC-1109', 'INC-1115'],
      },
    },
  ],
};

/* "Show the 4 resolved cases" - the same cards, in `resolved` mode, where the resolution is
   the impact line. Nothing here is authored: the set is whatever the article is linked to. */
const TEC03_RESOLVED: Script = {
  topic: 'the resolved cases',
  activity: 'Reading the resolved cases',
  match: /^show the \d+ resolved cases$/i,
  beats: [
    /* THE ARTICLE IS READ, not just cited: this set IS its `linked` list, so the step that
       produces the cards has to show where the list came from or `basedOn` over-claims. */
    step('t3rc1', 'Reading the resolved cases linked to KB-0342', [KB0342, ...CASES]),
    {
      kind: 'answer',
      payload: {
        form: 'text', title: 'Resolved cases', headline: 'Every one closed the same way',
        blocks: [{ w: 'resolvedcases' }],
        basedOn: ['KB-0342', 'INC-0611', 'INC-0917'],
      },
    },
  ],
};

const TEC03_OTHERS: Script = {
  topic: 'open VPN tickets at Bengaluru',
  activity: 'Checking open tickets at Bengaluru',
  match: /anyone else in bengaluru|show all blr vpn tickets/i,
  beats: [
    step('t3o1', 'Checking open tickets at Bengaluru — 2 with VPN in the title', BLR_OPEN),
    {
      kind: 'answer',
      payload: {
        form: 'text', title: 'Bengaluru', headline: 'Two open at Bengaluru — one is the same signature',
        blocks: [{ w: 'tickettable', preset: 'blrOpenVpn', single: true }],
        basedOn: ['INC-1109', 'INC-1115'],
      },
    },
  ],
};

const TEC03_LINKED = changed('linking {{qref}}', 'Linking {{qref}}',
  [['t3a1', 'Linking {{qref}}'], ['t3a2', 'Attaching the similar-incident evidence — 4 cases']],
  /* The second step really does read the four cases — two of them are named on the strip. */
  'Linked to {{cref}}', 'Nothing on the ticket has changed yet', [KB0342, CASES[0], CASES[3]]);
const TEC03_APPLIED = changed('applying KB-0342 to {{qref}}', 'Applying KB-0342',
  [['t3b1', 'Adding the resolution steps to {{qref}}'], ['t3b2', 'Setting {{qref}} to Pending user confirmation'], ['t3b3', 'Notifying the requester']],
  'KB-0342 applied to {{cref}}', 'If they confirm, it auto-resolves in 48h', [KB0342]);
const TEC03_NOTED = changed('the recommendation, as a note', 'Posting the note',
  [['t3c1', 'Posting the recommendation as a note']],
  'Recommendation noted on {{cref}}', 'It is on the ticket, internal — nothing else has changed', [KB0342]);

/* ── TEC-04 · hold INC-1062 pending TelcoNet ────────────────────────────────────────────── */
const INC1062 = tk('INC-1062', { freshness: 'Updated yesterday', detail: 'P3 · In progress · waiting on TelcoNet fibre repair' });
const HOLD_POLICY = doc('Hold policy · vendor pending', { detail: 'On hold pauses the SLA clock' });
const TELCO_FEED = dat('TelcoNet ticket feed', { freshness: 'Synced 08:00' });

const TEC_04: Script = {
  topic: 'INC-1062',
  activity: 'Preparing the hold',
  view: 'reveal',
  match: /commercial street|on hold.{0,80}(telco|fibre)|TT-BLR-99120/i,
  beats: [
    ch('t4s1', 'Find', 'Finding the ticket — INC-1062', m('INC-1062', 'P3 · In progress · 1d 4h left'), [INC1062], { ticket: 1 }),
    ch('t4s2', 'Check', 'Checking hold rules', m('paused', 'SLA clock while on hold'), [HOLD_POLICY], { 'hold rule': 1 }),
    T('t4d1', 'routing', 'Good news on the clock', 'On hold pauses the SLA clock — 1d 4h remaining is preserved [INC-1062]',
      'The clock resumes when the hold is lifted; no breach accrues while TelcoNet has it.', ['Hold policy · vendor pending']),
    ch('t4s3', 'Check', 'Checking the vendor ref against the TelcoNet feed', m('not found', 'in the 08:00 feed'), [TELCO_FEED], { 'data source': 1 }),
    T('t4d2', 'gap', 'One thing I could not confirm', "TT-BLR-99120 isn't in the TelcoNet feed — I'll record it as typed",
      'The feed synced at 08:00; a ref raised after that would not show yet.', ['TelcoNet ticket feed']),
    {
      kind: 'answer',
      payload: {
        form: 'text',
        title: 'Hold',
        headline: 'Ready — hold INC-1062 pending TelcoNet',
        blocks: [
          { w: 'hold', ref: 'INC-1062',
            rows: [
              { label: 'Status', from: 'In progress', to: 'On hold', editor: 'select', options: ['On hold'] },
              { label: 'Pending reason', from: '—', to: 'Vendor (TelcoNet)', editor: 'select',
                options: ['Vendor (TelcoNet)', 'Customer', 'Third party', 'Change window'] },
              { label: 'Vendor ref', from: '—', to: 'TT-BLR-99120', editor: 'text' },
              /* THE CLOCK IS NOT A CHOICE. It pauses because the ticket goes on hold — offering
                 a pencil beside it would invite a reader to argue with arithmetic. */
              { label: 'SLA clock', from: 'running (1d 4h)', to: 'paused', fact: true },
              { label: 'Follow-up', from: '—', to: 'reminder in 24h', editor: 'select',
                options: ['reminder in 24h', 'reminder in 48h', 'no reminder'] },
            ],
            why: "Fibre repair is with TelcoNet; nothing we can do until it's done.",
            note: 'On hold pending TelcoNet fibre repair at Commercial Street. Vendor ref TT-BLR-99120. POS terminals offline; branch operating on manual fallback. Chase TelcoNet if no update by tomorrow 10:00.',
            reminder: 'tomorrow 10:00', pendingReason: 'Vendor (TelcoNet)', vendorRef: 'TT-BLR-99120',
            /* The ref was not in the 08:00 feed — the gap finding above; recorded as such. */
            vendorRefUnverified: true,
            banner: { text: 'INC-1062 on hold — reminder set for tomorrow 10:00' },
            bannerNoReminder: { text: 'INC-1062 on hold — no reminder set' } },
          { w: 'callout', text: "TelcoNet fibre repairs average {{telconetWait}} days — set the branch's expectations." },
        ],
        basedOn: ['INC-1062', 'Hold policy · vendor pending', 'TelcoNet ticket feed'],
        menu: ['Edit note', 'Hold without a reminder'],
      },
    },
  ],
};

const TEC04_HELD = changed('the hold on INC-1062', 'Holding INC-1062',
  [['t4a1', 'Setting INC-1062 to On hold'], ['t4a2', 'Pausing the SLA clock'], ['t4a3', 'Posting the note']],
  'INC-1062 on hold pending TelcoNet', "I'll remind you {{reminder}} to chase",
  [INC1062, HOLD_POLICY],
  { nextFallback: 'No reminder is set — chase TelcoNet when you are ready' });

const TEC04_BRANCH: Script = {
  topic: 'a note for the branch',
  activity: 'Drafting for the branch',
  match: /tell the branch what to expect/i,
  beats: [
    step('t4b1', 'Drafting for the branch — Commercial Street', [INC1062]),
    {
      kind: 'answer',
      payload: {
        form: 'text', title: 'For the branch', headline: 'For the branch — friendly by default',
        blocks: [
          { w: 'note', id: 'branch', ref: 'INC-1062', draftId: 'tec04b', to: 'Reply to requester · Commercial Street branch', external: true,
            tone: 'friendly',
            tones: {
              friendly: 'Hi — quick update on the POS terminals at Commercial Street. The fault is on the fibre line, which TelcoNet is repairing (their ref TT-BLR-99120). Repairs like this usually take about a week, so please keep using the manual fallback for now. We are chasing them daily and will update you as soon as the line is back.',
              formal: 'Update on INC-1062 (Commercial Street POS). The outage is caused by a fibre fault under repair by TelcoNet, reference TT-BLR-99120. Repairs of this kind average around a week; please continue on the manual fallback in the meantime. We will chase TelcoNet daily and confirm as soon as service is restored.',
              shorter: 'POS outage is a TelcoNet fibre fault (ref TT-BLR-99120), typically about a week to repair. Please stay on manual fallback; we will update you daily.',
            },
            prefill: 'Hi — quick update on the POS terminals at Commercial Street. The fault is on the fibre line, which TelcoNet is repairing (their ref TT-BLR-99120). Repairs like this usually take about a week, so please keep using the manual fallback for now. We are chasing them daily and will update you as soon as the line is back.',
            primary: 'Send to branch', secondary: 'Discard',
            banner: { text: 'Reply sent on INC-1062 — the branch knows what to expect' } },
        ],
        basedOn: ['INC-1062'],
      },
    },
  ],
};

const TEC04_CHASE: Script = {
  topic: 'a chase to TelcoNet',
  activity: 'Drafting the chase',
  match: /chase telconet now/i,
  beats: [
    step('t4c1', 'Drafting the chase — TelcoNet NOC', [INC1062, dat('Vendor contacts · TelcoNet')]),
    {
      kind: 'answer',
      payload: {
        form: 'text', title: 'Chase', headline: 'Chase ready — formal, with the ref',
        blocks: [
          { w: 'note', id: 'chase', ref: 'INC-1062', draftId: 'tec04c', to: 'Chase to TelcoNet NOC', chase: true,
            tone: 'formal',
            tones: {
              formal: "TelcoNet NOC — requesting an update on TT-BLR-99120 (fibre repair, Commercial Street branch). POS terminals have been offline since it was raised three days ago and the branch is on manual fallback. Please confirm the engineer's ETA and the expected restoration time today.",
              friendly: 'Hi TelcoNet team — could we get an update on TT-BLR-99120 (Commercial Street fibre)? The branch has been on manual fallback for three days. An ETA today would really help.',
              shorter: 'Update please on TT-BLR-99120 (Commercial Street fibre) — 3 days down, ETA today?',
            },
            prefill: "TelcoNet NOC — requesting an update on TT-BLR-99120 (fibre repair, Commercial Street branch). POS terminals have been offline since it was raised three days ago and the branch is on manual fallback. Please confirm the engineer's ETA and the expected restoration time today.",
            primary: 'Send chase', secondary: 'Discard',
            banner: { text: 'TelcoNet chased on INC-1062 — last chased is now today' } },
        ],
        basedOn: ['INC-1062', 'Vendor contacts · TelcoNet'],
      },
    },
  ],
};

const TEC04_BRANCH_SENT = changed('the reply to the branch', 'Sending the reply',
  [['t4d1', 'Sending the reply to the branch']],
  'Reply sent on INC-1062', 'The branch knows what to expect', [INC1062]);
const TEC04_CHASE_SENT = changed('the chase to TelcoNet', 'Sending the chase',
  [['t4e1', 'Sending the chase to TelcoNet NOC']],
  'TelcoNet chased on INC-1062', "I'll flag it if they stay silent for 48h",
  [INC1062, dat('Vendor contacts · TelcoNet')]);

/* ── TEC-05 · the plain-English reply on INC-1095 ───────────────────────────────────────── */
const INC1095 = tk('INC-1095', { freshness: 'Updated 06:31', detail: 'P3 · In progress · fix identified · requester awaiting reply' });
const REQ_MSGS = tk('INC-1095 · requester messages', { freshness: 'Updated 06:31', detail: '2 messages · both asked for plain English' });
const PLAIN = doc('Plain-language guide');
const JARGON = [
  { term: 'a transmission fault', replacement: 'a fault when the settlement file was sent' },
  { term: 'a supplementary run', replacement: 'an extra processing run' },
  { term: 'settlement file', replacement: 'payment file', note: 'kept "settlement file" once for accuracy' },
];
const TEC05_FORMAL = 'Thank you for your patience. We found the cause: a fault when the settlement file was sent to the bank. The payment file will be resent in an extra processing run today, and the credits should reach the merchant accounts by this evening. We will confirm once it is complete.';

const TEC_05: Script = {
  topic: 'a reply on INC-1095',
  activity: 'Drafting the reply',
  view: 'reveal',
  match: /merchant settlement|transmission fault|supplementary run/i,
  beats: [
    ch('t5s1', 'Read', 'Reading INC-1095 — 4 updates', m('4', 'updates'), [INC1095], { update: 4 }),
    ch('t5s2', 'Read', "Checking the requester's previous messages — 2", m('2', 'messages, both asking for plain English'), [REQ_MSGS], { message: 2 }),
    T('t5d1', 'evidence', 'Worth knowing before you write', 'Requester asked twice for a plain-English update [INC-1095]',
      'Yesterday 09:05 and today 06:31 — the same request both times.', ['INC-1095 · requester messages']),
    ch('t5s3', 'Draft', 'Drafting'),
    ch('t5s4', 'Draft', 'Checking for jargon — 3 terms', m('3', 'terms simplified'), [PLAIN], { term: 3 }),
    T('t5d2', 'evidence', 'Plain English, checked', '3 technical terms replaced',
      'transmission fault, supplementary run, settlement file — one kept once for accuracy.', ['Plain-language guide']),
    {
      kind: 'answer',
      payload: {
        form: 'text',
        title: 'Reply',
        /* THE COUNT IS NOT IN THE HEADLINE. It is a fact about the draft, and it lives on the
           draft - in the footer, beside the list of what was actually replaced. */
        headline: 'Reply drafted — plain English, ready to send',
        blocks: [
          { w: 'prose', lines: [
            { label: 'Why this tone', text: 'the requester asked twice for plain English. This answers that in three sentences.' },
            { label: 'Goes to', text: 'the requester on [INC-1095], as a public reply from you.' },
          ] },
          { w: 'draftblk', id: 'reply', ref: 'INC-1095', draftId: 'tec05',
            label: 'Reply to requester · Merchant Services',
            /* Sending moves the ticket to wait on the requester. */
            awaits: true,
            tone: 'formal',
            tones: {
              formal: TEC05_FORMAL,
              friendly: 'Thanks for bearing with us. We found what went wrong: a fault when the settlement file was sent to the bank. The payment file goes out again in an extra processing run today, and the credits should land in the merchant accounts by this evening. We will let you know as soon as it is done.',
              shorter: 'Cause found: a fault when the settlement file was sent. The payment file is being resent in an extra processing run today; credits by this evening. We will confirm when done.',
            },
            prefill: TEC05_FORMAL,
            jargon: JARGON },
        ],
        basedOn: ['INC-1095', 'INC-1095 · requester messages', 'Plain-language guide'],
        menu: ['Make it shorter', 'Show what the requester will see', 'Copy'],
      },
    },
  ],
};

const TEC05_CREDIT: Script = {
  topic: 'the credit time',
  activity: 'Checking the batch schedule',
  match: /add the expected credit time/i,
  beats: [
    step('t5c1', 'Checking the supplementary run schedule', [dat('Payments batch schedule', { detail: 'Supplementary run closes 17:30' })]),
    {
      kind: 'answer',
      payload: {
        form: 'text', title: 'Credit time', headline: 'One sentence to add',
        blocks: [
          { w: 'diff', id: 'credit', title: 'Draft on INC-1095', mutation: 'append-draft', ref: 'INC-1095', draftId: 'tec05',
            sentence: 'Credits are expected by 6 PM.',
            rows: [{ label: 'Insert', from: '—', to: 'Credits are expected by 6 PM.' }],
            why: 'The supplementary run closes at 17:30; credits post within 30 minutes.',
            primary: 'Add to the draft', secondary: 'Leave it',
            banner: { text: 'Draft updated — the sentence is in the reply above' } },
        ],
        basedOn: ['Payments batch schedule'],
      },
    },
  ],
};

const TEC05_SENT = changed('the reply on INC-1095', 'Sending the reply',
  [['t5a1', 'Posting the reply on INC-1095'], ['t5a2', 'Notifying the requester']],
  'Reply sent on INC-1095', "I'll nudge you if there's no reply in 2 days", [INC1095]);
const TEC05_SAVED = changed('the draft on INC-1095', 'Saving the draft',
  [['t5v1', 'Saving the draft on INC-1095']],
  'Draft saved on INC-1095', "It's in the ticket's drafts", [INC1095]);
const TEC05_REMINDED = changed('the follow-up on INC-1095', 'Setting the follow-up',
  [['t5r1', 'Setting the follow-up on INC-1095']],
  'Follow-up set on INC-1095', "I'll remind you in 2 days", [INC1095]);
const TEC05_APPENDED = changed('the sentence on the draft', 'Updating the draft',
  [['t5p1', 'Adding the sentence to the draft']],
  'Draft updated on INC-1095', 'The sentence is in the reply above — send when ready',
  [dat('Payments batch schedule', { detail: 'Supplementary run closes 17:30' })]);

/* ── TEC-06 · waiting on vendors ────────────────────────────────────────────────────────── */
const PENDING = dat('Pending tickets · team', { freshness: 'Live', detail: '9 held by a board vendor' });
const VENDOR_BOARD_SRC = dat('Vendor status board');
const CHASE_LOG = dat('Chase log', { freshness: 'Live' });

const TEC_06: Script = {
  topic: 'tickets waiting on vendors',
  activity: 'Grouping the pending tickets',
  view: 'reveal',
  match: /waiting on vendors|stuck waiting|pending tickets.{0,40}vendor/i,
  beats: [
    ch('t6s1', 'Gather', 'Reading pending tickets', m('all', 'waiting on a vendor'), [PENDING], { ticket: 9 }),
    ch('t6s2', 'Gather', 'Grouping by vendor', m('by vendor', 'grouped'), [VENDOR_BOARD_SRC], { vendor: 3 }),
    ch('t6s3', 'Check', 'Checking last-chased dates', m('chases', 'read'), [CHASE_LOG], { 'chase record': 9 }),
    /* NO GAP BEAT. "Three have gone quiet" is the headline's second sentence and the card label's
       count — a third statement of it, in yellow, made the answer look uncertain about a number
       it had already given twice. */
    {
      kind: 'answer',
      payload: {
        form: 'text',
        title: 'Waiting on vendors',
        /* NOTHING AUTHORED. Every count, name and ref is read off the vendor queue, which is the
           only way one turn can be true at nine tickets and at sixty-two. */
        blocks: [
          { w: 'vendorbrief' },
          { w: 'vendorcards' },
          { w: 'vendorstrip' },
        ],
        basedOn: ['Pending tickets · team', 'Vendor status board', 'Chase log'],
        menu: ['Show as table', 'Export for the vendor call'],
      },
    },
  ],
};

/* "Show the other N" — few enough to just show. */
const TEC06_REST: Script = {
  topic: 'the rest of the vendor queue',
  activity: 'Reading the rest of the vendor queue',
  match: /^show the other \d+$/i,
  beats: [
    step('t6rest', 'Reading the rest of the vendor queue', [PENDING]),
    {
      kind: 'answer',
      payload: {
        form: 'text', title: 'The rest', headline: 'The rest, by urgency',
        blocks: [{ w: 'vendorrest' }],
        basedOn: ['Pending tickets · team'],
      },
    },
  ],
};

/* "Show all N by vendor" — THE TURN THAT HOLDS THE VOLUME. One collapsed group per vendor, so
   sixty-two tickets are a list of twenty-seven names until you ask for one of them. */
const TEC06_ALL: Script = {
  topic: 'the whole vendor queue',
  activity: 'Grouping the whole queue by vendor',
  match: /^show all \d+ by vendor$/i,
  beats: [
    step('t6all', 'Grouping the whole queue by vendor', [PENDING, VENDOR_BOARD_SRC]),
    {
      kind: 'answer',
      payload: {
        form: 'text', title: 'By vendor', headline: 'Every vendor, biggest first',
        blocks: [{ w: 'vendorgroups2' }],
        basedOn: ['Pending tickets · team', 'Vendor status board'],
      },
    },
  ],
};

/* The preview above five — a checklist of every overdue chase, all ticked. */
const TEC06_PREVIEW: Script = {
  topic: 'the chases about to go out',
  activity: 'Listing the overdue chases',
  /* The label the action carries IS the question asked, so this has to match that and not a
     sentence nobody says. Digits only, so the small dataset's worded "Chase the three overdue"
     — which sends directly — cannot land here. */
  match: /^chase the \d+ overdue$/i,
  beats: [
    step('t6pv', 'Listing the overdue chases by vendor', [CHASE_LOG]),
    {
      kind: 'answer',
      payload: {
        form: 'text', title: 'Before I send', headline: 'Untick anything you would rather leave',
        text: 'One chase per ticket, to the vendor on it. Nothing goes until you send.',
        blocks: [{ w: 'chasepreview', id: 'chases' }],
        basedOn: ['Chase log'],
      },
    },
  ],
};

/* The editable turn above two missing refs — one row per ticket, grouped by vendor. */
const TEC06_ALLREFS: Script = {
  topic: 'the missing vendor refs',
  activity: 'Opening every ticket with no vendor ref',
  match: /^add missing vendor refs.*$/i,
  beats: [
    step('t6ar', 'Reading every ticket with no vendor ref', [PENDING]),
    {
      kind: 'answer',
      payload: {
        form: 'text', title: 'Vendor refs', headline: 'Fill in what you have',
        text: 'A ticket with no reference does not appear in the vendor\u2019s own feed. Blank rows are left alone.',
        blocks: [{ w: 'missingrefs', id: 'refs' }],
        basedOn: ['Pending tickets · team'],
      },
    },
  ],
};

const TEC06_BREACH: Script = {
  topic: 'which are close to breaching',
  activity: 'Checking the SLA clocks',
  match: /close to breaching/i,
  beats: [
    step('t6b1', 'Checking SLA clocks — 9', [SLA_CLOCKS]),
    {
      kind: 'answer',
      payload: {
        form: 'text', title: 'Breach risk', headline: 'Three under 12 hours — INC-1079 first',
        blocks: [{ w: 'tickettable', preset: 'vendorSla' }],
        basedOn: ['SLA clock service'],
      },
    },
  ],
};

/* The editable turn — "Add the 2 missing vendor refs" opens it. One text field per ticket. */
const TEC06_REFS: Script = {
  topic: 'the missing vendor refs',
  activity: 'Opening the refs',
  match: /^add the \d+ missing vendor refs?$/i,
  beats: [
    step('t6r1', 'Checking INC-1041 and INC-1055 — no vendor ref on either', [tk('INC-1041'), tk('INC-1055')]),
    {
      kind: 'answer',
      payload: {
        form: 'text', title: 'Vendor refs', headline: 'Enter the TelcoNet references',
        text: "TelcoNet's NOC quotes a TT-BLR-… reference on every fibre job. Without one, neither ticket appears in their feed.",
        blocks: [{ w: 'fieldsedit', id: 'refs', title: 'Vendor refs · TelcoNet',
          rows: [{ key: 'INC-1041', label: 'INC-1041' }, { key: 'INC-1055', label: 'INC-1055' }],
          note: 'Enter the reference TelcoNet quoted on each job.' }],
        basedOn: ['INC-1041', 'INC-1055'],
      },
    },
  ],
};

/* KEPT FROM A DELETED BUTTON. "Set ETA" wrote `ticket.eta` — the date a vendor promised — and
   nothing else on this surface writes one, while every vendor row still prints it. */
const TEC06_ETA: Script = {
  topic: 'the ETAs the vendors gave',
  activity: 'Opening the ETAs',
  match: /^record a vendor eta$/i,
  beats: [
    step('t6e1', 'Reading the three with no ETA on file', [PENDING, CHASE_LOG]),
    {
      kind: 'answer',
      payload: {
        form: 'text', title: 'Vendor ETAs', headline: 'Which date did they give?',
        blocks: [{ w: 'fieldsedit', id: 'eta', title: 'ETAs · the three with none on file',
          rows: [{ key: 'INC-1041', label: 'INC-1041' }, { key: 'INC-1055', label: 'INC-1055' }, { key: 'INC-1090', label: 'INC-1090' }],
          note: 'However the vendor phrased it — "Fri", "next Tuesday", a date. It goes on the ticket as given.' }],
        basedOn: ['Pending tickets · team', 'Chase log'],
      },
    },
  ],
};

const TEC06_ETA_SET = changed('the vendor ETAs', 'Recording the ETAs',
  [['t6f1', 'Recording the ETAs']],
  'ETAs recorded on {{crefs}}', 'The vendor list shows them now, and the handover reads them',
  [PENDING]);

const TEC06_CHASED = changed('the chases', 'Sending the chases',
  [['t6a1', 'Sending the chases'], ['t6a2', 'Updating last-chased']],
  'Chased {{crefs}}', "I'll flag any that stay silent for 48h", [CHASE_LOG]);
const TEC06_REFS_SAVED = changed('the vendor refs', 'Recording the refs',
  [['t6v1', 'Recording the vendor refs']],
  'Vendor refs recorded on {{crefs}}', 'TelcoNet can find them now', [tk('INC-1041'), tk('INC-1055')]);

/* ── TEC-07 · the night-shift handover ──────────────────────────────────────────────────── */
const TODAY_UPDATES = dat('Ticket activity · today', { freshness: 'Live' });
const COMPLIANCE = doc('Compliance register', { freshness: 'Checked just now', detail: '4 reportable open · 1 overdue' });

const TEC_07: Script = {
  topic: 'your night-shift handover',
  activity: 'Planning your night-shift handover',
  view: 'reveal',
  match: /handover.*night|night.?shift.*handover|write my handover/i,
  beats: [
    /* TALLIED — the live scope strip, exactly as the plan-first handover had it. */
    ch('t7s1', 'Take stock', 'Reading your queue — 10', m('10', 'tickets in your queue'), [MY_QUEUE], { ticket: 10 }),
    ch('t7s2', 'Take stock', "Reading today's updates", m('2', 'still burning'), [TODAY_UPDATES], { 'data source': 1 }),
    T('t7d1', 'evidence', 'Two are still burning', 'Two active P1/P2 with clocks under 3h',
      'INC-1088 (2h 40m) and INC-1077 (0h 40m).', ['My queue']),
    ch('t7s3', 'Check exposure', 'Checking regulatory flags — 4', m('4', 'reportable, 1 overdue'), [COMPLIANCE], { 'regulatory item': 4 }),
    T('t7d2', 'gap', 'One needs a call tonight', 'INC-1077 is a regulatory item AND breaching — it needs a decision tonight [INC-1077]',
      'Interim report, or wait for the full RCA. Nobody has decided.', ['Compliance register']),
    ch('t7s4', 'Build', 'Building the handover plan'),
    /* THE PLAN-FIRST INTERACTION. The request is consequential (it notifies a person), so Nova
       PLANS before it acts: the proposal parks the stream for review, a described change is
       mapped onto step IDS (tech/planRevise.ts) so the diff is computed rather than authored,
       and execution — derived from the APPROVED proposal, never from this file's original — runs
       with a deterministic notification failure so the partial state and its retry are real.
       The completion is the live handover document, with the approved steps' outcomes above it. */
    {
      kind: 'proposal',
      proposal: {
        id: 't7plan',
        intro: "Here's how I'll build it.",
        steps: [
          { id: 'p1', label: 'Summarise the two burning incidents',
            detail: 'INC-1088 and INC-1077 — state, owner, next action, and the clock on each.',
            execLabel: 'Summarising the burning incidents',
            covers: 'the 2 burning incidents', reads: 'My queue',
            done: { label: 'Burning', value: '**INC-1088** and **INC-1077** summarised with next actions' } },
          { id: 'p2', label: 'List the blocked tickets with what unblocks them',
            detail: 'Nine on three vendors, plus INC-1101 waiting on its requester.',
            execLabel: 'Listing the blocked tickets',
            covers: 'the 10 blocked tickets', reads: 'My queue',
            done: { label: 'Blocked', value: '**9 on vendors** and **1 on a requester**, each with what unblocks it' } },
          { id: 'p3', label: 'Flag the regulator deadlines',
            detail: 'The four reportable items, overdue first — INC-1077 is a day past its window.',
            execLabel: 'Flagging the regulator deadlines',
            covers: 'the 4 regulator deadlines', reads: 'Compliance register',
            done: { label: 'Regulator', value: '**4 reportable** listed, **INC-1077** overdue by 1 day', tone: 'warn' } },
          { id: 'p4', label: 'Attach the overnight SLA clocks',
            detail: 'Which clocks keep running tonight and which are paused.',
            execLabel: 'Attaching the SLA clocks',
            covers: 'the overnight SLA clocks', reads: 'My queue',
            done: { label: 'SLA', value: '**6 clocks** run overnight, **3** are paused' } },
          { id: 'p5', label: 'Call out the decision needed tonight',
            detail: 'INC-1077 — interim regulatory report, or wait for the full RCA.',
            execLabel: 'Calling out the decision',
            covers: "tonight's decision on INC-1077", reads: 'Compliance register',
            done: { label: 'Decision', value: '**INC-1077** — interim report or full RCA, flagged for the night lead', tone: 'warn' } },
          { id: 'p6', label: 'Notify the night-shift lead the handover is ready',
            detail: 'A direct notification so it is read at shift start, not found later.',
            execLabel: 'Notifying the night-shift lead',
            posts: 'the night-shift lead, directly',
            done: { label: 'Notified', value: '**Night-shift lead**, directly', tone: 'ok' },
            fail: { note: 'The notification service timed out — the handover is built, but nobody has been told yet.', retry: 'Retry notification' } },
        ],
        impact: [
          { label: 'Handover', value: 'Built from live ticket data — nothing is posted until you post it', stepId: 'p1' },
          { label: 'Notification', value: 'The night-shift lead will be told it is ready', stepId: 'p6' },
          { label: 'Tickets', value: 'No ticket fields change' },
        ],
        evidence: [
          'Two active P1/P2 with clocks under 3h',
          'INC-1077 is a regulatory item AND breaching — it needs a decision tonight',
          '9 tickets are waiting on vendors',
        ],
        approve: 'Build the handover',
        approveMeta: 'you review before it posts',
        modify: 'Change the plan',
        addable: { id: 'p7', label: "Include today's closed tickets",
          detail: 'The two you closed today, so the night shift knows what is already done.',
          execLabel: 'Including the closed tickets',
          covers: "today's closed tickets", reads: 'Ticket activity · today',
          done: { label: 'Closed today', value: '**2 tickets** included' } },
      },
    },
    {
      kind: 'answer',
      payload: {
        form: 'text',
        title: 'Handover',
        headline: 'Handover ready — one thing needs a decision tonight',
        blocks: [
          { w: 'techchips', set: 'tec07' },
          { w: 'handover', id: 'tec07' },
        ],
        basedOn: ['My queue', 'Ticket activity · today', 'Compliance register'],
        menu: ['Make it shorter', 'Show as plain text', 'Include closed-today'],
        followUps: ['Add a note for the night lead', 'What changed since my last handover?'],
      },
    },
  ],
};

const TEC07_NOTE: Script = {
  topic: 'a note for the night lead',
  activity: 'Opening a note',
  match: /note for the night lead/i,
  beats: [
    step('t7n1', 'Opening a note for the night lead', [COMPLIANCE]),
    {
      kind: 'answer',
      payload: {
        form: 'text', title: 'Night lead', headline: 'Note for the night lead — it goes at the end of the handover',
        blocks: [
          { w: 'note', id: 'nightlead', ref: 'INC-1077', draftId: 'tec07', target: 'handover', to: 'Note for the night lead',
            prefill: 'Night lead — INC-1077 needs a call on the interim regulatory report before 08:00; the SLA clock has 40 minutes and the reporting window closed yesterday. If Network has not sent the draft by 22:00, escalate to the duty manager.',
            primary: 'Add to handover', secondary: 'Discard',
            banner: { text: 'Note added — it is the last section of the handover above' } },
        ],
        basedOn: ['Compliance register'],
      },
    },
  ],
};

const TEC07_DIFF: Script = {
  topic: 'what changed since your last handover',
  activity: "Comparing with yesterday's shift log",
  match: /changed since my last handover/i,
  beats: [
    step('t7x1', "Comparing with yesterday's shift log — 20:00", [doc('Shift log · yesterday 20:00', { detail: 'Priya S. · evening handover' })]),
    {
      kind: 'answer',
      payload: {
        form: 'text', title: 'Since last handover', headline: 'Two new, two resolved, one escalated',
        blocks: [{ w: 'changes', set: 'sinceHandover' }],
        basedOn: ['Shift log · yesterday 20:00'],
      },
    },
  ],
};

/* ── the ref and KB scripts every mono chip reaches ─────────────────────────────────────── */
const TEC_REF_OPEN: Script = {
  topic: '{{qref}}',
  activity: 'Reading {{qref}}',
  match: /^open ((?:inc|req|prb|chg)-\d{3,5})\b/i,
  beats: [
    step('trf1', 'Reading {{qref}}', [tk('{{qref}}')]),
    {
      kind: 'answer',
      payload: {
        form: 'text', title: '{{qref}}', headline: '{{qref}} — where it stands',
        blocks: [{ w: 'status', ref: '$question' }],
        basedOn: ['{{qref}}'],
      },
    },
  ],
};

const TEC_REF_UPDATES: Script = {
  topic: 'the updates on {{qref}}',
  activity: 'Reading the log',
  match: /^show the updates on ((?:inc|req)-\d{3,5})\b/i,
  beats: [
    step('tru1', 'Reading the updates on {{qref}}', [tk('{{qref}} · updates')]),
    {
      kind: 'answer',
      payload: {
        form: 'text', title: '{{qref}}', headline: 'Every update on {{qref}}, stamped',
        blocks: [{ w: 'updates', ref: '$question' }],
        basedOn: ['{{qref}} · updates'],
      },
    },
  ],
};

const TEC_REF_NOTE: Script = {
  topic: 'a note on {{qref}}',
  activity: 'Opening a note',
  match: /^add a note to ((?:inc|req)-\d{3,5})\b/i,
  beats: [
    step('trn1', 'Opening a note on {{qref}}', [tk('{{qref}}')]),
    {
      kind: 'answer',
      payload: {
        form: 'text', title: 'Note', headline: 'Note on {{qref}}',
        blocks: [
          { w: 'note', id: 'refnote', ref: '$question', prefill: '', primary: 'Add note', secondary: 'Discard',
            banner: { text: 'Note added to {ref}' } },
        ],
        basedOn: ['{{qref}}'],
      },
    },
  ],
};

const TEC_REF_FOLLOWUP: Script = {
  topic: 'a follow-up on {{qref}}',
  activity: 'Setting a follow-up',
  match: /^set a follow-up on ((?:inc|req)-\d{3,5})\b/i,
  beats: [
    step('trw1', 'Setting a follow-up on {{qref}}', [tk('{{qref}}')]),
    {
      kind: 'answer',
      payload: {
        form: 'text', title: 'Follow-up', headline: 'Follow-up on {{qref}}',
        blocks: [
          { w: 'diff', id: 'fu', title: '{{qref}}', mutation: 'remind', ref: '$question',
            rows: [{ label: 'Follow-up', from: '—', to: 'tomorrow 10:00', editor: 'select', options: ['tomorrow 10:00', 'in 48h', 'next Monday 09:00'] }],
            why: 'Enough time for the credits to post and the requester to confirm.',
            primary: 'Set follow-up', secondary: 'Not now',
            banner: { text: 'Follow-up set on {ref} for tomorrow 10:00' } },
        ],
        basedOn: ['{{qref}}'],
      },
    },
  ],
};

const TEC_NOTE_ADDED = changed('the note', 'Posting the note',
  [['tna1', 'Posting the note']],
  'Note added to {{cref}}', "It's on the ticket, internal", [tk('{{qref}}')]);
const TEC_FOLLOWUP_SET = changed('the follow-up', 'Setting the follow-up',
  [['tfs1', 'Setting the follow-up']],
  'Follow-up set on {{cref}}', "I'll remind you {{when}}", [tk('{{qref}}')],
  { nextFallback: "I'll remind you when it is due" });

const TEC_KB_OPEN: Script = {
  topic: '{{qref}}',
  activity: 'Opening {{qref}}',
  match: /^open (kb-\d{3,5})\b/i,
  beats: [
    step('tkb1', 'Opening {{qref}}', [kb('{{qref}}')]),
    {
      kind: 'answer',
      payload: {
        form: 'text', title: '{{qref}}', headline: '{{qref}}',
        blocks: [{ w: 'kb', id: '$question' }],
        basedOn: ['{{qref}}'],
      },
    },
  ],
};

/** Chip scripts are reached by their QUESTION — they carry no case id, and live in the same
 *  registry map so `scriptForQuestion` finds them and the honesty sweep covers them. The
 *  What-changed scripts have no `match`: they are reached only by an attached action, which is
 *  the only thing that can hand them a mutation to run. */
export const TECHNICIAN_SCRIPTS: Record<string, Script> = {
  'TEC-01': TEC_01,
  'TEC-01/rest': TEC01_REST,
  'TEC-02': TEC_02,
  'TEC-03': TEC_03,
  'TEC-04': TEC_04,
  'TEC-05': TEC_05,
  'TEC-06': TEC_06,
  'TEC-07': TEC_07,
  'TEC-01/overnight': TEC01_OVERNIGHT,
  'TEC-01/started': TEC01_STARTED,
  'TEC-01/started3': TEC01_STARTED3,
  'TEC-02/bridge': TEC02_BRIDGE,
  'TEC-02/event': TEC02_EVENT,
  'TEC-02/event-added': TEC02_EVENT_ADDED,
  'TEC-02/sent': TEC02_SENT,
  'TEC-02/subscribed': TEC02_SUBSCRIBED,
  'TEC-03/link': TEC03_LINK,
  'TEC-03/others': TEC03_OTHERS,
  'TEC-03/resolved': TEC03_RESOLVED,
  'TEC-03/linked': TEC03_LINKED,
  'TEC-03/applied': TEC03_APPLIED,
  'TEC-03/noted': TEC03_NOTED,
  'TEC-04/held': TEC04_HELD,
  'TEC-04/branch': TEC04_BRANCH,
  'TEC-04/chase': TEC04_CHASE,
  'TEC-04/branch-sent': TEC04_BRANCH_SENT,
  'TEC-04/chase-sent': TEC04_CHASE_SENT,
  'TEC-05/credit': TEC05_CREDIT,
  'TEC-05/sent': TEC05_SENT,
  'TEC-05/saved': TEC05_SAVED,
  'TEC-05/reminded': TEC05_REMINDED,
  'TEC-05/appended': TEC05_APPENDED,
  'TEC-06/breach': TEC06_BREACH,
  'TEC-06/rest': TEC06_REST,
  'TEC-06/all': TEC06_ALL,
  'TEC-06/preview': TEC06_PREVIEW,
  'TEC-06/allrefs': TEC06_ALLREFS,
  'TEC-06/eta': TEC06_ETA,
  'TEC-06/eta-set': TEC06_ETA_SET,
  'TEC-06/refs': TEC06_REFS,
  'TEC-06/chased': TEC06_CHASED,
  'TEC-06/refs-saved': TEC06_REFS_SAVED,
  'TEC-07/note': TEC07_NOTE,
  'TEC-07/diff': TEC07_DIFF,
  'TEC/ref-open': TEC_REF_OPEN,
  'TEC/ref-updates': TEC_REF_UPDATES,
  'TEC/ref-note': TEC_REF_NOTE,
  'TEC/ref-followup': TEC_REF_FOLLOWUP,
  'TEC/note-added': TEC_NOTE_ADDED,
  'TEC/followup-set': TEC_FOLLOWUP_SET,
  'TEC/kb-open': TEC_KB_OPEN,
};
