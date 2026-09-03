/* What the composer can attach, and what it can suggest.
 *
 * Sources are CONTEXT, not content: attaching one says "use this when you answer", and the
 * composer's job is to make that obvious without sending anyone to another screen to do it.
 *
 * ⚠️ MOCK. There is no document store, no KB service and no upload endpoint in this prototype, so
 * these are fixtures and an attached file is a name and a size. Everything here is shaped the way
 * a real response would be — id, title, a line of summary, a category — so wiring a service later
 * replaces this file and nothing that reads it.
 */

export type SourceKind = 'file' | 'doc' | 'kb';

export interface NovaSource {
  id: string;
  kind: SourceKind;
  title: string;
  /** The small grey line: a file size, a document type, an article id. */
  meta?: string;
}

// ══ knowledge base ══════════════════════════════════════════════════════════════════════════

export interface KbArticle {
  id: string;
  title: string;
  summary: string;
  category: string;
}

export const KB_ARTICLES: KbArticle[] = [
  {
    id: 'KB-1042', title: 'VPN Authentication Troubleshooting',
    summary: 'Cached credentials, expired certificates and MFA prompts that never arrive.',
    category: 'Network Access',
  },
  {
    id: 'KB-1043', title: 'Clearing Saved VPN Credentials on Windows',
    summary: 'Step-by-step removal from Credential Manager, and when it is the wrong fix.',
    category: 'Network Access',
  },
  {
    id: 'KB-0871', title: 'Password Change: What Else Needs Updating',
    summary: 'Mail profiles, VPN, mapped drives and mobile devices after a domain password change.',
    category: 'Accounts',
  },
  {
    id: 'KB-0620', title: 'Docking Station Display Flicker',
    summary: 'Known firmware issue on WD19 docks and the version that resolves it.',
    category: 'End User Computing',
  },
  {
    id: 'KB-1180', title: 'SLA Policy Reference',
    summary: 'Response and resolution targets by priority, and how the clock pauses.',
    category: 'Service Management',
  },
  {
    id: 'KB-0455', title: 'Requesting Access to a Shared Mailbox',
    summary: 'Who approves it, what the requester needs to supply, and typical turnaround.',
    category: 'Accounts',
  },
  {
    id: 'KB-1310', title: 'POS Terminal Outage: First Response',
    summary: 'Branch checks to run before escalating to the network or telco provider.',
    category: 'Retail Systems',
  },
];

// ══ documents ═══════════════════════════════════════════════════════════════════════════════

export interface NovaDocument {
  id: string;
  name: string;
  type: string;
  updated: string;
}

export const DOCUMENTS: NovaDocument[] = [
  { id: 'D-01', name: 'VPN Troubleshooting Guide', type: 'PDF', updated: '12 Jun 2026' },
  { id: 'D-02', name: 'IT Security Policy', type: 'PDF', updated: '02 Apr 2026' },
  { id: 'D-03', name: 'Employee IT Handbook', type: 'DOCX', updated: '28 Mar 2026' },
  { id: 'D-04', name: 'Network Access Guide', type: 'PDF', updated: '19 May 2026' },
  { id: 'D-05', name: 'Change Management Runbook', type: 'DOCX', updated: '07 Jun 2026' },
  { id: 'D-06', name: 'Branch Hardware Standards', type: 'XLSX', updated: '15 Feb 2026' },
];

// ══ prompts ═════════════════════════════════════════════════════════════════════════════════

import type { UserRole } from './novaSuggestions';

/** The "Prompts" menu. Short, imperative, and DIFFERENT from the greeting cards — those are four
 *  fully-formed questions to press, these are starting points to type from.
 *
 *  Role comes from the auth object. There is no role selector anywhere in this UI, by design. */
export const ROLE_PROMPTS: Record<UserRole, string[]> = {
  requester: [
    'Troubleshoot my issue',
    'Check my ticket status',
    'Create a ticket',
    'Find a solution',
    'I need access to something',
  ],
  technician: [
    'Summarise this ticket',
    'Find similar incidents',
    'Suggest a resolution',
    'Check SLA risk',
    'Draft an update for the requester',
  ],
  leadership: [
    "What's changed this month?",
    'Explain this metric',
    'Show SLA trends',
    'Find the biggest drivers',
    'Which service is costing us most?',
  ],
};

// ══ context ═════════════════════════════════════════════════════════════════════════════════

export interface NovaContext {
  id: string;
  label: string;
  /** What the composer's placeholder becomes while this context is attached. */
  placeholder: string;
}

/** Page ids that are worth naming as context. A page nobody would ask about gets none rather than
 *  a chip saying "Requests" that adds nothing to a question. */
const PAGE_CONTEXT: Record<string, string> = {
  'bom-dashboard': 'BOM Dashboard',
  'bom-dashboard-2': 'BOM Dashboard',
  vulnerabilities: 'Vulnerability Dashboard',
  'detected-cves': 'Detected CVEs',
  'software-components': 'Software Components',
  'ai-components': 'AI Components',
  'compliance-reports': 'Compliance Reports',
  patches: 'Patches',
  'patch-deployments': 'Patch Deployments',
  endpoints: 'Endpoints',
};

/** A record beats a page: someone with INC-0035 open and asking Nova is asking about that ticket,
 *  not about the requests list behind it. */
export function contextFor(
  record: { id: string; subject?: string } | null,
  page: string,
): NovaContext | null {
  if (record?.id) {
    return {
      id: record.id,
      label: record.subject ? `${record.id} · ${record.subject}` : record.id,
      placeholder: 'Ask Nova about this ticket…',
    };
  }
  const name = PAGE_CONTEXT[page];
  if (!name) return null;
  return { id: page, label: name, placeholder: `Ask Nova about this ${/dashboard/i.test(name) ? 'dashboard' : 'page'}…` };
}
