/* THE LEADERSHIP RESPONSES — CXO-01 through CXO-07, their drills, and every functional chip.
 *
 * Numbers-first, visual-first, prose rationed to two sentences a section. EVERY numeral is a
 * `{{key}}` resolved against mockAnalytics.VALUES by the emitter — a script here types none —
 * and every chart names a dataset key that `dataset()` resolves, so a KPI, its chart and its
 * table can never disagree.
 *
 * Investigations run in LANES (Tickets · SLA · Teams · Trends…): a `burst` starts several at
 * once and they land one by one. First discovery only after two completions.
 */
import { fill } from '../mockAnalytics';
import type { Beat, Script, StepMetric, StepSource } from './registry';

const dat = (label: string, x?: Partial<StepSource>): StepSource => ({ label, kind: 'data', ...x });
const doc = (label: string, x?: Partial<StepSource>): StepSource => ({ label, kind: 'doc', ...x });

/** The same `{{key}}` the labels use, as a NUMBER — for the live scope strip, whose tallies
 *  are summed rather than printed. A script here still types no numeral, so a KPI and the strip
 *  that preceded it read one source. (`fmt` puts a comma in the thousands; the strip needs the
 *  number back out of it.) */
const n = (key: string): number => Number(fill(`{{${key}}}`).replace(/,/g, ''));

/** A lane check: WHICH source, the verb while it runs, the number it lands on, and what
 *  completing it adds to the live scope strip. */
const L = (id: string, lane: string, label: string, metric?: StepMetric, sources?: StepSource[], tally?: Record<string, number>): Extract<Beat, { kind: 'step' }> =>
  ({ kind: 'step', id, label, lane, metric, sources, tally });
const burst = (...steps: Array<Extract<Beat, { kind: 'step' }>>): Beat => ({ kind: 'burst', steps });
const m = (value: string, label: string): StepMetric => ({ value, label });

const TICKETS = dat('Ticket data · June', { freshness: 'Updated {{asOf}}' });
const TICKETS_MAY = dat('Ticket data · May');
const SLA_DATA = dat('SLA records · June', { freshness: 'Updated {{asOf}}' });
const TEAMS = dat('Team roster');
const VENDOR_BOARD = dat('Vendor status board');
const COMPLIANCE = doc('Compliance register');
const SEC_REG = dat('Security incident register');
const PROBLEM_LOG = dat('Problem candidates · 90 days');
const HR_DATA = dat('HR case data · 8 weeks');

const SCOPE = [m('{{juneTotal}}', 'tickets'), m('{{teams}}', 'teams'), m('{{dataSources}}', 'data sources')];
const COMMON_MENU_HINT = ['Show as table'];

/* ── CXO-01 · June vs May ───────────────────────────────────────────────── */
const CXO_01: Script = {
  topic: 'June against May',
  activity: 'Comparing June vs May',
  match: /june (versus|vs\.?) may|walk me through june/i,
  view: 'workspace',
  scope: SCOPE,
  beats: [
    burst(
      L('c1a', 'Tickets', 'Analysing June tickets', m('{{juneTotal}}', 'analysed'), [TICKETS], { ticket: n('juneTotal') }),
      L('c1b', 'SLA', 'Counting breaches', m('{{breaches}}', 'breaches'), [SLA_DATA], { 'breached ticket': n('breaches') }),
      L('c1c', 'Teams', 'Loading the four teams', m('{{teams}}', 'teams compared'), [TEAMS], { team: n('teams') }),
      L('c1d', 'Trends', 'Comparing periods'),
    ),
    burst(
      L('c1e', 'Tickets', 'Reading May for comparison', m('{{mayTotal}}', 'from May'), [TICKETS_MAY]),
      L('c1f', 'SLA', 'Checking breach patterns'),
    ),
    { kind: 'discovery', id: 'c1d1', role: 'evidence',
      headline: 'Volume up {{volumeDeltaPct}}% — VPN is the biggest mover',
      detail: 'VPN grew {{vpnDeltaPct}}%, {{vpnDeltaAbs}} more tickets than May.', support: ['Ticket data · June'] },
    L('c1g', 'Trends', 'Isolating what drove the change'),
    L('c1h', 'Teams', 'Comparing workload'),
    { kind: 'discovery', id: 'c1d2', role: 'evidence',
      headline: 'VPN incidents drive {{vpnShare}}% of breaches',
      detail: '{{vpnBreaches}} of the {{breaches}} June breaches were VPN tickets.', support: ['SLA records · June'] },
    {
      kind: 'answer',
      payload: {
        form: 'text', title: 'June vs May',
        headline: 'June ran {{volumeDeltaPct}}% hotter than May, and VPN is the reason',
        blocks: [
          { w: 'kpis', set: 'cxo01' },
          { w: 'chart', id: 'c1-compare', data: 'juneVsMay', title: 'June vs May by Category',
            groupBy: [{ id: 'category', label: 'By category' }, { id: 'team', label: 'By team' }, { id: 'priority', label: 'By priority' }],
            drill: { case: 'CXO-01/drill' } },
          { w: 'chart', id: 'c1-moved', data: 'whatMoved', title: 'What Moved · Absolute Change', drill: { case: 'CXO-01/drill' } },
        ],
        basedOn: ['Ticket data · June', 'SLA records · June'],
        menu: [...COMMON_MENU_HINT, 'Show underlying tickets', 'Export CSV'],
        followUps: ['What caused the VPN increase?', 'Which team took the hit?'],
      },
    },
  ],
};

