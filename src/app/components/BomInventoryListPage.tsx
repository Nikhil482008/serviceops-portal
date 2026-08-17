import { useState, useEffect } from 'react';
import { X, Search, FileText, Download, RefreshCw, Columns3, MoreVertical, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { BomInventoryTable } from './BomInventoryTable';
import { Pagination } from './Pagination';
import { useDrawerStack } from './DrawerStack';
import { mockEndpoints } from './EndpointsListPage';
import type { Endpoint } from './EndpointsListPage';
import { bomForEndpoint, bomCiId } from './bomData';
import type { BomRecord } from './bomData';
import type { HardwareAsset } from './HardwareAssetsListPage';
import { BomIngestPanel } from './BomIngestPanel';
import type { IngestResult } from './BomIngestPanel';
import type { Patch } from './PatchesListPage';

/* Configuration Items — the BOM module's listing. Same fleet as the Endpoints page, but every column
 * answers a BOM question (what was generated, how much of it, and how much of it is a problem).
 *
 * The row addresses TWO different records and they have different homes:
 *   CI        → the asset the components hang off — Asset › Hardware Asset, on its BOM tab.
 *   End Point → the machine the agent scanned    — the endpoint detail page, on its BOM tab.
 * Both land on the same BOM content; only which record frames it differs. */

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

/** Adapt an endpoint onto the HardwareAsset shape, addressed by its CI id. `bomMode` lands the
 *  asset drawer on its BOM tab, the same way it does for the endpoint drawer. `bomEndpointId`
 *  carries the id the BOM itself is keyed by, so the asset shows this host's BOM and not a
 *  second one generated from the CI id. */
const endpointToAssetShape = (e: Endpoint): HardwareAsset & { bomMode: true; bomEndpointId: string } => ({
  id: bomCiId(e.id),
  name: e.hostName,
  assetType: 'Hardware',
  status: 'In Use',
  hostName: e.hostName,
  ipAddress: e.ipAddress,
  usedBy: null,
  managedByGroup: 'IT Operations',
  managedBy: { name: '—' },
  serialNumber: '—',
  bomMode: true,
  bomEndpointId: e.id,
});

function BomToolbar({ searchQuery, setSearchQuery, onIngest }: {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  onIngest: () => void;
}) {
  const IconBtn = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <button className="flex h-[30px] w-[30px] items-center justify-center rounded text-[#6b7280] hover:bg-[#f3f4f6]" title={title}>
      {children}
    </button>
  );

  return (
    <div className="bg-white">
      {/* First row: title + Ingest CTA + actions */}
      <div className="flex items-center justify-between px-6 pb-2 pt-3">
        <h1 className="text-[16px] font-semibold text-[#364658]">Configuration Items</h1>

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

      {/* Scope tabs removed: Agent CIs vs Managed CIs was the same split the Origin and BOM
          Sources columns now carry per row, and a tab that hides two thirds of the estate to make
          a point a column already makes is a filter pretending to be navigation. */}

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
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [searchQuery, setSearchQuery] = useState('');
  const [showIngest, setShowIngest] = useState(false);
  /** CIs whose BOM was ingested this session — they join the one listing, marked Manual. */
  const [ingested, setIngested] = useState<{ endpoint: Endpoint; bom: BomRecord; managed: true }[]>([]);

  useEffect(() => { setCurrentPage(1); setSelected(new Set()); }, [searchQuery]);

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
      /* This CI exists because a document was ingested for it — the "Manual → Manually Ingested"
         state. `manual ·` is the prefix `bomSourceLabels` reads, so the listing and the CI's own
         scan-paths panel describe the same ingest in the same words. */
      origin: 'Manual',
      products: [{
        key: r.product.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'ingested',
        name: r.product, version: null, path: r.sourceLabel,
        source: r.source === 'file' ? 'manual · file upload' : 'manual · API',
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
    toast.success(`${r.ciName} ingested · ${components} components mapped to ${r.ciId}`);
  };

  const { open: openInStack } = useDrawerStack();
  /** End Point → the endpoint's own detail page, on its BOM tab. */
  const handleOpenEndpoint = (e: Endpoint) => openInStack('endpoints', e.id, e.hostName, endpointToBomShape(e));
  /** CI → Asset › Hardware Asset, on its BOM tab. Keyed by the CI id so the two can be open
   *  side by side in the stack without one replacing the other. */
  const handleOpenCi = (e: Endpoint) =>
    openInStack('hardware-assets', bomCiId(e.id), e.hostName, endpointToAssetShape(e));

  /* ONE list. What used to be the Agent/Managed split is now the Origin column, so a CI ingested
     this session sits among the rest — newest first — instead of behind its own tab. */
  const agentRows = mockEndpoints.map((e) => ({ endpoint: e, bom: bomForEndpoint(e.id), managed: false }));
  const scoped = [...ingested, ...agentRows];

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
          onIngest={() => setShowIngest(true)}
        />
        <main className="flex flex-1 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 overflow-auto bg-white">
            <BomInventoryTable
              rows={paginated}
              selected={selected}
              allSelected={allCurrentSelected}
              onSelectAll={handleSelectAll}
              onSelect={handleSelect}
              onCiClick={handleOpenCi}
              onEndpointClick={handleOpenEndpoint}
            />
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
