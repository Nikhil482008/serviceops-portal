import { useState, useEffect, useRef } from 'react';
import {
  X, RefreshCw, ShieldCheck, Zap, Globe, Flag, ArrowUp, Upload, FileText,
  Boxes, Shield, Radio, Search, ChevronDown, Sparkles, Copy, Check, AlertTriangle, Clock, Building2,
  Inbox, Loader, PauseCircle, XCircle, HelpCircle, ListFilter,
} from 'lucide-react';
import { toast } from 'sonner';
import { useDrawerStack } from './DrawerStack';
import { DrawerTabStrip } from './DrawerTabStrip';
import { MinimizedDrawerRail } from './MinimizedDrawerRail';
import { HeaderKpiRow, type HeaderKpiItem } from './HeaderKpiRow';
import { Pagination } from './Pagination';
import { REMOTE_OFFICES } from './PatchComputersTab';
import type { SoftwareComponent } from './softwareComponentsData';
import {
  affectedCis, componentCves, componentSources, componentEvidence,
  LANGUAGE_OF, businessServices, firstSeen, lastSeen, VULN_STATUSES,
} from './softwareComponentDetail';

/* Software Component detail — the same drawer shell as the Endpoint detail page.
 *
 * FOLD 1 is static across every tab: what this component IS (id, name, version, severity,
 * purl, licence, sources, fix) and the two figures that say how much of the estate it
 * reaches. FOLD 2 is the tab body, and it is the only thing that changes.
 *
 * Every figure in fold 1 is the LISTING ROW restated — 23 CIs, 3 CVEs, 31 products — and
 * every fold-2 list is derived from that same row, so the header and the table beneath it
 * cannot quote different numbers. */