const CXO01_DRILL: Script = {
  topic: 'one category in June',
  view: 'workspace', scope: SCOPE,
  beats: [
    burst(
      L('c1x1', 'Tickets', 'Filtering to the category', undefined, [TICKETS]),
      L('c1x2', 'Teams', 'Splitting by team', undefined, [TEAMS]),
    ),
    {
      kind: 'answer',
      payload: {
        form: 'text', title: 'Category drill', headline: 'Here is that category in June',
        blocks: [
          { w: 'kpis', set: 'segment' },
          { w: 'chart', id: 'c1x-team', data: 'categoryByTeam', title: 'By Team' },
        ],
        basedOn: ['Ticket data · June'],
      },
    },
  ],
};

const CXO01_CAUSE: Script = {
  topic: 'the VPN increase',
  activity: 'Tracing the VPN increase',
  match: /what caused the vpn increase/i,
  view: 'workspace', scope: SCOPE,
  beats: [
    burst(
      L('c1c1', 'Tickets', 'Reading the VPN tickets', m('{{vpnJune}}', 'VPN tickets'), [TICKETS]),
      L('c1c2', 'Trends', 'Comparing to the policy change date'),
    ),
    { kind: 'discovery', id: 'c1cd', role: 'evidence',
      headline: 'The spike starts the day after the password-policy change',
      detail: 'Daily VPN tickets rose {{vpnAfterMultiple}}× in the five days after {{policyChangeDate}}.', support: ['Ticket data · June'] },
    {
      kind: 'answer',
      payload: {
        form: 'text', title: 'Cause', headline: 'The password-policy change on {{policyChangeDate}}',
        blocks: [
          { w: 'chart', id: 'c1c-daily', data: 'vpnDaily', title: 'Daily VPN Tickets · June' },
        ],
        basedOn: ['Ticket data · June'],
      },
    },
  ],
};

const CXO01_TEAM: Script = {
  topic: 'which team took the hit',
  match: /which team took the hit/i,
  view: 'workspace', scope: SCOPE,
  beats: [
    burst(
      L('c1t1', 'Teams', 'Comparing team workload', m('{{teams}}', 'teams'), [TEAMS]),
      L('c1t2', 'SLA', 'Attributing breaches to teams', m('{{breaches}}', 'breaches'), [SLA_DATA]),
    ),
    {
      kind: 'answer',
      payload: {
        form: 'text', title: 'Team impact',
        headline: 'Network — {{networkTickets}} tickets and {{networkBreaches}} of the {{breaches}} breaches',
        blocks: [
          { w: 'chart', id: 'c1t-breaches', data: 'breachesByTeam', title: 'Breaches by Team',
            soWhat: 'Just {{networkVolumeShare}}% of the volume.' },
        ],
        basedOn: ['SLA records · June', 'Team roster'],
      },
    },
  ],
};

const CXO01_UNDERLYING: Script = {
  topic: 'the underlying tickets',
  match: /show underlying tickets/i,
  view: 'workspace', scope: SCOPE,
  beats: [
    L('c1u1', 'Tickets', 'Listing the categories', m('{{juneTotal}}', 'tickets'), [TICKETS, TICKETS_MAY]),
    {
      kind: 'answer',
      payload: {
        form: 'text', title: 'Underlying', headline: 'June and May, category by category',
        blocks: [{ w: 'chart', id: 'c1u-table', data: 'juneVsMay', title: 'June vs May', kinds: ['table'], export: 'june-vs-may.csv' }],
        basedOn: ['Ticket data · June', 'Ticket data · May'],
      },
    },
  ],
};

