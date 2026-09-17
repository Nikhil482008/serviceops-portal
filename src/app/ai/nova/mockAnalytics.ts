import { technicianDataset } from './mockTickets';
/* THE LEADERSHIP DATASET — one mock analytics module every CXO case reads from.
 *
 * Every number a leadership answer shows comes from HERE: the seeds below are the brief's
 * figures verbatim, everything else is DERIVED from them by a rule written beside it, and the
 * scripts author `{{keys}}` that resolve against `VALUES` rather than typing numerals. That is
 * what keeps seven cases internally consistent — 27 breaches is 27 breaches in the KPI strip,
 * the gauge, the ranked bars, the drill table and the callout, because there is one 27.
 *
 * `checkSums()` is the self-audit the suite runs: categories sum to the monthly totals,
 * breaches by service/team/priority each sum to 27, teams sum to June, VPN = 11/27 = 41%.
 */

/* ── seeds (verbatim from the brief) ─────────────────────────────────────── */
export const AS_OF = '6 Sep 2026, 09:00';

export const VOLUME = { may: 1146, june: 1284 } as const;

export const CATEGORIES = [
  { id: 'VPN', june: 187, may: 146 },
  { id: 'Access requests', june: 224, may: 202 },
  { id: 'Hardware', june: 168, may: 175 },
  { id: 'Email & collaboration', june: 143, may: 139 },
  { id: 'Software', june: 201, may: 188 },
  { id: 'Other', june: 361, may: 296 },
] as const;

export const TEAMS_JUNE = [
  { id: 'Service Desk', tickets: 612 },
  { id: 'End User Computing', tickets: 348 },
  { id: 'Network', tickets: 214 },
  { id: 'Messaging', tickets: 110 },
] as const;

export const SLA = {
  bound: 466,
  breaches: 27,
  breachesMay: 23,
  compliance: 94.2,
  target: 95,
  /* Apr … Sep? No — six months ending June: Jan–Jun. */
  trend: [95.1, 95.4, 94.8, 95.0, 95.6, 94.2],
  trendMonths: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
  byService: [
    { id: 'VPN', n: 11 }, { id: 'Email', n: 6 }, { id: 'Hardware', n: 4 },
    { id: 'Access', n: 3 }, { id: 'Software', n: 2 }, { id: 'Other', n: 1 },
  ],
  byTeam: [
    { id: 'Network', n: 12 }, { id: 'Service Desk', n: 8 },
    { id: 'End User Computing', n: 5 }, { id: 'Messaging', n: 2 },
  ],
  byPriority: [{ id: 'P1', n: 2 }, { id: 'P2', n: 9 }, { id: 'P3', n: 16 }],
} as const;

export const KPIS = {
  resolution: { may: 1.8, june: 2.1 },
  reopened: { may: 45, june: 41 },
} as const;

export const VENDORS = [
  { id: 'TelcoNet', scope: 'WAN & fibre', waiting: 9, wait: 6.4, breaches: 5 },
  { id: 'PrintCo', scope: 'printers', waiting: 6, wait: 3.1, breaches: 2 },
  { id: 'CloudMail', scope: 'email relay', waiting: 4, wait: 2.2, breaches: 1 },
  { id: 'SecureID', scope: 'MFA', waiting: 3, wait: 1.4, breaches: 0 },
] as const;
export const VENDOR_BREACHES = 8;

export const REGULATORY = [
  { ref: 'INC-1077', title: 'ATM network outage — 3 branches', dueDays: -1, owner: 'Network' },
  { ref: 'INC-1103', title: 'Customer data export delayed', dueDays: 2, owner: 'Data platform' },
  { ref: 'INC-1121', title: 'Card transaction mismatch', dueDays: 6, owner: 'Payments' },
  { ref: 'INC-1130', title: 'Access-log gap flagged in audit', dueDays: 12, owner: 'Security' },
] as const;
/** The reporting window every regulatory ticket is measured against (days). Derived
 *  convention: the countdown bar is dueDays / this. */
export const REPORTING_WINDOW_DAYS = 14;

export const SECURITY = {
  total: 14, high: 3, dataLoss: 0,
  financial: { count: 1, amount: 240000, recovered: true },
  investigating: 2,
  months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'],
  byMonth: [1, 2, 3, 1, 2, 2, 1, 2, 0],
  named: [
    { id: 'SEC-0207', month: 'Mar', title: 'Phishing campaign',
      what: '2 accounts compromised', contained: 'Contained in 4h', impact: 'No data loss' },
    { id: 'SEC-0231', month: 'Jun', title: 'Credential-stuffing attempt',
      what: 'Blocked at MFA', contained: 'Automatic — MFA held', impact: 'No impact' },
    { id: 'SEC-0244', month: 'Aug', title: 'Lost laptop',
      what: 'Encrypted device lost in transit', contained: 'Remotely wiped', impact: 'No data loss' },
  ],
} as const;

export const PROBLEMS = [
  { id: 'vpn', name: 'VPN auth failure after password change', tickets: 38, teams: 12, hours: 57,
    fix: 'Sync VPN auth with SSO', owner: 'Network',
    /* 12 weeks, rising — sums to 38. */
    weekly: [1, 1, 2, 2, 2, 3, 3, 4, 4, 5, 5, 6] },
  { id: 'printer', name: 'Passbook printer fading (model PX-400)', tickets: 17, teams: 9, hours: 34,
    fix: 'Replace PX-400 units', owner: 'End User Computing',
    /* flat — sums to 17. */
    weekly: [1, 2, 1, 1, 2, 1, 2, 1, 1, 2, 1, 2] },
  { id: 'mailbox', name: 'Shared mailbox access requests', tickets: 22, teams: 6, hours: 26,
    fix: 'Automate group membership', owner: 'Messaging',
    /* gently rising — sums to 22. */
    weekly: [1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 3] },
] as const;

