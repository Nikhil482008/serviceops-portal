import { useMemo, useState } from 'react';
import { AlertTriangle, ArrowUpDown, Flag, ArrowRight, X, Info } from 'lucide-react';
import { componentCves } from './softwareComponentDetail';
import type { SoftwareComponent } from './softwareComponentsData';

/* The three readings above the Software Components table.
 *
 * Same card system as the BOM admin screens (.kpi / .kh / .knum / .klabel / .kcta), so the
 * technician listing and the admin surface read as one module rather than two designs.
 *
 * Every figure is DERIVED from the rows below — nothing is stored — so a card and the table
 * it sits above cannot quote different numbers. Each card's action filters that table
 * instead of navigating away, and says so while it is doing it. */

export type ComponentFocus = 'vulnerable' | 'fixable' | 'license' | null;

export const focusFn: Record<Exclude<ComponentFocus, null>, (c: SoftwareComponent) => boolean> = {
  /* Every component carrying a known vulnerability — the cut the removed "Vulnerable" tab made,
     now reached from the card that counts them. */
  vulnerable: (c) => c.vulnerabilities > 0,
  fixable: (c) => c.vulnerabilities > 0 && !!c.fixVersion,
  license: (c) => c.licenseFlag,
};

export const FOCUS_LABEL: Record<Exclude<ComponentFocus, null>, string> = {
  vulnerable: 'Vulnerable only',
  fixable: 'Has a published fix',
  license: 'Flagged licenses',
};

/** What the figure MEANS, beside the heading rather than under the number.
 *
 *  It is a definition — read once and then never again — so it should not hold a line of the card
 *  for the rest of its life. Hover and keyboard focus both open it: a tip only a mouse can reach
 *  is a tip half the readers do not have. */
function InfoTip({ text }: { text: string }) {
  const [on, setOn] = useState(false);
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        aria-label={text}
        onMouseEnter={() => setOn(true)}
        onMouseLeave={() => setOn(false)}
        onFocus={() => setOn(true)}
        onBlur={() => setOn(false)}
        className="inline-flex cursor-help text-[#B6C2CF] transition-colors hover:text-[#3D8BD0]"
      ><Info size={13} /></button>
      {on && (
        <span className="absolute left-1/2 top-full z-30 mt-1.5 w-[210px] -translate-x-1/2 rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-[12px] leading-relaxed text-[#364658] shadow-lg">
          {text}
        </span>
      )}
    </span>
  );
}

/** Tinted chip — the same vocabulary as the table's severity and licence pills. */
export function KpiChip({ tone, children }: { tone: 'crit' | 'warn'; children: React.ReactNode }) {
  const s = tone === 'crit'
    ? { backgroundColor: '#FEF3F2', color: '#B42318' }
    : { backgroundColor: '#FEF7E6', color: '#D97706' };
  return (
    <span className="inline-flex items-center rounded-sm px-2 py-0.5 text-[12px] font-medium" style={s}>
      {children}
    </span>
  );
}

/** The KPI card, exported so the AI Components tab draws the SAME one rather than a lookalike —
 *  it had its own copy, and the two tabs' cards drifted to different heights within a day.
 *  `cta` is optional: a card that only reports a distribution has nothing to filter. */
export function KpiCard({
  icon, title, info, children, active = false, onToggle, cta,
}: {
  icon: React.ReactNode;
  title: string;
  /** What the figure means, in a tip beside the heading rather than a line under the number. */
  info?: string;
  children: React.ReactNode;
  active?: boolean;
  onToggle?: () => void;
  cta?: string;
}) {
  return (
    <article
      /* `group` so the action can key off the card's hover rather than its own. */
      className={`group flex flex-col rounded-lg border px-4 py-2.5 transition-colors ${
        active ? 'border-[#3D8BD0] bg-[#F5FAFF] ring-1 ring-[#3D8BD0]' : 'border-[#E5E7EB] bg-white'
      }`}
    >
      {/* Title left, action right, on one line. The action sat at the bottom so the three cards'
          buttons lined up; on the top row they line up by construction, and the card's first line
          now carries both what it is and what you can do about it. */}
      <div className="mb-1.5 flex items-start justify-between gap-3">
        <span className="flex min-w-0 items-center gap-[7px]">
          <span className="flex-shrink-0 text-[#7B8FA5]">{icon}</span>
          <span className="truncate text-[13px] font-medium text-[#7B8FA5]">{title}</span>
          {info && <InfoTip text={info} />}
        </span>
        {cta && (
          <button
            onClick={onToggle}
            aria-pressed={active}
            /* Visible on hover, on focus, and whenever it is the one filtering — an active filter
               with no visible control is a page that has changed for no reason the reader can see.
               `opacity` rather than mounting, so the title never reflows when it appears. */
            className={`-mr-1.5 -mt-0.5 inline-flex flex-shrink-0 items-center gap-1.5 rounded px-1.5 py-0.5 text-[13px] font-medium transition-opacity focus-visible:opacity-100 group-hover:opacity-100 ${
              active ? 'text-[#3D8BD0] opacity-100' : 'text-[#3D8BD0] opacity-0 hover:bg-[#F5FAFF]'
            }`}
          >
            {active ? <>Showing this <X size={14} /></> : <>{cta} <ArrowRight size={14} /></>}
          </button>
        )}
      </div>
      {children}
    </article>
  );
}

