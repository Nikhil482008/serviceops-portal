import { useState, useEffect, useRef } from 'react';
import { X, Search, Download, Filter, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { Pagination } from './Pagination';
import { BomFilterSearch, matches } from './BomFilterSearch';
import type { Condition } from './BomFilterSearch';
import { bomComponents, bomCryptoAssets, bomAiAssets, bomDiff, bomCiId, bomDependencies } from './bomData';
import { describeAiAsset, KIND_TITLE } from './aiModelsData';
import { BomDependencyTree } from './BomDependencyTree';
import type { BomType } from './bomData';

/* Side drawer listing every record in ONE BOM scope — opened from "View components / crypto
 * assets / models · N" on a version card. Columns differ per BOM type; filtering is a single
 * search box that builds field → operator → value conditions, so adding a column never adds
 * another select to the toolbar. */

const ORIGIN_STYLE: Record<string, { bg: string; text: string }> = {
  'Open-source': { bg: '#ECFDF3', text: '#22A06B' },
  Proprietary: { bg: '#EFF6FF', text: '#3D8BD0' },
  'Third-party': { bg: '#FEF7E6', text: '#D97706' },
};
const COMPLIANCE_STYLE: Record<string, { bg: string; text: string }> = {
  Compliant: { bg: '#ECFDF3', text: '#22A06B' },
  Deprecated: { bg: '#FEF7E6', text: '#D97706' },
  'Quantum-vulnerable': { bg: '#FEF3F2', text: '#DC2626' },
};
/** What this version did to a component — the listing leads with these before the unchanged bulk. */
const CHANGE_STYLE: Record<string, { bg: string; text: string }> = {
  Added: { bg: '#ECFDF3', text: '#22A06B' },
  Updated: { bg: '#FEF7E6', text: '#D97706' },
  Removed: { bg: '#FEF3F2', text: '#DC2626' },
  Unchanged: { bg: '#F1F5F9', text: '#64748B' },
};
const CHANGE_ORDER: Record<string, number> = { Added: 0, Updated: 1, Removed: 2, Unchanged: 3 };

function TintPill({ value, map }: { value: string; map: Record<string, { bg: string; text: string }> }) {
  const s = map[value] ?? { bg: '#F1F5F9', text: '#64748B' };
  return (
    <span className="inline-block rounded-sm px-2 py-0.5 text-[12px] font-medium" style={{ backgroundColor: s.bg, color: s.text }}>
      {value}
    </span>
  );
}



/** How this version's listing can be narrowed: by what it changed, or by what carries a CVE. */
export type ChangeTab = 'All' | 'CVEs' | 'Added' | 'Updated' | 'Removed' | 'Unchanged';
// CVEs sits second — it is the cut a reviewer makes most often, and it is not a change kind.
const CHANGE_TABS: ChangeTab[] = ['All', 'CVEs', 'Added', 'Updated', 'Removed', 'Unchanged'];

interface BomComponentsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  endpointId: string;
  hostName: string;
  productKey: string;
  productLabel: string;
  type: BomType;
  version: number;
  format: string;
  /** Opened from a version's CVE metric — lead with the vulnerable components. */
  cveFirst?: boolean;
  /** Which change tab to open on — set by whichever count the user clicked. */
  initialTab?: ChangeTab;
  /** Opened from a component's "Installed on" list: land on the dependency tree, already looking
   *  at that component. The question that got the user here is "why is this on this host", and
   *  the flat list cannot answer it. */
  focusComponent?: string;
  /** Rendered width. A caller that opened this from its own drawer passes a smaller one so the
   *  level underneath stays visible. */
  width?: number;
  /** Names what dismissing this returns to. Set when it is stacked on another drawer. */
}

