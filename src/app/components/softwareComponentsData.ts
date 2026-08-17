/* Software Components — the fleet rolled up the other way round.
 *
 * Configuration Items answers "what is on this CI". This answers "where does this component live",
 * which is the question you ask once a CVE lands: one row per component VERSION, with the
 * blast radius (how many CIs, how many products) beside it.
 *
 * Rows are reconciled from two sources — what the agent scanned and what arrived in an
 * ingested vendor SBOM — so a component can be attested by both, and `sources` says which. */

export type Ecosystem = 'Maven' | 'Npm' | 'Generic' | 'Deb' | 'Golang' | 'PyPI' | 'NuGet';
export type ComponentSeverity = 'Critical' | 'High' | 'Medium' | 'Low' | 'None';
export type ComponentSource = 'agent' | 'vendor';

export interface SoftwareComponent {
  id: string;
  name: string;
  ecosystem: Ecosystem;
  version: string;
  purl: string;
  /** CIs carrying this exact version, and the products on them that pull it in. A component
   *  reaches a CI through a product, so products is never below cis. */
  cis: number;
  products: number;
  vulnerabilities: number;
  /** The worst severity among this version's vulnerabilities. 'None' when there are none —
   *  a clean component must not borrow a severity colour. */
  topSeverity: ComponentSeverity;
  /** On CISA's Known Exploited Vulnerabilities list: being exploited now, not merely scored. */
  kev: boolean;
  /** Reachable from outside on at least one CI — the same finding is worse here. */
  internetFacing: boolean;
  /** The nearest version that clears every vulnerability on the row; null when there is none. */
  fixVersion: string | null;
  license: string;
  /** Copyleft or dual-licensed — the flag is a "legal should look", not a defect. */
  licenseFlag: boolean;
  sources: ComponentSource[];
}

