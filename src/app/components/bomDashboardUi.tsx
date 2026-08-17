import { useState } from 'react';
import { ChevronRight, ArrowUpRight, ArrowRight, Info, CheckCircle2, Layers, ShieldAlert, Bot } from 'lucide-react';
import { mockEndpoints } from './EndpointsListPage';
import type { LicencePolicy, BomDashboard } from './bomDashboardData';
import type { Patch } from './PatchesListPage';
import type { BomType } from './bomData';

/* Shared chrome for the BOM dashboards.
 *
 * Lifted out of BomDashboardPage verbatim when Dashboard 2 arrived — two dashboards drawing the
 * same card, pill and severity badge from two copies is how they drift apart, and this module has
 * already paid for that lesson twice (the Scheduler/Licensing toolbars, the two tab lists).
 * Nothing here computes anything: the figures come from `bomDashboardData`, these only draw.
 */

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

// ── card ───────────────────────────────────────────────────────────────
export function Card({ title, sub, right, children, className = '' }: {
  title: string; sub?: string; right?: React.ReactNode; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={`flex min-w-0 flex-col rounded-lg border border-[#E5E7EB] bg-white ${className}`}>
      <div className="flex items-center gap-2 border-b border-[#E5E7EB] px-4 py-3">
        <h3 className="text-[15px] font-semibold text-[#364658]">{title}</h3>
        {sub && <span className="truncate text-[13px] text-[#7B8FA5]">· {sub}</span>}
        {right && <div className="ml-auto flex-shrink-0">{right}</div>}
      </div>
      {/* A column so a child can claim the leftover height with `flex-1` — the licence chart
          centres itself in it rather than hugging the top of a card sized by its neighbour. */}
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}

/** The count pill in a card header — red once the thing it counts is overdue. */
export function HeadPill({ tone, children }: { tone: 'red' | 'amber' | 'neutral'; children: React.ReactNode }) {
  const s = tone === 'red' ? 'bg-[#FEF3F2] text-[#DC2626]'
    : tone === 'amber' ? 'bg-[#FEF7E6] text-[#B45309]'
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
export function Donut({ slices, total, caption, size = 200, hover, onHover }: {
  slices: { label: string; value: number; color: string }[];
  total: number; caption: string; size?: number;
  hover: number | null; onHover: (i: number | null) => void;
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
              style={{ transition: 'opacity .14s', cursor: 'pointer' }}
              onMouseEnter={() => onHover(i)}
              onMouseLeave={() => onHover(null)}
            ><title>{`${s.label} — ${s.value}`}</title></circle>
          );
          offset += raw;
          return el;
        })}
      </svg>

      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-semibold leading-none text-[#364658] tabular-nums" style={{ fontSize: Math.round(size * 0.19) }}>
          {total.toLocaleString()}
        </span>
        <span className="mt-1.5 text-[11px] uppercase tracking-wide text-[#7B8FA5]">{caption}</span>
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
  if (!severity || cves === 0) {
    return <span className="text-[12px] text-[#7B8FA5]">No known CVE</span>;
  }
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
export function ViewAll({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-[13px] font-medium text-[#3D8BD0] transition-colors hover:bg-[#F5FAFF]"
    >View all<ChevronRight size={14} /></button>
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

/** A plain proportion bar. It used to carry a caption stating its own denominator; both callers
 *  dropped it — one caption restated the figure above it, the other reported a 100% rounding — so
 *  the caption went with them and the name follows the component. */
export function MeterBar({ pct: p, color }: { pct: number; color: string }) {
  return (
    <span className="flex h-1.5 w-full overflow-hidden rounded-full bg-[#F1F5F9]">
      <span className="h-full rounded-full" style={{ width: `${Math.max(2, Math.min(100, p))}%`, backgroundColor: color }} />
    </span>
  );
}

/** "9 out of what?" has no answer, so the vulnerability card shows the severity MIX instead —
 *  proportional segments of the same nine, which is a real statement about them. */
export function SeveritySplit({ counts, total }: { counts: Record<string, number>; total: number }) {
  const order = ['Critical', 'High', 'Medium', 'Low'].filter((k) => counts[k] > 0);
  return (
    <>
      <span className="flex h-1.5 w-full gap-0.5 overflow-hidden rounded-full bg-[#F1F5F9]">
        {order.map((k) => (
          <span key={k} className="h-full first:rounded-l-full last:rounded-r-full"
            style={{ width: `${(counts[k] / Math.max(1, total)) * 100}%`, backgroundColor: SEVERITY[k].bar }} />
        ))}
      </span>
      <span className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] text-[#7B8FA5]">
        {order.map((k) => (
          <span key={k} className="inline-flex items-center gap-1">
            <span className="size-1.5 rounded-full" style={{ backgroundColor: SEVERITY[k].bar }} />
            <span className="tabular-nums">{counts[k]}</span> {k.toLowerCase()}
          </span>
        ))}
      </span>
    </>
  );
}

/** One KPI anatomy, matching `SoftwareComponentsKpis`:
 *
 *    neutral icon + title  →  figure  →  the estate it reaches  →  bar
 *    →  a tertiary action pinned to the BOTTOM.
 *
 *  Two things were taken out of this shape. The action used to BE the finding — "Log4Shell
 *  present" was both the headline and the only link out, which reads as a card offering one
 *  specific thing rather than a way into the register; the button is now the way to everything of
 *  that kind, `mt-auto` so the three line up however much the middles differ. Then the coloured
 *  exception line itself went: each card names one specific item (a record gap, a CVE, a model)
 *  where the reading a technician acts on is how much of the estate it touches. So the detail line
 *  is a reach statement on all three, and the bar carries no caption — every caption was either
 *  restating the figure above it or reporting a rounding. */
export function Kpi2({ icon, title, value, context, meter, cta, onCta }: {
  icon: React.ReactNode; title: string; value: string;
  context: string; meter: React.ReactNode;
  cta: string; onCta: () => void;
}) {
  return (
    <div className="flex min-w-0 flex-col rounded-lg border border-[#E5E7EB] bg-white px-4 py-4">
      <div className="flex items-center gap-2.5">
        {/* neutral — colour belongs to the number and its drivers, not to the furniture */}
        <span className="flex size-8 flex-shrink-0 items-center justify-center rounded-lg bg-[#F1F5F9] text-[#64748B]">{icon}</span>
        <span className="truncate text-[14px] font-medium text-[#364658]">{title}</span>
      </div>
      <div className="mt-3 text-[20px] font-semibold leading-none tracking-tight text-[#364658] tabular-nums">{value}</div>
      <div className="mt-2.5 truncate text-[12px] text-[#7B8FA5]">{context}</div>
      <div className="mt-3">{meter}</div>
      <button
        onClick={onCta}
        className="-ml-1.5 mt-auto inline-flex items-center gap-1.5 self-start rounded px-1.5 py-0.5 pt-3 text-[13px] font-medium text-[#3D8BD0] transition-colors hover:bg-[#F5FAFF]"
      >{cta} <ArrowRight size={14} /></button>
    </div>
  );
}

/** The three estate-health cards. One component so the two dashboards cannot disagree about them. */
export function EstateKpis({ d, onNavigate }: {
  d: BomDashboard; onNavigate: (p: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      <Kpi2
        icon={<Layers size={17} />} title="Components discovered"
        value={d.declared.toLocaleString()}
        /* No exception line and no bar caption here, by request: the record-completeness reading
           (`N records missing detail` / `N of M ... have full detail`) rounded to "everything is
           complete" at this fixture's scale, so it spent two lines saying nothing. The scale line
           carries the card and the bar stays as a quiet fill. */
        context={`${d.unique.toLocaleString()} distinct versions · ${d.ciCount} CIs · ${d.productCount} products`}
        meter={<MeterBar pct={d.fullDetailPct} color="#3D8BD0" />}
        cta="View all components" onCta={() => onNavigate('software-components')}
      />
      <Kpi2
        icon={<ShieldAlert size={17} />} title="Vulnerabilities identified"
        value={String(d.cveIds.length)}
        /* No named lead here, by request. The detail line now states the blast radius of ALL nine
           rather than of the worst one — the CVE count is a property of the catalogue, and how
           much of the fleet they touch is the part that sizes the work. Denominator kept, per the
           module's own rule: "12 CIs" means nothing without the estate it is 12 of. */
        context={d.vulnerableCis > 0
          ? `${d.vulnerableCis} of ${d.ciCount} CIs affected`
          : 'No CIs affected'}
        meter={<SeveritySplit counts={d.cveBySeverity} total={d.cveIds.length} />}
        cta="Review vulnerabilities" onCta={() => onNavigate('software-components')}
      />
      <Kpi2
        icon={<Bot size={17} />} title="Deprecated AI models"
        value={`${d.modelsPastEol} / ${d.modelTotal}`}
        /* Same anatomy as the other two: figure, then the estate it reaches, then a bare bar.
           The named oldest model went the way of the named lead vulnerability, and the caption
           `3 of 13 models past end-of-life` was the "3 / 13" above it in words. */
        context={d.modelsPastEol > 0
          ? `${d.eolModelCis} of ${d.ciCount} CIs affected`
          : 'No CIs affected'}
        meter={<MeterBar pct={d.modelTotal ? (d.modelsPastEol / d.modelTotal) * 100 : 0} color="#DC2626" />}
        /* The AI BOM has no register of its own — models live per CI, so the inventory is where
           every one of them is reachable. Same destination the panel's "View all" uses. */
        cta="View all models" onCta={() => onNavigate('bom')}
      />
    </div>
  );
}

/** Licence distribution — the risk states lead, the distribution is context underneath.
 *
 *  `layout` is a prop rather than a breakpoint because the two dashboards put this card in columns
 *  of different widths (a half on Dashboard 1, a third on Dashboard 2) at the SAME viewport size —
 *  a media query cannot tell those apart, and guessing leaves one of them wrong. Side by side in
 *  the wide column, stacked in the narrow one. */
export function LicenceDistributionCard({ d, onNavigate, layout = 'stack' }: {
  d: BomDashboard; onNavigate: (p: string) => void; layout?: 'stack' | 'row';
}) {
  const [hover, setHover] = useState<number | null>(null);
  const UNDECLARED_HINT = 'A blank licence is not a safe licence — it means we do not know.';
  const row = layout === 'row';
  return (
    <Card
      title="Licence distribution"
      right={<ViewAll onClick={() => onNavigate('software-components')} />}
    >
      <div className="grid grid-cols-3 gap-px border-b border-[#F0F2F5] bg-[#F0F2F5]">
        {([
          { p: 'denied' as LicencePolicy, label: 'Denied', ink: '#DC2626', info: null as string | null },
          { p: 'restricted' as LicencePolicy, label: 'Restricted', ink: '#D97706', info: null as string | null },
          { p: 'undeclared' as LicencePolicy, label: 'Undeclared', ink: '#B45309', info: UNDECLARED_HINT },
        ]).map((x) => {
          const n = d.licenceCounts[x.p];
          return (
            <button
              key={x.p}
              onClick={() => onNavigate('software-components')}
              className="flex flex-col items-start gap-0.5 bg-white px-4 py-3 text-left transition-colors hover:bg-[#F9FAFB]"
            >
              <span className="text-[20px] font-semibold leading-none tabular-nums" style={{ color: n === 0 ? NEUTRAL_INK : x.ink }}>{n}</span>
              <span className="inline-flex items-center gap-1 text-[12px] text-[#7B8FA5]">
                {x.label}{x.info && <InfoDot text={x.info} />}
              </span>
            </button>
          );
        })}
      </div>

      <div className={`flex flex-1 gap-6 px-5 py-5 ${row ? 'flex-row items-center' : 'flex-col items-center gap-5'}`}>
        <Donut
          total={d.licenceTotal} caption="components" size={row ? 180 : 168}
          hover={hover} onHover={setHover}
          slices={d.licences.map((l, i) => ({
            label: l.licence, value: l.count,
            color: l.policy === 'undeclared' ? '#CBD5E1' : SLICE[i % SLICE.length],
          }))}
        />
        <div className={`min-w-0 space-y-0.5 ${row ? 'flex-1' : 'w-full'}`} onMouseLeave={() => setHover(null)}>
          {d.licences.map((l, i) => {
            const color = l.policy === 'undeclared' ? '#CBD5E1' : SLICE[i % SLICE.length];
            const dim = hover !== null && hover !== i;
            return (
              <button
                key={l.licence}
                onMouseEnter={() => setHover(i)}
                onClick={() => onNavigate('software-components')}
                className="flex w-full items-center gap-2.5 rounded px-1.5 py-1 text-left text-[13px] transition-colors hover:bg-[#F9FAFB]"
                style={{ opacity: dim ? 0.45 : 1 }}
              >
                <span className="size-2.5 flex-shrink-0 rounded-full" style={{ backgroundColor: color }} />
                <span className="min-w-0 flex-1 truncate text-[#364658]" title={l.licence}>{l.licence}</span>
                <span className="flex-shrink-0 tabular-nums text-[#7B8FA5]">{l.count}</span>
                <span className="w-[62px] flex-shrink-0 text-right font-semibold tabular-nums text-[#364658]">{pct(l.count, d.licenceTotal)}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="mt-auto border-t border-[#F0F2F5] px-4 py-2.5 text-right text-[12px] tabular-nums text-[#7B8FA5]">
        of {d.licenceTotal.toLocaleString()} distinct versions
      </div>
    </Card>
  );
}
