/* THE MOCK TICKET STORE — one in-memory record set every requester, technician and leadership
 * case reads and writes.
 *
 * An action taken in one conversation is visible in every other: create a ticket in REQ-01 and
 * REQ-06's list gains a row; escalate in REQ-03 and the record really carries High + the
 * escalation queue; put INC-1062 on hold in TEC-04 and TEC-07's handover says so. MUTATIONS ARE
 * THE ONLY WAY STATE CHANGES — components subscribe and read, and every mutation returns the
 * updated record so its caller can speak about what actually happened rather than what it hoped
 * for. Every mutation also appends a timestamped line to the ticket's `updates`, which is what
 * the technician handover is built from.
 *
 * Deliberately not React state: the store outlives any turn, drawer or view of it, exactly the
 * way the real system of record would. `useTicketStore` bridges it into React via
 * useSyncExternalStore.
 *
 * ── THE TECHNICIAN ──────────────────────────────────────────────────────────────────────────
 * The technician is the current user: `currentUser` in code, "you" on screen. Their queue is
 * the ten tickets assigned to them; the vendor-pending set is the TEAM's (a subset of the
 * org-wide 22 on the leadership vendor board); the four regulatory-reportable tickets are the
 * leadership dataset's own. The demo runs on a FIXED narrative clock (`DEMO_NOW`): SLA remaining
 * values are snapshots at that moment, the INC-1088 timeline's NOW marker sits on it, and every
 * update a mutation writes is stamped with it — one clock, so nothing on screen disagrees.
 */
import { useSyncExternalStore } from 'react';
import type { ChartData } from './mockAnalytics';

export const currentUser = 'you';
/** The demo clock — HH:MM, today. Between INC-1088's re-run (11:35) and its ETA (12:30). */
export const DEMO_NOW = '12:05';
/** THE DEMO'S DAY. Ages are computed, not stored, so that a record's age is derived from one
 *  fact rather than written down twice — but computing them against the real clock would make
 *  "12 days" read "3 months" a quarter from now. One fixed day, and the arithmetic stays real. */
export const DEMO_TODAY = '2026-09-14';
export const nowLabel = (): string => `today ${DEMO_NOW}`;
/** Minutes since midnight for an HH:MM string. */
export const minutesOf = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map((x) => parseInt(x, 10));
  return h * 60 + m;
};
/** "2h 40m" / "1d 4h" / "0h 40m" — the technician's own notation. */
export const durationLabel = (min: number): string => {
  if (min >= 1440) { const d = Math.floor(min / 1440); const h = Math.floor((min % 1440) / 60); return `${d}d ${h}h`; }
  return `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, '0')}m`;
};
/** Response-time windows by priority, in minutes. Remaining / window is the countdown fill. */
export const SLA_WINDOW_MIN: Record<string, number> = { P1: 240, P2: 480, P3: 2880, P4: 4320 };
/** The vendor board the leadership dataset ranks — the technician's "waiting on a vendor" set is
 *  the team's tickets held by one of THESE. A hardware warranty (DellCare) is not a board vendor. */
export const VENDOR_BOARD = ['TelcoNet', 'PrintCo', 'CloudMail', 'SecureID'] as const;
/** A chase older than this is overdue. */
export const CHASE_OVERDUE_DAYS = 3;

export type TicketStatus =
  | 'Open' | 'In progress' | 'Pending approval' | 'On hold'
  | 'Waiting on requester' | 'Waiting on vendor' | 'Waiting on approval'
  /** A resolution has been applied and the requester has been asked to confirm it. */
  | 'Pending user confirmation'
  | 'Resolved' | 'Closed';

export interface TicketUpdate { at: string; text: string; by?: string }

/** Whole days between two ISO days. */
const daysBetween = (from: string, to: string): number =>
  Math.floor((Date.parse(to + 'T00:00:00Z') - Date.parse(from + 'T00:00:00Z')) / 86400000);

/** "today" · "3 days" · "6 months". Computed from the record, never written on it. */
export const ageLabel = (createdOn?: string, today = DEMO_TODAY): string => {
  if (!createdOn) return '';
  const d = daysBetween(createdOn, today);
  if (d < 1) return 'today';
  if (d < 60) return `${d} day${d === 1 ? '' : 's'}`;
  const m = Math.round(d / 30.44);
  return `${m} month${m === 1 ? '' : 's'}`;
};

/** "2 Sep" — the day it was raised, as a person writes it. MONTHS is declared further down and
 *  this only runs at render time, so there is one such array in the module rather than two. */
export const raisedLabel = (createdOn?: string): string => {
  if (!createdOn) return '';
  const [, mm, dd] = createdOn.split('-');
  return `${parseInt(dd, 10)} ${MONTHS[parseInt(mm, 10) - 1]}`;
};

/** The order the store lists statuses in — what breaks a tie between two equal counts. A status
 *  the union does not know (a deployment's own) sorts after the ones it does. */
const STATUS_ORDER = [
  'Logged', 'Open', 'Assigned', 'In progress', 'Pending approval', 'Waiting on approval',
  'On hold', 'Waiting on requester', 'Waiting on vendor', 'Pending user confirmation',
  'Resolved', 'Closed',
];

export interface StatusGroup { status: string; count: number; tickets: MockTicket[] }

/** THE ONE GROUPING CALL. The headline number, the sub-line, the bar and the legend are all
 *  rendered from this array, in this order — so a count on screen cannot disagree with another
 *  count on the same screen. Descending by count; ties broken by the store's own status order.
 *  Grouped on the REQUESTER-FACING status (`statusLabel`), so a custom status is a group like
 *  any other. */
export const groupByStatus = (tickets: MockTicket[]): StatusGroup[] => {
  const by = new Map<string, MockTicket[]>();
  for (const t of tickets) {
    const k = statusLabel(t);
    by.set(k, [...(by.get(k) ?? []), t]);
  }
  const rank = (st: string) => { const i = STATUS_ORDER.indexOf(st); return i < 0 ? STATUS_ORDER.length : i; };
  return [...by.entries()]
    .map(([status, ts]) => ({ status, count: ts.length, tickets: ts }))
    .sort((a, b) => (b.count - a.count) || (rank(a.status) - rank(b.status)) || a.status.localeCompare(b.status));
};

/** The status as the requester is shown it — the trail's last entry, or the engine status when
 *  a record carries no trail. ONE function, so the list row and the status answer cannot drift. */
export const statusLabel = (t: { status: string; statusTrail?: string[] }): string =>
  (t.statusTrail && t.statusTrail.length ? t.statusTrail[t.statusTrail.length - 1] : t.status);