export const HR = {
  types: ['Payroll query', 'Onboarding', 'Leave & attendance', 'Policy question'],
  /* Eight weeks, week-beginning dates. Payroll DOUBLES in the week beginning 1 Sep. */
  weeks: ['14 Jul', '21 Jul', '28 Jul', '4 Aug', '11 Aug', '18 Aug', '25 Aug', '1 Sep'],
  /* rows = types; previous four weeks sum to 70, last four to 86. */
  series: [
    [5, 6, 5, 6, 6, 6, 6, 13],   // Payroll query      prev 22 · last 31
    [5, 4, 5, 5, 5, 6, 5, 6],    // Onboarding         prev 19 · last 22
    [4, 4, 5, 4, 5, 5, 4, 5],    // Leave & attendance prev 17 · last 19
    [3, 3, 3, 3, 4, 3, 4, 3],    // Policy question    prev 12 · last 14
  ],
} as const;

/* ── formatting ──────────────────────────────────────────────────────────── */
export const fmt = (n: number): string => n.toLocaleString('en-IN');
/** Rupees in Indian lakh notation — "₹2.4L". No product-wide currency token exists (the only
 *  formatter in the product is an inline `en-IN` toLocaleString in PurchaseDrawer), so this is
 *  the module's own. */
export const inr = (amount: number): string =>
  amount >= 100000 ? `₹${(amount / 100000).toFixed(1).replace(/\.0$/, '')}L` : `₹${fmt(amount)}`;
const pct = (a: number, b: number): number => Math.round(((a - b) / b) * 100);

/** "Based on N tickets · data as of 6 Sep 2026, 09:00" — computed per dataset, never typed. */
export const freshness = (n: number, unit = 'tickets'): string =>
  `Based on ${fmt(n)} ${unit} · data as of ${AS_OF}`;

/* ── derived ─────────────────────────────────────────────────────────────── */
const sum = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0);
const vpnBreaches = SLA.byService.find((s) => s.id === 'VPN')!.n;
const vpnCat = CATEGORIES.find((c) => c.id === 'VPN')!;
const network = TEAMS_JUNE.find((t) => t.id === 'Network')!;
const networkBreaches = SLA.byTeam.find((t) => t.id === 'Network')!.n;
const telco = VENDORS[0];
const hrLast = HR.series.map((s) => sum(s.slice(4)));
const hrPrev = HR.series.map((s) => sum(s.slice(0, 4)));
const hrLast4 = sum(hrLast);
const hrPrev4 = sum(hrPrev);

/** May by team — NOT seeded. Derived by the June share applied to May's total, largest-remainder
 *  rounded so the column still sums to 1,146. A documented rule, not an invented figure. */
export const TEAMS_MAY = (() => {
  const raw = TEAMS_JUNE.map((t) => (t.tickets / VOLUME.june) * VOLUME.may);
  const floors = raw.map(Math.floor);
  let rest = VOLUME.may - sum(floors);
  const order = raw.map((v, i) => [v - floors[i], i] as const).sort((a, b) => b[0] - a[0]);
  const out = [...floors];
  for (const [, i] of order) { if (rest <= 0) break; out[i] += 1; rest -= 1; }
  return TEAMS_JUNE.map((t, i) => ({ id: t.id, tickets: out[i] }));
})();

/** June VPN tickets by team — NOT seeded. Derived: Network carries the breaches (12 of 27) and
 *  the incidents; the split mirrors the team volume shares with Network weighted to lead. */
export const VPN_BY_TEAM = [
  { id: 'Network', n: 96 }, { id: 'Service Desk', n: 58 },
  { id: 'End User Computing', n: 21 }, { id: 'Messaging', n: 12 },
] as const;   // sums to 187 — asserted in checkSums()

/** Daily VPN tickets in June (30 days) — NOT seeded day by day. Authored so the month sums to
 *  187 and the five days after the 3 June policy change carry ~3× the five days before. */
export const VPN_DAILY = [
  3, 3, 4,                       // 1–3 Jun   (before: 10)
  9, 11, 12, 10, 9,              // 4–8 Jun   (after:  51 ≈ 5×)
  8, 8, 8, 7, 7, 7, 6,           // 9–15
  6, 6, 6, 5, 5, 5, 5,           // 16–22
  5, 5, 5, 5, 5, 4, 4, 4,        // 23–30
] as const;   // 10 + 51 + 51 + 38 + 37 = 187 — asserted in checkSums()

/** The 27 breached tickets — authored to satisfy ALL THREE seeded marginals at once
 *  (service 11/6/4/3/2/1 · team 12/8/5/2 · priority 2/9/16). Asserted in checkSums(). */
export const BREACHED_TICKETS = (() => {
  const plan: Array<[string, string, number]> = [
    ['VPN', 'Network', 11], ['Other', 'Network', 1],
    ['Access', 'Service Desk', 3], ['Software', 'Service Desk', 2], ['Email', 'Service Desk', 3],
    ['Hardware', 'End User Computing', 4], ['Email', 'End User Computing', 1],
    ['Email', 'Messaging', 2],
  ];
  const titles: Record<string, string[]> = {
    VPN: ['VPN drops after password change', 'VPN auth loop on new laptop', 'Remote site VPN down', 'VPN MFA prompt never arrives'],
    Other: ['Branch kiosk unresponsive'],
    Access: ['Shared drive access request', 'CRM role change', 'Loans mailbox access'],
    Software: ['Core banking client crash', 'Report builder licence'],
    Email: ['Mail relay bounce to counterparty', 'Calendar sync failure', 'Shared mailbox delegation'],
    Hardware: ['Passbook printer fading', 'Docking station dead', 'Counter PC won\'t boot', 'Card reader intermittent'],
  };
  const priorities = ['P1', 'P1', 'P2', 'P2', 'P2', 'P2', 'P2', 'P2', 'P2', 'P2', 'P2',
    'P3', 'P3', 'P3', 'P3', 'P3', 'P3', 'P3', 'P3', 'P3', 'P3', 'P3', 'P3', 'P3', 'P3', 'P3', 'P3'];
  const rows: Array<{ ref: string; title: string; service: string; team: string; priority: string; breachedBy: string; hours: number }> = [];
  let k = 0;
  for (const [service, team, n] of plan) {
    for (let i = 0; i < n; i++) {
      const t = titles[service][i % titles[service].length];
      const hours = [26, 19, 14, 11, 9, 8, 7, 6, 6, 5, 5, 4, 4, 4, 3, 3, 3, 3, 2, 2, 2, 2, 2, 1, 1, 1, 1][k];
      rows.push({
        ref: `INC-${1005 + k * 3}`, title: t, service, team, priority: priorities[k],
        breachedBy: `${hours}h`, hours,
      });
      k += 1;
    }
  }
  return rows.sort((a, b) => b.hours - a.hours);
})();

