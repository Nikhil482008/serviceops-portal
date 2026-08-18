import { useMemo, useState } from 'react';
import { Search, X, ChevronRight, AlertTriangle, ShieldCheck, Boxes, Settings, ScanLine } from 'lucide-react';
import { componentCount, OS_PRODUCT_KEY } from './bomData';
import type { BomProduct } from './bomData';

/* Products on a host, as a table rather than a menu.
 *
 * WHY THIS EXISTS. The BOM tab used to open scoped to one product, chosen from a dropdown. At
 * three products that works. At forty it inverts the job: the page can only answer "what is in
 * Claims Portal", so a technician who does not already know which product holds the problem has
 * to open forty scopes to find out. The findings badges — the one piece of data that would tell
 * them — were locked inside a menu that is shut by default.
 *
 * So the tab lands here: every scope on one screen, ranked so the ones that need attention are
 * already at the top, and each row is the way into the scoped view that was always there.
 *
 * The scoped view is NOT replaced. Versions, the change timeline and the diff are genuinely
 * per-product — "v3 vs v2, 2 added" has no meaning rolled up across forty independent scan
 * histories — so this is a layer in front of it, not a replacement for it.
 */

const TYPES = ['SBOM', 'CBOM', 'AI BOM'] as const;

/** Search appears above this many rows. Below it the list is faster to read than to filter. */
const SEARCH_FROM = 8;

/** One product, plus what the overview reports about it. */
interface ProductRow {
  p: BomProduct;
  components: number;
  types: string[];
}

function Row({ r, onOpen }: { r: ProductRow; onOpen: (k: string) => void }) {
  return (
    <button
      onClick={() => onOpen(r.p.key)}
      className="group flex w-full items-center gap-4 px-4 py-2.5 text-left transition-colors hover:bg-[#F9FAFB]"
    >
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex items-center gap-2">
          <span className="truncate text-[13px] font-medium text-[#364658]">{r.p.name}</span>
          {r.p.version && <span className="flex-shrink-0 text-[12px] text-[#7B8FA5]">{r.p.version}</span>}
          {r.p.key === OS_PRODUCT_KEY && (
            <span className="flex-shrink-0 rounded-sm bg-[#F1F5F9] px-1.5 py-0.5 text-[11px] text-[#64748B]">catch-all</span>
          )}
          {r.p.status === 'Pending' && (
            <span className="flex-shrink-0 rounded-sm bg-[#FEF7E6] px-1.5 py-0.5 text-[11px] text-[#B45309]">scanning</span>
          )}
        </span>
        <span className="mt-0.5 truncate text-[12px] text-[#9CA3AF]" title={r.p.path}>{r.p.path}</span>
      </span>

      {/* What is in it — the reason the row is worth opening. */}
      <span className="hidden w-[120px] flex-shrink-0 text-right text-[12px] tabular-nums text-[#7B8FA5] sm:block">
        {r.components.toLocaleString()} components
      </span>
      <span className="hidden w-[132px] flex-shrink-0 items-center gap-1 md:flex">
        {r.types.map((t) => (
          <span key={t} className="rounded-sm bg-[#EFF6FC] px-1.5 py-0.5 text-[11px] text-[#3D8BD0]">{t}</span>
        ))}
      </span>
      <span className="hidden w-[92px] flex-shrink-0 text-right text-[12px] text-[#9CA3AF] lg:block">{r.p.lastScan}</span>

      <span
        className={`inline-flex h-[20px] min-w-[20px] flex-shrink-0 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold ${
          r.p.findings > 0 ? 'bg-[#FEF7E6] text-[#D97706]' : 'bg-[#EEF2F6] text-[#94A3B8]'
        }`}
        title={r.p.findings > 0 ? `${r.p.findings} vulnerable component${r.p.findings === 1 ? '' : 's'}` : 'No findings'}
      >{r.p.findings}</span>
      <ChevronRight size={15} className="flex-shrink-0 text-[#CBD5E1] transition-colors group-hover:text-[#3D8BD0]" />
    </button>
  );
}

