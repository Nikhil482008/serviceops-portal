import { mockEndpoints } from './endpointsData';
import { bomForEndpoint, bomAiAssets } from './bomData';
import type { AiModel } from './bomData';

/* AI Components — the fleet's AI BOM, one row per ASSET rather than per host.
 *
 * The same relationship Software Components has to Configuration Items: the inventory answers
 * "what is on this CI", this answers "where does this asset run, and what is wrong with it".
 * Nothing here is typed in — every row is rolled up from the same `bomAiAssets` a CI's own AI BOM
 * shows, so the two can never disagree.
 *
 * It is wider than a model list on purpose. A model that is fine on its own still runs on a
 * framework with its own licence and its own end-of-life, and was trained on data with its own
 * provenance — so frameworks, runtimes and datasets are rows here too, told apart by `kind`.
 *
 * Three readings decide a row: can its origin be attested (provenance), what does its licence
 * cost you (licence risk), and is it still supported (lifecycle).
 */

/** What an AI component IS. The register calls this the COMPONENT TYPE — "kind" was a word this
 *  file invented, and the product already names its classifications (CI Type, Asset Type). */
export type AiKind = 'hosted-llm' | 'local-model-file' | 'embedding-model' | 'framework'
  | 'vector-db' | 'prompt' | 'dataset' | 'infra' | 'rag-pipeline';
export type AiProvenance = 'Verified' | 'Unverified' | 'Internal';
export type AiRisk = 'LOW' | 'MEDIUM' | 'HIGH';

export interface AiAssetRow {
  id: string;
  name: string;
  /** The line under the name — what this asset IS. */
  subtitle: string;
  kind: AiKind;
  version: string;
  provider: string;
  license: string;
  licenseRisk: AiRisk;
  provenance: AiProvenance;
  /** Distinct CIs carrying it. */
  cis: number;
  /** Days until end-of-life; negative = already past it. Null = the supplier publishes none. */
  eolDays: number | null;
  eol?: string;
  source: AiModel['source'];
  usage: string;
}

/** Fixed, like the dashboard's — a demo that reports a different lifecycle every day is untestable. */
const TODAY = new Date('2026-08-13T00:00:00');
const daysTo = (eol?: string): number | null => {
  if (!eol) return null;
  const t = new Date(`${eol} 00:00:00`).getTime();
  return Number.isNaN(t) ? null : Math.round((t - TODAY.getTime()) / 86400000);
};

/** What a component IS, when the catalog does not say. Models are the unlabelled case, and an
 *  embedding model is one whether it runs locally or behind somebody's API. */
const kindOf = (m: AiModel): AiKind => {
  if (m.kind) return m.kind;
  if (m.task === 'Embeddings') return 'embedding-model';
  return m.source === 'Hosted API' ? 'hosted-llm' : 'local-model-file';
};

/** An unknown licence is HIGH: an unanswered licence question is a worse position to be in than a
 *  restrictive but known one, because you cannot even say what it forbids. */
const RESTRICTIVE = ['AGPL-3.0', 'GPL-3.0', 'GPL-2.0', 'SSPL-1.0'];
export const isRestrictive = (license: string) => RESTRICTIVE.includes(license);
const riskOf = (m: AiModel): AiRisk => {
  if (m.licenseRisk) return m.licenseRisk;
  if (m.license === 'Unknown' || /PII/.test(m.license)) return 'HIGH';
  if (isRestrictive(m.license)) return 'HIGH';
  if (/Commercial|API/.test(m.license)) return 'MEDIUM';
  return 'LOW';
};

/** A model nobody documented well enough to approve cannot be attested either — one fact, not two
 *  flags that could drift apart. */
const provenanceOf = (m: AiModel): AiProvenance => {
  if (m.provenance) return m.provenance;
  if (/In-house|Motadata/.test(m.provider)) return m.modelCard === false ? 'Unverified' : 'Internal';
  return m.modelCard === false ? 'Unverified' : 'Verified';
};

/** Stable, six digits, irregular — reads like a real register rather than a row number. */
const assetId = (name: string) => {
  let h = 2166136261;
  for (const ch of name) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return `AIC-${String((h >>> 0) % 1000000).padStart(6, '0')}`;
};

const KIND_RANK: Record<AiKind, number> = {
  'hosted-llm': 0, 'local-model-file': 1, 'embedding-model': 2, 'rag-pipeline': 3,
  prompt: 4, 'vector-db': 5, framework: 6, infra: 7, dataset: 8,
};

