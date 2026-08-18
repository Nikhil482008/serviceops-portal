/* BOM module data — the Bill of Materials generated per endpoint (CI).
 *
 * A BOM is scoped to a PRODUCT on a host: every host has an implicit "OS / base platform"
 * scope (everything no other product claims) plus zero or more application products with
 * their own scan paths. Each (endpoint × product) carries three BOM types:
 *   SBOM   — software components (libraries, frameworks, applications)
 *   CBOM   — cryptographic assets (algorithms, keys, certificates)
 *   AI BOM — AI/ML models in use
 *
 * Everything here is mock but deterministic: the same endpoint id always produces the same
 * BOM, so the listing counts and the detail page never disagree.
 */

import { mockEndpoints } from './endpointsData';
import { RETENTION_DEFAULT } from './bomAdminData';

export type BomType = 'SBOM' | 'CBOM' | 'AI BOM';

/* The BOM screens address a host by its CI id: Component Intelligence is a CMDB-level view, and
 * the Configuration Items listing already calls these rows "Agent CIs". The Patch/Endpoint modules
 * keep their own EP-### ids for the same machines — this is a display mapping for BOM screens
 * only, so the two never have to be renumbered against each other. */
/** Deterministic stream, so a host's graph is the same shape on every render. */
const seeded = (key: string) => {
  let h = 2166136261;
  for (const ch of key) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 100000) / 100000; };
};

export const bomCiId = (endpointId: string): string => endpointId.replace(/^EP-/, 'CI-');
export type BomStatus = 'Generated' | 'In Progress' | 'Not Generated';

/** Stable string hash — keeps generated data identical across renders. */
const hash = (s: string): number => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
};

// ---------------------------------------------------------------------------
// Component catalogs — realistic enterprise inventory, sliced deterministically.
// ---------------------------------------------------------------------------

export interface BomComponent {
  name: string;
  version: string;
  type: 'Application' | 'Framework' | 'Library' | 'Operating-System';
  ecosystem: string;
  purl: string;
  license: string;
  origin: 'Open-source' | 'Proprietary' | 'Third-party';
  /** Known vulnerable — drives the Findings count and the "Security only" filter. */
  cves?: string[];
}

const SBOM_CATALOG: BomComponent[] = [
  { name: 'openssl', version: '3.0.1', type: 'Library', ecosystem: 'Generic', purl: 'pkg:generic/openssl@3.0.1', license: 'Apache-2.0', origin: 'Open-source', cves: ['CVE-2026-21412'] },
  { name: 'zlib', version: '1.2.11', type: 'Library', ecosystem: 'Generic', purl: 'pkg:generic/zlib@1.2.11', license: 'Zlib', origin: 'Open-source' },
  { name: 'log4j-core', version: '2.14.1', type: 'Library', ecosystem: 'Maven', purl: 'pkg:maven/org.apache.logging.log4j/log4j-core@2.14.1', license: 'Apache-2.0', origin: 'Open-source', cves: ['CVE-2021-44228', 'CVE-2021-45046'] },
  { name: 'spring-core', version: '5.3.18', type: 'Framework', ecosystem: 'Maven', purl: 'pkg:maven/org.springframework/spring-core@5.3.18', license: 'Apache-2.0', origin: 'Open-source' },
  { name: 'jackson-databind', version: '2.12.3', type: 'Library', ecosystem: 'Maven', purl: 'pkg:maven/com.fasterxml.jackson.core/jackson-databind@2.12.3', license: 'Apache-2.0', origin: 'Open-source', cves: ['CVE-2026-26234'] },
  { name: 'commons-text', version: '1.9', type: 'Library', ecosystem: 'Maven', purl: 'pkg:maven/org.apache.commons/commons-text@1.9', license: 'Apache-2.0', origin: 'Open-source', cves: ['CVE-2022-42889'] },
  { name: 'commons-collections', version: '3.2.1', type: 'Library', ecosystem: 'Maven', purl: 'pkg:maven/commons-collections/commons-collections@3.2.1', license: 'Apache-2.0', origin: 'Open-source', cves: ['CVE-2015-6420'] },
  { name: 'lodash', version: '4.17.20', type: 'Library', ecosystem: 'Npm', purl: 'pkg:npm/lodash@4.17.20', license: 'MIT', origin: 'Open-source', cves: ['CVE-2021-23337'] },
  { name: 'node-forge', version: '1.2.1', type: 'Library', ecosystem: 'Npm', purl: 'pkg:npm/node-forge@1.2.1', license: 'BSD-3-Clause', origin: 'Open-source' },
  { name: 'axios', version: '1.6.2', type: 'Library', ecosystem: 'Npm', purl: 'pkg:npm/axios@1.6.2', license: 'MIT', origin: 'Open-source' },
  { name: 'react', version: '18.3.1', type: 'Framework', ecosystem: 'Npm', purl: 'pkg:npm/react@18.3.1', license: 'MIT', origin: 'Open-source' },
  { name: 'pycryptodome', version: '3.9.8', type: 'Library', ecosystem: 'Pypi', purl: 'pkg:pypi/pycryptodome@3.9.8', license: 'BSD-2-Clause', origin: 'Open-source' },
  { name: 'requests', version: '2.31.0', type: 'Library', ecosystem: 'Pypi', purl: 'pkg:pypi/requests@2.31.0', license: 'Apache-2.0', origin: 'Open-source' },
  { name: 'urllib3', version: '1.26.5', type: 'Library', ecosystem: 'Pypi', purl: 'pkg:pypi/urllib3@1.26.5', license: 'MIT', origin: 'Open-source', cves: ['CVE-2026-30303'] },
  { name: 'golang.org/x/crypto', version: '0.16.0', type: 'Library', ecosystem: 'Golang', purl: 'pkg:golang/golang.org/x/crypto@0.16.0', license: 'BSD-3-Clause', origin: 'Open-source' },
  { name: 'golang.org/x/net', version: '0.17.0', type: 'Library', ecosystem: 'Golang', purl: 'pkg:golang/golang.org/x/net@0.17.0', license: 'BSD-3-Clause', origin: 'Open-source' },
  { name: 'Microsoft .NET Runtime', version: '6.0.21', type: 'Framework', ecosystem: 'Nuget', purl: 'pkg:nuget/Microsoft.NETCore.App.Runtime@6.0.21', license: 'MIT', origin: 'Open-source' },
  { name: 'Newtonsoft.Json', version: '13.0.3', type: 'Library', ecosystem: 'Nuget', purl: 'pkg:nuget/Newtonsoft.Json@13.0.3', license: 'MIT', origin: 'Open-source' },
  { name: 'Serilog', version: '3.1.1', type: 'Library', ecosystem: 'Nuget', purl: 'pkg:nuget/Serilog@3.1.1', license: 'Apache-2.0', origin: 'Open-source' },
  { name: 'System.Text.Json', version: '8.0.4', type: 'Library', ecosystem: 'Nuget', purl: 'pkg:nuget/System.Text.Json@8.0.4', license: 'MIT', origin: 'Open-source' },
  { name: 'apache-poi', version: '5.2.3', type: 'Library', ecosystem: 'Maven', purl: 'pkg:maven/org.apache.poi/poi@5.2.3', license: 'Apache-2.0', origin: 'Open-source' },
  { name: 'hibernate-core', version: '6.4.1', type: 'Framework', ecosystem: 'Maven', purl: 'pkg:maven/org.hibernate/hibernate-core@6.4.1', license: 'LGPL-2.1', origin: 'Open-source' },
  { name: 'in.hdfc.auth-sdk', version: '1.4.2', type: 'Library', ecosystem: 'Internal', purl: 'pkg:internal/in.hdfc/auth-sdk@1.4.2', license: 'Unknown', origin: 'Proprietary' },
  { name: 'com.motadata.agent-core', version: '8.7.408', type: 'Library', ecosystem: 'Internal', purl: 'pkg:internal/com.motadata/agent-core@8.7.408', license: 'Proprietary', origin: 'Proprietary' },
  { name: 'com.motadata.telemetry', version: '3.2.19', type: 'Library', ecosystem: 'Internal', purl: 'pkg:internal/com.motadata/telemetry@3.2.19', license: 'Proprietary', origin: 'Proprietary' },
  { name: 'Avecto DefendPoint', version: '5.7.142', type: 'Application', ecosystem: 'Generic', purl: 'pkg:generic/avecto-defendpoint@5.7.142', license: 'Commercial', origin: 'Third-party' },
  { name: 'CrowdStrike Falcon Sensor', version: '7.14.18110', type: 'Application', ecosystem: 'Generic', purl: 'pkg:generic/crowdstrike-falcon@7.14.18110', license: 'Commercial', origin: 'Third-party' },
  { name: 'Google Chrome', version: '138.0.7204.97', type: 'Application', ecosystem: 'Generic', purl: 'pkg:generic/google-chrome@138.0.7204.97', license: 'Freeware', origin: 'Third-party' },
  { name: 'Mozilla Firefox', version: '141.0.2', type: 'Application', ecosystem: 'Generic', purl: 'pkg:generic/mozilla-firefox@141.0.2', license: 'MPL-2.0', origin: 'Open-source' },
  { name: '7-Zip', version: '24.09', type: 'Application', ecosystem: 'Generic', purl: 'pkg:generic/7zip@24.09', license: 'LGPL-2.1', origin: 'Open-source' },
  { name: 'Adobe Acrobat Reader DC', version: '25.001.20472', type: 'Application', ecosystem: 'Generic', purl: 'pkg:generic/acrobat-reader-dc@25.001.20472', license: 'Commercial', origin: 'Third-party' },
  { name: 'Microsoft Office Professional Plus', version: '2019', type: 'Application', ecosystem: 'Generic', purl: 'pkg:generic/microsoft-office@2019', license: 'Commercial', origin: 'Proprietary' },
  { name: 'nginx', version: '1.24.0', type: 'Application', ecosystem: 'Generic', purl: 'pkg:generic/nginx@1.24.0', license: 'BSD-2-Clause', origin: 'Open-source' },
  { name: 'PostgreSQL', version: '15.6', type: 'Application', ecosystem: 'Generic', purl: 'pkg:generic/postgresql@15.6', license: 'PostgreSQL', origin: 'Open-source' },
  { name: 'Redis', version: '7.2.4', type: 'Application', ecosystem: 'Generic', purl: 'pkg:generic/redis@7.2.4', license: 'BSD-3-Clause', origin: 'Open-source' },
  { name: 'Apache Tomcat', version: '9.0.85', type: 'Application', ecosystem: 'Generic', purl: 'pkg:generic/apache-tomcat@9.0.85', license: 'Apache-2.0', origin: 'Open-source' },
  { name: 'OpenJDK Runtime', version: '17.0.10', type: 'Framework', ecosystem: 'Generic', purl: 'pkg:generic/openjdk@17.0.10', license: 'GPL-2.0-with-classpath-exception', origin: 'Open-source' },
  { name: 'Python', version: '3.11.8', type: 'Framework', ecosystem: 'Generic', purl: 'pkg:generic/python@3.11.8', license: 'PSF-2.0', origin: 'Open-source' },
  { name: 'Node.js', version: '20.11.1', type: 'Framework', ecosystem: 'Generic', purl: 'pkg:generic/nodejs@20.11.1', license: 'MIT', origin: 'Open-source' },
  { name: 'libcurl', version: '8.4.0', type: 'Library', ecosystem: 'Generic', purl: 'pkg:generic/libcurl@8.4.0', license: 'curl', origin: 'Open-source', cves: ['CVE-2026-21409'] },
];