/* ── CXO-02 · SLA performance ───────────────────────────────────────────── */
const CXO_02: Script = {
  topic: 'SLA performance',
  activity: 'Checking SLA performance',
  match: /meeting our slas|breach most|sla performance/i,
  view: 'workspace', scope: [m('{{slaBound}}', 'SLA-bound tickets'), m('{{teams}}', 'teams'), m('{{dataSources}}', 'data sources')],
  beats: [
    burst(
      L('c2a', 'SLA', 'Measuring the SLA-bound tickets', m('{{slaBound}}', 'SLA-bound tickets'), [SLA_DATA], { 'SLA-bound ticket': n('slaBound') }),
      L('c2b', 'Teams', 'Attributing breaches by team', undefined, [TEAMS], { team: n('teams') }),
      L('c2c', 'Trends', 'Reading six months of compliance'),
    ),
    L('c2d', 'SLA', 'Counting breaches', m('{{breaches}}', 'breaches'), undefined, { 'breached ticket': n('breaches') }),
    { kind: 'discovery', id: 'c2d1', role: 'evidence',
      headline: '{{compliance}}% — first month below target since March',
      detail: 'The target is {{target}}%.', support: ['SLA records · June'] },
    L('c2e', 'Trends', 'Ranking breach causes'),
    { kind: 'discovery', id: 'c2d2', role: 'evidence',
      headline: 'VPN alone is {{vpnShare}}% of breaches',
      detail: '{{vpnBreaches}} of {{breaches}}.', support: ['SLA records · June'] },
    {
      kind: 'answer',
      payload: {
        form: 'text', title: 'SLA',
        headline: 'Not quite — {{compliance}}% against a {{target}}% target',
        blocks: [
          { w: 'kpis', set: 'cxo02' },
          { w: 'chart', id: 'c2-gauge', data: 'sla', title: 'Compliance · Six Months' },
          { w: 'chart', id: 'c2-breaches', data: 'breaches', title: 'Breaches',
            groupBy: [{ id: 'service', label: 'By service' }, { id: 'team', label: 'By team' }, { id: 'priority', label: 'By priority' }],
            drill: { case: 'CXO-02/drill' },
            soWhat: 'Fixing it puts us back above target.' },
        ],
        basedOn: ['SLA records · June', 'Team roster'],
        dataScope: '{{slaBound}} SLA-bound tickets · June · all teams',
        menu: [...COMMON_MENU_HINT, 'Show the {{breaches}} breached tickets', 'Export CSV'],
        followUps: ['Show the {{breaches}} breached tickets', 'How does Network compare to the other teams?'],
      },
    },
  ],
};

const CXO02_DRILL: Script = {
  topic: 'breached tickets in one segment',
  view: 'workspace', scope: SCOPE,
  beats: [
    L('c2x1', 'SLA', 'Filtering the breached tickets', undefined, [SLA_DATA]),
    {
      kind: 'answer',
      payload: {
        form: 'text', title: 'Breached', headline: 'The breached tickets in that segment',
        blocks: [{ w: 'chart', id: 'c2x-table', data: 'breachedTickets', title: 'Breached Tickets', kinds: ['table'], export: 'breached-tickets.csv' }],
        basedOn: ['SLA records · June'],
      },
    },
  ],
};

const CXO02_TICKETS: Script = {
  topic: 'the breached tickets',
  match: /show the \d+ breached tickets|breached tickets/i,
  view: 'workspace', scope: SCOPE,
  beats: [
    L('c2l1', 'SLA', 'Listing the breached tickets', m('{{breaches}}', 'tickets'), [SLA_DATA]),
    {
      kind: 'answer',
      payload: {
        form: 'text', title: 'Breached', headline: '{{breaches}} tickets',
        blocks: [{ w: 'chart', id: 'c2l-table', data: 'breachedTickets', title: 'Breached Tickets · By How Far Past SLA', kinds: ['table'], export: 'breached-tickets.csv' }],
        basedOn: ['SLA records · June'],
      },
    },
  ],
};

const CXO02_NETWORK: Script = {
  topic: 'Network against the other teams',
  match: /how does network compare/i,
  view: 'workspace', scope: SCOPE,
  beats: [
    burst(
      L('c2n1', 'Teams', 'Comparing the four teams', m('{{teams}}', 'teams'), [TEAMS]),
      L('c2n2', 'SLA', 'Attributing breaches', m('{{breaches}}', 'breaches'), [SLA_DATA]),
    ),
    {
      kind: 'answer',
      payload: {
        form: 'text', title: 'Network', headline: 'Network carries the most breaches of any team',
        blocks: [
          { w: 'chart', id: 'c2n-team', data: 'breaches', title: 'Breaches by Team', groupBy: [{ id: 'team', label: 'By team' }, { id: 'service', label: 'By service' }],
            soWhat: 'Just {{networkVolumeShare}}% of the volume.' },
        ],
        basedOn: ['SLA records · June', 'Team roster'],
      },
    },
  ],
};

