import { mockEndpoints } from './endpointsData';
import {
  bomForEndpoint, bomComponents, bomCryptoAssets, bomAiModels, bomCiId, cveSeverity,
} from './bomData';
import type { BomComponent, CryptoAsset, AiModel, BomSeverity } from './bomData';

/* Every figure on the BOM Dashboard, derived from ONE walk of the fleet.
 *
 * The rule the page states out loud — "every figure below is derived live from the BOM data it
 * links to" — only holds if the dashboard reads the same accessors the drawers do. So nothing
 * here is authored: it is `bomComponents` / `bomCryptoAssets` / `bomAiModels` counted up. The
 * walk is memoised because it touches ~30 CIs x their products on every render otherwise.
 */

/** Fixed reference date. Countdowns against a real clock would make the page report something
 *  different every day and make its checks unrepeatable; the fixtures carry fixed dates too. */
export const DASH_TODAY = new Date('2026-08-17T00:00:00Z');

const dayDiff = (iso: string): number | null => {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.round((t - DASH_TODAY.getTime()) / 86_400_000);
};

// ---------------------------------------------------------------------------
// Licence policy — the licence STRING exists on every component; whether it is
// acceptable does not. That is a policy question, so it is answered in one place.
// ---------------------------------------------------------------------------

export type LicencePolicy = 'denied' | 'restricted' | 'undeclared' | 'allowed';

/** Strong copyleft is denied outright: linking it into a distributed product forces the whole
 *  work under the same terms. Weak copyleft is restricted — usable, but only under review. */
const DENIED = /^(AGPL|GPL-3)/i;
const RESTRICTED = /^(LGPL|MPL|EPL|GPL-2|CDDL|CPL)/i;
const UNDECLARED = /^(unknown|undeclared|noassertion|)$/i;

export const licencePolicy = (licence: string | undefined): LicencePolicy => {
  const l = (licence ?? '').trim();
  if (UNDECLARED.test(l)) return 'undeclared';
  if (DENIED.test(l)) return 'denied';
  if (RESTRICTED.test(l)) return 'restricted';
  return 'allowed';
};

/** A record is FULL DETAIL when it can answer the three questions an auditor asks of a
 *  component: what exactly is it (a resolvable purl), which version, and under what licence.
 *  Anything missing one of those is a row you cannot act on. */
export const isFullDetail = (c: BomComponent): boolean =>
  !!c.purl && !!c.version && c.version !== '—' && licencePolicy(c.license) !== 'undeclared';

// ---------------------------------------------------------------------------
// Shapes
// ---------------------------------------------------------------------------

export interface AffectedComponent {
  key: string;
  name: string;
  version: string;
  /** How many CIs carry this component at ANY version — blast radius, not severity. */
  cis: number;
  /** How many distinct versions of it the estate carries. */
  versions: number;
  cves: string[];
  /** The product scopes it was found under, deduped. */
  products: string[];
  /** The worst severity among its CVEs. */
  severity: BomSeverity | null;
}

export interface LicenceSlice {
  licence: string;
  count: number;
  pct: number;
  policy: LicencePolicy;
}

/* Both of these are keyed by NAME, not by (CI, name). The same certificate subject and the same
 * model are deployed across many CIs, and listing one row per CI fills the panel with six copies
 * of the row while hiding the other five findings. One row per thing, carrying how many CIs it
 * sits on — the count is the useful part anyway, since rotating it is one job either way. */
export interface ExpiringCert {
  key: string;
  name: string;
  /** What stops working if it lapses — the reading for anyone who does not know the subject. */
  serves: string;
  /** The CI whose copy expires soonest — the one the CBOM button opens. */
  endpointId: string;
  ciId: string;
  cis: number;
  detail: string;
  days: number;
  quantumVulnerable: boolean;
}

export interface EolModel {
  key: string;
  name: string;
  endpointId: string;
  ciId: string;
  cis: number;
  detail: string;
  /** Negative = already past end-of-life. */
  days: number;
  past: boolean;
}

export interface BomDashboard {
  ciCount: number;
  productCount: number;
  /** Every component row across every CI and product — the same number the BOMs add up to. */
  declared: number;
  /** Distinct name@version across the fleet. The licence donut counts these, not instances:
   *  the same library on 30 hosts is one licensing decision, not thirty. */
  unique: number;
  fullDetail: number;
  fullDetailPct: number;

