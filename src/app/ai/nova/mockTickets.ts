/* THE MOCK TICKET STORE — one in-memory record set every requester case reads and writes.
 *
 * An action taken in one conversation is visible in every other: create a ticket in REQ-01 and
 * REQ-06's list gains a row; escalate in REQ-03 and the record really carries High + the
 * escalation queue. MUTATIONS ARE THE ONLY WAY STATE CHANGES — components subscribe and read,
 * and every mutation returns the updated record so its caller can speak about what actually
 * happened rather than what it hoped for.
 *
 * Deliberately not React state: the store outlives any turn, drawer or view of it, exactly the
 * way the real system of record would. `useTicketStore` bridges it into React via
 * useSyncExternalStore.
 */
import { useSyncExternalStore } from 'react';

export interface MockTicket {
  ref: string;
  title: string;
  /** Plain words a requester would use. Drives the stepper: Open → Logged, In progress → In
   *  progress, Resolved/Closed → done. */
  status: 'Open' | 'In progress' | 'Pending approval' | 'Resolved' | 'Closed';
  assignee: string;
  created: string;
  lastUpdate: string;
  nextUpdate?: string;
  priority?: string;
  attempts?: string[];
  latestNote?: string;
  affectedAssets?: string[];
  affectedUsers?: number;
  resolvedAgo?: string;
  resolution?: string;
  resolvedBy?: string;
  /** The reader owes this ticket something — REQ-06's "Needs you" highlight. */
  needsYou?: boolean;
  notes: Array<{ text: string; when: string }>;
}

/** A draft the conversation is still shaping — REQ-01's card, and what its asset-tag chip
 *  writes the linked dock onto. Lives here so a LATER turn can visibly change an EARLIER card. */
export interface MockDraft {
  linkedAsset?: string;
  subject?: string;
  priority?: string;
  createdRef?: string;
  discarded?: boolean;
}

interface StoreShape {
  tickets: MockTicket[];
  drafts: Record<string, MockDraft>;
}

const seed = (): StoreShape => ({
  tickets: [
    {
      ref: 'INC-0988', title: 'VPN keeps disconnecting', status: 'In progress',
      assignee: 'Priya S. (Service Desk)', created: '3 days ago', lastUpdate: '2 hours ago',
      nextUpdate: 'today 5 PM',
      attempts: ['Reset VPN client', 'Reinstalled certificate'],
      latestNote: 'Reinstalled the cert, monitoring for 24h.',
      notes: [],
    },
    {
      ref: 'INC-0035', title: 'Lost access to shared loans mailbox', status: 'Open',
      assignee: 'End User Computing', created: '28 Feb 2026', lastUpdate: '28 Feb 2026',
      priority: 'Medium', notes: [],
    },
    {
      ref: 'INC-0871', title: 'Passbook printer fading — counter 1', status: 'In progress',
      assignee: 'Priya S.', created: '5 days ago', lastUpdate: '5 days ago',
      affectedAssets: ['PRN-0311 (Counter 1)'], affectedUsers: 1, notes: [],
    },
    {
      ref: 'INC-0790', title: 'Emails to counterparty bouncing', status: 'In progress',
      assignee: 'Messaging team', created: '12 days ago', lastUpdate: '2 days ago',
      latestNote: 'Relay rule corrected, please confirm.', needsYou: true, notes: [],
    },
    {
      ref: 'INC-0644', title: 'Fuel-station card declined', status: 'Resolved',
      assignee: 'Finance/IT', created: 'a month ago', lastUpdate: '19 days ago',
      resolvedAgo: '19 days ago', resolvedBy: 'Finance/IT',
      resolution: 'Card limit reset after finance approval.', notes: [],
    },
    {
      ref: 'REQ-0512', title: 'Request: second monitor', status: 'Pending approval',
      assignee: 'Line manager', created: '8 days ago', lastUpdate: '8 days ago', notes: [],
    },
  ],
  drafts: {},
});

let state: StoreShape = seed();
const listeners = new Set<() => void>();
const emit = () => { state = { ...state, tickets: [...state.tickets] }; listeners.forEach((l) => l()); };

const find = (ref: string) => state.tickets.find((t) => t.ref === ref);
let nextIncident = 1042;

/* ── reads ─────────────────────────────────────────────────────────────── */
export const getTicket = (ref: string): MockTicket | undefined => find(ref);
export const listOpenForUser = (): MockTicket[] =>
  state.tickets.filter((t) => t.status !== 'Resolved' && t.status !== 'Closed');
export const getDraft = (id: string): MockDraft => state.drafts[id] ?? {};

/* ── mutations — the ONLY way anything changes ─────────────────────────── */
export function createTicket(t: Omit<MockTicket, 'ref' | 'notes' | 'created' | 'lastUpdate' | 'status' | 'assignee'> & Partial<MockTicket>): MockTicket {
  const rec: MockTicket = {
    status: 'Open', assignee: 'End User Computing',
    created: 'just now', lastUpdate: 'just now', notes: [],
    ...t,
    ref: `INC-${nextIncident++}`,
  } as MockTicket;
  state.tickets = [...state.tickets, rec];
  emit();
  return rec;
}

export function updateTicket(ref: string, patch: Partial<MockTicket>): MockTicket | undefined {
  const t = find(ref);
  if (!t) return undefined;
  Object.assign(t, patch, { lastUpdate: 'just now' });
  emit();
  return t;
}

export function addNote(ref: string, text: string): MockTicket | undefined {
  const t = find(ref);
  if (!t) return undefined;
  t.notes = [...t.notes, { text, when: 'just now' }];
  t.lastUpdate = 'just now';
  emit();
  return t;
}

export function escalate(ref: string): MockTicket | undefined {
  const t = find(ref);
  if (!t) return undefined;
  Object.assign(t, {
    priority: 'High',
    assignee: 'EUC escalation queue',
    lastUpdate: 'just now',
  });
  t.notes = [...t.notes, { text: 'Escalated — requester and team lead notified.', when: 'just now' }];
  emit();
  return t;
}

export function closeTicket(ref: string, resolution?: string): MockTicket | undefined {
  const t = find(ref);
  if (!t) return undefined;
  Object.assign(t, {
    status: 'Closed' as const, needsYou: false, lastUpdate: 'just now',
    resolution: resolution ?? t.resolution, resolvedAgo: 'just now',
  });
  emit();
  return t;
}

export function updateDraft(id: string, patch: MockDraft): MockDraft {
  state.drafts = { ...state.drafts, [id]: { ...state.drafts[id], ...patch } };
  emit();
  return state.drafts[id];
}

/** Test/demo reset. */
export function resetTicketStore(): void {
  state = seed();
  nextIncident = 1042;
  listeners.forEach((l) => l());
}

/* ── the React bridge ──────────────────────────────────────────────────── */
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
const snapshot = () => state;
export const useTicketStore = (): StoreShape => useSyncExternalStore(subscribe, snapshot, snapshot);
