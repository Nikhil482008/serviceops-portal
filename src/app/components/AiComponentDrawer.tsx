import { useState, useEffect, useRef } from 'react';
import { ChevronDown, Search, X, FileText, Sparkles, ShieldCheck, RefreshCw, Check, CircleAlert, ScanLine, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import { useDrawerStack } from './DrawerStack';
import { DrawerTabStrip } from './DrawerTabStrip';
import { MinimizedDrawerRail } from './MinimizedDrawerRail';
import { Pagination } from './Pagination';
import { aiAssetCis, aiRiskSignals, KIND_TITLE } from './aiModelsData';
/* The same office catalogue the software component drawer filters by — one list, so the two
   endpoint pickers cannot offer different vocabularies under the same label. */
import { REMOTE_OFFICES } from './PatchComputersTab';
import type { AiAssetRow, SignalStatus } from './aiModelsData';

/* One AI component's own page — the same shell as the Software Component drawer, because it is
 * the same kind of record seen from the same place: an artefact, where it runs, and what is wrong
 * with it. Only the content differs, and it differs because the judgements differ.
 *
 * Two tabs, not the software drawer's three: an AI component has no CVE list. What it has instead
 * is a set of CHECKS — lifecycle, provenance, serialization, licence, egress — and those are
 * stated whether they pass or fail. A screen that listed only failures could not tell "we looked
 * and it is fine" apart from "we never looked".
 */

const STATUS_STYLE: Record<SignalStatus, { bg: string; text: string; dot: string }> = {
  Critical: { bg: '#FEF3F2', text: '#B42318', dot: '#EF4444' },
  High: { bg: '#FFF4ED', text: '#B93815', dot: '#F97316' },
  Medium: { bg: '#FFFAEB', text: '#B54708', dot: '#F59E0B' },
  Pass: { bg: '#ECFDF3', text: '#22A06B', dot: '#22A06B' },
};

const ALL_ENDPOINTS = 'All Endpoints';

interface AiComponentDrawerProps {
  openAssets: AiAssetRow[];
  activeAssetId: string;
  onClose: () => void;
  onCloseTab: (id: string) => void;
  onTabChange: (id: string) => void;
  stackTabs?: { id: string; subject: string }[];
  stackWidth?: number;
  onStackWidthChange?: (w: number) => void;
  stackMinimized?: boolean;
  onStackMinimizedChange?: (m: boolean) => void;
  stackActiveTab?: string;
  onStackActiveTabChange?: (t: string) => void;
}

type MainTab = 'cis' | 'signals';

export function AiComponentDrawer({
  openAssets, activeAssetId, onClose, onCloseTab, onTabChange,
  stackTabs, stackWidth, onStackWidthChange, stackMinimized, onStackMinimizedChange,
  stackActiveTab, onStackActiveTabChange,
}: AiComponentDrawerProps) {
  const c = openAssets.find((x) => x.id === activeAssetId) ?? openAssets[0];

  const [minimizedLocal, setMinimizedLocal] = useState(false);
  const minimized = stackMinimized ?? minimizedLocal;
  const setMinimized = onStackMinimizedChange ?? setMinimizedLocal;
  useEffect(() => { setMinimized(false); }, [activeAssetId]);

  const [tabLocal, setTabLocal] = useState<MainTab>('cis');
  const { open: openInStack } = useDrawerStack();
  const activeTab = (stackActiveTab as MainTab) ?? tabLocal;
  const setActiveTab = (t: MainTab) => { setTabLocal(t); onStackActiveTabChange?.(t); };

  /* Same width contract as every other drawer: full view is the viewport less the rail, and the
     chosen width is shared through the stack so it survives a tab swap. */
  const [drawerWidth, setDrawerWidth] = useState(stackWidth ?? (typeof window !== 'undefined' ? window.innerWidth - 54 : 1546));
  const [isResizing, setIsResizing] = useState(false);
  useEffect(() => { if (onStackWidthChange) onStackWidthChange(drawerWidth); }, [drawerWidth]);
  useEffect(() => {
    if (!isResizing) return;
    const move = (e: MouseEvent) => setDrawerWidth(Math.min(window.innerWidth - 54, Math.max(560, window.innerWidth - e.clientX)));
    const up = () => setIsResizing(false);
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
    return () => { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); };
  }, [isResizing]);
  const fullWidth = typeof window !== 'undefined' ? window.innerWidth - 54 : 1546;
  const wide = drawerWidth > 1080;
  const toggleDrawerView = () => setDrawerWidth((w) => (w > 1080 ? 900 : fullWidth));

  const [bucket, setBucket] = useState<string>(ALL_ENDPOINTS);
  const [bucketOpen, setBucketOpen] = useState(false);
  const bucketRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!bucketOpen) return;
    const onDown = (e: MouseEvent) => {
      if (bucketRef.current && !bucketRef.current.contains(e.target as Node)) setBucketOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [bucketOpen]);
  const [tabQuery, setTabQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [fieldQuery, setFieldQuery] = useState('');
  const [fieldsOpen, setFieldsOpen] = useState(true);
  useEffect(() => { setCurrentPage(1); }, [activeTab, bucket, tabQuery, activeAssetId]);

  if (!c) return null;
  if (minimized) {
    return (
      <MinimizedDrawerRail
        items={stackTabs ?? [{ id: c.id, subject: c.name }]}
        activeId={activeAssetId}
        onSelect={(id) => { onTabChange(id); setMinimized(false); }}
        onRestore={() => setMinimized(false)}
      />
    );
  }

  const cis = aiAssetCis(c.name);
  const signals = aiRiskSignals(c);
  const openSignals = signals.filter((s) => s.status !== 'Pass').length;

  const tq = tabQuery.trim().toLowerCase();
  const cisFiltered = cis
    .filter((r) => bucket === ALL_ENDPOINTS || r.office === bucket)
    /* `office` is searchable for the same reason it is on the software side: neither table has
       an office column, so once the picker has narrowed the list nothing on screen says which
       office you are in, and search is the way back to that word. */
    .filter((r) => !tq || [r.ciId, r.endpointId, r.hostname, r.ip, r.os, r.ciType, r.office, r.location, r.version].join(' ').toLowerCase().includes(tq));
  const totalPages = Math.ceil(cisFiltered.length / itemsPerPage) || 1;
  const cisPage = cisFiltered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  /* Offices, in the catalogue's order and only the ones this asset is actually on — the same
     construction the software component drawer uses, so the two pickers cannot drift. */
  const bucketOptions = [ALL_ENDPOINTS, ...REMOTE_OFFICES.filter((o) => cis.some((r) => r.office === o))];
  const bucketCount = (o: string) =>
    (o === ALL_ENDPOINTS ? cis.length : cis.filter((r) => r.office === o).length);

  /* The same hop the Software Component drawer makes: the CI, opened on its own BOM, already
     looking at this component. `bomComponent` is what stops the trail going cold. */
  const openCi = (r: typeof cis[number]) =>
    openInStack('hardware-assets', r.ciId, r.hostname, {
      id: r.ciId, name: r.hostname, assetType: 'Hardware', status: 'In Use',
      hostName: r.hostname, ipAddress: r.ip, usedBy: null,
      managedByGroup: 'IT Operations', managedBy: { name: '—' }, serialNumber: '—',
      bomMode: true, bomEndpointId: r.endpointId, bomComponent: c.name, bomType: 'AI BOM',
    });

  const fields: { label: string; value: React.ReactNode }[] = [
    { label: 'Component ID', value: c.id },
    { label: 'Name', value: <span className="font-mono">{c.name}</span> },
    { label: 'Kind', value: (
      <span className="block">
        <span className="block font-mono">{c.kind}</span>
        <span className="block text-[12px] text-[#9CA3AF]">{c.subtitle}</span>
      </span>
    ) },
    { label: 'Version', value: <span className="font-mono">{c.version}</span> },
    { label: 'Provider', value: c.provider },
    { label: 'Provenance', value: <Pill status={c.provenance === 'Unverified' ? 'High' : 'Pass'}>{c.provenance}</Pill> },
    { label: 'License · risk', value: `${c.license} · ${c.licenseRisk}` },
    { label: 'Lifecycle', value: (
      <span className="inline-flex items-center gap-2">
        <Pill status={c.eolDays !== null && c.eolDays < 0 ? 'Critical' : c.eolDays === null ? 'Pass' : 'Medium'}>{c.lifecycleLabel}</Pill>
        {c.eol && <span className="text-[12px] text-[#7B8FA5]">{c.eol}</span>}
      </span>
    ) },
    { label: 'Installed on', value: `${c.cis} CI${c.cis === 1 ? '' : 's'}` },
    { label: 'Location', value: <span className="font-mono">{cis[0]?.location ?? '—'}</span> },
    { label: 'Detected by', value: (
      <span className="inline-flex items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded-sm bg-[#EFF6FC] px-1.5 py-0.5 text-[12px] text-[#3D8BD0]"><ScanLine size={11} />AIROM</span>
        <span className="text-[12px] text-[#7B8FA5]">airom fs scan</span>
      </span>
    ) },
    { label: 'Format', value: 'CycloneDX 1.6 ML-BOM' },
  ];
  const fq = fieldQuery.trim().toLowerCase();
  const shownFields = fields.filter((f) => !fq || f.label.toLowerCase().includes(fq));

  const TH = 'whitespace-nowrap px-4 py-2.5 text-left text-[12px] font-semibold text-[#364658]';
  const TD = 'whitespace-nowrap px-4 py-3 text-[13px] text-[#364658]';

  return (
    <div className="fixed inset-0 z-50" data-drawer-backdrop>
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <div
        className={`fixed right-0 top-0 z-50 flex h-screen flex-col bg-white shadow-2xl ${drawerWidth <= 1080 ? 'border-l border-[#e5e7eb]' : ''}`}
        style={{ width: `${drawerWidth}px` }}
        data-drawer
      >
        <div
          className="group absolute bottom-0 left-0 top-0 z-[100] w-3 cursor-ew-resize"
          onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setIsResizing(true); }}
        >
          <div className="absolute bottom-0 left-0 top-0 w-px bg-transparent transition-colors group-hover:bg-[#3D8BD0]" />
        </div>

        <div className="flex items-center border-b border-[#e5e7eb] bg-[#f9fafb]">
          <DrawerTabStrip
            items={stackTabs ?? [{ id: c.id, subject: c.name }]}
            activeId={activeAssetId}
            onSelect={onTabChange}
            onClose={onCloseTab}
            maxVisible={wide ? 8 : 3}
          />
          <button onClick={() => setMinimized(true)} title="Minimize panel" className="flex-shrink-0 border-l border-[#e5e7eb] p-2 hover:bg-[#e5e7eb]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M5 12h14" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" /></svg>
          </button>
          <button onClick={toggleDrawerView} className="p-2 hover:bg-[#e5e7eb]" title={wide ? 'Switch to small view' : 'Switch to full view'}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <rect x="4" y="4" width="16" height="16" rx="2" stroke="#364658" strokeWidth="2" />
            </svg>
          </button>
          <button onClick={onClose} className="border-l border-[#e5e7eb] p-2 hover:bg-[#e5e7eb]" title="Close"><X size={16} className="text-[#6b7280]" /></button>
        </div>

        <div className="flex min-h-0 flex-1">
          <div className="flex min-w-0 flex-1 flex-col overflow-auto">
            {/* Header — identity, then the five facts that decide what to do about it. */}
            <div className="border-b border-[#e5e7eb] px-6 pb-3 pt-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="size-2.5 flex-shrink-0 rounded-full"
                      style={{ backgroundColor: openSignals > 0 ? '#EF4444' : '#22A06B' }}
                      title={openSignals > 0 ? `${openSignals} risk signal${openSignals === 1 ? '' : 's'} open` : 'All checks pass'}
                    />
                    <span className="rounded bg-[#e8f4fd] px-2 py-0.5 text-[12px] font-semibold text-[#3D8BD0]">{c.id}</span>
                    <h2 className="truncate font-mono text-[20px] font-semibold text-[#364658]">{c.name}</h2>
                    <span className="flex-shrink-0 rounded-md border border-[#DFE5ED] bg-[#F8FAFC] px-2 py-0.5 font-mono text-[12px] text-[#64748B]">{c.kind}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-[#7B8FA5]">
                    <span>Version <span className="font-mono font-semibold text-[#364658]">{c.version}</span></span>
                    <span className="text-[#CBD5E1]">·</span>
                    <span>Provider <span className="font-semibold text-[#364658]">{c.provider}</span></span>
                    <span className="text-[#CBD5E1]">·</span>
                    <span className="inline-flex items-center gap-1.5">Provenance <Pill status={c.provenance === 'Unverified' ? 'High' : 'Pass'}>{c.provenance}</Pill></span>
                    <span className="text-[#CBD5E1]">·</span>
                    <Pill status={c.eolDays !== null && c.eolDays < 0 ? 'Critical' : c.eolDays === null ? 'Pass' : 'Medium'}>{c.lifecycleLabel}</Pill>
                    <span className="text-[#CBD5E1]">·</span>
                    <span>License <span className="font-semibold text-[#364658]">{c.license} · {c.licenseRisk}</span></span>
                  </div>
                </div>
                <div className="flex flex-shrink-0 items-center gap-2">
                  <button
                    onClick={() => toast.success(`Re-scan queued for ${c.name}`)}
                    title="Re-scan"
                    className="flex size-9 items-center justify-center rounded border border-[#DFE5ED] text-[#7B8FA5] transition-colors hover:bg-[#F5F7FA]"
                  ><RefreshCw size={16} /></button>
                  <button
                    onClick={() => toast.success(openSignals > 0
                      ? `Remediation planned for ${c.name} — ${openSignals} signal${openSignals === 1 ? '' : 's'}`
                      : `${c.name} has no open risk signals`)}
                    className="inline-flex h-9 items-center gap-1.5 rounded bg-[#3D8BD0] px-3.5 text-[13px] font-medium text-white transition-colors hover:bg-[#3479b5]"
                  ><ShieldCheck size={15} /> Remediate</button>
                </div>
              </div>

              {/* Second-level tabs, the product's underline treatment. */}
              <div className="mt-3 flex items-center gap-2.5">
                {([['cis', 'Installed on', cis.length], ['signals', 'Risk signals', openSignals]] as const).map(([id, label, n]) => (
                  <button
                    key={id}
                    onClick={() => setActiveTab(id)}
                    className={`flex items-center gap-1.5 whitespace-nowrap border-b-2 px-2 py-2.5 text-[14px] font-medium transition-colors ${
                      activeTab === id ? 'border-[#3D8BD0] text-[#3D8BD0]' : 'border-transparent text-[#6b7280] hover:text-[#364658]'
                    }`}
                  >
                    {label}
                    <span className={`rounded px-1 py-0.5 text-[12px] font-medium ${activeTab === id ? 'bg-[#E8F4FD] text-[#3D8BD0]' : 'bg-[#E5E7EB] text-[#364658]'}`}>{n}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="min-w-0 flex-1 p-6">
              {activeTab === 'cis' ? (
                <div className="rounded-lg border border-[#E5E7EB] bg-white">
                  <div className="flex items-center gap-2.5 border-b border-[#E5E7EB] px-4 py-3">
                    <div className="relative flex-shrink-0" ref={bucketRef}>
                      <button
                        onClick={() => setBucketOpen((v) => !v)}
                        aria-haspopup="listbox"
                        aria-expanded={bucketOpen}
                        className={`inline-flex h-9 w-[240px] items-center justify-between gap-2 rounded border px-3 text-[13px] transition-colors ${
                          bucket !== ALL_ENDPOINTS
                            ? 'border-[#3D8BD0] bg-[#EBF5FF] text-[#3D8BD0]'
                            : 'border-[#DFE5ED] bg-white text-[#364658] hover:border-[#3D8BD0]'
                        }`}
                      >
                        <span className="inline-flex min-w-0 items-center gap-1.5">
                          <Building2 size={14} className={bucket !== ALL_ENDPOINTS ? 'text-[#3D8BD0]' : 'text-[#7B8FA5]'} />
                          <span className="truncate">{bucket}</span>
                        </span>
                        <ChevronDown size={15} className={`flex-shrink-0 transition-transform ${bucketOpen ? 'rotate-180' : ''} ${bucket !== ALL_ENDPOINTS ? 'text-[#3D8BD0]' : 'text-[#7B8FA5]'}`} />
                      </button>
                      {bucketOpen && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setBucketOpen(false)} />
                          <div className="absolute left-0 top-full z-50 mt-1 w-[240px] rounded-lg border border-[#DFE5ED] bg-white py-1 shadow-lg">
                            {bucketOptions.map((o) => (
                              <button
                                key={o}
                                role="option"
                                aria-selected={bucket === o}
                                onClick={() => { setBucket(o); setBucketOpen(false); }}
                                className={`flex w-full items-center justify-between gap-2 px-4 py-2 text-left text-[13px] transition-colors ${
                                  bucket === o ? 'bg-[#F1F5F9] text-[#364658]' : 'text-[#364658] hover:bg-[#F9FAFB]'
                                }`}
                              >
                                <span className="truncate">{o}</span>
                                <span className="flex flex-shrink-0 items-center gap-2">
                                  <span className="text-[12px] tabular-nums text-[#7B8FA5]">{bucketCount(o)}</span>
                                  {bucket === o && <Check size={15} className="text-[#3D8BD0]" />}
                                </span>
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                    <div className="relative min-w-[240px] flex-1">
                      <input
                        value={tabQuery}
                        onChange={(e) => setTabQuery(e.target.value)}
                        placeholder="Select field to search..."
                        className="h-9 w-full rounded border border-[#d1d5db] bg-white pl-3 pr-10 text-[13px] text-[#364658] placeholder:text-[#9ca3af] focus:border-[#3D8BD0] focus:outline-none focus:ring-1 focus:ring-[#3D8BD0]"
                      />
                      {tabQuery ? (
                        <button onClick={() => setTabQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9ca3af] hover:text-[#364658]"><X size={16} /></button>
                      ) : (
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9ca3af]" size={16} />
                      )}
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[1100px]">
                      <thead className="border-b border-[#e5e7eb]">
                        <tr>
                          {['CI ID', 'Endpoint ID', 'Host Name', 'Version', 'IP Address', 'CI Type', 'OS Name', 'Location', 'Origin'].map((h) => (
                            <th key={h} className={TH}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#e5e7eb] bg-white">
                        {cisPage.length === 0 ? (
                          <tr><td colSpan={9} className="px-4 py-12 text-center text-[13px] text-[#9CA3AF]">No configuration items match.</td></tr>
                        ) : cisPage.map((r) => (
                          <tr key={r.ciId} className="transition-colors hover:bg-[#f9fafb]">
                            <td className="whitespace-nowrap px-4 py-3">
                              <button
                                onClick={() => openCi(r)}
                                title={`Open ${r.ciId} on its AI BOM, at ${c.name}`}
                                className="rounded bg-[#e8f4fd] px-2 py-0.5 text-[12px] font-semibold text-[#3D8BD0] transition-colors hover:bg-[#d0e8f9]"
                              >{r.ciId}</button>
                            </td>
                            <td className={`${TD} text-[#7B8FA5]`}>{r.endpointId}</td>
                            <td className={TD}><span className="block max-w-[170px] truncate">{r.hostname}</span></td>
                            <td className={`${TD} font-mono text-[12px]`}>{r.version}</td>
                            <td className={TD}>{r.ip}</td>
                            <td className="whitespace-nowrap px-4 py-3">
                              <span className="rounded-sm bg-[#F1F5F9] px-2 py-0.5 text-[12px] text-[#475569]">{r.ciType}</span>
                            </td>
                            <td className={TD}><span className="block max-w-[200px] truncate">{r.os}</span></td>
                            <td className={`${TD} font-mono text-[12px] text-[#7B8FA5]`}>{r.location}</td>
                            <td className="whitespace-nowrap px-4 py-3">
                              <span className="inline-flex items-center gap-1 rounded-sm bg-[#EFF6FC] px-1.5 py-0.5 text-[12px] text-[#3D8BD0]"><ScanLine size={11} />{r.origin}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    itemsPerPage={itemsPerPage}
                    totalItems={cisFiltered.length}
                    onPageChange={setCurrentPage}
                    onItemsPerPageChange={(v) => { setItemsPerPage(v); setCurrentPage(1); }}
                  />
                </div>
              ) : (
                <div className="rounded-lg border border-[#E5E7EB] bg-white">
                  <table className="w-full">
                    <thead className="border-b border-[#e5e7eb]">
                      <tr>
                        {['Signal', 'Status', 'Finding', 'Action'].map((h) => (
                          <th key={h} className={TH}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#e5e7eb]">
                      {signals.map((s) => (
                        <tr key={s.signal}>
                          <td className="px-4 py-3.5 text-[13px] font-medium text-[#364658]">{s.signal}</td>
                          <td className="whitespace-nowrap px-4 py-3.5"><Pill status={s.status}>{s.status}</Pill></td>
                          <td className="px-4 py-3.5 text-[13px] text-[#364658]">{s.finding}</td>
                          <td className="px-4 py-3.5 text-[13px] text-[#7B8FA5]">{s.action ?? <span className="text-[#9CA3AF]">—</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {/* Says what a Pass MEANS, because a green row that means "not checked" would be
                      worse than no row at all. */}
                  <div className="border-t border-[#E5E7EB] px-4 py-3 text-[12px] text-[#7B8FA5]">
                    The AIROM risk overlay evaluates every asset on scan — a Pass here is an attested check, not an absence of data.
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right: properties rail — the same shape as Component Properties. */}
          <div className="flex w-[360px] flex-shrink-0 flex-col border-l border-[#e5e7eb] bg-white">
            <div className="px-5 pb-3 pt-4">
              <h2 className="text-[16px] font-semibold text-[#364658]">Component Properties</h2>
              <div className="relative mt-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9ca3af]" size={15} />
                <input
                  value={fieldQuery}
                  onChange={(e) => setFieldQuery(e.target.value)}
                  placeholder="Search fields..."
                  className="h-9 w-full rounded border border-[#d1d5db] bg-white pl-9 pr-3 text-[13px] text-[#364658] placeholder:text-[#9ca3af] focus:border-[#3D8BD0] focus:outline-none focus:ring-1 focus:ring-[#3D8BD0]"
                />
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-auto px-5 pb-4">
              <div className="rounded-lg border border-[#E5E7EB]">
                <button
                  onClick={() => setFieldsOpen((o) => !o)}
                  className="flex w-full items-center justify-between px-4 py-3 text-left"
                >
                  <span className="inline-flex items-center gap-2 text-[14px] font-medium text-[#364658]">
                    <FileText size={15} className="text-[#6b7280]" />Component Fields
                  </span>
                  <ChevronDown size={16} className={`text-[#6b7280] transition-transform ${fieldsOpen ? '' : '-rotate-90'}`} />
                </button>
                {fieldsOpen && (
                  <div className="border-t border-[#E5E7EB] px-4 py-2">
                    {shownFields.length === 0 ? (
                      <p className="py-4 text-[13px] text-[#9CA3AF]">No field matches “{fieldQuery}”.</p>
                    ) : shownFields.map((f) => (
                      <div key={f.label} className="grid grid-cols-[130px_1fr] items-start gap-3 py-2.5">
                        <span className="text-[13px] text-[#7B8FA5]">{f.label}</span>
                        <span className="text-[13px] text-[#364658]">{f.value}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-[#e5e7eb] p-3">
              <button
                onClick={() => toast('Ask AI is not wired up in this prototype')}
                className="flex w-full items-center gap-2 rounded-lg border-2 border-[#C084FC] px-3 py-2.5 text-left text-[13px] text-[#7B8FA5] transition-colors hover:bg-[#FAF5FF]"
              >
                <Sparkles size={16} className="text-[#A855F7]" />
                Ask AI for insights, summaries, and actions...
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** One status pill — the drawer's whole vocabulary for "how bad", used in the header, the fields
 *  rail and the signals table so the same word never appears in two treatments. */
function Pill({ status, children }: { status: SignalStatus; children: React.ReactNode }) {
  const s = STATUS_STYLE[status];
  return (
    <span
      className="inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-[12px] font-medium"
      style={{ backgroundColor: s.bg, color: s.text }}
    >
      {status === 'Pass' ? <Check size={11} /> : <CircleAlert size={11} />}
      {children}
    </span>
  );
}
