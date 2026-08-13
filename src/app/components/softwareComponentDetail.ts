import type { SoftwareComponent, ComponentSeverity, Ecosystem } from './softwareComponentsData';
/* The estate's group list, imported rather than retyped: the Patch detail tab filters on
   exactly these names, and two copies would drift the first time one is edited. */
import { REMOTE_OFFICES } from './PatchComputersTab';

/* Everything the component detail page shows, DERIVED from the listing row.
 *
 * The header restates the row — 23 CIs, 31 products, 3 CVEs — so the two must come from one
 * place or they will drift the first time a number is edited. Nothing here is stored: each
 * list is generated from the component's own id, so it is stable across renders and reloads
 * while still summing to exactly what the row claims. */

/** Deterministic per-component stream: same component, same fleet, every time. */
function rng(seed: string) {
  let h = 2166136261;
  for (const ch of seed) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 100000) / 100000; };
}

export type CiType = 'Hardware' | 'Infrastructure';
export type Origin = 'Agent scan' | 'Vendor SBOM';

export interface AffectedCi {
  ciId: string;
  endpointId: string;
  hostname: string;
  ip: string;
  ciType: CiType;
  os: string;
  /** The remote office this CI belongs to — the same groups Patch filters by. */
  office: string;
  /** The build THIS endpoint carries. Not every CI runs the same one — see version drift. */
  version: string;
  origin: Origin;
  products: number;
}

const WORKSTATION_OS = ['Microsoft Windows 10 Pro', 'Microsoft Windows 11 Pro', 'Microsoft Windows 10 Enterprise'];
const SERVER_OS = ['Microsoft Windows Server 2019', 'Microsoft Windows Server 2022', 'Microsoft Windows Server 2025'];
const HOST_PREFIX = ['DESKTOP', 'WIN', 'LT', 'SRV'];

/* ── version drift ───────────────────────────────────────────
   A component is rarely one build across an estate: some endpoints lag, so the same
   component sits at several versions at once. The listing row names the PRIMARY build
   (the one most endpoints carry); the drift is everything else, and it matters because
   a fix applies per version — upgrading the primary leaves the laggards exposed.

   Older builds are derived from the primary rather than invented, so they sort correctly
   and read as the same product's history. */
function olderThan(v: string, n: number, r: () => number): string[] {
  const parts = v.split('.').map((p) => parseInt(p, 10));
  if (parts.some((x) => Number.isNaN(x))) return [];
  const out: string[] = [];
  let cur = parts.slice();
  for (let i = 0; i < n; i++) {
    const next = cur.slice();
    const last = next.length - 1;
    const step = 1 + Math.floor(r() * 2);
    /* Borrow from the segment above rather than giving up: 2.14.1 must be able to reach
       2.13.x, or a component whose patch number is already 0 or 1 would report no drift
       at all — which looked like "everything is on one build" when it isn't. */
    if (next[last] >= step) next[last] -= step;
    else if (next.length > 1 && next[last - 1] > 0) { next[last - 1] -= 1; next[last] = 1 + Math.floor(r() * 3); }
    else if (next[last] > 0) next[last] = 0;
    else break;
    if (next.some((x) => x < 0)) break;
    cur = next;
    out.push(cur.join('.'));
  }
  return out;
}

/** How many builds this component sits at. A wider estate drifts further. */
const driftCount = (cis: number) => Math.max(1, Math.min(4, 1 + Math.floor(cis / 6)));

/** Every build present, primary first. */
export function versionSpread(c: SoftwareComponent): string[] {
  const r = rng(c.id + ':ver');
  return [c.version, ...olderThan(c.version, driftCount(c.cis) - 1, r)];
}
const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

/** Exactly `c.cis` rows, and their product counts sum to exactly `c.products`. */
export function affectedCis(c: SoftwareComponent): AffectedCi[] {
  const r = rng(c.id + ':cis');
  const versions = versionSpread(c);
  const rows: AffectedCi[] = [];
  for (let i = 0; i < c.cis; i++) {
    const infra = r() < 0.45;
    const tag = Array.from({ length: 8 }, () => CHARS[Math.floor(r() * CHARS.length)]).join('');
    rows.push({
      ciId: `CI-${i + 1}`,
      endpointId: `EP-${c.cis - i}`,
      hostname: `${HOST_PREFIX[Math.floor(r() * HOST_PREFIX.length)]}-${tag}`,
      ip: `172.16.${12 + Math.floor(r() * 3)}.${10 + Math.floor(r() * 240)}`,
      ciType: infra ? 'Infrastructure' : 'Hardware',
      office: REMOTE_OFFICES[Math.floor(r() * REMOTE_OFFICES.length)],
      /* Roughly half the estate on the primary build, the rest spread evenly over the
         older ones — so every version in the spread has at least one CI behind it and
         the counts always add back up to the row's CI total. */
      version: (() => {
        const primaryShare = Math.ceil(c.cis / 2);
        if (versions.length === 1 || i < primaryShare) return versions[0];
        return versions[1 + ((i - primaryShare) % (versions.length - 1))];
      })(),
      os: infra ? SERVER_OS[Math.floor(r() * SERVER_OS.length)] : WORKSTATION_OS[Math.floor(r() * WORKSTATION_OS.length)],
      /* A CI can only be attested by a source the component actually has. */
      origin: c.sources.length === 1
        ? (c.sources[0] === 'agent' ? 'Agent scan' : 'Vendor SBOM')
        : (r() < 0.5 ? 'Agent scan' : 'Vendor SBOM'),
      products: 1,
    });
  }
  /* Every CI carries the component through at least one product; spread the remainder so the
     column adds up to the `products` figure the listing and the header both quote. */
  let spare = Math.max(0, c.products - c.cis);
  for (let i = 0; spare > 0; i = (i + 1) % rows.length) {
    const add = Math.min(spare, 1 + Math.floor(r() * 2));
    rows[i].products += add;
    spare -= add;
  }
  return rows;
}