/** TelcoNet's nine waiting tickets — days waiting sum to 58 (avg 6.4). */
export const TELCONET_TICKETS = [
  { ref: 'INC-1052', title: 'Fibre cut — Andheri branch', days: 12 },
  { ref: 'INC-1061', title: 'WAN link flapping — Pune DC', days: 9 },
  { ref: 'INC-1068', title: 'Circuit upgrade stalled — Thane', days: 8 },
  { ref: 'INC-1074', title: 'Backup line down — Nashik', days: 7 },
  { ref: 'INC-1080', title: 'Latency on MPLS — Surat', days: 6 },
  { ref: 'INC-1086', title: 'Fibre splice pending — Vashi', days: 5 },
  { ref: 'INC-1092', title: 'Router RMA — Nagpur', days: 5 },
  { ref: 'INC-1097', title: 'Line test overdue — Kolhapur', days: 3 },
  { ref: 'INC-1101', title: 'Port activation — new branch', days: 3 },
] as const;   // 9 rows, 58 days — asserted in checkSums()

/** The 14 security incidents — dates from the seeded month counts; the three named ones are
 *  the three HIGH; the rest are authored low/medium with a type for the group-by. */
export const SECURITY_INCIDENTS = (() => {
  const named = new Map(SECURITY.named.map((n) => [n.month, n]));
  const types = ['Phishing', 'Access', 'Device', 'Malware'];
  const out: Array<{ id: string; month: string; monthIndex: number; day: number; severity: 'high' | 'medium' | 'low'; type: string; title: string; status: string }> = [];
  let seq = 201;
  SECURITY.months.forEach((m, mi) => {
    for (let i = 0; i < SECURITY.byMonth[mi]; i++) {
      const isNamed = i === 0 && named.has(m);
      const n = isNamed ? named.get(m)! : null;
      const id = n ? n.id : `SEC-0${seq}`;
      seq += 3;
      out.push({
        id, month: m, monthIndex: mi, day: 4 + i * 9,
        severity: n ? 'high' : (i % 2 ? 'medium' : 'low'),
        type: n ? (n.id === 'SEC-0244' ? 'Device' : n.id === 'SEC-0231' ? 'Access' : 'Phishing') : types[(mi + i) % types.length],
        title: n ? n.title : `${types[(mi + i) % types.length]} alert — closed, no impact`,
        status: 'Closed',
      });
    }
  });
  /* Two still under investigation — the July one and the second August one. */
  const inv = out.filter((x) => (x.month === 'Jul') || (x.month === 'Aug' && x.id !== 'SEC-0244')).slice(0, 2);
  inv.forEach((x) => { x.status = 'Under investigation'; });
  return out;
})();
export const UNDER_INVESTIGATION = SECURITY_INCIDENTS
  .filter((x) => x.status === 'Under investigation')
  .map((x, i) => ({ ...x, owner: i === 0 ? 'Security' : 'IT Risk', expectedClose: i === 0 ? '12 Sep' : '19 Sep' }));

/** Effort to fix — NOT seeded. Authored 1–10 so the matrix has an x-axis: SSO sync is a
 *  configuration change, replacing printers is procurement, automation is a small build. */
export const PROBLEM_EFFORT: Record<string, number> = { vpn: 3, printer: 7, mailbox: 4 };

/** Payroll sub-reasons (sum to the 31 payroll queries) and HR locations (sum to 86). */
export const HR_PAYROLL_REASONS = [
  { id: 'Tax deduction looks wrong', n: 12 }, { id: 'Overtime not reflected', n: 9 },
  { id: 'Reimbursement missing', n: 6 }, { id: 'Payslip not received', n: 4 },
] as const;
export const HR_LOCATIONS = [
  { id: 'Mumbai HQ', n: 29 }, { id: 'Pune', n: 21 }, { id: 'Bengaluru', n: 16 },
  { id: 'Chennai', n: 12 }, { id: 'Remote', n: 8 },
] as const;

/** What the leadership investigations read — the scope line's "N data sources". */
export const DATA_SOURCES = ['Ticket data', 'SLA records', 'Team roster'] as const;
/** The seeded event behind CXO-01's VPN spike. */
export const POLICY_CHANGE = { date: '3 June', dayIndex: 2 } as const;
/** Category → the SLA "service" it breaches under. */
export const CATEGORY_SERVICE: Record<string, string> = {
  VPN: 'VPN', 'Access requests': 'Access', Hardware: 'Hardware',
  'Email & collaboration': 'Email', Software: 'Software', Other: 'Other',
};