export interface CryptoAsset {
  /** What stops working if this expires, in words a reader outside the team can act on. A
   *  certificate subject is an engineer's identifier; "Remote access (VPN)" is the outage. */
  serves?: string;
  name: string;
  primitive: 'Cipher' | 'Hash' | 'Signature' | 'Key-agreement' | 'Certificate' | 'MAC';
  algorithm: string;
  keyLength: string;
  protocol: string;
  location: string;
  /** Post-quantum / policy posture — the reason a CBOM exists. */
  compliance: 'Compliant' | 'Deprecated' | 'Quantum-vulnerable';
  expiry: string | null;
}

const CBOM_CATALOG: CryptoAsset[] = [
  /* Certificates carry their SUBJECT as the name — "TLS server certificate" is a category, and
     an operator rotating one needs to know which. Expiries are fixed dates so the countdown on
     the dashboard is the same on every run (see DASH_TODAY in bomDashboardData.ts). */
  { name: '*.paymentsweb.internal', serves: 'Customer payments website', primitive: 'Certificate', algorithm: 'RSA', keyLength: '3072 bit', protocol: 'TLS 1.2', location: 'LocalMachine\\My', compliance: 'Quantum-vulnerable', expiry: 'Mar 14, 2027' },
  { name: 'db-replication-cert', serves: 'Database replication', primitive: 'Certificate', algorithm: 'RSA', keyLength: '2048 bit', protocol: 'SHA256withRSA', location: 'LocalMachine\\My', compliance: 'Quantum-vulnerable', expiry: 'Aug 30, 2026' },
  { name: 'partner-mtls-client', serves: 'Partner integrations', primitive: 'Certificate', algorithm: 'ECDSA', keyLength: '256 bit', protocol: 'SHA256withECDSA', location: 'CurrentUser\\My', compliance: 'Quantum-vulnerable', expiry: 'Dec 01, 2026' },
  { name: 'k8s-ingress-wildcard', serves: 'Customer-facing web traffic', primitive: 'Certificate', algorithm: 'ECDSA', keyLength: '384 bit', protocol: 'SHA256withECDSA', location: 'k8s secret/ingress-tls', compliance: 'Quantum-vulnerable', expiry: 'Feb 14, 2027' },
  { name: 'kafka-broker-tls', serves: 'Event streaming between services', primitive: 'Certificate', algorithm: 'RSA', keyLength: '2048 bit', protocol: 'SHA256withRSA', location: '/etc/kafka/ssl', compliance: 'Quantum-vulnerable', expiry: 'Apr 18, 2027' },
  { name: 'Session key exchange', primitive: 'Key-agreement', algorithm: 'ECDH P-256', keyLength: '256 bit', protocol: 'TLS 1.3', location: 'schannel', compliance: 'Quantum-vulnerable', expiry: null },
  { name: 'Payload encryption', primitive: 'Cipher', algorithm: 'AES-GCM', keyLength: '256 bit', protocol: 'TLS 1.3', location: 'bcrypt.dll', compliance: 'Compliant', expiry: null },
  { name: 'Legacy payload cipher', primitive: 'Cipher', algorithm: '3DES-CBC', keyLength: '168 bit', protocol: 'TLS 1.0', location: 'schannel', compliance: 'Deprecated', expiry: null },
  { name: 'Integrity digest', primitive: 'Hash', algorithm: 'SHA-256', keyLength: '256 bit', protocol: 'internal', location: 'bcrypt.dll', compliance: 'Compliant', expiry: null },
  { name: 'Legacy digest', primitive: 'Hash', algorithm: 'SHA-1', keyLength: '160 bit', protocol: 'internal', location: 'advapi32.dll', compliance: 'Deprecated', expiry: null },
  { name: 'code-signing-2026', serves: 'Signed software updates', primitive: 'Certificate', algorithm: 'RSA', keyLength: '4096 bit', protocol: 'Authenticode', location: 'LocalMachine\\TrustedPublisher', compliance: 'Quantum-vulnerable', expiry: 'Sep 02, 2026' },
  { name: 'Token signature', primitive: 'Signature', algorithm: 'ECDSA P-384', keyLength: '384 bit', protocol: 'JWT ES384', location: '/opt/payments/keys', compliance: 'Quantum-vulnerable', expiry: null },
  { name: 'Message authentication', primitive: 'MAC', algorithm: 'HMAC-SHA256', keyLength: '256 bit', protocol: 'internal', location: 'bcrypt.dll', compliance: 'Compliant', expiry: null },
  { name: 'Disk volume encryption', primitive: 'Cipher', algorithm: 'AES-XTS', keyLength: '128 bit', protocol: 'BitLocker', location: 'fvevol.sys', compliance: 'Compliant', expiry: null },
  { name: 'connector-mtls-client', serves: 'Third-party connectors', primitive: 'Certificate', algorithm: 'EC P-256', keyLength: '256 bit', protocol: 'mTLS', location: 'CurrentUser\\My', compliance: 'Quantum-vulnerable', expiry: 'Dec 03, 2026' },
  { name: 'Password derivation', primitive: 'Hash', algorithm: 'PBKDF2-HMAC-SHA256', keyLength: '256 bit', protocol: 'internal', location: '/opt/reporting/lib', compliance: 'Compliant', expiry: null },

  /* Certificates spread across the rotation windows the dashboard's timeline draws. Fixed dates,
     read against DASH_TODAY (17 Aug 2026): a countdown against a real clock would make the page
     report something different every morning and its checks unrepeatable. */
  { name: 'vpn-gateway-tls', serves: 'Remote access (VPN)', primitive: 'Certificate', algorithm: 'RSA', keyLength: '2048 bit', protocol: 'TLS 1.2', location: 'LocalMachine\My', compliance: 'Quantum-vulnerable', expiry: 'Aug 19, 2026' },
  { name: 'sso-saml-signing', serves: 'Staff sign-in (single sign-on)', primitive: 'Certificate', algorithm: 'RSA', keyLength: '2048 bit', protocol: 'SAML', location: 'LocalMachine\My', compliance: 'Quantum-vulnerable', expiry: 'Aug 22, 2026' },
  { name: 'internal-ca-issuing', serves: 'Issuing new internal certificates', primitive: 'Certificate', algorithm: 'RSA', keyLength: '4096 bit', protocol: 'PKI', location: 'LocalMachine\CA', compliance: 'Quantum-vulnerable', expiry: 'Sep 10, 2026' },
  { name: 'payments-api-tls', serves: 'Payments API', primitive: 'Certificate', algorithm: 'ECDSA', keyLength: '256 bit', protocol: 'TLS 1.3', location: '/etc/ssl/payments', compliance: 'Quantum-vulnerable', expiry: 'Oct 05, 2026' },
  { name: 'branch-vpn-client', serves: 'Branch-office connectivity', primitive: 'Certificate', algorithm: 'RSA', keyLength: '2048 bit', protocol: 'IPsec', location: 'CurrentUser\My', compliance: 'Quantum-vulnerable', expiry: 'Nov 12, 2026' },
  { name: 'ldap-directory-tls', serves: 'Directory lookups', primitive: 'Certificate', algorithm: 'RSA', keyLength: '3072 bit', protocol: 'LDAPS', location: 'LocalMachine\My', compliance: 'Quantum-vulnerable', expiry: 'Dec 28, 2026' },
  { name: 'mq-broker-tls', serves: 'Message queues', primitive: 'Certificate', algorithm: 'ECDSA', keyLength: '384 bit', protocol: 'AMQPS', location: '/etc/mq/ssl', compliance: 'Quantum-vulnerable', expiry: 'Jan 30, 2027' },
  { name: 'device-enrolment-ca', serves: 'Enrolling new devices', primitive: 'Certificate', algorithm: 'ECDSA', keyLength: '384 bit', protocol: 'SCEP', location: 'LocalMachine\CA', compliance: 'Quantum-vulnerable', expiry: 'Jun 20, 2027' },
];

export interface AiModel {
  name: string;
  provider: string;
  version: string;
  task: string;
  license: string;
  parameters: string;
  source: 'Hosted API' | 'Local weights' | 'Embedded';
  usage: string;
  /** End-of-life date. A model past it receives no security fixes — that is the whole reason an
   *  AI BOM tracks lifecycle. `undefined` means the supplier publishes no EOL for it. */
  eol?: string;
  /** Whether the model ships a model card (provenance, training data, intended use). Absent on
   *  in-house models more often than on hosted ones, which is itself the finding. */
  modelCard?: boolean;
  /** Why this one carries extra risk beyond its age — e.g. a pickled artefact executes on load. */
  risk?: string;

