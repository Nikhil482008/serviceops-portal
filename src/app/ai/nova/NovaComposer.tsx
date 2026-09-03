import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUp, Plus, Sparkles, Mic, Paperclip, FileText, BookOpen, X, Search, Check, Pencil, Square, ChevronLeft,
} from 'lucide-react';
import {
  DOCUMENTS, KB_ARTICLES, ROLE_PROMPTS,
  type NovaContext, type NovaSource,
} from './novaSources';
import type { UserRole } from './novaSuggestions';
import { prefersReducedMotion } from './novaMotion';

/* The composer.
 *
 * A conversational space with a small capability bar under it, not a text field with a toolbar.
 * The top of the box stays EMPTY until someone types — that emptiness is the invitation, and it
 * is the first thing lost when a feature gets added by putting another control in the row.
 *
 * ── THE HIERARCHY, IN ORDER ──────────────────────────────────────────────────────────────────
 *   1. ask          the textarea, dominant, no heavy border
 *   2. add context  one entry point, "+ Files & sources", opening a menu of three
 *   3. speak        voice, which TAKES OVER the box rather than sitting beside the text
 *   4. suggest      prompts, a menu, not a permanent row of chips
 * Everything below the textarea is deliberately quiet: no filled buttons except the one primary,
 * no borders around the capabilities, no icons competing with the send action.
 *
 * ⚠️ MOCK BOUNDARIES, stated because they are invisible: there is no upload endpoint (a file
 * becomes a name and a size), no document service, no KB service, and NO SPEECH RECOGNITION — the
 * voice state produces a scripted transcript. The review step before sending is real and is the
 * part worth keeping: a transcript nobody can correct is worse than no voice at all.
 */

type Menu = null | 'sources' | 'kb' | 'docs' | 'prompts';
type Voice = null | 'listening' | 'review';

const MAX_CHIPS = 3;