/* ── CXO-03 · vendors ───────────────────────────────────────────────────── */
const CXO_03: Script = {
  topic: 'vendor impact',
  activity: 'Assessing vendor impact',
  match: /which vendors|vendors are hurting/i,
  view: 'workspace', scope: [m('{{waitingOnVendors}}', 'tickets waiting'), m('{{vendorsCount}}', 'vendors'), m('{{dataSources}}', 'data sources')],
  beats: [
    burst(
      L('c3a', 'Tickets', 'Finding tickets waiting on vendors', m('{{waitingOnVendors}}', 'waiting on vendors'), [TICKETS], { ticket: n('waitingOnVendors') }),
      L('c3b', 'SLA', 'Attributing breaches to vendors', m('{{vendorBreaches}}', 'vendor-attributed breaches'), [SLA_DATA], { 'breached ticket': n('vendorBreaches') }),
      L('c3c', 'Vendors', 'Assessing each vendor', m('{{vendorsCount}}', 'vendors assessed'), [VENDOR_BOARD], { vendor: n('vendorsCount') }),
    ),
    L('c3d', 'Vendors', 'Ranking by wait time'),
    { kind: 'discovery', id: 'c3d1', role: 'evidence',
      headline: 'TelcoNet is behind {{telconetBreaches}} of the {{vendorBreaches}} vendor breaches',
      detail: '{{telconetWaiting}} tickets waiting, {{telconetWait}} days on average.', support: ['Vendor status board'] },
    {
      kind: 'answer',
      payload: {
        form: 'text', title: 'Vendors',
        headline: 'TelcoNet — {{telconetWaiting}} tickets waiting, {{telconetWait}} days average',
        blocks: [
          { w: 'kpis', set: 'cxo03' },
          { w: 'chart', id: 'c3-vendors', data: 'vendors', title: 'Vendors',
            groupBy: [{ id: 'waiting', label: 'Tickets waiting' }, { id: 'wait', label: 'Avg wait' }, { id: 'breaches', label: 'Breaches' }],
            drill: { case: 'CXO-03/drill' } },
        ],
        basedOn: ['Vendor status board', 'SLA records · June'],
        menu: [...COMMON_MENU_HINT, 'Export for vendor review'],
        followUps: ["Draft a note to TelcoNet's account manager", 'Which tickets are waiting on TelcoNet?'],
      },
    },
  ],
};

const CXO03_DRILL: Script = {
  topic: 'one vendor\'s tickets',
  view: 'workspace', scope: SCOPE,
  beats: [
    L('c3x1', 'Tickets', 'Listing the tickets waiting on that vendor', undefined, [VENDOR_BOARD]),
    {
      kind: 'answer',
      payload: {
        form: 'text', title: 'Vendor tickets', headline: 'The tickets waiting on that vendor',
        blocks: [{ w: 'chart', id: 'c3x-table', data: 'vendorTickets', title: 'Waiting on Vendor', kinds: ['table'], export: 'vendor-tickets.csv' }],
        basedOn: ['Vendor status board'],
      },
    },
  ],
};

const CXO03_NOTE: Script = {
  topic: 'a note to TelcoNet',
  match: /draft a note to telconet/i,
  view: 'workspace', scope: SCOPE,
  beats: [
    L('c3m1', 'Vendors', 'Pulling the TelcoNet figures', m('{{telconetWaiting}}', 'tickets waiting'), [VENDOR_BOARD]),
    {
      kind: 'answer',
      payload: {
        form: 'text', title: 'Note', headline: 'Factual and firm — edit before it goes',
        blocks: [
          { w: 'note', id: 'telco', ref: 'TelcoNet', outbox: true, title: 'To: TelcoNet account manager',
            prefill: 'We currently have {{telconetWaiting}} open tickets waiting on TelcoNet, averaging {{telconetWait}} days each, and {{telconetBreaches}} of our SLA breaches this month trace to fibre repair delays. Can we agree a recovery plan and a named escalation contact this week?',
            primary: 'Save to outbox', secondary: 'Discard',
            banner: { text: 'Draft saved to outbox — nothing has been sent' } },
        ],
        basedOn: ['Vendor status board'],
      },
    },
  ],
};

const CXO03_TICKETS: Script = {
  topic: 'the tickets waiting on TelcoNet',
  match: /which tickets are waiting on telconet/i,
  view: 'workspace', scope: SCOPE,
  beats: [
    L('c3w1', 'Tickets', 'Listing the TelcoNet tickets', m('{{telconetWaiting}}', 'tickets'), [VENDOR_BOARD]),
    {
      kind: 'answer',
      payload: {
        form: 'text', title: 'TelcoNet', headline: '{{telconetWaiting}} tickets, {{telconetWait}} days on average',
        blocks: [{ w: 'chart', id: 'c3w-table', data: 'vendorTickets', title: 'Waiting on TelcoNet', kinds: ['table'], export: 'telconet-tickets.csv' }],
        basedOn: ['Vendor status board'],
      },
    },
  ],
};

