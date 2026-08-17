import { useState, useEffect } from 'react';
import {
  X, Search, FileText, Download, RefreshCw, Columns3, MoreVertical, ChevronDown, Check, ShieldAlert,
} from 'lucide-react';
import { useRef } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { SoftwareComponentsTable } from './SoftwareComponentsTable';
import { Pagination } from './Pagination';
import { useDrawerStack } from './DrawerStack';
import { SOFTWARE_COMPONENTS, isVulnerable, isKev } from './softwareComponentsData';
import { SoftwareComponentsKpis, focusFn, FOCUS_LABEL } from './SoftwareComponentsKpis';
import type { ComponentFocus } from './SoftwareComponentsKpis';

/* Software Components — the BOM module's second listing, and the fleet seen the other way up.
 *
 * Configuration Items is one row per CI ("what is on this machine"). This is one row per component
 * VERSION ("where does this thing live"), which is the question a new CVE forces. Same shell,
 * same table treatment and the same tag vocabulary as the Inventory listing — only the columns
 * change, because only the question does. */

/* Two top-level scopes. "Known exploited" stopped being one of them: it is not a peer
   of All — it is a slice of Vulnerable, and a tab row that mixes levels invites the
   reading that a component could be exploited without being vulnerable. */
type Scope = 'all' | 'vulnerable';
type VulnSub = 'all' | 'kev';
/* Severity is single-select: a component has exactly one top severity, so choosing two
   would be asking for rows that cannot exist. */
type SevFilter = '' | 'Critical' | 'High' | 'Medium' | 'None';
const SEV_OPTIONS: Exclude<SevFilter, ''>[] = ['Critical', 'High', 'Medium', 'None'];
/* "None" is a real answer — the component has no known vulnerabilities — so it is spelled
   out rather than left as a word that reads like "no filter". */
const SEV_LABEL = (s: Exclude<SevFilter, ''>) => (s === 'None' ? 'No known vulnerabilities' : s);
const SEV_DOT: Record<Exclude<SevFilter, ''>, string> = {
  Critical: '#EF4444', High: '#F59E0B', Medium: '#EAB308', None: '#22C55E',
};