/* Ordered worst-first, which is the order the table opens on. */
export const SOFTWARE_COMPONENTS: SoftwareComponent[] = [
  {
    id: 'CMP-000412', name: 'log4j-core', ecosystem: 'Maven', version: '2.14.1',
    purl: 'pkg:maven/org.apache.logging.log4j/log4j-core@2.14.1',
    cis: 23, products: 31, vulnerabilities: 3, topSeverity: 'Critical',
    kev: true, internetFacing: true, fixVersion: '2.17.1',
    license: 'Apache-2.0', licenseFlag: false, sources: ['agent', 'vendor'],
  },
  {
    id: 'CMP-000604', name: 'openssl', ecosystem: 'Generic', version: '3.0.1',
    purl: 'pkg:generic/openssl@3.0.1',
    cis: 142, products: 142, vulnerabilities: 3, topSeverity: 'High',
    kev: false, internetFacing: true, fixVersion: '3.0.8',
    license: 'Apache-2.0', licenseFlag: false, sources: ['agent', 'vendor'],
  },
  {
    id: 'CMP-000617', name: 'jackson-databind', ecosystem: 'Maven', version: '2.12.3',
    purl: 'pkg:maven/com.fasterxml.jackson.core/jackson-databind@2.12.3',
    cis: 44, products: 58, vulnerabilities: 3, topSeverity: 'High',
    kev: false, internetFacing: false, fixVersion: '2.12.7.1',
    license: 'Apache-2.0', licenseFlag: false, sources: ['vendor'],
  },
  {
    id: 'CMP-000503', name: 'spring-core', ecosystem: 'Maven', version: '5.3.18',
    purl: 'pkg:maven/org.springframework/spring-core@5.3.18',
    cis: 31, products: 44, vulnerabilities: 2, topSeverity: 'Critical',
    kev: false, internetFacing: true, fixVersion: '5.3.20',
    license: 'Apache-2.0', licenseFlag: false, sources: ['vendor'],
  },
  {
    id: 'CMP-000702', name: 'lodash', ecosystem: 'Npm', version: '4.17.20',
    purl: 'pkg:npm/lodash@4.17.20',
    cis: 67, products: 91, vulnerabilities: 2, topSeverity: 'High',
    kev: false, internetFacing: true, fixVersion: '4.17.21',
    license: 'MIT', licenseFlag: false, sources: ['agent', 'vendor'],
  },
  {
    id: 'CMP-000418', name: 'xz-utils', ecosystem: 'Deb', version: '5.6.0',
    purl: 'pkg:deb/xz-utils@5.6.0',
    cis: 8, products: 8, vulnerabilities: 1, topSeverity: 'Critical',
    kev: true, internetFacing: false, fixVersion: '5.4.6',
    license: 'GPL-2.0-or-later', licenseFlag: true, sources: ['agent', 'vendor'],
  },
  {
    id: 'CMP-000511', name: 'commons-text', ecosystem: 'Maven', version: '1.9',
    purl: 'pkg:maven/org.apache.commons/commons-text@1.9',
    cis: 19, products: 23, vulnerabilities: 1, topSeverity: 'Critical',
    kev: false, internetFacing: false, fixVersion: '1.10.0',
    license: 'Apache-2.0', licenseFlag: false, sources: ['agent', 'vendor'],
  },
  {
    id: 'CMP-000745', name: 'golang.org/x/crypto', ecosystem: 'Golang', version: '0.16.0',
    purl: 'pkg:golang/golang.org/x/crypto@0.16.0',
    cis: 28, products: 34, vulnerabilities: 1, topSeverity: 'Medium',
    kev: false, internetFacing: false, fixVersion: '0.17.0',
    license: 'BSD-3-Clause', licenseFlag: false, sources: ['vendor'],
  },
  {
    id: 'CMP-000810', name: 'node-forge', ecosystem: 'Npm', version: '1.2.1',
    purl: 'pkg:npm/node-forge@1.2.1',
    cis: 12, products: 12, vulnerabilities: 1, topSeverity: 'High',
    kev: false, internetFacing: true, fixVersion: '1.3.0',
    license: 'GPL-2.0 / BSD-3', licenseFlag: true, sources: ['agent'],
  },
  {
    id: 'CMP-000826', name: 'zlib', ecosystem: 'Generic', version: '1.2.11',
    purl: 'pkg:generic/zlib@1.2.11',
    cis: 156, products: 168, vulnerabilities: 1, topSeverity: 'High',
    kev: false, internetFacing: false, fixVersion: '1.2.12',
    license: 'Zlib', licenseFlag: false, sources: ['agent', 'vendor'],
  },
  /* Two clean rows: a component with nothing against it must render every column's empty
     state honestly — no severity pill, no fix arrow — rather than only ever being seen
     in its alarming form. */
  {
    id: 'CMP-000933', name: 'requests', ecosystem: 'PyPI', version: '2.31.0',
    purl: 'pkg:pypi/requests@2.31.0',
    cis: 54, products: 61, vulnerabilities: 0, topSeverity: 'None',
    kev: false, internetFacing: false, fixVersion: null,
    license: 'Apache-2.0', licenseFlag: false, sources: ['agent'],
  },
  {
    id: 'CMP-000957', name: 'Newtonsoft.Json', ecosystem: 'NuGet', version: '13.0.3',
    purl: 'pkg:nuget/Newtonsoft.Json@13.0.3',
    cis: 37, products: 45, vulnerabilities: 0, topSeverity: 'None',
    kev: false, internetFacing: false, fixVersion: null,
    license: 'MIT', licenseFlag: false, sources: ['vendor'],
  },
];

/** Scope tabs. "Vulnerable" and "Known exploited" are the two questions this listing exists
 *  to answer quickly, so they are scopes rather than something to rebuild with a search. */
export const isVulnerable = (c: SoftwareComponent) => c.vulnerabilities > 0;
export const isKev = (c: SoftwareComponent) => c.kev;
