/* The docked Ask AI panel.
 *
 * A right-side dock, NOT a modal: the point is to keep reading the table while the assistant
 * works, so there is no scrim and the page behind stays clickable. Shell borrows
 * MinimizedDrawerRail's scrim-less dock and AiComponentDrawer's resize logic — the two existing
 * pieces this is made of.
 *
 * KNOWN DEVIATION, approved: the main content does not shrink. Doing that means either extracting
 * an AppShell across ~23 page files or adding padding to each of them, and the 14 detail drawers
 * hardcode `window.innerWidth - 54` so a full-width drawer will still paint over this panel.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown, Minus, PanelRight, PictureInPicture2, Plus, Send, Square, X,
  ArrowDown, Copy, RefreshCw, Check,
} from 'lucide-react';
import {
  FLOAT_H, FLOAT_W, PANEL_MAX_WIDTH, PANEL_MIN_WIDTH, PANEL_SHEET_BREAKPOINT,
  clampFloat, useAskAiActions, useAskAiState,
} from '../AskAiProvider';
import { AskAiModeMenu } from './AskAiModeMenu';
import { AskAiMinimized } from './AskAiMinimized';
import { aiClient } from '../client/aiClient';
import { AI_ERROR_RETRYABLE, AI_ERROR_TEXT } from '../client/errors';
import { AiRichText } from '../components/AiRichText';
import { AiSuggestionChip } from '../components/AiSuggestionChip';
import type { AiErrorCode, AiMessage, AiSuggestion } from '../types';

/* Above the drawer stack (z-50) and its side panels (10000–10010), below the shortcuts
   cheat-sheet (10050) and global search (11000). */
const Z = 'z-[10020]';

const GENERIC_PROMPTS: AiSuggestion[] = [
  { label: 'What can you do?', prompt: 'What can you help me with here?' },
  { label: 'Summarise this page', prompt: 'Summarise what is on this page' },
];

let idSeq = 0;
const nextId = () => `m${Date.now().toString(36)}-${idSeq++}`;

