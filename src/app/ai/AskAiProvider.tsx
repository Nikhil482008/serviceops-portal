/* Ask AI — the one place the feature's state lives.
 *
 * Mounted once in App.tsx, above every page. That matters for two reasons beyond tidiness:
 *
 *  1. The rail button is rendered by `Sidebar`, which each of the ~23 list pages mounts for
 *     itself. A button that reached the panel by prop-drilling would have to be threaded through
 *     all of them; as a descendant of this provider it just calls a hook.
 *
 *  2. Conversations survive navigation. The chat that shipped before this lived in component
 *     state inside the ticket drawer, so it was destroyed when the drawer minimised — and
 *     DrawerStackProvider auto-minimises on navigation, which means walking to another module
 *     silently threw the conversation away. Threads live here instead, keyed by scope.
 *
 * SPLIT CONTEXTS, deliberately. Everything that changes while the assistant works (open, width,
 * threads, streaming text) is in one context; everything stable (the functions that change it) is
 * in another. A consumer that only dispatches — the rail button, for instance — subscribes to a
 * value that never changes identity, so a streaming response cannot re-render it. This is what
 * keeps the Vulnerabilities table still while an answer streams; a single context would re-render
 * every consumer on every token.
 */
import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
  type ReactNode,
} from 'react';
import { isAskAiEnabled } from './flags';
import type { AiMessage, AiThread } from './types';

// ── width ──────────────────────────────────────────────────────────────

export const PANEL_DEFAULT_WIDTH = 420;
export const PANEL_MIN_WIDTH = 360;
export const PANEL_MAX_WIDTH = 720;
/** Below this the panel stops being a dock and becomes a full-height sheet. */
export const PANEL_SHEET_BREAKPOINT = 768;

const WIDTH_KEY = 'askAi:panelWidth';

const readStoredWidth = () => {
  if (typeof window === 'undefined') return PANEL_DEFAULT_WIDTH;
  const raw = Number(window.localStorage.getItem(WIDTH_KEY));
  if (!Number.isFinite(raw) || raw <= 0) return PANEL_DEFAULT_WIDTH;
  /* Clamped on the way OUT as well as in. A width persisted on a wide monitor must not open a
     720px panel on a laptop, and a stored value from an older build must not escape the range. */
  return Math.min(PANEL_MAX_WIDTH, Math.max(PANEL_MIN_WIDTH, Math.round(raw)));
};

// ── state ──────────────────────────────────────────────────────────────

interface AskAiState {
  open: boolean;
  width: number;
  /** The scope whose thread is showing, e.g. `vulnerabilities.list`. */
  scope: string;
  threads: AiThread[];
}

interface AskAiActions {
  open: () => void;
  close: () => void;
  toggle: () => void;
  setWidth: (w: number) => void;
  setScope: (scope: string) => void;
  /** Replaces the active thread's messages. The panel owns the streaming loop; this is how it
   *  writes results back. */
  setMessages: (scope: string, messages: AiMessage[]) => void;
  newThread: (scope: string) => void;
  selectThread: (id: string) => void;
}

const StateCtx = createContext<AskAiState | null>(null);
const ActionsCtx = createContext<AskAiActions | null>(null);

/** Where focus returns when the panel closes. Held as a ref rather than state because moving
 *  focus is not a render concern, and storing it in state would re-render every consumer the
 *  moment the panel opened. */
const openerRef: { current: HTMLElement | null } = { current: null };
export const rememberOpener = (el: HTMLElement | null) => { openerRef.current = el; };

const THREADS_KEY = 'askAi:threads';
/** How many conversations the history dropdown keeps. */
const MAX_THREADS = 10;

const loadThreads = (): AiThread[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(THREADS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.slice(0, MAX_THREADS) : [];
  } catch {
    /* A corrupt or half-written entry must not take the whole feature down with it. Losing the
       history is recoverable; failing to mount is not. */
    return [];
  }
};