interface ComponentDrawerProps {
  openAssets: SoftwareComponent[];
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

/* Sources stopped being a tab: it was five facts, and each one belongs with the thing it
   describes. "Reported by" is identity, so it sits in fold 1; the rest are reference
   fields, so they sit in the right rail with everything else you look up rather than act on. */
type MainTab = 'cis' | 'vulns';

const SEV_PILL: Record<string, { bg: string; text: string; dot: string }> = {
  Critical: { bg: '#FEF3F2', text: '#B42318', dot: '#EF4444' },
  High: { bg: '#FFF4ED', text: '#C4320A', dot: '#F59E0B' },
  Medium: { bg: '#FFFAEB', text: '#B54708', dot: '#EAB308' },
  Low: { bg: '#F2F4F7', text: '#475467', dot: '#98A2B3' },
};

const Dash = () => <span className="text-[12px] text-[#9ca3af]">---</span>;
/** Nobody claimed it. Different from unknown: the document had a slot and left it empty. */
const NotAsserted = () => <span className="text-[13px] text-[#9CA3AF]">Not asserted</span>;

/* Where this component STANDS on a CVE, which is not the same as how bad the CVE is:
   a Critical you are not affected by needs no action, and an unresolved one does. */
const STATUS_PILL: Record<string, { bg: string; text: string; icon: typeof AlertTriangle }> = {
  'Received': { bg: '#EFF8FF', text: '#175CD3', icon: Inbox },
  'Awaiting Analysis': { bg: '#F2F4F7', text: '#475467', icon: Clock },
  'Undergoing Analysis': { bg: '#FFFAEB', text: '#B54708', icon: Loader },
  'Analyzed': { bg: '#ECFDF3', text: '#22A06B', icon: ShieldCheck },
  'Modified': { bg: '#EFF8FF', text: '#175CD3', icon: RefreshCw },
  'Deferred': { bg: '#F2F4F7', text: '#475467', icon: PauseCircle },
  'Rejected': { bg: '#F2F4F7', text: '#475467', icon: XCircle },
  'Unknown': { bg: '#F2F4F7', text: '#475467', icon: HelpCircle },
};
/* A workflow state is not a severity, so these stay calm: green only for the one state
   that means analysis is finished, amber only for the one that means work is happening,
   and grey for every state that is simply "not yet". Red is reserved for severity and
   KEV, which is where a reader's eye should actually go. */

/** Severity order for the sub-tabs — worst first, matching the table's own ordering. */
const SEV_ORDER = ['Critical', 'High', 'Medium', 'Low'] as const;

function Pill({ tone, children }: { tone: 'crit' | 'warn' | 'neutral'; children: React.ReactNode }) {
  const s = tone === 'crit' ? { backgroundColor: '#FEF3F2', color: '#B42318' }
    : tone === 'warn' ? { backgroundColor: '#FEF7E6', color: '#D97706' }
    : { backgroundColor: '#F1F5F9', color: '#475467' };
  return (
    <span className="inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-[12px] font-medium" style={s}>
      {children}
    </span>
  );
}

function OriginChip({ origin }: { origin: string }) {
  const Icon = origin === 'Agent scan' ? Upload : FileText;
  return (
    <span className="inline-flex items-center gap-1 rounded bg-[#e8f4fd] px-2 py-0.5 text-[12px] font-medium text-[#3D8BD0]">
      <Icon size={12} />{origin}
    </span>
  );
}

/** The listing's table treatment, reused so the fold-2 grids and the list page agree. */
const TH = 'px-4 py-2.5 text-left text-[12px] font-semibold text-[#364658] tracking-wider';
const TD = 'px-4 py-3 whitespace-nowrap text-[12px] text-[#364658]';

export function ComponentDrawer({
  openAssets, activeAssetId, onClose, onCloseTab, onTabChange,
  stackTabs, stackWidth, onStackWidthChange, stackMinimized, onStackMinimizedChange,
  stackActiveTab, onStackActiveTabChange,
}: ComponentDrawerProps) {
  const c = openAssets.find((x) => x.id === activeAssetId) ?? openAssets[0];

  const [minimizedLocal, setMinimizedLocal] = useState(false);
  const minimized = stackMinimized ?? minimizedLocal;
  const setMinimized = onStackMinimizedChange ?? setMinimizedLocal;
  useEffect(() => { setMinimized(false); }, [activeAssetId]);

  const [tabLocal, setTabLocal] = useState<MainTab>('cis');
  const { open: openInStack } = useDrawerStack();
  const activeTab = (stackActiveTab as MainTab) ?? tabLocal;
  const setActiveTab = (t: MainTab) => { setTabLocal(t); onStackActiveTabChange?.(t); };

  /* Same width contract as every other drawer: full view is the viewport less the rail, and
     the chosen width is shared through the stack so it survives a tab swap. */
  const [drawerWidth, setDrawerWidth] = useState(stackWidth ?? (typeof window !== 'undefined' ? window.innerWidth - 54 : 1546));
  const [isResizing, setIsResizing] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
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
  const toggleDrawerView = () => setDrawerWidth((w) => (w > 1080 ? 900 : fullWidth));

  const [copied, setCopied] = useState(false);
  /* Fold-2 state. Each tab is its own list, so they page and filter independently — the
     same shape PatchComputersTab uses for Missing / Installed / Ignored. */
  const ALL_ENDPOINTS = 'All Endpoints';
  const [bucket, setBucket] = useState<string>(ALL_ENDPOINTS);
  const [bucketQuery, setBucketQuery] = useState('');
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
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  /* Vulnerabilities tab: a severity SUB-TAB (one at a time — it answers "how bad") plus
     three independent multi-select filters (each answers a different question, so they
     AND together the way the module list pages do). */
  const [sevBucket, setSevBucket] = useState<string>('All');
  const [sevOpen, setSevOpen] = useState(false);
  const sevRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!sevOpen) return;
    const onDown = (e: MouseEvent) => {
      if (sevRef.current && !sevRef.current.contains(e.target as Node)) setSevOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [sevOpen]);
  const [fStatus, setFStatus] = useState<Set<string>>(new Set());
  const [fType, setFType] = useState<Set<string>>(new Set());
  const [fPatch, setFPatch] = useState<Set<string>>(new Set());
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  const nFilters = fStatus.size + fType.size + fPatch.size;
  const clearFilters = () => { setFStatus(new Set()); setFType(new Set()); setFPatch(new Set()); };
  useEffect(() => {
    if (!filterOpen) return;
    const onDown = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setFilterOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [filterOpen]);
  useEffect(() => { setCurrentPage(1); setSelected(new Set()); }, [activeTab, bucket, tabQuery, activeAssetId, sevBucket, nFilters]);
  useEffect(() => { if (!bucketOpen) setBucketQuery(''); }, [bucketOpen]);
  const [fieldQuery, setFieldQuery] = useState('');
  const [fieldsOpen, setFieldsOpen] = useState(true);

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

  const allCis = affectedCis(c);

  /* Component -> the CI carrying it -> that CI's BOM, opened on the dependency tree at this
     component. The asset drawer is the destination (not the endpoint) because the CI id is what
     this table shows, and `bomEndpointId` keeps the BOM keyed to the host that was scanned.
     `bomComponent` is what stops the trail going cold at the CI: without it the user lands on a
     host's whole BOM having asked about one library. */
  const openCi = (r: { ciId: string; endpointId: string; hostname: string; ip: string; os: string }) =>
    openInStack('hardware-assets', r.ciId, r.hostname, {
      id: r.ciId,
      name: r.hostname,
      assetType: 'Hardware',
      status: 'In Use',
      hostName: r.hostname,
      ipAddress: r.ip,
      usedBy: null,
      managedByGroup: 'IT Operations',
      managedBy: { name: '—' },
      serialNumber: '—',
      bomMode: true,
      bomEndpointId: r.endpointId,
      bomComponent: c.name,
    });

  const cves = componentCves(c);
  const sources = componentSources(c);
  const evidence = componentEvidence(c);
  const wide = drawerWidth > 1080;

  const tq = tabQuery.trim().toLowerCase();
  const cisFiltered = allCis
    .filter((r) => bucket === ALL_ENDPOINTS || r.office === bucket)
    /* `version` is NOT a search field any more. The column is gone, so a query matching on it
       would return rows with nothing on them to explain the match — a search that appears to
       have highlighted nothing. */
    .filter((r) => !tq || [r.ciId, r.endpointId, r.hostname, r.ip, r.os, r.origin, r.office].join(' ').toLowerCase().includes(tq));
  /* Patch availability is DERIVED from `fixedIn` rather than stored, so the filter and the
     column can never disagree about what "Yes" means. */
  const patchLabel = (v: { fixedIn: string | null }) => (v.fixedIn ? 'Yes' : 'No');
  /* The sub-tab counts are taken BEFORE the severity bucket is applied but AFTER the other
     filters — so a count says how many rows that tab would show if you clicked it, which is
     the only reading that isn't a lie. */
  const cvesScoped = cves.filter((v) =>
    (!tq || [v.id, v.title, v.severity, v.status, v.vulnType].join(' ').toLowerCase().includes(tq))
    && (fStatus.size === 0 || fStatus.has(v.status))
    && (fType.size === 0 || fType.has(v.vulnType))
    && (fPatch.size === 0 || fPatch.has(patchLabel(v))));
  const sevCount = (s: string) => (s === 'All' ? cvesScoped.length : cvesScoped.filter((v) => v.severity === s).length);
  const cvesFiltered = cvesScoped.filter((v) => sevBucket === 'All' || v.severity === sevBucket);
  /* Options come from the rows this component actually has, so a picker never offers a
     value that would filter everything out. Status keeps the canonical order. */
  const typeOpts = Array.from(new Set(cves.map((v) => v.vulnType))).sort();
  const statusOpts = VULN_STATUSES.filter((s) => cves.some((v) => v.status === s));
  const patchOpts = ['Yes', 'No'].filter((p) => cves.some((v) => patchLabel(v) === p));
  const rowsFor = activeTab === 'cis' ? cisFiltered : activeTab === 'vulns' ? cvesFiltered : [];
  const totalPages = Math.ceil(rowsFor.length / itemsPerPage) || 1;
  const pageSlice = <T,>(xs: T[]) => xs.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const cisPage = pageSlice(cisFiltered);
  const cvesPage = pageSlice(cvesFiltered);
  /* Only groups this component actually reaches are offered — a picker that lists an
     office with no affected CI is a picker that can empty the table for no reason. */
  const officesHere = REMOTE_OFFICES.filter((o) => allCis.some((r) => r.office === o));
  const bucketOptions = [ALL_ENDPOINTS, ...officesHere];
  const bucketCount = (o: string) => (o === ALL_ENDPOINTS ? allCis.length : allCis.filter((r) => r.office === o).length);
  const bq = bucketQuery.trim().toLowerCase();
  const bucketShown = bucketOptions.filter((o) => !bq || o.toLowerCase().includes(bq));

  /* Shared chrome — the search row every detail tab carries above its grid.
     A FUNCTION, not a component: declaring a component inside render gives React a new
     type on every keystroke, which unmounts the input and drops focus mid-word. */
  const tabSearch = (placeholder: string, className = 'relative mb-3') => (
    <div className={className}>
      <input
        value={tabQuery}
        onChange={(e) => setTabQuery(e.target.value)}
        placeholder={placeholder}
        className="h-[36px] w-full rounded border border-[#d1d5db] bg-white pl-3 pr-10 text-[13px] text-[#364658] placeholder:text-[#9ca3af] focus:border-[#3D8BD0] focus:outline-none focus:ring-1 focus:ring-[#3D8BD0]"
      />
      {tabQuery ? (
        <button onClick={() => setTabQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9ca3af] hover:text-[#364658]"><X size={16} /></button>
      ) : (
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9ca3af]" size={16} />
      )}
    </div>
  );

  /* One labelled multi-select block in the Filter popup. A FUNCTION for the same reason
     tabSearch is one — a component declared here would remount its checkboxes on every
     keystroke elsewhere in the drawer. */
  const filterSection = (label: string, opts: readonly string[], sel: Set<string>, setSel: (u: (p: Set<string>) => Set<string>) => void) => (
    opts.length === 0 ? null : (
      <div className="border-b border-[#f1f5f9] px-3 py-2.5 last:border-b-0">
        <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-[#9CA3AF]">{label}</div>
        {opts.map((o) => (
          <label key={o} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 hover:bg-[#F5F7FA]">
            <input
              type="checkbox"
              checked={sel.has(o)}
              onChange={(e) => {
                const on = e.target.checked;
                setSel((prev) => { const n = new Set(prev); if (on) n.add(o); else n.delete(o); return n; });
              }}
              className="h-3.5 w-3.5 cursor-pointer rounded border-[#d1d5db] text-[#3D8BD0] focus:ring-[#3D8BD0] focus:ring-offset-0"
            />
            <span className="text-[12px] text-[#364658]">{o}</span>
          </label>
        ))}
      </div>
    )
  );

  /* ── FOLD 1 — the meta line under the heading, identical on all three tabs ── */
  const kpis: HeaderKpiItem[] = [
    /* The build this row IS. The `+N` drift count that rode beside it is gone, with the
       version column, the version filter and the rail's version row — one build per row is
       the reading this drawer keeps. */
    { key: 'version', tip: `Version: ${c.version}`, node: (
      <span className="inline-flex items-center gap-1.5">
        <span className="text-[11px] text-[#7B8FA5]">Version</span>
        <span className="text-[12px] font-medium text-[#364658]">{c.version}</span>
      </span>) },
    { key: 'sev', tip: `Top severity: ${c.topSeverity === 'None' ? 'no known vulnerabilities' : c.topSeverity}`, node: (
      <span className="inline-flex items-center gap-1.5">
        <span className="text-[11px] text-[#7B8FA5]">Top Severity</span>
        {c.topSeverity === 'None' ? <span className="text-[12px] font-medium text-[#22A06B]">None</span> : (
          <>
            <span className="size-2 flex-shrink-0 rounded-full" style={{ backgroundColor: SEV_PILL[c.topSeverity].dot }} />
            <span className="text-[12px] font-semibold" style={{ color: SEV_PILL[c.topSeverity].text }}>{c.topSeverity}</span>
          </>
        )}
      </span>) },
    { key: 'reported', tip: `Reported by: ${sources.map((x) => x.kind).join(', ')}`, node: (
      <span className="inline-flex items-center gap-1.5">
        <span className="text-[11px] text-[#7B8FA5]">Reported by</span>
        <span className="inline-flex items-center gap-1">
          {sources.map((x) => <OriginChip key={x.kind} origin={x.kind === 'Agent scan' ? 'Agent' : 'Vendor SBOM'} />)}
        </span>
      </span>) },
    { key: 'fix', tip: c.fixVersion ? `Fix available: ${c.fixVersion}` : 'No published fix', node: (
      <span className="inline-flex items-center gap-1.5">
        <span className="text-[11px] text-[#7B8FA5]">Fix available</span>
        <span className={`text-[12px] font-medium ${c.fixVersion ? 'text-[#22A06B]' : 'text-[#9CA3AF]'}`}>{c.fixVersion ?? '---'}</span>
      </span>) },
    { key: 'purl', tip: `PURL: ${c.purl}`, node: (
      <button
        onClick={() => { navigator.clipboard?.writeText(c.purl); setCopied(true); setTimeout(() => setCopied(false), 1400); }}
        title="Copy package URL"
        className="-mx-1 inline-flex max-w-full items-center gap-1.5 rounded px-1 py-0.5 transition-colors hover:bg-[#F5F7FA]"
      >
        <span className="flex-shrink-0 text-[11px] text-[#7B8FA5]">PURL</span>
        <span className="truncate text-[12px] font-medium text-[#364658]">{c.purl}</span>
        {copied ? <Check size={13} className="flex-shrink-0 text-[#22A06B]" /> : <Copy size={13} className="flex-shrink-0 text-[#9ca3af]" />}
      </button>) },
  ];

  const FIELDS: { label: string; value: React.ReactNode }[] = [
    { label: 'Component ID', value: c.id },
    { label: 'Name', value: c.name },
    { label: 'Ecosystem', value: `${c.ecosystem} · ${LANGUAGE_OF[c.ecosystem]}` },
    { label: 'PURL', value: <span className="break-all">{c.purl}</span> },
    { label: 'License', value: c.licenseFlag
        ? <span className="inline-flex items-center gap-1 text-[#D97706]"><Flag size={12} />{c.license}</span>
        : c.license },
    { label: 'Fix available', value: c.fixVersion
        ? <span className="inline-flex items-center gap-1 font-medium text-[#22A06B]"><ArrowUp size={12} />{c.fixVersion}</span>
        : <Dash /> },
    { label: 'Installed on', value: String(c.cis) },
    { label: 'Products', value: String(c.products) },
    { label: 'Business services', value: String(businessServices(c)) },
    { label: 'Internet-facing', value: c.internetFacing
        ? <span className="inline-flex items-center gap-1 text-[#D97706]"><Globe size={12} />Yes</span>
        : 'No' },
    { label: 'KEV-listed', value: c.kev
        ? <span className="inline-flex items-center gap-1 text-[#B42318]"><Zap size={12} />Yes</span>
        : 'No' },
    { label: 'Reported by', value: (
      <span className="flex flex-wrap items-center gap-1.5">
        {sources.map((x) => <OriginChip key={x.kind} origin={x.kind} />)}
      </span>) },
    { label: 'Format', value: evidence.formats.length ? evidence.formats.join(' · ') : <NotAsserted /> },
    /* Paths stay monospace: a filesystem path is read character by character, which is
       the one place proportional type costs you. */
    { label: 'Found in', value: (
      <span className="block space-y-1">
        {evidence.foundIn.map((p) => <span key={p} className="block font-mono text-[12.5px]">{p}</span>)}
      </span>) },
    { label: 'Supplier', value: evidence.supplier ?? <NotAsserted /> },
    { label: 'SHA-256', value: evidence.sha256
        ? <span className="block break-all font-mono text-[12.5px]">{evidence.sha256}</span>
        : <NotAsserted /> },
    { label: 'First seen', value: firstSeen(c) },
    { label: 'Last seen', value: lastSeen() },
  ];
  const fq = fieldQuery.trim().toLowerCase();
  const shownFields = fq ? FIELDS.filter((f) => f.label.toLowerCase().includes(fq)) : FIELDS;

  const TABS: { id: MainTab; label: string; count: number; icon: React.ReactNode }[] = [
    { id: 'cis', label: 'Installed on', count: c.cis, icon: <Boxes size={14} /> },
    { id: 'vulns', label: 'Vulnerabilities', count: c.vulnerabilities, icon: <Shield size={14} /> },
  ];

  return (
    <div
      className={`fixed right-0 top-0 z-50 flex h-screen flex-col bg-white shadow-2xl ${drawerWidth <= 1080 ? 'border-l border-[#e5e7eb]' : ''}`}
      ref={drawerRef}
      style={{ width: `${drawerWidth}px` }}
      data-drawer
    >
      {/* Resize handle — identical to the other drawers' */}
      <div
        className="group absolute bottom-0 left-0 top-0 z-[100] w-3 cursor-ew-resize"
        onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setIsResizing(true); }}
      >
        <div className="absolute bottom-0 left-0 top-0 w-px bg-transparent transition-colors group-hover:bg-[#3D8BD0]" />
      </div>

      {/* Open-record tabs + window controls */}
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
          {wide ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <rect x="4" y="8" width="12" height="12" rx="1.5" stroke="#364658" strokeWidth="2" />
              <path d="M8 8V6.5A1.5 1.5 0 0 1 9.5 5H18A1.5 1.5 0 0 1 19.5 6.5V15A1.5 1.5 0 0 1 18 16.5H16" stroke="#364658" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><rect x="5" y="5" width="14" height="14" rx="1.5" stroke="#364658" strokeWidth="2" /></svg>
          )}
        </button>
        <button onClick={onClose} className="p-2 hover:bg-[#e5e7eb]"><X size={18} className="text-[#364658]" /></button>
      </div>

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* ── FOLD 1 ─────────────────────────────────────────────── */}
        <div className="flex flex-shrink-0 items-start justify-between border-b border-[#e5e7eb] bg-white px-6 py-4">
          <div className="min-w-0 flex-1">
            <h1 className="flex min-w-0 items-center gap-2 text-[18px] font-semibold text-[#364658]">
              <span className="inline-block size-2.5 flex-shrink-0 rounded-full"
                    style={{ backgroundColor: c.topSeverity === 'None' ? '#22C55E' : SEV_PILL[c.topSeverity].dot }} />
              <span className="flex-shrink-0 rounded bg-[#e8f4fd] px-2 py-0.5 text-[12px] font-semibold text-[#3D8BD0]">{c.id}</span>
              <span className="truncate">{c.name}</span>
              {c.kev && (
                <span className="inline-flex flex-shrink-0 items-center gap-1 rounded-sm px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide"
                      style={{ backgroundColor: '#FEF3F2', color: '#B42318' }} title="On CISA's Known Exploited Vulnerabilities list">
                  <Zap size={11} />KEV
                </span>
              )}
              {c.internetFacing && (
                <span className="inline-flex flex-shrink-0 text-[#D97706]" title="Internet-facing on at least one CI"><Globe size={14} /></span>
              )}
            </h1>
            <HeaderKpiRow items={kpis} />
          </div>

