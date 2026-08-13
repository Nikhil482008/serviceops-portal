import { useState, useEffect } from 'react';
import { X, Search, FileText, Download, RefreshCw, Columns3, MoreVertical, Plus, Layers } from 'lucide-react';
import { toast } from 'sonner';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { BomInventoryTable } from './BomInventoryTable';
import { Pagination } from './Pagination';
import { useDrawerStack } from './DrawerStack';
import { mockEndpoints } from './EndpointsListPage';
import type { Endpoint } from './EndpointsListPage';
import { bomForEndpoint } from './bomData';
import type { BomRecord } from './bomData';
import { BomIngestPanel } from './BomIngestPanel';
import type { IngestResult } from './BomIngestPanel';
import type { Patch } from './PatchesListPage';

/* BOM Inventory — the BOM module's listing. Same fleet as the Endpoints page, but every column
 * answers a BOM question (what was generated, how much of it, and how much of it is a problem).
 * Clicking a row opens that endpoint's detail page landed on its BOM tab. */

type Scope = 'all' | 'agent' | 'managed';

/** Adapt an endpoint onto the Patch shape the EndpointDrawer body expects, flagged so the
 *  drawer lands on the BOM tab (the same record opened from Patch/Vulnerability does not). */
const endpointToBomShape = (e: Endpoint): Patch => ({
  id: e.id,
  name: e.hostName,
  severity: 'Unspecified',
  releaseDate: '---',
  missingSystem: null,
  installedSystem: null,
  rebootRequired: e.rebootRequired === 'Yes' ? 'Yes' : 'No',
  approvalStatus: 'Approved',
  category: 'Endpoint',
  endpoint: { agentOnline: e.agentOnline, systemHealth: e.systemHealth },
  bomMode: true,
});

function BomToolbar({
  searchQuery, setSearchQuery, scope, setScope, allCount, agentCount, managedCount, onIngest,
}: {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  scope: Scope;
  setScope: (s: Scope) => void;
  allCount: number;
  agentCount: number;
  managedCount: number;
  onIngest: () => void;
}) {
  const IconBtn = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <button className="flex h-[30px] w-[30px] items-center justify-center rounded text-[#6b7280] hover:bg-[#f3f4f6]" title={title}>
      {children}
    </button>
  );

  const TABS: { id: Scope; label: string; count: number }[] = [
    { id: 'all', label: 'All', count: allCount },
    { id: 'agent', label: 'Agent CIs', count: agentCount },
    { id: 'managed', label: 'Managed CIs', count: managedCount },
  ];

  return (
    <div className="bg-white">
      {/* First row: title + Ingest CTA + actions */}
      <div className="flex items-center justify-between px-6 pb-2 pt-3">
        <h1 className="text-[16px] font-semibold text-[#364658]">BOM Inventory</h1>

        <div className="flex items-center gap-1">
          <button
            onClick={onIngest}
            className="mr-1 inline-flex h-8 items-center gap-1.5 rounded bg-[#3D8BD0] px-3 text-[13px] font-medium text-white transition-colors hover:bg-[#3479b5]"
          >
            <Plus size={15} /> Ingest BOM
          </button>
          <IconBtn title="Export"><FileText size={16} /></IconBtn>
          <IconBtn title="Download"><Download size={16} /></IconBtn>
          <IconBtn title="Refresh"><RefreshCw size={16} /></IconBtn>
          <IconBtn title="Columns"><Columns3 size={16} /></IconBtn>
          <IconBtn title="More"><MoreVertical size={16} /></IconBtn>
        </div>
      </div>

      {/* Scope tabs — the standard content-tab treatment, under the title */}
      <div className="flex items-center gap-2.5 border-b border-[#e5e7eb] px-6">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setScope(t.id)}
            className={`flex items-center gap-1.5 whitespace-nowrap border-b-2 px-2 py-3 text-[14px] font-medium transition-colors ${
              scope === t.id
                ? 'border-[#3D8BD0] text-[#3D8BD0]'
                : 'border-transparent text-[#6b7280] hover:border-[#CBD5E1] hover:bg-[#F5F7FA] hover:text-[#364658]'
            }`}
          >
            {t.label}
            <span className={`rounded px-1 py-0.5 text-[12px] font-medium ${scope === t.id ? 'bg-[#E8F4FD] text-[#3D8BD0]' : 'bg-[#E5E7EB] text-[#364658]'}`}>{t.count}</span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="px-6 pb-3 pt-3">
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Select field to search..."
            className="h-[36px] w-full rounded border border-[#d1d5db] bg-white pl-3 pr-10 text-[13px] text-[#364658] placeholder:text-[#9ca3af] focus:border-[#3D8BD0] focus:outline-none focus:ring-1 focus:ring-[#3D8BD0]"
          />
          {searchQuery ? (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9ca3af] transition-colors hover:text-[#364658]"
            >
              <X size={16} />
            </button>
          ) : (
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9ca3af]" size={16} />
          )}
        </div>
      </div>
    </div>
  );
}