  /* ── the wider AI BOM ────────────────────────────────────────────────
   * An AI Bill of Materials is not only the models. It is the frameworks that load them, the
   * runtime they execute on, and the data they were trained on — each with its own licence,
   * provenance and end-of-life. These fields describe that wider set; entries without a `kind`
   * are models, which is what `bomAiModels` and the dashboard still mean by the word. */
  kind?: 'hosted-llm' | 'local-model-file' | 'embedding-model' | 'framework' | 'vector-db'
    | 'prompt' | 'dataset' | 'infra' | 'rag-pipeline';
  /** The line under the name — what this asset IS, in the register's own words. */
  subtitle?: string;
  /** Whether the artefact's origin can be attested. Internal = ours, so there is nobody to verify
   *  it against; Unverified = came from somewhere with nothing to check it by. */
  provenance?: 'Verified' | 'Unverified' | 'Internal';
  /** How much the licence constrains what may be built on it. Unknown licences are HIGH: an
   *  unanswered licence question is a worse position than a restrictive but known one. */
  licenseRisk?: 'LOW' | 'MEDIUM' | 'HIGH';
}

const AIBOM_CATALOG: AiModel[] = [
  { name: 'claude-sonnet-4-5', provider: 'Anthropic', version: '2025-09-29', task: 'Text generation', license: 'Commercial API', parameters: 'Undisclosed', source: 'Hosted API', usage: 'Ticket summarisation' },
  { name: 'text-embedding-3-large', provider: 'OpenAI', version: '3.0', task: 'Embeddings', license: 'Commercial API', parameters: 'Undisclosed', source: 'Hosted API', usage: 'Knowledge search index' },
  { name: 'all-MiniLM-L6-v2', provider: 'Sentence-Transformers', version: '2.2.2', task: 'Embeddings', license: 'Apache-2.0', parameters: '22.7 M', source: 'Local weights', usage: 'Duplicate-request detection' },
  { name: 'distilbert-base-uncased', provider: 'Hugging Face', version: '1.0', task: 'Classification', license: 'Apache-2.0', parameters: '66 M', source: 'Local weights', usage: 'Request category prediction' },
  { name: 'xgboost-anomaly', provider: 'Motadata', version: '4.1.2', task: 'Anomaly detection', license: 'Proprietary', parameters: '1.8 M', source: 'Embedded', usage: 'Endpoint behaviour scoring' },
  { name: 'whisper-small', provider: 'OpenAI', version: '1.0', task: 'Speech-to-text', license: 'MIT', parameters: '244 M', source: 'Local weights', usage: 'Call-log transcription' },
  { name: 'prophet-forecast', provider: 'Meta', version: '1.1.5', task: 'Forecasting', license: 'MIT', parameters: 'N/A', source: 'Embedded', usage: 'SLA breach prediction' },
  { name: 'yolov8n', provider: 'Ultralytics', version: '8.1.0', task: 'Object detection', license: 'AGPL-3.0', parameters: '3.2 M', source: 'Local weights', usage: 'Asset label recognition' },
  /* Models carrying a published lifecycle. Dates are fixed rather than relative so the dashboard
     reports the same thing on every run — see DASH_TODAY in bomDashboardData.ts. */
  { name: 'legacy-credit-scorer', provider: 'In-house ML platform', version: '0.9.4', task: 'Credit scoring', license: 'Proprietary', parameters: '4.1 M', source: 'Local weights', usage: 'Loan pre-approval', eol: 'Mar 31, 2026', modelCard: false },
  { name: 'logreg-baseline (retired)', provider: 'In-house ML platform', version: '0.2.0', task: 'Classification', license: 'Proprietary', parameters: '0.1 M', source: 'Local weights', usage: 'Baseline comparison', eol: 'Dec 31, 2025', modelCard: false },
  { name: 'legacy-scorer.pkl', provider: 'In-house (legacy)', version: '0.1.0', task: 'Credit scoring', license: 'Proprietary', parameters: 'Unknown', source: 'Local weights', usage: 'Nightly batch scoring', eol: 'Jun 30, 2025', modelCard: false, risk: 'pickle-import risk' },
  { name: 'gpt-4o (loan-assist API)', provider: 'OpenAI', version: '2024-08-06', task: 'Text generation', license: 'Commercial API', parameters: 'Undisclosed', source: 'Hosted API', usage: 'Loan assistant', eol: 'Nov 12, 2026', modelCard: false },
  { name: 'report-summariser', provider: 'OpenAI', version: '1.2', task: 'Summarisation', license: 'Commercial API', parameters: 'Undisclosed', source: 'Hosted API', usage: 'Report summaries', eol: 'Feb 13, 2027', modelCard: true },

  /* The stack around the models. A model that is fine on its own still runs on a framework with
     its own licence and its own end-of-life, and was trained on data with its own provenance —
     which is the whole argument for an AI BOM being wider than a model list. */
  { name: 'langchain', provider: 'OSS', version: '0.1.16', task: 'Orchestration', license: 'MIT', parameters: 'N/A', source: 'Embedded', usage: 'Agent orchestration', kind: 'framework', subtitle: 'ML framework', provenance: 'Verified', licenseRisk: 'LOW', eol: 'Jun 25, 2026' },
  { name: 'transformers', provider: 'OSS', version: '4.38.2', task: 'Model runtime', license: 'Apache-2.0', parameters: 'N/A', source: 'Embedded', usage: 'Local model loading', kind: 'framework', subtitle: 'ML framework', provenance: 'Verified', licenseRisk: 'LOW' },
  { name: 'scikit-learn', provider: 'OSS', version: '1.4.0', task: 'Classical ML', license: 'BSD-3-Clause', parameters: 'N/A', source: 'Embedded', usage: 'Feature pipelines', kind: 'framework', subtitle: 'ML framework', provenance: 'Verified', licenseRisk: 'LOW', eol: 'Jul 10, 2026' },
  { name: 'onnxruntime', provider: 'OSS', version: '1.17.0', task: 'Inference runtime', license: 'MIT', parameters: 'N/A', source: 'Embedded', usage: 'Model inference', kind: 'infra', subtitle: 'Inference runtime', provenance: 'Verified', licenseRisk: 'LOW', eol: 'Jan 25, 2026' },
  { name: 'torch', provider: 'OSS', version: '2.2.1', task: 'Model runtime', license: 'BSD-3-Clause', parameters: 'N/A', source: 'Embedded', usage: 'Tensor runtime', kind: 'infra', subtitle: 'Inference runtime', provenance: 'Verified', licenseRisk: 'LOW' },
  { name: 'interest-rate-predictor', provider: 'In-house ML platform', version: '0.8.0', task: 'Forecasting', license: 'Proprietary', parameters: '0.6 M', source: 'Local weights', usage: 'Rate forecasting', kind: 'local-model-file', subtitle: 'Model · no model card', provenance: 'Unverified', licenseRisk: 'LOW', modelCard: false },
  { name: 'aml-alerts-history', provider: 'In-house', version: '2023-2025', task: 'Training data', license: 'Proprietary · PII', parameters: 'N/A', source: 'Embedded', usage: 'Fraud model training', kind: 'dataset', subtitle: 'Training data', provenance: 'Internal', licenseRisk: 'HIGH' },
  { name: 'kyc-documents-sample', provider: 'In-house', version: '2024-Q4', task: 'Training data', license: 'Proprietary · PII', parameters: 'N/A', source: 'Embedded', usage: 'KYC model evaluation', kind: 'dataset', subtitle: 'Training data · PII', provenance: 'Internal', licenseRisk: 'HIGH' },
  { name: 'ticket-corpus-2025', provider: 'In-house', version: '2025', task: 'Training data', license: 'Unknown', parameters: 'N/A', source: 'Embedded', usage: 'Summariser fine-tuning', kind: 'dataset', subtitle: 'Training data', provenance: 'Unverified', licenseRisk: 'HIGH' },

  { name: 'pgvector', provider: 'OSS', version: '0.7.0', task: 'Vector store', license: 'PostgreSQL', parameters: 'N/A', source: 'Embedded', usage: 'Knowledge embeddings', kind: 'vector-db', subtitle: 'Vector store · embeddings at rest', provenance: 'Verified', licenseRisk: 'LOW' },
  { name: 'qdrant', provider: 'Qdrant', version: '1.9.0', task: 'Vector store', license: 'Apache-2.0', parameters: 'N/A', source: 'Embedded', usage: 'Similarity search', kind: 'vector-db', subtitle: 'Vector store · embeddings at rest', provenance: 'Verified', licenseRisk: 'LOW', eol: 'Apr 30, 2026' },
  { name: 'ticket-summary-prompt', provider: 'In-house', version: 'v3', task: 'Prompt template', license: 'Proprietary', parameters: 'N/A', source: 'Embedded', usage: 'Ticket summarisation', kind: 'prompt', subtitle: 'Prompt template · sends ticket text', provenance: 'Internal', licenseRisk: 'LOW' },
  { name: 'kyc-extraction-prompt', provider: 'In-house', version: 'v1', task: 'Prompt template', license: 'Proprietary · PII', parameters: 'N/A', source: 'Embedded', usage: 'Document field extraction', kind: 'prompt', subtitle: 'Prompt template · sends PII', provenance: 'Unverified', licenseRisk: 'HIGH' },
  { name: 'kb-search-rag', provider: 'In-house', version: '2.1', task: 'Retrieval pipeline', license: 'Proprietary', parameters: 'N/A', source: 'Embedded', usage: 'Knowledge-base answers', kind: 'rag-pipeline', subtitle: 'RAG pipeline · retrieval + generation', provenance: 'Internal', licenseRisk: 'LOW' },
  { name: 'loan-docs-rag', provider: 'In-house ML platform', version: '0.4', task: 'Retrieval pipeline', license: 'Proprietary', parameters: 'N/A', source: 'Embedded', usage: 'Loan document Q&A', kind: 'rag-pipeline', subtitle: 'RAG pipeline · no evaluation record', provenance: 'Unverified', licenseRisk: 'LOW' },
  { name: 'bge-small-en', provider: 'BAAI', version: '1.5', task: 'Embeddings', license: 'MIT', parameters: '33 M', source: 'Local weights', usage: 'Ticket similarity', kind: 'embedding-model', subtitle: 'Embedding model', provenance: 'Verified', licenseRisk: 'LOW' },
];

