import { useMemo, useState } from 'react';
import { AlertTriangle, ArrowUpDown, Flag } from 'lucide-react';
import { BomKpiCard } from './BomKpiCard';
import { componentCves } from './softwareComponentDetail';
import { licenceMatcher } from './bomDashboardData';
import type { SoftwareComponent } from './softwareComponentsData';

/* The three readings above the Software Components table.
 *
 * Same card system as the BOM admin screens (.kpi / .kh / .knum / .klabel / .kcta), so the
 * technician listing and the admin surface read as one module rather than two designs.
 *
 * Every figure is DERIVED from the rows below — nothing is stored — so a card and the table
 * it sits above cannot quote different numbers. Each card's action filters that table
 * instead of navigating away, and says so while it is doing it. */

/** A narrowing of the register.
 *
 *  Three of these are the KPI cards' own toggles; the rest arrive from ANOTHER screen — a
 *  dashboard chart hands one over as it navigates. It is a STRING rather than an object because
 *  it has to survive that navigation, be compared with `===` as the cards' active test, and name
 *  a VALUE (`licence:Apache-2.0`) without a second equality rule to go with it. */
export type ComponentFocus = string | null;

type Pred = (c: SoftwareComponent) => boolean;

/** The three the cards above the table own. */
export const focusFn: Record<'vulnerable' | 'fixable' | 'license', Pred> = {
  /* Every component carrying a known vulnerability — the cut the removed "Vulnerable" tab made,
     now reached from the card that counts them. */
  vulnerable: (c) => c.vulnerabilities > 0,
  fixable: (c) => c.vulnerabilities > 0 && !!c.fixVersion,
  license: (c) => c.licenseFlag,
};

export const FOCUS_LABEL: Record<'vulnerable' | 'fixable' | 'license', string> = {
  vulnerable: 'Vulnerable only',
  fixable: 'Has a published fix',
  license: 'Flagged licenses',
};

/* Parameterised focuses read `kind:value`. Split on the FIRST colon only — a licence spelled
   `LicenseRef-Acme:Internal` would otherwise lose half its name. */
const param = (f: string) => {
  const i = f.indexOf(':');
  return i < 0 ? null : { kind: f.slice(0, i), value: f.slice(i + 1) };
};
const own = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);

/** The predicate a focus stands for, or null when it names nothing this page can do.
 *
 *  An unrecognised focus narrows NOTHING rather than emptying the table: a filter arriving from
 *  another screen must never be able to make the list look like it has no rows. */
export function focusPredicate(f: ComponentFocus): Pred | null {
  if (!f) return null;
  if (own(focusFn, f)) return focusFn[f as keyof typeof focusFn];
  const p = param(f);
  /* Built where the buckets are defined, so 'Other' means the same thing here and on the ring. */
  if (p && p.kind === 'licence') return licenceMatcher(p.value);
  return null;
}

/** The chip's text. A parameterised focus shows its VALUE — "Apache-2.0" is what was clicked,
 *  and prefixing it with "Licence:" would only repeat the chart it came from. */
export function focusChip(f: ComponentFocus): string {
  if (!f) return '';
  if (own(FOCUS_LABEL, f)) return FOCUS_LABEL[f as keyof typeof FOCUS_LABEL];
  const p = param(f);
  return p ? p.value : f;
}

/** Checked before it becomes a chip: a chip is a claim that the table has been narrowed, and one
 *  that narrows nothing is a label for a cut that was never made. */
export const isComponentFocus = (f: string | null | undefined): f is string =>
  !!f && focusPredicate(f) !== null;

/* InfoTip moved into BomKpiCard with the rest of line 1 — it is part of the grammar, not
   of this page. */

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