export function BomInventoryListPage({ onNavigate }: { onNavigate: (page: string) => void }) {
  const [scope, setScope] = useState<Scope>('agent');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [searchQuery, setSearchQuery] = useState('');
  const [showIngest, setShowIngest] = useState(false);
  /** CIs whose BOM was ingested this session — the Managed CIs tab. */
  const [ingested, setIngested] = useState<{ endpoint: Endpoint; bom: BomRecord; managed: true }[]>([]);

  useEffect(() => { setCurrentPage(1); setSelected(new Set()); }, [searchQuery, scope]);

  /** Turn an ingest into a listing row. An ingested BOM has no scan history, so its counts come
   *  from the document rather than from the deterministic per-endpoint generator. */
  const addIngested = (r: IngestResult) => {
    const seed = [...r.ciId + r.ciName].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 0);
    const components = 40 + (seed % 260);
    const endpoint: Endpoint = {
      id: r.ciId, agentOnline: false, hostName: r.ciName, ipAddress: r.ipAddress,
      osName: r.osName, version: null, servicePack: null, architecture: '64 BIT',
      remoteOffice: null, systemHealth: null, tags: ['ingested'], rebootRequired: 'No',
    };
    const bom: BomRecord = {
      endpointId: r.ciId,
      status: 'Generated',
      products: [{
        key: r.product.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'ingested',
        name: r.product, version: null, path: r.sourceLabel,
        source: r.source === 'file' ? 'ingested · file upload' : 'ingested · API',
        status: 'Scanned', lastScan: 'Just now', findings: seed % 6, excludePaths: [],
        isDefault: true,
      }],
      components,
      findings: seed % 6,
      cryptoAssets: seed % 9,
      aiModels: seed % 4,
      lastGenerated: 'Just now',
    };
    setIngested((prev) => [{ endpoint, bom, managed: true }, ...prev.filter((x) => x.endpoint.id !== r.ciId)]);
    setShowIngest(false);
    setScope('managed');
    toast.success(`${r.ciName} ingested · ${components} components mapped to ${r.ciId}`);
  };

  const { open: openInStack } = useDrawerStack();
  const handleOpen = (e: Endpoint) => openInStack('endpoints', e.id, e.hostName, endpointToBomShape(e));

  // Agent CIs = the fleet the agent reports on. Managed CIs carry a BOM that was ingested
  // rather than scanned, so they only exist once something has been ingested.
  const agentRows = mockEndpoints.map((e) => ({ endpoint: e, bom: bomForEndpoint(e.id), managed: false }));
  const managedRows = ingested;
  const scoped = scope === 'agent' ? agentRows : scope === 'managed' ? managedRows : [...managedRows, ...agentRows];

  const q = searchQuery.trim().toLowerCase();
  const filtered = !q ? scoped : scoped.filter(({ endpoint: e, bom }) =>
    e.id.toLowerCase().includes(q) ||
    e.hostName.toLowerCase().includes(q) ||
    e.ipAddress.toLowerCase().includes(q) ||
    e.osName.toLowerCase().includes(q) ||
    bom.status.toLowerCase().includes(q) ||
    bom.products.some((p) => p.name.toLowerCase().includes(q)) ||
    (bom.lastGenerated ?? '').toLowerCase().includes(q)
  );

  const totalPages = Math.ceil(filtered.length / itemsPerPage) || 1;
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const pageIds = paginated.map((r) => r.endpoint.id);
  const allCurrentSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));

  const handleSelectAll = (checked: boolean) => setSelected(checked ? new Set(pageIds) : new Set());
  const handleSelect = (id: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      checked ? next.add(id) : next.delete(id);
      return next;
    });
  };

  return (
    <div className="flex h-screen bg-[#f9fafb]">
      <Sidebar activePage="bom" onNavigate={onNavigate} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header selectedCount={selected.size} onOpenAdmin={() => onNavigate('admin')} />
        <BomToolbar
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          scope={scope}
          setScope={setScope}
          allCount={agentRows.length + managedRows.length}
          agentCount={agentRows.length}
          managedCount={managedRows.length}
          onIngest={() => setShowIngest(true)}
        />
        <main className="flex flex-1 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 overflow-auto bg-white">
            {scope === 'managed' && managedRows.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="mb-3 inline-flex size-14 items-center justify-center rounded-full bg-[#F5F7FA]">
                  <Layers className="size-6 text-[#9CA3AF]" />
                </div>
                <p className="text-[14px] font-medium text-[#364658]">No managed CIs yet</p>
                <p className="mt-1 max-w-[420px] text-[13px] text-[#7B8FA5]">
                  Managed CIs carry a BOM that was ingested rather than scanned by an agent. Use
                  <span className="font-medium text-[#364658]"> Ingest BOM </span>
                  to attach a CycloneDX or SPDX document to a CI.
                </p>
                <button
                  onClick={() => setShowIngest(true)}
                  className="mt-4 inline-flex h-8 items-center gap-1.5 rounded bg-[#3D8BD0] px-3 text-[13px] font-medium text-white transition-colors hover:bg-[#3479b5]"
                ><Plus size={15} /> Ingest BOM</button>
              </div>
            ) : (
              <BomInventoryTable
                rows={paginated}
                selected={selected}
                allSelected={allCurrentSelected}
                onSelectAll={handleSelectAll}
                onSelect={handleSelect}
                onRowClick={handleOpen}
              />
            )}
          </div>
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            itemsPerPage={itemsPerPage}
            totalItems={filtered.length}
            onPageChange={setCurrentPage}
            onItemsPerPageChange={(v) => { setItemsPerPage(v); setCurrentPage(1); }}
          />
        </main>
      </div>

      <BomIngestPanel isOpen={showIngest} onClose={() => setShowIngest(false)} onIngest={addIngested} />
    </div>
  );
}