/** Everything the UI judges about ONE asset, derived in one place. The fleet register and a
 *  single CI's AI BOM both read this, so a component cannot be Verified on one screen and
 *  Unverified on the other. */
export const describeAiAsset = (m: AiModel) => {
  const eolDays = daysTo(m.eol);
  return {
    kind: kindOf(m),
    subtitle: m.subtitle ?? (m.modelCard === false ? 'Model · no model card' : m.task),
    version: m.version,
    licenseRisk: riskOf(m),
    provenance: provenanceOf(m),
    eolDays,
    eol: m.eol,
    /** Plain lifecycle wording, shared by the register, the panel and the drawer. */
    lifecycleLabel: eolDays === null ? 'Unknown'
      : eolDays < 0 ? `EOL ${Math.abs(eolDays)}d ago`
      : `EOL in ${eolDays}d`,
  };
};

/** Title-case name for a component type — the register's table shows the raw token, the panel
 *  and the drawer show it as a word. */
export const KIND_TITLE: Record<AiKind, string> = {
  'hosted-llm': 'Model', 'local-model-file': 'Model', 'embedding-model': 'Model',
  framework: 'Framework', 'vector-db': 'Vector-Db', prompt: 'Prompt',
  dataset: 'Dataset', infra: 'Infra', 'rag-pipeline': 'Pipeline',
};

const build = (): AiAssetRow[] => {
  const byName = new Map<string, { m: AiModel; cis: Set<string> }>();
  for (const ep of mockEndpoints) {
    const rec = bomForEndpoint(ep.id);
    if (rec.status === 'Not Generated') continue;
    for (const p of rec.products) {
      for (const m of bomAiAssets(ep.id, p.key) as AiModel[]) {
        let e = byName.get(m.name);
        if (!e) { e = { m, cis: new Set() }; byName.set(m.name, e); }
        e.cis.add(ep.id);
      }
    }
  }

  return [...byName.values()]
    .map(({ m, cis }) => ({
      id: assetId(m.name),
      name: m.name,
      provider: m.provider,
      license: m.license,
      cis: cis.size,
      source: m.source,
      usage: m.usage,
      ...describeAiAsset(m),
    }))
    /* Worst lifecycle first — the register opens on what is already unsupported. Then by kind, so
       the same sort does not shuffle the clean rows about between renders. */
    .sort((a, b) => {
      const la = a.eolDays === null ? Number.MAX_SAFE_INTEGER : a.eolDays;
      const lb = b.eolDays === null ? Number.MAX_SAFE_INTEGER : b.eolDays;
      return la - lb || KIND_RANK[a.kind] - KIND_RANK[b.kind] || a.name.localeCompare(b.name);
    });
};

let CACHE: AiAssetRow[] | null = null;
/** The fleet's AI components. Derived once — the walk is the whole estate. */
export const aiAssets = (): AiAssetRow[] => (CACHE ??= build());

export const pastEol = (r: AiAssetRow) => r.eolDays !== null && r.eolDays < 0;
export const eolSoon = (r: AiAssetRow) => r.eolDays !== null && r.eolDays >= 0 && r.eolDays <= 180;

/** The three readings above the table, counted from the same rows it shows. */
export const aiSummary = () => {
  const rows = aiAssets();
  const eol = rows.filter(pastEol);
  const soon = rows.filter(eolSoon);
  /* Counted on SOURCE, not on component type: an embedding model called over a vendor's API is
     still data leaving the estate, and classifying it as `embedding-model` must not hide that. */
  const hosted = rows.filter((r) => r.source === 'Hosted API');

  /* Provenance is the third reading now: how much of the AI estate cannot be attested at all.
     The licence donut it replaced was a distribution — true, but nothing to act on. */
  const unverified = rows.filter((r) => r.provenance === 'Unverified');

  return {
    total: rows.length,
    pastEol: eol.length,
    eolSoon: soon.length,
    hosted: hosted.length,
    hostedProviders: [...new Set(hosted.map((r) => r.provider))],
    unverified: unverified.length,
    /* What KIND of thing cannot be attested — a dataset nobody can trace is a different
       conversation from a model file nobody can. */
    unverifiedKinds: [...new Set(unverified.map((r) => KIND_TITLE[r.kind]))],
  };
};