export interface MockTicket {
  ref: string;
  title: string;
  /** The engine status. Every rule that filters, counts or branches reads THIS. */
  status: TicketStatus;
  /** THE STATUS HISTORY, in order, as the requester is shown it — and the last entry is the
   *  current status in their words. Free strings, not TicketStatus: a real deployment carries
   *  custom statuses ("Vendor engaged", "Awaiting parts") that no fixed list can hold, and the
   *  requester's status answer renders whatever is here with no special handling. Absent on the
   *  technician and leadership records, which render the status pill instead. */
  statusTrail?: string[];
  /** Where the ticket was ROUTED - a queue, not a person. Distinct from `assignee`, which names
   *  whoever has actually picked it up and is empty until somebody does. */
  category?: string;
  assignee: string;
  created: string;
  lastUpdate: string;
  nextUpdate?: string;
  priority?: string;
  attempts?: string[];
  latestNote?: string;
  affectedAssets?: string[];
  affectedUsers?: number;
  resolvedAgo?: string;
  resolution?: string;
  resolvedBy?: string;
  /** The reader owes this ticket something — REQ-06's "Needs you" highlight. */
  needsYou?: boolean;
  /** WHY it needs them, in the reader's words. REQ-06's insight line quotes this rather than
   *  authoring a reason per ticket, so the flag and its explanation cannot come apart. */
  needsYouReason?: string;
  /** The day it was raised, ISO. `created` is the prose the cards used to print; this is the
   *  fact ages are computed from. */
  createdOn?: string;
  /** A regulatory-reportable ticket owned by a team, not by the requester — listed by CXO-04,
   *  never by "what's open for me". */
  regulatory?: boolean;
  notes: Array<{ text: string; when: string; external?: boolean }>;
  /** Every change, in order, stamped. Mutations append here; the handover reads from here. */
  updates: TicketUpdate[];
  /* ── technician fields ─────────────────────────────────────────────── */
  /* ── who it affects — the triage card's impact line is COMPOSED from these three ── */
  /** Where it bites: "3 branches", "Whitefield branch", "3 corporate clients". */
  affectedScope?: string;
  /** How many, and of what. `unit` is a plural noun; `approx` renders a leading "~". */
  affectedCount?: { n: number; unit: string; approx?: boolean };
  /** Whose service it is — "Retail Banking", "Payments". */
  department?: string;
  /** WHY THIS ONE IS NOT FIRST, when its priority says it should be. Rendered into the
   *  ordering line; the clock in that sentence is still computed from slaRemainingMin. */
  rankingNote?: string;
  /** The moment the regulatory reporting window shut, as the TICKET records it. */
  regulatoryClosedAt?: string;
  /** That moment came from the ticket, not from the regulator's own feed — which is exactly
   *  what the caveat footnote says, and the reason it is a footnote and not a claim. */
  regulatoryUnverified?: boolean;
  /** A technician-side record: never listed under a requester's "open for me". */
  tech?: boolean;
  /** The team that OWNS the incident when the technician is only assisting (INC-1088). */
  owner?: string;
  site?: string;
  /** Minutes left on the response clock at DEMO_NOW; undefined = no clock on this ticket. */
  slaRemainingMin?: number;
  slaPaused?: boolean;
  regulatoryOverdueDays?: number;
  /** Something is waiting on YOU — a requester reply unanswered, an unlooked-at auto-assignment. */
  awaitingYou?: boolean;
  escalatedAt?: string;
  newSinceHandover?: boolean;
  closedToday?: boolean;
  closedAt?: string;
  vendor?: string;
  vendorRef?: string;
  waitingDays?: number;
  /** The day the vendor was first asked, ISO. `waitingDays` is the number this replaces; a date
   *  stays true when the demo clock moves and a written count does not. */
  waitingSince?: string;
  /** The day the vendor was last chased, ISO; undefined = never chased. */
  lastChased?: string;
  /** Whether this vendor publishes a feed we can read. When it does not, every chase date on its
   *  tickets came from a note somebody typed - which is what the TEC-06 footnote is about. */
  vendorHasPortalFeed?: boolean;
  /** Days since the vendor was last chased; undefined = never. */
  chaseAgeDays?: number;
  eta?: string;
  pendingReason?: string;
  reminderAt?: string;
  linked?: string[];
  subscribed?: boolean;
  /** The technician has STARTED this — picked it up as the thing they are actively working. */
  active?: boolean;
  /** The vendor ref on file could not be matched in the vendor's own feed when it was recorded. */
  vendorRefUnverified?: boolean;
  /** The requester was told about the last change (a reply, a resolution). */
  requesterNotified?: boolean;
  resolvedOn?: string;
  scope?: string;
  network?: string;
  /** The major-incident record behind TEC-02's brief and timeline. */
  detail?: {
    detected: string; declared: string; cause: string; fixAt: string; fixBy: string;
    rerunAt: string; eta: string; cutoff: string; clients: number; employees: number;
  };
  /** Events the reader added to the incident timeline. */
  events?: Array<{ t: string; label: string }>;
  bridge?: { since: string; owner: string; people: Array<{ name: string; role: string; onCall?: boolean }> };
}

/** A problem record raised from CXO-06's recurring-problem cards. */
export interface MockProblem {
  ref: string; title: string; linkedTickets: number; owner: string; created: string;
}

/** A dashboard tile: a static snapshot of a ChartFrame — which dataset, which group-by, which
 *  chart type — plus the title and freshness it was added with. */
export interface DashboardTile {
  id: string; title: string; headline: string; freshness: string;
  chart: { data: string; groupBy?: string; kind: string };
}
export interface MockDashboard { id: string; name: string; tiles: DashboardTile[] }

/** A draft the conversation is still shaping — REQ-01's card, TEC-03's link, TEC-05's reply,
 *  TEC-07's night-lead note. Lives here so a LATER turn can visibly change an EARLIER card. */
export interface MockDraft {
  linkedAsset?: string;
  subject?: string;
  priority?: string;
  createdRef?: string;
  discarded?: boolean;
  /** TEC-03: the user's ticket this pattern was linked to. */
  linkedTicket?: string;
  /** TEC-05: which authored tone is showing, what the reader typed over it, which jargon
   *  replacements were reverted, and the sentence chip 2 appended. */
  tone?: 'formal' | 'friendly' | 'shorter';
  edited?: string;
  reverted?: string[];
  appended?: string;
  /** TEC-07: the note for the night lead, appended to the handover in place. */
  note?: string;
}

export interface KbArticle {
  id: string; title: string; verified: string; linked: string[]; summary: string;
  steps: string[]; config: string[];
}

export interface OvernightChange { at: string; refs: string[]; text: string; kind: 'escalated' | 'new' | 'bridge' | 'reply' }
export interface ShiftLogEntry { id: string; at: string; by: string; title: string; text: string; refs: string[]; notified?: string }
export interface ChannelPost { id: string; channel: string; text: string; at: string }

interface StoreShape {
  tickets: MockTicket[];
  drafts: Record<string, MockDraft>;
  problems: MockProblem[];
  dashboards: MockDashboard[];
  shiftLog: ShiftLogEntry[];
  posts: ChannelPost[];
}

export const KB_ARTICLES: KbArticle[] = [
  {
    id: 'KB-0342',
    title: 'VPN drops at a fixed interval — DHCP lease on the WLC',
    verified: '14 Jul 2026',
    linked: ['INC-0611', 'INC-0702', 'INC-0839', 'INC-0917'],
    summary: 'Clients on the Bengaluru wireless controllers lose the tunnel exactly at the DHCP lease boundary. The lease on BLR-2 was set to 30 minutes and copied to BLR-1 in July; the VPN client treats the renewal as an address change and re-keys.',
    steps: [
      'Confirm the user is on BLR-1 or BLR-2 wireless (SSID CORP-BLR).',
      'Move them to wired or the guest SSID and confirm the drops stop.',
      'On the WLC, extend the DHCP lease on the corporate WLAN from 30 min to 8 h.',
      'Have the user reconnect once; no client change is needed.',
    ],
    config: [
      'BLR-2 WLC > WLANs > CORP-BLR > Advanced',
      'DHCP Addr. Assignment: Required',
      'DHCP lease: 1800s  →  28800s',
      'Session timeout: 86400s (unchanged)',
    ],
  },
];