// ---------------------------------------------------------------------------
// Products — the scan scopes on a host.
// ---------------------------------------------------------------------------

export interface BomProduct {
  key: string;
  name: string;
  /** null for the implicit OS scope — it has no product version of its own. */
  version: string | null;
  path: string;
  source: string;
  status: 'Scanned' | 'Pending' | 'Failed';
  lastScan: string;
  findings: number;
  /** Paths skipped under THIS product's root — exclusions are per-product, not host-wide. */
  excludePaths: string[];
  /** The scope whose versions the BOM tab lands on. Exactly one product per host. */
  isDefault?: boolean;
  /** Declared by a person in Manage products, rather than found by the agent. The distinction is
   *  about who created the scope, not where its data comes from — a manually declared path is
   *  still scanned by the agent on its next check-in. */
  addedManually?: boolean;
}

export const OS_PRODUCT_KEY = 'os-base';

const APP_PRODUCTS: { key: string; name: string; version: string; path: string }[] = [
  { key: 'payments-web', name: 'Payments Web', version: '2.4.1', path: '/opt/payments' },
  { key: 'reporting-service', name: 'Reporting Service', version: '3.1.0', path: '/opt/reporting' },
  { key: 'claims-portal', name: 'Claims Portal', version: '5.2.0', path: 'C:\\inetpub\\claims' },
  { key: 'ledger-api', name: 'Ledger API', version: '1.8.3', path: '/srv/ledger' },
  { key: 'identity-broker', name: 'Identity Broker', version: '2.0.7', path: '/opt/identity' },
];

/* ── the many-products host ───────────────────────────────────────────────
 * A products PICKER is easy at three scopes and unusable at forty, so one host in the fleet is
 * an application server carrying 41 — the case the overview exists to handle. Everything about
 * it is behind this one constant: delete `MANY_PRODUCT_HOST` and the fleet is exactly as it was.
 *
 * Their component counts are deliberately SMALL (`smallScope`): forty scopes on one host means
 * forty narrow application roots, not forty platforms. Sizing them like the ordinary scopes would
 * have added ~6,000 components to a fleet of ~6,900 and roughly doubled every dashboard total for
 * a demo about a dropdown. */
export const MANY_PRODUCT_HOST = 'EP-408';

const MANY_PRODUCT_NAMES: { name: string; version: string; root: string }[] = [
  { name: 'Payments Web', version: '2.4.1', root: '/opt/payments' },
  { name: 'Claims Portal', version: '5.2.0', root: 'C:\\inetpub\\claims' },
  { name: 'Ledger API', version: '1.8.3', root: '/srv/ledger' },
  { name: 'Identity Broker', version: '2.0.7', root: '/opt/identity' },
  { name: 'Reporting Service', version: '3.1.0', root: '/opt/reporting' },
  { name: 'Settlement Engine', version: '4.6.2', root: '/srv/settlement' },
  { name: 'Card Tokeniser', version: '1.2.9', root: '/opt/tokeniser' },
  { name: 'Fraud Scoring', version: '2.9.4', root: '/opt/fraud' },
  { name: 'KYC Verifier', version: '3.3.1', root: '/srv/kyc' },
  { name: 'Statement Renderer', version: '1.7.0', root: '/opt/statements' },
  { name: 'Notification Hub', version: '5.0.3', root: '/srv/notify' },
  { name: 'Batch Scheduler', version: '2.2.8', root: '/opt/batch' },
  { name: 'Recon Service', version: '1.4.6', root: '/srv/recon' },
  { name: 'Mandate Manager', version: '3.0.1', root: '/opt/mandates' },
  { name: 'Dispute Workflow', version: '2.5.5', root: 'C:\\inetpub\\disputes' },
  { name: 'Merchant Onboarding', version: '4.1.2', root: '/opt/onboarding' },
  { name: 'Payout Router', version: '1.9.7', root: '/srv/payouts' },
  { name: 'FX Rate Service', version: '2.3.4', root: '/opt/fx' },
  { name: 'Limit Engine', version: '1.1.3', root: '/srv/limits' },
  { name: 'Audit Collector', version: '3.8.0', root: '/opt/audit' },
  { name: 'Document Vault', version: '2.7.2', root: '/srv/vault' },
  { name: 'Customer Portal', version: '6.0.4', root: 'C:\\inetpub\\portal' },
  { name: 'Agent Console', version: '4.4.9', root: 'C:\\inetpub\\console' },
  { name: 'Rules Authoring', version: '1.6.1', root: '/opt/rules' },
  { name: 'Ledger Archiver', version: '2.0.0', root: '/srv/archive' },
  { name: 'Sanctions Screening', version: '5.5.3', root: '/opt/sanctions' },
  { name: 'Chargeback Handler', version: '1.3.8', root: '/srv/chargeback' },
  { name: 'Interest Calculator', version: '2.8.1', root: '/opt/interest' },
  { name: 'Statement Mailer', version: '1.0.6', root: '/srv/mailer' },
  { name: 'Data Masking Proxy', version: '3.2.2', root: '/opt/masking' },
  { name: 'Session Broker', version: '2.1.5', root: '/srv/session' },
  { name: 'Config Distributor', version: '1.5.4', root: '/opt/configd' },
  { name: 'Health Prober', version: '4.0.9', root: '/srv/health' },
  { name: 'Metrics Shipper', version: '2.6.7', root: '/opt/metrics' },
  { name: 'Log Forwarder', version: '3.4.0', root: '/srv/logfwd' },
  { name: 'Backup Agent', version: '5.1.8', root: '/opt/backup' },
  { name: 'Certificate Rotator', version: '1.8.2', root: '/srv/certrot' },
  { name: 'Secrets Sidecar', version: '2.4.3', root: '/opt/secrets' },
  { name: 'Queue Bridge', version: '3.7.6', root: '/srv/queue' },
  { name: 'Legacy COBOL Gateway', version: '1.0.1', root: 'C:\\legacy\\gateway' },
];

/** Hand-declared scopes on the demo host — see MANY_PRODUCT_HOST. Two existing products are
 *  marked rather than new ones added, so no count anywhere else moves. */
const MANUALLY_ADDED = ['Legacy COBOL Gateway', 'Data Masking Proxy'];

const manyProducts = (endpointId: string): { key: string; name: string; version: string; path: string }[] =>
  MANY_PRODUCT_NAMES.map((p) => ({
    key: p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    name: p.name, version: p.version, path: p.root,
  }));

/** True for a scope on the many-products host — see `MANY_PRODUCT_HOST` for why it is sized down. */
export const smallScope = (endpointId: string, productKey: string): boolean =>
  endpointId === MANY_PRODUCT_HOST && productKey !== OS_PRODUCT_KEY;

// Dates used across the module — kept as a fixed spread so the demo never drifts.
const SCAN_DATES = ['Jun 16, 2026', 'Jun 15, 2026', 'Jun 14, 2026', 'Jun 12, 2026', 'Jun 09, 2026', 'Jun 04, 2026'];

/** The exclusions a new product starts with when the admin opts into the defaults — runtime
 *  noise that is never part of a Bill of Materials. */
export const DEFAULT_EXCLUDE_PATHS = [
  '**/logs', '**/temp', '**/cache', '**/node_modules', '**/*.log', '**/*.tmp', '**/.git',
];

/** Glob patterns a scan skips. Exclusions are configured per product, under its own root. */
const EXCLUDE_POOL = [
  '**/logs', '**/temp', '**/cache', '**/node_modules', '**/*.log', '**/*.tmp',
  'C:\\Windows\\Temp', 'C:\\pagefile.sys', '**/.git', '**/dist', '**/coverage', '**/vendor',
];

/** The exclude patterns configured on ONE product scope — deterministic per host + product. */
const productExcludePaths = (endpointId: string, productKey: string): string[] => {
  const h = hash(`${endpointId}:${productKey}:exclude`);
  const n = 2 + (h % 4); // 2-5 patterns per product
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const p = EXCLUDE_POOL[(h + i * 5) % EXCLUDE_POOL.length];
    if (!out.includes(p)) out.push(p);
  }
  return out;
};

// ---------------------------------------------------------------------------
// Per-endpoint BOM record — what the Configuration Items listing shows.
// ---------------------------------------------------------------------------

/** How the CI itself got into the inventory — separate from where its BOM content came from. */
export type BomOrigin = 'Agent' | 'Manual';

export interface BomRecord {
  endpointId: string;
  status: BomStatus;
  origin: BomOrigin;
  products: BomProduct[];
  /** Total SBOM components across every product on the host. */
  components: number;
  /** Vulnerable components found across the host. */
  findings: number;
  cryptoAssets: number;
  aiModels: number;
  lastGenerated: string | null;
}

/** How many components a given (endpoint, product, type) scope reports. */
export const componentCount = (endpointId: string, productKey: string, type: BomType): number => {
  const h = hash(`${endpointId}:${productKey}:${type}`);
  // Forty narrow application roots on one host, not forty platforms — see MANY_PRODUCT_HOST.
  if (smallScope(endpointId, productKey)) return type === 'SBOM' ? 8 + (h % 34) : type === 'CBOM' ? h % 4 : h % 3;
  if (type === 'SBOM') return productKey === OS_PRODUCT_KEY ? 24 + (h % 190) : 42 + (h % 210);
  if (type === 'CBOM') return 3 + (h % 9);
  // AI BOM only exists where an application actually ships models.
  return productKey === OS_PRODUCT_KEY ? 0 : h % 6;
};