          <div className="flex flex-shrink-0 items-center gap-2">
            <button
              title="Refresh"
              onClick={() => toast.success('Component reconciled from the latest scans')}
              className="inline-flex h-8 w-8 items-center justify-center rounded border border-[#DFE5ED] bg-white hover:bg-[#F5F7FA]"
            >
              <RefreshCw size={16} className="text-[#6b7280]" />
            </button>
            {/* Disabled when there is nothing to upgrade TO. It used to be live in that case
                and answered a click with "no published fix yet" — a primary CTA whose only
                outcome is being told it cannot help is worse than one that is visibly off.
                Keyed on the FIX, not on the vulnerability count: "vulnerable, no published
                fix" is a real state the Software Components KPI card already counts, and the
                two only coincide in today's fixture. The reason says which case it is,
                because a disabled control with no explanation is a dead end. */}
            <button
              onClick={() => toast.success(`Remediation planned — upgrade ${c.name} to ${c.fixVersion} on ${c.cis} CIs`)}
              disabled={!c.fixVersion}
              title={c.fixVersion
                ? `Upgrade ${c.name} to ${c.fixVersion} across ${c.cis} CI${c.cis === 1 ? '' : 's'}`
                : c.vulnerabilities === 0
                  ? `${c.name} has no known vulnerabilities — nothing to remediate`
                  : `No published fix for ${c.name} yet — nothing to upgrade to`}
              className={`flex h-8 items-center gap-1.5 rounded px-4 text-[12px] font-medium transition-colors ${
                c.fixVersion
                  ? 'bg-[#3D8BD0] text-white hover:bg-[#2F7AB8]'
                  : 'cursor-not-allowed bg-[#E5E7EB] text-[#9CA3AF]'
              }`}
            >
              <ShieldCheck size={15} /> Remediate
            </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Left: tabs + fold 2 */}
          <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
            <div className="sticky top-0 z-10 border-b border-[#e5e7eb] bg-white">
              <div className="flex items-center gap-2.5 px-6">
                {TABS.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setActiveTab(t.id)}
                    className={`flex items-center gap-1.5 whitespace-nowrap border-b-2 px-2 py-3 text-[14px] font-medium transition-colors ${
                      activeTab === t.id
                        ? 'border-[#3D8BD0] text-[#3D8BD0]'
                        : 'border-transparent text-[#6b7280] hover:border-[#CBD5E1] hover:bg-[#F5F7FA] hover:text-[#364658]'
                    }`}
                  >
                    {t.icon}{t.label}
                    <span className={`rounded px-1 py-0.5 text-[12px] font-medium ${activeTab === t.id ? 'bg-[#E8F4FD] text-[#3D8BD0]' : 'bg-[#E5E7EB] text-[#364658]'}`}>{t.count}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* -- FOLD 2 ------------------------------------------- */}
            {/* px-6 pb-4 so the sticky pager can span it with -mx-6 -mb-4, exactly as the
                Patch detail tabs do. */}
            <div className="min-h-0 flex-1 overflow-auto bg-white px-6 pb-4 pt-4">
              {activeTab === 'cis' && (
                <>
                  {/* One control row: the group filter, then the search — the same pair,
                      in the same order, as the Patch detail tab's Endpoint grid. */}
                  <div className="mb-3 flex items-center gap-2.5">
                    <div className="relative flex-shrink-0" ref={bucketRef}>
                      <button
                        onClick={() => setBucketOpen((v) => !v)}
                        className={`inline-flex h-[36px] items-center gap-1.5 rounded border px-2.5 text-[13px] font-medium transition-colors ${
                          bucket !== ALL_ENDPOINTS
                            ? 'border-[#3D8BD0] bg-[#EBF5FF] text-[#3D8BD0]'
                            : 'border-[#DFE5ED] bg-white text-[#364658] hover:border-[#3D8BD0] hover:bg-[#F5F7FA]'
                        }`}
                      >
                        <Building2 size={14} className={bucket !== ALL_ENDPOINTS ? 'text-[#3D8BD0]' : 'text-[#7B8FA5]'} />
                        {bucket}
                        <ChevronDown size={14} className={`transition-transform ${bucketOpen ? 'rotate-180' : ''} ${bucket !== ALL_ENDPOINTS ? 'text-[#3D8BD0]' : 'text-[#7B8FA5]'}`} />
                      </button>
                      {bucketOpen && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setBucketOpen(false)} />
                          <div className="absolute left-0 top-full z-50 mt-1 w-[240px] rounded-lg border border-[#DFE5ED] bg-white py-1 shadow-lg">
                            {/* A search earns its place here: the estate has 15+ groups,
                                which is past the point of scanning a list. */}
                            <div className="px-3 pb-2 pt-1">
                              <div className="relative">
                                <input
                                  type="text"
                                  autoFocus
                                  value={bucketQuery}
                                  onChange={(e) => setBucketQuery(e.target.value)}
                                  placeholder="Search groups..."
                                  className="w-full rounded border border-[#E5E7EB] bg-[#F9FAFB] py-2 pl-3 pr-9 text-[13px] text-[#364658] placeholder:text-[#9CA3AF] focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#3D8BD0]"
                                />
                                <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
                              </div>
                            </div>
                            <div className="max-h-[260px] overflow-y-auto">
                              {bucketShown.length === 0 ? (
                                <div className="px-4 py-3 text-center text-[13px] text-[#9CA3AF]">No groups found</div>
                              ) : bucketShown.map((o) => (
                                <button
                                  key={o}
                                  onClick={() => { setBucket(o); setBucketOpen(false); }}
                                  className={`flex w-full items-center justify-between gap-2 px-4 py-2 text-left text-[13px] transition-colors ${
                                    bucket === o ? 'bg-[#F1F5F9] text-[#364658]' : 'text-[#364658] hover:bg-[#F9FAFB]'
                                  }`}
                                >
                                  <span className="truncate">{o}</span>
                                  <span className="flex flex-shrink-0 items-center gap-2">
                                    <span className="text-[12px] text-[#7B8FA5]">{bucketCount(o)}</span>
                                    {bucket === o && <Check size={15} className="flex-shrink-0 text-[#3D8BD0]" />}
                                  </span>
                                </button>
                              ))}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                    {tabSearch('Select field to search...', 'relative min-w-[240px] flex-1')}
                  </div>

                  {selected.size > 0 && (
                    <div className="mb-3 flex items-center gap-2 text-[13px]">
                      <span className="inline-flex h-[22px] min-w-[22px] items-center justify-center rounded-md bg-[#EAF2FB] px-1.5 text-[12px] font-semibold tabular-nums text-[#3D8BD0]">{selected.size}</span>
                      <span className="text-[#64748B]">{selected.size === 1 ? 'record' : 'records'} selected</span>
                      <span className="h-4 w-px bg-[#E3E8EF]" />
                      <button onClick={() => setSelected(new Set())} className="text-[12px] font-medium text-[#3D8BD0] hover:underline">Unselect all</button>
                    </div>
                  )}

                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[1000px]">
                      <thead className="border-b border-[#e5e7eb]">
                        <tr>
                          <th className="w-[40px] px-4 py-2.5 text-left">
                            <input
                              type="checkbox"
                              checked={cisPage.length > 0 && cisPage.every((r) => selected.has(r.ciId))}
                              onChange={(e) => setSelected(e.target.checked ? new Set(cisPage.map((r) => r.ciId)) : new Set())}
                              className="h-3.5 w-3.5 cursor-pointer rounded border-[#d1d5db] text-[#3D8BD0] focus:ring-[#3D8BD0] focus:ring-offset-0"
                            />
                          </th>
                          {['CI ID', 'Endpoint ID', 'Host Name', 'IP Address', 'CI Type', 'OS Name', 'Origin', 'Products'].map((h) => (
                            <th key={h} className={`${TH} whitespace-nowrap`}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#e5e7eb] bg-white">
                        {cisPage.length === 0 ? (
                          <tr><td colSpan={9} className="px-4 py-12 text-center text-[13px] text-[#9CA3AF]">No configuration items match.</td></tr>
                        ) : cisPage.map((r) => (
                          <tr key={r.ciId} className="hover:bg-[#f9fafb] transition-colors">
                            <td className="px-4 py-3">
                              <input
                                type="checkbox"
                                checked={selected.has(r.ciId)}
                                onChange={(e) => setSelected((prev) => {
                                  const next = new Set(prev);
                                  if (e.target.checked) next.add(r.ciId); else next.delete(r.ciId);
                                  return next;
                                })}
                                className="h-3.5 w-3.5 cursor-pointer rounded border-[#d1d5db] text-[#3D8BD0] focus:ring-[#3D8BD0] focus:ring-offset-0"
                              />
                            </td>
                            {/* Id pill only. The dot elsewhere is agent health, and this view
                                has no agent state to report — a permanently amber dot on every
                                row would be reporting a status nobody set. */}
                            <td className="px-4 py-3 whitespace-nowrap">
                              <button
                                onClick={() => openCi(r)}
                                title={`Open ${r.ciId} on its BOM, at ${c.name}`}
                                className="rounded bg-[#e8f4fd] px-2 py-0.5 text-[12px] font-semibold text-[#3D8BD0] transition-colors hover:bg-[#d0e8f9]"
                              >{r.ciId}</button>
                            </td>
                            <td className={`${TD} text-[#7B8FA5]`}>{r.endpointId}</td>
                            <td className={TD}><span className="block max-w-[170px] truncate">{r.hostname}</span></td>
                            <td className={TD}>{r.ip}</td>
                            <td className="px-4 py-3 whitespace-nowrap"><Pill tone="neutral">{r.ciType}</Pill></td>
                            <td className={TD}><span className="block max-w-[200px] truncate">{r.os}</span></td>
                            <td className="px-4 py-3 whitespace-nowrap"><OriginChip origin={r.origin} /></td>
                            <td className={TD}>{r.products}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="sticky bottom-0 z-30 -mx-6 -mb-4 bg-white">
                    <Pagination
                      currentPage={currentPage}
                      totalPages={totalPages}
                      itemsPerPage={itemsPerPage}
                      totalItems={cisFiltered.length}
                      onPageChange={setCurrentPage}
                      onItemsPerPageChange={(v) => { setItemsPerPage(v); setCurrentPage(1); }}
                    />
                  </div>
                </>
              )}

              {activeTab === 'vulns' && (
                cves.length === 0 ? (
                  <div className="py-16 text-center">
                    <p className="text-[14px] font-medium text-[#364658]">No known vulnerabilities</p>
                    <p className="mt-1 text-[13px] text-[#7B8FA5]">Nothing is published against {c.name} {c.version} today.</p>
                  </div>
                ) : (
                  <>
                    {/* Severity · search · filters. Severity is single-select (a CVE has one
                        rating, so it answers "how bad") while status / type / patch are
                        multi-select filters that AND together. */}
                    <div className="mb-3 flex items-center gap-2.5">
                      {/* Severity as a dropdown, matching the group filter on Installed on:
                          one control, one row, whatever the component's spread of severities
                          happens to be. Only severities this component HAS are listed. */}
                      <div className="relative flex-shrink-0" ref={sevRef}>
                        <button
                          onClick={() => setSevOpen((v) => !v)}
                          className={`inline-flex h-[36px] items-center gap-1.5 rounded border px-2.5 text-[13px] font-medium transition-colors ${
                            sevBucket !== 'All'
                              ? 'border-[#3D8BD0] bg-[#EBF5FF] text-[#3D8BD0]'
                              : 'border-[#DFE5ED] bg-white text-[#364658] hover:border-[#3D8BD0] hover:bg-[#F5F7FA]'
                          }`}
                        >
                          {sevBucket !== 'All'
                            ? <span className="size-1.5 flex-shrink-0 rounded-full" style={{ backgroundColor: SEV_PILL[sevBucket].dot }} />
                            : <Shield size={14} className="text-[#7B8FA5]" />}
                          {sevBucket === 'All' ? 'All severities' : sevBucket}
                          <ChevronDown size={14} className={`transition-transform ${sevOpen ? 'rotate-180' : ''} ${sevBucket !== 'All' ? 'text-[#3D8BD0]' : 'text-[#7B8FA5]'}`} />
                        </button>
                        {sevOpen && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => setSevOpen(false)} />
                            <div className="absolute left-0 top-full z-50 mt-1 w-[240px] rounded-lg border border-[#DFE5ED] bg-white py-1 shadow-lg">
                              <div className="max-h-[260px] overflow-y-auto">
                                {['All', ...SEV_ORDER.filter((x) => cves.some((v) => v.severity === x))].map((x) => (
                                  <button
                                    key={x}
                                    onClick={() => { setSevBucket(x); setSevOpen(false); }}
                                    className={`flex w-full items-center justify-between gap-2 px-4 py-2 text-left text-[13px] transition-colors ${
                                      sevBucket === x ? 'bg-[#F1F5F9] text-[#364658]' : 'text-[#364658] hover:bg-[#F9FAFB]'
                                    }`}
                                  >
                                    <span className="flex min-w-0 items-center gap-2">
                                      {x !== 'All' && <span className="size-1.5 flex-shrink-0 rounded-full" style={{ backgroundColor: SEV_PILL[x].dot }} />}
                                      <span className="truncate">{x === 'All' ? 'All severities' : x}</span>
                                    </span>
                                    <span className="flex flex-shrink-0 items-center gap-2">
                                      <span className="text-[12px] text-[#7B8FA5]">{sevCount(x)}</span>
                                      {sevBucket === x && <Check size={15} className="flex-shrink-0 text-[#3D8BD0]" />}
                                    </span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                      <span className="mx-0.5 h-5 w-px bg-[#E3E8EF]" />
                      {/* The search sits on the pill row: the buckets and the query narrow the
                          same list, so they belong on one line. */}
                      {tabSearch('Select field to search...', 'relative min-w-[240px] flex-1')}

                      <div className="relative" ref={filterRef}>
                        <button
                          onClick={() => setFilterOpen((o) => !o)}
                          className={`inline-flex h-[36px] flex-shrink-0 items-center gap-1.5 rounded border px-2.5 text-[13px] font-medium transition-colors ${
                            nFilters > 0
                              ? 'border-[#3D8BD0] bg-[#EBF5FF] text-[#3D8BD0]'
                              : 'border-[#DFE5ED] bg-white text-[#364658] hover:border-[#3D8BD0] hover:bg-[#F5F7FA]'
                          }`}
                        >
                          <ListFilter size={14} />
                          Filter
                          {nFilters > 0 && (
                            <span className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#3D8BD0] px-1 text-[11px] font-semibold text-white">{nFilters}</span>
                          )}
                          <ChevronDown size={13} className={filterOpen ? 'rotate-180 transition-transform' : 'transition-transform'} />
                        </button>
                        {filterOpen && (
                          <div className="absolute right-0 top-full z-50 mt-1 w-[248px] rounded-md border border-[#e5e7eb] bg-white shadow-lg">
                            <div className="max-h-[380px] overflow-y-auto">
                              {filterSection('Status', statusOpts, fStatus, setFStatus)}
                              {filterSection('Vulnerability Type', typeOpts, fType, setFType)}
                              {filterSection('Patch Availability', patchOpts, fPatch, setFPatch)}
                            </div>
                            <div className="flex items-center justify-between border-t border-[#e5e7eb] px-3 py-2">
                              <button
                                onClick={clearFilters}
                                disabled={nFilters === 0}
                                className="text-[12px] text-[#3D8BD0] hover:underline disabled:cursor-default disabled:text-[#9CA3AF] disabled:no-underline"
                              >
                                Clear all
                              </button>
                              <button
                                onClick={() => setFilterOpen(false)}
                                className="rounded bg-[#3D8BD0] px-2.5 py-1 text-[12px] font-medium text-white hover:bg-[#3579b4]"
                              >
                                Done
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* How the match was made — a CVE list is only as trustworthy as the
                        thing it was matched on, so it sits with the table it qualifies. */}
                    <div className="mb-2 text-right text-[12px] text-[#7B8FA5]">Matched against {c.name} {c.version} by PURL</div>

                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[1180px]">
                        <thead className="border-b border-[#e5e7eb]">
                          <tr>
                            <th className="w-[40px] px-4 py-2.5 text-left">
                              <input
                                type="checkbox"
                                checked={cvesPage.length > 0 && cvesPage.every((v) => selected.has(v.id))}
                                onChange={(e) => setSelected(e.target.checked ? new Set(cvesPage.map((v) => v.id)) : new Set())}
                                className="h-3.5 w-3.5 cursor-pointer rounded border-[#d1d5db] text-[#3D8BD0] focus:ring-[#3D8BD0] focus:ring-offset-0"
                              />
                            </th>
                            {['CVE ID', 'Description', 'Exploit Status', 'Severity', 'Status', 'Vulnerability Type', 'Patch Availability'].map((h) => (
                              <th key={h} className={`${TH} whitespace-nowrap`}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#e5e7eb] bg-white">
                          {cvesPage.length === 0 ? (
                            <tr><td colSpan={8} className="px-4 py-12 text-center text-[13px] text-[#9CA3AF]">No vulnerabilities match.</td></tr>
                          ) : cvesPage.map((v) => {
                            const st = STATUS_PILL[v.status];
                            const StatusIcon = st.icon;
                            return (
                            <tr key={v.id} className="hover:bg-[#f9fafb] transition-colors">
                              <td className="px-4 py-3">
                                <input
                                  type="checkbox"
                                  checked={selected.has(v.id)}
                                  onChange={(e) => setSelected((prev) => {
                                    const next = new Set(prev);
                                    if (e.target.checked) next.add(v.id); else next.delete(v.id);
                                    return next;
                                  })}
                                  className="h-3.5 w-3.5 cursor-pointer rounded border-[#d1d5db] text-[#3D8BD0] focus:ring-[#3D8BD0] focus:ring-offset-0"
                                />
                              </td>
                              <td className={TD}>{v.id}</td>
                              {/* The name people use, with the three scores under it: how bad,
                                  how likely to be exploited, and the blend of the two. */}
                              <td className="px-4 py-3">
                                <div className="whitespace-nowrap text-[12px] font-medium text-[#364658]">{v.title}</div>
                                <div className="mt-0.5 whitespace-nowrap text-[12px] text-[#7B8FA5]">
                                  CVSS {v.cvss.toFixed(1)} · EPSS {v.epss.toFixed(2).replace(/^0/, '')} · risk {v.risk}
                                </div>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                {v.exploited
                                  ? <Pill tone="crit"><Zap size={11} />Yes · KEV</Pill>
                                  : <span className="text-[12px] text-[#64748B]">No</span>}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <span className="inline-flex items-center gap-1.5 rounded-sm px-2 py-0.5 text-[12px] font-medium"
                                      style={{ backgroundColor: SEV_PILL[v.severity].bg, color: SEV_PILL[v.severity].text }}>
                                  <span className="size-1.5 rounded-full" style={{ backgroundColor: SEV_PILL[v.severity].dot }} />
                                  {v.severity}
                                </span>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <span className="inline-flex items-center gap-1.5 rounded-sm px-2 py-0.5 text-[12px] font-medium"
                                      style={{ backgroundColor: st.bg, color: st.text }}>
                                  <StatusIcon size={12} />{v.status}
                                </span>
                              </td>
                              <td className={TD}>{v.vulnType}</td>
                              <td className="px-4 py-3 whitespace-nowrap text-[12px]">
                                {v.fixedIn
                                  ? <span className="inline-flex items-center gap-1 font-medium text-[#22A06B]"><Check size={13} />Yes · {v.fixedIn}</span>
                                  : <span className="text-[12px] text-[#64748B]">No</span>}
                              </td>
                            </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div className="sticky bottom-0 z-30 -mx-6 -mb-4 bg-white">
                      <Pagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        itemsPerPage={itemsPerPage}
                        totalItems={cvesFiltered.length}
                        onPageChange={setCurrentPage}
                        onItemsPerPageChange={(v) => { setItemsPerPage(v); setCurrentPage(1); }}
                      />
                    </div>
                  </>
                )
              )}

            </div>
          </div>

          {/* Right: properties rail — the same shape as Endpoint Properties */}
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