export default function AskAiPanel() {
  const { open, width, mode, minimized, floatPos, scope, threads } = useAskAiState();
  const { close, setWidth, setMode, setMinimized, setFloatPos, setMessages, newThread } = useAskAiActions();
  const [showModes, setShowModes] = useState(false);

  /* The thread this panel is showing, by ID. It used to be found by scanning `threads` for the
     first entry with a matching scope — which meant New chat could mint one and the scan could
     still land on the previous one, leaving the old conversation on screen. */
  const initial = useMemo(() => threads.find((t) => t.scope === scope), [threads, scope]);
  const [threadId, setThreadId] = useState<string>(() => initial?.id ?? `t-${Date.now()}`);
  const [messages, setLocal] = useState<AiMessage[]>(initial?.messages ?? []);
  const [draft, setDraft] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [contextOn, setContextOn] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  /* The thread currently on screen. `runSend` compares against this before every write, so a
     stream that finishes after the user has moved on is discarded rather than restoring what
     they just cleared. A ref, not state: it is a guard, not something to render. */
  const liveThread = useRef(threadId);
  liveThread.current = threadId;
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const headingRef = useRef<HTMLHeadingElement | null>(null);

  /* Auto-scroll, but only while the user is at the bottom. The moment they scroll up to read
     something, following the stream would yank it away from them. */
  const [pinned, setPinned] = useState(true);
  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setPinned(el.scrollHeight - el.scrollTop - el.clientHeight < 40);
  }, []);
  useEffect(() => {
    if (pinned) scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, pinned]);

  /* Focus moves in on open; AskAiProvider.close() puts it back on whatever opened the panel. */
  useEffect(() => {
    if (open) requestAnimationFrame(() => (taRef.current ?? headingRef.current)?.focus?.());
  }, [open]);

  /* Persist to the provider so the conversation survives navigation. Local state is the working
     copy — writing every token straight to the provider would re-render every consumer. */
  useEffect(() => {
    if (messages.length) setMessages(threadId, scope, messages);
  }, [messages, threadId, scope, setMessages]);

  const stop = useCallback(() => { abortRef.current?.abort(); }, []);

  const runSend = useCallback(async (text: string, history: AiMessage[]) => {
    const controller = new AbortController();
    abortRef.current = controller;
    setStreaming(true);

    /* Every write below goes through this. Once the panel is showing a different thread, the
       answer still finishes arriving but stops being written anywhere. */
    const startedOn = liveThread.current;
    const writeIfCurrent = (next: AiMessage[]) => {
      if (liveThread.current === startedOn) setLocal(next);
    };

    const assistantId = nextId();
    writeIfCurrent([...history, { id: assistantId, role: 'assistant', text: '', createdAt: Date.now(), streaming: true }]);

    let acc = '';
    let followUps: AiSuggestion[] | undefined;
    let failed: AiErrorCode | undefined;

    try {
      for await (const frame of aiClient.send({
        messages: [...history, { role: 'user', text }].map((m) => ({ role: m.role, text: m.text })),
        /* Absent when the chip is removed, and that absence is the whole point of the affordance
           — removing it must genuinely change what gets sent, not just hide a chip.
           PLACEHOLDER until the context registry lands: a real snapshot (visible rows, filters,
           selection, redacted and capped) replaces this. What is here now carries no row data at
           all — only which screen is open. */
        context: contextOn
          ? { scope, label: scope, activeFilters: [], visibleColumns: [], rows: [], selectedIds: [], totalCount: 0 }
          : undefined,
        signal: controller.signal,
      })) {
        if (frame.t === 'delta') {
          acc += frame.text;
          writeIfCurrent([...history, { id: assistantId, role: 'assistant', text: acc, createdAt: Date.now(), streaming: true }]);
        } else if (frame.t === 'followups') {
          followUps = frame.items;
        } else if (frame.t === 'error') {
          failed = frame.code;
        }
      }
    } catch {
      failed = 'network';
    }

    setStreaming(false);
    abortRef.current = null;
    writeIfCurrent([...history, {
      id: assistantId, role: 'assistant',
      /* An aborted answer keeps whatever arrived — it is still the assistant's words, and
         throwing them away punishes the user for stopping. */
      text: acc, createdAt: Date.now(), streaming: false,
      error: failed, followUps,
    }]);
  }, [contextOn]);

  const submit = useCallback((text: string) => {
    const t = text.trim();
    if (!t || streaming) return;
    const history: AiMessage[] = [...messages, { id: nextId(), role: 'user', text: t, createdAt: Date.now() }];
    setLocal(history);
    setDraft('');
    setPinned(true);
    void runSend(t, history);
  }, [messages, streaming, runSend]);

  const retry = useCallback(() => {
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    if (!lastUser) return;
    const upto = messages.slice(0, messages.findIndex((m) => m.id === lastUser.id) + 1);
    setLocal(upto);
    void runSend(lastUser.text, upto);
  }, [messages, runSend]);

  /* ── drag, floating mode only ─────────────────────────────────────
   *
   * Grabbing the header moves the window. The offset between the pointer and the window's corner
   * is captured on mousedown, so the window does not jump to centre itself under the cursor. */
  const [dragging, setDragging] = useState(false);
  const dragOff = useRef({ x: 0, y: 0 });
  useEffect(() => {
    if (!dragging) return undefined;
    const move = (e: MouseEvent) => setFloatPos({ x: e.clientX - dragOff.current.x, y: e.clientY - dragOff.current.y });
    const up = () => setDragging(false);
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
    document.body.style.userSelect = 'none';
    return () => {
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
      document.body.style.userSelect = '';
    };
  }, [dragging, setFloatPos]);

  /* A floating window pinned near the right edge would hang off-screen after the browser is made
     narrower, with its header out of reach. Re-clamp on resize. */
  useEffect(() => {
    if (mode !== 'floating') return undefined;
    const onResize = () => setFloatPos(clampFloat(floatPos.x, floatPos.y));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [mode, floatPos, setFloatPos]);

  /* ── resize ──────────────────────────────────────────────────────── */
  const [resizing, setResizing] = useState(false);
  useEffect(() => {
    if (!resizing) return undefined;
    const move = (e: MouseEvent) =>
      setWidth(Math.min(PANEL_MAX_WIDTH, Math.max(PANEL_MIN_WIDTH, window.innerWidth - e.clientX)));
    const up = () => setResizing(false);
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';
    return () => {
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [resizing, setWidth]);

  /* Below the tablet breakpoint every mode collapses to a full-height sheet. A 420px floating
     window on a 600px screen is not a floating window, it is the screen. */
  const sheet = typeof window !== 'undefined' && window.innerWidth < PANEL_SHEET_BREAKPOINT;
  const effective: 'sidebar' | 'floating' | 'fullscreen' = sheet ? 'fullscreen' : mode;

  if (!open) return null;

  if (minimized) {
    return (
      <AskAiMinimized
        onRestore={() => setMinimized(false)}
        subtitle={messages.find((m) => m.role === 'user')?.text.slice(0, 40)}
      />
    );
  }

  /* One shell, three geometries. Everything inside — header, thread, composer — is identical in
     all three; only the box changes, which is what keeps the modes from drifting into three
     slightly different assistants. */
  const shell = {
    sidebar: 'fixed right-0 top-0 h-screen border-l border-[#e5e7eb] shadow-2xl',
    floating: 'fixed rounded-xl border border-[#DFE5ED] shadow-2xl overflow-hidden',
    fullscreen: 'fixed inset-0 h-screen w-screen',
  }[effective];

  const shellStyle = effective === 'sidebar'
    ? { width: sheet ? '100vw' : width }
    : effective === 'floating'
      ? { left: floatPos.x, top: floatPos.y, width: FLOAT_W, height: FLOAT_H }
      : undefined;

  const empty = messages.length === 0;
  const streamingText = messages.find((m) => m.streaming)?.text ?? '';

  return (
    <aside
      role="complementary"
      aria-label="Ask AI"
      data-mode={effective}
      className={`flex flex-col bg-white ${shell} ${Z}`}
      style={shellStyle}
    >
      {/* Edge resize belongs to the docked mode only. The floating window has a fixed size and is
          moved instead; full screen has nothing to resize against. */}
      {effective === 'sidebar' && !sheet && (
        <div
          onMouseDown={(e) => { e.preventDefault(); setResizing(true); }}
          className="group absolute bottom-0 left-0 top-0 z-10 w-3 cursor-ew-resize"
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize Ask AI panel"
        >
          <div className={`absolute bottom-0 left-0 top-0 w-px transition-colors ${resizing ? 'bg-[#3D8BD0]' : 'bg-transparent group-hover:bg-[#3D8BD0]'}`} />
        </div>
      )}

      {/* header
          Draggable in floating mode, and only there — a grab cursor on a docked panel would
          promise a move that cannot happen. Buttons stop the drag from starting so clicking one
          never nudges the window. */}
      <div
        onMouseDown={(e) => {
          if (effective !== 'floating') return;
          if ((e.target as HTMLElement).closest('button')) return;
          dragOff.current = { x: e.clientX - floatPos.x, y: e.clientY - floatPos.y };
          setDragging(true);
        }}
        className={`flex h-[50px] flex-shrink-0 items-center gap-1 border-b border-[#e5e7eb] px-4 ${
          effective === 'floating' ? (dragging ? 'cursor-grabbing' : 'cursor-grab') : ''
        }`}
      >
        {/* The title IS the thread switcher, as it is in the reference — one affordance for
            "which conversation am I in" rather than a label plus a history icon saying the same. */}
        <div className="relative min-w-0">
          <button
            type="button"
            onClick={() => { setShowHistory((v) => !v); setShowModes(false); }}
            aria-expanded={showHistory}
            aria-haspopup="menu"
            className="flex min-w-0 items-center gap-1 rounded px-1 py-0.5 text-[15px] font-semibold text-[#364658] transition-colors hover:bg-[#F3F4F6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3D8BD0]"
          >
            <h2 ref={headingRef} tabIndex={-1} className="min-w-0 truncate outline-none">
              {messages.length === 0 ? 'New chat' : (threads.find((t) => t.id === threadId)?.title || 'Ask AI')}
            </h2>
            <ChevronDown size={15} className="flex-shrink-0 text-[#7B8FA5]" />
          </button>
          {showHistory && (
            <div role="menu" className="absolute left-0 top-full z-30 mt-1 w-[260px] rounded-lg border border-[#DFE5ED] bg-white py-1 shadow-lg">
              {threads.length === 0
                ? <div className="px-3 py-2 text-[12px] text-[#9CA3AF]">No earlier chats yet.</div>
                : threads.map((t) => (
                  <button
                    key={t.id}
                    role="menuitemradio"
                    aria-checked={t.id === threadId}
                    onClick={() => {
                      abortRef.current?.abort();
                      liveThread.current = t.id;
                      setThreadId(t.id);
                      setLocal(t.messages);
                      setShowHistory(false);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-[#364658] transition-colors hover:bg-[#F5F7FA]"
                  >
                    <span className="min-w-0 flex-1 truncate">{t.title}</span>
                    {t.id === threadId && <Check size={13} className="flex-shrink-0 text-[#3D8BD0]" />}
                  </button>
                ))}
            </div>
          )}
        </div>

        <div className="ml-auto flex flex-shrink-0 items-center gap-1">
          <button
            type="button" title="New chat" aria-label="New chat"
            onClick={() => {
              /* Stop anything in flight first: its answer is for the thread being left. */
              abortRef.current?.abort();
              /* Point the panel at a fresh id BEFORE clearing, so the persist effect that fires
                 on the cleared array writes to the new thread and cannot overwrite the old one. */
              const fresh = newThread(scope);
              liveThread.current = fresh;
              setThreadId(fresh);
              setLocal([]);
              setDraft('');
              setContextOn(true);
            }}
            className="flex size-8 items-center justify-center rounded text-[#6B7280] transition-colors hover:bg-[#F3F4F6]"
          ><Plus size={16} /></button>

          {/* Layout. The trigger shows the mode you are IN, so the header answers the question
              without opening anything. */}
          <div className="relative">
            <button
              type="button"
              title="Panel layout" aria-label="Panel layout"
              aria-haspopup="menu" aria-expanded={showModes}
              onClick={() => { setShowModes((v) => !v); setShowHistory(false); }}
              className={`flex size-8 items-center justify-center rounded transition-colors hover:bg-[#F3F4F6] ${showModes ? 'bg-[#F3F4F6] text-[#364658]' : 'text-[#6B7280]'}`}
            >
              {effective === 'floating' ? <PictureInPicture2 size={16} />
                : effective === 'fullscreen' ? <Square size={15} />
                  : <PanelRight size={16} />}
            </button>
            {showModes && (
              <AskAiModeMenu mode={mode} onPick={setMode} onClose={() => setShowModes(false)} />
            )}
          </div>

          <button
            type="button" title="Minimise" aria-label="Minimise Ask AI"
            onClick={() => setMinimized(true)}
            className="flex size-8 items-center justify-center rounded text-[#6B7280] transition-colors hover:bg-[#F3F4F6]"
          ><Minus size={16} /></button>

          <button
            type="button" title="Close" aria-label="Close Ask AI"
            onClick={close}
            className="flex size-8 items-center justify-center rounded text-[#6B7280] transition-colors hover:bg-[#F3F4F6]"
          ><X size={16} /></button>
        </div>
      </div>

      {/* thread */}
      {/* In full screen the thread is centred and capped. 13px body text set across a 2,500px
          window is not readable — a measure is the whole reason a wide mode needs different
          treatment rather than just more room. The docked and floating modes are already narrow
          enough that a cap would do nothing, so `mx-auto` on a max-width is a no-op there. */}
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className={`relative min-h-0 flex-1 overflow-y-auto py-4 ${
          effective === 'fullscreen' ? 'px-6' : 'px-4'
        }`}
      >
       <div className={effective === 'fullscreen' ? 'mx-auto w-full max-w-[720px]' : ''}>
        {empty ? (
          <div className="flex h-full flex-col justify-center">
            <p className="mb-1 text-[14px] font-semibold text-[#364658]">How can I help?</p>
            <p className="mb-4 text-[12px] leading-relaxed text-[#7B8FA5]">
              I can read what is on this page and answer questions about it.
            </p>
            <div className="flex flex-col gap-2">
              {GENERIC_PROMPTS.map((p) => (
                <AiSuggestionChip
                  key={p.label} variant="block" tipSide="left"
                  label={p.label} tip={p.prompt}
                  onClick={() => submit(p.prompt)}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((m) => (
              <div key={m.id} className="group/msg">
                {m.role === 'user' ? (
                  <div className="flex justify-end">
                    <div className="max-w-[85%] rounded-lg rounded-br-sm px-3 py-2" style={{ background: 'rgba(223, 229, 237, 0.40)' }}>
                      <p className="text-[13px] leading-relaxed text-[#364658]">{m.text}</p>
                    </div>
                  </div>
                ) : (
                  <div className="min-w-0">
                    {m.text ? <AiRichText text={m.text} /> : null}

                    {/* Before the first token. A spinner that appears after text has started would
                        be saying something already visible. */}
                    {m.streaming && !m.text && (
                      <div className="flex items-center gap-1.5 py-1" aria-label="Thinking">
                        {[0, 150, 300].map((d) => (
                          <span
                            key={d}
                            className="size-1.5 animate-pulse rounded-full bg-[#CBD5E1] motion-reduce:animate-none"
                            style={{ animationDelay: `${d}ms` }}
                          />
                        ))}
                      </div>
                    )}

                    {m.error && (
                      <div className="mt-2 rounded border border-[#FEE2E2] bg-[#FEF3F2] px-3 py-2">
                        <p className="text-[12px] leading-relaxed text-[#B42318]">{AI_ERROR_TEXT[m.error]}</p>
                        {AI_ERROR_RETRYABLE[m.error] && (
                          <button
                            onClick={retry}
                            className="mt-1.5 inline-flex items-center gap-1 rounded text-[12px] font-medium text-[#B42318] underline underline-offset-2"
                          ><RefreshCw size={11} /> Retry</button>
                        )}
                      </div>
                    )}

                    {m.followUps?.length ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {m.followUps.map((f) => (
                          <AiSuggestionChip key={f.label} label={f.label} tip={f.prompt} onClick={() => submit(f.prompt)} />
                        ))}
                      </div>
                    ) : null}

                    {!m.streaming && m.text && (
                      <div className="mt-1 flex items-center gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover/msg:opacity-100">
                        <button
                          title="Copy" aria-label="Copy message"
                          onClick={() => {
                            navigator.clipboard?.writeText(m.text).then(
                              () => { setCopiedId(m.id); setTimeout(() => setCopiedId(null), 1600); },
                              () => {},
                            );
                          }}
                          className="flex size-7 items-center justify-center rounded text-[#6B7280] hover:bg-[#F3F4F6]"
                        >{copiedId === m.id ? <Check size={12} className="text-[#22A06B]" /> : <Copy size={12} />}</button>
                        <button
                          title="Retry" aria-label="Retry this answer" onClick={retry}
                          className="flex size-7 items-center justify-center rounded text-[#6B7280] hover:bg-[#F3F4F6]"
                        ><RefreshCw size={12} /></button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

       </div>

        {/* Streaming text announced politely and THROTTLED — the live region carries the answer so
            far, updated per delta rather than per character, so a screen reader is not read a
            word-at-a-time stutter. */}
        <div className="sr-only" aria-live="polite" aria-atomic="true">{streamingText}</div>
      </div>

      {!pinned && messages.length > 0 && (
        <button
          onClick={() => { setPinned(true); scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }); }}
          className="absolute bottom-[108px] left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full border border-[#DFE5ED] bg-white px-3 py-1.5 text-[12px] font-medium text-[#364658] shadow-md hover:bg-[#F9FAFB]"
        ><ArrowDown size={12} /> Jump to latest</button>
      )}

      {/* composer */}
      <div className={`flex-shrink-0 border-t border-[#e5e7eb] bg-white py-3 ${effective === 'fullscreen' ? 'px-6' : 'px-4'}`}>
       <div className={effective === 'fullscreen' ? 'mx-auto w-full max-w-[720px]' : ''}>
        {contextOn && (
          <div className="mb-2 flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1.5 rounded-sm bg-[#F1F5F9] px-2 py-1 text-[11px] text-[#364658]">
              Page context
              <button
                onClick={() => setContextOn(false)}
                aria-label="Remove page context"
                title="Ask without this page's context"
                className="text-[#7B8FA5] hover:text-[#364658]"
              ><X size={11} /></button>
            </span>
          </div>
        )}
        <div className="flex items-end gap-2 rounded-lg border border-[#DFE5ED] px-2.5 py-2 focus-within:border-[#3D8BD0]">
          <textarea
            ref={taRef}
            rows={1}
            value={draft}
            placeholder="Ask about this page…"
            onChange={(e) => {
              setDraft(e.target.value);
              /* Grow to ~6 lines, then scroll. Reset first or the box only ever gets taller. */
              e.target.style.height = 'auto';
              e.target.style.height = `${Math.min(e.target.scrollHeight, 132)}px`;
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(draft); }
            }}
            className="max-h-[132px] min-h-[20px] flex-1 resize-none bg-transparent text-[13px] leading-relaxed text-[#364658] outline-none placeholder:text-[#9CA3AF]"
          />
          {streaming ? (
            <button
              type="button" onClick={stop} title="Stop" aria-label="Stop generating"
              className="flex size-7 flex-shrink-0 items-center justify-center rounded bg-[#364658] text-white transition-colors hover:bg-[#111827]"
            ><Square size={11} fill="currentColor" /></button>
          ) : (
            <button
              type="button" onClick={() => submit(draft)} disabled={!draft.trim()}
              title="Send" aria-label="Send"
              className="flex size-7 flex-shrink-0 items-center justify-center rounded bg-[#3D8BD0] text-white transition-colors hover:bg-[#2F7AB8] disabled:cursor-not-allowed disabled:bg-[#E5E7EB] disabled:text-[#9CA3AF]"
            ><Send size={12} /></button>
          )}
        </div>
        <p className="mt-1.5 text-[11px] text-[#9CA3AF]">
          Enter to send · Shift+Enter for a new line
        </p>
       </div>
      </div>
    </aside>
  );
}