/** The BOM record for one endpoint — deterministic from its id. */
export const bomForEndpoint = (endpointId: string): BomRecord => {
  const h = hash(endpointId);
  // ~1 in 9 hosts has not produced a BOM yet; ~1 in 4 of the rest is mid-scan.
  const status: BomStatus = h % 9 === 0 ? 'Not Generated' : h % 4 === 0 ? 'In Progress' : 'Generated';

  /* Origin and sources are the three states the product supports, and no others:
   *
   *   Agent   →  Agent                 the agent found the CI and scanned it
   *   Agent   →  Agent · Ingested      agent-discovered, plus a document ingested for one product
   *   Manual  →  Manually Ingested     the CI exists because someone ingested a BOM for it
   *
   * A CI with no BOM is always agent-discovered: a manual CI exists BECAUSE something was
   * ingested for it, so "Manual with nothing generated" is not a reachable state.
   * ~1 in 6 CIs is manual; ~1 in 3 of the agent ones carries an extra ingested document. */
  const origin: BomOrigin = status !== 'Not Generated' && hash(`${endpointId}:origin`) % 6 === 0 ? 'Manual' : 'Agent';
  const extraIngest = origin === 'Agent' && hash(`${endpointId}:ingest`) % 3 === 0;
  const agentSource = origin === 'Manual' ? 'manual · file upload' : 'agent · directory scan';

  // 0-2 application products — except the one application server, which carries forty.
  const many = endpointId === MANY_PRODUCT_HOST && status !== 'Not Generated';
  const pool = many ? manyProducts(endpointId) : APP_PRODUCTS;
  const appCount = status === 'Not Generated' ? 0 : many ? pool.length : h % 3;
  const products: BomProduct[] = [];
  for (let i = 0; i < appCount; i++) {
    const p = many ? pool[i] : pool[(h + i * 7) % pool.length];
    if (products.some((x) => x.key === p.key)) continue;
    products.push({
      ...p,
      /* The ingested document lands on the FIRST application scope, never on the OS one — so a
         CI in that state always shows both sources rather than only "Ingested". */
      source: extraIngest && i === 0 ? 'ingested · file upload' : agentSource,
      status: status === 'In Progress' && i === appCount - 1 ? 'Pending' : 'Scanned',
      lastScan: SCAN_DATES[(h + i) % SCAN_DATES.length],
      /* On the many-products host most scopes are clean and a handful are not — which is both
         realistic and the whole point: the overview has to make those few findable among forty. */
      findings: many
        ? (hash(`${endpointId}:${p.key}:find`) % 6 === 0 ? 1 + (hash(`${endpointId}:${p.key}:n`) % 3) : 0)
        : (hash(`${endpointId}:${p.key}:find`) % 5),
      addedManually: many && MANUALLY_ADDED.includes(p.name),
      excludePaths: productExcludePaths(endpointId, p.key),
    });
  }
  if (status !== 'Not Generated') {
    products.push({
      key: OS_PRODUCT_KEY,
      name: 'OS / base platform',
      version: null,
      path: '/',
      source: agentSource,
      status: 'Scanned',
      lastScan: SCAN_DATES[h % SCAN_DATES.length],
      findings: hash(`${endpointId}:${OS_PRODUCT_KEY}:find`) % 4,
      excludePaths: productExcludePaths(endpointId, OS_PRODUCT_KEY),
    });
  }
  // Exactly one scope is the default — the one the BOM tab lands on. The OS scope is the
  // sensible default since every host has it and it rolls up everything unclaimed.
  const def = products.find((p) => p.key === OS_PRODUCT_KEY) ?? products[0];
  if (def) def.isDefault = true;

  const components = products.reduce((n, p) => n + componentCount(endpointId, p.key, 'SBOM'), 0);
  const cryptoAssets = products.reduce((n, p) => n + componentCount(endpointId, p.key, 'CBOM'), 0);
  const aiModels = products.reduce((n, p) => n + componentCount(endpointId, p.key, 'AI BOM'), 0);
  const findings = products.reduce((n, p) => n + p.findings, 0);

  // Host-level "last generated" = the newest current version across every product scope, so the
  // listing can never claim a date the detail page's timeline does not show.
  const currentDates = products
    .map((p) => bomVersions(endpointId, p.key, 'SBOM').find((v) => v.state === 'Current'))
    .filter(Boolean)
    .map((v) => v!.generatedAt.split(' ').slice(0, 3).join(' '));
  const lastGenerated = currentDates.length
    ? currentDates.reduce((a, b) => (SCAN_DATES.indexOf(a) <= SCAN_DATES.indexOf(b) ? a : b))
    : null;

  return { endpointId, status, origin, products, components, findings, cryptoAssets, aiModels, lastGenerated };
};

/** Short labels for where a CI's BOM actually came from — the listing's "BOM Sources" column.
 *
 *  Derived from the `source` already on each product scope rather than stored separately, so the
 *  column cannot claim a source the CI's own scan-paths panel does not show. A CI with no BOM has
 *  no products and therefore no sources, which is why that cell reads "—" rather than "Agent". */
export const bomSourceLabels = (bom: BomRecord): string[] => {
  const out: string[] = [];
  for (const p of bom.products) {
    const label = p.source.startsWith('manual') ? 'Manually Ingested'
      : p.source.startsWith('ingested') ? 'Ingested'
      : 'Agent';
    if (!out.includes(label)) out.push(label);
  }
  /* Fixed order, not product order. The ingested document sits on an application scope and the
     agent scan on the OS one, which is stored second — so left to itself the pair rendered
     "Ingested · Agent", reading as though the ingest were the primary source. */
  const RANK = ['Agent', 'Ingested', 'Manually Ingested'];
  return out.sort((a, b) => RANK.indexOf(a) - RANK.indexOf(b));
};

/** BOM records for the whole fleet, in the Endpoints listing's order. */
export const bomInventory = (): BomRecord[] => mockEndpoints.map((e) => bomForEndpoint(e.id));

// ---------------------------------------------------------------------------
// Versions — a version only appears when a scan found a CHANGE.
// ---------------------------------------------------------------------------

export interface BomScanRun {
  timestamp: string;
  trigger: 'scheduled' | 'manual' | 'agent check-in';
  duration: string;
  result: 'Success' | 'Failed';
  outcome: string;
}

export interface BomVersion {
  v: number;
  generatedAt: string;
  state: 'Current' | 'Superseded';
  /** Human summary of what this version changed. */
  change: string;
  /** What this version changed vs the previous one — rendered as the card's finding dots.
   *  On v1 everything is "added", since the first scan discovers the whole inventory. */
  added: number;
  removed: number;
  updated: number;
  /** Known CVEs carried by what this version added or updated — the reason to read the change. */
  cves: number;
  format: string;
  /** Scan runs between this version and the previous one (newest first). */
  runs: BomScanRun[];
  /** Summary line rendered on the connector below the card. */
  gapLabel: string;
  /** Days until retention deletes this version. `null` on the current version, which is never
   *  aged out — a living SBOM always keeps its newest generation. */
  expiresInDays: number | null;
}

/* Retention is an ADMIN policy, so both screens read it from one place: change "delete versions
 * older than N days" under Admin › BOM Management › Retention and these expiry counts move with
 * it. Ages are measured against the newest scan date rather than the real clock, so the demo
 * never drifts into showing every version as long expired. */
const NEWEST_SCAN = new Date(2026, 5, 16); // Jun 16, 2026 — SCAN_DATES[0]

const parseScanDate = (s: string): Date | null => {
  const d = new Date(s.replace(/\s+\d{2}:\d{2}\s+[AP]M$/, ''));
  return isNaN(d.getTime()) ? null : d;
};

/** How many older versions retention has already removed for a scope, and the policy behind it. */
export const bomRetention = (endpointId: string, productKey: string, type: BomType) => {
  const { keepVersions, deleteAfterDays } = RETENTION_DEFAULT;
  // Deterministic per scope: some hosts have been enrolled long enough to have lost versions,
  // others have not.
  const deleted = hash(`${endpointId}:${productKey}:${type}:retained`) % 6;
  return { deleted, keepVersions, deleteAfterDays };
};

const TIMES = ['08:33 AM', '06:12 AM', '06:40 PM', '11:20 PM', '02:47 PM', '09:05 AM'];