export function NovaComposer({
  userRole, context, onDismissContext, onSend, disabled, seed, running, onStop,
  onAttend, onListening,
}: {
  userRole: UserRole;
  context: NovaContext | null;
  onDismissContext: () => void;
  onSend: (text: string, sources: NovaSource[]) => void;
  disabled?: boolean;
  /** "Edit query" handing a past question back. Carries a nonce so the SAME question can be sent
   *  back twice — comparing the text alone would ignore the second press. */
  seed?: { text: string; nonce: number } | null;
  /** An investigation is in flight. The send control becomes Stop. */
  running?: boolean;
  onStop?: () => void;
  /** The caret is in the box, or a picker is open. The Core leans in. */
  onAttend?: (on: boolean) => void;
  /** Voice mode is live. The Core shows LISTENING. */
  onListening?: (on: boolean) => void;
}) {
  const [text, setText] = useState('');
  const [sources, setSources] = useState<NovaSource[]>([]);
  const [menu, setMenu] = useState<Menu>(null);
  const [voice, setVoice] = useState<Voice>(null);
  const [transcript, setTranscript] = useState('');
  const [showAllSources, setShowAllSources] = useState(false);

  const boxRef = useRef<HTMLDivElement | null>(null);
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!seed) return;
    setText(seed.text);
    setVoice(null);
    requestAnimationFrame(() => {
      const el = taRef.current;
      if (!el) return;
      el.focus();
      /* Caret at the END, not over the text: this is an edit, and selecting the whole thing means
         the next keystroke destroys what they asked to edit. */
      el.setSelectionRange(el.value.length, el.value.length);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed?.nonce]);

  /* Auto-grow, but capped. A composer that grows without limit eats the conversation above it. */
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 168)}px`;
  }, [text]);

  /* One outside-click handler for every popover — four separate ones is four chances for one to
     be forgotten and left open behind the next. */
  useEffect(() => {
    if (!menu) return;
    const onDown = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setMenu(null);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenu(null); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menu]);

  const add = (s: NovaSource) => {
    setSources((prev) => (prev.some((x) => x.id === s.id) ? prev : [...prev, s]));
  };
  const remove = (id: string) => setSources((prev) => prev.filter((s) => s.id !== id));

  const ready = text.trim().length > 0 && !disabled;
  const send = () => {
    if (!ready) return;
    onSend(text.trim(), sources);
    setText('');
    setSources([]);
    setMenu(null);
  };

  // ══ voice ════════════════════════════════════════════════════════════════════════════════
  /* Scripted, and honest about it. Real recognition is a service call; what this proves is the
     SHAPE — that speech lands as editable text and is never sent unreviewed. */
  const startVoice = () => { setMenu(null); setVoice('listening'); };
  /* One fact, reported once. The Core's LISTENING state and this component's voice state are the
     same fact, so the state is lifted rather than mirrored — two copies is two chances to
     disagree about whether the microphone is on. */
  useEffect(() => { onListening?.(voice === 'listening'); }, [voice, onListening]);
  useEffect(() => () => { onListening?.(false); onAttend?.(false); }, [onAttend, onListening]);
  const stopVoice = () => {
    setTranscript(text.trim()
      || "I can't connect to the VPN after changing my password.");
    setVoice('review');
  };

  if (voice === 'listening') {
    return (
      <Shell>
        <div className="flex flex-col items-center gap-3 py-8" role="status" aria-live="polite">
          <p className="ask-text-base ask-w-500 text-[#364658]">Listening…</p>
          <Waveform />
          <p className="ask-text-sm text-[#9CA3AF]">Tell Nova what you need</p>
        </div>
        <div className="flex items-center justify-center gap-2 border-t border-[#EEF2F6] px-4 py-2.5">
          <button
            type="button"
            onClick={() => setVoice(null)}
            className="nova-btn nova-btn-ghost h-8 rounded px-3 ask-text-sm ask-w-500"
          >Cancel</button>
          <button
            type="button"
            onClick={stopVoice}
            className="nova-btn nova-btn-primary h-8 rounded px-3 ask-text-sm ask-w-500"
          >Stop &amp; send</button>
        </div>
      </Shell>
    );
  }

  if (voice === 'review') {
    return (
      <Shell>
        <div className="px-4 pb-2 pt-4">
          <p className="ask-text-xs ask-w-600 uppercase tracking-wider text-[#9CA3AF]">
            Heard this
          </p>
          {/* EDITABLE, not a confirmation dialog. Transcription is wrong often enough that a
              "did you mean" with no way to fix it just makes the user start again. */}
          <textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            rows={2}
            className="mt-1.5 w-full resize-none bg-transparent ask-text-base leading-[1.5] text-[#364658] focus:outline-none"
          />
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-[#EEF2F6] px-4 py-2.5">
          <button
            type="button"
            onClick={() => { setText(transcript); setVoice(null); requestAnimationFrame(() => taRef.current?.focus()); }}
            className="nova-btn nova-btn-ghost inline-flex h-8 items-center gap-1.5 rounded px-3 ask-text-sm ask-w-500"
          ><Pencil size={13} /> Edit</button>
          <button
            type="button"
            onClick={() => { onSend(transcript.trim(), sources); setSources([]); setTranscript(''); setVoice(null); }}
            disabled={!transcript.trim()}
            className="nova-btn nova-btn-primary inline-flex h-8 items-center gap-1.5 rounded px-3 ask-text-sm ask-w-500"
          >Send</button>
        </div>
      </Shell>
    );
  }

  // ══ the ordinary composer ════════════════════════════════════════════════════════════════
  const shown = showAllSources ? sources : sources.slice(0, MAX_CHIPS);
  const overflow = sources.length - shown.length;

  return (
    <div ref={boxRef} className="relative @container">
      <Shell>
        {/* Context, inherited and removable. Never mandatory — a chip you cannot drop is a filter
            you did not ask for. */}
        {context && (
          <div className="px-4 pt-3">
            <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-[#DDE7F5] bg-[#F2F7FD] py-1 pl-2.5 pr-1 ask-text-sm ask-w-500 text-[#2C5F8E]">
              <span className="truncate">{context.label}</span>
              <button
                type="button"
                onClick={onDismissContext}
                aria-label={`Remove context ${context.label}`}
                /* Law 2: the visible mark stays 16px so the chip does not grow, but the pressable
                   area is padded out to 24px. A dismiss you keep missing is worse than no
                   dismiss — people stop trying and live with the wrong context. */
                className="relative flex size-4 flex-shrink-0 items-center justify-center rounded-full text-[#7B9AC0] transition-colors before:absolute before:-inset-1 before:content-[''] hover:bg-[#DDE7F5]"
              ><X size={11} /></button>
            </span>
          </div>
        )}

        <textarea
          ref={taRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => onAttend?.(true)}
          onBlur={() => onAttend?.(false)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
          }}
          rows={2}
          placeholder={context ? context.placeholder : 'Ask Nova anything…'}
          disabled={disabled}
          className="block w-full resize-none bg-transparent px-4 pb-2 pt-4 ask-text-base leading-[1.55] text-[#364658] placeholder:text-[#A9B4C2] focus:outline-none"
        />

        {/* Source chips sit ABOVE the bar and stay compact — the composer must not grow tall just
            because four things were attached. */}
        {sources.length > 0 && (
          <div className="flex flex-wrap gap-1.5 px-4 pb-2">
            {shown.map((s) => (
              <Chip key={s.id} source={s} onRemove={() => remove(s.id)} />
            ))}
            {overflow > 0 && (
              <button
                type="button"
                onClick={() => setShowAllSources(true)}
                className="inline-flex h-6 items-center rounded-full border border-[#DFE5ED] bg-white px-2.5 ask-text-sm ask-w-500 text-[#7B8FA5] transition-colors hover:border-[#3D8BD0]"
              >{overflow} more</button>
            )}
            {showAllSources && sources.length > MAX_CHIPS && (
              <button
                type="button"
                onClick={() => setShowAllSources(false)}
                className="inline-flex h-6 items-center rounded-full px-2 ask-text-sm text-[#9CA3AF] hover:text-[#7B8FA5]"
              >Show fewer</button>
            )}
          </div>
        )}

        {/* The capability bar. Quiet on purpose: no borders, no fills, one primary. */}
        {/* THE CAPABILITY BAR — icons only, at every width.
            Two of these were wrapping onto a second line at 420px, which is the whole drawer.
            Labels went rather than capabilities: each is a distinct thing a person reaches for
            directly, and burying Voice behind the "+" would make a primary input mode two clicks
            — the composer brief said it must stay reachable at every width. The names survive as
            tooltips and as accessible names, so nothing is lost to a screen reader.
            The send button is icon-only too: the placeholder already says what the input is for. */}
        <div className="flex items-center gap-0.5 px-2 pb-2 pt-1">
          <Cap icon={<Plus size={15} />} label="Files &amp; sources"
            active={menu === 'sources' || menu === 'kb' || menu === 'docs'}
            onClick={() => setMenu((m) => (m ? null : 'sources'))} />
          <Cap icon={<Sparkles size={15} />} label="Prompts"
            active={menu === 'prompts'}
            onClick={() => setMenu((m) => (m === 'prompts' ? null : 'prompts'))} />
          <Cap icon={<Mic size={15} />} label="Voice" onClick={startVoice} />
          <span className="ml-auto" />
          {/* ONE control, two jobs — law 7 says one dominant action per section, and law 8 says
              it belongs where the hand already is. A separate Stop elsewhere would be a second
              primary competing with this one for the same moment. */}
          {running && onStop ? (
            <button
              type="button"
              onClick={onStop}
              aria-label="Stop"
              title="Stop"
              className="nova-btn flex size-8 flex-shrink-0 items-center justify-center rounded-full border border-[#DFE5ED] bg-white text-[var(--nova-ink-muted)] hover:border-[var(--nova-primary)] hover:text-[var(--nova-ink)]"
            >
              <Square size={11} fill="currentColor" strokeWidth={0} />
            </button>
          ) : (
            <button
              type="button"
              onClick={send}
              disabled={!ready}
              aria-label="Ask Nova"
              title="Ask Nova"
              className="nova-btn nova-btn-primary flex size-8 flex-shrink-0 items-center justify-center rounded-full"
            >
              <ArrowUp size={15} />
            </button>
          )}
        </div>
      </Shell>

      {/* ── popovers ───────────────────────────────────────────────────── */}
      {menu === 'sources' && (
        <Pop>
          <PopTitle>Add context</PopTitle>
          <MenuRow icon={<Paperclip size={14} />} title="Upload files"
            sub="Add files from your computer" onClick={() => fileRef.current?.click()} />
          <MenuRow icon={<FileText size={14} />} title="Documents"
            sub="Use documents already available in Motadata" onClick={() => setMenu('docs')} />
          <MenuRow icon={<BookOpen size={14} />} title="Knowledge Base"
            sub="Search knowledge articles" onClick={() => setMenu('kb')} />
          <p className="border-t border-[#EEF2F6] px-3 py-2 ask-text-sm leading-[1.5] text-[#9CA3AF]">
            Anything you add here is used as context when Nova answers.
          </p>
        </Pop>
      )}

      {menu === 'kb' && <KbPicker onAdd={add} chosen={sources} onBack={() => setMenu('sources')} />}
      {menu === 'docs' && <DocPicker onAdd={add} chosen={sources} onBack={() => setMenu('sources')} />}

      {menu === 'prompts' && (
        <Pop>
          <PopTitle>Suggested prompts</PopTitle>
          {/* Role comes from auth. Never a selector — a person has one role, and asking them to
              pick it is asking them to configure what the system already knows. */}
          <div className="p-1.5">
            {ROLE_PROMPTS[userRole].slice(0, 5).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => {
                  setText((t) => (t ? `${t} ${p}` : p));
                  setMenu(null);
                  requestAnimationFrame(() => taRef.current?.focus());
                }}
                className="block w-full rounded px-2 py-1.5 text-left ask-text-sm text-[#364658] transition-colors hover:bg-[#F5F7FA]"
              >{p}</button>
            ))}
          </div>
        </Pop>
      )}

      <input
        ref={fileRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          [...(e.target.files ?? [])].forEach((f) => add({
            id: `file-${f.name}-${f.size}`,
            kind: 'file',
            title: f.name,
            meta: `${Math.max(1, Math.round(f.size / 1024))} KB`,
          }));
          setMenu(null);
          e.target.value = '';
        }}
      />
    </div>
  );
}

/* ── pieces ─────────────────────────────────────────────────────────────────────────────────── */

/** The box. One large radius, a hairline, a soft lift — and no border on the text area itself. */
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-[0_1px_2px_rgba(54,70,88,0.04),0_8px_24px_-12px_rgba(54,70,88,0.12)]">
      {children}
    </div>
  );
}

function Cap({ icon, label, onClick, active }: {
  icon: React.ReactNode; label: string; onClick: () => void; active?: boolean;
}) {
  const name = label.replace('&amp;', '&');
  return (
    <button
      type="button"
      onClick={onClick}
      title={name}
      aria-label={name}
      aria-expanded={active ? true : undefined}
      className="nova-btn nova-btn-icon flex size-8 flex-shrink-0 items-center justify-center rounded-full"
    >
      {icon}
    </button>
  );
}

function Chip({ source, onRemove }: { source: NovaSource; onRemove: () => void }) {
  const Icon = source.kind === 'kb' ? BookOpen : source.kind === 'doc' ? FileText : Paperclip;
  return (
    <span className="inline-flex max-w-[190px] items-center gap-1.5 rounded-full border border-[#DFE5ED] bg-[#FAFBFC] py-1 pl-2 pr-1 ask-text-sm text-[#364658]">
      <Icon size={11} className="flex-shrink-0 text-[#9CA3AF]" />
      <span className="truncate">{source.title}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${source.title}`}
        /* Same 24px hit area as the context chip — law 16: the same gesture gets the same size. */
        className="relative flex size-4 flex-shrink-0 items-center justify-center rounded-full text-[#9CA3AF] transition-colors before:absolute before:-inset-1 before:content-[''] hover:bg-[#EEF2F6] hover:text-[#364658]"
      ><X size={10} /></button>
    </span>
  );
}

