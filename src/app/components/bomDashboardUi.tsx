import { useId, useState } from 'react';
import { ChevronRight, ArrowUpRight, Info, CheckCircle2, Layers, ShieldAlert, Bot } from 'lucide-react';
import { mockEndpoints } from './endpointsData';
import { BomKpiCard, KpiValue, KpiChip, KpiSplit, KpiContext } from './BomKpiCard';
import type { LicencePolicy, BomDashboard, EolModel } from './bomDashboardData';
import type { AiRisk } from './aiModelsData';
import type { Patch } from './PatchesListPage';
import type { BomType } from './bomData';

/* Shared chrome for the BOM dashboards.
 *
 * Lifted out of BomDashboardPage verbatim when Dashboard 2 arrived — two dashboards drawing the
 * same card, pill and severity badge from two copies is how they drift apart, and this module has
 * already paid for that lesson twice (the Scheduler/Licensing toolbars, the two tab lists).
 * Nothing here computes anything: the figures come from `bomDashboardData`, these only draw.
 */

/** Navigation that can carry the thing you clicked.
 *
 *  A dashboard link used to hand over a page name and nothing else, so "Review" and "View all"
 *  arrived at the register in the same state — the reader had to find their way back to the cut
 *  they had just made. The second argument is the DESTINATION's own filter vocabulary
 *  (`ComponentFocus`), not a new one invented here, so the chip that appears in its search box
 *  is the same chip its own KPI cards set.
 *
 *  It is optional, and a link that genuinely means "all of it" leaves it off. Most of them do:
 *  see the note on `EstateKpis` about which links can carry a selection and which cannot. */
export type BomNavigate = (page: string, focus?: string | null) => void;

// ── palette ────────────────────────────────────────────────────────────
export const BRAND = '#3D8BD0';

/** Two decimals, as every other donut in the product reports. A tooltip and a legend describing
 *  the same slice must agree — rounding one makes 23.79% and 24% look like two figures. */
export const pct = (v: number, total: number) => `${total > 0 ? ((v / total) * 100).toFixed(2) : '0.00'}%`;

/** Donut palette, in the order slices are drawn. Undeclared is deliberately the flat grey — it is
 *  an absence, and colouring an absence like a licence implies it is one. */
export const SLICE = ['#3D8BD0', '#22A06B', '#B45309', '#8B5CF6', '#0E9AA7', '#94A3B8'];

/** Severity — the same triples the BOM tab's findings use, so a Critical looks the same module-wide. */
export const SEV: Record<string, { bg: string; text: string; dot: string }> = {
  Critical: { bg: '#FEF3F2', text: '#B42318', dot: '#EF4444' },
  High: { bg: '#FFF6ED', text: '#B93815', dot: '#F97316' },
  Medium: { bg: '#FFFAEB', text: '#B54708', dot: '#F59E0B' },
  Low: { bg: '#F2F4F7', text: '#475467', dot: '#94A3B8' },
};
export const sevColor = (s: string | null) => (s ? SEV[s]?.dot ?? BRAND : BRAND);

export const POLICY_LABEL: Record<LicencePolicy, string> = {
  denied: 'Denied', restricted: 'Restricted', undeclared: 'Undeclared', allowed: 'Allowed',
};

/** Urgency bands, shared by the day pill and both lifecycle timelines so a colour means one
 *  thing across the page: red is act now, amber is scheduled, grey is watch. */
export const URGENT = '#DC2626';
export const SOON = '#B45309';
export const LATER = '#64748B';
export const bandOf = (days: number): 'critical' | 'upcoming' | 'later' =>
  (days <= 30 ? 'critical' : days <= 120 ? 'upcoming' : 'later');
export const BAND_COLOR = { critical: URGENT, upcoming: SOON, later: LATER } as const;
export const BAND_TINT = { critical: '#FEF3F2', upcoming: '#FEF7E6', later: '#F1F5F9' } as const;

/* The chart block both distribution cards use. One definition — the pair drifted apart once
   already, on padding and ring size, purely because each card wrote its own class string.
   `row` is the third-width measurement: a 180px ring beside a legend leaves the labels about
   four characters wide, and a legend whose labels truncate is a colour key with no key. */
/* `relative` so a control can sit in the corner without joining the layout; `min-h` so that
   corner is never occupied by the ring itself. Both are on the SHARED block, so the two cards'
   rings move together or not at all. */
export const DIST_BLOCK = (row: boolean) =>
  `relative flex min-h-[200px] flex-1 gap-4 px-4 py-2 ${row ? 'flex-row items-center' : 'flex-col items-center gap-4'}`;
export const DIST_RING = (row: boolean) => (row ? 140 : 168);
export const DIST_LEGEND = (row: boolean) => `min-w-0 space-y-0.5 ${row ? 'flex-1' : 'w-full'}`;
/** One legend row: dot · label (gives way) · count · share. */
export const DIST_ROW = 'flex w-full items-center gap-2.5 rounded px-1.5 py-1 text-left text-[13px] transition-colors';
export const DIST_PCT = 'w-[52px] flex-shrink-0 text-right font-semibold tabular-nums text-[#364658]';

/** The BOM-type switch. Two views of one card, so it rides in the card's own header. */
export function BomSwitch<T extends string>({ value, onChange, options }: {
  value: T; onChange: (v: T) => void; options: { key: T; label: string; hint: string }[];
}) {
  return (
    <div className="inline-flex rounded border border-[#DFE5ED] p-0.5" role="tablist">
      {options.map((o) => (
        <button
          key={o.key}
          role="tab" aria-selected={value === o.key}
          onClick={() => onChange(o.key)}
          title={o.hint}
          className={`rounded-sm px-2 py-0.5 text-[11px] font-semibold transition-colors ${
            value === o.key ? 'bg-[#F1F5F9] text-[#364658]' : 'text-[#7B8FA5] hover:text-[#364658]'}`}
        >{o.label}</button>
      ))}
    </div>
  );
}