/** The version history for one (endpoint, product, type) scope. */
export const bomVersions = (endpointId: string, productKey: string, type: BomType): BomVersion[] => {
  const total = componentCount(endpointId, productKey, type);
  if (total === 0) return [];
  const h = hash(`${endpointId}:${productKey}:${type}:versions`);
  // Every scope carries three versions, with v3 as the current one.
  const count = 3;
  const out: BomVersion[] = [];
  for (let i = count; i >= 1; i--) {
    const vh = hash(`${endpointId}:${productKey}:${type}:v${i}`);
    const isFirst = i === 1;
    // Take the counts from the SAME diff the Compare screen renders, so the card summary, the
    // scan outcome and the diff can never contradict each other. The first scan discovers the
    // whole inventory, so everything in it counts as added.
    const d = isFirst ? null : bomDiff(endpointId, productKey, type, i - 1, i);
    const added = d ? d.added.length : total;
    const removed = d ? d.removed.length : 0;
    const updatedN = d ? d.updated.length : 0;
    // CVEs ride in on what a version added or updated. The first scan discovers the whole
    // inventory, so it carries every CVE already present on the host.
    const cves = d
      ? [...d.added, ...d.updated].reduce((n, e) => n + (e.cves?.length ?? 0), 0)
      : (type === 'SBOM' ? bomComponents(endpointId, productKey).reduce((n, c) => n + (c.cves?.length ?? 0), 0) : 0);
    const gapScans = isFirst ? 1 : 1 + (vh % 3);
    const noChange = Math.max(0, gapScans - 1);
    // SCAN_DATES runs newest → oldest, so a HIGHER version number must take a LOWER index.
    const dateIdx = Math.min(SCAN_DATES.length - 1, (count - i) + (h % 3));
    const runs: BomScanRun[] = [];
    for (let r = 0; r < gapScans; r++) {
      const rh = hash(`${endpointId}:${productKey}:${type}:v${i}:r${r}`);
      const failed = !isFirst && r === gapScans - 1 && rh % 5 === 0;
      runs.push({
        // Runs in this gap sit at or just before the version they produced (newest run first).
        timestamp: `${SCAN_DATES[Math.min(SCAN_DATES.length - 1, dateIdx + r)]} ${TIMES[(rh + r) % TIMES.length]}`,
        trigger: rh % 3 === 0 ? 'manual' : rh % 3 === 1 ? 'scheduled' : 'agent check-in',
        duration: `${1 + (rh % 3)}m ${String(rh % 60).padStart(2, '0')}s`,
        result: failed ? 'Failed' : 'Success',
        outcome: failed ? '—' : r === 0 ? (isFirst ? `first ${type} generated` : `+${added}${removed ? ` · −${removed}` : ''} → v${i}`) : 'no change',
      });
    }
    const generatedAt = runs[0].timestamp;
    const gen = parseScanDate(generatedAt);
    const ageDays = gen ? Math.max(0, Math.round((NEWEST_SCAN.getTime() - gen.getTime()) / 86_400_000)) : 0;
    out.push({
      v: i,
      // A version IS the output of its newest run, so it carries that run's timestamp.
      generatedAt,
      state: i === count ? 'Current' : 'Superseded',
      // The current version never expires; a superseded one is deleted once it passes the
      // retention window measured from when it was generated.
      expiresInDays: i === count ? null : Math.max(0, RETENTION_DEFAULT.deleteAfterDays - ageDays),
      added,
      removed,
      updated: updatedN,
      cves,
      change: isFirst
        ? 'initial agent scan'
        : [
            added ? `+${added} component${added === 1 ? '' : 's'}` : null,
            updatedN ? `${updatedN} updated` : null,
            removed ? `${removed} removed` : null,
          ].filter(Boolean).join(' · ') || 'metadata only',
      format: 'CycloneDX 1.6',
      runs,
      gapLabel: isFirst
        ? `1 scan · initial agent scan, first ${type} generated`
        : `${gapScans} scan${gapScans === 1 ? '' : 's'} between v${i - 1} and v${i}${noChange ? ` · ${noChange} found no change` : ''}`,
    });
  }
  return out;
};

// ---------------------------------------------------------------------------
// Component / crypto / model lists for one scope.
// ---------------------------------------------------------------------------

/** Deterministic slice of a catalog, capped at the catalog size (used where n never exceeds it). */
function slice<T>(catalog: T[], seed: number, n: number): T[] {
  const take = Math.min(n, catalog.length);
  return Array.from({ length: take }, (_, i) => catalog[(seed + i * 3) % catalog.length]);
}

/** Nudge a semver-ish string by `round`, so a repeated component reads as a different build. */
const variant = (v: string, round: number): string => {
  const parts = v.split('.');
  const last = parts.length - 1;
  const n = parseInt(parts[last].replace(/\D/g, ''), 10);
  if (isNaN(n)) return `${v}-${round}`;
  parts[last] = parts[last].replace(/\d+/, String(n + round));
  return parts.join('.');
};

/* A real host carries far more components than any hand-written catalog: hundreds of transitive
 * dependencies, and commonly several BUILDS of the same library side by side. So the catalog is
 * cycled to reach the reported count, bumping the version (and its PURL) on each pass — which is
 * what a large SBOM genuinely looks like, and keeps the count and the list in agreement. */
/** How common a component is across an estate, 0–100.
 *
 *  Reach is a property of the COMPONENT, not of the host: openssl is on nearly everything, an
 *  internal auth SDK is on a handful of app servers. Without this the generator had no basis on
 *  which to include one component and not another. */
const PREVALENCE: Record<string, number> = {
  // ubiquitous runtime and transport
  openssl: 94, zlib: 92, libcurl: 88, 'Microsoft .NET Runtime': 74, 'OpenJDK Runtime': 62,
  Python: 58, 'Node.js': 52,
  // fleet-wide agents and desktop software
  'CrowdStrike Falcon Sensor': 86, 'com.motadata.agent-core': 84, 'com.motadata.telemetry': 78,
  'Google Chrome': 80, '7-Zip': 66, 'Adobe Acrobat Reader DC': 60, 'Mozilla Firefox': 44,
  'Microsoft Office Professional Plus': 56, 'Avecto DefendPoint': 34,
  // common libraries
  'Newtonsoft.Json': 64, 'System.Text.Json': 58, lodash: 62, axios: 46, react: 38,
  requests: 50, urllib3: 54, 'golang.org/x/net': 36, 'golang.org/x/crypto': 34,
  'node-forge': 24, pycryptodome: 22, Serilog: 30,
  // server-side, present only where that role runs
  nginx: 30, PostgreSQL: 24, Redis: 22, 'Apache Tomcat': 28, 'apache-poi': 20,
  'hibernate-core': 18, 'spring-core': 32,
  // the vulnerable set — deliberately spread so exposure differs row to row
  'log4j-core': 48, 'jackson-databind': 40, 'commons-text': 26, 'commons-collections': 20,
  'in.hdfc.auth-sdk': 12,
};
const prevalenceOf = (name: string) => PREVALENCE[name] ?? 30;

export const bomComponents = (endpointId: string, productKey: string): BomComponent[] => {
  const total = componentCount(endpointId, productKey, 'SBOM');
  const seed = hash(`${endpointId}:${productKey}:sbom`);
  const ep = mockEndpoints.find((e) => e.id === endpointId);
  const withOs = productKey === OS_PRODUCT_KEY && !!ep;
  const n = withOs ? Math.max(0, total - 1) : total; // the OS row counts toward the total

  /* WHICH components this scope carries.
   *
   * This used to be a contiguous walk of the catalog from a seed offset, wrapping. A scope
   * declares 24–251 components and the catalog holds 40, so every scope wrapped several times
   * and therefore contained EVERY component — membership was not a choice, and every component
   * had the same reach. A ranked exposure list built on that has nothing to rank.
   *
   * Now the catalog is ranked per scope by a deterministic key biased by prevalence, and only the
   * head of that ranking is carried. A common library wins the draw on most hosts, a niche one on
   * few, and reach varies the way it does in a real estate. The COUNT is unchanged — the extra
   * slots are further versions of the components this scope does carry, which is also truer:
   * hosts run several versions of the same library. */
  const ranked = SBOM_CATALOG
    .map((c) => ({ c, k: (hash(`${endpointId}:${productKey}:${c.name}`) % 1000) / 10 - prevalenceOf(c.name) }))
    .sort((a, b) => a.k - b.k)
    .map((x) => x.c);
  /* 8–18 distinct names per scope, chosen by a sweep rather than by feel. The value trades two
     things off: a SMALL head is what lets prevalence select (a large one hands the scope the whole
     catalog again and every component's reach collapses back to identical), while a small head
     also forces more version rounds to reach the declared count. Measured across the fleet:
        6–14  → reach 23,23,20,20,19,18,18,17 but up to 38 versions of one library
        8–18  → reach 25,25,24,23,21,20,20,20 and up to 22          <- chosen
       10–24  → reach 25,24,24,23,22,22,21,21, flatter at the top
     The residual — a library appearing at up to 22 versions on one host — is a fixture limit, not
     a rendering one: `componentCount` declares up to 251 components per scope and SBOM_CATALOG
     holds 40 names, so SOMETHING has to repeat. Growing the catalog is the real fix. */
  const distinct = Math.min(ranked.length, 8 + (seed % 11));
  const picked = ranked.slice(0, distinct);

  const list: BomComponent[] = [];
  for (let i = 0; i < n; i++) {
    const base = picked[i % distinct];
    const round = Math.floor(i / distinct);
    if (round === 0) { list.push(base); continue; }
    const version = variant(base.version, round);
    list.push({ ...base, version, purl: base.purl.replace(/@[^@]*$/, `@${version}`) });
  }

  // The OS scope also reports the host OS itself, as the first component.
  if (withOs && ep) {
    list.unshift({
      name: ep.osName,
      version: ep.version ?? '—',
      type: 'Operating-System',
      ecosystem: 'Windows',
      purl: `pkg:generic/${ep.osName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}@${ep.version ?? '0'}`,
      license: 'Proprietary',
      origin: 'Proprietary',
    });
  }
  return list;
};

export const bomCryptoAssets = (endpointId: string, productKey: string): CryptoAsset[] =>
  slice(CBOM_CATALOG, hash(`${endpointId}:${productKey}:cbom`), componentCount(endpointId, productKey, 'CBOM'));

/** MODELS only — what the dashboard and a CI's AI BOM tab mean by the word. Frameworks, runtimes
 *  and datasets are AI assets but not models, and folding them in here would have turned the
 *  dashboard's "3 of 13 models past EOL" into a different claim without anyone saying so. */
export const bomAiModels = (endpointId: string, productKey: string): AiModel[] =>
  slice(AIBOM_CATALOG.filter((m) => !m.kind || m.kind === 'local-model-file' || m.kind === 'hosted-llm'),
    hash(`${endpointId}:${productKey}:aibom`), componentCount(endpointId, productKey, 'AI BOM'));

/** The WHOLE AI bill of materials for a scope — models plus the stack around them. */
export const bomAiAssets = (endpointId: string, productKey: string): AiModel[] =>
  slice(AIBOM_CATALOG, hash(`${endpointId}:${productKey}:aibom`),
    Math.min(AIBOM_CATALOG.length, componentCount(endpointId, productKey, 'AI BOM') * 2));