  cveIds: string[];
  cveBySeverity: Record<BomSeverity, number>;
  /** CIs carrying at least one component with a known CVE — the blast radius of ALL of them, not
   *  of the worst one. This is what the KPI states: a CVE count is a property of the catalogue,
   *  and only the estate it touches says how much of the fleet is exposed. */
  vulnerableCis: number;
  /** The single worst-known vulnerability, named — `components` counts distinct component NAMES
   *  and `cis` the estate it reaches; the lead is chosen by reach, because that is what makes one
   *  named flaw worse than another. Derived and correct, but nothing renders it at the moment. */
  leadVuln: { id: string; label: string; components: number; cis: number; critical: number } | null;

  affected: AffectedComponent[];
  /** A product every ranked component appears in, if there is one. Repeating it on all eight rows
   *  says nothing eight times; the panel states it once and the rows carry what differs. */
  sharedProduct: string | null;
  licences: LicenceSlice[];
  licenceTotal: number;
  licenceCounts: Record<LicencePolicy, number>;

  /** Every tracked certificate with a published expiry, soonest first — the timeline plots all of
   *  them rather than a top-N, because a rotation window with nothing in it is itself the answer. */
  certs: ExpiringCert[];
  /** How many fall in each rotation window. Derived here so the chips, the band tints and the
   *  dots can never disagree about which window a certificate is in. */
  certBands: { key: 'week' | 'd30' | 'd120' | 'd180' | 'beyond'; label: string; count: number }[];
  certsDueSoon: number;
  certTotal: number;
  certQuantumVulnerable: number;

  models: EolModel[];
  modelTotal: number;
  modelsPastEol: number;
  modelsEolWithin6m: number;
  /** CIs running at least one model already past end-of-life — the reach of the figure above,
   *  counted the same way as `vulnerableCis` so the three KPI cards mean the same thing by "CIs". */
  eolModelCis: number;
}

// ---------------------------------------------------------------------------

/** Log4Shell is the one every stakeholder already knows by name. Naming it turns "8
 *  vulnerabilities" into a thing somebody can go and do something about. */
const NAMED_VULNS: Record<string, string> = {
  'CVE-2021-44228': 'Log4Shell',
  'CVE-2021-45046': 'Log4Shell',
  'CVE-2022-42889': 'Text4Shell',
};

let CACHE: BomDashboard | null = null;