function Pop({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute bottom-full left-0 z-20 mb-2 w-[300px] max-w-[calc(100vw-48px)] overflow-hidden rounded-lg border border-[#E5E7EB] bg-white shadow-lg">
      {children}
    </div>
  );
}

function PopTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="border-b border-[#EEF2F6] px-3 py-2 ask-text-xs ask-w-600 uppercase tracking-wider text-[#9CA3AF]">
      {children}
    </p>
  );
}

function MenuRow({ icon, title, sub, onClick }: {
  icon: React.ReactNode; title: string; sub: string; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-[#F5F7FA]"
    >
      <span className="mt-0.5 flex-shrink-0 text-[#7B8FA5]">{icon}</span>
      <span className="min-w-0">
        <span className="block ask-text-sm ask-w-500 text-[#364658]">{title}</span>
        <span className="mt-0.5 block ask-text-sm leading-[1.45] text-[#9CA3AF]">{sub}</span>
      </span>
    </button>
  );
}

function PickerFrame({ title, onBack, query, setQuery, placeholder, children }: {
  title: string; onBack: () => void; query: string; setQuery: (v: string) => void;
  placeholder: string; children: React.ReactNode;
}) {
  return (
    <Pop>
      <div className="flex items-center gap-1.5 border-b border-[#EEF2F6] px-2 py-1.5">
        {/* Law 3: a bare ‹ glyph was the only non-lucide icon in this file and reads as
            punctuation. Law 2: 28px, not 24px. */}
        <button
          type="button" onClick={onBack} aria-label="Back"
          className="flex size-7 flex-shrink-0 items-center justify-center rounded text-[#9CA3AF] hover:bg-[#F3F4F6] hover:text-[#364658]"
        ><ChevronLeft size={15} /></button>
        <span className="ask-text-xs ask-w-600 uppercase tracking-wider text-[#9CA3AF]">{title}</span>
      </div>
      <div className="flex items-center gap-1.5 border-b border-[#EEF2F6] px-3 py-2">
        <Search size={13} className="flex-shrink-0 text-[#9CA3AF]" />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="min-w-0 flex-1 bg-transparent ask-text-sm text-[#364658] placeholder:text-[#A9B4C2] focus:outline-none"
        />
      </div>
      <div className="max-h-[240px] overflow-y-auto">{children}</div>
    </Pop>
  );
}

function KbPicker({ onAdd, chosen, onBack }: {
  onAdd: (s: NovaSource) => void; chosen: NovaSource[]; onBack: () => void;
}) {
  const [q, setQ] = useState('');
  const results = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return KB_ARTICLES.slice(0, 5);
    return KB_ARTICLES.filter((a) =>
      `${a.id} ${a.title} ${a.summary} ${a.category}`.toLowerCase().includes(t));
  }, [q]);

  return (
    <PickerFrame title="Knowledge Base" onBack={onBack} query={q} setQuery={setQ}
      placeholder="Search Knowledge Base…">
      {results.length === 0 && (
        <p className="px-3 py-4 text-center ask-text-sm text-[#9CA3AF]">No articles match “{q}”</p>
      )}
      {results.map((a) => {
        const added = chosen.some((s) => s.id === a.id);
        return (
          <div key={a.id} className="flex items-start gap-2 px-3 py-2 hover:bg-[#F5F7FA]">
            <span className="min-w-0 flex-1">
              <span className="block ask-text-sm ask-w-500 text-[#364658]">{a.title}</span>
              <span className="mt-0.5 block ask-text-sm leading-[1.45] text-[#9CA3AF]">{a.summary}</span>
              <span className="mt-0.5 block ask-text-xs uppercase tracking-wider text-[#B6C1CE]">
                {a.id} · {a.category}
              </span>
            </span>
            <button
              type="button"
              disabled={added}
              onClick={() => onAdd({ id: a.id, kind: 'kb', title: a.title, meta: a.id })}
              className={`mt-0.5 inline-flex h-6 flex-shrink-0 items-center gap-1 rounded-full border px-2 ask-text-sm ask-w-500 transition-colors ${
                added ? 'border-[#EEF2F6] bg-[#FAFBFC] text-[#B6C1CE]'
                  : 'border-[#DFE5ED] bg-white text-[#364658] hover:border-[#3D8BD0]'}`}
            >
              {added ? <><Check size={10} /> Added</> : '+ Add'}
            </button>
          </div>
        );
      })}
    </PickerFrame>
  );
}

