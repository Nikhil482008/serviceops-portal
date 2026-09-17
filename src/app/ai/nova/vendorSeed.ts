import { DEMO_TODAY, type MockTicket } from './mockTickets';
import { urgency } from './conversation/vendorWait';

/* THE LARGE VENDOR SEED — 62 tickets, the long tail included.
 *
 * The nine-ticket set is the demo everybody has seen; it is also the set where every cap in the
 * TEC-06 spec is inactive. Three vendors need no "Others" segment, three overdue chases need no
 * preview checklist, six remaining tickets need no by-vendor drill. A turn that only ever renders
 * its own easy case has not been designed, it has been drawn.
 *
 * GENERATED, not typed. The targets are exact — 14 overdue across 9 vendors, 12 missing refs
 * across 9 vendors, 6 due tomorrow, Ricoh and CloudMail with nothing overdue — and 53 hand
 * written records would be 53 chances to miss one. The generator takes those numbers as input and
 * `reportOn` reads them back out, so the suite checks the seed against its own spec.
 *
 * ── ONE NUMBER IN THE BRIEF CANNOT BE BUILT ────────────────────────────────────────────────
 * It asks for 62 tickets across 50 vendors, with the top five holding 40 — which leaves 22
 * tickets to be "spread across 45 vendors". Forty-five vendors cannot hold twenty-two tickets;
 * a vendor with no ticket is not a vendor we are waiting on. (45 is 50 − 5 and 22 is 62 − 40;
 * both subtractions are right, and they describe different sets.)
 *
 * Everything the turn RENDERS is kept self-consistent instead: 62 tickets, the five named counts
 * exactly as specified, and a tail of 22 vendors holding one ticket each. So the headline reads
 * "62, spread across 27 vendors" and the strip's last segment reads "Others · 22 vendors". To
 * get 50 vendors instead, TAIL_TICKETS below has to rise to 45 and the total becomes 85.
 */

const SITES = [
  'Koramangala', 'HSR branch', 'Electronic City', 'Hebbal', 'Malleswaram', 'Rajajinagar',
  'Indiranagar', 'Whitefield', 'Jayanagar', 'Commercial Street', 'HQ floor 2', 'HQ floor 3',
  'Yelahanka', 'Banashankari', 'Marathahalli', 'BTM Layout', 'Peenya', 'Domlur',
];

/** Per-vendor title shapes, so 62 rows read as a queue rather than as "Ticket 41". */
const TITLES: Record<string, string[]> = {
  TelcoNet: ['Leased line degraded', 'MPLS latency', 'Backup circuit down', 'Link flapping', 'Last-mile fault'],
  PrintCo: ['Passbook printer fault', 'Cheque printer jam', 'Toner sensor fault', 'Print spooler stalls'],
  Ricoh: ['MFP scan-to-mail failing', 'Copier drum wear', 'Finisher jam', 'Scanner ADF misfeed'],
  DellCare: ['Laptop battery swelling', 'Dock firmware fault', 'SSD predictive failure'],
  CloudMail: ['Relay queue backlog', 'Outbound throttling', 'DKIM alignment failure'],
};
const GENERIC = [
  'Hardware replacement pending', 'Part on back-order', 'Engineer visit pending',
  'Licence renewal stalled', 'RMA awaiting collection', 'Firmware fix promised',
];

/** The tail vendors — named, because "Vendor 23" is not a vendor. */
const LONG_TAIL = [
  'Acuity', 'Aerotek', 'Alphanet', 'Ampersand', 'Anvil IT', 'Aperture', 'Arclight', 'Ardent',
  'Ashworth', 'Baseline', 'Beacon', 'Bluecrest', 'Brightwire', 'Cadence', 'Calibre', 'Cascade',
  'Cedar', 'Chronos', 'Clearpath', 'Copperline', 'Cornerstone', 'Crestwood', 'Datum', 'Delphi',
  'Eastgate', 'Elevate', 'Emberline', 'Equinox', 'Fairmont', 'Fieldstone', 'Foundry', 'Gateway',
  'Granite', 'Harbour', 'Heliox', 'Ironwood', 'Kestrel', 'Lattice', 'Meridian', 'Northwind',
  'Oakline', 'Pinnacle', 'Quarry', 'Redwood', 'Sablewire',
];

/** One ticket each. See the note above on why this is 22 and not 45. */
const TAIL_TICKETS = 22;

const day = (back: number): string =>
  new Date(Date.parse(DEMO_TODAY + 'T00:00:00Z') - back * 86400000).toISOString().slice(0, 10);