export function AskAiProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [width, setWidthState] = useState(readStoredWidth);
  const [scope, setScopeState] = useState('app');
  const [threads, setThreads] = useState<AiThread[]>(loadThreads);

  /* Persist width on change, not on drag — the resize handler writes here once on mouseup. */
  const setWidth = useCallback((w: number) => {
    const clamped = Math.min(PANEL_MAX_WIDTH, Math.max(PANEL_MIN_WIDTH, Math.round(w)));
    setWidthState(clamped);
    try { window.localStorage.setItem(WIDTH_KEY, String(clamped)); } catch { /* private mode */ }
  }, []);

  const persistThreads = useCallback((next: AiThread[]) => {
    setThreads(next);
    try { window.localStorage.setItem(THREADS_KEY, JSON.stringify(next.slice(0, MAX_THREADS))); } catch { /* quota */ }
  }, []);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => {
    setIsOpen(false);
    /* Focus goes back where it came from. Without this a keyboard user who opens the panel with
       the shortcut and closes it with Escape is dropped at the top of the document. */
    openerRef.current?.focus?.();
  }, []);
  const toggle = useCallback(() => setIsOpen((v) => !v), []);

  const setScope = useCallback((s: string) => setScopeState(s), []);

  const setMessages = useCallback((s: string, messages: AiMessage[]) => {
    setThreads((prev) => {
      const now = Date.now();
      const idx = prev.findIndex((t) => t.scope === s);
      const title = messages.find((m) => m.role === 'user')?.text.slice(0, 60) ?? 'New chat';
      const next = [...prev];
      if (idx >= 0) next[idx] = { ...next[idx], messages, title, updatedAt: now };
      else next.unshift({ id: `t-${now}`, scope: s, title, messages, createdAt: now, updatedAt: now });
      const trimmed = next.slice(0, MAX_THREADS);
      try { window.localStorage.setItem(THREADS_KEY, JSON.stringify(trimmed)); } catch { /* quota */ }
      return trimmed;
    });
  }, []);

  const newThread = useCallback((s: string) => {
    persistThreads([
      { id: `t-${Date.now()}`, scope: s, title: 'New chat', messages: [], createdAt: Date.now(), updatedAt: Date.now() },
      ...threads.filter((t) => t.scope !== s || t.messages.length > 0),
    ].slice(0, MAX_THREADS));
  }, [threads, persistThreads]);

  const selectThread = useCallback((id: string) => {
    const t = threads.find((x) => x.id === id);
    if (t) setScopeState(t.scope);
  }, [threads]);

  /* ── the global shortcut ──────────────────────────────────────────────
   *
   * Ctrl/⌘+J. Verified unbound in this app: the only Ctrl/⌘ chords taken are K (global search),
   * F and Shift+F (the graph canvases), and a dead Ctrl+B inside a never-imported shadcn file.
   * The house style is Alt-based — DrawerShortcuts explains why (Ctrl+W/Tab/L are browser
   * reserved) — and Ctrl+J IS the browser's Downloads shortcut in Chrome, Edge and Firefox, so
   * preventDefault is doing real work here rather than being defensive.
   *
   * Keyed off `e.code`, like every other global handler in this codebase, because Alt and some
   * layouts change `e.key` out from under you.
   */
  const toggleRef = useRef(toggle);
  toggleRef.current = toggle;
  const closeRef = useRef(close);
  closeRef.current = close;
  const openRef = useRef(isOpen);
  openRef.current = isOpen;

  useEffect(() => {
    if (!isAskAiEnabled()) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyJ' && !e.altKey && !e.shiftKey) {
        e.preventDefault();
        /* Remember where focus was so closing can put it back — the shortcut can be pressed from
           anywhere, so the rail button is not necessarily the opener. */
        if (!openRef.current) rememberOpener(document.activeElement as HTMLElement | null);
        toggleRef.current();
        return;
      }
      /* Escape closes, but only when the panel owns the interaction. Menus and dropdowns inside
         it stop the event themselves; this is the outermost handler. */
      if (e.key === 'Escape' && openRef.current) closeRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const state = useMemo<AskAiState>(
    () => ({ open: isOpen, width, scope, threads }),
    [isOpen, width, scope, threads],
  );

  /* Every function here is `useCallback`-stable, so this object's identity never changes after
     mount — which is the entire point of the split. `newThread` and `selectThread` close over
     `threads`, so they are excluded from that guarantee and the memo lists them honestly. */
  const actions = useMemo<AskAiActions>(
    () => ({ open, close, toggle, setWidth, setScope, setMessages, newThread, selectThread }),
    [open, close, toggle, setWidth, setScope, setMessages, newThread, selectThread],
  );

  return (
    <ActionsCtx.Provider value={actions}>
      <StateCtx.Provider value={state}>{children}</StateCtx.Provider>
    </ActionsCtx.Provider>
  );
}

/** Volatile. Subscribing to this re-renders on every token of a streaming answer — only the
 *  panel itself should. */
export function useAskAiState(): AskAiState {
  const v = useContext(StateCtx);
  if (!v) throw new Error('useAskAiState must be used inside <AskAiProvider>');
  return v;
}

/** Stable. Safe for anything outside the panel — the rail button uses only this. */
export function useAskAiActions(): AskAiActions {
  const v = useContext(ActionsCtx);
  if (!v) throw new Error('useAskAiActions must be used inside <AskAiProvider>');
  return v;
}

/* The two below return null instead of throwing, so a component can call them UNCONDITIONALLY
 * and decide afterwards whether to render. That distinction matters: `Sidebar` is mounted by ~23
 * pages and by test harnesses, not all of which wrap it in this provider, and the alternative —
 * calling the throwing hooks behind a boolean — is a Rules-of-Hooks violation that happens to
 * work only because the provider never appears or disappears mid-mount. */

/** Volatile, absent-tolerant. Null when there is no provider above. */
export function useAskAiStateOptional(): AskAiState | null {
  return useContext(StateCtx);
}

/** Stable, absent-tolerant. Null when there is no provider above. */
export function useAskAiActionsOptional(): AskAiActions | null {
  return useContext(ActionsCtx);
}
