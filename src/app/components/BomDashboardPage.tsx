import { useState } from 'react';
import { Layers, Boxes, ClipboardCheck } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useDrawerStack } from './DrawerStack';
import { bomDashboard } from './bomDashboardData';
import type { LicencePolicy } from './bomDashboardData';
import type { BomType } from './bomData';
/* Chrome lives in one place now that a second dashboard draws it too. */
import {
  Card, HeadPill, DayPill, SeverityBadge, ExposureMeter, BomLink, ViewAll,
  sevColor, bomPatchRecord, EstateKpis, LicenceDistributionCard,
} from './bomDashboardUi';

/* BOM Dashboard — the module's front page.
 *
 * The claim in the subtitle is the design constraint: every figure is derived from the BOM data
 * it links to, so nothing here is a typed-in number and every panel row opens the BOM it came
 * from. Counting is done once in `bomDashboardData`; this file only draws it.
 */

// ── page ───────────────────────────────────────────────────────────────
export function BomDashboardPage({ onNavigate }: { onNavigate: (page: string) => void }) {
  const d = bomDashboard();
  const { open: openInStack } = useDrawerStack();
  /** Shared by the ring and the legend, so pointing at either lights the same slice. */
  const [licHover, setLicHover] = useState<number | null>(null);

  /** Open an endpoint on its BOM tab, landed on a specific BOM. */
  const openBom = (endpointId: string, type: BomType) => {
    const rec = bomPatchRecord(endpointId, type);
    if (rec) openInStack('endpoints', rec.id, rec.name, rec);
  };

  const crumbBtn = 'inline-flex h-8 items-center gap-1.5 rounded border border-[#DFE5ED] bg-white px-3 text-[13px] font-medium text-[#364658] transition-colors hover:bg-[#F5F7FA]';
  const maxCis = Math.max(1, d.ciCount);

  return (
    <div className="flex h-screen bg-[#f9fafb]">
      <Sidebar activePage="bom-dashboard" onNavigate={onNavigate} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header selectedCount={0} onOpenAdmin={() => onNavigate('admin')} />

        {/* ── page head ────────────────────────────────────────────────
            The same fold every other module in this group draws: white band,
            `px-6 pb-2 pt-3`, a 16px semibold title, actions right, one bottom
            hairline. The 24px title and breadcrumb this used to carry were the
            only ones in the product and made the Dashboard read as a different
            kind of page. The positioning line stays, as the subtitle. */}
        <div className="border-b border-[#e5e7eb] bg-white">
          <div className="flex items-start justify-between gap-4 px-6 pb-3 pt-3">
            <div className="min-w-0">
              <h1 className="text-[16px] font-semibold text-[#364658]">Dashboard</h1>
              <p className="mt-1 max-w-[820px] text-[13px] leading-relaxed text-[#7B8FA5]">
                Continuous software supply-chain assurance — SBOM, CBOM and AI BOM evidence for every
                CI. <span className="text-[#364658]">{d.ciCount} CIs · {d.productCount} products ·{' '}
                {d.declared.toLocaleString()} declared components</span> — every figure below is
                derived live from the BOM data it links to.
              </p>
            </div>
            <div className="flex flex-shrink-0 items-center gap-2">
              <button className={crumbBtn} onClick={() => onNavigate('software-components')}>
                <Boxes size={15} /> Software Components
              </button>
              <button className={crumbBtn} onClick={() => onNavigate('compliance-reports')}>
                <ClipboardCheck size={15} /> Compliance Report Pack
              </button>
              <button
                onClick={() => onNavigate('bom')}
                className="inline-flex h-8 items-center gap-1.5 rounded bg-[#3D8BD0] px-3 text-[13px] font-medium text-white transition-colors hover:bg-[#3479b5]"
              ><Layers size={15} /> Configuration Items</button>
            </div>
          </div>
        </div>

        <main className="min-h-0 flex-1 overflow-y-auto">
          <div className="space-y-4 px-6 pb-8 pt-4">
            {/* ── estate health ───────────────────── */}
            <EstateKpis d={d} onNavigate={onNavigate} />

            {/* ── most affected · licences ─────────────────────────── */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card
                title="Components with highest exposure"
                right={<button onClick={() => onNavigate('software-components')} className="text-[13px] font-medium text-[#3D8BD0] hover:underline">All</button>}
              >
                {/* A ranked operational list, not a chart. Several components sit on the same
                    number of CIs, so bars of equal length said nothing; what a technician needs
                    is what it is, how bad, how far it reaches, and where. Ranking, severity and
                    counts are exactly as computed — only the presentation changed. */}
                {/* The rows take the leftover height between them instead of letting it pool as a
                    dead band under the fifth — the card is as tall as the licence panel beside it,
                    and five rows do not fill that on their own. */}
                <div className="flex flex-1 flex-col divide-y divide-[#F0F2F5]">
                  {/* Top 5 only — the panel is a shortlist, not the register. */}
                  {d.affected.slice(0, 5).map((a, i) => {
                    const exposure = Math.round((a.cis / maxCis) * 100);
                    const shown = a.products.slice(0, 3);
                    const rest = a.products.length - shown.length;
                    return (
                      <div key={a.key} className="flex flex-1 items-center gap-4 px-4 py-3 transition-colors hover:bg-[#F9FAFB]">
                        <span className="w-4 flex-shrink-0 text-right text-[12px] font-semibold tabular-nums text-[#9CA3AF]">{i + 1}</span>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                            <span className="truncate font-mono text-[13px] font-semibold text-[#364658]">{a.name}</span>
                            <span className="text-[12px] text-[#7B8FA5]">{a.version}</span>
                            <SeverityBadge severity={a.severity} cves={a.cves.length} />
                          </div>
                          {/* Context, kept quiet — it must not dominate the row. */}
                          <div className="mt-1.5 truncate text-[12px] text-[#7B8FA5]" title={a.products.join(' · ')}>
                            {shown.join(' · ')}{rest > 0 ? ` · +${rest} more` : ''}
                          </div>
                        </div>

                        {/* The primary quantity, and its share of the estate under it. */}
                        <div className="flex-shrink-0 text-right">
                          <div className="whitespace-nowrap text-[13px] font-semibold text-[#364658]">
                            <span className="text-[15px] tabular-nums">{a.cis}</span>
                            <span className="text-[#7B8FA5]"> / {maxCis} CIs affected</span>
                          </div>
                          <div className="mt-1.5 flex items-center justify-end gap-2">
                            <ExposureMeter pct={exposure} color={sevColor(a.severity)} />
                            <span className="whitespace-nowrap text-[12px] tabular-nums text-[#7B8FA5]">{exposure}% exposure</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>

              {/* Half-width column here, so the donut and its legend sit side by side rather than
                  stacked in the middle of a wide card with empty gutters either side. */}
              <LicenceDistributionCard d={d} onNavigate={onNavigate} layout="row" />
            </div>

            {/* ── certificates · AI models ─────────────────────────── */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card
                title="Expiring trust material" sub="certificates from the CBOM"
                right={
                  <div className="flex items-center gap-2">
                    <HeadPill tone={d.certsDueSoon > 0 ? 'red' : 'neutral'}>{d.certsDueSoon} due &lt; 120d</HeadPill>
                    <ViewAll onClick={() => onNavigate('bom')} />
                  </div>
                }
              >
                <div className="divide-y divide-[#F0F2F5]">
                  {d.certs.map((c) => (
                    <div key={c.key} className="flex items-center gap-3 px-4 py-2.5">
                      <DayPill days={c.days} />
                      <div className="min-w-0 flex-1">
                        <BomLink
                          name={c.name}
                          title={`Open the CBOM on ${c.ciId}`}
                          onClick={() => openBom(c.endpointId, 'CBOM')}
                        />
                        <div className="mt-0.5 truncate text-[12px] text-[#7B8FA5]">
                          {c.ciId}{c.cis > 1 ? ` +${c.cis - 1} more` : ''} · {c.detail}
                          {c.quantumVulnerable && ' · quantum-vulnerable'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="border-t border-[#F0F2F5] px-4 py-3 text-[12px] leading-relaxed text-[#7B8FA5]">
                  An expired certificate is an outage, not a finding — rotate before the clock hits zero.
                  {' '}{d.certQuantumVulnerable} of the {d.certTotal} tracked certificates also sit on the
                  PQC migration track.
                </div>
              </Card>

              <Card
                title="Deprecated AI models" sub="lifecycle from the AI BOM"
                right={
                  <div className="flex items-center gap-2">
                    <HeadPill tone={d.modelsPastEol > 0 ? 'red' : 'neutral'}>{d.modelsPastEol} past EOL</HeadPill>
                    <ViewAll onClick={() => onNavigate('bom')} />
                  </div>
                }
              >
                <div className="divide-y divide-[#F0F2F5]">
                  {d.models.map((m) => (
                    <div key={m.key} className="flex items-center gap-3 px-4 py-2.5">
                      <DayPill days={m.days} />
                      <div className="min-w-0 flex-1">
                        <BomLink
                          name={m.name}
                          title={`Open the AI BOM on ${m.ciId}`}
                          onClick={() => openBom(m.endpointId, 'AI BOM')}
                        />
                        <div className="mt-0.5 truncate text-[12px] text-[#7B8FA5]">
                          {m.ciId}{m.cis > 1 ? ` +${m.cis - 1} more` : ''} · {m.detail}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="border-t border-[#F0F2F5] px-4 py-3 text-[12px] leading-relaxed text-[#7B8FA5]">
                  A model past end-of-life receives no security fixes — retrain, upgrade, or retire it.
                  {' '}{d.modelsEolWithin6m} more model{d.modelsEolWithin6m === 1 ? '' : 's'} reach EOL
                  within 6 months.
                </div>
              </Card>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