/** The overnight changes since 20:00 yesterday — four items, as the shift roster records them. */
export const OVERNIGHT: OvernightChange[] = [
  { at: 'yesterday 23:40', refs: ['INC-1077'], text: 'Escalated to P2', kind: 'escalated' },
  { at: 'today 05:52', refs: ['INC-1112'], text: 'Logged, unassigned until 06:10, then auto-assigned to you', kind: 'new' },
  { at: 'today 09:10', refs: ['INC-1088'], text: 'Bridge call opened — Payments, Core banking, RM liaison', kind: 'bridge' },
  { at: 'today 06:31', refs: ['INC-1095', 'INC-1108'], text: '2 requester replies received', kind: 'reply' },
];

const T = (ref: string, title: string, x: Partial<MockTicket> & { status: TicketStatus; assignee: string }): MockTicket => ({
  ref, title, created: 'today', lastUpdate: 'today', notes: [], updates: [], ...x,
});
const u = (at: string, text: string, by?: string): TicketUpdate => ({ at, text, by });
/** Extend the requester-facing history. A no-op on a record that keeps none, and a no-op when
 *  the status did not actually move — the trail is a history, not a log of every save. */
const pushTrail = (t: MockTicket, status: string): void => {
  if (!t.statusTrail) return;
  if (t.statusTrail[t.statusTrail.length - 1] === status) return;
  t.statusTrail = [...t.statusTrail, status];
};