/* ── the values every script interpolates ({{key}}) ─────────────────────── */
export const VALUES: Record<string, string> = {
  asOf: AS_OF,
  dataSources: String(DATA_SOURCES.length),
  policyChangeDate: POLICY_CHANGE.date,
  vpnProblemTickets: String(PROBLEMS[0].tickets),
  printerProblemTickets: String(PROBLEMS[1].tickets),
  mailboxProblemTickets: String(PROBLEMS[2].tickets),
  regOverdueTitle: REGULATORY[0].title,
  juneTotal: fmt(VOLUME.june), mayTotal: fmt(VOLUME.may),
  volumeDeltaPct: String(pct(VOLUME.june, VOLUME.may)),
  teams: String(TEAMS_JUNE.length),
  breaches: String(SLA.breaches), breachesMay: String(SLA.breachesMay),
  breachDeltaPct: String(pct(SLA.breaches, SLA.breachesMay)),
  breachDeltaAbs: String(SLA.breaches - SLA.breachesMay),
  compliance: SLA.compliance.toFixed(1), target: String(SLA.target),
  compliancePtDelta: (SLA.trend[4] - SLA.compliance).toFixed(1),
  slaBound: String(SLA.bound),
  p1Breaches: String(SLA.byPriority[0].n),
  resolutionJune: KPIS.resolution.june.toFixed(1),
  resolutionDelta: (KPIS.resolution.june - KPIS.resolution.may).toFixed(1),
  reopened: String(KPIS.reopened.june),
  reopenedDeltaPct: String(Math.abs(pct(KPIS.reopened.june, KPIS.reopened.may))),
  vpnJune: String(vpnCat.june), vpnMay: String(vpnCat.may),
  vpnDeltaPct: String(pct(vpnCat.june, vpnCat.may)),
  vpnDeltaAbs: String(vpnCat.june - vpnCat.may),
  vpnBreaches: String(vpnBreaches),
  vpnShare: String(Math.round((vpnBreaches / SLA.breaches) * 100)),
  otherDeltaAbs: String(CATEGORIES[5].june - CATEGORIES[5].may),
  networkTickets: String(network.tickets),
  networkBreaches: String(networkBreaches),
  networkBreachShare: String(Math.round((networkBreaches / SLA.breaches) * 100)),
  networkVolumeShare: String(Math.round((network.tickets / VOLUME.june) * 100)),
  vpnTopTeam: VPN_BY_TEAM[0].id,
  vpnBefore: String(sum(VPN_DAILY.slice(0, 3)) / 3 * 5 | 0),
  vpnAfterMultiple: String(Math.round(sum(VPN_DAILY.slice(3, 8)) / (sum(VPN_DAILY.slice(0, 3)) / 3 * 5))),
  waitingOnVendors: String(sum(VENDORS.map((v) => v.waiting))),
  vendorBreaches: String(VENDOR_BREACHES),
  worstWait: telco.wait.toFixed(1),
  vendorsCount: String(VENDORS.length),
  telconetWaiting: String(telco.waiting), telconetWait: telco.wait.toFixed(1),
  telconetBreaches: String(telco.breaches),
  regOpen: String(REGULATORY.length),
  regOverdue: String(REGULATORY.filter((r) => r.dueDays < 0).length),
  regDueSoon: String(REGULATORY.filter((r) => r.dueDays >= 0 && r.dueDays <= 7).length),
  regOnTrack: String(REGULATORY.filter((r) => r.dueDays > 7).length),
  regOverdueRef: REGULATORY[0].ref, regOverdueOwner: REGULATORY[0].owner,
  regOverdueDays: String(Math.abs(REGULATORY[0].dueDays)),
  secTotal: String(SECURITY.total), secHigh: String(SECURITY.high),
  secDataLoss: String(SECURITY.dataLoss), secInvestigating: String(SECURITY.investigating),
  secAmount: inr(SECURITY.financial.amount),
  clusters: String(PROBLEMS.length),
  repeatTickets: String(sum(PROBLEMS.map((p) => p.tickets))),
  hoursLost: String(sum(PROBLEMS.map((p) => p.hours))),
  teamsAffected: String(Math.max(...PROBLEMS.map((p) => p.teams))),
  vpnProblemHours: String(PROBLEMS[0].hours),
  topTwoTickets: String(PROBLEMS[0].tickets + PROBLEMS[1].tickets),
  /* 117 hours a quarter ÷ ~130 productive hours per FTE-quarter — the assumption the callout states. */
  fte: (sum(PROBLEMS.map((p) => p.hours)) / 130).toFixed(1),
  fteHoursAssumed: '130',
  hrLast4: String(hrLast4), hrPrev4: String(hrPrev4),
  /* 86 vs 70 is +22.86% — the brief states +22%, i.e. truncated, so this one truncates. */
  hrDeltaPct: String(Math.trunc(((hrLast4 - hrPrev4) / hrPrev4) * 100)),
  hrPayroll: String(hrLast[0]), hrOnboarding: String(hrLast[1]), hrLeave: String(hrLast[2]), hrPolicy: String(hrLast[3]),
  hrPayrollPrev: String(hrPrev[0]),
  hrTopReason: HR_PAYROLL_REASONS[0].id, hrTopReasonN: String(HR_PAYROLL_REASONS[0].n),
  hrTopLocation: HR_LOCATIONS[0].id, hrTopLocationN: String(HR_LOCATIONS[0].n),
  hrSpikeWeek: HR.weeks[7],
};

/** Replace every `{{key}}` in a string with its VALUES entry. Unknown keys are left visible on
 *  purpose — a script author sees `{{typo}}` on screen rather than a silently blank number. */
export const fill = (s: string): string => s.replace(/\{\{(\w+)\}\}/g, (m, k) => VALUES[k] ?? m);

/* ── the chart datasets ──────────────────────────────────────────────────── */
export type KpiSpec = {
  label: string; value: string; delta?: string;
  /** Which way the number moved, and whether THAT direction is bad for this KPI. */
  dir?: 'up' | 'down'; bad?: boolean;
};