function GroupHead({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 border-b border-[#F0F2F5] bg-[#FCFDFE] px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#7B8FA5]">
      {icon}{children}
    </div>
  );
}

export function BomProductsOverview({ endpointId, products, onOpen, onManagePaths, onScan }: {
  endpointId: string;
  products: BomProduct[];
  onOpen: (productKey: string) => void;
  /* Both actions used to live in the scoped view's control bar. They are host-level, not
     product-level, so they belong on the screen that is about the host. */
  onManagePaths: () => void;
  onScan: () => void;
}) {
  const [q, setQ] = useState('');

  const rows: ProductRow[] = useMemo(() => products.map((p) => ({
    p,
    components: componentCount(endpointId, p.key, 'SBOM'),
    /* Which BOM types this scope actually has content for. An empty AI BOM is not a thing to go
       and look at, so it is not offered as one. */
    types: TYPES.filter((t) => componentCount(endpointId, p.key, t) > 0),
  })), [endpointId, products]);

  const query = q.trim().toLowerCase();
  const filtered = query
    ? rows.filter((r) => r.p.name.toLowerCase().includes(query)
      || (r.p.version ?? '').toLowerCase().includes(query)
      || r.p.path.toLowerCase().includes(query))
    : rows;

  /* Grouped, not just sorted. Ranking everything by findings would reorder the whole list every
     time a scan lands; two groups keep the signal at the top AND keep the clean scopes in a
     predictable order underneath. */
  const attention = filtered.filter((r) => r.p.findings > 0).sort((a, b) => b.p.findings - a.p.findings || a.p.name.localeCompare(b.p.name));
  const clean = filtered.filter((r) => r.p.findings === 0).sort((a, b) => a.p.name.localeCompare(b.p.name));
  const totalFindings = rows.reduce((n, r) => n + r.p.findings, 0);

  return (
    <div className="px-6 py-5">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold text-[#364658]">
            Products on this host <span className="ml-1 text-[#7B8FA5]">{products.length}</span>
          </h3>
          <p className="mt-1 text-[13px] text-[#7B8FA5]">
            {totalFindings > 0
              ? <>Open a product to see its Bill of Materials. <span className="font-medium text-[#D97706]">{attention.length} of {products.length}</span> {attention.length === 1 ? 'has' : 'have'} vulnerable components.</>
              : <>Open a product to see its Bill of Materials. No vulnerable components on this host.</>}
          </p>
        </div>

        <div className="flex flex-shrink-0 items-center gap-2">
        {products.length > SEARCH_FROM && (
          <div className="relative w-[260px] flex-shrink-0">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search products…"
              className="h-9 w-full rounded border border-[#DFE5ED] bg-white pl-9 pr-8 text-[13px] text-[#364658] placeholder:text-[#9CA3AF] focus:border-[#3D8BD0] focus:outline-none focus:ring-1 focus:ring-[#3D8BD0]"
            />
            {q && (
              <button onClick={() => setQ('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#364658]">
                <X size={14} />
              </button>
            )}
          </div>
        )}
        <button
          onClick={onManagePaths}
          title="Manage products"
          className="flex size-9 flex-shrink-0 items-center justify-center rounded border border-[#DFE5ED] bg-white text-[#7B8FA5] transition-colors hover:border-[#3D8BD0] hover:bg-[#F5F7FA] hover:text-[#3D8BD0]"
        ><Settings size={16} /></button>
        <button
          onClick={onScan}
          className="inline-flex h-9 flex-shrink-0 items-center gap-1.5 rounded bg-[#3D8BD0] px-3 text-[13px] font-medium text-white transition-colors hover:bg-[#3479b5]"
        ><ScanLine size={15} /> Scan BOM</button>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-[#E5E7EB] bg-white">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-1.5 px-4 py-12 text-center">
            <Boxes size={20} className="text-[#CBD5E1]" />
            <span className="text-[13px] text-[#7B8FA5]">No product matches “{q}”.</span>
          </div>
        ) : (
          <>
            {attention.length > 0 && (
              <>
                <GroupHead icon={<AlertTriangle size={12} className="text-[#D97706]" />}>
                  Needs attention · {attention.length}
                </GroupHead>
                <div className="divide-y divide-[#F0F2F5]">{attention.map((r) => <Row key={r.p.key} r={r} onOpen={onOpen} />)}</div>
              </>
            )}
            {clean.length > 0 && (
              <>
                <GroupHead icon={<ShieldCheck size={12} className="text-[#22A06B]" />}>
                  No findings · {clean.length}
                </GroupHead>
                <div className="divide-y divide-[#F0F2F5]">{clean.map((r) => <Row key={r.p.key} r={r} onOpen={onOpen} />)}</div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