const pick = <T,>(xs: T[], i: number): T => xs[Math.abs(i) % xs.length];

interface Spec {
  vendor: string;
  /** How many tickets to GENERATE — the ones already in the small seed are not re-made. */
  n: number;
  /** The vendor's target mean wait across generated AND carried tickets. */
  avgWait: number;
  /** Waits already contributed by the small seed's tickets for this vendor. */
  carried: number[];
  overdue: number;
  noRef: number;
  dueTomorrow: number;
  portal: boolean;
}

/* The five named vendors. Counts are `target total − what the small seed already holds`, so the
   rendered legend reads 14 / 10 / 7 / 5 / 4 exactly as specified. Overdue and missing-ref
   placements are deliberate: with the small seed's own 3 overdue and 3 missing refs, these land
   on 14 across 9 vendors and 12 across 9 vendors. Ricoh and CloudMail get neither, because the
   "on time across the board" clause needs somebody it is true of. */
const HEAD: Spec[] = [
  { vendor: 'TelcoNet', n: 9, avgWait: 4.1, carried: [6, 7, 3, 4, 2], overdue: 1, noRef: 0, dueTomorrow: 1, portal: true },
  { vendor: 'PrintCo', n: 7, avgWait: 2.6, carried: [4, 2, 1], overdue: 2, noRef: 2, dueTomorrow: 1, portal: true },
  { vendor: 'Ricoh', n: 7, avgWait: 1.8, carried: [], overdue: 0, noRef: 0, dueTomorrow: 1, portal: true },
  /* Four, not five: the store already holds one DellCare warranty case, and widening the vendor
     query past leadership's four-supplier board brought it into this set. */
  { vendor: 'DellCare', n: 4, avgWait: 3.2, carried: [2], overdue: 2, noRef: 1, dueTomorrow: 1, portal: false },
  { vendor: 'CloudMail', n: 3, avgWait: 2.0, carried: [3], overdue: 0, noRef: 0, dueTomorrow: 0, portal: true },
];

/** 22 vendors, one ticket each: six carry an overdue chase, six DIFFERENT ones are missing a
 *  ref, three have no portal feed. Deliberately not the same six — a ticket that is both old and
 *  untraceable is the worst case the urgency formula knows, and twenty-two of them would make the
 *  long tail read as the emergency rather than as the background it is. */
const tailSpecs = (): Spec[] => Array.from({ length: TAIL_TICKETS }, (_, i) => ({
  vendor: LONG_TAIL[i],
  n: 1,
  avgWait: 2.9,
  carried: [],
  overdue: i < 6 ? 1 : 0,
  noRef: i >= 6 && i < 12 ? 1 : 0,
  dueTomorrow: 0,
  portal: i >= 3,
}));

/** Integers that SUM to `total`, spread either side of the mean. Rounding each wait on its own
 *  lost about a fifth of a day per vendor, which is enough to make the legend's average a number
 *  about nearly-the-data. The remainder is handed out one day at a time instead. */
function waits(n: number, total: number): number[] {
  if (n <= 0) return [];
  const base = Math.max(1, Math.floor(total / n));
  const out = Array.from({ length: n }, (_, i) => Math.max(1, base + (i % 2 ? 1 : -1) * Math.ceil((i + 1) / 2)));
  let diff = Math.round(total) - out.reduce((a, b) => a + b, 0);
  for (let i = 0; diff !== 0 && i < n * 8; i++) {
    const k = i % n;
    if (diff > 0) { out[k] += 1; diff -= 1; } else if (out[k] > 1) { out[k] -= 1; diff += 1; }
  }
  return out;
}

export interface SeedReport {
  tickets: number;
  vendors: number;
  overdue: number;
  overdueVendors: number;
  missingRef: number;
  missingRefVendors: number;
  dueTomorrow: number;
  noPortal: number;
  top: Array<{ vendor: string; n: number; avg: number }>;
}