const seed = (): StoreShape => ({
  tickets: [
    /* ── the requester's own tickets (REQ-01..07) ─────────────────────── */
    {
      ref: 'INC-0988', title: 'VPN keeps disconnecting', status: 'In progress',
      statusTrail: ['Open', 'In progress'],
      assignee: 'Priya S. (Service Desk)', created: '3 days ago', createdOn: '2026-09-11', lastUpdate: '2 hours ago',
      nextUpdate: 'today 5 PM',
      attempts: ['Reset VPN client', 'Reinstalled certificate'],
      latestNote: 'Reinstalled the cert, monitoring for 24h.',
      notes: [], updates: [],
    },
    {
      ref: 'INC-0035', title: 'Lost access to shared loans mailbox', status: 'Open',
      statusTrail: ['Open'],
      assignee: 'End User Computing', created: '28 Feb 2026', createdOn: '2026-02-28', lastUpdate: '28 Feb 2026',
      priority: 'Medium', notes: [], updates: [],
    },
    {
      ref: 'INC-0871', title: 'Passbook printer fading — counter 1', status: 'In progress',
      statusTrail: ['Open', 'In progress'],
      assignee: 'Priya S.', created: '5 days ago', createdOn: '2026-09-09', lastUpdate: '5 days ago',
      affectedAssets: ['PRN-0311 (Counter 1)'], affectedUsers: 1, notes: [], updates: [],
    },
    {
      ref: 'INC-0790', title: 'Emails to counterparty bouncing', status: 'In progress',
      statusTrail: ['Open', 'In progress'],
      assignee: 'Messaging team', created: '12 days ago', createdOn: '2026-09-02', lastUpdate: '2 days ago',
      latestNote: 'Relay rule corrected, please confirm.', needsYou: true,
      needsYouReason: 'the messaging team fixed the email bounces and are waiting for you to confirm',
      notes: [], updates: [],
    },
    {
      ref: 'INC-0644', title: 'Fuel-station card declined', status: 'Resolved',
      statusTrail: ['Open', 'In progress', 'Resolved'],
      assignee: 'Finance/IT', created: 'a month ago', createdOn: '2026-08-14', lastUpdate: '19 days ago',
      resolvedAgo: '19 days ago', resolvedBy: 'Finance/IT',
      resolution: 'Card limit reset after finance approval.', notes: [], updates: [],
    },
    {
      ref: 'REQ-0512', title: 'Request: second monitor', status: 'On hold',
      statusTrail: ['Logged', 'Assigned', 'In progress', 'Vendor engaged', 'Awaiting parts'],
      assignee: 'Ravi N. (Workplace Services)', created: '8 days ago', createdOn: '2026-09-06', lastUpdate: 'yesterday',
      vendor: 'PrintCo', eta: '3 days',
      notes: [{ text: 'Approved and ordered — the supplier has it on back order.', when: 'yesterday', external: true }],
      updates: [],
    },

    /* ── THE TECHNICIAN QUEUE — ten assigned to you, SLA remaining at DEMO_NOW ──────────── */
    T('INC-1088', 'Bulk salary upload failures — 3 corporate clients', {
      affectedScope: '3 corporate clients', affectedCount: { n: 1240, unit: 'salaries' }, department: 'Payments',
      rankingNote: 'has a live bridge call',
      status: 'In progress', assignee: currentUser, priority: 'P1', tech: true, owner: 'Payments',
      created: 'today 09:10', lastUpdate: 'today 12:00', slaRemainingMin: 160, newSinceHandover: true,
      detail: {
        detected: '09:10', declared: '09:25',
        /* Phrased as a CLAUSE, because every sentence that uses it reads it as one. */
        cause: 'the new file header format failed validation',
        fixAt: '11:20', fixBy: 'Payments', rerunAt: '11:35', eta: '12:30', cutoff: '15:00',
        clients: 3, employees: 1240,
      },
      bridge: {
        since: '09:10', owner: 'Meera K.',
        people: [
          { name: 'Meera K.', role: 'Payments lead · bridge owner', onCall: true },
          { name: 'Rohit V.', role: 'Core banking' },
          { name: currentUser, role: 'Service desk · assisting' },
          { name: 'Sanjay P.', role: 'RM liaison', onCall: true },
        ],
      },
      updates: [
        u('today 09:10', 'Detected — bulk salary uploads failing for 3 corporate clients (monitoring alert)'),
        u('today 09:12', 'Bridge call opened — Payments, Core banking, Service desk'),
        u('today 09:18', 'Meridian Textiles confirmed rejected files on their side'),
        u('today 09:25', "Declared P1 — 1,240 employees' salaries pending"),
        u('today 09:40', 'Sanjay P. (RM liaison) joined the bridge'),
        u('today 10:05', 'Cause narrowed to file validation — new salary-file format (header change)'),
        u('today 10:20', 'Core banking confirmed no downstream impact'),
        u('today 10:40', 'Fix approach agreed — accept both header formats'),
        u('today 10:55', 'Client cut-off confirmed as 15:00'),
        u('today 11:05', 'Fix built by Payments; testing against the failed files'),
        u('today 11:20', 'Fix applied by Payments', 'Meera K.'),
        u('today 11:35', 'Re-run started — 3 files queued'),
        u('today 11:50', 'First file processed cleanly (412 employees)'),
        u('today 12:00', 'ETA for all credits: 12:30'),
      ],
    }),
    T('INC-1077', 'ATM network outage — 3 branches', {
      affectedScope: '3 branches', affectedCount: { n: 1800, unit: 'customers', approx: true }, department: 'Retail Banking',
      category: 'ATM', regulatoryClosedAt: 'yesterday 23:55', regulatoryUnverified: true,
      status: 'Open', assignee: currentUser, priority: 'P2', tech: true, owner: 'Network',
      created: '4 days ago', lastUpdate: 'yesterday', slaRemainingMin: 40,
      regulatory: true, regulatoryOverdueDays: 1, escalatedAt: 'yesterday 23:40',
      latestNote: 'Reporting window passed — draft notification still with Network.',
      updates: [
        u('4 days ago 10:12', 'Logged — ATM network unreachable at 3 branches'),
        u('2 days ago 16:30', 'Regulatory reporting window opened — 14 days'),
        u('yesterday 23:40', 'Escalated to P2 — outage into its fourth day'),
        u('yesterday 23:55', 'Reporting window passed — draft notification still with Network'),
      ],
    }),
    T('INC-1112', 'Branch Wi-Fi down — Whitefield', {
      affectedScope: 'Whitefield branch', affectedCount: { n: 42, unit: 'staff' }, department: 'Retail Banking',
      status: 'Open', assignee: currentUser, priority: 'P2', tech: true, site: 'Whitefield',
      created: 'today 05:52', lastUpdate: 'today 06:10', slaRemainingMin: 195, awaitingYou: true, newSinceHandover: true,
      updates: [
        u('today 05:52', 'Logged by branch manager — no Wi-Fi on the banking floor'),
        u('today 06:10', 'Auto-assigned to you (unassigned for 18 minutes)'),
      ],
    }),
    T('INC-1062', 'Commercial Street POS outage', {
      affectedScope: 'Commercial Street branch', affectedCount: { n: 620, unit: 'customers', approx: true }, department: 'Retail Banking',
      status: 'In progress', assignee: currentUser, priority: 'P3', tech: true, site: 'Commercial Street',
      created: '3 days ago', lastUpdate: 'yesterday', slaRemainingMin: 1680,
      vendor: 'TelcoNet', vendorRef: '', waitingDays: 3, chaseAgeDays: 1, eta: '', waitingSince: '2026-09-11', lastChased: '2026-09-13', vendorHasPortalFeed: true,
      updates: [
        u('3 days ago 09:40', 'Logged — POS terminals offline at Commercial Street'),
        u('3 days ago 11:15', 'Fibre fault confirmed by TelcoNet; repair raised'),
        u('yesterday 10:00', 'Chased TelcoNet — no ETA yet'),
      ],
    }),
    T('INC-1095', 'Merchant settlement file — transmission fault', {
      affectedScope: '1 merchant', affectedCount: { n: 3, unit: 'clients' }, department: 'Payments',
      status: 'In progress', assignee: currentUser, priority: 'P3', tech: true,
      created: '2 days ago', lastUpdate: 'today 06:31', awaitingYou: true,
      updates: [
        u('2 days ago 15:20', 'Logged — merchant settlement file not received by the bank'),
        u('yesterday 09:05', 'Requester asked for a plain-English update'),
        u('yesterday 17:40', 'Transmission fault found on the outbound gateway'),
        u('today 06:31', 'Requester replied — asked again for a plain-English update'),
      ],
    }),
    T('INC-1101', 'Shared drive permissions — Loans team', {
      affectedScope: 'Loans team', affectedCount: { n: 18, unit: 'users' }, department: 'Retail Banking',
      status: 'Waiting on requester', assignee: currentUser, priority: 'P3', tech: true,
      created: '4 days ago', lastUpdate: '2 days ago', slaRemainingMin: 1200, slaPaused: true, waitingDays: 2,
      updates: [
        u('4 days ago 14:00', 'Logged — Loans team cannot open the shared drive'),
        u('2 days ago 10:30', 'Asked the requester which folders — no reply in 2 days'),
      ],
    }),
    T('INC-1108', 'Printer offline — counter 2, Jayanagar', {
      affectedScope: 'Jayanagar branch', affectedCount: { n: 2, unit: 'counters' }, department: 'Retail Banking',
      status: 'Open', assignee: currentUser, priority: 'P3', tech: true, site: 'Jayanagar',
      created: 'yesterday', lastUpdate: 'today 07:05', slaRemainingMin: 360, awaitingYou: true,
      updates: [
        u('yesterday 16:45', 'Logged — counter 2 printer offline'),
        u('today 07:05', 'Requester replied — printer shows a paper-path error'),
      ],
    }),
    T('INC-1114', 'Outlook signature not syncing', {
      affectedScope: 'One user', affectedCount: { n: 1, unit: 'users' }, department: 'Retail Banking',
      status: 'Open', assignee: currentUser, priority: 'P4', tech: true,
      created: 'yesterday', lastUpdate: 'yesterday', slaRemainingMin: 2880,
      updates: [u('yesterday 11:20', 'Logged — signature not syncing to mobile')],
    }),
    T('INC-1116', 'Laptop battery replacement request', {
      affectedScope: 'One user', affectedCount: { n: 1, unit: 'users' }, department: 'Retail Banking',
      status: 'Waiting on vendor', assignee: currentUser, priority: 'P4', tech: true,
      created: '3 days ago', lastUpdate: '2 days ago', slaRemainingMin: 2400, slaPaused: true,
      vendor: 'DellCare', vendorRef: 'DC-88213', waitingDays: 2, chaseAgeDays: 2, eta: 'Fri',
      updates: [u('2 days ago 12:00', 'Warranty claim raised with DellCare — DC-88213')],
    }),
    T('INC-1119', 'Software install — Tableau', {
      affectedScope: 'One user', affectedCount: { n: 1, unit: 'users' }, department: 'Retail Banking',
      status: 'Waiting on approval', assignee: currentUser, priority: 'P4', tech: true,
      created: '2 days ago', lastUpdate: '2 days ago', slaRemainingMin: 3000, slaPaused: true,
      updates: [u('2 days ago 09:30', 'Licence approval requested from the BI team lead')],
    }),

    /* ── the team's tickets pending on vendors (a subset of the org-wide 22) ────────────── */
    T('INC-1041', 'Leased line degraded — Koramangala', {
      status: 'Waiting on vendor', assignee: 'Network', priority: 'P3', tech: true,
      created: '8 days ago', lastUpdate: '4 days ago', slaRemainingMin: 900,
      vendor: 'TelcoNet', vendorRef: '', waitingDays: 6, chaseAgeDays: 4, eta: '', waitingSince: '2026-09-08', lastChased: '2026-09-10', vendorHasPortalFeed: true,
      updates: [u('6 days ago 10:00', 'Raised with TelcoNet — awaiting a ticket reference')],
    }),
    T('INC-1055', 'Fibre relocation — HSR branch', {
      status: 'Waiting on vendor', assignee: 'Network', priority: 'P3', tech: true,
      created: '9 days ago', lastUpdate: '5 days ago', slaRemainingMin: 600,
      vendor: 'TelcoNet', vendorRef: '', waitingDays: 7, chaseAgeDays: 5, eta: '', waitingSince: '2026-09-07', lastChased: '2026-09-09', vendorHasPortalFeed: true,
      updates: [u('7 days ago 15:30', 'Relocation requested from TelcoNet')],
    }),
    T('INC-1071', 'MPLS latency — Electronic City', {
      status: 'Waiting on vendor', assignee: 'Network', priority: 'P3', tech: true,
      created: '5 days ago', lastUpdate: '2 days ago', slaRemainingMin: 2200,
      vendor: 'TelcoNet', vendorRef: 'TT-BLR-98871', waitingDays: 4, chaseAgeDays: 2, eta: 'Fri', waitingSince: '2026-09-10', lastChased: '2026-09-12', vendorHasPortalFeed: true,
      updates: [u('4 days ago 11:00', 'TelcoNet ref TT-BLR-98871 — line test scheduled')],
    }),
    T('INC-1084', 'Backup circuit down — Hebbal', {
      status: 'Waiting on vendor', assignee: 'Network', priority: 'P3', tech: true,
      created: '3 days ago', lastUpdate: 'yesterday', slaRemainingMin: 2600,
      vendor: 'TelcoNet', vendorRef: 'TT-BLR-99004', waitingDays: 2, chaseAgeDays: 1, eta: 'tomorrow', waitingSince: '2026-09-12', lastChased: '2026-09-13', vendorHasPortalFeed: true,
      updates: [u('2 days ago 09:20', 'TelcoNet ref TT-BLR-99004 — engineer booked')],
    }),
    T('INC-1090', 'Passbook printer — counter 4, Malleswaram', {
      status: 'Waiting on vendor', assignee: 'EUC', priority: 'P3', tech: true,
      created: '6 days ago', lastUpdate: '3 days ago', slaRemainingMin: 420,
      vendor: 'PrintCo', vendorRef: 'PC-44120', waitingDays: 4, chaseAgeDays: 4, eta: '', waitingSince: '2026-09-10', lastChased: '2026-09-10', vendorHasPortalFeed: true,
      updates: [u('4 days ago 13:00', 'PrintCo ref PC-44120 — part on order')],
    }),
    T('INC-1098', 'Cheque printer jam — Rajajinagar', {
      status: 'Waiting on vendor', assignee: 'EUC', priority: 'P3', tech: true,
      created: '3 days ago', lastUpdate: 'yesterday', slaRemainingMin: 1500,
      vendor: 'PrintCo', vendorRef: 'PC-44207', waitingDays: 2, chaseAgeDays: 1, eta: 'tomorrow', waitingSince: '2026-09-12', lastChased: '2026-09-13', vendorHasPortalFeed: true,
      updates: [u('2 days ago 10:10', 'PrintCo ref PC-44207 — engineer visit booked')],
    }),
    T('INC-1104', 'Toner sensor fault — HQ floor 3', {
      status: 'Waiting on vendor', assignee: 'EUC', priority: 'P4', tech: true,
      created: '2 days ago', lastUpdate: 'today 08:30', slaRemainingMin: 2700,
      vendor: 'PrintCo', vendorRef: 'PC-44231', waitingDays: 1, chaseAgeDays: 0, eta: 'Thu', waitingSince: '2026-09-13', lastChased: '2026-09-14', vendorHasPortalFeed: true,
      updates: [u('today 08:30', 'Chased PrintCo — sensor module shipping Thursday')],
    }),
    T('INC-1079', 'Relay queue backlog — outbound statements', {
      status: 'Waiting on vendor', assignee: 'Messaging', priority: 'P3', tech: true,
      created: '4 days ago', lastUpdate: '2 days ago', slaRemainingMin: 300,
      vendor: 'CloudMail', vendorRef: 'CM-7731', waitingDays: 3, chaseAgeDays: 2, eta: '', waitingSince: '2026-09-11', lastChased: '2026-09-12', vendorHasPortalFeed: true,
      updates: [u('3 days ago 09:00', 'CloudMail ref CM-7731 — relay capacity under review')],
    }),

    /* ── the Bengaluru VPN pattern: four resolved, two open ────────────────────────────── */
    T('INC-0611', 'VPN drops every 30 minutes — BLR-2 wireless', {
      status: 'Resolved', assignee: 'Network', priority: 'P3', tech: true, site: 'Bengaluru', scope: 'BLR-2 wireless',
      created: 'Feb 2026', lastUpdate: 'Feb 2026', resolvedOn: '11 Feb 2026', resolvedAgo: 'Feb', resolvedBy: 'Network',
      resolution: 'DHCP lease 30 min on BLR-2 WLC — extended to 8 h; drops stopped', linked: ['KB-0342'],
      updates: [u('11 Feb 2026', 'Resolved — DHCP lease on BLR-2 WLC extended to 8 h')],
    }),
    T('INC-0702', 'VPN reconnects on the half hour — BLR-2 wireless', {
      status: 'Resolved', assignee: 'Network', priority: 'P3', tech: true, site: 'Bengaluru', scope: 'BLR-2 wireless',
      created: 'Apr 2026', lastUpdate: 'Apr 2026', resolvedOn: '3 Apr 2026', resolvedAgo: 'Apr', resolvedBy: 'Network',
      resolution: 'DHCP lease 30 min on BLR-2 WLC — lease reset after a controller upgrade; re-extended', linked: ['KB-0342'],
      updates: [u('3 Apr 2026', 'Resolved — lease re-extended after the WLC upgrade reverted it')],
    }),
    T('INC-0839', 'VPN tunnel drops at fixed interval — BLR-2 wireless', {
      status: 'Resolved', assignee: 'Network', priority: 'P3', tech: true, site: 'Bengaluru', scope: 'BLR-2 wireless',
      created: 'Jun 2026', lastUpdate: 'Jun 2026', resolvedOn: '19 Jun 2026', resolvedAgo: 'Jun', resolvedBy: 'Network',
      resolution: 'DHCP lease 30 min on BLR-2 WLC — extended on the new CORP-BLR WLAN', linked: ['KB-0342'],
      updates: [u('19 Jun 2026', 'Resolved — lease extended on the new CORP-BLR WLAN')],
    }),
    T('INC-0917', 'VPN drops every 30 minutes — BLR-1 wireless', {
      status: 'Resolved', assignee: 'Network', priority: 'P3', tech: true, site: 'Bengaluru', scope: 'BLR-1 wireless',
      created: 'Jul 2026', lastUpdate: 'Jul 2026', resolvedOn: '14 Jul 2026', resolvedAgo: 'Jul', resolvedBy: 'Network',
      resolution: 'Same lease copied to BLR-1 WLC in July — extended to 8 h; KB-0342 re-verified', linked: ['KB-0342'],
      updates: [u('14 Jul 2026', 'Resolved — BLR-1 lease extended; KB-0342 verified')],
    }),
    /* `affectedScope` is the WLAN, not the office: on a match card it is the thing that says
       whether this ticket is the pattern, and `site` already carries the office. */
    T('INC-1109', 'VPN disconnects every half hour — Bengaluru', {
      status: 'Open', assignee: 'Network', priority: 'P3', tech: true, site: 'Bengaluru', network: 'BLR-2 wireless',
      affectedScope: 'BLR-2 wireless', affectedCount: { n: 1, unit: 'users' }, department: 'Retail Banking',
      created: 'yesterday', createdOn: '2026-09-13', lastUpdate: 'yesterday', slaRemainingMin: 1900,
      updates: [u('yesterday 14:20', 'Logged — VPN drops every 30 minutes, reconnects on its own')],
    }),
    /* NO `affectedScope`: this one's network is genuinely not recorded, and the impact line
       leaves out what the record does not carry rather than guessing a WLAN for it. That absence
       is also what makes INC-1109 the better default target for the Link action. */
    T('INC-1115', 'VPN drops on wireless — BLR office', {
      status: 'Open', assignee: 'Service Desk', priority: 'P4', tech: true, site: 'Bengaluru', network: 'not recorded',
      affectedCount: { n: 1, unit: 'users' }, department: 'Branch Operations',
      created: 'today 08:50', createdOn: '2026-09-14', lastUpdate: 'today 08:50', slaRemainingMin: 4100,
      updates: [u('today 08:50', 'Logged — intermittent VPN drops on wireless')],
    }),

    /* ── closed today (the handover's optional fourth section) ─────────────────────────── */
    T('INC-1099', 'Card reader jam — Indiranagar', {
      status: 'Closed', assignee: currentUser, priority: 'P3', tech: true, closedToday: true, closedAt: 'today 10:20',
      created: 'yesterday', lastUpdate: 'today 10:20', resolvedAgo: 'today 10:20', resolvedBy: currentUser,
      resolution: 'Reader cleared and firmware reset; branch confirmed working.',
      updates: [u('today 10:20', 'Closed — reader cleared, branch confirmed')],
    }),
    T('INC-1106', 'Mailbox quota — Treasury', {
      status: 'Closed', assignee: currentUser, priority: 'P4', tech: true, closedToday: true, closedAt: 'today 08:45',
      created: 'yesterday', lastUpdate: 'today 08:45', resolvedAgo: 'today 08:45', resolvedBy: currentUser,
      resolution: 'Quota raised to 50 GB; archive policy applied.',
      updates: [u('today 08:45', 'Closed — quota raised to 50 GB')],
    }),

    /* The other three regulatory-reportable tickets (CXO-04) — team-owned, so a StatusCard drill
       and an owner notification have a record to land on. Excluded from "open for me". */
    { ref: 'INC-1103', title: 'Customer data export delayed', status: 'In progress', assignee: 'Data platform',
      created: '3 days ago', lastUpdate: 'yesterday', regulatory: true, notes: [], updates: [] },
    { ref: 'INC-1121', title: 'Card transaction mismatch', status: 'In progress', assignee: 'Payments',
      created: '2 days ago', lastUpdate: 'today', regulatory: true, notes: [], updates: [] },
    { ref: 'INC-1130', title: 'Access-log gap flagged in audit', status: 'Open', assignee: 'Security',
      created: 'yesterday', lastUpdate: 'yesterday', regulatory: true, notes: [], updates: [] },
  ],
  drafts: {},
  problems: [],
  dashboards: [
    { id: 'exec', name: 'Executive overview', tiles: [] },
    { id: 'ops', name: 'Service ops', tiles: [] },
  ],
  shiftLog: [
    {
      id: 'log-0', at: 'yesterday 20:00', by: 'Priya S.', title: 'Evening handover',
      text: 'Burning: INC-1077 (ATM outage, P3 at the time). Blocked: 8 on vendors. Regulator: 4 open, INC-1077 window closing.',
      refs: ['INC-1077'],
    },
  ],
  posts: [],
});

