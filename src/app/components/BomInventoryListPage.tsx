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
import { pathProductOf } from './bomDashboardData';
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

function BomToolbar({ searchQuery, setSearchQuery, focus, setFocus, onIngest }: {
  searchQuery: string;
  /** A narrowing chosen on the screen that sent you here, riding inside the search box as a
   *  removable chip — the same treatment the components register gives one. */
  focus: string | null;
  setFocus: (f: string | null) => void;
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

      {/* Search. A card's filter rides INSIDE it as a chip: both narrow the same list, so they
          read as one control rather than as a filter bar and a search box. */}
      <div className="px-6 pb-3 pt-3">
        <div className="relative flex items-center gap-2 rounded border border-[#d1d5db] bg-white pl-2 pr-10 focus-within:border-[#3D8BD0] focus-within:ring-1 focus-within:ring-[#3D8BD0]">
          {focus && (
            <span className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-sm bg-[#EBF5FF] px-2 py-0.5 text-[13px] text-[#3D8BD0]">
              {focusLabel(focus)}
              <button onClick={() => setFocus(null)} aria-label={`Clear the ${focusLabel(focus)} filter`}
                      className="text-[#3D8BD0]/70 transition-colors hover:text-[#DC2626]">
                <X size={13} />
              </button>
            </span>
          )}
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={focus ? 'Search within this\u2026' : 'Select field to search...'}
            className="h-[36px] min-w-0 flex-1 bg-transparent text-[13px] text-[#364658] placeholder:text-[#9ca3af] focus:outline-none"
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

/** The narrowings this list can apply. `product:<name>` is the only one today — handed over by
 *  the dashboard's Managed paths ring, whose slices are counted from these very products. An
 *  unrecognised focus narrows NOTHING rather than emptying the table: a filter arriving from
 *  another screen must never be able to make the list look like it has no rows. */
const focusPred = (f: string | null): ((r: { endpoint: Endpoint; bom: BomRecord }) => boolean) | null => {
  if (!f) return null;
  const i = f.indexOf(':');
  if (i < 0) return null;
  const kind = f.slice(0, i), value = f.slice(i + 1);
  /* `pathProductOf`, not `p.name`. The ring attributes each declared PATH to a product rather
     than reading the BOM product's own name, and filtering on the name matched almost nothing:
     a slice reading 15 CIs opened a list of one. Same function, so the two cannot disagree. */
  if (kind === 'product') {
    return ({ endpoint, bom }) => bom.products.some((p) => pathProductOf(endpoint.id, p.path) === value);
  }
  return null;
};
/** The chip's text: the VALUE that was clicked. Prefixing it with "Product:" would only repeat
 *  the chart it came from. */
const focusLabel = (f: string | null) => {
  if (!f) return '';
  const i = f.indexOf(':');
  return i < 0 ? f : f.slice(i + 1);
};

export function BomInventoryListPage({
  onNavigate, initialFocus = null, onInitialFocusConsumed,
}: {
  onNavigate: (page: string, focus?: string | null) => void;
  initialFocus?: string | null;
  onInitialFocusConsumed?: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [searchQuery, setSearchQuery] = useState('');
  /* Validated, not trusted — an unrecognised value never becomes a chip. */
  const [focus, setFocus] = useState<string | null>(focusPred(initialFocus) ? initialFocus : null);
  /* Taken once, so returning here later by the rail does not inherit it. */
  useEffect(() => {
    if (!initialFocus) return;
    if (focusPred(initialFocus)) setFocus(initialFocus);
    onInitialFocusConsumed?.();
  }, [initialFocus]);
  const [showIngest, setShowIngest] = useState(false);
  /** CIs whose BOM was ingested this session — they join the one listing, marked Manual. */
  const [ingested, setIngested] = useState<{ endpoint: Endpoint; bom: BomRecord; managed: true }[]>([]);

  useEffect(() => { setCurrentPage(1); setSelected(new Set()); }, [searchQuery, focus]);

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

  /* The card's focus narrows first, then the typed query narrows what is left — one after the
     other, rather than two filters that can contradict each other. */
  const fp = focusPred(focus);
  const focused = fp ? scoped.filter(fp) : scoped;
  const q = searchQuery.trim().toLowerCase();
  const filtered = !q ? focused : focused.filter(({ endpoint: e, bom }) =>
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
          focus={focus}
          setFocus={setFocus}
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
