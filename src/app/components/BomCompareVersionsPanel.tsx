import { useState, useEffect } from 'react';
import { X, Search, ChevronDown, ChevronLeft, ChevronRight, Check, ShieldAlert, SlidersHorizontal, CirclePlus, CircleMinus, RefreshCw, CircleDashed, ExternalLink, Folder, List as ListIcon, Columns2 } from 'lucide-react';
import { BomDiffView } from './BomDiffView';
import type { DiffKind } from './BomDiffView';
import { bomDiff, bomVersions, componentCount, bomCiId } from './bomData';
import type { BomType, BomProduct, BomDiffEntry } from './bomData';
import { useDrawerStack } from './DrawerStack';
import { mockDetectedCves, cveToPatchShape } from './DetectedCvesListPage';
import type { DetectedCve } from './DetectedCvesListPage';

/* Compare two versions of one BOM scope — a side drawer, so the version rail stays behind it.
 * Reading order in the All tab: the components carrying CVEs first (that is why anyone opens a
 * diff), then Added / Updated / Removed / Unchanged as their own sections. */

const KIND_META: Record<BomDiffEntry['kind'], { color: string; bg: string; text: string; Icon: typeof CirclePlus }> = {
  Added: { color: '#22C55E', bg: '#ECFDF3', text: '#22A06B', Icon: CirclePlus },
  Updated: { color: '#F59E0B', bg: '#FEF7E6', text: '#D97706', Icon: RefreshCw },
  Removed: { color: '#EF4444', bg: '#FEF3F2', text: '#DC2626', Icon: CircleMinus },
  Unchanged: { color: '#94A3B8', bg: '#F1F5F9', text: '#64748B', Icon: CircleDashed },
};

type TabKey = 'CVEs' | 'Added' | 'Updated' | 'Removed' | 'Unchanged';
const KINDS: BomDiffEntry['kind'][] = ['Added', 'Updated', 'Removed', 'Unchanged'];

/** How a comparison tab maps onto the document diff. CVEs has no line-level equivalent — a
 *  vulnerability is a property of a package, not of a line — so it spotlights nothing. */
const TAB_TO_DIFF_KIND: Record<TabKey, DiffKind | null> = {
  CVEs: null, Added: 'inserted', Updated: 'modified', Removed: 'deleted', Unchanged: 'same',
};

/** A BOM CVE id may not be in the detected-CVE catalog — synthesise a consistent record so the
 *  link always lands on a real detail page. */
const cveRecord = (id: string): DetectedCve => {
  const known = mockDetectedCves.find((c) => c.id === id);
  if (known) return known;
  const h = [...id].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 0);
  const sev = (['Critical', 'High', 'Medium'] as const)[h % 3];
  return {
    id,
    description: `${id} — vulnerability reported against a component in this Bill of Materials`,
    severity: sev,
    cweId: `CWE-${100 + (h % 800)}`,
    impactedEndpoints: 1 + (h % 40),
    patchAvailability: h % 4 === 0 ? 'No' : 'Yes',
    cvssScore: Number((4 + (h % 60) / 10).toFixed(1)),
    exploitStatus: h % 5 === 0 ? 'Yes' : 'No',
    publishedDate: 'Tue, Jun 11, 2024 10:45 PM',
    status: 'Modified',
  };
};

/** One version end of the comparison — a single line, so it sits level with the scope select:
 *  "v3, Jun 14, 2026 (99)". The same shape repeats in the dropdown. */
