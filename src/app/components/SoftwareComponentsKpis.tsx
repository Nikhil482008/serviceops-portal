import { AlertTriangle, ArrowUpDown, Flag, ArrowRight, X } from 'lucide-react';
import type { SoftwareComponent } from './softwareComponentsData';

/* The three readings above the Software Components table.
 *
 * Same card system as the BOM admin screens (.kpi / .kh / .knum / .klabel / .kcta), so the
 * technician listing and the admin surface read as one module rather than two designs.
 *
 * Every figure is DERIVED from the rows below — nothing is stored — so a card and the table
 * it sits above cannot quote different numbers. Each card's action filters that table
 * instead of navigating away, and says so while it is doing it. */

export type ComponentFocus = 'critical' | 'fixable' | 'license' | null;

export const focusFn: Record<Exclude<ComponentFocus, null>, (c: SoftwareComponent) => boolean> = {
  critical: (c) => c.topSeverity === 'Critical',
  fixable: (c) => c.vulnerabilities > 0 && !!c.fixVersion,
  license: (c) => c.licenseFlag,
};

export const FOCUS_LABEL: Record<Exclude<ComponentFocus, null>, string> = {
  critical: 'Critical only',
  fixable: 'Has a published fix',
  license: 'Flagged licenses',
};

/** Tinted chip — the same vocabulary as the table's severity and licence pills. */
function Chip({ tone, children }: { tone: 'crit' | 'warn'; children: React.ReactNode }) {
  const s = tone === 'crit'
    ? { backgroundColor: '#FEF3F2', color: '#B42318' }
    : { backgroundColor: '#FEF7E6', color: '#D97706' };
  return (
    <span className="inline-flex items-center rounded-sm px-2 py-0.5 text-[12px] font-medium" style={s}>
      {children}
    </span>
  );
}

function Card({
  icon, title, children, active, onToggle, cta,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  active: boolean;
  onToggle: () => void;
  cta: string;
}) {
  return (
    <article
      className={`flex flex-col rounded-lg border bg-white px-4 py-3.5 transition-colors ${
        active ? 'border-[#3D8BD0]' : 'border-[#E5E7EB]'
      }`}
    >
      <div className="mb-2.5 flex items-center gap-[7px]">
        <span className="flex-shrink-0 text-[#7B8FA5]">{icon}</span>
        <span className="text-[13px] font-medium text-[#7B8FA5]">{title}</span>
      </div>
      {children}
      {/* Tertiary action, pinned to the bottom so the three cards' buttons line up
          however much the middles differ. */}
      <button
        onClick={onToggle}
        aria-pressed={active}
        className={`-ml-1.5 mt-auto inline-flex items-center gap-1.5 self-start rounded px-1.5 py-1 pt-3 text-[13px] font-medium transition-colors ${
          active ? 'text-[#3D8BD0]' : 'text-[#3D8BD0] hover:bg-[#F5FAFF]'
        }`}
      >
        {active ? <>Showing this <X size={14} /></> : <>{cta} <ArrowRight size={14} /></>}
      </button>
    </article>
  );
}

/* 40px is the sanctioned exception to the type scale for an attention number — the same
   size the BOM admin cards use, so the two surfaces agree on what a headline figure is. */
const NUM = 'text-[40px] font-semibold leading-none tracking-[-1.4px] tabular-nums';

export function SoftwareComponentsKpis({
  rows, focus, setFocus,
}: {
  rows: SoftwareComponent[];
  focus: ComponentFocus;
  setFocus: (f: ComponentFocus) => void;
}) {
  const critical = rows.filter(focusFn.critical).length;
  const kev = rows.filter((c) => c.kev).length;
  const facing = rows.filter((c) => c.internetFacing).length;

  const vulnerable = rows.filter((c) => c.vulnerabilities > 0);
  const fixable = vulnerable.filter((c) => !!c.fixVersion).length;
  const pct = vulnerable.length ? Math.round((fixable / vulnerable.length) * 100) : 0;
  const noFix = vulnerable.length - fixable;

  const flagged = rows.filter(focusFn.license);

  const toggle = (f: Exclude<ComponentFocus, null>) => () => setFocus(focus === f ? null : f);

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      <Card
        icon={<AlertTriangle size={15} />} title="Needs attention first"
        active={focus === 'critical'} onToggle={toggle('critical')} cta="Review critical"
      >
        <div className={`${NUM} ${critical ? 'text-[#B42318]' : 'text-[#364658]'}`}>{critical}</div>
        <div className="mt-[7px] text-[13px] font-medium text-[#7B8FA5]">
          component{critical === 1 ? '' : 's'} with critical vulnerabilities
        </div>
        {/* Severity is not the only thing that makes something urgent — these two say so,
            and they are fleet-wide counts rather than a slice of the number above. */}
        {(kev > 0 || facing > 0) && (
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            {kev > 0 && <Chip tone="crit">{kev} KEV-listed</Chip>}
            {facing > 0 && <Chip tone="crit">{facing} internet-facing</Chip>}
          </div>
        )}
      </Card>

      <Card
        icon={<ArrowUpDown size={15} />} title="Fixes ready"
        active={focus === 'fixable'} onToggle={toggle('fixable')} cta="Plan upgrades"
      >
        <div className="flex items-baseline gap-2">
          <span className={`${NUM} text-[#364658]`}>{fixable}</span>
          <span className="text-[15px] font-medium text-[#7B8FA5]">of {vulnerable.length}</span>
        </div>
        <div className="mt-[7px] text-[13px] font-medium text-[#7B8FA5]">
          vulnerable components have a published fix
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#E5E7EB]" role="img"
             aria-label={`${fixable} of ${vulnerable.length} vulnerable components have a fix, ${pct} percent`}>
          <div className="h-full rounded-full bg-[#22A06B]" style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-2.5 text-[12px] text-[#7B8FA5]">
          {noFix === 0 ? 'all upgrade paths known' : `${noFix} with no published fix`}
        </div>
      </Card>

      <Card
        icon={<Flag size={15} />} title="License risk"
        active={focus === 'license'} onToggle={toggle('license')} cta="Review licenses"
      >
        <div className={`${NUM} ${flagged.length ? 'text-[#D97706]' : 'text-[#364658]'}`}>{flagged.length}</div>
        <div className="mt-[7px] text-[13px] font-medium text-[#7B8FA5]">
          component{flagged.length === 1 ? '' : 's'} on flagged licenses
        </div>
        {flagged.length > 0 && (
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            {[...new Set(flagged.map((c) => c.license))].map((l) => (
              <Chip key={l} tone="warn">{l}</Chip>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