/* ── CXO-04 · regulatory-reportable ─────────────────────────────────────── */
const CXO_04: Script = {
  topic: 'regulatory-reportable tickets',
  activity: 'Checking regulatory-reportable tickets',
  match: /regulatory reportable|regulatory-reportable/i,
  view: 'workspace', scope: [m('{{regOpen}}', 'flagged open'), m('{{regOpen}}', 'reporting windows'), m('1', 'data source')],
  beats: [
    burst(
      L('c4a', 'Tickets', 'Finding the flagged tickets', m('{{regOpen}}', 'flagged open'), [COMPLIANCE], { 'flagged ticket': n('regOpen') }),
      L('c4b', 'Deadlines', 'Checking each reporting window', m('{{regOpen}}', 'windows checked'), undefined, { 'reporting window': n('regOpen') }),
    ),
    { kind: 'discovery', id: 'c4d1', role: 'gap',
      headline: 'One is already past its reporting deadline',
      detail: '{{regOverdueRef}} — {{regOverdueTitle}} — is {{regOverdueDays}} day past its window.', support: ['Compliance register'] },
    {
      kind: 'answer',
      payload: {
        form: 'text', title: 'Reportable',
        headline: 'Four open — one is already overdue',
        blocks: [
          { w: 'kpis', set: 'cxo04' },
          { w: 'chart', id: 'c4-deadlines', data: 'regulatory', title: 'Reporting Deadlines',
            groupBy: [{ id: 'deadline', label: 'By deadline' }, { id: 'owner', label: 'By owner' }], kinds: ['list', 'table'],
            drill: { case: 'CXO-04/drill' } },
        ],
        basedOn: ['Compliance register'],
        menu: [...COMMON_MENU_HINT, 'Export list'],
        followUps: ['Notify the owners of the overdue and due-soon ones', 'What happened on INC-1077?'],
      },
    },
  ],
};

const CXO04_DRILL: Script = {
  topic: 'that ticket',
  view: 'workspace', scope: SCOPE,
  beats: [
    L('c4x1', 'Tickets', 'Reading the ticket', undefined, [COMPLIANCE]),
    {
      kind: 'answer',
      payload: {
        form: 'text', title: 'Ticket', headline: 'Where it stands',
        blocks: [{ w: 'status', ref: '$question' }],
        basedOn: ['Compliance register'],
      },
    },
  ],
};

const CXO04_NOTIFY: Script = {
  topic: 'notifying the owners',
  match: /notify the owners/i,
  view: 'workspace', scope: SCOPE,
  beats: [
    L('c4n1', 'Deadlines', 'Picking the overdue and due-soon tickets', m('3', 'owners to notify'), [COMPLIANCE]),
    {
      kind: 'answer',
      payload: {
        form: 'text', title: 'Notify', headline: 'Three owners, one message each — confirm to send',
        blocks: [
          { w: 'diff', id: 'notify', title: 'Who gets notified', mutation: 'notify-owners', ref: 'INC-1077',
            refs: ['INC-1077', 'INC-1103', 'INC-1121'],
            /* WHO GETS TOLD, per ticket. The before is who knows now — nobody — and the after
               is the set being proposed, which a leader may well want to widen. */
            rows: [
              { label: 'INC-1077', from: 'no one', to: 'Network owner', editor: 'multi',
                options: ['Network owner', 'Compliance lead', 'Exec sponsor'] },
              { label: 'INC-1103', from: 'no one', to: 'Data platform owner', editor: 'multi',
                options: ['Data platform owner', 'Compliance lead', 'Exec sponsor'] },
              { label: 'INC-1121', from: 'no one', to: 'Payments owner', editor: 'multi',
                options: ['Payments owner', 'Compliance lead', 'Exec sponsor'] },
            ],
            why: 'Each is overdue or due within seven days.',
            primary: 'Notify 3 owners', secondary: 'Not now',
            banner: { text: '{ref} owners notified' } },
        ],
        basedOn: ['Compliance register'],
      },
    },
  ],
};

const CXO04_INC1077: Script = {
  topic: 'INC-1077',
  match: /what happened on inc-1077/i,
  view: 'workspace', scope: SCOPE,
  beats: [
    burst(
      L('c4h1', 'Tickets', 'Reading INC-1077', undefined, [COMPLIANCE]),
      L('c4h2', 'Deadlines', 'Reading its reporting window'),
    ),
    {
      kind: 'answer',
      payload: {
        form: 'text', title: 'INC-1077', headline: 'Overdue by {{regOverdueDays}} day — the draft notification is still with Network',
        blocks: [
          { w: 'status', ref: 'INC-1077' },
          { w: 'chart', id: 'c4h-updates', data: 'regulatoryUpdates', title: 'Last Four Updates', kinds: ['table'] },
        ],
        basedOn: ['Compliance register'],
      },
    },
  ],
};