let state: StoreShape = seed();
const listeners = new Set<() => void>();
const emit = () => { state = { ...state, tickets: [...state.tickets] }; listeners.forEach((l) => l()); };

const find = (ref: string) => state.tickets.find((t) => t.ref === ref);

/* ── THE VENDOR DATASET ────────────────────────────────────────────────────────────────────
   Two worlds for one turn: the nine tickets everybody has seen, and the 62 that make every cap
   in TEC-06 do something. The large set is APPENDED, never swapped in — the nine originals stay
   put, which is what keeps the same three tickets most urgent in both without a line of code
   saying so. Switching back removes only what was added, by ref, so a chase somebody sent on a
   real ticket survives the toggle. */
export type VendorSeed = 'small' | 'large';
let vendorSeed: VendorSeed = 'small';
let seededRefs: string[] = [];
export const vendorSeedKind = (): VendorSeed => vendorSeed;
export const setVendorSeed = (kind: VendorSeed, build: () => MockTicket[]): void => {
  if (kind === vendorSeed) return;
  vendorSeed = kind;
  if (kind === 'large') {
    const rows = build();
    seededRefs = rows.map((t) => t.ref);
    rows.forEach((t) => { if (t.vendor) extraVendors.add(t.vendor); });
    state.tickets = [...state.tickets, ...rows];
  } else {
    const drop = new Set(seededRefs);
    seededRefs = [];
    extraVendors.clear();
    state.tickets = state.tickets.filter((t) => !drop.has(t.ref));
  }
  emit();
};