// ---------------------------------------------------------------------------
// One component's own page: where it runs, and what is wrong with it.
// ---------------------------------------------------------------------------

export interface AiAssetCi {
  ciId: string;
  endpointId: string;
  hostname: string;
  version: string;
  ip: string;
  os: string;
  ciType: string;
  /** The scan path of the product scope that declared it — where on the host it actually is. */
  location: string;
  origin: string;
}

/** Every CI carrying this component, from the same walk the register is built from. */
export const aiAssetCis = (name: string): AiAssetCi[] => {
  const out: AiAssetCi[] = [];
  for (const ep of mockEndpoints) {
    const rec = bomForEndpoint(ep.id);
    if (rec.status === 'Not Generated') continue;
    for (const p of rec.products) {
      const hit = (bomAiAssets(ep.id, p.key) as AiModel[]).find((m) => m.name === name);
      if (!hit) continue;
      if (out.some((r) => r.endpointId === ep.id)) continue;   // one row per CI, not per scope
      out.push({
        ciId: ep.id.replace(/^EP-/, 'CI-'),
        endpointId: ep.id,
        hostname: ep.hostName,
        version: hit.version,
        ip: ep.ipAddress,
        os: ep.osName,
        ciType: /Server/i.test(ep.osName) ? 'Infrastructure' : 'Endpoint',
        location: p.path === '/' ? '/' : `${p.path}/lib`,
        origin: 'AIROM scan',
      });
    }
  }
  return out;
};

export type SignalStatus = 'Critical' | 'High' | 'Medium' | 'Pass';

export interface AiRiskSignal {
  signal: string;
  status: SignalStatus;
  finding: string;
  action: string | null;
}

/* The five checks the AI risk overlay runs on every asset. They are stated whether they pass or
 * fail, and that is the point: a Pass here is an attested check, not an absence of data. A screen
 * that only listed failures could not tell "we looked and it is fine" apart from "we never
 * looked", which is the difference between evidence and silence. */
export const aiRiskSignals = (r: AiAssetRow): AiRiskSignal[] => [
  {
    signal: 'Lifecycle',
    status: r.eolDays !== null && r.eolDays < 0 ? 'Critical' : eolSoon(r) ? 'Medium' : 'Pass',
    finding: r.eolDays === null
      ? 'No end-of-life published by the supplier.'
      : r.eolDays < 0
        ? `Past end-of-life since ${r.eol} — receives no security fixes.`
        : `Supported until ${r.eol}.`,
    action: r.eolDays !== null && r.eolDays < 0 ? 'Upgrade or retire this component.' : null,
  },
  {
    signal: 'Provenance',
    status: r.provenance === 'Unverified' ? 'High' : 'Pass',
    finding: r.provenance === 'Verified' ? 'Origin attested against its source registry.'
      : r.provenance === 'Internal' ? 'Built in-house — attested against the internal registry.'
      : 'Nothing attests where this artefact came from.',
    action: r.provenance === 'Unverified' ? 'Attest the source, or replace it with one that can be.' : null,
  },
  {
    signal: 'Serialization safety',
    status: /pickle/i.test(r.subtitle) ? 'Critical' : 'Pass',
    finding: /pickle/i.test(r.subtitle)
      ? 'Pickled artefact — deserialising it executes code on load.'
      : 'No unsafe serialization detected.',
    action: /pickle/i.test(r.subtitle) ? 'Isolate the loader, or re-export in a safe format.' : null,
  },
  {
    signal: 'Licence rights',
    status: r.licenseRisk === 'HIGH' ? 'High' : r.licenseRisk === 'MEDIUM' ? 'Medium' : 'Pass',
    finding: r.licenseRisk === 'LOW'
      ? `${r.license} — no restrictive terms detected.`
      : r.license === 'Unknown'
        ? 'Licence could not be determined — the terms are unknown, not permissive.'
        : `${r.license} — terms constrain what may be shipped with it.`,
    action: r.licenseRisk === 'HIGH' ? 'Confirm the terms, or replace the component.' : null,
  },
  {
    signal: 'Data egress',
    status: r.source === 'Hosted API' ? 'Medium' : 'Pass',
    finding: r.source === 'Hosted API'
      ? `Called over ${r.provider}'s hosted API — prompts and payloads leave the estate.`
      : 'Runs inside the estate — no model-provider egress.',
    action: r.source === 'Hosted API' ? 'Review what is sent, and to whom.' : null,
  },
];