export function BomComponentsPanel({
  isOpen, onClose, endpointId, hostName, productKey, productLabel, type, version, format,
  cveFirst = false, initialTab = 'All', focusComponent, width,
}: BomComponentsPanelProps) {
  const [tab, setTab] = useState<ChangeTab>(initialTab);
  /* Two views of the same BOM. The list says WHAT is installed; the tree says why it is here.
     Only SBOM has a graph — a crypto asset or a model has no manifest to resolve. */
  const [view, setView] = useState<'components' | 'dependencies'>(focusComponent && type === 'SBOM' ? 'dependencies' : 'components');
  const [conditions, setConditions] = useState<Condition[]>([]);
  /* Search is hidden until asked for: on a screen whose first move is almost always a tab,
     a permanently open filter bar spends a row on the second-most-likely action. */
  const [searchOpen, setSearchOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);


  useEffect(() => { setCurrentPage(1); }, [conditions]);
  // A different BOM type / scope / version means different columns — start clean.
  useEffect(() => {
    if (!isOpen) return;
    setConditions([]); setSearchOpen(false); setCurrentPage(1);
  }, [isOpen, type, productKey, version]);
  // Each opening honours the count that was clicked, so re-opening on a different metric lands
  // on that metric's tab rather than wherever the panel was last left.
  useEffect(() => {
    if (!isOpen) return;
    setTab(initialTab); setCurrentPage(1);
    /* Only an SBOM resolves a graph. Landing an AI BOM on 'dependencies' would show a
       view its own tab strip does not even offer. */
    setView(focusComponent && type === 'SBOM' ? 'dependencies' : 'components');
  }, [isOpen, initialTab, version, focusComponent, type]);

  if (!isOpen) return null;

  const graph = bomDependencies(endpointId, productKey);
  const title = type === 'SBOM' ? 'Software components' : type === 'CBOM' ? 'Cryptographic assets' : 'AI models';
  const noun = type === 'SBOM' ? 'components' : type === 'CBOM' ? 'crypto assets' : 'models';

  const PROVENANCE_STYLE: Record<string, { bg: string; text: string }> = {
    Verified: { bg: '#ECFDF3', text: '#22A06B' },
    Unverified: { bg: '#FEF3F2', text: '#DC2626' },
    Internal: { bg: '#F1F5F9', text: '#64748B' },
  };
  /* Lifecycle is a phrase, not an enum, so the pill is keyed on what the phrase SAYS: anything
     already past gets the red, anything ahead gets amber, and "Unknown" stays grey rather than
     being coloured as though it were an answer. */
  const lifecycleStyle = (label: string) => (label === 'Unknown'
    ? { bg: '#F1F5F9', text: '#94A3B8' }
    : label.includes('ago') ? { bg: '#FEF3F2', text: '#DC2626' } : { bg: '#FFFAEB', text: '#B45309' });

  // Every row is a field map (drives filtering) plus the cells to render.
  type Cell = string | { pill: string; map: Record<string, { bg: string; text: string }> } | { cves: string[] }
    | { two: [string, string]; tone?: 'LOW' | 'MEDIUM' | 'HIGH' };
  interface Row { id: string; fields: Record<string, string>; cells: Cell[]; mono: number[]; link?: number; cveCount?: number }

  let headers: string[] = [];
  let rows: Row[] = [];

  /* What this version changed. Keyed by name AND version, because a real host carries several
   * BUILDS of the same library and the catalog reflects that — keying on name alone tagged every
   * build of a changed component, so the tab counts disagreed with the version card. The
   * name-only map is the fallback for types whose rows carry no comparable version (CBOM). */
  const diff = version > 1 ? bomDiff(endpointId, productKey, type, version - 1, version) : null;
  const changeOf = new Map<string, string>();
  const changeOfName = new Map<string, string>();
  const tag = (e: { name: string; version: string; fromVersion?: string }, kind: string) => {
    changeOf.set(`${e.name}@${e.version}`, kind);
    // An update is one component at two builds. The grid renders the host's current inventory,
    // so the row may still carry the version it was updated FROM — tag both, or the change
    // silently disappears from the listing while the version card still counts it.
    if (e.fromVersion) changeOf.set(`${e.name}@${e.fromVersion}`, kind);
    changeOfName.set(e.name, kind);
  };
  diff?.added.forEach((e) => tag(e, 'Added'));
  diff?.updated.forEach((e) => tag(e, 'Updated'));
  const change = (name: string, ver?: string) => {
    if (version === 1) return 'Added';
    if (ver !== undefined) return changeOf.get(`${name}@${ver}`) ?? 'Unchanged';
    return changeOfName.get(name) ?? 'Unchanged';
  };

  if (type === 'SBOM') {
    headers = ['Component', 'Version', 'Vulnerabilities', 'Type', 'Ecosystem', 'PURL', 'License', 'Origin'];
    rows = bomComponents(endpointId, productKey).map((c, i) => ({
      id: `${c.name}@${c.version}#${i}`,
      fields: { Component: c.name, Version: c.version, Vulnerabilities: c.cves?.length ? 'Yes' : 'No', Type: c.type, Ecosystem: c.ecosystem, PURL: c.purl, License: c.license, Origin: c.origin },
      cells: [c.name, c.version, { cves: c.cves ?? [] }, c.type, c.ecosystem, c.purl, c.license, { pill: c.origin, map: ORIGIN_STYLE }],
      mono: [0, 1, 5],
      link: 5,
      cveCount: c.cves?.length ?? 0,
    }));
  } else if (type === 'CBOM') {
    // CBOM columns are genuinely different from SBOM: an algorithm has no ecosystem or PURL,
    // it has a primitive, a key length, where it is used and whether it survives PQC migration.
    headers = ['Asset', 'Primitive', 'Algorithm', 'Key Length', 'Protocol', 'Location', 'Expiry', 'Compliance'];
    rows = bomCryptoAssets(endpointId, productKey).map((c, i) => ({
      id: `${c.name}#${i}`,
      fields: { Asset: c.name, Primitive: c.primitive, Algorithm: c.algorithm, 'Key Length': c.keyLength, Protocol: c.protocol, Location: c.location, Expiry: c.expiry ?? '—', Compliance: c.compliance },
      cells: [c.name, c.primitive, c.algorithm, c.keyLength, c.protocol, c.location, c.expiry ?? '—', { pill: c.compliance, map: COMPLIANCE_STYLE }],
      mono: [2, 3, 5],
    }));
  } else {
    /* The AI BOM answers the same three questions the AI Components register does — what it is,
       whether its origin can be attested, what its licence costs, and whether it is still
       supported. Parameter counts and task labels were describing the model rather than judging
       it, which is what a bill of materials is for. */
    headers = ['Component', 'Kind', 'Version', 'Provider / source', 'License · risk', 'Provenance', 'Lifecycle'];
    rows = bomAiAssets(endpointId, productKey).map((m, i) => {
      const row = describeAiAsset(m);
      return {
        id: `${m.name}#${i}`,
        fields: {
          Component: m.name, Kind: row.kind, Version: row.version, 'Provider / source': m.provider,
          'License · risk': `${m.license} · ${row.licenseRisk}`, Provenance: row.provenance,
          Lifecycle: row.lifecycleLabel,
        },
        cells: [
          m.name,
          { two: [KIND_TITLE[row.kind], m.subtitle ?? m.task] },
          row.version,
          m.provider,
          { two: [m.license, row.licenseRisk], tone: row.licenseRisk },
          { pill: row.provenance, map: PROVENANCE_STYLE },
          { pill: row.lifecycleLabel, map: { [row.lifecycleLabel]: lifecycleStyle(row.lifecycleLabel) } },
        ],
        mono: [0],
      };
    });
  }

  // Removed components are no longer in the BOM, but they are part of what this version did —
  // append them so the listing tells the whole change story, then sort changes to the top.
  const nameKey = headers[0];
  // SBOM and AI BOM rows carry a Version column that pins a change to one build; CBOM does not.
  const verKey = headers.includes('Version') ? 'Version' : undefined;
  if (diff) {
    const present = new Set(rows.map((r) => `${r.fields[nameKey] ?? ''}@${verKey ? r.fields[verKey] ?? '' : ''}`));
    diff.removed.forEach((e, i) => {
      tag(e, 'Removed');
      // Only synthesise a row when the component is genuinely gone from the current list —
      // otherwise the existing row just gets tagged Removed and we'd render it twice.
      if (present.has(`${e.name}@${verKey ? e.version : ''}`)) return;
      const blank = headers.slice(1).map((h) => (verKey && h === verKey ? e.version : '—'));
      rows.push({
        id: `removed:${e.name}#${i}`,
        fields: {
          ...Object.fromEntries(headers.map((h) => [h, '—'])),
          [nameKey]: e.name,
          ...(verKey ? { [verKey]: e.version } : {}),
        },
        cells: [e.name, ...blank],
        mono: [0],
      });
    });
  }

  /* The change kind rides on the row as a FIELD, not a column — the tab above already says which
   * change you are looking at, so a column repeating it on every row is dead width. */
  rows = rows
    .map((r) => ({
      ...r,
      fields: { ...r.fields, Change: change(String(r.fields[nameKey] ?? ''), verKey ? String(r.fields[verKey] ?? '') : undefined) },
    }))
    // Arriving from a version's CVE metric, the vulnerable components are the whole point, so
    // they lead — most CVEs first. Otherwise the change order stands.
    .sort((a, b) => {
      if (cveFirst) {
        const d = (b.cveCount ?? 0) - (a.cveCount ?? 0);
        if (d !== 0) return d;
      }
      return CHANGE_ORDER[a.fields.Change] - CHANGE_ORDER[b.fields.Change];
    });

  // Change is a tab, not a searchable column — offering it in the filter builder too would give
  // two controls for one thing that could disagree.
  const fieldNames = (rows.length ? Object.keys(rows[0].fields) : headers).filter((h) => h !== 'Excluded Paths' && h !== 'Change');
  const valuesFor = (field: string) => Array.from(new Set(rows.map((r) => r.fields[field]).filter(Boolean))).sort();

  // Counts come from the unfiltered set, so a tab badge always says how many exist rather than
  // how many survive the current search.
  const inTab = (r: Row, t: ChangeTab) =>
    t === 'All' ? true : t === 'CVEs' ? (r.cveCount ?? 0) > 0 : r.fields.Change === t;
  const tabCount = (t: ChangeTab) => rows.filter((r) => inTab(r, t)).length;
  // Only SBOM rows carry vulnerabilities, so the CVEs tab is offered only where it can mean
  // something rather than sitting permanently at zero.
  const shownTabs = CHANGE_TABS.filter((t) => t !== 'CVEs' || rows.some((r) => (r.cveCount ?? 0) > 0));
  /* The version card counts CVEs; this tab counts the COMPONENTS carrying them, because a tab
   * badge has to match the number of rows behind it. One component can carry several, so the two
   * legitimately differ — the tooltip says so rather than leaving it looking like a bug. */
  const totalCves = rows.reduce((n, r) => n + (r.cveCount ?? 0), 0);

  const filtered = rows
    .filter((r) => inTab(r, tab))
    .filter((r) => conditions.every((c) => matches(r.fields[c.field] ?? '', c)));
  const totalPages = Math.ceil(filtered.length / itemsPerPage) || 1;
  const pageRows = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Export acts on the selection when there is one, otherwise on everything filtered.
  /* Everything on the current cut, always — there is nothing to select, so there is no second
     answer to "what would this export?". */
  const exportCount = filtered.length;

  return (
    <div className="fixed inset-0 z-[10010] flex items-center justify-end bg-black/40">
      {/* `width` lets a caller inset this panel inside the drawer that opened it, so the drawer
          underneath stays visible as the level it came from. Default unchanged. */}
      <div className="flex h-full max-w-[96vw] flex-col bg-white shadow-xl" style={{ width: width ?? 1240 }}>
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-[#DFE5ED] px-5 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="min-w-0">
              <h3 className="truncate text-[16px] font-semibold text-[#364658]">{productLabel}</h3>
              <p className="mt-0.5 truncate text-[13px] text-[#7B8FA5]">{title}</p>
            </div>
          </div>
          {/* An icon-only button with no accessible name announces as "button" and nothing else.
              Every other drawer in this product labels its cross; this one did not. */}
          <button onClick={onClose} aria-label="Close" title="Close" className="flex size-8 flex-shrink-0 items-center justify-center rounded text-[#7B8FA5] transition-colors hover:bg-[#F3F4F6] hover:text-[#364658]">
            <X size={18} />
          </button>
        </div>

        {/* Components vs Dependencies — a different QUESTION, not a different filter, so it
            sits above the change tabs rather than beside them.

            Components leads, and matches what the panel opens on: the list is what the title and
            every count in this panel refer to, so the first tab is the thing you were already
            looking at. Dependencies answers "why is this here", which is the follow-up question,
            not the opening one. (This order was the other way round; a tab strip whose first tab
            is not the default view reads as though something has been skipped.)

            Both use the product's content-tab treatment (2px underline, count badge), the same
            one the change tabs below and the Software Components listing use. A segmented pill
            box here made two levels of tab look like two different KINDS of control. */}
        {type === 'SBOM' && (
          <div className="flex items-center gap-2.5 border-b border-[#EEF2F6] px-5">
            {([
              ['components', 'Components', rows.length],
              ['dependencies', 'Dependencies', graph.edges],
            ] as const).map(([id, label, n]) => (
              <button
                key={id}
                onClick={() => setView(id)}
                className={`flex items-center gap-1.5 whitespace-nowrap border-b-2 px-2 py-3 text-[14px] font-medium transition-colors ${
                  view === id
                    ? 'border-[#3D8BD0] text-[#3D8BD0]'
                    : 'border-transparent text-[#6b7280] hover:border-[#CBD5E1] hover:bg-[#F5F7FA] hover:text-[#364658]'
                }`}
              >
                {label}
                <span className={`rounded px-1 py-0.5 text-[12px] font-medium tabular-nums ${
                  view === id ? 'bg-[#E8F4FD] text-[#3D8BD0]' : 'bg-[#E5E7EB] text-[#364658]'
                }`}>{n.toLocaleString()}</span>
              </button>
            ))}
          </div>
        )}

        {view === 'dependencies' ? (
          <BomDependencyTree
            key={focusComponent ?? 'all'}
            initialQuery={focusComponent ?? ''}
            graph={graph}
            /* The panel already computed what this version changed. Handing the SAME map down
               means the tree's filter counts and the Components tab counts cannot disagree —
               deriving it twice is how they start to. */
            changeOf={(name, ver) => change(name, ver)}
            /* The tree hands off rather than duplicating the list: picking a node returns to
               Components already filtered to it, so there is one place that renders a row. */
            onInspect={(name) => {
              setView('components');
              setTab('All');
              setConditions([{ field: headers[0], op: 'is', value: name }]);
              setCurrentPage(1);
            }}
          />
        ) : (
        <>

        {/* What this version changed. The tab is the first cut a reviewer makes — "show me only
            what came in" — so it sits above the search rather than inside it.

            SECONDARY treatment (bordered pills), not the underline the Components/Dependencies
            row above uses: two levels of tab drawn identically read as one level repeated. */}
        <div className="flex flex-wrap items-center gap-2 border-b border-[#EEF2F6] px-5 py-2.5">
          {shownTabs.map((t) => {
            const n = tabCount(t);
            const on = tab === t;
            // CVEs is a risk cut, not a change kind — its badge stays red so it never reads as
            // one more category of edit.
            const risk = t === 'CVEs' && n > 0;
            return (
              <button
                key={t}
                onClick={() => { setTab(t); setCurrentPage(1); }}
                aria-pressed={on}
                title={t === 'CVEs' ? `${n} component${n === 1 ? '' : 's'} carrying ${totalCves} CVE${totalCves === 1 ? '' : 's'}` : undefined}
                className={`inline-flex h-8 items-center gap-1.5 rounded border px-2.5 text-[13px] font-medium transition-colors ${
                  on
                    ? 'border-[#3D8BD0] bg-[#EBF5FF] text-[#3D8BD0]'
                    : 'border-[#DFE5ED] bg-white text-[#364658] hover:border-[#3D8BD0] hover:bg-[#F5F7FA]'
                }`}
              >
                {t === 'CVEs' && <ShieldAlert size={13} className={risk ? 'text-[#DC2626]' : on ? 'text-[#3D8BD0]' : 'text-[#9CA3AF]'} />}
                {t}
                <span className={`inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[11px] font-semibold tabular-nums ${
                  risk ? 'bg-[#FEF3F2] text-[#DC2626]' : on ? 'bg-[#3D8BD0] text-white' : 'bg-[#EEF2F6] text-[#64748B]'
                }`}>{n}</span>
              </button>
            );
          })}

          {/* Far right of the SAME row: what to take away, and the way to narrow it. */}
          <div className="ml-auto flex flex-shrink-0 items-center gap-2">
            {conditions.length > 0 && (
              <button
                onClick={() => setConditions([])}
                className="inline-flex h-8 items-center gap-1.5 rounded border border-[#DFE5ED] bg-white px-2.5 text-[13px] font-medium text-[#364658] transition-colors hover:bg-[#F5F7FA]"
              >
                <Filter size={14} className="text-[#7B8FA5]" /> Clear all
              </button>
            )}
            <button
              onClick={() => setSearchOpen((v) => !v)}
              aria-pressed={searchOpen}
              title={searchOpen ? 'Hide search' : 'Search and filter'}
              className={`flex size-8 items-center justify-center rounded border transition-colors ${
                searchOpen || conditions.length > 0
                  ? 'border-[#3D8BD0] bg-[#EBF5FF] text-[#3D8BD0]'
                  : 'border-[#DFE5ED] bg-white text-[#7B8FA5] hover:bg-[#F5F7FA] hover:text-[#364658]'
              }`}
            ><Search size={16} /></button>
            {/* Export sits with the controls that decide WHAT gets exported — the tab and the
                search — rather than up in the title bar away from both. */}
            <button
              onClick={() => toast.success(`${exportCount} ${noun} exported`)}
              className="inline-flex h-8 items-center gap-1.5 rounded bg-[#3D8BD0] px-3 text-[13px] font-medium text-white transition-colors hover:bg-[#3479b5]"
            >
              <Download size={15} /> Export
            </button>
          </div>
        </div>

        {/* Search that builds filters — one control instead of a select per column. Its own
            line, full width, so a long stack of filter chips has room to wrap without squeezing
            the buttons it used to sit beside. */}
        {searchOpen && (
        <div className="flex items-start gap-2 border-b border-[#EEF2F6] px-5 py-3">
          <BomFilterSearch
            fields={fieldNames}
            valuesFor={valuesFor}
            conditions={conditions}
            onChange={(next) => { setConditions(next); setCurrentPage(1); }}
          />
        </div>
        )}

        {/* Grid */}
        <div className="min-h-0 flex-1 overflow-auto px-5">
          {/* SBOM carries a long PURL column, so it needs more room than the other two. */}
          <table className={`w-full ${type === 'SBOM' ? 'min-w-[1320px]' : 'min-w-[1180px]'}`}>
            <thead className="sticky top-0 z-10 border-b border-[#e5e7eb] bg-white">
              <tr>
                {headers.map((h) => (
                  <th key={h} className="whitespace-nowrap px-4 py-2.5 text-left text-[12px] font-semibold tracking-wider text-[#364658]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e5e7eb] bg-white">
              {pageRows.length === 0 ? (
                <tr><td colSpan={headers.length} className="px-4 py-12 text-center text-[13px] text-[#9CA3AF]">No {noun} match your filters.</td></tr>
              ) : pageRows.map((r) => (
                <tr key={r.id} className="transition-colors hover:bg-[#f9fafb]">
                  {r.cells.map((c, ci) => (
                    <td key={ci} className="whitespace-nowrap px-4 py-3 text-[12px] text-[#364658]">
                      {typeof c === 'string' ? (
                        <span
                          className={`block max-w-[300px] truncate ${r.mono.includes(ci) ? 'font-mono' : ''} ${r.link === ci ? 'text-[#3D8BD0]' : ''}`}
                          title={c}
                        >{c}</span>
                      ) : 'two' in c ? (
                        /* A value over its qualifier: "Framework / ML framework", "MIT / Low".
                           Two columns would have been two half-empty ones. */
                        <span className="block">
                          <span className="block max-w-[220px] truncate text-[12px] text-[#364658]" title={c.two[0]}>{c.two[0]}</span>
                          {c.tone ? (
                            <span
                              className="mt-0.5 inline-flex items-center rounded-sm px-1.5 py-0.5 text-[11px] font-medium"
                              style={c.tone === 'HIGH'
                                ? { backgroundColor: '#FEF3F2', color: '#B42318' }
                                : c.tone === 'MEDIUM'
                                  ? { backgroundColor: '#FFFAEB', color: '#B54708' }
                                  : { backgroundColor: '#ECFDF3', color: '#22A06B' }}
                            >{c.two[1] === 'LOW' ? 'Low' : c.two[1] === 'MEDIUM' ? 'Medium' : 'High'}</span>
                          ) : (
                            <span className="mt-0.5 block max-w-[220px] truncate text-[11px] text-[#9CA3AF]" title={c.two[1]}>{c.two[1]}</span>
                          )}
                        </span>
                      ) : 'cves' in c ? (
                        c.cves.length ? (
                          <span
                            className="inline-flex items-center gap-1 rounded-sm bg-[#FEF3F2] px-1.5 py-0.5 text-[11px] font-semibold text-[#DC2626]"
                            title={c.cves.join(', ')}
                          >
                            <ShieldAlert size={11} />{c.cves.length} CVE
                          </span>
                        ) : <span className="text-[12px] text-[#9ca3af]">—</span>
                      ) : (
                        <TintPill value={c.pill} map={c.map} />
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer note + pagination */}
        <div className="border-t border-[#E5E7EB] bg-white">
          <div className="px-5 pt-2 text-[12px] text-[#7B8FA5]">
            Showing {filtered.length} of {rows.length} {noun} for {productLabel}
            {type === 'SBOM' && ' · captures the CERT-In minimum elements (supplier, license, origin, direct + transitive dependencies, hash).'}
            {type === 'CBOM' && ' · algorithms, keys and certificates in use, with post-quantum posture.'}
            {type === 'AI BOM' && ' · models this product invokes, with provider, licence and purpose.'}
          </div>
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            itemsPerPage={itemsPerPage}
            totalItems={filtered.length}
            onPageChange={setCurrentPage}
            onItemsPerPageChange={(v) => { setItemsPerPage(v); setCurrentPage(1); }}
          />
        </div>
        </>
        )}
      </div>
    </div>
  );
}