// ── card ───────────────────────────────────────────────────────────────
export function Card({ title, sub, subInfo, right, children, className = '' }: {
  title: string; sub?: string;
  /** Spelled-out version of the caption, on an info dot beside it. Separate from `sub` so the
   *  caption stays a string — that is what keeps it truncating with its own tooltip. */
  subInfo?: string;
  right?: React.ReactNode; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={`flex min-w-0 flex-col rounded-lg border border-[#E5E7EB] bg-white ${className}`}>
      {/* One line, always. The title is the card's identity and never wraps or shrinks; the
          action is fixed; the SUB is the only thing that gives way, and it truncates. In a third
          -width column the title used to wrap to two lines and take the header's height with it,
          which is the wrong thing to sacrifice — a wrapped title is harder to read than a
          shortened caption. */}
      {/* A FIXED height, not padding plus whatever the contents add up to. A card whose action is
          a ViewAll button came out ~50px and one with a bare text link ~42px, so their bodies
          started at different heights in the same row — which is what makes two donuts beside
          each other sit at different levels however their own padding is tuned. */}
      <div className="flex h-[50px] flex-shrink-0 items-center gap-2 border-b border-[#E5E7EB] px-4">
        <h3 className="flex-shrink-0 whitespace-nowrap text-[15px] font-semibold text-[#364658]">{title}</h3>
        {sub && <span className="min-w-0 truncate text-[13px] text-[#7B8FA5]" title={sub}>· {sub}</span>}
        {subInfo && <span className="flex-shrink-0"><InfoDot text={subInfo} /></span>}
        {sub && !subInfo && <span className="min-w-0 flex-1" />}
        {right && <div className="ml-auto flex-shrink-0">{right}</div>}
      </div>
      {/* A column so a child can claim the leftover height with `flex-1` — the licence chart
          centres itself in it rather than hugging the top of a card sized by its neighbour. */}
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}

/** The count pill in a card header — red once the thing it counts is overdue. */
export function HeadPill({ tone, children }: { tone: 'red' | 'amber' | 'ok' | 'neutral'; children: React.ReactNode }) {
  /* `ok` exists so a panel with nothing wrong can say so in the same slot the alarm uses. A
     header that can only ever be red or grey makes the all-clear look like missing data. */
  const s = tone === 'red' ? 'bg-[#FEF3F2] text-[#DC2626]'
    : tone === 'amber' ? 'bg-[#FEF7E6] text-[#B45309]'
    : tone === 'ok' ? 'bg-[#ECFDF3] text-[#22A06B]'
    : 'bg-[#F1F5F9] text-[#64748B]';
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[12px] font-medium ${s}`}>{children}</span>;
}

// ── KPI card ───────────────────────────────────────────────────────────
export function Kpi({ icon, tint, label, value, unit, lead, leadTone = 'red', context, pct: p, barColor, onClick }: {
  icon: React.ReactNode; tint: string; label: string; value: string; unit?: string;
  lead: React.ReactNode; leadTone?: 'red' | 'amber'; context: string;
  pct: number; barColor: string; onClick?: () => void;
}) {
  const leadClr = leadTone === 'red' ? '#DC2626' : '#B45309';
  return (
    <button
      onClick={onClick}
      className="flex min-w-0 flex-col rounded-lg border border-[#E5E7EB] bg-white px-4 py-4 text-left transition-colors hover:border-[#3D8BD0]"
    >
      <div className="flex items-center gap-2.5">
        <span className="flex size-8 flex-shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: tint }}>{icon}</span>
        <span className="truncate text-[14px] font-medium text-[#364658]">{label}</span>
      </div>
      <div className="mt-3 flex items-baseline gap-1.5">
        <span className="text-[32px] font-semibold leading-none tracking-tight text-[#364658] tabular-nums">{value}</span>
        {unit && <span className="text-[15px] font-medium text-[#7B8FA5]">{unit}</span>}
      </div>
      <div className="mt-2.5 flex items-center gap-1.5 text-[13px] font-medium" style={{ color: leadClr }}>
        <ArrowUpRight size={14} className="flex-shrink-0" />
        <span className="min-w-0 truncate">{lead}</span>
      </div>
      <div className="mt-1 truncate text-[12px] text-[#7B8FA5]">{context}</div>
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[#F1F5F9]">
        <div className="h-full rounded-full" style={{ width: `${Math.max(2, Math.min(100, p))}%`, backgroundColor: barColor }} />
      </div>
    </button>
  );
}

// ── hover card ─────────────────────────────────────────────────────────
/** One hover language for every chart on the page. */
export function ChartTip({ color, children, className = '' }: { color: string; children: React.ReactNode; className?: string }) {
  return (
    <div
      data-donut-tip
      className={`pointer-events-none absolute z-20 whitespace-nowrap rounded-lg border border-[#E5E7EB] bg-white px-3.5 py-2 shadow-lg ${className}`}
    >
      <span className="inline-flex items-center gap-2 text-[13px] text-[#7B8FA5]">
        <span className="size-2.5 flex-shrink-0 rounded-full" style={{ backgroundColor: color }} />
        <span>{children}</span>
      </span>
    </div>
  );
}

// ── donut ──────────────────────────────────────────────────────────────
/** An SVG ring drawn with stroke-dasharray — no chart library, and the arithmetic is visible.
 *  Slices under a degree still get a hairline so a 1-count licence does not vanish. A 2px gap is
 *  left between neighbours: with six slices meeting at flat butt ends, two similar colours read
 *  as one wedge, and the ring should show its parts. */
export function Donut({ slices, total, caption, size = 200, hover, onHover, onPick }: {
  slices: { label: string; value: number; color: string }[];
  total: number; caption: string; size?: number;
  hover: number | null; onHover: (i: number | null) => void;
  /** Optional: a slice is a COUNT, so picking one opens the things it counted. Without it the
   *  arcs stay hover-only — a slice you can hover but not click is a control that half-works. */
  onPick?: (i: number) => void;
}) {
  const W = Math.round(size * 0.17);
  const R = (size - W) / 2 - 2;
  const c = size / 2;
  const CIRC = 2 * Math.PI * R;
  const GAP = 2;
  let offset = 0;
  const active = hover !== null ? slices[hover] : null;
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${total} ${caption}`}>
        <circle cx={c} cy={c} r={R} fill="none" stroke="#F1F5F9" strokeWidth={W} />
        {slices.map((s, i) => {
          const frac = total > 0 ? s.value / total : 0;
          const raw = frac * CIRC;
          const len = Math.max(raw - GAP, 1.5);
          /* Everything except the hovered slice drops to a tint of itself. Dimming the rest
             rather than highlighting the one keeps the ring's shape readable. */
          const dim = hover !== null && hover !== i;
          const el = (
            <circle
              key={s.label} cx={c} cy={c} r={R} fill="none" stroke={s.color} strokeWidth={W}
              strokeDasharray={`${len} ${CIRC - len}`} strokeDashoffset={-offset}
              transform={`rotate(-90 ${c} ${c})`}
              opacity={dim ? 0.22 : 1}
              /* The pointer is offered only where a pick is wired. It used to be on every arc,
                 which promised a click the ring never answered. */
              style={{ transition: 'opacity .14s', cursor: onPick ? 'pointer' : 'default' }}
              onMouseEnter={() => onHover(i)}
              onMouseLeave={() => onHover(null)}
              onClick={onPick ? () => onPick(i) : undefined}
            ><title>{`${s.label} — ${s.value}`}</title></circle>
          );
          offset += raw;
          return el;
        })}
      </svg>

      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        {/* Three under the proportional size. In the shared component, so both rings take it
            from one place — two call sites each passing their own is how they drifted before. */}
        <span className="font-semibold leading-none text-[#364658] tabular-nums" style={{ fontSize: Math.round(size * 0.19) - 3 }}>
          {total.toLocaleString()}
        </span>
        {/* The caption drops the same 3px. It is not decoration here — it names what the figure
            counts, which is the only thing telling the SBOM and AI BOM views apart — and at 11px
            "components" was about 80px of text in the 78px chord available at its own height,
            so it sat over the ring. */}
        <span className="mt-1.5 text-[8px] uppercase tracking-wide text-[#7B8FA5]">{caption}</span>
      </div>

      {/* The sentence is ONE string with a real space in it. As sibling flex children the gap
          between "18.97%" and "(55)" would be a flex gap rather than a space — it looks the same
          on screen and copies as "18.97%(55)". */}
      {active && (
        <ChartTip color={active.color} className="left-1/2 top-[57%] -translate-x-1/2 -translate-y-1/2">
          {`${active.label}: ${pct(active.value, total)} `}
          <b className="font-semibold text-[#364658]">{`(${active.value.toLocaleString()})`}</b>
        </ChartTip>
      )}
    </div>
  );
}

// ── row helpers ────────────────────────────────────────────────────────
/** `whitespace-nowrap` and a MIN width, not a fixed one: "EOL 413d ago" does not fit 92px and was
 *  wrapping to two lines, which pushed the pill taller than its row. */
export function DayPill({ days }: { days: number }) {
  const past = days < 0;
  const tone = past || days <= 30 ? 'bg-[#FEF3F2] text-[#DC2626]'
    : days <= 120 ? 'bg-[#FEF7E6] text-[#B45309]'
    : 'bg-[#F1F5F9] text-[#64748B]';
  return (
    <span className={`inline-flex min-w-[92px] flex-shrink-0 items-center justify-center whitespace-nowrap rounded-full px-2.5 py-1 text-[12px] font-semibold tabular-nums ${tone}`}>
      {past ? `EOL ${Math.abs(days)}d ago` : `${days}d`}
    </span>
  );
}

/** `● 2 CVEs · Critical` — the one thing on a row that must be scannable without reading. */
export function SeverityBadge({ severity, cves }: { severity: string | null; cves: number }) {
  /* Nothing, rather than "No known CVE". This badge is a qualifier on the rows that carry a
     finding; stating its absence on every other row spent a label on the rows with the least to
     say and made the ones with a finding harder to spot. The panel ranks by CI reach — a missing
     badge here is not a claim that nothing was scanned. */
  if (!severity || cves === 0) return null;
  const s = SEV[severity] ?? SEV.Low;
  return (
    <span
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-sm px-2 py-0.5 text-[12px] font-medium"
      style={{ backgroundColor: s.bg, color: s.text }}
    >
      <span className="size-1.5 flex-shrink-0 rounded-full" style={{ backgroundColor: s.dot }} />
      {cves} CVE{cves === 1 ? '' : 's'} · {severity}
    </span>
  );
}

/** Deliberately small: on Dashboard 1 the exposure FIGURE is the number and this only gives it a
 *  shape. Left exactly as it was — parameterising the width would have changed Dashboard 1's
 *  markup (a `w-[72px]` class becoming an inline style) for no benefit to it. Dashboard 2, where
 *  the bar carries the ranking, uses `ExposureBar` below instead. */
/** The same reading as the bar, as a ring: how much of the estate this component sits on.
 *
 *  A ring reads as a proportion of a WHOLE at a glance — a bar of a fixed pixel width has to be
 *  compared against its own faint track to say the same thing, which is harder in a dense list.
 *  Same arithmetic, same severity ink, and the figure beside it is unchanged. */
export function ExposureRing({ pct: p, color, size = 20 }: { pct: number; color: string; size?: number }) {
  const sw = 3;
  const r = (size - sw) / 2;
  const c = 2 * Math.PI * r;
  const on = (Math.max(0, Math.min(100, p)) / 100) * c;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="flex-shrink-0" aria-hidden>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#F1F5F9" strokeWidth={sw} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={sw}
        strokeDasharray={`${on} ${c - on}`} strokeLinecap="round"
        /* Twelve o'clock, so every ring in the column starts from the same place. */
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  );
}

export function ExposureMeter({ pct: p, color }: { pct: number; color: string }) {
  return (
    <span className="inline-flex h-1 w-[72px] flex-shrink-0 overflow-hidden rounded-full bg-[#EEF2F6]" aria-hidden>
      <span className="h-full rounded-full" style={{ width: `${Math.max(2, Math.min(100, p))}%`, backgroundColor: color }} />
    </span>
  );
}

/** The full-width exposure bar. Here the bar IS the ranking device — length is how far a
 *  component reaches across the estate, and severity colours it so reach and urgency are read
 *  in one glance rather than two. */
export function ExposureBar({ pct: p, color }: { pct: number; color: string }) {
  return (
    <span className="flex h-2 w-full overflow-hidden rounded-full bg-[#EEF2F6]" aria-hidden>
      <span
        className="h-full rounded-full transition-[width]"
        style={{ width: `${Math.max(2, Math.min(100, p))}%`, backgroundColor: color }}
      />
    </span>
  );
}

/** The row's NAME is the link into its BOM. A column of identical "CBOM ›" buttons is the same
 *  control repeated and reads as chrome; the thing being opened is the row. */
export function BomLink({ name, title, onClick }: { name: string; title: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="max-w-full truncate rounded font-mono text-[13px] font-semibold text-[#364658] transition-colors hover:text-[#3D8BD0] hover:underline"
    >{name}</button>
  );
}

/** §3.1 tertiary — no chrome, brand ink. */
export function ViewAll({ onClick, label = 'View all' }: { onClick: () => void; label?: string }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1 whitespace-nowrap rounded px-1.5 py-1 text-[13px] font-medium text-[#3D8BD0] transition-colors hover:bg-[#F5FAFF]"
    >{label}<ChevronRight size={14} /></button>
  );
}

/** Open an endpoint on its BOM tab, landed on a specific BOM. Both dashboards route the same way,
 *  so the adapter lives with them rather than being written out twice. */
export const bomPatchRecord = (endpointId: string, type: BomType): Patch | null => {
  const e = mockEndpoints.find((x) => x.id === endpointId);
  if (!e) return null;
  return {
    id: e.id, name: e.hostName, severity: 'Unspecified', releaseDate: '---',
    missingSystem: null, installedSystem: null,
    rebootRequired: e.rebootRequired === 'Yes' ? 'Yes' : 'No',
    approvalStatus: 'Approved', category: 'Endpoint',
    endpoint: { agentOnline: e.agentOnline, systemHealth: e.systemHealth },
    bomMode: true, bomInitialType: type,
  };
};

/* ═══════════════════════════════════════════════════════════════════════
   The attention-first widgets.

   Built for Dashboard 2 and then adopted by Dashboard 1, so they live here rather than in either
   page: two dashboards showing the same KPI row from two copies is precisely how the toolbars and
   the tab lists drifted apart earlier in this module's life.
   ═══════════════════════════════════════════════════════════════════════ */

/** ONE severity/threshold scale, mapped onto the product's status triples rather than invented per
 *  panel: danger for Critical, warn for High and Medium at two weights, neutral for Low. */
/* One order for the strip and for the words that describe it — two lists is how a strip and
   its own aria-label start disagreeing. */
export const SEVERITY_ORDER = ['Critical', 'High', 'Medium', 'Low'] as const;

export const SEVERITY: Record<string, { ink: string; bg: string; bar: string }> = {
  Critical: { ink: '#DC2626', bg: '#FEF3F2', bar: '#DC2626' },
  High: { ink: '#D97706', bg: '#FEF7E6', bar: '#D97706' },
  Medium: { ink: '#B45309', bg: '#FEF7E6', bar: '#F59E0B' },
  Low: { ink: '#64748B', bg: '#F1F5F9', bar: '#94A3B8' },
};
export const OK_INK = '#22A06B';
export const NEUTRAL_INK = '#64748B';
export const sev = (s: string | null) =>
  (s ? SEVERITY[s] ?? SEVERITY.Low : { ink: NEUTRAL_INK, bg: '#F1F5F9', bar: '#94A3B8' });

/** Urgency uses the SAME triples, so red means "act now" everywhere on the page. */
export const BAND = {
  critical: { ink: '#DC2626', bg: '#FEF3F2' },
  upcoming: { ink: '#D97706', bg: '#FEF7E6' },
  later: { ink: '#64748B', bg: '#F1F5F9' },
} as const;
export const bandFor = (n: number): keyof typeof BAND => (n <= 30 ? 'critical' : n <= 120 ? 'upcoming' : 'later');

export function InfoDot({ text }: { text: string }) {
  const [on, setOn] = useState(false);
  return (
    <span className="relative inline-flex">
      {/* A span, not a button: this sits inside a clickable stat, and a button nested in a button
          is invalid DOM — React says so out loud and the inner one swallows the click. */}
      <span
        role="img" tabIndex={0} aria-label={text}
        onMouseEnter={() => setOn(true)} onMouseLeave={() => setOn(false)}
        onFocus={() => setOn(true)} onBlur={() => setOn(false)}
        className="inline-flex cursor-help text-[#9CA3AF] transition-colors hover:text-[#3D8BD0]"
      ><Info size={13} /></span>
      {on && (
        <span className="absolute left-1/2 top-full z-30 mt-1.5 w-[230px] -translate-x-1/2 rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-[12px] leading-relaxed text-[#364658] shadow-lg">
          {text}
        </span>
      )}
    </span>
  );
}

/** Absence is stated, never implied — a panel with nothing wrong says so. */
export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-1.5 px-4 py-10 text-center">
      <CheckCircle2 size={20} style={{ color: OK_INK }} />
      <span className="text-[13px] font-medium text-[#364658]">{children}</span>
    </div>
  );
}

/* MeterBar and SeveritySplit were removed with the tall card that used them: a bar with no
   denominator, and a strip whose legend spent a third line restating its own segments. The KPI
   grammar's KpiSplit replaced the second; the first had nothing to replace it WITH, which was
   the point. */

/** The three estate-health cards, as instances of the shared KPI grammar (BomKpiCard).
 *
 *  They used to be a card component of their own — `Kpi2` — five stacked lines tall, with the
 *  action pinned to the bottom. The grammar is two lines: what this is, then the figure with its
 *  qualifier, its distribution and its context on ONE row. One component for every KPI card in
 *  the module, because two components is how the dashboard and the register ended up with cards
 *  of different heights.
 */
export function EstateKpis({ d, onNavigate }: {
  d: BomDashboard; onNavigate: BomNavigate;
}) {
  const chip = d.eolChip;
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {/* 1 · Components discovered. No chip and no visual: there is no qualifier that matters
             more than the rest, and nothing for a bar to be a proportion of. The blue full-width
             bar that used to sit here measured exactly that — nothing. */}
      <BomKpiCard
        icon={<Layers size={16} />}
        title="Components discovered"
        action={{ label: 'View all', onClick: () => onNavigate('software-components') }}
      >
        <KpiValue value={d.declared} />
        {/* One fact, not three. `{d.unique} versions` left with them — that was this card's
            denominator, and it now lives only as the licence ring's centre figure. */}
        <KpiContext>across {d.ciCount} CIs</KpiContext>
      </BomKpiCard>

      {/* 2 · Vulnerabilities identified. The number IS the exception, so it takes the colour; the
             chip names the worst slice of it; the strip is the mix of the same nine. */}
      <BomKpiCard
        icon={<ShieldAlert size={16} />}
        title="Vulnerabilities identified"
        /* The only link on this row that CAN carry its selection, and the reason the second
           argument exists. "Review" now lands on the register already showing "Vulnerable only"
           - the same chip the register's own Vulnerabilities card sets, so arriving from here
           and pressing that card leave the page in ONE state rather than two.

           Its neighbours deliberately do not carry one. "View all" on card 1 means everything,
           so a filter would contradict the label. Card 3 goes to Configuration Items because the
           AI models it counts are read per CI; the AI register is a DIFFERENT population (14
           models here against 29 rows there, 3 past EOL against 7), so handing it "past EOL"
           would quote a number the destination cannot show. */
        action={{ label: 'Review', onClick: () => onNavigate('software-components', 'vulnerable') }}
      >
        <KpiValue value={d.cveIds.length} tone={d.cveIds.length ? 'danger' : 'neutral'} />
        {d.cveIds.length === 0 ? (
          /* Zero state: neither an empty coloured strip nor a red nought — a stated all-clear. */
          <KpiChip tone="ok">none open</KpiChip>
        ) : (
          <>
            {d.cveBySeverity.Critical > 0 && (
              <KpiChip tone="danger">{d.cveBySeverity.Critical} critical</KpiChip>
            )}
            <KpiSplit
              segments={SEVERITY_ORDER.map((k) => ({ key: k, n: d.cveBySeverity[k] ?? 0, color: SEVERITY[k].bar }))}
              label={SEVERITY_ORDER
                .filter((k) => (d.cveBySeverity[k] ?? 0) > 0)
                .map((k) => `${d.cveBySeverity[k]} ${k.toLowerCase()}`)
                .join(', ')}
            />
          </>
        )}
        <KpiContext>{d.vulnerableCis}/{d.ciCount} CIs</KpiContext>
      </BomKpiCard>

      {/* 3 · Deprecated AI models. The chip is computed — see `eolModelChip` — because "3 past
             end-of-life" is an alarm only when they are actually deployed somewhere. */}
      <BomKpiCard
        icon={<Bot size={16} />}
        title="Deprecated AI models"
        /* The AI BOM has no register of its own — models live per CI, so the inventory is where
           every one of them is reachable. */
        action={{ label: 'View all', onClick: () => onNavigate('bom') }}
      >
        <KpiValue
          value={d.modelsPastEol}
          of={d.modelTotal}
          /* Urgency only when something unsupported is RUNNING; an undeployed dead model is
             cleanup, and colouring it would spend the alarm on housekeeping. */
          tone={chip.urgent ? 'danger' : 'neutral'}
        />
        <KpiChip tone={chip.tone}>{chip.label}</KpiChip>
        <KpiContext>{d.eolModelCis}/{d.ciCount} CIs</KpiContext>
      </BomKpiCard>
    </div>
  );
}

/* -- AI model lifecycle -----------------------------------------------
   One axis, centred on end-of-life: the past extends left, the supported future extends right,
   and every bar is drawn on the SAME scale. That is the whole reason this replaced the previous
   panel — there, a red bar's length meant "how far past EOL" and a grey bar's meant "how much
   life is left", so comparing two lengths down the column produced nonsense.

   The domain is FIXED, not fitted to the data. Fitting it to the worst model lets one ancient
   artefact squeeze every other bar into a sliver, and re-scales the whole panel each time the
   estate changes. Anything outside it clamps to the edge and says so in its own label. */
export const EOL_PAST = 450;
export const EOL_FUTURE = 180;
const EOL_SPAN = EOL_PAST + EOL_FUTURE;
/** Where end-of-life sits across the plot. Every position on the panel derives from this. */
export const EOL_CENTRE = (EOL_PAST / EOL_SPAN) * 100;
export const eolClamp = (days: number) => Math.max(-EOL_PAST, Math.min(EOL_FUTURE, days));
/** A day count's position on the axis, 0-100 across the plot. */
export const eolAt = (days: number) => ((eolClamp(days) + EOL_PAST) / EOL_SPAN) * 100;
/** Bar length: |days| on that same scale, so 413d over is three times 139d over. */
export const eolWidth = (days: number) => (Math.abs(eolClamp(days)) / EOL_SPAN) * 100;

/* One template for the header, every row, the centre rule and the ticks — they align because
   they are literally the same grid, not because three numbers were kept in step by hand. */
const EOL_GRID = 'grid grid-cols-[170px_minmax(0,1fr)] gap-3';
/* The plot is inset inside its column so the labels at the extremes have somewhere to sit: a bar
   clamped hard against the left edge still needs room to say "900d over" beside it. */
const EOL_PLOT = 'absolute inset-y-0 left-[62px] right-[62px]';

/** The lifecycle chart: one row per model, one shared axis, end-of-life as the spine.
 *
 *  Day labels sit OUTSIDE their bar, adjacent to its far end, in the bar's own semantic ink —
 *  not white-on-fill inside it. Inside, the text fails contrast on all three fills (white on
 *  #DC2626 is 4.0:1, under AA at this size), and a short bar would have to overflow itself to
 *  stay readable. Outside, the number is legible at every bar length and the bar stays geometry.
 */
export function EolTimeline({ models, onOpen }: {
  models: EolModel[]; onOpen: (m: EolModel) => void;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const sumId = useId();
  const nPast = models.filter((m) => m.past).length;
  const nSoon = models.filter((m) => !m.past && m.days <= EOL_FUTURE).length;
  /* The chart's reading, for anyone who cannot see it. Same figures, same snapshot — including
     the omission: the unplotted models are named on neither, so the two audiences match. */
  const summary = `${nPast} model${nPast === 1 ? '' : 's'} past end-of-life, `
    + `${nSoon} approaching within ${EOL_FUTURE} days`;

  return (
    <div className="px-4 pb-3 pt-3">
      {/* Zone labels. Which half of the axis you are looking at, before any row is read. */}
      <div className={EOL_GRID}>
        <div />
        <div className="relative h-4">
          <div className={EOL_PLOT}>
            <span className="absolute left-0 top-0 whitespace-nowrap text-[11px] uppercase tracking-wide text-[#9CA3AF]">&#9664; Past end-of-life</span>
            <span
              className="absolute top-0 -translate-x-1/2 text-[11px] font-semibold uppercase tracking-wide text-[#64748B]"
              style={{ left: `${EOL_CENTRE}%` }}
            >EOL</span>
            <span className="absolute right-0 top-0 whitespace-nowrap text-[11px] uppercase tracking-wide text-[#9CA3AF]">Supported &#9654;</span>
          </div>
        </div>
      </div>

      <div className="relative mt-1" role="group" aria-labelledby={sumId}>
        <p id={sumId} className="sr-only">{summary}</p>

        {/* The end-of-life line, drawn ONCE through every row rather than per row — it is one
            axis, and a rule that restarts at each row reads as a row ornament. */}
        <div className={`pointer-events-none absolute inset-0 ${EOL_GRID}`} aria-hidden>
          <div />
          <div className="relative">
            <div className={EOL_PLOT}>
              <span className="absolute inset-y-0 w-[1.5px] -translate-x-1/2 bg-[#DFE5ED]" style={{ left: `${EOL_CENTRE}%` }} />
            </div>
          </div>
        </div>

        {models.map((m, i) => {
          /* "gpt-4o (loan-assist API)" is a model plus the thing it was deployed for. The name is
             what identifies it; the parenthetical is context and is demoted to match. */
          const par = /^(.*?)\s*\(([^)]*)\)\s*$/.exec(m.name);
          const base = par ? par[1] : m.name;
          const suffix = par ? par[2] : '';
          const over = Math.abs(m.days);
          const clamped = m.days < -EOL_PAST || m.days > EOL_FUTURE;
          /* 90 days is the amber threshold: a quarter is the shortest notice on which a model can
             realistically be retrained or swapped. */
          const ink = m.past ? URGENT : m.days <= 90 ? SOON : LATER;
          const bar: React.CSSProperties = m.past
            ? { right: `${100 - EOL_CENTRE}%`, backgroundImage: 'linear-gradient(90deg, #DC2626 0%, #EF4444 100%)' }
            : { left: `${EOL_CENTRE}%`, backgroundColor: m.days <= 90 ? '#F59E0B' : '#E5E7EB' };
          const label = m.past ? `${clamped ? '\u25b8 ' : ''}${over}d over` : `${over}d left${clamped ? ' \u25b8' : ''}`;
          const on = hover === m.key;
          /* What is left of `detail` once the two facts stated as fields are taken out of it: the
             flags. "no model card", "pickle-import risk" — the part that is a finding. */
          const flags = m.detail.split(' · ').filter((x) => x !== m.sourceLabel && x !== m.provider);
          /* The last rows open their card upwards, or it would fall out of the card. */
          const up = i >= models.length - 2;

          return (
            <div key={m.key} className="relative">
              <button
                onClick={() => onOpen(m)}
                onMouseEnter={() => setHover(m.key)} onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(m.key)} onBlur={() => setHover(null)}
                aria-label={`${m.name}, ${over} days ${m.past ? 'past end-of-life' : 'remaining before end-of-life'}`}
                className={`${EOL_GRID} w-full items-center rounded py-1.5 text-left transition-colors hover:bg-[#F9FAFB] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3D8BD0]`}
              >
                <span className="flex min-w-0 items-baseline gap-1.5">
                  <span className="truncate font-mono text-[12.5px] font-medium text-[#364658]">{base}</span>
                  {suffix && <span className="min-w-0 truncate text-[11px] text-[#9CA3AF]">{suffix}</span>}
                </span>

                <span className="relative block h-4">
                  <span className={EOL_PLOT}>
                    <span
                      className={`absolute top-1/2 block h-4 -translate-y-1/2 ${m.past ? 'rounded-l-full' : 'rounded-r-full'}`}
                      style={{
                        ...bar,
                        width: `${eolWidth(m.days)}%`,
                        /* A floor, so a model days from EOL is still a mark and not nothing. */
                        minWidth: 3,
                        /* Clamped: the bar runs off the axis, so its far end is cut to a point. A
                           tidy rounded cap would say it stops there, and it does not. */
                        ...(clamped ? { clipPath: m.past
                          ? 'polygon(7px 0, 100% 0, 100% 100%, 7px 100%, 0 50%)'
                          : 'polygon(0 0, calc(100% - 7px) 0, 100% 50%, calc(100% - 7px) 100%, 0 100%)' } : {}),
                      }}
                    />
                    <span
                      className="absolute top-1/2 -translate-y-1/2 whitespace-nowrap text-[11px] font-semibold tabular-nums"
                      style={{
                        ...(m.past
                          ? { right: `calc(${100 - eolAt(m.days)}% + 6px)` }
                          : { left: `calc(${eolAt(m.days)}% + 6px)` }),
                        color: ink,
                      }}
                    >{label}</span>
                  </span>
                </span>
              </button>

              {/* The evidence behind the bar: the published date, the reading, the reach, the
                  supplier. Opens on hover AND on focus, so it is reachable without a mouse. */}
              {on && (
                <div
                  className={`pointer-events-none absolute left-[182px] z-20 max-w-[320px] rounded border border-[#E5E7EB] bg-white px-2.5 py-2 text-[11px] leading-relaxed text-[#364658] shadow-md ${up ? 'bottom-full mb-1' : 'top-full mt-1'}`}
                >
                  <div className="font-mono font-semibold">{m.name}</div>
                  <div>
                    EOL <span className="tabular-nums">{m.eol}</span> ·{' '}
                    <span style={{ color: ink }} className="font-semibold tabular-nums">{over} days</span>{' '}
                    {m.past ? 'past end-of-life' : 'remaining'}
                  </div>
                  <div className="text-[#7B8FA5]">
                    <span className="tabular-nums">{m.cis}</span> CI{m.cis === 1 ? '' : 's'} running it · {m.provider} · {m.sourceLabel}
                  </div>
                  {flags.length > 0 && <div className="text-[#B45309]">{flags.join(' · ')}</div>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* The scale, stated. A bar is a measurement only if something says what it is measured in. */}
      <div className={`${EOL_GRID} mt-1`}>
        <div />
        <div className="relative h-4">
          <div className={EOL_PLOT}>
            {[-365, -180, 0, 180].map((t) => (
              <span
                key={t}
                className="absolute top-0 -translate-x-1/2 whitespace-nowrap text-[11px] tabular-nums text-[#9CA3AF]"
                style={{ left: `${eolAt(t)}%` }}
              >{t === 0 ? '0' : t === -365 ? '\u22121y' : t < 0 ? `\u2212${Math.abs(t)}d` : `+${t}d`}</span>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}

/** Managed paths — the scan scopes across the estate, as a distribution.
 *
 *  It answers "what is the agent actually being asked to walk", which a list of products does
 *  not: the same 89 paths are a fast targeted scan or a filesystem crawl depending entirely on
 *  the shape of each path, and nothing else on the dashboard says which.
 *
 *  Same anatomy as the licence card beside it — donut, legend, one sentence — because they are
 *  the same KIND of reading and drawing them differently would imply they were not.
 */
export function ManagedPathsCard({ d, onNavigate, layout = 'stack' }: {
  d: BomDashboard; onNavigate: BomNavigate; layout?: 'stack' | 'row';
}) {
  const [hover, setHover] = useState<number | null>(null);
  /* The same prop, the same two shapes and the same measurements as the licence card beside it.
     "Match the other pie" is only true if it stays true at every column width, which means taking
     the layout as an argument rather than picking one. */
  const row = layout === 'row';
  /* By product, not by scope. The paths are the same 89; what the ring answers is now "whose
     product declared this" rather than "what kind of path is it". */
  const slices = d.pathProducts.map((p) => ({ label: p.product, value: p.paths, color: p.color }));

  return (
    <Card
      /* The CI count was the one fact in the removed footer that the donut does not already
         state — the ring's own centre carries the path total. */
      title="Managed paths" sub={`across ${d.pathCis} CIs`}
      right={<ViewAll label="View all CIs" onClick={() => onNavigate('bom')} />}
    >
      <div className={DIST_BLOCK(row)}>
        <Donut
          slices={slices} total={d.pathTotal} caption="paths" size={DIST_RING(row)}
          hover={hover} onHover={setHover}
        />
        <div className={DIST_LEGEND(row)}>
          {d.pathProducts.map((p, i) => (
            <div
              key={p.product}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              className={`${DIST_ROW} ${hover === i ? 'bg-[#F9FAFB]' : ''}`}
            >
              <span className="size-2.5 flex-shrink-0 rounded-full" style={{ backgroundColor: p.color }} />
              {/* The CI count is on the row's tooltip rather than in a fourth column: the paths
                  and their share are what the ring is a picture OF, and how many machines they
                  land on is the follow-up question. */}
              <span
                className="min-w-0 flex-1 truncate text-[#364658]"
                title={`${p.product} — ${p.paths} declared path${p.paths === 1 ? '' : 's'} across ${p.cis} CI${p.cis === 1 ? '' : 's'}`}
              >{p.product}</span>
              <span className="flex-shrink-0 tabular-nums text-[#7B8FA5]">{p.paths}</span>
              <span className={DIST_PCT}>{pct(p.paths, d.pathTotal)}</span>
            </div>
          ))}
        </div>
      </div>

    </Card>
  );
}

/** Distribution — the risk states lead, the distribution is context underneath.
 *
 *  Two views of one card, switched by BOM type — SBOM and AI BOM. They share an anatomy on
 *  purpose: a ring and a legend. A reader who has learned to read one has learned the other, and
 *  the two cannot report their totals differently because the same arithmetic in
 *  `bomDashboardData` produces both, over the two populations.
 *
 *  `layout` is a prop rather than a breakpoint because the two dashboards put this card in
 *  columns of different widths at the SAME viewport size — a media query cannot tell those apart,
 *  and guessing leaves one of them wrong.
 */
const UNDECLARED_HINT = 'A blank licence is not a safe licence — it means we do not know.';
/* An AI component's terms are the register's own reading (`licenseRisk`), so the note a slice
   carries is that judgement spelled out rather than a second opinion formed here. */
const AI_RISK_HINT: Record<AiRisk, string | null> = {
  HIGH: 'high licence risk — restrictive or unattested terms, worth a legal review',
  MEDIUM: 'medium licence risk — usable, but the terms are contractual rather than open',
  LOW: null,
};

export function LicenceDistributionCard({ d, onNavigate, layout = 'stack' }: {
  d: BomDashboard; onNavigate: BomNavigate; layout?: 'stack' | 'row';
}) {
  const [hover, setHover] = useState<number | null>(null);
  const [view, setView] = useState<'sbom' | 'aibom'>('sbom');
  const row = layout === 'row';
  const ai = view === 'aibom';

  /* Undeclared licences are grey rather than a palette colour — "we do not know" is not one more
     kind of licence. Both views grey theirs: the AI register spells the same absence 'Unknown'. */
  const rows = ai
    ? d.aiLicences.map((l, i) => ({
      key: l.licence, label: l.licence, count: l.count,
      color: l.licence === 'Unknown' ? '#CBD5E1' : SLICE[i % SLICE.length],
      note: l.licence === 'Unknown' ? `not declared by the supplier — ${UNDECLARED_HINT}`
        : AI_RISK_HINT[l.risk],
    }))
    : d.licences.map((l, i) => ({
      key: l.licence, label: l.licence, count: l.count,
      color: l.policy === 'undeclared' ? '#CBD5E1' : SLICE[i % SLICE.length],
      note: l.policy === 'undeclared' ? `not declared by the supplier — ${UNDECLARED_HINT}`
        : l.policy === 'denied' ? 'denied by policy'
          : l.policy === 'restricted' ? 'restricted — worth a legal review' : null,
    }));
  const total = ai ? d.aiLicenceTotal : d.licenceTotal;

  /* A slice is a count, and picking one goes to the list it counted — the register, filtered to
     that licence, with the licence named in its search box. It used to open a drawer here; the
     drawer existed because the register listed a 12-row fixture and could not have shown these
     rows. It lists the reconciled inventory now, so the slice can simply be a link and there is
     one place a component list lives.

     Both views, and each to its OWN register: the AI ring is counted from `aiAssets()`, which is
     exactly what the AI Components page lists. */
  const pick = (key: string) =>
    onNavigate(ai ? 'ai-components' : 'software-components', `licence:${key}`);

  return (
    <Card
      /* One heading, and now it is true of both views: an AI component is licensed too. The
         ring's own caption ("29 AI components" against "711 components") and the switch are what
         say which of the two populations you are looking at. */
      title="Licence distribution"
      /* View all follows the view. It used to land on the software register from both, which in
         the second view sent you to a list that did not contain what you had just clicked. */
      right={<ViewAll onClick={() => onNavigate(ai ? 'ai-components' : 'software-components')} />}
    >

      <div className={DIST_BLOCK(row)}>
        {/* Out of flow, in the corner the centred ring leaves empty. In flow it would push the
            ring down by its own height, and the ring on the card beside it would not follow. */}
        <div className="absolute left-4 top-2 z-10">
          <BomSwitch
            value={view} onChange={setView}
            options={[
              { key: 'sbom' as const, label: 'SBOM', hint: 'Licences across the software components' },
              { key: 'aibom' as const, label: 'AI BOM', hint: 'Licences across the AI components — models, frameworks, vector stores and datasets each ship under their own terms' },
            ]}
          />
        </div>
        <Donut
          total={total} caption={ai ? 'AI components' : 'components'} size={DIST_RING(row)}
          hover={hover} onHover={setHover}
          onPick={(i) => pick(rows[i].key)}
          slices={rows.map((r) => ({ label: r.label, value: r.count, color: r.color }))}
        />
        <div className={DIST_LEGEND(row)} onMouseLeave={() => setHover(null)}>
          {rows.map((r, i) => {
            /* The legend row and the arc are one control in two places — they already shared a
               hover state, so they share the pick too. */
            return (
            <button
              key={r.key}
              onMouseEnter={() => setHover(i)}
              onClick={() => pick(r.key)}
              /* What a slice's colour cannot carry — the ring is a MIX, and tinting more than
                 half of it one danger red would make it a block rather than a mix. */
              title={r.note ? `${r.label} — ${r.note}` : r.label}
              className={`${DIST_ROW} hover:bg-[#F9FAFB]`}
              style={{ opacity: hover !== null && hover !== i ? 0.45 : 1 }}
            >
              <span className="size-2.5 flex-shrink-0 rounded-full" style={{ backgroundColor: r.color }} />
              <span className="min-w-0 flex-1 truncate text-[#364658]">{r.label}</span>
              <span className="flex-shrink-0 tabular-nums text-[#7B8FA5]">{r.count}</span>
              <span className={DIST_PCT}>{pct(r.count, total)}</span>
            </button>
            );
          })}
        </div>
      </div>
    </Card>
  );
}

/* ── Expiring trust material, as a timeline ───────────────────────────────
 *
 * A list of the five soonest certificates answered "what is next" and nothing else. The estate's
 * real question is a shape: is the next quarter clear, or is everything landing in one week? So
 * every tracked certificate is a dot on a 180-day rule, positioned by when it expires and sized by
 * how many CIs it would take down.
 *
 * The bands are the same windows the chips count, derived once in `bomDashboardData` — chips, band
 * tints and dot colours cannot disagree about which window a certificate is in.
 *
 * An empty window is information too ("nothing this week"), which a top-5 list could never show:
 * it has no way to say that the thing you are looking for is not there.
 */

const CERT_BAND_TINT: Record<string, { fill: string; dot: string; ink: string; chip: string }> = {
  week: { fill: '#FEF2F2', dot: '#DC2626', ink: '#B42318', chip: '#FEE2E2' },
  d30: { fill: '#FEF2F2', dot: '#EF4444', ink: '#B42318', chip: '#FEE2E2' },
  d120: { fill: '#FFFBEB', dot: '#F59E0B', ink: '#92400E', chip: '#FDE9B5' },
  d180: { fill: '#F8FAFC', dot: '#94A3B8', ink: '#364658', chip: 'transparent' },
  beyond: { fill: '#F8FAFC', dot: '#CBD5E1', ink: '#7B8FA5', chip: 'transparent' },
};

/** Which window a day-count falls in — one rule, used by the chip counts and by every dot. */
export const certBandOf = (days: number): keyof typeof CERT_BAND_TINT =>
  (days <= 7 ? 'week' : days <= 30 ? 'd30' : days <= 120 ? 'd120' : days <= 180 ? 'd180' : 'beyond');

/* Six weeks. A renewal is scheduled inside this window; beyond it the timeline was mostly empty
   rule with everything urgent crushed into its first eighth. What falls outside is not lost — the
   band chips above carry the full distribution, including the 236 beyond 180 days. */
const SPAN = 45;

export function CertTimeline({ certs, total, onOpen }: {
  certs: { key: string; name: string; serves: string; days: number; cis: number; ciId: string; detail: string; quantumVulnerable: boolean }[];
  total: number;
  onOpen: (key: string) => void;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const plotted = certs.filter((c) => c.days <= SPAN);
  const beyond = certs.length - plotted.length;
  const at = (days: number) => `${Math.max(1.5, Math.min(98.5, (days / SPAN) * 100))}%`;

  /* ONE dot per day, not per certificate. Ten certificates expiring on the same day were ten
     buttons on the same pixel: the last one painted was the only one you could hover, and the
     other nine were unreachable — a crowd hiding its own members. The group is the target now,
     and its hover card lists what is in it. */
  const byDay = new Map<number, typeof plotted>();
  for (const c of [...plotted].sort((a, b) => a.days - b.days || a.name.localeCompare(b.name))) {
    if (!byDay.has(c.days)) byDay.set(c.days, []);
    byDay.get(c.days)!.push(c);
  }
  const groups = [...byDay.entries()]
    .map(([days, list]) => ({
      days,
      list,
      /* Size carries blast radius: a wildcard on 22 CIs is a different morning from one on 2.
         For a group it is the CIs the whole day would take out. */
      cis: list.reduce((n, c) => n + c.cis, 0),
      /* The worst window in the group — a day holding one red and three amber is a red day. */
      band: certBandOf(Math.min(...list.map((c) => c.days))),
    }))
    .sort((a, b) => a.days - b.days);
  const size = (cis: number) => Math.round(8 + Math.min(cis, 24) * 0.5);

  const bands: { key: keyof typeof CERT_BAND_TINT; from: number; to: number }[] = [
    { key: 'week', from: 0, to: 7 },
    { key: 'd30', from: 7, to: 30 },
    { key: 'd120', from: 30, to: SPAN },
  ];

  return (
    /* Claims the leftover height and centres in it, so the card is never a timeline with a dead
       band under it — the air goes around the thing being read. */
    <div className="flex flex-1 flex-col justify-center px-4 pb-3 pt-4">
      <div className="relative h-[82px]">
        {/* A count above every group that holds more than one — a single dot states itself.
            The per-zone counts that briefly sat above this row are gone: they cost the strip
            14px for two figures the band chips above the timeline already carry. */}
        {groups.filter((g) => g.list.length > 1).map((g) => (
          <span
            key={`n${g.days}`}
            className="absolute top-[22px] -translate-x-1/2 text-[12px] font-semibold tabular-nums text-[#364658]"
            style={{ left: at(g.days) }}
          >{g.list.length}</span>
        ))}

        {/* the rule */}
        <div className="absolute inset-x-0 top-[40px] flex h-8 overflow-hidden rounded-[3px]">
          {bands.map((b) => (
            <span key={b.key} style={{ width: `${((b.to - b.from) / SPAN) * 100}%`, backgroundColor: CERT_BAND_TINT[b.key].fill }} />
          ))}
        </div>
        <div className="absolute inset-x-0 top-[72px] h-px bg-[#E5E7EB]" />

        {groups.map((g) => {
          const d = size(g.cis);
          const one = g.list.length === 1;
          return (
            <button
              key={g.days}
              /* A group of one opens that certificate; a group of many has no single thing to
                 open, so it opens the worst of them — the one its colour is already reporting. */
              onClick={() => onOpen(g.list[0].key)}
              onMouseEnter={() => setHover(g.days)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(g.days)}
              onBlur={() => setHover(null)}
              className="absolute top-[56px] -translate-x-1/2 -translate-y-1/2 rounded-full transition-transform hover:scale-125 focus-visible:scale-125 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3D8BD0]"
              style={{ left: at(g.days), width: d, height: d, backgroundColor: CERT_BAND_TINT[g.band].dot }}
              aria-label={one
                ? `${g.list[0].name}, expires in ${g.days} days, on ${g.list[0].cis} CIs`
                : `${g.list.length} certificates expire in ${g.days} days, on ${g.cis} CIs: ${g.list.map((c) => c.name).join(', ')}`}
            />
          );
        })}

        {/* The hovered group, in the strip's own space — a floating tooltip would cover the
            neighbours you are comparing it against. A crowded day lists what is in it, capped so
            the card cannot be pushed open by a bad week. */}
        {hover !== null && (() => {
          const g = groups.find((x) => x.days === hover);
          if (!g) return null;
          /* Eight, not four. A batch of seven certificates cut on the same day is the case this
             card exists for, and at four it answered it with "+3 more on this day" — which is
             the question, not the answer. The cap stays so one bad week cannot push the card
             open past the strip. */
          const SHOWN = 8;
          const rest = g.list.length - SHOWN;
          /* Anchored so a group near either end stays inside the card. */
          const pos = (g.days / SPAN) * 100;
          const align = pos < 25 ? 'translate-x-0' : pos > 75 ? '-translate-x-full' : '-translate-x-1/2';
          return (
            <div
              className={`pointer-events-none absolute top-0 z-10 min-w-[180px] max-w-[260px] rounded border border-[#E5E7EB] bg-white px-2 py-1.5 text-[11px] text-[#364658] shadow-md ${align}`}
              style={{ left: at(g.days) }}
            >
              <div className="font-semibold">
                {g.days}d · {g.list.length === 1 ? '1 certificate' : `${g.list.length} certificates`} · {g.cis} systems
              </div>
              <div className="mt-1 space-y-0.5">
                {g.list.slice(0, SHOWN).map((c) => (
                  <div key={c.key} className="flex items-baseline justify-between gap-2">
                    <span className="min-w-0 truncate">{c.serves}</span>
                    <span className="flex-shrink-0 tabular-nums text-[#7B8FA5]">{c.cis}</span>
                  </div>
                ))}
                {rest > 0 && <div className="text-[#7B8FA5]">+{rest} more on this day</div>}
              </div>
            </div>
          );
        })()}
      </div>

      <div className="relative mt-2 h-4">
        {[0, 7, 15, 30, 45].map((d) => (
          <span key={d} className="absolute -translate-x-1/2 text-[11px] text-[#9CA3AF]" style={{ left: at(d) }}>
            {d === 0 ? 'now' : `${d}d`}
          </span>
        ))}
      </div>

      {/* The caption went. What it said about dots and hovering is discoverable by hovering; what
          it said about the total is already in the header. The one thing it was carrying that
          nothing else does is what the 45-day rule leaves OUT — so that is what stays. */}
      {beyond > 0 && (
        <p className="mt-2 text-[12px] text-[#9CA3AF]">
          <span className="tabular-nums">{beyond}</span> more expire beyond 45 days.
        </p>
      )}
    </div>
  );
}

/** The five rotation windows as chips. Empty ones stay, quietly — "nothing this week" is an
 *  answer, and a chip that disappears when it hits zero can only ever report bad news. */
export function CertBands({ bands }: { bands: { key: string; label: string; count: number }[] }) {
  return (
    /* Five equal columns, not a wrapping row. They are one scale read left to right — this week
       through beyond-180 — and a wrap put the last window on its own line, which read as a
       separate reading rather than the far end of the same one. A grid also keeps the five the
       same width whatever their labels say, so the row stays a scale and not five chips of
       assorted sizes. */
    <div className="grid grid-cols-5 items-stretch gap-1.5 px-4 pt-3">
      {bands.map((b) => {
        const t = CERT_BAND_TINT[b.key] ?? CERT_BAND_TINT.beyond;
        const tinted = t.chip !== 'transparent';
        return (
          <div
            key={b.key}
            className={`min-w-0 rounded-md py-1.5 ${tinted ? 'px-2' : 'px-1'}`}
            style={tinted ? { backgroundColor: t.chip } : undefined}
            title={`${b.count} · ${b.label}`}
          >
            <div className="text-[17px] font-semibold leading-none tabular-nums" style={{ color: t.ink }}>{b.count}</div>
            {/* The label truncates rather than wrapping: a two-line label makes its own chip
                taller than the other four and breaks the row's baseline. The full text is on the
                cell's title. */}
            <div className="mt-1 truncate text-[11.5px] leading-tight" style={{ color: t.ink }}>{b.label}</div>
          </div>
        );
      })}
    </div>
  );
}
