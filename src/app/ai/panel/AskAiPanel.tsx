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
import { History, Plus, Send, Square, X, ArrowDown, Copy, RefreshCw, Check } from 'lucide-react';
import {
  PANEL_MAX_WIDTH, PANEL_MIN_WIDTH, PANEL_SHEET_BREAKPOINT,
  useAskAiActions, useAskAiState,
} from '../AskAiProvider';
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
  const { open, width, scope, threads } = useAskAiState();
  const { close, setWidth, setMessages, newThread } = useAskAiActions();

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

  const sheet = typeof window !== 'undefined' && window.innerWidth < PANEL_SHEET_BREAKPOINT;

  if (!open) return null;

  const empty = messages.length === 0;
  const streamingText = messages.find((m) => m.streaming)?.text ?? '';

  return (
    <aside
      role="complementary"
      aria-label="Ask AI"
      className={`fixed right-0 top-0 flex h-screen flex-col border-l border-[#e5e7eb] bg-white shadow-2xl ${Z}`}
      style={{ width: sheet ? '100vw' : width }}
    >
      {/* Drag handle. Not offered on the sheet, where the panel is the whole screen. */}
      {!sheet && (
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

      {/* header */}
      <div className="flex h-[50px] flex-shrink-0 items-center gap-2 border-b border-[#e5e7eb] px-4">
        <h2 ref={headingRef} tabIndex={-1} className="flex-shrink-0 text-[15px] font-semibold text-[#364658] outline-none">
          Ask AI
        </h2>
        <div className="ml-auto flex items-center gap-1">
          <div className="relative">
            <button
              type="button" title="Recent chats" aria-label="Recent chats" aria-expanded={showHistory}
              onClick={() => setShowHistory((v) => !v)}
              className="flex size-8 items-center justify-center rounded text-[#6B7280] transition-colors hover:bg-[#F3F4F6]"
            ><History size={16} /></button>
            {showHistory && (
              <div className="absolute right-0 top-full z-20 mt-1 w-[240px] rounded-lg border border-[#DFE5ED] bg-white py-1 shadow-lg">
                {threads.length === 0
                  ? <div className="px-3 py-2 text-[12px] text-[#9CA3AF]">No earlier chats yet.</div>
                  : threads.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => {
                        abortRef.current?.abort();
                        liveThread.current = t.id;
                        setThreadId(t.id);
                        setLocal(t.messages);
                        setShowHistory(false);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-[#364658] transition-colors hover:bg-[#F5F7FA]"
                    ><span className="min-w-0 flex-1 truncate">{t.title}</span></button>
                  ))}
              </div>
            )}
          </div>
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
          <button
            type="button" title="Close" aria-label="Close Ask AI"
            onClick={close}
            className="flex size-8 items-center justify-center rounded text-[#6B7280] transition-colors hover:bg-[#F3F4F6]"
          ><X size={16} /></button>
        </div>
      </div>

      {/* thread */}
      <div ref={scrollRef} onScroll={onScroll} className="relative min-h-0 flex-1 overflow-y-auto px-4 py-4">
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
      <div className="flex-shrink-0 border-t border-[#e5e7eb] bg-white px-4 py-3">
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
    </aside>
  );
}
