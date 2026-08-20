/* Ask AI — the shared vocabulary.
 *
 * Everything the feature passes around is named here so there is one shape per idea. The chat
 * that shipped before this module had none: its message type was an inline anonymous generic on a
 * `useState` (TicketPropertiesPanel.tsx:668), un-named and un-exported, which is why the follow-up
 * "message" that carries actions had to be pushed with an `as any`.
 */
import type { ReactNode } from 'react';

// ── messages ───────────────────────────────────────────────────────────

/** Who said it. A boolean `isUser` was the old discriminator; a union leaves room for the system
 *  notices (errors, aborts) that the old chat had no way to represent. */
export type AiRole = 'user' | 'assistant' | 'system';

export interface AiMessage {
  /** A real id. The old chat used `Date.now()`, `Date.now() + 1` and `Date.now() + 2` for three
   *  messages created in the same tick — they differed only by the offset, and the typing loop
   *  matched on it. */
  id: string;
  role: AiRole;
  /** What has arrived so far. While streaming this grows; there is no separate `displayedText` /
   *  `fullText` pair to keep in sync, because there is no pre-known full text to reveal. */
  text: string;
  /** Epoch ms, not a pre-formatted display string — formatting is the renderer's job, and a
   *  string could not be sorted or compared. */
  createdAt: number;
  /** True between the first delta and `done`. */
  streaming?: boolean;
  /** Set when this message ENDED as an error, so the thread can offer Retry against it. */
  error?: AiErrorCode;
  /** Actions the assistant proposed alongside this message. Not a separate phantom message —
   *  the old chat appended an otherwise-empty message whose in-list branch rendered `null`. */
  proposals?: AiActionProposal[];
  /** Follow-up prompts offered under this message. Strings are the payload sent on click. */
  followUps?: AiSuggestion[];
}

export interface AiThread {
  id: string;
  /** The context scope this conversation belongs to, e.g. `vulnerabilities.list` or
   *  `request:INC-32`. Two surfaces read one store; this is what keeps their threads apart —
   *  and what stops one ticket's conversation appearing in another's tab. */
  scope: string;
  /** First user message, trimmed — what the history dropdown lists. */
  title: string;
  messages: AiMessage[];
  createdAt: number;
  updatedAt: number;
}

// ── suggestions ────────────────────────────────────────────────────────

/** A suggested prompt. This is the shape `aiWelcome`'s `P(label, prompt, icon, tip)` helper
 *  already had (TicketPropertiesPanel.tsx:1072) — label for the chip, prompt for the wire. */
export interface AiSuggestion {
  /** Short, on the chip. */
  label: string;
  /** What actually gets sent. Deliberately separate: a chip reading "Root cause" should send a
   *  full question. */
  prompt: string;
  /** Optional lucide icon element. */
  icon?: ReactNode;
  /** Tooltip. */
  tip?: string;
}

// ── context ────────────────────────────────────────────────────────────

/** What a screen hands over about what the user is looking at. Captured at SEND time. */
export interface AiContextSnapshot {
  scope: string;
  label: string;
  /** The named view, e.g. "Detected Vulnerability Patches". */
  view?: string;
  activeFilters: AiContextFilter[];
  visibleColumns: string[];
  /** Only what is on screen, already redacted, already capped. */
  rows: Record<string, unknown>[];
  selectedIds: string[];
  /** How many rows exist in total — so the model knows `rows` is a window, not the world. */
  totalCount: number;
  /** Present only when rows were dropped, so the model is told rather than left to assume it has
   *  everything. */
  truncated?: { dropped: number; rule: string };
}

export interface AiContextFilter {
  field: string;
  operator: string;
  value: string | string[];
}

/** What a screen registers. One call, and the screen owns every part of it. */
export interface AiContextRegistration {
  scope: string;
  label: string;
  /** Called at send time, never on render. */
  getSnapshot: () => Omit<AiContextSnapshot, 'scope' | 'label'>;
  /** Shown on the empty state. Given the selection so a screen can answer differently when rows
   *  are picked. */
  suggestedPrompts: (selectedCount: number) => AiSuggestion[];
  actions?: AiActionDefinition[];
}

// ── actions ────────────────────────────────────────────────────────────

export type AiActionKind =
  | 'filterList'
  | 'sortList'
  | 'selectRows'
  | 'explainItem'
  | 'insertText';

/** What the model sent back. `payload` is `unknown` on purpose — it is untrusted until
 *  `validate.ts` has been over it. */
export interface AiActionProposal {
  id: string;
  kind: AiActionKind;
  payload: unknown;
}

/** What a screen can do, and how to describe it before doing it. */
export interface AiActionDefinition<P = unknown> {
  kind: AiActionKind;
  /** Turns an unvalidated payload into a typed one, or explains why it can't. Hand-rolled rather
   *  than a schema library — five shapes do not justify a runtime dependency in a repo that has
   *  none. */
  validate: (payload: unknown) => AiValidation<P>;
  /** The confirmation card's copy. Runs only on a validated payload. */
  describe: (payload: P) => { title: string; detail?: string; confirmLabel: string };
  /** Applies it. Client-side and read-only-to-the-server by design. */
  run: (payload: P) => void;
}

export type AiValidation<P> =
  | { ok: true; value: P }
  | { ok: false; reason: string };

// ── transport ──────────────────────────────────────────────────────────

export type AiErrorCode =
  | 'network'
  | 'timeout'
  | 'unauthorized'
  | 'rate_limited'
  | 'aborted'
  | 'not_configured';

/** One frame off the wire. SSE-shaped because that is the likeliest transport, but nothing
 *  downstream depends on the encoding — the adapter's job is to produce these. */
export type AiFrame =
  | { t: 'delta'; text: string }
  | { t: 'action'; action: AiActionProposal }
  | { t: 'followups'; items: AiSuggestion[] }
  | { t: 'done' }
  | { t: 'error'; code: AiErrorCode };

export interface AiSendRequest {
  messages: Pick<AiMessage, 'role' | 'text'>[];
  /** Absent when the user removed the context chip — and its absence is the whole point of that
   *  affordance, so it must not be quietly re-added downstream. */
  context?: AiContextSnapshot;
  signal?: AbortSignal;
}