/** Build one vendor's run. `start` is the incident number to count up from. */
function runFor(spec: Spec, start: number): MockTicket[] {
  const out: MockTicket[] = [];
  const titles = TITLES[spec.vendor] ?? GENERIC;
  /* Solve for the generated tickets' mean so the VENDOR's mean lands on target once the small
     seed's own tickets are counted in — otherwise the legend's "avg 4.1 days" would be a number
     about half the data. */
  const total = spec.avgWait * (spec.n + spec.carried.length) - spec.carried.reduce((a, b) => a + b, 0);
  const run = waits(spec.n, total);
  for (let i = 0; i < spec.n; i++) {
    const waiting = run[i];
    /* THREE BANDS, END TO END: overdue at the front, due-tomorrow next, missing-ref at the tail.
       They used to start at the same index, so a ticket could be asked to be overdue AND due
       tomorrow and the second count quietly came up short. */
    const overdue = i < spec.overdue;
    const noRef = i >= spec.n - spec.noRef;
    const chaseAge = overdue ? 4 + (i % 3) : Math.min(waiting, i % 3);
    const due = i >= spec.overdue && i < spec.overdue + spec.dueTomorrow && !noRef;
    const ref = `INC-${start + i}`;
    out.push({
      ref,
      title: `${pick(titles, i)} — ${pick(SITES, start + i)}`,
      status: 'Waiting on vendor',
      assignee: spec.vendor === 'TelcoNet' ? 'Network' : spec.vendor === 'CloudMail' ? 'Messaging' : 'EUC',
      priority: i % 4 === 0 ? 'P3' : 'P4',
      tech: true,
      created: `${waiting + 2} days ago`,
      lastUpdate: `${chaseAge} days ago`,
      slaRemainingMin: 600 + i * 90,
      vendor: spec.vendor,
      vendorRef: noRef ? '' : `${spec.vendor.slice(0, 2).toUpperCase()}-${40000 + start + i}`,
      waitingDays: waiting,
      chaseAgeDays: chaseAge,
      waitingSince: day(waiting),
      lastChased: day(chaseAge),
      vendorHasPortalFeed: spec.portal,
      eta: due ? 'tomorrow' : noRef ? '' : i % 3 === 0 ? 'Fri' : '',
      notes: [],
      updates: [{ at: `${chaseAge} days ago`, text: `Raised with ${spec.vendor}` }],
    });
  }
  return out;
}

/** The 53 tickets the large dataset ADDS to the nine already in the store. The three the cards
 *  show — INC-1055, INC-1041, INC-1090 — are among those nine, which is how the same three lead
 *  both datasets without being special-cased anywhere. */
/** The urgency of INC-1090 — the third of the three tickets both datasets lead with. Stated
 *  once, with its reason, rather than smuggled into two dozen wait values: the demo is built
 *  around those three cards, so nothing this file generates is allowed to displace them.
 *  4 days waiting x 1 (it has a ref) x 1.5 (chased 4 days ago) = 6. */
const TOP_THREE_FLOOR = 6;

export function vendorPendingLarge(): MockTicket[] {
  let next = 1200;
  const out: MockTicket[] = [];
  for (const spec of [...HEAD, ...tailSpecs()]) {
    const run = runFor(spec, next);
    next += run.length;
    out.push(...run);
  }
  /* Shorten anything that would outrank them, one day at a time, and keep its dates honest. A
     generated ticket losing a day changes nothing anyone can see; a generated ticket taking a
     card away from INC-1090 changes the demo. */
  out.forEach((t) => {
    while (t.waitingDays && t.waitingDays > 1 && urgency(t) >= TOP_THREE_FLOOR) {
      t.waitingDays -= 1;
      t.waitingSince = day(t.waitingDays);
      t.created = `${t.waitingDays + 2} days ago`;
    }
  });
  return out;
}

/** What the set actually contains — the dev switch states it, and the suite checks it against
 *  the numbers the brief specified rather than against the generator's intentions. */
export function reportOn(rows: MockTicket[]): SeedReport {
  const byVendor = new Map<string, MockTicket[]>();
  rows.forEach((t) => {
    const v = t.vendor ?? '';
    byVendor.set(v, [...(byVendor.get(v) ?? []), t]);
  });
  const overdue = rows.filter((t) => (t.chaseAgeDays ?? 99) > 3);
  const missing = rows.filter((t) => !t.vendorRef);
  const mean = (xs: MockTicket[]) =>
    Math.round((xs.reduce((a, t) => a + (t.waitingDays ?? 0), 0) / (xs.length || 1)) * 10) / 10;
  return {
    tickets: rows.length,
    vendors: byVendor.size,
    overdue: overdue.length,
    overdueVendors: new Set(overdue.map((t) => t.vendor ?? '')).size,
    missingRef: missing.length,
    missingRefVendors: new Set(missing.map((t) => t.vendor ?? '')).size,
    dueTomorrow: rows.filter((t) => t.eta === 'tomorrow').length,
    noPortal: new Set(rows.filter((t) => t.vendorHasPortalFeed === false).map((t) => t.vendor ?? '')).size,
    top: [...byVendor.entries()]
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 5)
      .map(([vendor, xs]) => ({ vendor, n: xs.length, avg: mean(xs) })),
  };
}
