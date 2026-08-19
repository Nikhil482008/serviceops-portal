import { useState, useEffect, useRef, useMemo } from 'react';
import { X, Server, Box, Upload, Plus, Check, FileJson, ChevronDown, ChevronRight, ArrowRight, ArrowLeft } from 'lucide-react';
import { mockEndpoints } from './endpointsData';
import { bomForEndpoint } from './bomData';

/* Ingest an SBOM produced somewhere else — the path that creates a MANAGED CI, as opposed to the
 * agent-scanned ones. The whole point is the mapping: components only become useful once they
 * hang off a CI, because that is what lets the vulnerability engine match CVEs to an asset.
 *
 * Two steps, one on screen at a time: which CI the components belong to, then the document they
 * come from. The second is unreachable until the first is answered, because a file with no CI to
 * hang off is not an ingest — so there is nothing useful to do on it yet. */

export interface IngestResult {
  ciId: string;
  ciName: string;
  ciType: string;
  ipAddress: string;
  osName: string;
  product: string;
  /** A document the browser parsed. Kept as a union so a second source can be added back
   *  without changing every consumer. */
  source: 'file';
  sourceLabel: string;
}

/* CI type — the CMDB's own hierarchy, so a new CI is classified the way the CMDB classifies
 * everything else rather than by a free-text guess. Only branches carry children; a leaf with
 * a chevron that opens nothing would be a broken affordance. */
interface CiTypeNode { id: string; label: string; children?: CiTypeNode[] }
const CI_TYPES: CiTypeNode[] = [
  {
    id: 'base-ci',
    label: 'Base CI',
    children: [
      {
        id: 'hardware',
        label: 'Hardware',
        children: [
          { id: 'server', label: 'Server' },
          { id: 'desktops', label: 'Desktops' },
          { id: 'laptops', label: 'Laptops' },
          { id: 'network-devices', label: 'Network Devices' },
          { id: 'storage-devices', label: 'Storage Devices' },
        ],
      },
    ],
  },
];

const INPUT =
  'h-9 w-full rounded border border-[#d1d5db] bg-white px-3 text-[13px] text-[#364658] placeholder:text-[#9ca3af] focus:border-[#3D8BD0] focus:outline-none focus:ring-1 focus:ring-[#3D8BD0]';

const STEPS = ['Choose the CI', 'Upload the SBOM'];

/* Declared at module scope: a component defined inside another is a new type on every render,
   so React throws the subtree away and the field being typed into loses focus. */
function Field({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <label className="mb-1.5 block text-[12px] font-medium text-[#7B8FA5]">{label}</label>
      {children}
    </div>
  );
}

/** The horizontal stepper. A completed step is a tick and stays clickable — going back to change
 *  an answer must not require abandoning the one already given. A step that is not yet reachable
 *  is inert rather than merely styled as such: an affordance that does nothing is worse than none. */
function Stepper({ step, done, onGo }: { step: number; done: boolean[]; onGo: (n: number) => void }) {
  return (
    <div className="flex items-center gap-3 border-b border-[#DFE5ED] bg-[#FBFCFE] px-5 py-3">
      {STEPS.map((label, i) => {
        const n = i + 1;
        const current = step === n;
        const isDone = done[i];
        const reachable = n === 1 || done[0];
        return (
          <div key={label} className="flex min-w-0 items-center gap-3">
            {i > 0 && <span className="h-px w-8 flex-shrink-0 bg-[#DFE5ED]" aria-hidden />}
            <button
              type="button"
              onClick={() => reachable && onGo(n)}
              disabled={!reachable}
              aria-current={current ? 'step' : undefined}
              className={`flex min-w-0 items-center gap-2 rounded px-1 py-0.5 text-left transition-colors ${
                reachable ? 'cursor-pointer' : 'cursor-default'
              }`}
            >
              {/* Done and current are separate signals: the ring says "you are here", the tick says
                  "this one is answered". A step that is both must show both, or a satisfied step
                  looks outstanding for as long as you stay on it. */}
              <span
                className={`flex size-[22px] flex-shrink-0 items-center justify-center rounded-full text-[11px] font-semibold transition-colors ${
                  isDone && current
                    ? 'border-2 border-[#3D8BD0] bg-white text-[#3D8BD0]'
                    : isDone
                      ? 'bg-[#3D8BD0] text-white'
                      : current
                        ? 'border-2 border-[#3D8BD0] bg-white text-[#3D8BD0]'
                        : 'border border-[#CBD5E1] bg-white text-[#9CA3AF]'
                }`}
              >
                {isDone ? <Check size={13} strokeWidth={3} /> : n}
              </span>
              <span className={`truncate text-[13px] ${current ? 'font-semibold text-[#364658]' : isDone ? 'font-medium text-[#364658]' : 'text-[#9CA3AF]'}`}>
                {label}
              </span>
            </button>
          </div>
        );
      })}
    </div>
  );
}