export type ChartData =
  | { shape: 'comparison'; categories: string[]; series: Array<{ name: string; values: number[] }>; deltas: string[]; n: number; headline: string }
  | { shape: 'ranking'; rows: Array<{ label: string; value: number; display?: string; secondary?: string; badge?: string; delta?: string }>; unit?: string; n: number; headline: string }
  | { shape: 'trend'; x: string[]; series: Array<{ name: string; values: number[] }>; target?: number; annotate?: { i: number; text: string }; n: number; headline: string; yMax?: number }
  | { shape: 'gauge'; value: number; target: number; trend: { x: string[]; values: number[] }; n: number; headline: string }
  | { shape: 'timeline'; events: Array<{ id: string; x: number; label: string; severity: 'high' | 'medium' | 'low'; named: boolean; type: string }>; months: string[]; n: number; headline: string }
  | { shape: 'deadlines'; rows: Array<{ ref: string; title: string; owner: string; dueDays: number; windowDays: number }>; n: number; headline: string }
  | { shape: 'matrix'; points: Array<{ id: string; label: string; x: number; y: number; size: number; sizeLabel: string }>; xLabel: string; yLabel: string; n: number; headline: string }
  | { shape: 'table'; columns: string[]; rows: Array<Array<string | number>>; n: number; headline: string };

const signed = (n: number) => (n > 0 ? `+${n}` : String(n));
const signedPct = (a: number, b: number) => `${pct(a, b) > 0 ? '+' : ''}${pct(a, b)}%`;

/** Resolve a dataset by key and group-by. Every case's charts, tables, drills and CSV exports
 *  go through this ONE function, so a chart and its table can never disagree. */
