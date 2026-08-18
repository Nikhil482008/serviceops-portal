import { useMemo, useRef, useState, useEffect } from 'react';
import { TriangleAlert, ExternalLink, ShieldQuestion, Search, X, ChevronDown, Check, Flag, CalendarClock } from 'lucide-react';
import { useDrawerStack } from './DrawerStack';
import { KpiCard, KpiChip, KPI_NUM } from './SoftwareComponentsKpis';
import { aiAssets, aiSummary, pastEol, eolSoon } from './aiModelsData';
import type { AiAssetRow, AiKind, AiRisk } from './aiModelsData';

/* The AI Components tab of BOM Inventory — the AI BOM read fleet-wide.
 *
 * Three columns carry the judgement, and each answers a different question:
 *   Provenance      can this artefact's origin be attested at all?
 *   License · risk  what does using it cost you — and an UNKNOWN licence is the worst case,
 *                   because you cannot even say what it forbids.
 *   Lifecycle       is it still getting fixes?
 * They are separate columns because a row can be clean on two and damning on the third — a single
 * "status" would have to pick one and lose the other two.
 */

/* The component types an AI BOM distinguishes. The list is the AI system taken apart: what
   generates (hosted-llm, local-model-file, embedding-model), what it retrieves from (vector-db,
   dataset), what drives it (prompt, rag-pipeline), and what it runs on (framework, infra). */
const KIND_LABEL: Record<AiKind, string> = {
  'hosted-llm': 'hosted-llm', 'local-model-file': 'local-model-file',
  'embedding-model': 'embedding-model', framework: 'framework', 'vector-db': 'vector-db',
  prompt: 'prompt', dataset: 'dataset', infra: 'infra', 'rag-pipeline': 'rag-pipeline',
};

const PROV_STYLE: Record<AiAssetRow['provenance'], { bg: string; text: string }> = {
  Verified: { bg: '#ECFDF3', text: '#22A06B' },
  Unverified: { bg: '#FEF3F2', text: '#DC2626' },
  Internal: { bg: '#F1F5F9', text: '#64748B' },
};

/** Risk colours the licence chip, because the licence NAME is not the risk — "Proprietary" is low
 *  on a framework and high on a dataset full of PII. */
const RISK_STYLE: Record<AiRisk, { bg: string; text: string; flag: boolean }> = {
  LOW: { bg: '#F1F5F9', text: '#475569', flag: false },
  MEDIUM: { bg: '#F1F5F9', text: '#475569', flag: false },
  HIGH: { bg: '#FFFAEB', text: '#B45309', flag: true },
};

export type AiFocus = 'eol' | 'hosted' | 'unverified' | null;
const FOCUS_FN: Record<Exclude<AiFocus, null>, (r: AiAssetRow) => boolean> = {
  eol: pastEol,
  hosted: (r) => r.source === 'Hosted API',
  /* What the removed sub-tab used to select. */
  unverified: (r) => r.provenance === 'Unverified',
};
const FOCUS_LABEL: Record<Exclude<AiFocus, null>, string> = {
  eol: 'Past end-of-life',
  hosted: 'Sends data to a hosted API',
  unverified: 'Unverified only',
};

const KINDS: AiKind[] = ['hosted-llm', 'local-model-file', 'embedding-model', 'framework',
  'vector-db', 'prompt', 'dataset', 'infra', 'rag-pipeline'];

/* Lifecycle windows. "Past end-of-life" is its OWN bucket rather than the first day of the 30-day
 * one: something already unsupported is a different job from something you have a month to plan
 * for, and folding them together would bury the first in the second. The three windows ahead are
 * deliberately cumulative — "what do I have to deal with inside 90 days" includes the next 30 —
 * because that is the question a planning cycle actually asks. */
type EolWindow = '' | 'past' | 'd30' | 'd90' | 'd180' | 'beyond' | 'none';

const EOL_OPTIONS: { id: EolWindow; label: string; match: (r: AiAssetRow) => boolean }[] = [
  { id: '', label: 'All lifecycles', match: () => true },
  { id: 'past', label: 'Past end-of-life', match: (r) => r.eolDays !== null && r.eolDays < 0 },
  { id: 'd30', label: 'EOL within 30 days', match: (r) => r.eolDays !== null && r.eolDays >= 0 && r.eolDays <= 30 },
  { id: 'd90', label: 'EOL within 90 days', match: (r) => r.eolDays !== null && r.eolDays >= 0 && r.eolDays <= 90 },
  { id: 'd180', label: 'EOL within 180 days', match: (r) => r.eolDays !== null && r.eolDays >= 0 && r.eolDays <= 180 },
  { id: 'beyond', label: 'EOL beyond 180 days', match: (r) => r.eolDays !== null && r.eolDays > 180 },
  { id: 'none', label: 'No EOL published', match: (r) => r.eolDays === null },
];