/* ── CXO-05 · security ──────────────────────────────────────────────────── */
const CXO_05: Script = {
  topic: 'security incidents this year',
  activity: 'Reviewing security incidents',
  match: /security incidents this year|lose money or data/i,
  view: 'workspace', scope: [m('{{secTotal}}', 'incidents'), m('{{secHigh}}', 'high severity'), m('1', 'data source')],
  beats: [
    burst(
      L('c5a', 'Incidents', 'Reviewing the year', m('{{secTotal}}', 'reviewed'), [SEC_REG], { incident: n('secTotal') }),
      L('c5b', 'Impact', 'Checking data and financial impact'),
      L('c5c', 'Status', 'Checking what is still open', m('{{secInvestigating}}', 'under investigation'), undefined, { 'open investigation': n('secInvestigating') }),
    ),
    { kind: 'discovery', id: 'c5d1', role: 'evidence',
      headline: 'No confirmed data loss in any incident',
      detail: '{{secDataLoss}} of {{secTotal}}.', support: ['Security incident register'] },
    L('c5d', 'Impact', 'Reconciling the financial impact'),
    { kind: 'discovery', id: 'c5d2', role: 'evidence',
      headline: 'One incident had financial impact — fully recovered',
      detail: '{{secAmount}}, recovered in full.', support: ['Security incident register'] },
    {
      kind: 'answer',
      payload: {
        form: 'text', title: 'Security',
        headline: 'No data lost. One incident cost {{secAmount}} and was fully recovered.',
        /* THE CALLOUT THAT WAS ABOUT THE ANSWER. "Two are still under investigation, I'll flag
           if that changes" is a commitment about the whole reply, not a reading of the
           Jan–Sep timeline beside it — so it supports the headline rather than a chart. */
        text: "Two are still under investigation — I'll flag if their status changes.",
        blocks: [
          { w: 'kpis', set: 'cxo05' },
          { w: 'chart', id: 'c5-timeline', data: 'securityTimeline', title: 'Incidents · Jan–Sep',
            groupBy: [{ id: 'severity', label: 'By severity' }, { id: 'type', label: 'By type' }] },
          { w: 'incidents' },
        ],
        basedOn: ['Security incident register'],
        menu: [...COMMON_MENU_HINT, 'Export incident register'],
        followUps: ['Tell me more about the phishing one', 'What are the two still under investigation?'],
      },
    },
  ],
};

const CXO05_PHISH: Script = {
  topic: 'the phishing incident',
  match: /tell me more about the phishing/i,
  view: 'workspace', scope: SCOPE,
  beats: [
    burst(
      L('c5p1', 'Incidents', 'Reading SEC-0207', undefined, [SEC_REG]),
      L('c5p2', 'Impact', 'Checking the recovery record'),
    ),
    {
      kind: 'answer',
      payload: {
        form: 'text', title: 'SEC-0207', headline: 'Contained in four hours, nothing left the estate',
        blocks: [{ w: 'incident-detail', id: 'SEC-0207' }],
        basedOn: ['Security incident register'],
      },
    },
  ],
};

const CXO05_OPEN: Script = {
  topic: 'the open investigations',
  match: /two still under investigation|still under investigation/i,
  view: 'workspace', scope: SCOPE,
  beats: [
    L('c5o1', 'Status', 'Listing the open investigations', m('{{secInvestigating}}', 'open'), [SEC_REG]),
    {
      kind: 'answer',
      payload: {
        form: 'text', title: 'Open', headline: 'Two, both with an owner and an expected close',
        blocks: [{ w: 'chart', id: 'c5o-table', data: 'investigating', title: 'Under Investigation', kinds: ['table'], export: 'under-investigation.csv' }],
        basedOn: ['Security incident register'],
      },
    },
  ],
};

/* ── CXO-06 · recurring problems ────────────────────────────────────────── */
const CXO_06: Script = {
  topic: 'recurring problems',
  activity: 'Finding what keeps coming back',
  match: /keep coming back|fix permanently/i,
  view: 'workspace', scope: [m('{{repeatTickets}}', 'repeat tickets'), m('{{clusters}}', 'clusters'), m('1', 'data source')],
  beats: [
    burst(
      L('c6a', 'Tickets', 'Scanning ninety days', m('90', 'days scanned'), [PROBLEM_LOG], { 'repeat ticket': n('repeatTickets') }),
      L('c6b', 'Patterns', 'Clustering repeat tickets', m('{{clusters}}', 'clusters found'), undefined, { cluster: n('clusters') }),
      L('c6c', 'Effort', 'Estimating technician hours', m('{{hoursLost}}', 'hours estimated'), undefined, { hour: n('hoursLost') }),
    ),
    { kind: 'discovery', id: 'c6d1', role: 'evidence',
      headline: 'Three clusters account for {{repeatTickets}} repeat tickets',
      detail: 'Across {{teamsAffected}} teams.', support: ['Problem candidates · 90 days'] },
    L('c6d', 'Effort', 'Costing each cluster'),
    { kind: 'discovery', id: 'c6d2', role: 'evidence',
      headline: 'VPN-after-password-change alone cost {{vpnProblemHours}} hours',
      detail: '{{vpnProblemTickets}} tickets in ninety days.', support: ['Problem candidates · 90 days'] },
    {
      kind: 'answer',
      payload: {
        form: 'text', title: 'Recurring',
        headline: 'Three problems, {{repeatTickets}} repeat tickets, roughly {{hoursLost}} technician hours',
        blocks: [
          { w: 'kpis', set: 'cxo06' },
          { w: 'chart', id: 'c6-matrix', data: 'problems', title: 'Effort to Fix vs Recurrence',
            groupBy: [{ id: 'hours', label: 'Size by hours' }, { id: 'tickets', label: 'Size by tickets' }, { id: 'teams', label: 'Size by teams' }] },
          { w: 'problems' },
        ],
        basedOn: ['Problem candidates · 90 days'],
        menu: [...COMMON_MENU_HINT, 'Export for change board'],
        followUps: ['Raise a problem record for the VPN one', 'How much would fixing all three save?'],
      },
    },
  ],
};

