import { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useDrawerStack } from './DrawerStack';
import { bomDashboard } from './bomDashboardData';
import type { BomType } from './bomData';
import { bomVersions } from './bomData';
import { BomComponentsPanel } from './BomComponentsPanel';
import type { ExpiringCert } from './bomDashboardData';
import type { SoftwareComponent } from './softwareComponentsData';
/* Chrome lives in one place now that a second dashboard draws it too. */
import type { BomNavigate } from './bomDashboardUi';
import {
  Card, HeadPill, ViewAll,
  sevColor, bomPatchRecord, EstateKpis, LicenceDistributionCard, CertTimeline, CertBands, ExposureRing,
  ManagedPathsCard, EolTimeline, Empty,
} from './bomDashboardUi';

/* BOM Dashboard — the module's front page.
 *
 * The claim in the subtitle is the design constraint: every figure is derived from the BOM data
 * it links to, so nothing here is a typed-in number and every panel row opens the BOM it came
 * from. Counting is done once in `bomDashboardData`; this file only draws it.
 */

// ── page ───────────────────────────────────────────────────────────────
export function BomDashboardPage({ onNavigate }: { onNavigate: BomNavigate }) {
  const d = bomDashboard();
  const { open: openInStack } = useDrawerStack();
  /** Shared by the ring and the legend, so pointing at either lights the same slice. */
  const [licHover, setLicHover] = useState<number | null>(null);
  /** Which exposure row is showing its detail. Hover OR focus, so a keyboard reaches it. */
  const [expHover, setExpHover] = useState<string | null>(null);
  /** The certificate whose crypto assets are open, over the dashboard. */
  const [certAssets, setCertAssets] = useState<ExpiringCert | null>(null);

  /** One thing -> its detail page. The stack renders it above everything, including the list. */
  const openComponent = (c: SoftwareComponent) =>
    openInStack('software-components', c.id, `${c.name} ${c.version}`, c);

  /** Open an endpoint on its BOM tab, landed on a specific BOM. */
  const openBom = (endpointId: string, type: BomType) => {
    const rec = bomPatchRecord(endpointId, type);
    if (rec) openInStack('endpoints', rec.id, rec.name, rec);
  };

  /* A certificate dot names a THING, so it opens that thing: the crypto assets of the CBOM it
     was found in, as a panel over the dashboard. It used to open the endpoint's whole BOM tab
     as a drawer-stack tab, leaving the reader to find the CBOM and press "View crypto assets"
     — three moves to reach the list the dot had already named. */
  const currentVersion = (c: ExpiringCert) => {
    const vs = bomVersions(c.endpointId, c.productKey, 'CBOM');
    /* The rail runs newest-first, so the head is Current. A scope with no CBOM has no version
       to open — 0 is what the components panel already treats as "none". */
    return vs.length ? vs[0].v : 0;
  };

  const maxCis = Math.max(1, d.ciCount);

  return (
    <div className="flex h-screen bg-[#f9fafb]">
      <Sidebar activePage="bom-dashboard" onNavigate={onNavigate} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header selectedCount={0} onOpenAdmin={() => onNavigate('admin')} />

        {/* ── page head ────────────────────────────────────────────────
            The same fold every other module in this group draws: white band,
            `px-6 pb-2 pt-3`, a 16px semibold title, one bottom hairline. The 24px
            title and breadcrumb this used to carry were the only ones in the product
            and made the Dashboard read as a different kind of page.

            No actions in the band: the three that were here went to modules the rail
            already reaches, and every panel below already links into the one it is
            about. A dashboard is read, not navigated from the top. */}
        <div className="border-b border-[#e5e7eb] bg-white">
          <div className="px-6 pb-3 pt-3">
            <h1 className="text-[16px] font-semibold text-[#364658]">Dashboard</h1>
          </div>
        </div>

        <main className="min-h-0 flex-1 overflow-y-auto">
          <div className="space-y-4 px-6 pb-8 pt-4">
            {/* ── estate health ───────────────────── */}
            <EstateKpis d={d} onNavigate={onNavigate} />

            {/* ── what is in the estate: exposure, licences, scan scopes ──
                Three across. The exposure list leads because it is the ranked exception; the two
                distributions sit beside it as the context for it. */}
            <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-3">
              <Card
                title="Components with highest exposure"
                /* The denominator, stated once. Every row prints a percentage and nothing on the
                   row says what it is a percentage OF — naming the arithmetic here is what makes
                   the number trustable, and the info dot spells it out. */
                sub={`% of ${maxCis} CIs`}
                subInfo={`Share of the ${maxCis} tracked CIs running each component`}
                right={<button onClick={() => onNavigate('software-components')} className="text-[13px] font-medium text-[#3D8BD0] hover:underline">All</button>}
              >
                {/* A ranked operational list, not a chart. Several components sit on the same
                    number of CIs, so bars of equal length said nothing; what a technician needs
                    is what it is, how far it reaches, and where.

                    ONE LINE per row. The severity chip used to sit in the same flex-wrap as the
                    name and version, and in a third-width column it pushed them onto a second and
                    third line — five entries then filled a card sized for far more, and the rest
                    was air. The chip is gone and the same height carries twelve.

                    Severity is not lost with it: the bar is coloured by it, and the tooltip names
                    it with the CVE count. It IS a weaker signal than a chip — worth knowing. */}
                <div className="flex flex-1 flex-col divide-y divide-[#F0F2F5]">
                  {d.affected.map((a, i) => {
                    const exposure = Math.round((a.cis / maxCis) * 100);
                    const on = expHover === a.key;
                    /* The last rows open upward, or the card would have to grow to hold the card. */
                    const up = i >= d.affected.length - 3;
                    return (
                      <div key={a.key} className="relative flex flex-1 flex-col">
                        <button
                          onClick={() => {
                            /* The panel ranks by component NAME and shows the version on the most
                               CIs; that pair is the row the register carries. */
                            const c = d.components.find((x) => x.name === a.name && x.version === a.version);
                            if (c) openComponent(c);
                          }}
                          onMouseEnter={() => setExpHover(a.key)} onMouseLeave={() => setExpHover(null)}
                          onFocus={() => setExpHover(a.key)} onBlur={() => setExpHover(null)}
                          /* Severity is off the card now and lives in the ring's colour. Stated
                             here so it is not colour ALONE for a screen reader — a sighted
                             reader has only the colour, which is worth knowing. */
                          aria-label={`${a.name} ${a.version}, ${exposure}% exposure, ${a.cis} of ${maxCis} CIs${
                            a.cves.length ? `, ${a.cves.length} CVE${a.cves.length === 1 ? '' : 's'}, worst ${a.severity}` : ', no known CVE'}`}
                          className="flex flex-1 items-center gap-3 whitespace-nowrap px-4 py-2 text-left transition-colors hover:bg-[#F9FAFB] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#3D8BD0]"
                        >
                          <span className="w-4 flex-shrink-0 text-right text-[12px] font-semibold tabular-nums text-[#9CA3AF]">{i + 1}</span>

                          {/* The name gives way before the version does — a truncated version
                              number is a different version, and reads as one. */}
                          <span className="flex min-w-0 flex-1 items-baseline gap-2">
                            <span className="truncate font-mono text-[13px] text-[#364658]">{a.name}</span>
                            <span className="flex-shrink-0 text-[12px] text-[#7B8FA5]">{a.version}</span>
                          </span>

                          {/* Only the share — the count it is a share OF is in the header, and the
                              percentage is the thing that actually differs down the list. */}
                          <ExposureRing pct={exposure} color={sevColor(a.severity)} />
                          {/* The word went to the header — "% of 30 CIs" says it once for the
                              whole panel rather than eight times down it. The fixed column stays:
                              it is what lines the percentages up. */}
                          <span className="w-[38px] flex-shrink-0 text-right text-[13px] font-semibold tabular-nums text-[#364658]">{exposure}%</span>
                        </button>

                        {/* The browser's own tooltip was carrying 33 product names — five lines
                            wide enough to cover the four rows beneath it, and nothing about a
                            `title` can be capped or placed. This one is sized, positioned, and
                            says how many products it did not show. */}
                        {on && (
                          /* Three bands, hairline between: what it is, how far it reaches, how
                             widely it is used. The figure leads each band and the words qualify
                             it — the same grammar the KPI cards use. */
                          <div className={`pointer-events-none absolute left-4 z-30 w-[260px] overflow-hidden rounded border border-[#E5E7EB] bg-white text-[13px] shadow-md ${up ? 'bottom-full mb-1' : 'top-full mt-1'}`}>
                            <div className="px-3 py-2">
                              <span className="font-mono text-[13px] text-[#364658]">{a.name}</span>{' '}
                              <span className="text-[12px] text-[#7B8FA5]">{a.version}</span>
                            </div>
                            <div className="border-t border-[#F0F2F5] px-3 py-2">
                              <span className="font-semibold tabular-nums text-[#364658]">{a.cis}</span>
                              <span className="text-[#7B8FA5]"> of {maxCis} CIs</span>
                            </div>
                            <div className="border-t border-[#F0F2F5] px-3 py-2">
                              <span className="font-semibold tabular-nums text-[#364658]">{a.products.length}</span>
                              <span className="text-[#7B8FA5]"> products affected</span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Card>

              {/* One `layout` for both, so the pair cannot drift apart. `row` — donut left,
                  legend right — which a third of the page holds now that the row branch is
                  measured for it: a 132px ring rather than 180, and no footer paragraph under
                  either chart. */}
              <LicenceDistributionCard d={d} onNavigate={onNavigate} layout="row" />
              <ManagedPathsCard d={d} onNavigate={onNavigate} layout="row" />
            </div>

            {/* ── the two deadlines: certificates and models ─────────────
                Both answer "what runs out, and when". Half width each — the lifecycle axis spans
                630 days and a third of the page would squeeze that chart back into being pills. */}
            {/* Not an even split. The certificate timeline is the panel with a LENGTH — 45 days
                of rule with fourteen dots on it, seven of them on one day — so it takes 15% more
                width, and the lifecycle axis beside it gives up the same. 1.15fr / 0.85fr, so the
                card is exactly 1.15x what it was rather than the ~1.07x that raising one side
                alone would give. */}
            <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-[1.15fr_0.85fr]">
              <Card
                title="Expiring trust material" sub={`${d.certTotal} certificates tracked`}
                right={<ViewAll onClick={() => onNavigate('bom')} />}
              >
                {/* Windows first, then the shape they describe. The chips answer "how much, when";
                    the rule answers "is it spread out or does it all land in one week". */}
                <CertBands bands={d.certBands} />
                <CertTimeline
                  certs={d.certs}
                  total={d.certTotal}
                  onOpen={(key) => {
                    const c = d.certs.find((x) => x.key === key);
                    if (c) setCertAssets(c);
                  }}
                />

              </Card>

              <Card
                title="Deprecated AI models" sub="lifecycle from the AI BOM"
                right={
                  <div className="flex items-center gap-2">
                    {/* The all-clear is a state, not an absence: "0 past EOL" in the alarm's own
                        grey reads as a panel that failed to load. */}
                    {d.modelsPastEol > 0
                      ? <HeadPill tone="red">{d.modelsPastEol} past EOL</HeadPill>
                      : <HeadPill tone="ok">all supported</HeadPill>}
                    <ViewAll onClick={() => onNavigate('bom')} />
                  </div>
                }
              >
                {d.models.length === 0 ? (
                  <Empty>No models with a published end-of-life</Empty>
                ) : (
                  <EolTimeline models={d.models} onOpen={(m) => openBom(m.endpointId, 'AI BOM')} />
                )}
              </Card>
            </div>
          </div>
        </main>
      </div>

      {/* Over the dashboard, not instead of it: closing returns you to the timeline you clicked
          from, with nothing to navigate back through.
          `focusComponent` is deliberately NOT passed. It only feeds the dependency tree, which
          is SBOM-only, so on a CBOM it would do nothing while reading like the panel had been
          focused on the certificate you clicked. The scope's crypto assets are a short list. */}
      {certAssets && (
        <BomComponentsPanel
          isOpen
          onClose={() => setCertAssets(null)}
          endpointId={certAssets.endpointId}
          hostName={certAssets.ciId}
          productKey={certAssets.productKey}
          productLabel={certAssets.productLabel}
          type="CBOM"
          version={currentVersion(certAssets)}
          format="CycloneDX 1.6"
        />
      )}
    </div>
  );
}