/** The KPI card the register and the AI tab draw. It is an adapter over the module's shared
 *  grammar (`BomKpiCard`) rather than a second implementation of it: these two tabs and the
 *  dashboard were three copies of one shape, and they had already drifted to three heights.
 *
 *  The only thing this adds is the TOGGLE reading of the action — a listing card filters the
 *  table under it, so its action says "Showing this" while it is doing so, where a dashboard
 *  card's action simply goes somewhere.
 */
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
  /** Optional: a card that only reports a distribution has nothing to filter. */
  cta?: string;
}) {
  return (
    <BomKpiCard
      icon={icon}
      title={title}
      info={info}
      action={cta && onToggle ? { label: cta, onClick: onToggle, active, activeLabel: 'Showing this' } : undefined}
    >{children}</BomKpiCard>
  );
}

/* The grammar's figure size, so the register's cards and the dashboard's quote numbers at the
   same weight. It was 26px here and 24 there — a difference nobody chose, left over from the two
   surfaces having had two card components. Kept as a token because these cards compose their own
   line 2 rather than calling KpiValue; when they migrate to it, this goes. */
export const KPI_NUM = 'text-[24px] font-bold leading-none tracking-[-0.6px] tabular-nums';

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
        {/* Figure and evidence on ONE line — the KEV count qualifies the number, so it reads
            beside it rather than as a second thing underneath. */}
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
          <span className={`${KPI_NUM} ${vulnStats.total ? 'text-[#B42318]' : 'text-[#364658]'}`}>{vulnStats.total}</span>
          {/* Severity is not the only thing that makes something urgent — KEV says so, and it
              is a fleet-wide count rather than a slice of the number above. */}
          {kev > 0 && <KpiChip tone="crit">{kev} KEV-listed</KpiChip>}
        </div>
      </KpiCard>

      <KpiCard
        icon={<ArrowUpDown size={15} />} title="Fixes published"
        active={focus === 'fixable'} onToggle={toggle('fixable')} cta="View comp. with fixes"
      >
        {/* The bar is the same fact as "10 of 10" drawn a second way, so it belongs on the same
            line — stacked, it read as a separate reading and cost the card a third row.

            `w-full` is what makes it VISIBLE. This row is itself a flex item of the card's line 2,
            and a flex item does not grow unless told to; its width settled on its content, and
            the bar's content is nothing — an empty span whose `flex-1` had no slack to claim. The
            bar was in the markup the whole time, sized to zero. */}
        <div className="flex w-full items-center gap-3">
          <span className="flex flex-shrink-0 items-baseline gap-2">
            <span className={`${KPI_NUM} text-[#364658]`}>{fixable}</span>
            <span className="text-[15px] font-medium text-[#7B8FA5]">of {vulnerable.length}</span>
          </span>
          <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-[#E5E7EB]" role="img"
                aria-label={`${fixable} of ${vulnerable.length} vulnerable components have a fix, ${pct} percent`}>
            <span className="block h-full rounded-full bg-[#22A06B]" style={{ width: `${pct}%` }} />
          </span>
          {noFix > 0 && (
            <span className="flex-shrink-0 text-[12px] text-[#7B8FA5]">{noFix} with no fix</span>
          )}
        </div>
      </KpiCard>

      <KpiCard
        icon={<Flag size={15} />} title="Flagged licenses"
        active={focus === 'license'} onToggle={toggle('license')} cta="Review licenses"
      >
        {/* Two licences, then a count. The card's job is "how many, and what KIND" — two names
            answer the second question, and a third pushed the row to a width the card does not
            have. The rest are named on the +N's own hover rather than dropped. */}
        {(() => {
          const kinds = [...new Set(flagged.map((c) => c.license))];
          const SHOWN = 2;
          const rest = kinds.slice(SHOWN);
          return (
            <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1.5">
              <span className={`${KPI_NUM} ${flagged.length ? 'text-[#D97706]' : 'text-[#364658]'}`}>{flagged.length}</span>
              {kinds.slice(0, SHOWN).map((l) => (
                <KpiChip key={l} tone="warn">{l}</KpiChip>
              ))}
              {rest.length > 0 && (
                <span
                  className="cursor-help text-[12px] font-medium tabular-nums text-[#D97706]"
                  title={rest.join(', ')}
                >+{rest.length}</span>
              )}
            </div>
          );
        })()}
      </KpiCard>
    </div>
  );
}