let nextIncident = 1042;

/** Every mutation writes its line here — the handover is built from these. */
const log = (t: MockTicket, text: string, by?: string): void => {
  t.updates = [...t.updates, { at: nowLabel(), text, by }];
  t.lastUpdate = 'just now';
};

/* ── reads ─────────────────────────────────────────────────────────────── */
export const getTicket = (ref: string): MockTicket | undefined => find(ref);
export const getKb = (id: string): KbArticle | undefined => KB_ARTICLES.find((k) => k.id === id);
/** The requester's own open tickets — never a technician-side record, never a regulatory one. */
export const listOpenForUser = (): MockTicket[] =>
  state.tickets.filter((t) => t.status !== 'Resolved' && t.status !== 'Closed' && !t.regulatory && !t.tech);
export const listProblems = (): MockProblem[] => state.problems;
export const listDashboards = (): MockDashboard[] => state.dashboards;
export const getDraft = (id: string): MockDraft => state.drafts[id] ?? {};
export const listShiftLog = (): ShiftLogEntry[] => state.shiftLog;
export const listPosts = (): ChannelPost[] => state.posts;

const openish = (t: MockTicket) => t.status !== 'Resolved' && t.status !== 'Closed';
/** YOUR queue — everything open that is assigned to you. */
export const listQueue = (): MockTicket[] => state.tickets.filter((t) => t.assignee === currentUser && openish(t));
/** The TEAM'S tickets held by a board vendor. The `tech` test is not decoration: a requester's
 *  own request can be waiting on a supplier too, and it is not in the technician's vendor queue.
 *  The filter only got away without it while nothing but a technician record carried a vendor. */
/** THE BOARD, PLUS WHOEVER THE ACTIVE DATASET BROUGHT WITH IT. `VENDOR_BOARD` is leadership's
 *  four named suppliers; the large dataset's whole point is the long tail behind them, and a
 *  Ricoh copier contract is no less a vendor we are waiting on for not being on that list. With
 *  the small dataset active this set IS `VENDOR_BOARD`, so nothing about the nine changes. */
const extraVendors = new Set<string>();
export const activeVendorBoard = (): string[] => [...VENDOR_BOARD, ...extraVendors];
export const listVendorPending = (): MockTicket[] => {
  const board = new Set(activeVendorBoard());
  return state.tickets.filter((t) => openish(t) && !!t.tech && !!t.vendor && board.has(t.vendor));
};
export const listClosedToday = (): MockTicket[] => state.tickets.filter((t) => t.closedToday);
export const listSimilar = (refs: string[]): MockTicket[] => refs.map(find).filter((t): t is MockTicket => !!t);
export const listOpenAt = (site: string, word: RegExp): MockTicket[] =>
  state.tickets.filter((t) => openish(t) && t.site === site && word.test(t.title));

const PRI = (t: MockTicket) => parseInt(String(t.priority ?? 'P9').replace(/\D/g, ''), 10) || 9;
const clockRunning = (t: MockTicket) => t.slaRemainingMin !== undefined && !t.slaPaused;
/** TEC-01's triage order: a regulatory clock outranks an SLA clock; then the shortest running
 *  clock; then priority. Paused clocks and clockless tickets sit after every running one. */
export const triageOrder = (rows: MockTicket[], rank: 'triage' | 'sla' | 'priority' = 'triage'): MockTicket[] =>
  [...rows].sort((a, b) => {
    if (rank === 'priority') return PRI(a) - PRI(b) || (a.slaRemainingMin ?? 1e9) - (b.slaRemainingMin ?? 1e9);
    const ra = clockRunning(a) ? a.slaRemainingMin! : 1e9 + PRI(a);
    const rb = clockRunning(b) ? b.slaRemainingMin! : 1e9 + PRI(b);
    if (rank === 'triage') {
      const ga = a.regulatory && (a.regulatoryOverdueDays ?? 0) > 0 ? 0 : 1;
      const gb = b.regulatory && (b.regulatoryOverdueDays ?? 0) > 0 ? 0 : 1;
      if (ga !== gb) return ga - gb;
    }
    return ra - rb || PRI(a) - PRI(b);
  });