const prb = (id: string, match: RegExp, title: string, tickets: string, owner: string): Script => ({
  topic: 'a problem record',
  match,
  view: 'workspace', scope: SCOPE,
  beats: [
    L(`${id}1`, 'Patterns', 'Collecting the linked tickets', m(tickets, 'tickets to link'), [PROBLEM_LOG]),
    {
      kind: 'answer',
      payload: {
        form: 'text', title: 'Problem record', headline: 'Ready to raise — confirm and it is created',
        blocks: [
          { w: 'diff', id: `${id}-prb`, title: 'New problem record', mutation: 'raise-prb', ref: title,
            rows: [
              { label: 'Problem', from: '—', to: title },
              /* COUNTED, not chosen — the linked tickets are the ones that matched. */
              { label: 'Linked tickets', from: '0', to: tickets, fact: true },
              { label: 'Owner', from: '—', to: owner, editor: 'select',
                options: [owner, 'Network', 'Payments', 'End User Computing', 'Service Desk']
                  .filter((o, i, a) => a.indexOf(o) === i) },
            ],
            why: 'A permanent fix is cheaper than patching it again.',
            primary: 'Raise problem record', secondary: 'Not now',
            banner: { text: `{ref} raised — ${tickets} tickets linked` } },
        ],
        basedOn: ['Problem candidates · 90 days'],
      },
    },
  ],
});
const CXO06_PRB_VPN = prb('c6v', /problem record for the vpn one/i, 'VPN auth failure after password change', '{{vpnProblemTickets}}', 'Network');
const CXO06_PRB_PRINTER = prb('c6p', /problem record for the printer one/i, 'Passbook printer fading (model PX-400)', '{{printerProblemTickets}}', 'End User Computing');
const CXO06_PRB_MAILBOX = prb('c6m', /problem record for the mailbox one/i, 'Shared mailbox access requests', '{{mailboxProblemTickets}}', 'Messaging');

const CXO06_SAVE: Script = {
  topic: 'what fixing all three saves',
  match: /how much would fixing all three save/i,
  view: 'workspace', scope: SCOPE,
  beats: [
    burst(
      L('c6s1', 'Effort', 'Summing the hours', m('{{hoursLost}}', 'hours a quarter'), [PROBLEM_LOG]),
      L('c6s2', 'Patterns', 'Converting to capacity'),
    ),
    {
      kind: 'answer',
      payload: {
        form: 'text', title: 'Savings', headline: 'About {{hoursLost}} hours a quarter — roughly {{fte}} FTE',
        /* THE ASSUMPTION BELONGS TO THE FTE NUMBER, which is in the headline — not to the hours
           chart below it. An unstated divisor is what makes a capacity claim unarguable. */
        text: 'Assumes {{fteHoursAssumed}} productive hours per person per quarter.',
        blocks: [
          { w: 'chart', id: 'c6s-hours', data: 'problemHours', title: 'Hours Lost a Quarter, by Cluster' },
        ],
        basedOn: ['Problem candidates · 90 days'],
      },
    },
  ],
};

/* ── CXO-07 · trending HR cases ─────────────────────────────────────────── */
const CXO_07: Script = {
  topic: 'trending HR cases',
  activity: 'Trending HR cases',
  match: /trending hr cases|hr cases/i,
  view: 'workspace', scope: [m('{{hrLast4}}', 'cases · 4 weeks'), m('4', 'types'), m('1', 'data source')],
  beats: [
    burst(
      L('c7a', 'Cases', 'Counting the last four weeks', m('{{hrLast4}}', 'cases'), [HR_DATA], { case: n('hrLast4') }),
      L('c7b', 'Types', 'Tracking the four types', m('4', 'types tracked'), undefined, { type: 4 }),
      L('c7c', 'Trends', 'Comparing eight weeks'),
    ),
    { kind: 'discovery', id: 'c7d1', role: 'evidence',
      headline: 'Payroll queries doubled in the week of {{hrSpikeWeek}}',
      detail: '{{hrPayroll}} in the last four weeks against {{hrPayrollPrev}} before.', support: ['HR case data · 8 weeks'] },
    {
      kind: 'answer',
      payload: {
        form: 'text', title: 'HR',
        headline: 'HR cases up {{hrDeltaPct}}% — payroll queries are the spike',
        /* THE ONLY INTERPRETATION ON THE TURN, so it does not get dropped for want of room.
           The trend chart's insight line is already full at two lines, and this clause is not a
           reading of that chart anyway — it is what the whole answer concludes. `response.mjs`
           §8 tests exactly this: an insight that interprets rather than restates, stated before
           the breakdown. A lead line is both. */
        text: 'It lines up with the September payroll cycle — likely a process issue, not a system one.',
        blocks: [
          { w: 'kpis', set: 'cxo07' },
          { w: 'chart', id: 'c7-trend', data: 'hrTrend', title: 'Cases by Week',
            groupBy: [{ id: 'type', label: 'By type' }, { id: 'location', label: 'By location' }, { id: 'team', label: 'By team' }],
            drill: { case: 'CXO-07/drill' } },
          { w: 'chart', id: 'c7-types', data: 'hrByType', title: 'Last Four Weeks by Type', drill: { case: 'CXO-07/drill' } },
        ],
        basedOn: ['HR case data · 8 weeks'],
        menu: [...COMMON_MENU_HINT, 'Export CSV'],
        followUps: ['What are people asking about payroll?', 'Which location has the most?'],
      },
    },
  ],
};