export function dataset(key: string, groupBy?: string): ChartData {
  /* The technician datasets read the LIVE store (a hold in TEC-04 changes TEC-06's chart), so
     they resolve there; every leadership key below is seeded and static. */
  const tech = technicianDataset(key, groupBy);
  if (tech) return tech;
  switch (key) {
    case 'juneVsMay': {
      if (groupBy === 'team') {
        return { shape: 'comparison', categories: TEAMS_JUNE.map((t) => t.id),
          series: [{ name: 'June', values: TEAMS_JUNE.map((t) => t.tickets) }, { name: 'May', values: TEAMS_MAY.map((t) => t.tickets) }],
          deltas: TEAMS_JUNE.map((t, i) => signedPct(t.tickets, TEAMS_MAY[i].tickets)),
          n: VOLUME.june + VOLUME.may, headline: `June ran ${VALUES.volumeDeltaPct}% hotter than May across all four teams` };
      }
      if (groupBy === 'priority') {
        /* Priority split is not seeded per month: SLA-bound (P1–P3) is 466 in June, and the same
           share is applied to May — a documented derivation, not a figure. */
        const juneBound = SLA.bound; const juneOther = VOLUME.june - SLA.bound;
        const mayBound = Math.round((SLA.bound / VOLUME.june) * VOLUME.may); const mayOther = VOLUME.may - mayBound;
        return { shape: 'comparison', categories: ['P1–P3 (SLA-bound)', 'P4 (no SLA)'],
          series: [{ name: 'June', values: [juneBound, juneOther] }, { name: 'May', values: [mayBound, mayOther] }],
          deltas: [signedPct(juneBound, mayBound), signedPct(juneOther, mayOther)],
          n: VOLUME.june + VOLUME.may, headline: `June ran ${VALUES.volumeDeltaPct}% hotter than May at every priority` };
      }
      return { shape: 'comparison', categories: CATEGORIES.map((c) => c.id),
        series: [{ name: 'June', values: CATEGORIES.map((c) => c.june) }, { name: 'May', values: CATEGORIES.map((c) => c.may) }],
        deltas: CATEGORIES.map((c) => signedPct(c.june, c.may)),
        n: VOLUME.june + VOLUME.may, headline: `June ran ${VALUES.volumeDeltaPct}% hotter than May, and VPN grew the most at +${VALUES.vpnDeltaPct}%` };
    }
    case 'whatMoved': {
      const rows = CATEGORIES.map((c) => ({ label: c.id, value: c.june - c.may, display: signed(c.june - c.may) }))
        .sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
      return { shape: 'ranking', rows, unit: 'tickets', n: VOLUME.june + VOLUME.may, headline: 'Other and VPN moved the most between May and June' };
    }
    case 'vpnByTeam':
      return { shape: 'ranking', rows: VPN_BY_TEAM.map((t) => ({ label: t.id, value: t.n })), unit: 'VPN tickets',
        n: vpnCat.june, headline: `${VPN_BY_TEAM[0].id} handled the most VPN tickets in June` };
    case 'categoryByTeam': {
      /* A drilled category's June tickets by team. VPN is authored (Network leads); any other
         category is split by the seeded team volume shares, largest-remainder rounded. */
      const cat = CATEGORIES.find((c) => c.id === groupBy) ?? vpnCat;
      if (cat.id === 'VPN') return dataset('vpnByTeam');
      const raw = TEAMS_JUNE.map((t) => (t.tickets / VOLUME.june) * cat.june);
      const floors = raw.map(Math.floor);
      let rest = cat.june - sum(floors);
      const order = raw.map((v, i) => [v - floors[i], i] as const).sort((a, b) => b[0] - a[0]);
      const out = [...floors];
      for (const [, i] of order) { if (rest <= 0) break; out[i] += 1; rest -= 1; }
      const rows = TEAMS_JUNE.map((t, i) => ({ label: t.id, value: out[i] })).sort((a, b) => b.value - a.value);
      return { shape: 'ranking', rows, unit: `${cat.id} tickets`, n: cat.june, headline: `${rows[0].label} handled the most ${cat.id} tickets in June` };
    }
    case 'vpnDaily':
      return { shape: 'trend', x: VPN_DAILY.map((_, i) => String(i + 1)), series: [{ name: 'VPN tickets', values: [...VPN_DAILY] }],
        annotate: { i: 2, text: 'Password policy changed · 3 Jun' }, n: vpnCat.june,
        headline: 'Daily VPN tickets tripled in the five days after the 3 June password-policy change' };
    case 'breachesByTeam':
      return { shape: 'ranking', rows: SLA.byTeam.map((t) => ({ label: t.id, value: t.n })), unit: 'breaches',
        n: SLA.breaches, headline: `Network carries ${VALUES.networkBreaches} of the ${VALUES.breaches} breaches` };
    case 'sla':
      return { shape: 'gauge', value: SLA.compliance, target: SLA.target,
        trend: { x: [...SLA.trendMonths], values: [...SLA.trend] }, n: SLA.bound,
        headline: `SLA compliance is ${VALUES.compliance}% against a ${VALUES.target}% target, the first month below target since March` };
    case 'breaches': {
      const src = groupBy === 'team' ? SLA.byTeam : groupBy === 'priority' ? SLA.byPriority : SLA.byService;
      return { shape: 'ranking', rows: src.map((s) => ({ label: s.id, value: s.n })), unit: 'breaches',
        n: SLA.breaches, headline: groupBy === 'team' ? `Network carries ${VALUES.networkBreachShare}% of breaches`
          : groupBy === 'priority' ? `P3 tickets account for most breaches` : `VPN alone is ${VALUES.vpnShare}% of breaches` };
    }
    case 'breachedTickets': {
      /* A drill segment may be a service, a team or a priority — whichever column matches. */
      const rows = groupBy && groupBy !== 'all'
        ? BREACHED_TICKETS.filter((t) => t.service === groupBy || t.team === groupBy || t.priority === groupBy)
        : BREACHED_TICKETS;
      return { shape: 'table', columns: ['Ref', 'Title', 'Service', 'Team', 'Priority', 'Breached by'],
        rows: rows.map((t) => [t.ref, t.title, t.service, t.team, t.priority, t.breachedBy]),
        n: rows.length, headline: `${rows.length} breached tickets, sorted by how far past SLA they went` };
    }
    case 'vendors': {
      const metric = groupBy === 'wait' ? 'wait' : groupBy === 'breaches' ? 'breaches' : 'waiting';
      const rows = [...VENDORS].sort((a, b) => b[metric] - a[metric]).map((v) => ({
        label: v.id, value: v[metric], display: metric === 'wait' ? `${v.wait.toFixed(1)}d` : String(v[metric]),
        secondary: metric === 'wait' ? `${v.waiting} waiting` : `${v.wait.toFixed(1)}d avg wait`,
        badge: v.breaches ? `${v.breaches} breach${v.breaches === 1 ? '' : 'es'}` : undefined,
      }));
      return { shape: 'ranking', rows, unit: metric === 'waiting' ? 'tickets waiting' : metric === 'wait' ? 'days' : 'breaches',
        n: sum(VENDORS.map((v) => v.waiting)), headline: `TelcoNet is the biggest external drag: ${VALUES.telconetWaiting} tickets waiting, ${VALUES.telconetWait} days on average` };
    }
    case 'vendorTickets': {
      const v = VENDORS.find((x) => x.id === groupBy) ?? telco;
      if (v.id === 'TelcoNet') {
        return { shape: 'table', columns: ['Ref', 'Title', 'Days waiting'],
          rows: TELCONET_TICKETS.map((t) => [t.ref, t.title, t.days]), n: TELCONET_TICKETS.length,
          headline: `${TELCONET_TICKETS.length} tickets are waiting on TelcoNet` };
      }
      /* Other vendors' tickets are not authored one by one — rows are derived from the seeded
         count and the seeded average wait (days alternate around it). */
      const rows = Array.from({ length: v.waiting }, (_, i) => [
        `INC-${1110 + i * 4}`, `Waiting on ${v.id} — ${v.scope} · ticket ${i + 1}`,
        Math.max(1, Math.round(v.wait + (i % 2 ? 1 : -1) * (i % 3))),
      ]);
      return { shape: 'table', columns: ['Ref', 'Title', 'Days waiting'], rows, n: v.waiting,
        headline: `${v.waiting} tickets are waiting on ${v.id}` };
    }
    case 'regulatory': {
      const rows = [...REGULATORY].map((r) => ({ ...r, windowDays: REPORTING_WINDOW_DAYS }))
        .sort((a, b) => (groupBy === 'owner' ? a.owner.localeCompare(b.owner) : a.dueDays - b.dueDays));
      return { shape: 'deadlines', rows, n: REGULATORY.length,
        headline: `Four regulatory-reportable tickets are open and ${REGULATORY[0].ref} is already past its window` };
    }
    case 'securityTimeline':
      return { shape: 'timeline', months: [...SECURITY.months],
        events: SECURITY_INCIDENTS.map((e) => ({ id: e.id, x: e.monthIndex + e.day / 31, label: `${e.id} · ${e.title}`,
          severity: e.severity, named: SECURITY.named.some((n) => n.id === e.id), type: e.type })),
        n: SECURITY.total, headline: `${VALUES.secTotal} security incidents this year, ${VALUES.secHigh} high severity, none with data loss` };
    case 'investigating':
      return { shape: 'table', columns: ['Ref', 'Title', 'Status', 'Owner', 'Expected close'],
        rows: UNDER_INVESTIGATION.map((x) => [x.id, x.title, x.status, x.owner, x.expectedClose]),
        n: UNDER_INVESTIGATION.length, headline: 'Two incidents are still under investigation' };
    case 'problems': {
      const sizeKey = groupBy === 'tickets' ? 'tickets' : groupBy === 'teams' ? 'teams' : 'hours';
      return { shape: 'matrix', xLabel: 'Effort to fix →', yLabel: 'Recurrence (tickets, 90 days) ↑',
        points: PROBLEMS.map((p) => ({ id: p.id, label: p.name, x: PROBLEM_EFFORT[p.id], y: p.tickets, size: p[sizeKey],
          sizeLabel: `${p[sizeKey]} ${sizeKey === 'hours' ? 'hours' : sizeKey}` })),
        n: sum(PROBLEMS.map((p) => p.tickets)), headline: 'The VPN cluster is the fix-now problem: highest recurrence, lowest effort' };
    }
    case 'problemHours':
      return { shape: 'ranking', rows: PROBLEMS.map((p) => ({ label: p.name, value: p.hours })), unit: 'hours a quarter',
        n: sum(PROBLEMS.map((p) => p.tickets)), headline: `Fixing all three saves about ${VALUES.hoursLost} technician hours a quarter` };
    case 'hrTrend': {
      if (groupBy === 'location' || groupBy === 'team') {
        /* Location / team series are NOT seeded per week — each week is split by the seeded
           location shares (or by two HR teams, 60/40), a documented derivation. */
        const totals = HR.weeks.map((_, wi) => sum(HR.series.map((s) => s[wi])));
        const dims = groupBy === 'location'
          ? HR_LOCATIONS.slice(0, 4).map((l) => ({ name: l.id, share: l.n / hrLast4 }))
          : [{ name: 'HR Shared Services', share: 0.6 }, { name: 'HR Business Partners', share: 0.4 }];
        return { shape: 'trend', x: [...HR.weeks], series: dims.map((d) => ({ name: d.name, values: totals.map((t) => Math.round(t * d.share)) })),
          n: hrLast4 + hrPrev4, headline: `HR cases are up ${VALUES.hrDeltaPct}% over the last four weeks` };
      }
      return { shape: 'trend', x: [...HR.weeks], series: HR.types.map((t, i) => ({ name: t, values: [...HR.series[i]] })),
        annotate: { i: 7, text: 'Payroll cycle · queries doubled' }, n: hrLast4 + hrPrev4,
        headline: `HR cases are up ${VALUES.hrDeltaPct}% and payroll queries doubled in the week of ${HR.weeks[7]}` };
    }
    case 'hrByType':
      return { shape: 'ranking', rows: HR.types.map((t, i) => ({ label: t, value: hrLast[i], delta: signedPct(hrLast[i], hrPrev[i]) }))
        .sort((a, b) => b.value - a.value), unit: 'cases · last 4 weeks', n: hrLast4,
        headline: 'Payroll queries lead the last four weeks and grew the most' };
    case 'hrPayrollReasons':
      return { shape: 'ranking', rows: HR_PAYROLL_REASONS.map((r) => ({ label: r.id, value: r.n })), unit: 'queries',
        n: hrLast[0], headline: `${HR_PAYROLL_REASONS[0].id} is the top payroll question` };
    case 'hrByLocation':
      return { shape: 'ranking', rows: HR_LOCATIONS.map((l) => ({ label: l.id, value: l.n })), unit: 'cases', n: hrLast4,
        headline: `${HR_LOCATIONS[0].id} raises the most HR cases` };
    case 'hrCases': {
      /* A type's cases — derived rows, one per counted case in the weekly series. */
      const ti = Math.max(0, HR.types.indexOf(groupBy ?? HR.types[0]));
      const rows: Array<Array<string | number>> = [];
      let k = 1;
      HR.weeks.forEach((wk, wi) => {
        for (let i = 0; i < HR.series[ti][wi]; i++) {
          rows.push([`HR-${2400 + k}`, ti === 0 ? HR_PAYROLL_REASONS[(k - 1) % 4].id : `${HR.types[ti]} — case ${k}`, wk]);
          k += 1;
        }
      });
      return { shape: 'table', columns: ['Ref', 'Summary', 'Week of'], rows, n: rows.length,
        headline: `${rows.length} ${HR.types[ti].toLowerCase()} cases over eight weeks` };
    }
    case 'regulatoryUpdates':
      return { shape: 'table', columns: ['When', 'Update'], rows: [
        ['Yesterday 18:10', 'Reporting window passed — draft notification still with Network'],
        ['Yesterday 11:30', 'Two of three branches restored; third on backup link'],
        ['2 days ago', 'Root cause traced to a failed core switch at the regional hub'],
        ['3 days ago', 'Flagged as regulatory-reportable by the compliance desk'],
      ], n: 4, headline: 'The last four updates on INC-1077' };
    default:
      return { shape: 'table', columns: ['Key'], rows: [[key]], n: 0, headline: 'Unknown dataset' };
  }
}