/** What changed since the last handover (20:00 yesterday) — new, resolved, escalated. */
export const changesSinceHandover = (): Array<{ kind: 'new' | 'resolved' | 'escalated'; ticket: MockTicket; at: string }> => [
  ...state.tickets.filter((t) => t.newSinceHandover).map((t) => ({ kind: 'new' as const, ticket: t, at: t.created })),
  ...state.tickets.filter((t) => t.closedToday).map((t) => ({ kind: 'resolved' as const, ticket: t, at: t.closedAt ?? t.lastUpdate })),
  ...state.tickets.filter((t) => t.escalatedAt).map((t) => ({ kind: 'escalated' as const, ticket: t, at: t.escalatedAt! })),
];

/* ── mutations — the ONLY way anything changes ─────────────────────────── */
export function createTicket(t: Omit<MockTicket, 'ref' | 'notes' | 'created' | 'lastUpdate' | 'status' | 'assignee' | 'updates'> & Partial<MockTicket>): MockTicket {
  const rec: MockTicket = {
    /* Nobody has it yet — which is what "waiting to be picked up" has always claimed on screen.
       The queue it will be routed to is not a person, and naming one as the assignee was the
       card's own invention. */
    status: 'Open', assignee: '', statusTrail: ['Open'],
    created: 'just now', createdOn: DEMO_TODAY, lastUpdate: 'just now', notes: [], updates: [],
    ...t,
    ref: `INC-${nextIncident++}`,
  } as MockTicket;
  log(rec, 'Created');
  state.tickets = [...state.tickets, rec];
  emit();
  return rec;
}

export function updateTicket(ref: string, patch: Partial<MockTicket>): MockTicket | undefined {
  const t = find(ref);
  if (!t) return undefined;
  Object.assign(t, patch);
  /* A generic patch can still move the status - REQ-07's reopen does exactly that - and the
     requester's trail has to hear about it whichever mutation performed the change. */
  if (patch.status) pushTrail(t, patch.status);
  log(t, `Updated: ${Object.keys(patch).join(', ')}`);
  emit();
  return t;
}

export function addNote(ref: string, text: string, opts?: { external?: boolean; by?: string }): MockTicket | undefined {
  const t = find(ref);
  if (!t) return undefined;
  t.notes = [...t.notes, { text, when: 'just now', external: opts?.external }];
  log(t, opts?.external ? `Reply sent to requester: "${text.slice(0, 60)}${text.length > 60 ? '…' : ''}"` : `Note added: "${text.slice(0, 60)}${text.length > 60 ? '…' : ''}"`, opts?.by);
  emit();
  return t;
}

export function escalate(ref: string): MockTicket | undefined {
  const t = find(ref);
  if (!t) return undefined;
  Object.assign(t, { priority: 'High', assignee: 'EUC escalation queue' });
  t.notes = [...t.notes, { text: 'Escalated — requester and team lead notified.', when: 'just now' }];
  log(t, 'Escalated — priority High, EUC escalation queue');
  emit();
  return t;
}

export function closeTicket(ref: string, resolution?: string): MockTicket | undefined {
  const t = find(ref);
  if (!t) return undefined;
  Object.assign(t, {
    status: 'Closed' as const, needsYou: false,
    resolution: resolution ?? t.resolution, resolvedAgo: 'just now',
  });
  pushTrail(t, 'Closed');
  log(t, 'Closed');
  emit();
  return t;
}

/** TEC-04 and TEC-01: a status change, with its pending reason and vendor ref when it is a hold,
 *  and the SLA clock paused or resumed accordingly. */
export function setStatus(ref: string, status: TicketStatus, opts?: {
  pendingReason?: string; vendorRef?: string; vendorRefUnverified?: boolean; pauseSla?: boolean;
  notifyRequester?: boolean;
}): MockTicket | undefined {
  const t = find(ref);
  if (!t) return undefined;
  const was = t.status;
  t.status = status;
  pushTrail(t, status);
  if (status === 'In progress' && t.assignee !== currentUser) t.assignee = currentUser;
  if (opts?.pendingReason !== undefined) t.pendingReason = opts.pendingReason;
  if (opts?.vendorRef !== undefined) t.vendorRef = opts.vendorRef;
  if (opts?.vendorRefUnverified !== undefined) t.vendorRefUnverified = opts.vendorRefUnverified;
  if (opts?.pauseSla !== undefined) t.slaPaused = opts.pauseSla;
  if (opts?.notifyRequester) t.requesterNotified = true;
  if (status === 'In progress' && was !== 'In progress') t.awaitingYou = false;
  const bits = [`Status ${was} → ${status}`];
  if (opts?.pendingReason) bits.push(`pending reason: ${opts.pendingReason}`);
  if (opts?.vendorRef) bits.push(`vendor ref ${opts.vendorRef}${opts.vendorRefUnverified ? ' (not in the vendor feed)' : ''}`);
  if (opts?.pauseSla) bits.push(`SLA clock paused (${durationLabel(t.slaRemainingMin ?? 0)} preserved)`);
  if (opts?.notifyRequester) bits.push('requester notified');
  log(t, bits.join(' · '));
  emit();
  return t;
}

/** TEC-01: START a ticket — pick it up as active work. Open becomes In progress; a ticket that
 *  is already In progress keeps its status and gains an active owner. A regulatory ticket earns
 *  a reminder at the same time, because the reporting clock is the reason it was first. */
export function startTicket(ref: string): MockTicket | undefined {
  const t = find(ref);
  if (!t) return undefined;
  const was = t.status;
  if (t.status === 'Open') t.status = 'In progress';
  pushTrail(t, t.status);
  t.assignee = currentUser;
  t.active = true;
  t.awaitingYou = false;
  const bits = [was === t.status ? `Started — ${t.status}, active owner ${currentUser}` : `Started — ${was} → ${t.status}, active owner ${currentUser}`];
  if (t.regulatory) { t.reminderAt = 'in 30 min'; bits.push('regulatory reminder set for 30 min'); }
  log(t, bits.join(' · '));
  emit();
  return t;
}

/** TEC-02: send someone an update — the text goes on the ticket as a visible note addressed to
 *  them, so the record says who was told what. */
export function sendUpdate(ref: string, to: string, text: string): MockTicket | undefined {
  const t = find(ref);
  if (!t) return undefined;
  t.notes = [...t.notes, { text: `To ${to}: ${text}`, when: 'just now', external: true }];
  log(t, `Update sent to ${to}: "${text.slice(0, 60)}${text.length > 60 ? '…' : ''}"`);
  emit();
  return t;
}

export function assignToMe(ref: string): MockTicket | undefined {
  const t = find(ref);
  if (!t) return undefined;
  const was = t.assignee;
  t.assignee = currentUser;
  log(t, `Assigned to you (was ${was})`);
  emit();
  return t;
}

export function addReminder(ref: string, when: string): MockTicket | undefined {
  const t = find(ref);
  if (!t) return undefined;
  t.reminderAt = when;
  log(t, `Reminder set for ${when}`);
  emit();
  return t;
}

/** TEC-03: link a record (a KB article, or another ticket) to a ticket. Symmetric for tickets. */
export function linkTicket(ref: string, target: string): MockTicket | undefined {
  const t = find(ref);
  if (!t) return undefined;
  t.linked = [...new Set([...(t.linked ?? []), target])];
  log(t, `Linked ${target}`);
  const other = find(target);
  if (other) { other.linked = [...new Set([...(other.linked ?? []), ref])]; log(other, `Linked ${ref}`); }
  emit();
  return t;
}