/* NVD's analysis workflow states: how far the CVE RECORD has been through analysis.
   Deliberately a different question from "are we affected" — a fully Analyzed record can
   still be one nobody has to act on, and a Received one may turn out to be urgent. The
   list is the single source for both the pill map and the filter, so the two can't drift. */
export const VULN_STATUSES = [
  'Received', 'Awaiting Analysis', 'Undergoing Analysis', 'Analyzed',
  'Modified', 'Deferred', 'Rejected', 'Unknown',
] as const;
export type VulnStatus = (typeof VULN_STATUSES)[number];

export interface ComponentCve {
  id: string;
  /** The name people actually use — "Log4Shell" is how this CVE gets discussed. */
  title: string;
  severity: Exclude<ComponentSeverity, 'None'>;
  /** Severity of the flaw; EPSS is the odds of exploitation; risk blends the two with
   *  reachability. Three different questions, so all three are shown. */
  cvss: number;
  epss: number;
  risk: number;
  /** Known exploited in the wild. Only a component the row marks KEV can carry one. */
  exploited: boolean;
  status: VulnStatus;
  vulnType: string;
  fixedIn: string | null;
}

/* Real advisories for the components that carry them, rather than generated ids: a CVE
   number is checkable, and a demo that invents them reads as fiction the moment anyone
   looks one up. Ordered worst-first, and the first entry IS the row's top severity. */