/** The KPI strips, computed. */
export const KPI_SETS: Record<string, KpiSpec[]> = {
  /* THREE, NOT FOUR. The fourth (reopened rate) wrapped onto a second row of its own at drawer
     width — one card alone under three, which reads as an afterthought rather than as a fourth
     equal figure. Three is also the answer's own shape: volume, breaches, speed. The reopened
     figure is not lost; it is in the underlying data the drill and the CSV both carry. */
  cxo01: [
    { label: 'Tickets', value: VALUES.juneTotal, delta: `${VALUES.volumeDeltaPct}%`, dir: 'up', bad: true },
    { label: 'SLA breaches', value: VALUES.breaches, delta: `${VALUES.breachDeltaPct}%`, dir: 'up', bad: true },
    { label: 'Avg resolution', value: `${VALUES.resolutionJune}d`, delta: `${VALUES.resolutionDelta}d`, dir: 'up', bad: true },
  ],
  cxo01vpn: [
    { label: 'VPN tickets', value: VALUES.vpnJune, delta: `${VALUES.vpnDeltaPct}%`, dir: 'up', bad: true },
    { label: 'Breaches', value: VALUES.vpnBreaches },
    { label: 'Top team', value: VALUES.vpnTopTeam },
  ],
  cxo02: [
    { label: 'Compliance', value: `${VALUES.compliance}%`, delta: `${VALUES.compliancePtDelta}pt`, dir: 'down', bad: true },
    { label: 'Breaches', value: VALUES.breaches, delta: VALUES.breachDeltaAbs, dir: 'up', bad: true },
    { label: 'P1 breaches', value: VALUES.p1Breaches },
    { label: 'Worst service', value: 'VPN' },
  ],
  cxo03: [
    { label: 'Waiting on vendors', value: VALUES.waitingOnVendors },
    { label: 'Vendor breaches', value: `${VALUES.vendorBreaches} of ${VALUES.breaches}` },
    { label: 'Worst wait', value: `${VALUES.worstWait}d` },
    { label: 'Vendors', value: VALUES.vendorsCount },
  ],
  cxo04: [
    { label: 'Open', value: VALUES.regOpen },
    { label: 'Overdue', value: VALUES.regOverdue, dir: 'up', bad: true, delta: 'past window' },
    { label: 'Due within 7 days', value: VALUES.regDueSoon },
    { label: 'On track', value: VALUES.regOnTrack },
  ],
  cxo05: [
    { label: 'Incidents', value: VALUES.secTotal },
    { label: 'High severity', value: VALUES.secHigh },
    { label: 'Data loss', value: VALUES.secDataLoss },
    { label: 'Under investigation', value: VALUES.secInvestigating },
  ],
  cxo06: [
    { label: 'Recurring clusters', value: VALUES.clusters },
    { label: 'Repeat tickets', value: VALUES.repeatTickets },
    { label: 'Hours lost', value: VALUES.hoursLost },
    { label: 'Teams affected', value: VALUES.teamsAffected },
  ],
  cxo07: [
    { label: 'Last 4 weeks', value: VALUES.hrLast4, delta: `${VALUES.hrDeltaPct}%`, dir: 'up', bad: true },
    { label: 'Payroll', value: VALUES.hrPayroll, delta: `${pct(hrLast[0], hrPrev[0])}%`, dir: 'up', bad: true },
    { label: 'Onboarding', value: VALUES.hrOnboarding },
    { label: 'Leave', value: VALUES.hrLeave },
  ],
};