export function AiModelsTab({ onOpen }: { onOpen?: (row: AiAssetRow) => void }) {
  const rows = useMemo(() => aiAssets(), []);
  const sum = useMemo(() => aiSummary(), []);
  const [focus, setFocus] = useState<AiFocus>(null);
  const [kind, setKind] = useState<AiKind | ''>('');
  const [kindOpen, setKindOpen] = useState(false);
  const [eol, setEol] = useState<EolWindow>('');
  const [eolOpen, setEolOpen] = useState(false);
  const eolRef = useRef<HTMLDivElement>(null);
  const [q, setQ] = useState('');
  const kindRef = useRef<HTMLDivElement>(null);
  const { open: openInStack } = useDrawerStack();

  useEffect(() => {
    if (!eolOpen) return;
    const onDown = (e: MouseEvent) => {
      if (eolRef.current && !eolRef.current.contains(e.target as Node)) setEolOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [eolOpen]);

  useEffect(() => {
    if (!kindOpen) return;
    const onDown = (e: MouseEvent) => {
      if (kindRef.current && !kindRef.current.contains(e.target as Node)) setKindOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [kindOpen]);

  const focused = focus ? rows.filter(FOCUS_FN[focus]) : rows;
  const byKind = kind ? focused.filter((r) => r.kind === kind) : focused;
  const kindCount = (k: AiKind) => focused.filter((r) => r.kind === k).length;
  /* Each option reports how many rows it WOULD show, counted against everything narrowed BEFORE
     it — otherwise every option but the active one reads zero. */
  const eolMatch = EOL_OPTIONS.find((o) => o.id === eol) ?? EOL_OPTIONS[0];
  const byEol = byKind.filter(eolMatch.match);
  const eolCount = (o: typeof EOL_OPTIONS[number]) => byKind.filter(o.match).length;
  const query = q.trim().toLowerCase();
  const shown = !query ? byEol : byEol.filter((r) =>
    [r.id, r.name, r.version, r.provider, r.license, r.subtitle, r.kind].some((v) => v.toLowerCase().includes(query)));

  const th = 'whitespace-nowrap px-4 py-2.5 text-left text-[12px] font-semibold tracking-wider text-[#364658]';
  const td = 'whitespace-nowrap px-4 py-3 text-[13px] text-[#364658]';

  const lifecycle = (r: AiAssetRow) => {
    if (r.eolDays === null) return <span className="text-[#9CA3AF]">Unknown</span>;
    const past = r.eolDays < 0;
    const soon = eolSoon(r);
    return (
      <span
        className="inline-flex items-center rounded-sm px-2 py-0.5 text-[12px] font-medium"
        style={{
          backgroundColor: past ? '#FEF3F2' : soon ? '#FFFAEB' : '#F1F5F9',
          color: past ? '#DC2626' : soon ? '#B45309' : '#64748B',
        }}
        title={r.eol}
      >{past ? `EOL ${Math.abs(r.eolDays)}d ago` : `EOL in ${r.eolDays}d`}</span>
    );
  };

  return (
    <>
      <div className="bg-white px-6 pb-4 pt-4">
        {/* The SAME card the Software Components tab uses — imported, not reproduced. Two copies
            is how the two tabs ended up different heights in the first place. */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <KpiCard
            icon={<TriangleAlert size={15} />} title="Past end-of-life"
            info="Components whose supplier has stopped supporting them — they receive no security fixes."
            active={focus === 'eol'} onToggle={() => setFocus(focus === 'eol' ? null : 'eol')}
            cta="Review deprecated"
          >
            <div className={`${KPI_NUM} ${sum.pastEol ? 'text-[#B42318]' : 'text-[#364658]'}`}>{sum.pastEol}</div>
            {sum.eolSoon > 0 && (
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <KpiChip tone="warn">{sum.eolSoon} more within 6 months</KpiChip>
              </div>
            )}
          </KpiCard>

          <KpiCard
            icon={<ExternalLink size={15} />} title="Hosted model APIs"
            info="Call-sites that send prompts and payloads to a model provider outside the estate."
            active={focus === 'hosted'} onToggle={() => setFocus(focus === 'hosted' ? null : 'hosted')}
            cta="Review egress"
          >
            <div className={`${KPI_NUM} ${sum.hosted ? 'text-[#B45309]' : 'text-[#364658]'}`}>{sum.hosted}</div>
            {sum.hostedProviders.length > 0 && (
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                {sum.hostedProviders.map((p) => <KpiChip key={p} tone="warn">{p}</KpiChip>)}
              </div>
            )}
          </KpiCard>

          {/* Provenance, in place of the licence donut: a distribution was true but not
              actionable, and this is the cut the All / Unverified sub-tabs used to make. */}
          <KpiCard
            icon={<ShieldQuestion size={15} />} title="Unverified"
            info={`Of ${sum.total} components, these are the ones whose origin cannot be attested against any registry.`}
            active={focus === 'unverified'} onToggle={() => setFocus(focus === 'unverified' ? null : 'unverified')}
            cta="Review unverified"
          >
            <div className={`${KPI_NUM} ${sum.unverified ? 'text-[#B42318]' : 'text-[#364658]'}`}>{sum.unverified}</div>
            {sum.unverifiedKinds.length > 0 && (
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                {sum.unverifiedKinds.map((k) => <KpiChip key={k} tone="warn">{k}</KpiChip>)}
              </div>
            )}
          </KpiCard>
        </div>
      </div>

      {/* One control row, the same shape Software Components uses. */}
      <div className="flex items-center gap-2.5 bg-white px-6 pb-3 pt-2">
        <div className="relative flex-shrink-0" ref={kindRef}>
          <button
            onClick={() => setKindOpen((v) => !v)}
            className={`inline-flex h-[34px] items-center gap-1.5 rounded border px-2.5 text-[13px] font-medium transition-colors ${
              kind ? 'border-[#3D8BD0] bg-[#EBF5FF] text-[#3D8BD0]' : 'border-[#DFE5ED] bg-white text-[#364658] hover:border-[#3D8BD0] hover:bg-[#F5F7FA]'
            }`}
          >
            {kind ? KIND_LABEL[kind] : 'All component types'}
            <ChevronDown size={14} className={`transition-transform ${kindOpen ? 'rotate-180' : ''} ${kind ? 'text-[#3D8BD0]' : 'text-[#7B8FA5]'}`} />
          </button>
          {kindOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setKindOpen(false)} />
              <div className="absolute left-0 top-full z-50 mt-1 w-[260px] rounded-lg border border-[#DFE5ED] bg-white py-1 shadow-lg">
                <div className="px-4 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-[#7B8FA5]">Component type</div>
                <div className="max-h-[300px] overflow-y-auto">
                {(['' as const] as (AiKind | '')[]).concat(KINDS).map((o) => (
                  <button
                    key={o || 'any'}
                    onClick={() => { setKind(o); setKindOpen(false); }}
                    className={`flex w-full items-center justify-between gap-2 px-4 py-2 text-left text-[13px] transition-colors ${
                      kind === o ? 'bg-[#F1F5F9] text-[#364658]' : 'text-[#364658] hover:bg-[#F9FAFB]'
                    }`}
                  >
                    <span className="truncate">{o ? KIND_LABEL[o] : 'All component types'}</span>
                    <span className="flex flex-shrink-0 items-center gap-2">
                      <span className="text-[12px] text-[#7B8FA5]">{o ? kindCount(o) : focused.length}</span>
                      {kind === o && <Check size={15} className="flex-shrink-0 text-[#3D8BD0]" />}
                    </span>
                  </button>
                ))}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="relative flex-shrink-0" ref={eolRef}>
          <button
            onClick={() => setEolOpen((v) => !v)}
            className={`inline-flex h-[34px] items-center gap-1.5 rounded border px-2.5 text-[13px] font-medium transition-colors ${
              eol ? 'border-[#3D8BD0] bg-[#EBF5FF] text-[#3D8BD0]' : 'border-[#DFE5ED] bg-white text-[#364658] hover:border-[#3D8BD0] hover:bg-[#F5F7FA]'
            }`}
          >
            <CalendarClock size={14} className={eol ? 'text-[#3D8BD0]' : 'text-[#7B8FA5]'} />
            {eolMatch.label}
            <ChevronDown size={14} className={`transition-transform ${eolOpen ? 'rotate-180' : ''} ${eol ? 'text-[#3D8BD0]' : 'text-[#7B8FA5]'}`} />
          </button>
          {eolOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setEolOpen(false)} />
              <div className="absolute left-0 top-full z-50 mt-1 w-[260px] rounded-lg border border-[#DFE5ED] bg-white py-1 shadow-lg">
                <div className="px-4 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-[#7B8FA5]">Lifecycle</div>
                {EOL_OPTIONS.map((o, i) => (
                  <div key={o.id || 'any'}>
                    {/* Past-EOL is not one of the windows ahead — the rule sits between them. */}
                    {i === 2 && <div className="my-1 h-px bg-[#F0F2F5]" />}
                    <button
                      onClick={() => { setEol(o.id); setEolOpen(false); }}
                      className={`flex w-full items-center justify-between gap-2 px-4 py-2 text-left text-[13px] transition-colors ${
                        eol === o.id ? 'bg-[#F1F5F9] text-[#364658]' : 'text-[#364658] hover:bg-[#F9FAFB]'
                      }`}
                    >
                      <span className="truncate">{o.label}</span>
                      <span className="flex flex-shrink-0 items-center gap-2">
                        <span className="text-[12px] text-[#7B8FA5]">{eolCount(o)}</span>
                        {eol === o.id && <Check size={15} className="flex-shrink-0 text-[#3D8BD0]" />}
                      </span>
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {focus && (
          <span className="inline-flex h-[34px] flex-shrink-0 items-center gap-1.5 rounded border border-[#3D8BD0] bg-[#EBF5FF] px-2.5 text-[13px] font-medium text-[#3D8BD0]">
            {FOCUS_LABEL[focus]}
            <button onClick={() => setFocus(null)} className="text-[#3D8BD0] hover:text-[#1d4ed8]" title="Clear"><X size={14} /></button>
          </span>
        )}

        <div className="relative flex-1">
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search ID, asset, version, provider, licence or component type..."
            className="h-[34px] w-full rounded border border-[#d1d5db] bg-white pl-3 pr-10 text-[13px] text-[#364658] placeholder:text-[#9ca3af] focus:border-[#3D8BD0] focus:outline-none focus:ring-1 focus:ring-[#3D8BD0]"
          />
          {q ? (
            <button onClick={() => setQ('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9ca3af] hover:text-[#364658]"><X size={16} /></button>
          ) : (
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9ca3af]" size={16} />
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto bg-white">
        <table className="w-full min-w-[1280px]">
          <thead className="border-b border-[#e5e7eb]">
            <tr className="bg-white">
              {['ID', 'Asset', 'Kind', 'Version', 'Provider', '# CIs', 'Provenance', 'License · risk', 'Lifecycle'].map((h) => (
                <th key={h} className={th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e5e7eb] bg-white">
            {shown.length === 0 ? (
              <tr><td colSpan={9} className="px-4 py-12 text-center text-[13px] text-[#9CA3AF]">No assets match your filters.</td></tr>
            ) : shown.map((r) => {
              const risk = RISK_STYLE[r.licenseRisk];
              const prov = PROV_STYLE[r.provenance];
              return (
                <tr
                  key={r.id}
                  onClick={() => (onOpen ? onOpen(r) : openInStack('ai-components', r.id, r.name, r))}
                  className="cursor-pointer transition-colors hover:bg-[#f9fafb]"
                >
                  <td className={td}>
                    <span className="inline-block rounded bg-[#e8f4fd] px-2 py-0.5 text-[12px] font-semibold text-[#3D8BD0]">{r.id}</span>
                  </td>
                  <td className="px-4 py-3">
                    {/* Monospace: these are artefact identifiers, not prose. */}
                    <div className="font-mono text-[13px] font-semibold text-[#364658]">{r.name}</div>
                    <div className="mt-0.5 text-[12px] text-[#9CA3AF]">{r.subtitle}</div>
                  </td>
                  <td className={`${td} font-mono text-[12px] text-[#64748B]`}>{KIND_LABEL[r.kind]}</td>
                  <td className={`${td} font-mono text-[12px]`}>{r.kind === 'hosted-llm' && r.source === 'Hosted API' ? 'api' : r.version}</td>
                  <td className={td}>{r.provider}</td>
                  <td className={`${td} tabular-nums`}>{r.cis}</td>
                  <td className={td}>
                    <span
                      className="inline-flex items-center rounded-sm px-2 py-0.5 text-[12px] font-medium"
                      style={{ backgroundColor: prov.bg, color: prov.text }}
                    >{r.provenance}</span>
                  </td>
                  <td className={td}>
                    <span
                      className="inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-[12px] font-medium"
                      style={{ backgroundColor: risk.bg, color: risk.text }}
                    >
                      {risk.flag && <Flag size={11} />}{r.license} · {r.licenseRisk}
                    </span>
                  </td>
                  <td className={td}>{lifecycle(r)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