/** TEC-04 / TEC-06: a vendor chase — the note goes on the ticket and "last chased" resets. */
export function chase(ref: string, text: string): MockTicket | undefined {
  const t = find(ref);
  if (!t) return undefined;
  t.notes = [...t.notes, { text, when: 'just now' }];
  t.chaseAgeDays = 0;
  log(t, `Chased ${t.vendor ?? 'vendor'}: "${text.slice(0, 60)}${text.length > 60 ? '…' : ''}"`);
  emit();
  return t;
}

/** TEC-02: add an event to an incident's timeline. */
export function addEvent(ref: string, time: string, label: string): MockTicket | undefined {
  const t = find(ref);
  if (!t) return undefined;
  t.events = [...(t.events ?? []), { t: time, label }];
  log(t, `Timeline event added — ${time} ${label}`);
  emit();
  return t;
}

/** TEC-02: subscribe the current user to a ticket's updates. */
export function subscribe(ref: string): MockTicket | undefined {
  const t = find(ref);
  if (!t) return undefined;
  t.subscribed = true;
  log(t, 'You subscribed to updates');
  emit();
  return t;
}

let nextPost = 1;
/** TEC-07: post to a channel. Records only — nothing leaves the prototype. */
export function postToChannel(channel: string, text: string): ChannelPost {
  const rec: ChannelPost = { id: `post-${nextPost++}`, channel, text, at: nowLabel() };
  state.posts = [...state.posts, rec];
  emit();
  return rec;
}

let nextLog = 1;
/** TEC-07: save the handover to the shift log; the night lead is notified. Every ticket the
 *  handover names gets a line saying so. */
export function addToShiftLog(entry: { title: string; text: string; refs: string[] }): ShiftLogEntry {
  const rec: ShiftLogEntry = { id: `log-${nextLog++}`, at: nowLabel(), by: currentUser, ...entry, notified: 'Night lead' };
  state.shiftLog = [...state.shiftLog, rec];
  entry.refs.forEach((r) => { const t = find(r); if (t) log(t, 'Named in the shift handover — night lead notified'); });
  emit();
  return rec;
}

let nextProblem = 41;
/** CXO-06: raise a problem record. PRB-0041 first, then counting up. */
export function createProblem(p: Omit<MockProblem, 'ref' | 'created'>): MockProblem {
  const rec: MockProblem = { ...p, ref: `PRB-${String(nextProblem++).padStart(4, '0')}`, created: 'just now' };
  state.problems = [...state.problems, rec];
  emit();
  return rec;
}

let nextTile = 1;
/** Part 3: add a chart snapshot to a dashboard. Returns the dashboard it landed on. */
export function addTile(dashboardId: string, tile: Omit<DashboardTile, 'id'>): MockDashboard | undefined {
  const d = state.dashboards.find((x) => x.id === dashboardId);
  if (!d) return undefined;
  d.tiles = [...d.tiles, { ...tile, id: `tile-${nextTile++}` }];
  state.dashboards = [...state.dashboards];
  emit();
  return d;
}
export function removeTile(dashboardId: string, tileId: string): MockDashboard | undefined {
  const d = state.dashboards.find((x) => x.id === dashboardId);
  if (!d) return undefined;
  d.tiles = d.tiles.filter((t) => t.id !== tileId);
  state.dashboards = [...state.dashboards];
  emit();
  return d;
}

export function updateDraft(id: string, patch: MockDraft): MockDraft {
  state.drafts = { ...state.drafts, [id]: { ...state.drafts[id], ...patch } };
  emit();
  return state.drafts[id];
}

/** Test/demo reset. */
export function resetTicketStore(): void {
  state = seed();
  nextIncident = 1042;
  nextProblem = 41;
  nextTile = 1;
  nextPost = 1;
  nextLog = 1;
  listeners.forEach((l) => l());
}

/* ── the technician datasets — store-backed, so a chart reflects this session's changes ── */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'];
const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : 0);

/** The datasets `mockAnalytics.dataset()` delegates here for. Null when the key is not ours. */
export function technicianDataset(key: string, groupBy?: string): ChartData | null {
  if (key === 'techVendors') {
    const rows = listVendorPending();
    const overdue = rows.filter((t) => (t.chaseAgeDays ?? 99) >= CHASE_OVERDUE_DAYS);
    const vendors = [...new Set(rows.map((t) => t.vendor!))];
    const headline = `${vendors[0] ?? 'No vendor'} holds ${rows.filter((t) => t.vendor === vendors[0]).length} of the ${rows.length} tickets waiting on vendors, and ${overdue.length} have not been chased in ${CHASE_OVERDUE_DAYS} days or more`;
    if (groupBy === 'age') {
      return { shape: 'ranking', unit: 'days waiting', n: rows.length, headline,
        rows: [...rows].sort((a, b) => (b.waitingDays ?? 0) - (a.waitingDays ?? 0))
          .map((t) => ({ label: `${t.ref} · ${t.vendor}`, value: t.waitingDays ?? 0, secondary: t.eta ? `ETA ${t.eta}` : 'no ETA' })) };
    }
    if (groupBy === 'chased') {
      return { shape: 'ranking', unit: 'days since last chase', n: rows.length, headline,
        rows: [...rows].sort((a, b) => (b.chaseAgeDays ?? 99) - (a.chaseAgeDays ?? 99))
          .map((t) => ({ label: `${t.ref} · ${t.vendor}`, value: t.chaseAgeDays ?? 0,
            display: t.chaseAgeDays === 0 ? 'today' : `${t.chaseAgeDays}d`,
            badge: (t.chaseAgeDays ?? 99) >= CHASE_OVERDUE_DAYS ? 'overdue' : undefined })) };
    }
    return { shape: 'ranking', unit: 'tickets waiting', n: rows.length, headline,
      rows: vendors.map((v) => {
        const mine = rows.filter((t) => t.vendor === v);
        const late = mine.filter((t) => (t.chaseAgeDays ?? 99) >= CHASE_OVERDUE_DAYS).length;
        return { label: v, value: mine.length, secondary: `avg ${avg(mine.map((t) => t.waitingDays ?? 0))} days`,
          badge: late ? `${late} chase${late === 1 ? '' : 's'} overdue` : undefined };
      }).sort((a, b) => b.value - a.value) };
  }
  if (key === 'blrVpnCases') {
    const kb = getKb('KB-0342');
    const cases = listSimilar(kb?.linked ?? []);
    const months = MONTHS.slice(1, 7);   // Feb–Jul
    const mi = (t: MockTicket) => { const m = (t.resolvedOn ?? '').split(' ')[1]; return Math.max(0, months.indexOf(m)); };
    const day = (t: MockTicket) => parseInt(t.resolvedOn ?? '15', 10) || 15;
    return { shape: 'timeline', months,
      events: cases.map((t) => ({ id: t.ref, x: mi(t) + day(t) / 31, label: `${t.ref} · ${t.scope}`, severity: 'low' as const, named: true, type: t.scope ?? 'wireless' })),
      n: cases.length, headline: `${cases.length} identical Bengaluru VPN cases between February and July, all resolved the same way` };
  }
  return null;
}

/* ── the React bridge ──────────────────────────────────────────────────── */
const subscribeStore = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
const snapshot = () => state;
export const useTicketStore = (): StoreShape => useSyncExternalStore(subscribeStore, snapshot, snapshot);