const CXO07_DRILL: Script = {
  topic: 'one HR case type',
  view: 'workspace', scope: SCOPE,
  beats: [
    L('c7x1', 'Cases', 'Listing the cases of that type', undefined, [HR_DATA]),
    {
      kind: 'answer',
      payload: {
        form: 'text', title: 'Cases', headline: 'The cases behind that line',
        blocks: [{ w: 'chart', id: 'c7x-table', data: 'hrCases', title: 'Cases', kinds: ['table'], export: 'hr-cases.csv' }],
        basedOn: ['HR case data · 8 weeks'],
      },
    },
  ],
};

const CXO07_PAYROLL: Script = {
  topic: 'payroll questions',
  match: /asking about payroll/i,
  view: 'workspace', scope: SCOPE,
  beats: [
    burst(
      L('c7p1', 'Cases', 'Reading the payroll queries', m('{{hrPayroll}}', 'queries'), [HR_DATA]),
      L('c7p2', 'Types', 'Grouping by reason'),
    ),
    {
      kind: 'answer',
      payload: {
        form: 'text', title: 'Payroll', headline: 'Four reasons, and one of them is most of it',
        blocks: [
          { w: 'chart', id: 'c7p-reasons', data: 'hrPayrollReasons', title: 'Payroll Queries by Reason',
            soWhat: '{{hrTopReasonN}} of {{hrPayroll}}.' },
        ],
        basedOn: ['HR case data · 8 weeks'],
      },
    },
  ],
};

const CXO07_LOCATION: Script = {
  topic: 'HR cases by location',
  match: /which location has the most/i,
  view: 'workspace', scope: SCOPE,
  beats: [
    L('c7l1', 'Cases', 'Grouping by location', m('{{hrLast4}}', 'cases'), [HR_DATA]),
    {
      kind: 'answer',
      payload: {
        form: 'text', title: 'Locations', headline: '{{hrTopLocation}} — {{hrTopLocationN}} of the {{hrLast4}} cases',
        blocks: [
          { w: 'chart', id: 'c7l-loc', data: 'hrByLocation', title: 'Last Four Weeks by Location',
            soWhat: 'In line with headcount.' },
        ],
        basedOn: ['HR case data · 8 weeks'],
      },
    },
  ],
};

export const LEADERSHIP_SCRIPTS: Record<string, Script> = {
  'CXO-01': CXO_01,
  'CXO-02': CXO_02,
  'CXO-03': CXO_03,
  'CXO-04': CXO_04,
  'CXO-05': CXO_05,
  'CXO-06': CXO_06,
  'CXO-07': CXO_07,
  'CXO-01/drill': CXO01_DRILL,
  'CXO-01/cause': CXO01_CAUSE,
  'CXO-01/team': CXO01_TEAM,
  'CXO-01/underlying': CXO01_UNDERLYING,
  'CXO-02/drill': CXO02_DRILL,
  'CXO-02/tickets': CXO02_TICKETS,
  'CXO-02/network': CXO02_NETWORK,
  'CXO-03/drill': CXO03_DRILL,
  'CXO-03/note': CXO03_NOTE,
  'CXO-03/tickets': CXO03_TICKETS,
  'CXO-04/drill': CXO04_DRILL,
  'CXO-04/notify': CXO04_NOTIFY,
  'CXO-04/inc1077': CXO04_INC1077,
  'CXO-05/phish': CXO05_PHISH,
  'CXO-05/open': CXO05_OPEN,
  'CXO-06/prb-vpn': CXO06_PRB_VPN,
  'CXO-06/prb-printer': CXO06_PRB_PRINTER,
  'CXO-06/prb-mailbox': CXO06_PRB_MAILBOX,
  'CXO-06/save': CXO06_SAVE,
  'CXO-07/drill': CXO07_DRILL,
  'CXO-07/payroll': CXO07_PAYROLL,
  'CXO-07/location': CXO07_LOCATION,
};