// ---------------------------------------------------------------------------
// Version diff — powers the Compare versions modal.
// ---------------------------------------------------------------------------

export interface BomDiffEntry {
  kind: 'Added' | 'Updated' | 'Removed' | 'Unchanged';
  name: string;
  ecosystem: string;
  version: string;
  /** Previous version — only on Updated rows. */
  fromVersion?: string;
  /** patch / minor / major — only on Updated rows. */
  bump?: 'patch' | 'minor' | 'major';
  cves?: string[];
  /** Carried through from the component so a diff row can show its full identity. */
  purl?: string;
  license?: string;
  origin?: string;
  componentType?: string;
}

export interface BomDiff {
  added: BomDiffEntry[];
  updated: BomDiffEntry[];
  removed: BomDiffEntry[];
  /** Everything the two versions have in common, so a comparison can list it, not just count it. */
  unchangedEntries: BomDiffEntry[];
  unchanged: number;
}

const bumpVersion = (v: string, kind: 'patch' | 'minor' | 'major'): string => {
  const parts = v.split('.');
  const idx = kind === 'major' ? 0 : kind === 'minor' ? 1 : 2;
  while (parts.length <= idx) parts.push('0');
  const n = parseInt(parts[idx].replace(/\D/g, ''), 10);
  parts[idx] = String((isNaN(n) ? 0 : n) + 1);
  for (let i = idx + 1; i < parts.length; i++) parts[i] = '0';
  return parts.join('.');
};

/** The diff between two versions of one scope. */
export const bomDiff = (endpointId: string, productKey: string, type: BomType, from: number, to: number): BomDiff => {
  const pool =
    type === 'SBOM'
      ? bomComponents(endpointId, productKey)
      : type === 'CBOM'
        ? bomCryptoAssets(endpointId, productKey).map((c) => ({ name: c.name, version: c.keyLength, ecosystem: c.algorithm, cves: undefined, purl: c.location, license: c.protocol, origin: c.compliance, type: c.primitive }))
        : bomAiModels(endpointId, productKey).map((m) => ({ name: m.name, version: m.version, ecosystem: m.provider, cves: undefined, purl: m.usage, license: m.license, origin: m.source, type: m.task }));
  if (!pool.length) return { added: [], updated: [], removed: [], unchangedEntries: [], unchanged: 0 };

  const h = hash(`${endpointId}:${productKey}:${type}:${from}-${to}`);
  // Shifts MUST be unsigned (>>>): `hash` returns a full uint32, and the signed `>>` turns any
  // value above 2^31 negative, which made nUpdated 0 and nRemoved -1 — and Array.from({length:-1})
  // is silently empty, so updated/removed rows disappeared everywhere.
  const nAdded = 1 + (h % 3);
  const nUpdated = 1 + ((h >>> 3) % 2);
  const nRemoved = (h >>> 6) % 2;

  const pick = (offset: number, n: number) =>
    Array.from({ length: n }, (_, i) => pool[(h + offset + i * 5) % pool.length]);

  // Every entry carries the component's full identity, so a diff row can be expanded without
  // going back to the component list.
  const identity = (c: any) => ({
    name: c.name, ecosystem: c.ecosystem, cves: c.cves,
    purl: c.purl, license: c.license, origin: c.origin, componentType: c.type,
  });

  const added: BomDiffEntry[] = pick(11, nAdded).map((c) => ({
    kind: 'Added', ...identity(c), version: c.version,
  }));
  const updated: BomDiffEntry[] = pick(41, nUpdated).map((c, i) => {
    const bump: 'patch' | 'minor' | 'major' = (h + i) % 5 === 0 ? 'major' : (h + i) % 3 === 0 ? 'minor' : 'patch';
    return {
      kind: 'Updated', ...identity(c),
      fromVersion: c.version, version: bumpVersion(c.version, bump), bump,
    };
  });
  const removed: BomDiffEntry[] = pick(83, nRemoved).map((c) => ({
    kind: 'Removed', ...identity(c), version: c.version,
  }));

  // Whatever the diff did not touch is unchanged — derived from the same pool so the five
  // comparison tabs always sum to the pool size.
  const touched = new Set([...added, ...updated, ...removed].map((e) => e.name));
  const unchangedEntries: BomDiffEntry[] = pool
    .filter((c) => !touched.has(c.name))
    .map((c) => ({ kind: 'Unchanged' as const, ...identity(c), version: c.version }));

  return { added, updated, removed, unchangedEntries, unchanged: unchangedEntries.length };
};

// ---------------------------------------------------------------------------
// Point-in-time inventory + the CycloneDX document, for the side-by-side diff.
// ---------------------------------------------------------------------------

/** A component as it stood at one version, flattened across the three BOM types. */
export interface DocComponent {
  name: string;
  version: string;
  type: string;
  purl?: string;
  license?: string;
}

const asDocComponents = (endpointId: string, productKey: string, type: BomType): DocComponent[] => {
  if (type === 'SBOM') {
    return bomComponents(endpointId, productKey).map((c) => ({
      name: c.name, version: c.version, type: c.type.toLowerCase(), purl: c.purl, license: c.license,
    }));
  }
  if (type === 'CBOM') {
    return bomCryptoAssets(endpointId, productKey).map((c) => ({
      name: c.name, version: c.keyLength, type: c.primitive.toLowerCase(), purl: c.location, license: c.protocol,
    }));
  }
  return bomAiModels(endpointId, productKey).map((m) => ({
    name: m.name, version: m.version, type: m.task.toLowerCase(), purl: m.usage, license: m.license,
  }));
};

/** The inventory as it stood at `version`. The catalog represents the newest version, so older
 *  ones are reconstructed by walking the diffs backwards — remove what that version added,
 *  restore what it updated, put back what it removed. */
/* ── the dependency graph ────────────────────────────────────
   A component list says WHAT is installed; it cannot say why. The graph answers the question
   that actually blocks a remediation: this library is vulnerable — is it something we chose,
   or something four levels down that we inherited? Those need different responses, and the
   flat list makes them look identical.

   Built from the same catalogue the list renders, so a component can never appear in one and
   not the other. Shape is deterministic per host + product. */

export interface DepNode {
  /** `name@version` — the graph's identity. See the keying note in `bomDependencies`. */
  key: string;
  name: string;
  version: string;
  /** Searchable alongside the name: an admin chasing an advisory usually has the PURL. */
  purl: string;
  /** How many parents in the whole graph depend on this build. >1 renders as "xN". */
  uses: number;
  cves: number;
  children: DepNode[];
  /** Already expanded elsewhere in the tree — shown once, then referenced, so a shared
   *  component cannot make the tree look bigger than the estate actually is. */
  repeat?: boolean;
}

export interface DepGraph {
  rootLabel: string;
  direct: number;
  transitive: number;
  maxDepth: number;
  /** Components the scanner found on disk but could not attach to the graph — vendored
   *  copies, OS packages, anything with no manifest. Worth stating: they are still installed. */
  notInGraph: number;
  /** Those same components, as nodes. The count alone was a dead end — it told you how many
   *  could not be placed and gave you no way to look at them. */
  standalone: DepNode[];
  /** Every component in the scope. `direct + transitive + notInGraph` sums to exactly this,
   *  and this equals the row count of the Components tab — so "N not in graph" always has a
   *  denominator the user can see, rather than floating against a number twice its size. */
  total: number;
  edges: number;
  tree: DepNode[];
}