/** A KPI set, with the one dynamic case: a drilled category segment (CXO-01 → "VPN in June"). */
export function kpis(set: string, segment?: string): KpiSpec[] {
  if (set !== 'segment') return KPI_SETS[set] ?? [];
  const cat = CATEGORIES.find((c) => c.id === segment) ?? vpnCat;
  const service = CATEGORY_SERVICE[cat.id];
  const b = SLA.byService.find((s) => s.id === service)?.n ?? 0;
  const top = (dataset('categoryByTeam', cat.id) as Extract<ChartData, { shape: 'ranking' }>).rows[0].label;
  return [
    { label: `${cat.id} tickets`, value: String(cat.june), delta: `${Math.abs(pct(cat.june, cat.may))}%`, dir: cat.june >= cat.may ? 'up' : 'down', bad: cat.june >= cat.may },
    { label: 'Breaches', value: String(b) },
    { label: 'Top team', value: top },
  ];
}

/* ── the self-audit ──────────────────────────────────────────────────────── */
export function checkSums(): Record<string, boolean> {
  return {
    categoriesJune: sum(CATEGORIES.map((c) => c.june)) === VOLUME.june,
    categoriesMay: sum(CATEGORIES.map((c) => c.may)) === VOLUME.may,
    teamsJune: sum(TEAMS_JUNE.map((t) => t.tickets)) === VOLUME.june,
    teamsMay: sum(TEAMS_MAY.map((t) => t.tickets)) === VOLUME.may,
    breachesByService: sum(SLA.byService.map((s) => s.n)) === SLA.breaches,
    breachesByTeam: sum(SLA.byTeam.map((s) => s.n)) === SLA.breaches,
    breachesByPriority: sum(SLA.byPriority.map((s) => s.n)) === SLA.breaches,
    vpnShare41: Math.round((vpnBreaches / SLA.breaches) * 100) === 41,
    vpnByTeam: sum(VPN_BY_TEAM.map((t) => t.n)) === vpnCat.june,
    vpnDaily: sum(VPN_DAILY) === vpnCat.june,
    breachedTicketRows: BREACHED_TICKETS.length === SLA.breaches
      && SLA.byService.every((s) => BREACHED_TICKETS.filter((t) => t.service === s.id).length === s.n)
      && SLA.byTeam.every((s) => BREACHED_TICKETS.filter((t) => t.team === s.id).length === s.n)
      && SLA.byPriority.every((s) => BREACHED_TICKETS.filter((t) => t.priority === s.id).length === s.n),
    vendorWaiting22: sum(VENDORS.map((v) => v.waiting)) === 22,
    vendorBreaches8: sum(VENDORS.map((v) => v.breaches)) === VENDOR_BREACHES,
    telconet: TELCONET_TICKETS.length === telco.waiting && Math.abs(sum(TELCONET_TICKETS.map((t) => t.days)) / telco.waiting - telco.wait) < 0.06,
    securityMonths: sum(SECURITY.byMonth) === SECURITY.total && SECURITY_INCIDENTS.length === SECURITY.total
      && SECURITY_INCIDENTS.filter((e) => e.severity === 'high').length === SECURITY.high
      && UNDER_INVESTIGATION.length === SECURITY.investigating,
    problemsWeekly: PROBLEMS.every((p) => sum(p.weekly) === p.tickets),
    problemTotals: sum(PROBLEMS.map((p) => p.tickets)) === 77 && sum(PROBLEMS.map((p) => p.hours)) === 117,
    hr: hrLast4 === 86 && hrPrev4 === 70 && HR.series[0][7] >= 2 * HR.series[0][6]
      && sum(HR_PAYROLL_REASONS.map((r) => r.n)) === hrLast[0] && sum(HR_LOCATIONS.map((l) => l.n)) === hrLast4,
  };
}
