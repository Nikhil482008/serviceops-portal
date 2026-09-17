import { useSyncExternalStore } from 'react';
import type { UserRole } from './novaSuggestions';
import { titleFor } from './novaChats';

/* SAVED PROMPTS — reuse what works.
 *
 * A saved prompt is a REQUEST worth making again, named. It is not a conversation (that is a
 * chat) and it is never one of Nova's answers — only something the reader asked can be saved,
 * from beside the message they asked it in. The conversation menu in the header offers the
 * first few; choosing one puts it in the composer, never sends it.
 *
 * ── ONE STORE, PERSISTED ────────────────────────────────────────────────────────────────────
 * A module store read through `useSyncExternalStore`, persisted to localStorage — the only
 * persistence this prototype has — so a prompt survives closing Nova, a new chat and a refresh.
 *
 * ── SEEDED ONCE, THEN THE READER'S ──────────────────────────────────────────────────────────
 * With no library stored, a starter set is written for every role and persisted at once.
 *
 * ── ROLE-AWARE, NOT ROLE-SELECTED ───────────────────────────────────────────────────────────
 * A prompt carries the role of the case it reaches, set when it is saved; the reader's own come
 * first. Nobody categorises anything by hand, and there is no role picker — the role comes from
 * login.
 *
 * ── CONTEXT, LATER ──────────────────────────────────────────────────────────────────────────
 * `context` is reserved for a prompt that only makes sense with a record open ("summarise this
 * ticket"). Nothing sets it yet; when something does, the composer's context chip is where it
 * would be checked, and a prompt used outside its context should say so rather than guess.
 */

export interface SavedPrompt {
  id: string;
  name: string;
  prompt: string;
  role: UserRole | null;
  /** Reserved — see the note above. */
  context?: 'ticket' | null;
  createdAt: number;
  updatedAt: number;
}

export const PROMPTS_KEY = 'nova:savedPrompts:v1';

const DAY = 86_400_000;
let seq = 0;
const nextId = (): string => `p-${Date.now().toString(36)}-${seq++}`;

const storage = (): Storage | null => {
  try { return typeof window !== 'undefined' ? window.localStorage : null; } catch { return null; }
};

/** The starter library. Every prompt here reaches an authored case by its own words — a saved
 *  prompt that fell through to a generic answer would be a broken promise on first use. */
const seedPrompts = (): SavedPrompt[] => {
  const now = Date.now();
  const mk = (id: string, name: string, prompt: string, role: UserRole, daysAgo: number): SavedPrompt =>
    ({ id, name, prompt, role, createdAt: now - daysAgo * DAY, updatedAt: now - daysAgo * DAY });
  return [
    mk('seed-tec-shift', 'Start my shift', 'I just started my shift. What should I look at first?', 'technician', 13),
    mk('seed-tec-handover', 'Write my handover', 'Write my handover for the night shift.', 'technician', 4),
    mk('seed-tec-similar', 'Find similar incidents', 'User in Bengaluru says VPN drops every 30 minutes on the dot and reconnects fine. Ring any bells?', 'technician', 12),
    mk('seed-tec-vendors', 'Vendor-pending review', 'Which of my tickets are waiting on vendors?', 'technician', 6),
    mk('seed-req-open', 'Check my open requests', "What's still open for me right now?", 'requester', 11),
    mk('seed-req-vpn', 'Fix my VPN', 'I changed my domain password and now VPN says authentication failed. What do I do?', 'requester', 10),
    mk('seed-req-status', 'Check ticket status', 'Any update on my VPN ticket?', 'requester', 5),
    mk('seed-cxo-month', 'Monthly service summary', 'Walk me through June versus May.', 'leadership', 14),
    mk('seed-cxo-sla', 'SLA performance', 'Are we meeting our SLAs, and where do we breach most?', 'leadership', 12),
    mk('seed-cxo-hr', 'Trending HR cases', 'Show me the trending HR cases.', 'leadership', 3),
  ];
};

const load = (): SavedPrompt[] => {
  const s = storage();
  if (!s) return seedPrompts();
  try {
    const raw = s.getItem(PROMPTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed as SavedPrompt[];
    }
  } catch {
    /* A corrupt entry must not take the feature down. Losing the library is recoverable;
       failing to mount is not. */
  }
  const seeded = seedPrompts();
  try { s.setItem(PROMPTS_KEY, JSON.stringify(seeded)); } catch { /* private mode */ }
  return seeded;
};

let prompts: SavedPrompt[] = load();
const listeners = new Set<() => void>();

const commit = (next: SavedPrompt[]): void => {
  prompts = next;
  try { storage()?.setItem(PROMPTS_KEY, JSON.stringify(next)); } catch { /* quota, private mode */ }
  listeners.forEach((l) => l());
};

export const listPrompts = (): SavedPrompt[] => prompts;
export const subscribePrompts = (l: () => void): (() => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
export const usePrompts = (): SavedPrompt[] => useSyncExternalStore(subscribePrompts, listPrompts, listPrompts);

export const addPrompt = (x: { name: string; prompt: string; role: UserRole | null }): SavedPrompt => {
  const now = Date.now();
  const p: SavedPrompt = { id: nextId(), name: x.name, prompt: x.prompt, role: x.role, createdAt: now, updatedAt: now };
  commit([p, ...prompts]);
  return p;
};

/** The created date is kept — it is part of the prompt's history, and the edit is its own. */
export const updatePrompt = (id: string, x: { name: string; prompt: string }): void => {
  commit(prompts.map((p) => (p.id === id ? { ...p, name: x.name, prompt: x.prompt, updatedAt: Date.now() } : p)));
};

/** Returns what was removed, so a caller can put it back. */
export const removePrompt = (id: string): SavedPrompt | null => {
  const p = prompts.find((x) => x.id === id) ?? null;
  if (p) commit(prompts.filter((x) => x.id !== id));
  return p;
};

export const restorePrompt = (p: SavedPrompt): void => {
  if (prompts.some((x) => x.id === p.id)) return;
  commit([p, ...prompts]);
};

/** The name a prompt is offered with: the same deterministic title a chat would get. */
export const promptNameFor = (question: string): string => titleFor(question);

/** The reader's own (their role, or untagged) first; everything else after. */
export const splitPrompts = (all: SavedPrompt[], role: UserRole): { mine: SavedPrompt[]; other: SavedPrompt[] } => ({
  mine: all.filter((p) => !p.role || p.role === role),
  other: all.filter((p) => !!p.role && p.role !== role),
});