export const bomDashboard = (): BomDashboard => {
  if (CACHE) return CACHE;

  const uniqueComponents = new Map<string, { c: BomComponent; cis: Set<string>; products: Set<string> }>();
  const certByName = new Map<string, ExpiringCert>();
  const modelByName = new Map<string, EolModel>();
  const certCis = new Map<string, Set<string>>();
  const modelCis = new Map<string, Set<string>>();
  const modelNames = new Set<string>();
  let declared = 0;
  let productCount = 0;
  let certTotal = 0;
  let certQuantum = 0;

  for (const ep of mockEndpoints) {
    const record = bomForEndpoint(ep.id);
    if (record.status === 'Not Generated') continue;
    productCount += record.products.length;

    for (const p of record.products) {
      for (const c of bomComponents(ep.id, p.key)) {
        declared++;
        const key = `${c.name}@${c.version}`;
        let entry = uniqueComponents.get(key);
        if (!entry) { entry = { c, cis: new Set(), products: new Set() }; uniqueComponents.set(key, entry); }
        entry.cis.add(ep.id);
        entry.products.add(p.name);
      }

      for (const a of bomCryptoAssets(ep.id, p.key) as CryptoAsset[]) {
        if (a.primitive !== 'Certificate') continue;
        certTotal++;
        if (a.compliance === 'Quantum-vulnerable') certQuantum++;
        if (!a.expiry) continue;
        const days = dayDiff(a.expiry);
        if (days === null) continue;
        if (!certCis.has(a.name)) certCis.set(a.name, new Set());
        certCis.get(a.name)!.add(ep.id);
        const prev = certByName.get(a.name);
        // Keep the copy that expires soonest — that is the one setting the deadline.
        if (!prev || days < prev.days) {
          certByName.set(a.name, {
            key: a.name, name: a.name, serves: a.serves ?? 'A service on this host',
            endpointId: ep.id, ciId: bomCiId(ep.id), cis: 0,
            detail: `${a.algorithm} ${a.keyLength}`,
            days, quantumVulnerable: a.compliance === 'Quantum-vulnerable',
          });
        }
      }

      for (const m of bomAiModels(ep.id, p.key) as AiModel[]) {
        modelNames.add(m.name);
        if (!m.eol) continue;
        const days = dayDiff(m.eol);
        if (days === null) continue;
        if (!modelCis.has(m.name)) modelCis.set(m.name, new Set());
        modelCis.get(m.name)!.add(ep.id);
        if (modelByName.has(m.name)) continue;
        const bits = [
          m.source === 'Hosted API' ? 'Hosted LLM API' : m.source === 'Embedded' ? 'Embedded model' : 'Model',
          m.modelCard === false ? 'no model card' : null,
          m.risk ?? null,
          m.provider,
        ].filter(Boolean) as string[];
        modelByName.set(m.name, {
          key: m.name, name: m.name, endpointId: ep.id, ciId: bomCiId(ep.id), cis: 0,
          detail: bits.join(' · '), days, past: days < 0,
        });
      }
    }
  }

  // ── components ────────────────────────────────────────────────────────
  const uniques = [...uniqueComponents.values()];
  const fullDetail = uniques.filter((u) => isFullDetail(u.c)).length;

  const SEV_RANK: Record<BomSeverity, number> = { Critical: 4, High: 3, Medium: 2, Low: 1 };
  const worst = (cves: string[]): BomSeverity | null =>
    cves.reduce<BomSeverity | null>((acc, id) => {
      const s = cveSeverity(id);
      return !acc || SEV_RANK[s] > SEV_RANK[acc] ? s : acc;
    }, null);

  /* Rolled up to the COMPONENT. The panel asks which components create the most exposure, and
     `openssl` at seven versions is one component with one answer — six rows of openssl pushed
     every other finding off the panel and made every row look identical. */
  const byComponent = new Map<string, {
    name: string; cis: Set<string>; products: Set<string>; versions: Map<string, number>; cves: Set<string>;
  }>();
  for (const { c, cis, products } of uniques) {
    let e = byComponent.get(c.name);
    if (!e) { e = { name: c.name, cis: new Set(), products: new Set(), versions: new Map(), cves: new Set() }; byComponent.set(c.name, e); }
    cis.forEach((x) => e!.cis.add(x));
    products.forEach((p) => e!.products.add(p));
    e.versions.set(c.version, (e.versions.get(c.version) ?? 0) + cis.size);
    (c.cves ?? []).forEach((v) => e!.cves.add(v));
  }

  const affected: AffectedComponent[] = [...byComponent.values()]
    .map((e) => ({
      key: e.name,
      name: e.name,
      // The version on the most CIs — the one a remediation would target first.
      version: [...e.versions.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—',
      versions: e.versions.size,
      cis: e.cis.size,
      cves: [...e.cves],
      products: [...e.products],
      severity: worst([...e.cves]),
    }))
    /* Reach first, then how bad it is. Reach barely varies in this estate, so severity is what
       actually orders the list — a critical on 25 CIs outranks a low on the same 25. */
    .sort((a, b) => b.cis - a.cis
      || (b.severity ? SEV_RANK[b.severity] : 0) - (a.severity ? SEV_RANK[a.severity] : 0)
      || b.cves.length - a.cves.length
      || a.name.localeCompare(b.name))
    .slice(0, 8);

  // ── vulnerabilities ───────────────────────────────────────────────────
  const cveIds = [...new Set(uniques.flatMap((u) => u.c.cves ?? []))].sort();
  const cveBySeverity = { Critical: 0, High: 0, Medium: 0, Low: 0 } as Record<BomSeverity, number>;
  for (const id of cveIds) cveBySeverity[cveSeverity(id)]++;

  /* Any CVE, any severity — one CI is counted once however many vulnerable components it carries. */
  const vulnerableCis = new Set(
    uniques.filter((u) => (u.c.cves ?? []).length > 0).flatMap((u) => [...u.cis]),
  ).size;

  /* Counted over distinct component NAMES and distinct CIs.
   *
   * This used to count `uniques` — name@version rows — and call the result "components". The
   * fixture carries a library at up to twenty versions, so Text4Shell reported "17 components"
   * when it is carried by exactly ONE (commons-text) on 7 CIs, and it took the lead from
   * Log4Shell purely by having one more version variant. Neither figure was about the estate.
   * The lead is now the named flaw that reaches the most CIs, which is the thing that makes one
   * worse than another. */
  let leadVuln: BomDashboard['leadVuln'] = null;
  for (const id of cveIds) {
    const label = NAMED_VULNS[id];
    if (!label) continue;
    const hits = uniques.filter((u) => (u.c.cves ?? []).includes(id));
    const names = new Set(hits.map((u) => u.c.name));
    const reach = new Set(hits.flatMap((u) => [...u.cis]));
    const critical = new Set(
      hits.flatMap((u) => (u.c.cves ?? []).filter((v) => cveSeverity(v) === 'Critical')),
    ).size;
    const better = !leadVuln
      || reach.size > leadVuln.cis
      || (reach.size === leadVuln.cis && cveSeverity(id) === 'Critical' && critical > leadVuln.critical);
    if (better) leadVuln = { id, label, components: names.size, cis: reach.size, critical };
  }

  // ── licences ──────────────────────────────────────────────────────────
  const byLicence = new Map<string, number>();
  const licenceCounts: Record<LicencePolicy, number> = { denied: 0, restricted: 0, undeclared: 0, allowed: 0 };
  for (const u of uniques) {
    const raw = licencePolicy(u.c.license) === 'undeclared' ? 'Undeclared' : u.c.license;
    byLicence.set(raw, (byLicence.get(raw) ?? 0) + 1);
    licenceCounts[licencePolicy(u.c.license)]++;
  }
  const licenceTotal = uniques.length;
  const ranked = [...byLicence.entries()].sort((a, b) => b[1] - a[1]);
  const TOP = 5;
  const head = ranked.slice(0, TOP);
  const tail = ranked.slice(TOP).reduce((n, [, v]) => n + v, 0);
  const licences: LicenceSlice[] = head.map(([licence, count]) => ({
    licence, count, pct: (count / licenceTotal) * 100,
    policy: licence === 'Undeclared' ? 'undeclared' : licencePolicy(licence),
  }));
  if (tail > 0) licences.push({ licence: 'Other', count: tail, pct: (tail / licenceTotal) * 100, policy: 'allowed' });

  // ── certificates and models, soonest first ────────────────────────────
  const certs = [...certByName.values()]
    .map((c) => ({ ...c, cis: certCis.get(c.name)?.size ?? 1 }))
    .sort((a, b) => a.days - b.days);
  const models = [...modelByName.values()]
    .map((m) => ({ ...m, cis: modelCis.get(m.name)?.size ?? 1 }))
    .sort((a, b) => a.days - b.days);
  /* Same shape as `vulnerableCis`: the estate running at least one model that is already past
     end-of-life, each CI counted once however many such models it hosts. */
  const eolModelCis = new Set(
    models.filter((m) => m.past).flatMap((m) => [...(modelCis.get(m.name) ?? [])]),
  ).size;

  CACHE = {
    ciCount: mockEndpoints.length,
    productCount,
    declared,
    unique: uniques.length,
    fullDetail,
    fullDetailPct: uniques.length ? (fullDetail / uniques.length) * 100 : 0,

    cveIds,
    cveBySeverity,
    vulnerableCis,
    leadVuln,

    affected,
    sharedProduct: affected.length
      ? (affected[0].products.find((p) => affected.every((a) => a.products.includes(p))) ?? null)
      : null,
    licences,
    licenceTotal,
    licenceCounts,

    /* All of them, soonest first. The panel is a timeline now, not a list: every certificate is a
       dot, so slicing to five would have drawn a picture of the estate with most of it missing. */
    certs,
    certBands: [
      { key: 'week' as const, label: 'this week', count: certs.filter((c) => c.days <= 7).length },
      { key: 'd30' as const, label: '≤ 30 days', count: certs.filter((c) => c.days > 7 && c.days <= 30).length },
      { key: 'd120' as const, label: '31–120 days', count: certs.filter((c) => c.days > 30 && c.days <= 120).length },
      { key: 'd180' as const, label: '120–180 days', count: certs.filter((c) => c.days > 120 && c.days <= 180).length },
      /* Everything else, including the certificates with no published expiry — they are tracked,
         they are simply not a rotation this cycle. */
      { key: 'beyond' as const, label: 'beyond 180d', count: certTotal - certs.filter((c) => c.days <= 180).length },
    ],
    certsDueSoon: certs.filter((c) => c.days < 120).length,
    certTotal,
    certQuantumVulnerable: certQuantum,

    models: models.slice(0, 6),
    modelTotal: modelNames.size,
    modelsPastEol: models.filter((m) => m.past).length,
    modelsEolWithin6m: models.filter((m) => !m.past && m.days <= 180).length,
    eolModelCis,
  };
  return CACHE;
};