function VersionBox({
  value, options, onChange, dateOf, countOf,
}: {
  value: number;
  options: number[];
  onChange: (v: number) => void;
  dateOf: (v: number) => string;
  countOf: () => number;
}) {
  const [open, setOpen] = useState(false);
  const label = (v: number) => (
    <>
      <span className="font-semibold text-[#364658]">v{v}</span>
      <span className="text-[#364658]">, {dateOf(v)} </span>
      <span className="text-[#7B8FA5]">({countOf()})</span>
    </>
  );
  return (
    <div className="relative w-[220px] flex-shrink-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-9 w-full items-center justify-between gap-2 rounded border border-[#DFE5ED] bg-white px-3 text-left text-[13px] transition-colors hover:border-[#3D8BD0]"
      >
        <span className="truncate">{label(value)}</span>
        <ChevronDown size={15} className={`flex-shrink-0 text-[#7B8FA5] transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-50 mt-1 w-full rounded-lg border border-[#DFE5ED] bg-white py-1 shadow-lg">
            {options.map((o) => (
              <button
                key={o}
                onClick={() => { onChange(o); setOpen(false); }}
                className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[13px] transition-colors ${
                  o === value ? 'bg-[#F5FAFF]' : 'hover:bg-[#F9FAFB]'
                }`}
              >
                <span className="truncate">{label(o)}</span>
                {o === value && <Check size={15} className="flex-shrink-0 text-[#3D8BD0]" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

interface RowProps {
  e: BomDiffEntry;
  /** Critical rows lead with a category pill + CVE count; section rows carry only the colour. */
  showKindPill: boolean;
  onOpenCve: (id: string) => void;
  /** CVE rows open on arrival — the metadata and the CVE links are the reason to be there. */
  defaultOpen?: boolean;
}

function DiffRow({ e, showKindPill, onOpenCve, defaultOpen = false }: RowProps) {
  const [open, setOpen] = useState(defaultOpen);
  const meta = KIND_META[e.kind];
  const cves = e.cves ?? [];

  return (
    // Colour-coded left edge — the fastest way to scan a long mixed list.
    <div className="overflow-hidden rounded border border-[#E5E7EB] border-l-[3px] bg-white" style={{ borderLeftColor: meta.color }}>
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-[#F9FAFB]">
        {/* Icon repeats the colour for anyone who cannot rely on the edge alone */}
        {!showKindPill && <meta.Icon size={15} className="flex-shrink-0" style={{ color: meta.color }} />}
        <span className="truncate font-mono text-[13px] font-semibold text-[#364658]">{e.name}</span>
        {showKindPill && (
          <span
            className="flex-shrink-0 rounded-sm px-2 py-0.5 text-[11px] font-medium"
            style={{ backgroundColor: meta.bg, color: meta.text }}
          >{e.kind}</span>
        )}
        {/* The CVE pill is NOT tied to showKindPill — inside a single category tab it is the
            only thing separating a vulnerable component from a clean one. */}
        {cves.length > 0 && (
          <span className="inline-flex flex-shrink-0 items-center gap-1 rounded-sm bg-[#FEF3F2] px-1.5 py-0.5 text-[11px] font-semibold text-[#DC2626]">
            <ShieldAlert size={11} />{cves.length} CVE
          </span>
        )}
        <span className="ml-auto flex flex-shrink-0 items-center gap-1.5 font-mono text-[13px]">
          {e.fromVersion && <span className="text-[#9CA3AF] line-through">{e.fromVersion}</span>}
          {e.fromVersion && <ChevronRight size={13} className="text-[#9CA3AF]" />}
          <span className="font-semibold text-[#364658]">{e.version}</span>
        </span>
        <ChevronDown size={15} className={`flex-shrink-0 text-[#9CA3AF] transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Expanded detail stays on the same white surface — a hairline, not a second panel */}
      {open && (
        <div className="border-t border-[#F0F2F5] px-3 pb-3 pt-3">
          {/* Component identity on ONE row — PURL and the version change get the wider tracks,
              since they carry the longest values. Everything truncates rather than wrapping. */}
          <div
            className="grid gap-x-5"
            style={{ gridTemplateColumns: '2.4fr 1fr 1.1fr 1.1fr 1.2fr 1.6fr' }}
          >
            {([
              ['PURL', e.purl, true],
              ['Ecosystem', e.ecosystem, false],
              ['License', e.license, false],
              ['Origin', e.origin, false],
              ['Component Type', e.componentType, false],
            ] as const).map(([label, value, mono]) => (
              <div key={label} className="min-w-0">
                <div className="text-[11px] uppercase tracking-wide text-[#7B8FA5]">{label}</div>
                <div
                  className={`mt-0.5 truncate text-[13px] text-[#364658] ${mono ? 'font-mono' : ''}`}
                  title={value || undefined}
                >{value || '—'}</div>
              </div>
            ))}

            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-wide text-[#7B8FA5]">Version change</div>
              <div className="mt-0.5 truncate font-mono text-[13px] text-[#364658]">
                {e.fromVersion ? (
                  <>
                    <span className="text-[#9CA3AF]">{e.fromVersion}</span>
                    <span className="mx-1.5 text-[#9CA3AF]">→</span>
                    <span className="font-semibold">{e.version}</span>
                    {e.bump && <span className="ml-1.5 text-[#7B8FA5]">· {e.bump}</span>}
                  </>
                ) : (
                  <>
                    <span className="font-semibold">{e.version}</span>
                    <span className="ml-1.5 font-sans text-[13px]" style={{ color: meta.text }}>· {e.kind}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {cves.length > 0 && (
            <div className="mt-3.5 border-t border-[#F0F2F5] pt-3">
              <div className="mb-1.5 text-[11px] uppercase tracking-wide text-[#7B8FA5]">
                Vulnerabilities · {cves.length}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {cves.map((c) => (
                  <button
                    key={c}
                    onClick={() => onOpenCve(c)}
                    title="Open this vulnerability's detail page"
                    className="inline-flex items-center gap-1.5 rounded-sm bg-[#FEF3F2] px-2 py-1 font-mono text-[12px] font-medium text-[#DC2626] transition-colors hover:bg-[#FEE4E2]"
                  >
                    {c}<ExternalLink size={11} />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface BomCompareVersionsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  endpointId: string;
  hostName: string;
  products: BomProduct[];
  productKey: string;
  type: BomType;
  /** Rendered width — a caller that opened this from its own drawer insets it. */
  width?: number;
  /** Names what dismissing this returns to. Set when it is stacked on another drawer. */
  backLabel?: string;
}

export function BomCompareVersionsPanel({
  isOpen, onClose, endpointId, hostName, products, productKey, type, width, backLabel,
}: BomCompareVersionsPanelProps) {
  const [scopeKey, setScopeKey] = useState(productKey);
  const [showScopes, setShowScopes] = useState(false);
  const [newer, setNewer] = useState(0);
  const [older, setOlder] = useState(0);
  const [tab, setTab] = useState<TabKey>('CVEs');
  const [view, setView] = useState<'list' | 'diff'>('list');
  const [search, setSearch] = useState('');
  // One filter popup holds every dimension, so the toolbar stays a search box and an icon.
  const [showFilter, setShowFilter] = useState(false);
  const [kindFilter, setKindFilter] = useState<string[]>([]);
  const [ecoFilter, setEcoFilter] = useState<string[]>([]);
  const [cveOnly, setCveOnly] = useState(false);

  const { open: openInStack } = useDrawerStack();
  const openCve = (id: string) => {
    const rec = cveRecord(id);
    openInStack('detected-cves', rec.id, rec.description, cveToPatchShape(rec));
  };

  const scope = products.find((p) => p.key === scopeKey) ?? products[0];
  const versions = scope ? bomVersions(endpointId, scope.key, type) : [];
  const nums = versions.map((v) => v.v).sort((a, b) => b - a);

  useEffect(() => {
    if (!isOpen) return;
    setScopeKey(productKey); setTab('CVEs'); setSearch('');
    setKindFilter([]); setEcoFilter([]); setCveOnly(false); setShowFilter(false);
  }, [isOpen, productKey, type]);

  useEffect(() => {
    if (!isOpen) return;
    const vs = (scope ? bomVersions(endpointId, scope.key, type) : []).map((v) => v.v).sort((a, b) => b - a);
    setNewer(vs[0] ?? 0);
    setOlder(vs[1] ?? vs[0] ?? 0);
  }, [isOpen, scopeKey, type, endpointId]);

  if (!isOpen || !scope) return null;

  const dateOf = (v: number) => versions.find((x) => x.v === v)?.generatedAt.split(' ').slice(0, 3).join(' ') ?? '—';
  const countOf = () => componentCount(endpointId, scope.key, type);

  // Always diff oldest → newest, whichever box holds which, so the labels stay truthful.
  const lo = Math.min(newer, older);
  const hi = Math.max(newer, older);
  const diff = lo === hi
    ? { added: [], updated: [], removed: [], unchangedEntries: [], unchanged: 0 }
    : bomDiff(endpointId, scope.key, type, lo, hi);

  const byKind: Record<BomDiffEntry['kind'], BomDiffEntry[]> = {
    Added: diff.added, Updated: diff.updated, Removed: diff.removed, Unchanged: diff.unchangedEntries,
  };
  const everything = [...diff.added, ...diff.updated, ...diff.removed, ...diff.unchangedEntries];

  // CVEs leads — the vulnerable packages are why anyone opens a diff. "All" is gone: it
  // duplicated the four category tabs underneath it.
  const cveCarriers = everything.filter((e) => (e.cves?.length ?? 0) > 0);
  const TABS: { key: TabKey; n: number }[] = [
    { key: 'CVEs', n: cveCarriers.reduce((n, e) => n + (e.cves?.length ?? 0), 0) },
    ...KINDS.map((k) => ({ key: k as TabKey, n: byKind[k].length })),
  ];

  const ecosystems = Array.from(new Set(everything.map((e) => e.ecosystem).filter(Boolean))).sort();
  const activeFilters = kindFilter.length + ecoFilter.length + (cveOnly ? 1 : 0);

  const q = search.trim().toLowerCase();
  const passes = (e: BomDiffEntry) =>
    (!q || e.name.toLowerCase().includes(q)) &&
    (kindFilter.length === 0 || kindFilter.includes(e.kind)) &&
    (ecoFilter.length === 0 || ecoFilter.includes(e.ecosystem)) &&
    (!cveOnly || (e.cves?.length ?? 0) > 0);

  // CVEs tab keeps the same four-way split, but only the packages that carry vulnerabilities.
  const cveRows = (k: BomDiffEntry['kind']) => byKind[k].filter((e) => (e.cves?.length ?? 0) > 0).filter(passes);
  const sectionRows = (k: BomDiffEntry['kind']) => byKind[k].filter(passes);

  const toggle = (list: string[], set: (v: string[]) => void, v: string) =>
    set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const visibleCount = tab === 'CVEs'
    ? KINDS.reduce((n, k) => n + cveRows(k).length, 0)
    : byKind[tab as BomDiffEntry['kind']].filter(passes).length;

  const SectionHeader = ({ k, n }: { k: BomDiffEntry['kind']; n: number }) => {
    const m = KIND_META[k];
    return (
      <div className="mb-2 flex items-center gap-2">
        <m.Icon size={15} style={{ color: m.color }} />
        <span className="text-[12px] font-semibold uppercase tracking-wide" style={{ color: m.text }}>{k}</span>
        <span className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#EEF2F6] px-1 text-[11px] font-semibold text-[#64748B]">{n}</span>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[10010] flex items-center justify-end bg-black/40">
      {/* Wide enough that an expanded component's six identity fields sit on one line */}
      {/* `width` lets a caller inset this panel inside the drawer that opened it, so the drawer
          underneath stays visible as the level it came from. Default unchanged. */}
      <div className="flex h-full max-w-[96vw] flex-col bg-white shadow-xl" style={{ width: width ?? 1240 }}>
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-[#DFE5ED] px-5 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            {backLabel && (
              <button
                onClick={onClose}
                title={`Back to ${backLabel}`}
                className="flex size-8 flex-shrink-0 items-center justify-center rounded border border-[#DFE5ED] text-[#7B8FA5] transition-colors hover:border-[#3D8BD0] hover:bg-[#F5F7FA] hover:text-[#3D8BD0]"
              ><ChevronLeft size={16} /></button>
            )}
            <div className="min-w-0">
              <h3 className="text-[16px] font-semibold text-[#364658]">Compare BOMs</h3>
              <p className="mt-0.5 text-[13px] text-[#7B8FA5]">{bomCiId(endpointId)} · {hostName} · {type}</p>
            </div>
          </div>
          <button onClick={onClose} className="flex size-8 flex-shrink-0 items-center justify-center rounded text-[#7B8FA5] transition-colors hover:bg-[#F3F4F6] hover:text-[#364658]">
            <X size={18} />
          </button>
        </div>

        {/* Versions lead — they are what is being compared. The scope is settled context, so it
            reads as a value with a way to change it rather than a second picker. */}
        <div className="flex flex-wrap items-end gap-x-8 gap-y-3 border-b border-[#F0F2F5] px-5 py-4">
          <div>
            <div className="mb-1.5 text-[12px] font-medium text-[#7B8FA5]">Compare versions</div>
            <div className="flex items-center gap-2">
              <VersionBox value={newer} options={nums} onChange={setNewer} dateOf={dateOf} countOf={countOf} />
              <span className="flex-shrink-0 text-[13px] text-[#7B8FA5]">with</span>
              <VersionBox value={older} options={nums} onChange={setOlder} dateOf={dateOf} countOf={countOf} />
            </div>
          </div>

          {/* The path is now a CONTROL, not a read-out with a link beside it. "in <path>" finishes
              the sentence the version pickers start, and one pill does the job the old
              "Scanned path : X" + "Change path" pair did in two. */}
          <div className="flex h-9 items-center gap-2">
            <span className="flex-shrink-0 text-[13px] text-[#7B8FA5]">in</span>
            <div className="relative">
              <button
                onClick={() => setShowScopes((v) => !v)}
                className={`inline-flex h-9 max-w-[340px] items-center gap-2 rounded border bg-white px-3 text-[13px] transition-colors ${
                  showScopes ? 'border-[#3D8BD0]' : 'border-[#DFE5ED] hover:border-[#3D8BD0]'
                }`}
              >
                <Folder size={14} className="flex-shrink-0 text-[#7B8FA5]" />
                <span className="truncate font-semibold text-[#364658]" title={scope.name}>{scope.name}</span>
                {scope.version && <span className="flex-shrink-0 text-[#7B8FA5]">{scope.version}</span>}
                {/* A hairline where the reference sketch has a slash: the path already contains
                    "OS / base platform", so a trailing "/" would read as a truncated path. */}
                <span className="h-4 w-px flex-shrink-0 bg-[#E5E7EB]" />
                <ChevronDown size={15} className={`flex-shrink-0 text-[#7B8FA5] transition-transform ${showScopes ? 'rotate-180' : ''}`} />
              </button>
              {showScopes && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowScopes(false)} />
                  <div className="absolute left-0 top-full z-50 mt-1 w-[320px] rounded-lg border border-[#DFE5ED] bg-white py-1 shadow-lg">
                    <div className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-[#7B8FA5]">Scanned paths on this host</div>
                    {products.map((p) => (
                      <button
                        key={p.key}
                        onClick={() => { setScopeKey(p.key); setShowScopes(false); }}
                        className={`flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] transition-colors ${
                          p.key === scopeKey ? 'bg-[#F5FAFF] font-medium text-[#3D8BD0]' : 'text-[#364658] hover:bg-[#F9FAFB]'
                        }`}
                      >
                        <Folder size={14} className={`flex-shrink-0 ${p.key === scopeKey ? 'text-[#3D8BD0]' : 'text-[#9CA3AF]'}`} />
                        <span className="truncate">{p.name}{p.version && <span className="ml-1.5 text-[#7B8FA5]">{p.version}</span>}</span>
                        {p.key === scopeKey && <Check size={15} className="ml-auto flex-shrink-0 text-[#3D8BD0]" />}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* View toggle — belongs to the comparison as a whole, so it sits on this row and the
              version pickers above stay put when the view changes. */}
          <div className="ml-auto inline-flex items-center gap-1 rounded border border-[#DFE5ED] p-0.5">
            {(['list', 'diff'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`inline-flex h-7 items-center gap-1.5 rounded px-2.5 text-[13px] font-medium transition-colors ${
                  view === v ? 'bg-[#3D8BD0] text-white' : 'text-[#364658] hover:bg-[#F5F7FA]'
                }`}
              >
                {v === 'list' ? <ListIcon size={14} /> : <Columns2 size={14} />}
                {v === 'list' ? 'List' : 'Diff'}
              </button>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2.5 border-b border-[#e5e7eb] px-5">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 whitespace-nowrap border-b-2 px-2 py-3 text-[14px] font-medium transition-colors ${
                tab === t.key ? 'border-[#3D8BD0] text-[#3D8BD0]' : 'border-transparent text-[#6b7280] hover:border-[#CBD5E1] hover:bg-[#F5F7FA] hover:text-[#364658]'
              }`}
            >
              {t.key}
              <span className={`rounded px-1 py-0.5 text-[12px] font-medium ${tab === t.key ? 'bg-[#E8F4FD] text-[#3D8BD0]' : 'bg-[#E5E7EB] text-[#364658]'}`}>{t.n}</span>
            </button>
          ))}
        </div>

        {/* Search + one filter icon — list view only; the diff has its own per-pane search */}
        <div className={`flex items-center gap-2 px-5 pt-3 ${view === 'diff' ? 'hidden' : ''}`}>
          <div className="relative flex-1">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search components..."
              className="h-8 w-full rounded border border-[#d1d5db] bg-white pl-3 pr-10 text-[13px] text-[#364658] placeholder:text-[#9ca3af] focus:border-[#3D8BD0] focus:outline-none focus:ring-1 focus:ring-[#3D8BD0]"
            />
            {search ? (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9ca3af] hover:text-[#364658]"><X size={16} /></button>
            ) : (
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9ca3af]" size={16} />
            )}
          </div>
          <div className="relative flex-shrink-0">
            <button
              onClick={() => setShowFilter((v) => !v)}
              title="Filter"
              className={`flex h-8 items-center gap-1.5 rounded border px-2.5 transition-colors ${
                activeFilters > 0 || showFilter
                  ? 'border-[#3D8BD0] bg-[#EBF5FF] text-[#3D8BD0]'
                  : 'border-[#DFE5ED] bg-white text-[#7B8FA5] hover:bg-[#F5F7FA] hover:text-[#364658]'
              }`}
            >
              <SlidersHorizontal size={16} />
              {activeFilters > 0 && (
                <span className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#3D8BD0] px-1 text-[11px] font-semibold text-white">{activeFilters}</span>
              )}
            </button>
            {showFilter && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowFilter(false)} />
                <div className="absolute right-0 top-full z-50 mt-1 w-[280px] rounded-lg border border-[#DFE5ED] bg-white py-1 shadow-lg">
                  <div className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-[#7B8FA5]">Change</div>
                  {KINDS.map((k) => (
                    <button
                      key={k}
                      onClick={() => toggle(kindFilter, setKindFilter, k)}
                      className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[13px] text-[#364658] transition-colors hover:bg-[#F9FAFB]"
                    >
                      <span className="inline-flex items-center gap-2">
                        <span className="size-2 rounded-full" style={{ backgroundColor: KIND_META[k].color }} />
                        {k}
                      </span>
                      {kindFilter.includes(k) && <Check size={15} className="text-[#3D8BD0]" />}
                    </button>
                  ))}

                  <div className="my-1 border-t border-[#F0F2F5]" />
                  <button
                    onClick={() => setCveOnly((v) => !v)}
                    className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[13px] text-[#364658] transition-colors hover:bg-[#F9FAFB]"
                  >
                    <span className="inline-flex items-center gap-2"><ShieldAlert size={14} className="text-[#DC2626]" />With vulnerabilities</span>
                    {cveOnly && <Check size={15} className="text-[#3D8BD0]" />}
                  </button>

                  {ecosystems.length > 0 && (
                    <>
                      <div className="my-1 border-t border-[#F0F2F5]" />
                      <div className="px-3 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wide text-[#7B8FA5]">Ecosystem</div>
                      <div className="max-h-[160px] overflow-y-auto">
                        {ecosystems.map((eco) => (
                          <button
                            key={eco}
                            onClick={() => toggle(ecoFilter, setEcoFilter, eco)}
                            className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[13px] text-[#364658] transition-colors hover:bg-[#F9FAFB]"
                          >
                            <span className="truncate">{eco}</span>
                            {ecoFilter.includes(eco) && <Check size={15} className="flex-shrink-0 text-[#3D8BD0]" />}
                          </button>
                        ))}
                      </div>
                    </>
                  )}

                  <div className="mt-1 flex items-center justify-between border-t border-[#F0F2F5] px-3 py-2">
                    <button
                      onClick={() => { setKindFilter([]); setEcoFilter([]); setCveOnly(false); }}
                      className="text-[12px] font-medium text-[#3D8BD0] hover:underline"
                    >Clear all</button>
                    <button
                      onClick={() => setShowFilter(false)}
                      className="inline-flex h-7 items-center rounded bg-[#3D8BD0] px-2.5 text-[12px] font-medium text-white transition-colors hover:bg-[#3479b5]"
                    >Done</button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Diff view — the two CycloneDX documents, line by line. The active tab spotlights its
            change kind inside the diff, so the tab strip means the same thing in both views. */}
        {view === 'diff' && (
          lo === hi ? (
            <div className="py-14 text-center text-[13px] text-[#9CA3AF]">Pick two different versions to compare.</div>
          ) : (
            <BomDiffView
              endpointId={endpointId}
              productKey={scope.key}
              type={type}
              older={lo}
              newer={hi}
              spotlight={TAB_TO_DIFF_KIND[tab]}
            />
          )
        )}

        {/* Body */}
        <div className={`min-h-0 flex-1 overflow-y-auto px-5 py-4 ${view === 'diff' ? 'hidden' : ''}`}>
          {lo === hi ? (
            <div className="py-14 text-center text-[13px] text-[#9CA3AF]">Pick two different versions to compare.</div>
          ) : visibleCount === 0 ? (
            <div className="py-14 text-center text-[13px] text-[#9CA3AF]">No components match your search and filters.</div>
          ) : tab === 'CVEs' ? (
            /* Vulnerable packages only, still split by what the version did to them — a CVE that
               arrived with an added package is a different problem from one that was already
               there and stayed. */
            <>
              {KINDS.map((k) => {
                const rows = cveRows(k);
                if (!rows.length) return null;
                return (
                  <div key={k} className="mb-10">
                    <SectionHeader k={k} n={rows.length} />
                    {/* Collapsed like every other tab — an expanded list of vulnerable
                        components is the hardest one to scan, not the easiest. */}
                    <div className="space-y-2">
                      {rows.map((e, i) => (
                        <DiffRow key={`cve-${k}-${e.name}-${i}`} e={e} showKindPill onOpenCve={openCve} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </>
          ) : (
            <div className="space-y-2">
              {byKind[tab as BomDiffEntry['kind']].filter(passes).map((e, i) => (
                <DiffRow key={`${tab}-${e.name}-${i}`} e={e} showKindPill={false} onOpenCve={openCve} />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-[#F0F2F5] px-5 py-3 text-center text-[12px] text-[#7B8FA5]">
          Comparing v{lo} → v{hi} of {scope.name} · {diff.unchanged} unchanged
        </div>
      </div>
    </div>
  );
}