export const bomDependencies = (endpointId: string, productKey: string): DepGraph => {
  /* Keyed by `name@version`, NOT by name.
     A host genuinely carries several BUILDS of the same library — that is what the version-drift
     work in this module is about — and they are distinct components with distinct PURLs, often
     pulled in by different parents. Keying by name alone merged those builds into one node,
     which folded the levels back on themselves and produced 30-hop chains out of a 6-level
     shape. Keying by build makes every node unique, so the level structure below cannot cycle,
     and it makes the graph count the same things the component list counts. */
  const all = bomComponents(endpointId, productKey);
  const idOf = (c: BomComponent) => `${c.name}@${c.version}`;
  /** The library behind a build id — `name@version` back to `name`. */
  const byName = (id: string) => id.slice(0, id.lastIndexOf('@'));
  const r = seeded(`${endpointId}:${productKey}:deps`);

  /* Roughly a third are declared directly; the rest are pulled in by something else. A real
     manifest looks like this — a handful of choices dragging a long tail behind them.

     The product root is a PARENT, and the same one-build-per-library rule applies to it. The
     catalogue cycles builds, so taking every third row blindly declared `zlib@1.2.11` and
     `zlib@1.2.12` side by side at the top of the tree: two rows, same visible name — exactly
     the duplicate that gets reported. Skipped builds fall through to `rest`, so the totals
     still reconcile with the component list. */
  const direct: BomComponent[] = [];
  const declared = new Set<string>();
  all.forEach((c, i) => {
    if (i % 3 !== 0 || declared.has(c.name)) return;
    declared.add(c.name);
    direct.push(c);
  });
  const directSet = new Set(direct.map(idOf));
  const rest = all.filter((c) => !directSet.has(idOf(c)));
  const notInGraph = Math.round(rest.length * 0.25);
  const attachable = rest.slice(0, rest.length - notInGraph);
  /* The tail that could not be attached, kept rather than counted away. */
  const unplaced = rest.slice(rest.length - notInGraph);

  /* Levels are built explicitly rather than inferred. Assigning parents at random and hoping
     the depth stays sane produced those 30-hop chains — a tree indented thirty times is
     unreadable, which defeats the point of drawing one. Real manifests are wide and shallow:
     most of the weight sits one or two hops in, thinning out fast. */
  const parentOf = new Map<string, string[]>();
  const useCount = new Map<string, number>();
  const SHAPE = [0.34, 0.22, 0.16, 0.12, 0.09, 0.07];  // share of transitive deps per level, 2..7
  let level: string[] = direct.map(idOf);
  let cursor = 0;
  SHAPE.forEach((share, li) => {
    const take = li === SHAPE.length - 1
      ? attachable.length - cursor
      : Math.round(attachable.length * share);
    const slice = attachable.slice(cursor, cursor + take);
    cursor += take;
    if (!slice.length || !level.length) return;
    slice.forEach((c) => {
      const id = idOf(c);
      const n = 1 + (r() < 0.18 ? 1 : 0);          // a few are shared by two parents
      const parents: string[] = [];
      for (let k = 0; k < n; k++) {
        const p = level[Math.floor(r() * level.length)];
        if (p !== id && !parents.includes(p)) parents.push(p);
      }
      parents.forEach((p) => {
        const kids = parentOf.get(p) ?? [];
        /* ONE edge per (parent, child), and one BUILD of a library per parent. The first guard
           stops two picks landing on the same parent. The second stops `color-name@1.4.0` and
           `color-name@1.4.1` sitting under one parent as consecutive rows that read as a
           duplicate — a resolver would have collapsed them to a single build anyway. Drift
           between DIFFERENT parents is real and stays. */
        if (kids.some((k) => k === id || byName(k) === c.name)) return;
        parentOf.set(p, [...kids, id]);
        useCount.set(id, (useCount.get(id) ?? 0) + 1);
      });
    });
    level = slice.map(idOf);                       // the next level hangs off this one
  });

  const byId = new Map(all.map((c) => [idOf(c), c]));
  const seen = new Set<string>();
  let maxDepth = 0;
  let edges = 0;

  const build = (id: string, depth: number): DepNode => {
    const c = byId.get(id);
    maxDepth = Math.max(maxDepth, depth);
    const node: DepNode = {
      key: id,
      name: c?.name ?? id,
      version: c?.version ?? '—',
      purl: c?.purl ?? '',
      uses: useCount.get(id) ?? 1,
      cves: c?.cves?.length ?? 0,
      children: [],
    };
    /* A component is expanded the first time it appears and referenced afterwards. Without
       this a diamond in the graph renders as an infinite tree. */
    if (seen.has(id)) { node.repeat = true; return node; }
    seen.add(id);
    const kids = parentOf.get(id) ?? [];
    edges += kids.length;
    node.children = kids.map((k) => build(k, depth + 1));
    return node;
  };

  const tree = direct.map((c) => build(idOf(c), 1));
  return {
    rootLabel: productKey === OS_PRODUCT_KEY ? 'OS / base platform' : productKey,
    direct: direct.length,
    transitive: attachable.length,
    maxDepth,
    notInGraph,
    /* Leaves by definition: nothing hangs off a component with no manifest. `uses: 0`
       distinguishes "nothing depends on this" from the graph's "one parent". */
    standalone: unplaced.map((c) => ({
      key: idOf(c), name: c.name, version: c.version, purl: c.purl,
      uses: 0, cves: c.cves?.length ?? 0, children: [],
    })),
    total: all.length,
    edges: edges + direct.length,
    tree,
  };
};

/* ── what a version is carrying ──────────────────────────────
   The version card used to say only what CHANGED. That answers "what did this scan do",
   not "how bad is this host right now" — which is the question the card is opened with.
   These three read the components present AT a version, so they describe the state the
   version left the host in rather than the delta that produced it. */

/** Real ratings for the catalogue's real advisories; anything else falls back to a stable
 *  bucket derived from the id, so a demo CVE never claims a severity it cannot justify. */
const CVE_SEVERITY: Record<string, BomSeverity> = {
  'CVE-2021-44228': 'Critical', 'CVE-2021-45046': 'Critical', 'CVE-2022-42889': 'Critical',
  'CVE-2015-6420': 'High', 'CVE-2021-23337': 'High', 'CVE-2026-21412': 'High',
  'CVE-2026-26234': 'Medium', 'CVE-2026-21409': 'Medium', 'CVE-2026-30303': 'Low',
};
export type BomSeverity = 'Critical' | 'High' | 'Medium' | 'Low';
export const BOM_SEVERITIES: BomSeverity[] = ['Critical', 'High', 'Medium', 'Low'];

export const cveSeverity = (id: string): BomSeverity => {
  if (CVE_SEVERITY[id]) return CVE_SEVERITY[id];
  const n = [...id].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7);
  return BOM_SEVERITIES[n % 4];
};

/* Licences that need a lawyer's opinion before this build ships. Strong copyleft and
   anything bespoke — not a defect, but the one licence fact worth surfacing next to the
   security ones. */
const BLOCKED_LICENSES = ['AGPL-3.0', 'GPL-3.0', 'SSPL-1.0', 'Commercial API', 'Proprietary'];
export const isBlockedLicense = (l: string) => BLOCKED_LICENSES.includes(l);

export interface BomVersionStats {
  /** CVE count per severity across every component present at this version. */
  bySeverity: Record<BomSeverity, number>;
  cves: number;
  /** Components carrying at least one CVE, and the total present. */
  vulnerablePackages: number;
  totalPackages: number;
  /** Components on a licence that needs review. */
  blockedLicenses: number;
}

export const bomVersionStats = (
  endpointId: string, productKey: string, type: BomType, version: number,
): BomVersionStats => {
  const present = componentsAtVersion(endpointId, productKey, type, version);
  const catalog = new Map(bomComponents(endpointId, productKey).map((c) => [c.name, c]));
  const bySeverity: Record<BomSeverity, number> = { Critical: 0, High: 0, Medium: 0, Low: 0 };
  let cves = 0, vulnerablePackages = 0, blockedLicenses = 0;

  present.forEach((p) => {
    const src = catalog.get(p.name);
    const ids = src?.cves ?? [];
    if (ids.length) { vulnerablePackages++; cves += ids.length; }
    ids.forEach((id) => { bySeverity[cveSeverity(id)]++; });
    if (isBlockedLicense(p.license ?? src?.license ?? '')) blockedLicenses++;
  });

  return { bySeverity, cves, vulnerablePackages, totalPackages: present.length, blockedLicenses };
};

export const componentsAtVersion = (
  endpointId: string, productKey: string, type: BomType, version: number,
): DocComponent[] => {
  const versions = bomVersions(endpointId, productKey, type);
  const newest = versions.length ? Math.max(...versions.map((v) => v.v)) : 1;
  let list = asDocComponents(endpointId, productKey, type);

  for (let v = newest; v > version; v--) {
    const d = bomDiff(endpointId, productKey, type, v - 1, v);
    const addedNames = new Set(d.added.map((e) => e.name));
    list = list.filter((c) => !addedNames.has(c.name));
    const revert = new Map(d.updated.map((e) => [e.name, e.fromVersion ?? e.version]));
    list = list.map((c) => (revert.has(c.name) ? { ...c, version: revert.get(c.name)! } : c));
    d.removed.forEach((e) => {
      if (!list.some((c) => c.name === e.name)) {
        list.push({ name: e.name, version: e.version, type: 'library', purl: e.purl, license: e.license });
      }
    });
  }
  return list;
};

/** The CycloneDX 1.6 document for one version — what a download would actually produce, and
 *  what the diff view compares line by line. */
export const bomDocument = (
  endpointId: string, productKey: string, type: BomType, version: number,
): string => {
  const comps = componentsAtVersion(endpointId, productKey, type, version);
  const v = bomVersions(endpointId, productKey, type).find((x) => x.v === version);
  const ep = mockEndpoints.find((e) => e.id === endpointId);
  const h = hash(`${endpointId}:${productKey}:${type}`);
  const uuid = `urn:uuid:${h.toString(16).padStart(8, '0')}-4b2a-4f6c-9d31-${(h >>> 3).toString(16).padStart(8, '0')}`;

  const lines: string[] = [];
  lines.push('{');
  lines.push('  "bomFormat": "CycloneDX",');
  lines.push('  "specVersion": "1.6",');
  lines.push(`  "serialNumber": "${uuid}",`);
  lines.push(`  "version": ${version},`);
  lines.push('  "metadata": {');
  lines.push(`    "timestamp": "${v?.generatedAt ?? '—'}",`);
  lines.push('    "tools": [');
  lines.push('      { "vendor": "Motadata", "name": "ServiceOps Agent", "version": "8.7.408" }');
  lines.push('    ],');
  lines.push('    "component": {');
  lines.push('      "type": "operating-system",');
  lines.push(`      "name": "${ep?.osName ?? 'Unknown'}",`);
  lines.push(`      "version": "${ep?.version ?? '—'}"`);
  lines.push('    }');
  lines.push('  },');
  lines.push('  "components": [');
  comps.forEach((c, i) => {
    const last = i === comps.length - 1;
    lines.push('    {');
    lines.push(`      "type": "${c.type}",`);
    lines.push(`      "name": "${c.name}",`);
    lines.push(`      "version": "${c.version}",`);
    if (c.license) lines.push(`      "licenses": [{ "license": { "id": "${c.license}" } }],`);
    lines.push(`      "purl": "${c.purl ?? ''}"`);
    lines.push(last ? '    }' : '    },');
  });
  lines.push('  ]');
  lines.push('}');
  return lines.join('\n');
};

// ---------------------------------------------------------------------------
// Host-wide exclude paths — shared by every product scan on the host.
// ---------------------------------------------------------------------------

/** The exclude patterns that actually bit while scanning ONE component — i.e. paths under that
 *  component's own root that the scanner skipped. Deterministic, so the grid is stable. */
export const excludedPathsFor = (endpointId: string, productKey: string, componentName: string): string[] => {
  const h = hash(`${endpointId}:${productKey}:${componentName}:excl`);
  const n = 1 + (h % 4); // 1-4 patterns hit per component
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const p = EXCLUDE_POOL[(h + i * 3) % EXCLUDE_POOL.length];
    if (!out.includes(p)) out.push(p);
  }
  return out;
};

/** Products that can still be added to a host's scan config (not already scanned). */
export const availableProducts = (taken: string[]) => APP_PRODUCTS.filter((p) => !taken.includes(p.key));