function ComponentsToolbar({
  searchQuery, setSearchQuery, scope, setScope, vulnSub, setVulnSub, sev, setSev,
  focus, setFocus, allCount, vulnCount, kevCount, sevCount, allShown,
}: {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  scope: Scope;
  setScope: (s: Scope) => void;
  vulnSub: VulnSub;
  setVulnSub: (v: VulnSub) => void;
  sev: SevFilter;
  setSev: (s: SevFilter) => void;
  focus: ComponentFocus;
  setFocus: (f: ComponentFocus) => void;
  allCount: number;
  vulnCount: number;
  kevCount: number;
  sevCount: (s: Exclude<SevFilter, ''>) => number;
  allShown: number;
}) {
  const [sevOpen, setSevOpen] = useState(false);
  const sevRef = useRef<HTMLDivElement>(null);
  /* Closing on outside click as well as on the scrim: the scrim alone misses a click that
     lands on another control inside the toolbar. */
  useEffect(() => {
    if (!sevOpen) return;
    const onDown = (e: MouseEvent) => {
      if (sevRef.current && !sevRef.current.contains(e.target as Node)) setSevOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [sevOpen]);
  const IconBtn = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <button className="flex h-[30px] w-[30px] items-center justify-center rounded text-[#6b7280] hover:bg-[#f3f4f6]" title={title}>
      {children}
    </button>
  );

  const TABS: { id: Scope; label: string; count: number }[] = [
    { id: 'all', label: 'All', count: allCount },
    { id: 'vulnerable', label: 'Vulnerable', count: vulnCount },
  ];
  const SUBS: { id: VulnSub; label: string; count: number }[] = [
    { id: 'all', label: 'All', count: vulnCount },
    { id: 'kev', label: 'Known Exploited', count: kevCount },
  ];

  return (
    <div className="bg-white">
      {/* First row: title + actions. No primary CTA — this listing is read-only, and the
          standard is to drop the CTA rather than fake one. */}
      <div className="flex items-center justify-between px-6 pb-2 pt-3">
        <h1 className="text-[16px] font-semibold text-[#364658]">Software Components</h1>

        <div className="flex items-center gap-1">
          <IconBtn title="Export"><FileText size={16} /></IconBtn>
          <IconBtn title="Download"><Download size={16} /></IconBtn>
          <IconBtn title="Refresh"><RefreshCw size={16} /></IconBtn>
          <IconBtn title="Columns"><Columns3 size={16} /></IconBtn>
          <IconBtn title="More"><MoreVertical size={16} /></IconBtn>
        </div>
      </div>

      {/* The three readings, directly under the heading. Their actions filter the table
          below rather than navigating, which is why they live inside the toolbar. */}
      <div className="px-6 pb-4 pt-1">
        <SoftwareComponentsKpis rows={SOFTWARE_COMPONENTS} focus={focus} setFocus={setFocus} />
      </div>

      {/* Scope tabs — the standard content-tab treatment, under the title */}
      <div className="flex items-center gap-2.5 border-b border-[#e5e7eb] px-6">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => { setScope(t.id); setFocus(null); setSev(''); setVulnSub('all'); }}
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

      {/* One control row. Whatever narrows the list sits on the left of the search:
          the severity filter on All, the sub-tabs on Vulnerable. They never both apply,
          so they share the slot rather than stacking into two rows. */}
      <div className="flex items-center gap-2.5 px-6 pb-3 pt-3">
        {scope === 'vulnerable' && (
          <>
            {/* Pills, not underlines: the underline row above is the top level, and a
                nested set that looked the same would read as a peer of it. */}
            {SUBS.map((t) => (
              <button
                key={t.id}
                onClick={() => { setVulnSub(t.id); setFocus(null); }}
                className={`inline-flex h-[34px] flex-shrink-0 items-center gap-1.5 rounded border px-2.5 text-[13px] font-medium transition-colors ${
                  vulnSub === t.id
                    ? 'border-[#3D8BD0] bg-[#EBF5FF] text-[#3D8BD0]'
                    : 'border-[#DFE5ED] bg-white text-[#364658] hover:border-[#3D8BD0] hover:bg-[#F5F7FA]'
                }`}
              >
                {t.label}
                <span className={`inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[11px] font-semibold ${
                  vulnSub === t.id ? 'bg-[#3D8BD0] text-white' : 'bg-[#EEF2F6] text-[#64748B]'
                }`}>{t.count}</span>
              </button>
            ))}
            <span className="mx-0.5 h-5 w-px flex-shrink-0 bg-[#E3E8EF]" />
          </>
        )}
        {/* Offered on All only: on Vulnerable every row is already vulnerable, and
            "No known vulnerabilities" would be an option that can never match. */}
        {scope === 'all' && (
          <div className="relative flex-shrink-0" ref={sevRef}>
            <button
              onClick={() => setSevOpen((v) => !v)}
              className={`inline-flex h-[34px] items-center gap-1.5 rounded border px-2.5 text-[13px] font-medium transition-colors ${
                sev ? 'border-[#3D8BD0] bg-[#EBF5FF] text-[#3D8BD0]' : 'border-[#DFE5ED] bg-white text-[#364658] hover:border-[#3D8BD0] hover:bg-[#F5F7FA]'
              }`}
            >
              <ShieldAlert size={14} className={sev ? 'text-[#3D8BD0]' : 'text-[#7B8FA5]'} />
              {sev ? SEV_LABEL(sev) : 'All severities'}
              <ChevronDown size={14} className={`transition-transform ${sevOpen ? 'rotate-180' : ''} ${sev ? 'text-[#3D8BD0]' : 'text-[#7B8FA5]'}`} />
            </button>
            {sevOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setSevOpen(false)} />
                <div className="absolute left-0 top-full z-50 mt-1 w-[240px] rounded-lg border border-[#DFE5ED] bg-white py-1 shadow-lg">
                  <div className="max-h-[260px] overflow-y-auto">
                    {/* No search box: four fixed options do not need one, and an empty
                        search field would imply the list could be longer than it is. */}
                    {([''] as SevFilter[]).concat(SEV_OPTIONS).map((o) => (
                      <button
                        key={o || 'any'}
                        onClick={() => { setSev(o); setSevOpen(false); }}
                        className={`flex w-full items-center justify-between gap-2 px-4 py-2 text-left text-[13px] transition-colors ${
                          sev === o ? 'bg-[#F1F5F9] text-[#364658]' : 'text-[#364658] hover:bg-[#F9FAFB]'
                        }`}
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          {o && <span className="size-1.5 flex-shrink-0 rounded-full" style={{ backgroundColor: SEV_DOT[o] }} />}
                          <span className="truncate">{o ? SEV_LABEL(o) : 'All severities'}</span>
                        </span>
                        <span className="flex flex-shrink-0 items-center gap-2">
                          <span className="text-[12px] text-[#7B8FA5]">{o ? sevCount(o as Exclude<SevFilter, ''>) : allShown}</span>
                          {sev === o && <Check size={15} className="flex-shrink-0 text-[#3D8BD0]" />}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
        {/* A card's filter announces itself here and is removable here — the only two
            places it can be cleared are its own card and this chip. */}
        {focus && (
          <span className="inline-flex h-[34px] flex-shrink-0 items-center gap-1.5 rounded-full bg-[#E8F4FD] pl-3 pr-1.5 text-[13px] font-medium text-[#3D8BD0]">
            {FOCUS_LABEL[focus]}
            <button onClick={() => setFocus(null)} aria-label={`Clear the ${FOCUS_LABEL[focus]} filter`}
                    className="rounded-full p-0.5 transition-colors hover:bg-[#D0E8F9]">
              <X size={14} />
            </button>
          </span>
        )}
        <div className="relative flex-1">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search ID, name, version or PURL..."
            className="h-[34px] w-full rounded border border-[#d1d5db] bg-white pl-3 pr-10 text-[13px] text-[#364658] placeholder:text-[#9ca3af] focus:border-[#3D8BD0] focus:outline-none focus:ring-1 focus:ring-[#3D8BD0]"
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

export function SoftwareComponentsListPage({ onNavigate }: { onNavigate: (page: string) => void }) {
  const [scope, setScope] = useState<Scope>('all');
  const [vulnSub, setVulnSub] = useState<VulnSub>('all');
  const [sev, setSev] = useState<SevFilter>('');
  const [focus, setFocus] = useState<ComponentFocus>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => { setCurrentPage(1); }, [searchQuery, scope, vulnSub, sev, focus]);

  const byScope = scope === 'vulnerable'
    ? (vulnSub === 'kev' ? SOFTWARE_COMPONENTS.filter(isKev) : SOFTWARE_COMPONENTS.filter(isVulnerable))
    : SOFTWARE_COMPONENTS;
  /* A card's focus narrows whatever the tab already chose — one filter, applied after the
     other, rather than two that can contradict each other. */
  const focused = focus ? byScope.filter(focusFn[focus]) : byScope;
  const scoped = sev ? focused.filter((c) => c.topSeverity === sev) : focused;
  /* Each option reports how many rows it WOULD show, counted before the severity filter
     itself is applied — otherwise every option but the active one would read zero. */
  const sevCount = (s: Exclude<SevFilter, ''>) => focused.filter((c) => c.topSeverity === s).length;

  const q = searchQuery.trim().toLowerCase();
  const filtered = !q ? scoped : scoped.filter((c) =>
    c.id.toLowerCase().includes(q) ||
    c.name.toLowerCase().includes(q) ||
    c.version.toLowerCase().includes(q) ||
    c.purl.toLowerCase().includes(q) ||
    c.ecosystem.toLowerCase().includes(q) ||
    c.license.toLowerCase().includes(q)
  );

  const { open: openInStack } = useDrawerStack();

  const totalPages = Math.ceil(filtered.length / itemsPerPage) || 1;
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="flex h-screen bg-[#f9fafb]">
      <Sidebar activePage="software-components" onNavigate={onNavigate} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header selectedCount={0} onOpenAdmin={() => onNavigate('admin')} />
        <ComponentsToolbar
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          scope={scope}
          setScope={setScope}
          vulnSub={vulnSub}
          setVulnSub={setVulnSub}
          sev={sev}
          setSev={setSev}
          sevCount={sevCount}
          allShown={focused.length}
          focus={focus}
          setFocus={setFocus}
          allCount={SOFTWARE_COMPONENTS.length}
          vulnCount={SOFTWARE_COMPONENTS.filter(isVulnerable).length}
          kevCount={SOFTWARE_COMPONENTS.filter(isKev).length}
        />
        <main className="flex flex-1 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 overflow-auto bg-white">
            <SoftwareComponentsTable
              rows={paginated}
              onRowClick={(c) => openInStack('software-components', c.id, `${c.name} ${c.version}`, c)}
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
    </div>
  );
}
