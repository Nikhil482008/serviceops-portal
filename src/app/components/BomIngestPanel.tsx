import { useState, useEffect, useRef } from 'react';
import { X, Server, Box, Upload, Link2, Plus, Check, FileJson } from 'lucide-react';
import { toast } from 'sonner';
import { mockEndpoints } from './EndpointsListPage';

/* Ingest an SBOM produced somewhere else — the path that creates a MANAGED CI, as opposed to the
 * agent-scanned ones. The whole point is the mapping: components only become useful once they
 * hang off a CI, because that is what lets the vulnerability engine match CVEs to an asset. */

export interface IngestResult {
  ciId: string;
  ciName: string;
  ciType: string;
  ipAddress: string;
  osName: string;
  product: string;
  /** How the document arrived — a file the browser parsed, or a URL it was pulled from. */
  source: 'file' | 'api';
  sourceLabel: string;
}

interface BomIngestPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onIngest: (r: IngestResult) => void;
}

export function BomIngestPanel({ isOpen, onClose, onIngest }: BomIngestPanelProps) {
  const [ciId, setCiId] = useState('');
  const [showCiMenu, setShowCiMenu] = useState(false);
  const [product, setProduct] = useState('');

  // Creating a CI is its own task with its own required field, so it gets its own drawer rather
  // than an inline form that pushes the rest of this one down.
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newIp, setNewIp] = useState('');
  const [newOs, setNewOs] = useState('');
  const [newTouched, setNewTouched] = useState(false);
  /** CIs created in this session, offered at the top of the picker. */
  const [created, setCreated] = useState<{ id: string; name: string; ip: string; os: string }[]>([]);

  const [file, setFile] = useState<File | null>(null);
  const [apiUrl, setApiUrl] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setCiId(''); setProduct(''); setAdding(false);
    setNewName(''); setNewIp(''); setNewOs(''); setNewTouched(false);
    setFile(null); setApiUrl(''); setDragOver(false);
    setShowCiMenu(false);
  }, [isOpen]);

  if (!isOpen) return null;

  const options = [
    ...created.map((c) => ({ id: c.id, name: c.name, sub: c.ip || 'new', isNew: true })),
    ...mockEndpoints.slice(0, 12).map((e) => ({ id: e.id, name: e.hostName, sub: e.ipAddress, isNew: false })),
  ];
  const selected = options.find((o) => o.id === ciId);

  const saveNewCi = () => {
    setNewTouched(true);
    if (!newName.trim()) return;
    const id = `CI-N${created.length + 1}`;
    setCreated((prev) => [...prev, { id, name: newName.trim(), ip: newIp.trim(), os: newOs.trim() }]);
    // Selecting it immediately is the point of creating it here.
    setCiId(id);
    setAdding(false);
    setNewName(''); setNewIp(''); setNewOs(''); setNewTouched(false);
    toast.success(`${id} created and selected`);
  };

  const hasSource = !!file || !!apiUrl.trim();
  const valid = !!ciId && hasSource;

  const submit = () => {
    if (!valid) return;
    const c = created.find((x) => x.id === ciId);
    const e = mockEndpoints.find((x) => x.id === ciId);
    onIngest({
      ciId,
      ciName: selected?.name ?? ciId,
      // The CI's type is classified by the CMDB, not restated here.
      ciType: mockEndpoints.find((x) => x.id === ciId) ? 'Server' : 'Base CI',
      ipAddress: c?.ip || e?.ipAddress || '—',
      osName: c?.os || e?.osName || 'Unknown',
      product: product.trim() || 'OS / base platform',
      source: file ? 'file' : 'api',
      sourceLabel: file ? file.name : apiUrl.trim(),
    });
  };

  const Field = ({ label, children }: { label: React.ReactNode; children: React.ReactNode }) => (
    <div className="min-w-0">
      <label className="mb-1.5 block text-[12px] font-medium text-[#7B8FA5]">{label}</label>
      {children}
    </div>
  );
  const input = 'h-9 w-full rounded border border-[#d1d5db] bg-white px-3 text-[13px] text-[#364658] placeholder:text-[#9ca3af] focus:border-[#3D8BD0] focus:outline-none focus:ring-1 focus:ring-[#3D8BD0]';

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-end bg-black/50">
      <div className="flex h-full w-[640px] max-w-[96vw] flex-col bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-[#DFE5ED] px-5 py-3">
          <div className="min-w-0">
            <h3 className="text-[16px] font-semibold text-[#364658]">Ingest SBOM</h3>
            <p className="mt-0.5 text-[13px] text-[#7B8FA5]">SPDX 2.3 or CycloneDX 1.4–1.6 (JSON or XML)</p>
          </div>
          <button onClick={onClose} className="flex size-8 flex-shrink-0 items-center justify-center rounded text-[#7B8FA5] transition-colors hover:bg-[#F3F4F6] hover:text-[#364658]">
            <X size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          {/* ── Map components to CI ───────────────────────────────────────── */}
          <div className="mb-2 flex items-center gap-2">
            <Server size={16} className="text-[#3D8BD0]" />
            <h4 className="text-[14px] font-semibold text-[#364658]">Map components to CI</h4>
          </div>

          <div className="flex items-start gap-2">
            {/* CI picker */}
            <div className="relative min-w-0 flex-1">
              <button
                onClick={() => { setShowCiMenu((v) => !v); setShowTypeMenu(false); }}
                className={`${input} flex items-center justify-between gap-2 text-left`}
              >
                <span className={`truncate ${selected ? 'text-[#364658]' : 'text-[#9ca3af]'}`}>
                  {selected ? `${selected.id} · ${selected.name}` : 'Select a CI…'}
                </span>
                <span className="flex-shrink-0 text-[#7B8FA5]">▾</span>
              </button>
              {showCiMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowCiMenu(false)} />
                  <div className="absolute left-0 top-full z-50 mt-1 max-h-[280px] w-full overflow-y-auto rounded-lg border border-[#DFE5ED] bg-white py-1 shadow-lg">
                    {created.length > 0 && (
                      <div className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-[#7B8FA5]">Created just now</div>
                    )}
                    {options.map((o, i) => (
                      <div key={o.id}>
                        {i === created.length && created.length > 0 && (
                          <div className="mt-1 border-t border-[#F0F2F5] px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-[#7B8FA5]">Existing CIs</div>
                        )}
                        <button
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
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            <button
              onClick={() => setAdding(true)}
              className="inline-flex h-9 flex-shrink-0 items-center gap-1.5 rounded bg-[#3D8BD0] px-3 text-[13px] font-medium text-white transition-colors hover:bg-[#3479b5]"
            >
              <Plus size={15} /> Add new CI
            </button>
          </div>

          {/* ── Product / application ──────────────────────────────────────── */}
          <div className="mb-2 mt-6 flex items-center gap-2">
            <Box size={16} className="text-[#3D8BD0]" />
            <h4 className="text-[14px] font-semibold text-[#364658]">Product / application</h4>
          </div>
          <input
            type="text"
            value={product}
            onChange={(e) => setProduct(e.target.value)}
            placeholder="e.g. Payments Web 2.4.1 — auto-detected from the SBOM"
            className={input}
          />

          {/* ── Source: a file, or a URL to pull from ──────────────────────── */}
          <div className="mt-6 rounded-lg bg-[#F7F9FC] p-4">
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault(); setDragOver(false);
                const f = e.dataTransfer.files?.[0];
                if (f) { setFile(f); setApiUrl(''); }
              }}
              onClick={() => fileRef.current?.click()}
              className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed px-4 py-7 text-center transition-colors ${
                dragOver ? 'border-[#3D8BD0] bg-[#F5FAFF]' : file ? 'border-[#22C55E] bg-[#ECFDF3]' : 'border-[#CBD5E1] bg-white hover:border-[#3D8BD0]'
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
                  <p className="text-[13px] font-medium text-[#364658]">Drop an SBOM file here, or click to choose</p>
                  <p className="mt-0.5 text-[12px] text-[#7B8FA5]">.json / .xml — SPDX or CycloneDX · parsed locally in your browser</p>
                </>
              )}
              <input
                ref={fileRef}
                type="file"
                accept=".json,.xml"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) { setFile(f); setApiUrl(''); } }}
              />
            </div>

            {/* The two sources are alternatives, so the rule says so out loud */}
            <div className="my-3 flex items-center gap-3">
              <span className="h-px flex-1 bg-[#E5E7EB]" />
              <span className="text-[12px] font-medium uppercase tracking-wide text-[#9CA3AF]">or</span>
              <span className="h-px flex-1 bg-[#E5E7EB]" />
            </div>

            <Field label="Pull from an API endpoint">
              <div className="flex items-center gap-2">
                <div className="relative min-w-0 flex-1">
                  <Link2 size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9ca3af]" />
                  <input
                    type="text"
                    value={apiUrl}
                    onChange={(e) => { setApiUrl(e.target.value); if (e.target.value) setFile(null); }}
                    placeholder="https://registry.internal/api/v1/sbom/payments-web"
                    className={`${input} pl-9`}
                  />
                </div>
                <button
                  onClick={() => apiUrl.trim() && toast.success('Fetched the document from the endpoint')}
                  disabled={!apiUrl.trim()}
                  className="inline-flex h-9 flex-shrink-0 items-center rounded border border-[#DFE5ED] bg-white px-3 text-[13px] font-medium text-[#364658] transition-colors hover:bg-[#F5F7FA] disabled:cursor-not-allowed disabled:text-[#9CA3AF]"
                >Fetch</button>
              </div>
            </Field>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-[#DFE5ED] px-5 py-3">
          <span className="text-[12px] text-[#7B8FA5]">
            {!ciId ? 'Pick a CI to map the components to.' : !hasSource ? 'Add a file or an API endpoint.' : 'Ready to ingest.'}
          </span>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="inline-flex h-8 items-center rounded border border-[#DFE5ED] bg-white px-4 text-[13px] font-medium text-[#364658] transition-colors hover:bg-[#F5F7FA]">
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={!valid}
              className="inline-flex h-8 items-center gap-1.5 rounded bg-[#3D8BD0] px-4 text-[13px] font-medium text-white transition-colors hover:bg-[#3479b5] disabled:cursor-not-allowed disabled:bg-[#CBD5E1]"
            >
              <Check size={15} /> Ingest SBOM
            </button>
          </div>
        </div>
      </div>

      {/* New CI — its own drawer, stacked over this one. Creating a CI is a separate task with
          its own required field, and it must not push the ingest form around while open. */}
      {adding && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-end bg-black/40">
          <div className="flex h-full w-[460px] max-w-[96vw] flex-col bg-white shadow-xl">
            <div className="flex items-start justify-between gap-3 border-b border-[#DFE5ED] px-5 py-3">
              <div className="min-w-0">
                <h3 className="text-[16px] font-semibold text-[#364658]">New CI</h3>
                <p className="mt-0.5 text-[13px] text-[#7B8FA5]">The asset the ingested components will hang off.</p>
              </div>
              <button
                onClick={() => { setAdding(false); setNewTouched(false); }}
                className="flex size-8 flex-shrink-0 items-center justify-center rounded text-[#7B8FA5] transition-colors hover:bg-[#F3F4F6] hover:text-[#364658]"
              ><X size={18} /></button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
              <Field label={<>CI name <span className="text-[#DC2626]">*</span></>}>
                <input
                  type="text"
                  value={newName}
                  autoFocus
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') saveNewCi(); }}
                  placeholder="e.g. WIN-NEWHOST01"
                  className={`${input} ${newTouched && !newName.trim() ? 'border-[#DC2626] focus:border-[#DC2626] focus:ring-[#DC2626]' : ''}`}
                />
                {newTouched && !newName.trim() && (
                  <p className="mt-1 text-[12px] text-[#DC2626]">A CI needs a name — it is what the components hang off.</p>
                )}
              </Field>
              <div className="mt-4">
                <Field label="IP address">
                  <input type="text" value={newIp} onChange={(e) => setNewIp(e.target.value)} placeholder="10.20.40.11" className={input} />
                </Field>
              </div>
              <div className="mt-4">
                <Field label="Operating system">
                  <input type="text" value={newOs} onChange={(e) => setNewOs(e.target.value)} placeholder="Microsoft Windows Server 2022" className={input} />
                </Field>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-[#DFE5ED] px-5 py-3">
              <button
                onClick={() => { setAdding(false); setNewTouched(false); }}
                className="inline-flex h-8 items-center rounded border border-[#DFE5ED] bg-white px-4 text-[13px] font-medium text-[#364658] transition-colors hover:bg-[#F5F7FA]"
              >Cancel</button>
              <button
                onClick={saveNewCi}
                disabled={!newName.trim()}
                className="inline-flex h-8 items-center gap-1.5 rounded bg-[#3D8BD0] px-4 text-[13px] font-medium text-white transition-colors hover:bg-[#3479b5] disabled:cursor-not-allowed disabled:bg-[#CBD5E1]"
              ><Check size={15} /> Create CI</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