/** One of the two destinations. Collapsed it is a choice; chosen it is the form. */
/* Every product name in the estate, built once on first use. The panel renders on every
   keystroke; rebuilding thirty BOM records each time made choosing a card slower than the click
   that chose it. */
let PRODUCT_NAME_CACHE: string[] | null = null;
const allProductNames = (): string[] => {
  if (PRODUCT_NAME_CACHE) return PRODUCT_NAME_CACHE;
  const names = new Set<string>();
  for (const ep of mockEndpoints) {
    const rec = bomForEndpoint(ep.id);
    if (!rec || rec.status === 'Not Generated') continue;
    for (const p of rec.products ?? []) names.add(p.name);
  }
  PRODUCT_NAME_CACHE = [...names].sort();
  return PRODUCT_NAME_CACHE;
};

function ChoiceCard({
  icon, title, hint, selected, onSelect, children,
}: {
  icon: React.ReactNode; title: string; hint: string;
  selected: boolean; onSelect: () => void; children: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-lg border transition-colors ${
        selected ? 'border-[#3D8BD0] bg-[#F9FCFF]' : 'border-[#DFE5ED] bg-white hover:border-[#B8CADD]'
      }`}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className="flex w-full items-start gap-3 px-4 py-3 text-left"
      >
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className={selected ? 'text-[#3D8BD0]' : 'text-[#7B8FA5]'}>{icon}</span>
            <span className="text-[14px] font-semibold text-[#364658]">{title}</span>
          </span>
          <span className="mt-0.5 block text-[12px] text-[#7B8FA5]">{hint}</span>
        </span>
        {/* The radio says these are alternatives — picking one is picking against the other. */}
        <span
          className={`mt-0.5 flex size-[18px] flex-shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
            selected ? 'border-[#3D8BD0]' : 'border-[#CBD5E1]'
          }`}
        >
          {selected && <span className="size-2.5 rounded-full bg-[#3D8BD0]" />}
        </span>
      </button>
      {selected && (
        <div className="border-t border-[#E7EEF6] px-4 py-4">{children}</div>
      )}
    </div>
  );
}

interface BomIngestPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onIngest: (r: IngestResult) => void;
}

export function BomIngestPanel({ isOpen, onClose, onIngest }: BomIngestPanelProps) {
  /** Open state for the product combobox. */
  const [prodOpen, setProdOpen] = useState(false);
  const prodRef = useRef<HTMLDivElement | null>(null);
  /* Close on a click anywhere else. Without this the list stays open over the drop zone below
     it, which is the next thing the reader has to reach. */
  useEffect(() => {
    if (!prodOpen) return;
    const away = (e: MouseEvent) => {
      if (prodRef.current && !prodRef.current.contains(e.target as Node)) setProdOpen(false);
    };
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, [prodOpen]);
  const [step, setStep] = useState(1);

  /** Which destination is open. Nothing is chosen up front — the two are genuine alternatives,
   *  and a pre-selected one would be answered before it was read. */
  const [mode, setMode] = useState<'existing' | 'new' | null>(null);

  const [ciId, setCiId] = useState('');
  const [showCiMenu, setShowCiMenu] = useState(false);
  const [product, setProduct] = useState('');

  /* The names already in use. Ingesting under a name that ALMOST matches an existing product
     splits one product's history in two, and a BOM whose versions are scattered across
     near-duplicate names cannot be compared with itself — so the real names are offered before
     anything is typed.

     Only the ORDER depends on state: the chosen CI's own products lead, because an ingest is most
     often a new version of something already on that machine. That needs one record, not all
     thirty — the rest of the list is the same on every render and is cached. */
  const productOptions = useMemo(() => {
    /* Step 2 only. The list is a step-2 concern, and deriving the estate's products while the
       reader is still choosing a CI is work nobody asked for — it also kept step 1 from
       repainting on the click that chose the card. */
    if (step !== 2) return [];
    const all = allProductNames();
    if (mode !== 'existing' || !ciId) return all;
    const rec = bomForEndpoint(ciId);
    const onCi = (rec?.products ?? []).map((p) => p.name);
    const seen = new Set(onCi);
    return [...onCi, ...all.filter((n) => !seen.has(n))];
  }, [step, mode, ciId]);

  const productMatches = useMemo(() => {
    const q = product.trim().toLowerCase();
    const list = q ? productOptions.filter((n) => n.toLowerCase().includes(q)) : productOptions;
    return list.slice(0, 60);
  }, [productOptions, product]);
  /* Typed something that is not on the list — allowed, but said out loud. */
  const productIsNew = product.trim().length > 0
    && !productOptions.some((n) => n.toLowerCase() === product.trim().toLowerCase());

  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<CiTypeNode | null>(null);
  const [showTypeMenu, setShowTypeMenu] = useState(false);
  const [openTypeIds, setOpenTypeIds] = useState<Set<string>>(new Set(['base-ci', 'hardware']));
  /** Errors appear only once a step has been submitted — a form that goes red before it is
   *  answered is telling people off for not having finished yet. Tracked per step. */
  const [touched, setTouched] = useState<Record<number, boolean>>({});

  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setStep(1); setMode(null);
    setCiId(''); setProduct(''); setShowCiMenu(false);
    setNewName(''); setNewType(null); setTouched({});
    setShowTypeMenu(false); setOpenTypeIds(new Set(['base-ci', 'hardware']));
    setFile(null); setDragOver(false);
  }, [isOpen]);

  if (!isOpen) return null;

  const options = mockEndpoints.slice(0, 12).map((e) => ({ id: e.id, name: e.hostName, sub: e.ipAddress }));
  const selected = options.find((o) => o.id === ciId);

  const step1Done = mode === 'existing' ? !!ciId : mode === 'new' ? !!newName.trim() : false;
  const step2Done = !!product.trim() && !!file;
  const valid = step1Done && step2Done;

  /* Names the ONE thing standing between here and the next move, for the step on screen. */
  const hint = step === 1
    ? !mode
      ? 'Choose a CI.'
      : mode === 'existing' && !ciId
        ? 'Select a CI.'
        : mode === 'new' && !newName.trim()
          ? 'Name the new CI.'
          : 'Continue to the SBOM.'
    : !product.trim()
      ? 'Enter the product name.'
      : !file
        ? 'Add the SBOM file.'
        : 'Ready to ingest.';

  const next = () => {
    setTouched((t) => ({ ...t, 1: true }));
    if (step1Done) setStep(2);
  };

  const goTo = (n: number) => {
    if (n === 2 && !step1Done) return;
    setShowCiMenu(false); setShowTypeMenu(false);
    setStep(n);
  };

  const submit = () => {
    setTouched((t) => ({ ...t, 2: true }));
    if (!valid || !file) return;
    if (mode === 'existing') {
      const e = mockEndpoints.find((x) => x.id === ciId);
      onIngest({
        ciId,
        ciName: selected?.name ?? ciId,
        ciType: e ? 'Server' : 'Base CI',
        ipAddress: e?.ipAddress || '—',
        osName: e?.osName || 'Unknown',
        product: product.trim(),
        source: 'file',
        sourceLabel: file.name,
      });
      return;
    }
    /* A CI created here is created BY the ingest — there is no separate save step, because a CI
       with no components would be an empty record left behind if the upload were abandoned. */
    onIngest({
      ciId: `CI-N${Math.abs([...newName].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7)) % 9000 + 1000}`,
      ciName: newName.trim(),
      ciType: newType?.label ?? 'Base CI',
      ipAddress: '—',
      osName: 'Unknown',
      product: product.trim(),
      source: 'file',
      sourceLabel: file.name,
    });
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-end bg-black/50">
      <div className="flex h-full w-[640px] max-w-[96vw] flex-col bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-[#DFE5ED] px-5 py-3">
          <div className="min-w-0">
            <h3 className="text-[16px] font-semibold text-[#364658]">Ingest BOM</h3>
            {/* The drawer is named for the whole family, but only one member of it can be
                ingested today — say which, and nothing else. The accepted formats live on the
                drop zone, where they are read at the moment a file is chosen. */}
            <p className="mt-0.5 text-[13px] text-[#7B8FA5]">
              SBOMs only — CBOM and AI BOM are generated by the agent.
            </p>
          </div>
          <button onClick={onClose} className="flex size-8 flex-shrink-0 items-center justify-center rounded text-[#7B8FA5] transition-colors hover:bg-[#F3F4F6] hover:text-[#364658]">
            <X size={18} />
          </button>
        </div>

        <Stepper step={step} done={[step1Done, step2Done]} onGo={goTo} />

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          {/* ── Step 1 · which CI the components belong to ─────────────────── */}
          {step === 1 && (
            <div className="space-y-2.5">
              <ChoiceCard
                icon={<Server size={16} />}
                title="Use an existing CI"
                hint="Already in the CMDB."
                selected={mode === 'existing'}
                onSelect={() => { setMode('existing'); setShowTypeMenu(false); }}
              >
                <Field label={<>CI <span className="text-[#DC2626]">*</span></>}>
                  <div className="relative">
                    <button
                      onClick={() => setShowCiMenu((v) => !v)}
                      className={`${INPUT} flex items-center justify-between gap-2 text-left ${
                        touched[1] && !ciId ? 'border-[#DC2626]' : ''
                      }`}
                    >
                      <span className={`truncate ${selected ? 'text-[#364658]' : 'text-[#9ca3af]'}`}>
                        {selected ? `${selected.id} · ${selected.name}` : 'Select a CI…'}
                      </span>
                      <ChevronDown size={15} className={`flex-shrink-0 text-[#7B8FA5] transition-transform ${showCiMenu ? 'rotate-180' : ''}`} />
                    </button>
                    {showCiMenu && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setShowCiMenu(false)} />
                        <div className="absolute left-0 top-full z-50 mt-1 max-h-[280px] w-full overflow-y-auto rounded-lg border border-[#DFE5ED] bg-white py-1 shadow-lg">
                          {options.map((o) => (
                            <button
                              key={o.id}
                              onClick={() => { setCiId(o.id); setShowCiMenu(false); }}
                              className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[13px] transition-colors ${
                                o.id === ciId ? 'bg-[#F5FAFF] font-medium text-[#3D8BD0]' : 'text-[#364658] hover:bg-[#F9FAFB]'
                              }`}
                            >
                              <span className="min-w-0 truncate">
                                <span className="font-medium">{o.id}</span>
                                <span className="ml-1.5 text-[#7B8FA5]">{o.name}</span>
                              </span>
                              <span className="flex-shrink-0 text-[11px] text-[#9CA3AF]">{o.sub}</span>
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </Field>
              </ChoiceCard>

              <ChoiceCard
                icon={<Plus size={16} />}
                title="Create a new CI"
                hint="Not in the CMDB yet — this ingest creates it."
                selected={mode === 'new'}
                onSelect={() => { setMode('new'); setShowCiMenu(false); }}
              >
                <Field label={<>CI name <span className="text-[#DC2626]">*</span></>}>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. WIN-NEWHOST01"
                    className={`${INPUT} ${touched[1] && !newName.trim() ? 'border-[#DC2626] focus:border-[#DC2626] focus:ring-[#DC2626]' : ''}`}
                  />
                  {touched[1] && !newName.trim() && (
                    <p className="mt-1 text-[12px] text-[#DC2626]">A CI needs a name — it is what the components hang off.</p>
                  )}
                </Field>

                {/* CI type — picked from the CMDB's hierarchy rather than typed, so the CI is
                    classified the same way every other CI is. */}
                <div className="mt-4">
                  <Field label="CI type">
                    <div className="relative">
                      <button
                        onClick={() => setShowTypeMenu((v) => !v)}
                        className={`${INPUT} flex items-center justify-between gap-2 text-left`}
                      >
                        <span className={`truncate ${newType ? 'text-[#364658]' : 'text-[#9ca3af]'}`}>
                          {newType?.label ?? 'Select a CI type…'}
                        </span>
                        <ChevronDown size={15} className={`flex-shrink-0 text-[#7B8FA5] transition-transform ${showTypeMenu ? 'rotate-180' : ''}`} />
                      </button>
                      {showTypeMenu && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setShowTypeMenu(false)} />
                          <div className="absolute left-0 top-full z-50 mt-1 max-h-[300px] w-full overflow-y-auto rounded-lg border border-[#DFE5ED] bg-white py-1 shadow-lg">
                            {(function render(nodes: CiTypeNode[], depth: number): React.ReactNode {
                              return nodes.map((n) => {
                                const hasKids = !!n.children?.length;
                                const open = openTypeIds.has(n.id);
                                const isSel = newType?.id === n.id;
                                return (
                                  <div key={n.id}>
                                    <button
                                      onClick={() => {
                                        setNewType(n);
                                        // A branch is selectable AND expandable — picking it also
                                        // reveals what sits under it rather than closing the menu.
                                        if (hasKids) {
                                          setOpenTypeIds((p) => {
                                            const next2 = new Set(p);
                                            open ? next2.delete(n.id) : next2.add(n.id);
                                            return next2;
                                          });
                                        } else {
                                          setShowTypeMenu(false);
                                        }
                                      }}
                                      className={`flex w-full items-center gap-2 py-2 pr-3 text-left text-[13px] transition-colors ${
                                        isSel ? 'bg-[#F5FAFF] font-medium text-[#3D8BD0]' : 'text-[#364658] hover:bg-[#F9FAFB]'
                                      }`}
                                      style={{ paddingLeft: 12 + depth * 18 }}
                                    >
                                      <span className="flex size-4 flex-shrink-0 items-center justify-center text-[#7B8FA5]">
                                        {hasKids ? (open ? <ChevronDown size={14} /> : <ChevronRight size={14} />) : null}
                                      </span>
                                      <span className="min-w-0 flex-1 truncate">{n.label}</span>
                                      {isSel && <Check size={15} className="flex-shrink-0 text-[#3D8BD0]" />}
                                    </button>
                                    {hasKids && open && render(n.children!, depth + 1)}
                                  </div>
                                );
                              });
                            })(CI_TYPES, 0)}
                          </div>
                        </>
                      )}
                    </div>
                  </Field>
                </div>
              </ChoiceCard>

              {/* With neither card chosen there is no field to redden, so the reason is said here. */}
              {touched[1] && !mode && (
                <p className="pt-1 text-[12px] text-[#DC2626]">Choose one of the two options above.</p>
              )}
            </div>
          )}

          {/* ── Step 2 · the document ──────────────────────────────────────── */}
          {step === 2 && (
            <>
              <div className="mb-4">
                <Field label={<span className="inline-flex items-center gap-1.5"><Box size={13} className="text-[#7B8FA5]" /> Product name <span className="text-[#DC2626]">*</span></span>}>
                  {/* A combobox, not a select: the list is the common case and typing is the
                      escape hatch. Both are always available — clicking opens the list, and what
                      is typed filters it without ever blocking the input. */}
                  <div className="relative" ref={prodRef}>
                    <input
                      type="text"
                      value={product}
                      autoFocus
                      role="combobox"
                      aria-expanded={prodOpen}
                      aria-autocomplete="list"
                      autoComplete="off"
                      onChange={(e) => { setProduct(e.target.value); setProdOpen(true); }}
                      onFocus={() => setProdOpen(true)}
                      onClick={() => setProdOpen(true)}
                      onKeyDown={(e) => { if (e.key === 'Escape') setProdOpen(false); }}
                      placeholder="Search a product, or type a new one"
                      className={`${INPUT} pr-8 ${touched[2] && !product.trim() ? 'border-[#DC2626] focus:border-[#DC2626] focus:ring-[#DC2626]' : ''}`}
                    />
                    <ChevronDown
                      size={15}
                      className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[#9CA3AF]"
                    />

                    {prodOpen && (
                      <div className="absolute inset-x-0 top-full z-30 mt-1 max-h-[220px] overflow-y-auto rounded border border-[#E5E7EB] bg-white py-1 shadow-lg">
                        {productMatches.map((n) => (
                          <button
                            key={n}
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => { setProduct(n); setProdOpen(false); }}
                            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] text-[#364658] transition-colors hover:bg-[#F5F7FA]"
                          >
                            <Box size={13} className="flex-shrink-0 text-[#9CA3AF]" />
                            <span className="min-w-0 truncate">{n}</span>
                            {product.trim().toLowerCase() === n.toLowerCase()
                              && <Check size={13} className="ml-auto flex-shrink-0 text-[#3D8BD0]" />}
                          </button>
                        ))}

                        {/* The escape hatch, offered as a row rather than left implicit — the
                            reader can see that typing something new IS allowed, and that it is
                            being recorded as new rather than matched to something. */}
                        {productIsNew && (
                          <button
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => setProdOpen(false)}
                            className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] text-[#364658] transition-colors hover:bg-[#F5F7FA] ${productMatches.length ? 'mt-1 border-t border-[#F0F2F5] pt-2' : ''}`}
                          >
                            <Plus size={13} className="flex-shrink-0 text-[#3D8BD0]" />
                            <span className="min-w-0 truncate">
                              Use <span className="font-medium">&ldquo;{product.trim()}&rdquo;</span>
                            </span>
                            <span className="ml-auto flex-shrink-0 rounded-sm bg-[#F1F5F9] px-1.5 py-0.5 text-[11px] font-medium text-[#475467]">New product</span>
                          </button>
                        )}

                        {!productMatches.length && !productIsNew && (
                          <div className="px-3 py-2 text-[12px] text-[#9CA3AF]">
                            No products declared yet — type a name.
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Not an error: a genuinely new product is the normal reason to ingest. It is
                      said so that a TYPO is visible as one, before it becomes a second product. */}
                  {productIsNew && !prodOpen && (
                    <p className="mt-1 text-[12px] text-[#7B8FA5]">
                      Not a product we have seen — it will be created.
                    </p>
                  )}
                  {touched[2] && !product.trim() && (
                    <p className="mt-1 text-[12px] text-[#DC2626]">Give the product a name — the components are listed under it.</p>
                  )}
                </Field>
              </div>

              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault(); setDragOver(false);
                  const f = e.dataTransfer.files?.[0];
                  if (f) setFile(f);
                }}
                onClick={() => fileRef.current?.click()}
                className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed px-4 py-7 text-center transition-colors ${
                  dragOver ? 'border-[#3D8BD0] bg-[#F5FAFF]'
                    : file ? 'border-[#22C55E] bg-[#ECFDF3]'
                      : touched[2] ? 'border-[#DC2626] bg-white'
                        : 'border-[#CBD5E1] bg-[#F7F9FC] hover:border-[#3D8BD0] hover:bg-white'
                }`}
              >
                {file ? (
                  <>
                    <FileJson size={22} className="mb-2 text-[#22A06B]" />
                    <p className="text-[13px] font-medium text-[#364658]">{file.name}</p>
                    <p className="mt-0.5 text-[12px] text-[#7B8FA5]">
                      {(file.size / 1024).toFixed(1)} KB ·{' '}
                      <button
                        onClick={(e) => { e.stopPropagation(); setFile(null); }}
                        className="font-medium text-[#3D8BD0] hover:underline"
                      >Choose a different file</button>
                    </p>
                  </>
                ) : (
                  <>
                    <Upload size={22} className="mb-2 text-[#7B8FA5]" />
                    <p className="text-[13px] font-medium text-[#364658]">Drop a file here, or click to choose</p>
                    {/* The formats belong here, not in the header — this is where a file is picked. */}
                    <p className="mt-0.5 text-[12px] text-[#7B8FA5]">SPDX 2.3 or CycloneDX 1.4–1.6</p>
                  </>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept=".json,.xml"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) setFile(f); }}
                />
              </div>
            </>
          )}
        </div>

        {/* Footer — the move available on THIS step, never both at once. */}
        <div className="flex items-center justify-between gap-3 border-t border-[#DFE5ED] px-5 py-3">
          <span className="text-[12px] text-[#7B8FA5]">{hint}</span>
          <div className="flex items-center gap-2">
            {step === 2 ? (
              <button
                onClick={() => goTo(1)}
                className="inline-flex h-8 items-center gap-1.5 rounded border border-[#DFE5ED] bg-white px-4 text-[13px] font-medium text-[#364658] transition-colors hover:bg-[#F5F7FA]"
              >
                <ArrowLeft size={14} /> Back
              </button>
            ) : (
              <button onClick={onClose} className="inline-flex h-8 items-center rounded border border-[#DFE5ED] bg-white px-4 text-[13px] font-medium text-[#364658] transition-colors hover:bg-[#F5F7FA]">
                Cancel
              </button>
            )}
            {/* Both stay clickable. A dead button explains nothing — pressing it should point at
                the field that is stopping you, which is what marks the step touched. */}
            {step === 1 ? (
              <button
                onClick={next}
                className={`inline-flex h-8 items-center gap-1.5 rounded px-4 text-[13px] font-medium text-white transition-colors ${
                  step1Done ? 'bg-[#3D8BD0] hover:bg-[#3479b5]' : 'bg-[#A9C6E3] hover:bg-[#9BBBDD]'
                }`}
              >
                Next <ArrowRight size={14} />
              </button>
            ) : (
              <button
                onClick={submit}
                className={`inline-flex h-8 items-center gap-1.5 rounded px-4 text-[13px] font-medium text-white transition-colors ${
                  valid ? 'bg-[#3D8BD0] hover:bg-[#3479b5]' : 'bg-[#A9C6E3] hover:bg-[#9BBBDD]'
                }`}
              >
                <Check size={15} /> Ingest SBOM
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