/* 26px, down from the 40px exception in two steps. Still the largest thing on the card by a
   clear margin, and still the first thing read. 40 was buying presence at the cost of a card
   tall enough to push the table below the fold, and the table is the point of the screen. The
   BOM admin cards keep 40 — there, the cards ARE the page. */
export const KPI_NUM = 'text-[26px] font-semibold leading-none tracking-[-0.8px] tabular-nums';

export function SoftwareComponentsKpis({
  rows, focus, setFocus,
}: {
  rows: SoftwareComponent[];
  focus: ComponentFocus;
  setFocus: (f: ComponentFocus) => void;
}) {
  /* Vulnerabilities, not components carrying them: "4 components" and "17 vulnerabilities" are
     different quantities, and the card is titled for the second. Counted from the same
     `componentCves` the detail drawer lists, so the card and the drawer cannot disagree. */
  const vulnStats = useMemo(() => {
    let total = 0;
    for (const c of rows) total += componentCves(c).length;
    return { total };
  }, [rows]);
  const kev = rows.filter((c) => c.kev).length;

  const vulnerable = rows.filter((c) => c.vulnerabilities > 0);
  const fixable = vulnerable.filter((c) => !!c.fixVersion).length;
  const pct = vulnerable.length ? Math.round((fixable / vulnerable.length) * 100) : 0;
  const noFix = vulnerable.length - fixable;

  const flagged = rows.filter(focusFn.license);

  const toggle = (f: Exclude<ComponentFocus, null>) => () => setFocus(focus === f ? null : f);

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      <KpiCard
        icon={<AlertTriangle size={15} />} title="Vulnerabilities"
        active={focus === 'vulnerable'} onToggle={toggle('vulnerable')} cta="Review vulnerabilities"
      >
        <div className={`${KPI_NUM} ${vulnStats.total ? 'text-[#B42318]' : 'text-[#364658]'}`}>{vulnStats.total}</div>
        {/* Severity is not the only thing that makes something urgent — KEV says so, and it
            is a fleet-wide count rather than a slice of the number above. */}
        {kev > 0 && (
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <KpiChip tone="crit">{kev} KEV-listed</KpiChip>
          </div>
        )}
      </KpiCard>

      <KpiCard
        icon={<ArrowUpDown size={15} />} title="Fixes published"
        active={focus === 'fixable'} onToggle={toggle('fixable')} cta="View comp. with fixes"
      >
        <div className="flex items-baseline gap-2">
          <span className={`${KPI_NUM} text-[#364658]`}>{fixable}</span>
          <span className="text-[15px] font-medium text-[#7B8FA5]">of {vulnerable.length}</span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#E5E7EB]" role="img"
             aria-label={`${fixable} of ${vulnerable.length} vulnerable components have a fix, ${pct} percent`}>
          <div className="h-full rounded-full bg-[#22A06B]" style={{ width: `${pct}%` }} />
        </div>
        {noFix > 0 && (
          <div className="mt-1.5 text-[12px] text-[#7B8FA5]">{noFix} with no published fix</div>
        )}
      </KpiCard>

      <KpiCard
        icon={<Flag size={15} />} title="Flagged licenses"
        active={focus === 'license'} onToggle={toggle('license')} cta="Review licenses"
      >
        <div className={`${KPI_NUM} ${flagged.length ? 'text-[#D97706]' : 'text-[#364658]'}`}>{flagged.length}</div>
        {flagged.length > 0 && (
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {[...new Set(flagged.map((c) => c.license))].map((l) => (
              <KpiChip key={l} tone="warn">{l}</KpiChip>
            ))}
          </div>
        )}
      </KpiCard>
    </div>
  );
}