const CVE_FIXTURES: Record<string, Omit<ComponentCve, 'fixedIn'>[]> = {
  'CMP-000412': [ // log4j-core 2.14.1
    { id: 'CVE-2021-44228', title: 'Log4Shell', severity: 'Critical', cvss: 10.0, epss: 0.97, risk: 98, exploited: true, status: 'Analyzed', vulnType: 'Application' },
    { id: 'CVE-2021-45046', title: 'Log4Shell incomplete fix', severity: 'Critical', cvss: 9.0, epss: 0.84, risk: 91, exploited: true, status: 'Modified', vulnType: 'Application' },
    { id: 'CVE-2021-44832', title: 'JDBC Appender RCE', severity: 'Medium', cvss: 6.6, epss: 0.21, risk: 58, exploited: false, status: 'Undergoing Analysis', vulnType: 'Application' },
  ],
  'CMP-000604': [ // openssl 3.0.1
    { id: 'CVE-2022-3602', title: 'X.509 punycode buffer overflow', severity: 'High', cvss: 7.5, epss: 0.42, risk: 74, exploited: false, status: 'Analyzed', vulnType: 'Library' },
    { id: 'CVE-2022-3786', title: 'X.509 punycode buffer overflow (2)', severity: 'High', cvss: 7.5, epss: 0.38, risk: 71, exploited: false, status: 'Analyzed', vulnType: 'Library' },
    { id: 'CVE-2023-0286', title: 'X.400 address type confusion', severity: 'High', cvss: 7.4, epss: 0.19, risk: 62, exploited: false, status: 'Awaiting Analysis', vulnType: 'Library' },
  ],
  'CMP-000617': [ // jackson-databind 2.12.3
    { id: 'CVE-2022-42003', title: 'Deep wrapper array DoS', severity: 'High', cvss: 7.5, epss: 0.31, risk: 68, exploited: false, status: 'Analyzed', vulnType: 'Library' },
    { id: 'CVE-2022-42004', title: 'Unchecked primitive value deserialization', severity: 'High', cvss: 7.5, epss: 0.28, risk: 65, exploited: false, status: 'Modified', vulnType: 'Library' },
    { id: 'CVE-2020-36518', title: 'Nested object depth DoS', severity: 'Medium', cvss: 5.9, epss: 0.14, risk: 49, exploited: false, status: 'Deferred', vulnType: 'Library' },
  ],
  'CMP-000503': [ // spring-core 5.3.18
    { id: 'CVE-2022-22965', title: 'Spring4Shell', severity: 'Critical', cvss: 9.8, epss: 0.94, risk: 96, exploited: false, status: 'Analyzed', vulnType: 'Application' },
    { id: 'CVE-2022-22950', title: 'SpEL expression DoS', severity: 'Medium', cvss: 5.4, epss: 0.11, risk: 44, exploited: false, status: 'Undergoing Analysis', vulnType: 'Application' },
  ],
  'CMP-000702': [ // lodash 4.17.20
    { id: 'CVE-2021-23337', title: 'Command injection via template', severity: 'High', cvss: 7.2, epss: 0.29, risk: 66, exploited: false, status: 'Analyzed', vulnType: 'Library' },
    { id: 'CVE-2020-28500', title: 'ReDoS in toNumber / trim', severity: 'Medium', cvss: 5.3, epss: 0.09, risk: 41, exploited: false, status: 'Rejected', vulnType: 'Library' },
  ],
  'CMP-000418': [ // xz-utils 5.6.0
    { id: 'CVE-2024-3094', title: 'Upstream backdoor in liblzma', severity: 'Critical', cvss: 10.0, epss: 0.91, risk: 97, exploited: true, status: 'Analyzed', vulnType: 'OS Package' },
  ],
  'CMP-000511': [ // commons-text 1.9
    { id: 'CVE-2022-42889', title: 'Text4Shell', severity: 'Critical', cvss: 9.8, epss: 0.88, risk: 93, exploited: false, status: 'Modified', vulnType: 'Application' },
  ],
  'CMP-000745': [ // golang.org/x/crypto 0.16.0
    { id: 'CVE-2023-48795', title: 'Terrapin SSH prefix truncation', severity: 'Medium', cvss: 5.9, epss: 0.17, risk: 52, exploited: false, status: 'Awaiting Analysis', vulnType: 'Library' },
  ],
  'CMP-000810': [ // node-forge 1.2.1
    { id: 'CVE-2022-24771', title: 'RSA PKCS#1 signature forgery', severity: 'High', cvss: 7.5, epss: 0.24, risk: 63, exploited: false, status: 'Received', vulnType: 'Library' },
  ],
  'CMP-000826': [ // zlib 1.2.11
    { id: 'CVE-2018-25032', title: 'Memory corruption on deflate', severity: 'High', cvss: 7.5, epss: 0.33, risk: 69, exploited: false, status: 'Unknown', vulnType: 'OS Package' },
  ],
};

/* Weighted toward Analyzed / Modified: most published CVEs have already been through
   NVD, so a generated list that spread evenly across all eight would misrepresent the
   shape of real data. */
const FALLBACK_STATUS: VulnStatus[] = [
  'Analyzed', 'Analyzed', 'Analyzed', 'Modified', 'Modified',
  'Undergoing Analysis', 'Awaiting Analysis', 'Received', 'Deferred', 'Unknown',
];

const FALLBACK_TITLE: Record<string, string> = {
  Critical: 'Remote code execution', High: 'Access control bypass',
  Medium: 'Information disclosure', Low: 'Denial of service',
};

/** Exactly `c.vulnerabilities` CVEs, the worst of which is the row's `topSeverity`. */
export function componentCves(c: SoftwareComponent): ComponentCve[] {
  if (!c.vulnerabilities) return [];
  const fixture = CVE_FIXTURES[c.id];
  if (fixture) return fixture.map((v) => ({ ...v, fixedIn: c.fixVersion }));

  /* No advisory list authored for this component — generate one that still obeys the
     row: the right count, nothing worse than the stated top severity, and KEV only if
     the row says so. */
  const r = rng(c.id + ':cve');
  const ladder: Exclude<ComponentSeverity, 'None'>[] = ['Critical', 'High', 'Medium', 'Low'];
  const top = ladder.indexOf(c.topSeverity as Exclude<ComponentSeverity, 'None'>);
  const base = { Critical: 9.0, High: 7.2, Medium: 5.1, Low: 3.0 };
  return Array.from({ length: c.vulnerabilities }, (_, i) => {
    const sev = i === 0 ? ladder[top] : ladder[Math.min(3, top + Math.floor(r() * (4 - top)))];
    const epss = +(0.05 + r() * 0.8).toFixed(2);
    return {
      id: `CVE-202${3 + Math.floor(r() * 3)}-${10000 + Math.floor(r() * 89999)}`,
      title: FALLBACK_TITLE[sev],
      severity: sev,
      cvss: +(base[sev] + r() * 0.9).toFixed(1),
      epss,
      risk: Math.round(30 + epss * 60 + r() * 8),
      exploited: c.kev && i === 0,
      status: FALLBACK_STATUS[Math.floor(r() * FALLBACK_STATUS.length)],
      vulnType: c.ecosystem === 'Deb' || c.ecosystem === 'Generic' ? 'OS Package' : 'Library',
      fixedIn: c.fixVersion,
    };
  });
}