function DocPicker({ onAdd, chosen, onBack }: {
  onAdd: (s: NovaSource) => void; chosen: NovaSource[]; onBack: () => void;
}) {
  const [q, setQ] = useState('');
  const results = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return DOCUMENTS;
    return DOCUMENTS.filter((d) => `${d.name} ${d.type}`.toLowerCase().includes(t));
  }, [q]);

  return (
    <PickerFrame title="Documents" onBack={onBack} query={q} setQuery={setQ}
      placeholder="Search documents…">
      {!q && (
        <p className="px-3 pb-1 pt-2 ask-text-xs ask-w-600 uppercase tracking-wider text-[#B6C1CE]">
          Recent documents
        </p>
      )}
      {results.length === 0 && (
        <p className="px-3 py-4 text-center ask-text-sm text-[#9CA3AF]">No documents match “{q}”</p>
      )}
      {results.map((d) => {
        const added = chosen.some((s) => s.id === d.id);
        return (
          <button
            key={d.id}
            type="button"
            /* Multi-select: the menu STAYS OPEN so three documents is three clicks, not three
               round trips through the menu. */
            onClick={() => onAdd({ id: d.id, kind: 'doc', title: d.name, meta: d.type })}
            className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-[#F5F7FA]"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate ask-text-sm text-[#364658]">{d.name}</span>
              <span className="mt-0.5 block ask-text-xs uppercase tracking-wider text-[#B6C1CE]">
                {d.type} · updated {d.updated}
              </span>
            </span>
            <span className={`flex size-4 flex-shrink-0 items-center justify-center rounded border ${
              added ? 'border-[#3D8BD0] bg-[#3D8BD0] text-white' : 'border-[#DFE5ED]'}`}
            >{added && <Check size={10} />}</span>
          </button>
        );
      })}
    </PickerFrame>
  );
}

/** Five bars, scaling on their own clocks. Not a real analyser — there is no audio to read — so
 *  it says "something is being heard" without pretending to visualise this particular voice. */
function Waveform() {
  const still = prefersReducedMotion();
  return (
    <div className="flex h-8 items-center gap-1" aria-hidden="true">
      {[0, 1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className={still ? 'block w-[3px] rounded-full' : 'nova-wave block w-[3px] rounded-full'}
          style={{
            height: still ? 14 : undefined,
            /* Primary, not the gradient. The gradient is the orb's identity and the orb is
               already on screen above this. */
            background: 'var(--nova-primary)',
            animationDelay: `${i * 110}ms`,
          }}
        />
      ))}
    </div>
  );
}