export interface ComponentSourceRecord {
  kind: Origin;
  detail: string;
  cis: number;
  lastSeen: string;
  document: string | null;
}

/** One record per source on the row, and their CI counts sum to the row's CI total. */
export function componentSources(c: SoftwareComponent): ComponentSourceRecord[] {
  const rows = affectedCis(c);
  return c.sources.map((s) => {
    const kind: Origin = s === 'agent' ? 'Agent scan' : 'Vendor SBOM';
    const n = rows.filter((x) => x.origin === kind).length;
    return {
      kind,
      detail: s === 'agent'
        ? 'Discovered on disk by the ServiceOps agent during a scheduled BOM scan.'
        : 'Declared in a CycloneDX document ingested against the CI.',
      cis: n,
      lastSeen: s === 'agent' ? 'Jun 16, 2026' : 'Jun 09, 2026',
      document: s === 'agent' ? null : `${c.name}-${c.version}.cdx.json`,
    };
  });
}

/* ── evidence ────────────────────────────────────────────────
   The Sources tab answers "why do we believe this is here": who reported it, in what
   document format, where on disk it was found, and what the supplier attested. Anything
   nobody claimed reads "Not asserted" rather than being hidden — an absent attestation
   is a finding in its own right. */
export interface ComponentEvidence {
  formats: string[];
  foundIn: string[];
  supplier: string | null;
  sha256: string | null;
}

/** Where a component of this ecosystem actually lives on a machine. */
const PATHS: Record<Ecosystem, string[]> = {
  Maven: ['opt/payments/WEB-INF/lib', 'usr/share/java'],
  Npm: ['opt/portal/node_modules', 'usr/lib/node_modules'],
  Generic: ['usr/lib/x86_64-linux-gnu', 'usr/bin'],
  Deb: ['usr/lib/x86_64-linux-gnu', 'var/lib/dpkg/info'],
  Golang: ['usr/local/bin', 'opt/gateway/bin'],
  PyPI: ['usr/lib/python3/dist-packages', 'opt/analytics/venv/lib'],
  NuGet: ['Program Files/ServiceOps/bin', 'inetpub/wwwroot/bin'],
};

/** Vendors that ship a signed document assert who they are; an agent scan cannot. */
const SUPPLIERS: Record<string, string> = {
  'jackson-databind': 'FasterXML, LLC', 'spring-core': 'VMware, Inc.',
  'Newtonsoft.Json': 'Newtonsoft', 'golang.org/x/crypto': 'The Go Authors',
};

export function componentEvidence(c: SoftwareComponent): ComponentEvidence {
  const r = rng(c.id + ':ev');
  const formats: string[] = [];
  if (c.sources.includes('agent')) formats.push('CycloneDX 1.6');
  if (c.sources.includes('vendor')) formats.push('SPDX 2.3');
  const supplier = SUPPLIERS[c.name] && c.sources.includes('vendor') ? SUPPLIERS[c.name] : null;
  const hex = '0123456789abcdef';
  return {
    formats,
    foundIn: PATHS[c.ecosystem],
    supplier,
    /* A digest is only meaningful when someone signed for it, so it travels with the
       supplier rather than being invented for every row. */
    sha256: supplier ? Array.from({ length: 64 }, () => hex[Math.floor(r() * 16)]).join('') : null,
  };
}

/** Every build present with the number of CIs on it — counted from the rows themselves,
 *  so the right rail and the Affected CIs table can never quote different numbers. */
export function componentVersions(c: SoftwareComponent): { version: string; cis: number }[] {
  const rows = affectedCis(c);
  return versionSpread(c)
    .map((v) => ({ version: v, cis: rows.filter((r) => r.version === v).length }))
    .filter((x) => x.cis > 0);
}

/** Maven means Java — the ecosystem already says which language, so it is not stored twice. */
export const LANGUAGE_OF: Record<Ecosystem, string> = {
  Maven: 'Java', Npm: 'JavaScript', Generic: 'Native', Deb: 'Native',
  Golang: 'Go', PyPI: 'Python', NuGet: '.NET',
};

/** Business services touched, derived from the spread of CIs rather than invented separately. */
export const businessServices = (c: SoftwareComponent) =>
  Math.max(1, Math.min(9, Math.round(c.cis / 5) + (c.internetFacing ? 1 : 0)));

export const firstSeen = (c: SoftwareComponent) => (c.sources.includes('vendor') ? 'Jun 09, 2026' : 'Jun 12, 2026');
export const lastSeen = () => 'Jun 16, 2026';
