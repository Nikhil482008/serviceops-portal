import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUp, Plus, Mic, Paperclip, FileText, BookOpen, X, Search, Check, Pencil, Square, ChevronLeft,
} from 'lucide-react';
import {
  DOCUMENTS, KB_ARTICLES,
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
 * There was a fourth — "enhance", which rewrote what was typed. It is gone: a control that
 * rewrites your sentence and then asks you to read the rewrite is a second thing to read before
 * you have finished writing the first.
 * Everything below the textarea is deliberately quiet: no filled buttons except the one primary,
 * no borders around the capabilities, no icons competing with the send action.
 *
 * ⚠️ MOCK BOUNDARIES, stated because they are invisible: there is no upload endpoint (a file
 * becomes a name and a size), no document service, no KB service, and NO SPEECH RECOGNITION — the
 * voice state produces a scripted transcript. The review step before sending is real and is the
 * part worth keeping: a transcript nobody can correct is worse than no voice at all.
 */

type Menu = null | 'sources' | 'kb' | 'docs';
type Voice = null | 'listening' | 'review';

const MAX_CHIPS = 3;

export function NovaComposer({
  userRole, context, onDismissContext, onSend, disabled, seed, running, onStop,
  onAttend, onListening, placeholder, escBlurs, bare, autoFocus, onDraft,
}: {
  userRole: UserRole;
  context: NovaContext | null;
  onDismissContext: () => void;
  onSend: (text: string, sources: NovaSource[]) => void;
  disabled?: boolean;
  /** "Edit query" handing a past question back. Carries a nonce so the SAME question can be sent
   *  back twice — comparing the text alone would ignore the second press. */
  seed?: { text: string; nonce: number;
    /** THIS DRAFT IS NOT THEIRS. A seed the reader asked for by pressing a button — "Change the
     *  plan" — arrives as text nobody typed, so Escape takes it away again rather than only
     *  blurring. An "Edit query" seed is the reader's own sentence handed back and is not
     *  clearable: Escape there would delete what they asked to edit. */
    clearable?: boolean;
    /** SELECT IT, do not park the caret after it. A correction is about to be REPLACED; an
     *  edit is about to be continued. The two seeds want opposite things from the same box. */
    selectAll?: boolean } | null;
  /** An investigation is in flight. The send control becomes Stop. */
  running?: boolean;
  onStop?: () => void;
  /** The caret is in the box, or a picker is open. The Core leans in. */
  onAttend?: (on: boolean) => void;
  /** Voice mode is live. The Core shows LISTENING. */
  onListening?: (on: boolean) => void;
  /** What the empty box says. The drawer sets "Anything else?" when the dock has nothing left. */
  placeholder?: string;
  /** Escape in the box blurs it rather than closing the drawer — the dock's keyboard contract,
   *  where "/" is the way in and Esc the way out. */
  escBlurs?: boolean;
  /** DRAW NO SHELL. The dock's own container is the box in the composer morph — see
   *  RequesterDock — so the border, the radius and the shadow are already on screen and a second
   *  set inside them would be a box in a box. */
  bare?: boolean;
  /** Take the caret on mount. The band opens BECAUSE the reader asked to type. */
  autoFocus?: boolean;
  /** Every keystroke. The dock takes this seat when the options are shown, which unmounts the
   *  box — so whatever was half-typed has to be held somewhere that outlives it. */
  onDraft?: (t: string) => void;
}) {
  const Shell = useMemo(() => makeShell(bare), [bare]);
  const [text, setText] = useState('');
  /* Set while the box holds a seeded draft the reader can dismiss, cleared the moment they edit
     it — once a word of it is theirs, Escape is back to meaning "leave the box". */
  const [clearable, setClearable] = useState(false);
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
    setClearable(!!seed.clearable);
    setVoice(null);
    requestAnimationFrame(() => {
      const el = taRef.current;
      if (!el) return;
      el.focus();
      /* Caret at the END for an edit — selecting the whole thing would mean the next keystroke
         destroys what they asked to edit. A CORRECTION is the opposite: it is there to be
         replaced, and having to clear it first is a step nobody wanted. */
      if (seed.selectAll) el.select();
      else el.setSelectionRange(el.value.length, el.value.length);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed?.nonce]);

  useEffect(() => { onDraft?.(text); }, [text, onDraft]);

  /* THE BOX OPENS BECAUSE SOMEONE ASKED TO TYPE, so the caret is already where they meant it to
     be. Only on mount: re-focusing on every render would fight the reader for the caret. */
  useEffect(() => {
    if (!autoFocus) return;
    const id = requestAnimationFrame(() => taRef.current?.focus());
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          <p className="ask-text-base ask-w-500 text-[var(--nova-text-primary)]">Listening…</p>
          <Waveform />
          <p className="ask-text-sm text-[var(--nova-text-muted)]">Tell Nova what you need</p>
        </div>
        <div className="flex items-center justify-center gap-2 border-t border-[var(--nova-border)] px-4 py-2.5">
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
          <p className="ask-text-xs ask-w-600 uppercase tracking-wider text-[var(--nova-text-muted)]">
            Heard this
          </p>
          {/* EDITABLE, not a confirmation dialog. Transcription is wrong often enough that a
              "did you mean" with no way to fix it just makes the user start again. */}
          <textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            rows={2}
            className="mt-1.5 w-full resize-none bg-transparent ask-text-base leading-[1.5] text-[var(--nova-text-primary)] focus:outline-none"
          />
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-[var(--nova-border)] px-4 py-2.5">
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
            <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-[var(--nova-border)] bg-[var(--nova-surface-subtle)] py-1 pl-2.5 pr-1 ask-text-sm ask-w-500 text-[var(--nova-text-secondary)]">
              <span className="truncate">{context.label}</span>
              <button
                type="button"
                onClick={onDismissContext}
                aria-label={`Remove context ${context.label}`}
                /* Law 2: the visible mark stays 16px so the chip does not grow, but the pressable
                   area is padded out to 24px. A dismiss you keep missing is worse than no
                   dismiss — people stop trying and live with the wrong context. */
                className="relative flex size-4 flex-shrink-0 items-center justify-center rounded-full text-[var(--nova-text-muted)] transition-colors before:absolute before:-inset-1 before:content-[''] hover:bg-[var(--nova-border)]"
              ><X size={11} /></button>
            </span>
          </div>
        )}

        <textarea
          ref={taRef}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (clearable) setClearable(false);
          }}
          onFocus={() => onAttend?.(true)}
          onBlur={() => onAttend?.(false)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
            /* Stopped here, or the drawer's own Escape listener would close the whole thing. */
            else if (e.key === 'Escape' && clearable) {
              /* A draft the reader never typed: Escape removes it AND leaves the box, so one key
                 undoes one press. */
              e.preventDefault(); e.stopPropagation();
              setText(''); setClearable(false); e.currentTarget.blur();
            } else if (e.key === 'Escape' && escBlurs) { e.preventDefault(); e.stopPropagation(); e.currentTarget.blur(); }
          }}
          rows={2}
          placeholder={placeholder ?? (context ? context.placeholder : 'Ask Nova anything…')}
          disabled={disabled}
          className="block w-full resize-none bg-transparent px-4 pb-2 pt-4 ask-text-base leading-[1.55] text-[var(--nova-text-primary)] placeholder:text-[var(--nova-text-muted)] focus:outline-none"
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
                className="inline-flex h-6 items-center rounded-full border border-[var(--nova-border)] bg-white px-2.5 ask-text-sm ask-w-500 text-[var(--nova-text-secondary)] transition-colors hover:border-[var(--nova-border-strong)]"
              >{overflow} more</button>
            )}
            {showAllSources && sources.length > MAX_CHIPS && (
              <button
                type="button"
                onClick={() => setShowAllSources(false)}
                className="inline-flex h-6 items-center rounded-full px-2 ask-text-sm text-[var(--nova-text-muted)] hover:text-[var(--nova-text-secondary)]"
              >Show fewer</button>
            )}
          </div>
        )}

        {/* THE CAPABILITY BAR — quiet on purpose: no borders, no fills, one primary. — icons only, at every width.
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
          {/* NO ENHANCE. It rewrote the reader's words and then asked them to check the rewrite —
              a second thing to read before you have finished writing the first. The bar is the
              two things you reach for WHILE composing (add context, speak it) and the one that
              sends. See novaEnhance.ts, which is now unused and kept only as a record. */}
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
              className="nova-btn flex size-8 flex-shrink-0 items-center justify-center rounded-full border border-[var(--nova-border)] bg-white text-[var(--nova-ink-muted)] hover:border-[var(--nova-primary)] hover:text-[var(--nova-ink)]"
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
          <p className="border-t border-[var(--nova-border)] px-3 py-2 ask-text-sm leading-[1.5] text-[var(--nova-text-muted)]">
            Anything you add here is used as context when Nova answers.
          </p>
        </Pop>
      )}

      {menu === 'kb' && <KbPicker onAdd={add} chosen={sources} onBack={() => setMenu('sources')} />}
      {menu === 'docs' && <DocPicker onAdd={add} chosen={sources} onBack={() => setMenu('sources')} />}


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

/** The box. A 14px radius, a hairline, a soft lift — and no border on the text area itself.
 *  Focus-within is VISIBLE now: the accent border and a 3px accent-bg ring (`.nova-shell`). It
 *  used to darken the hairline one step, which nobody saw. */
function makeShell(bare?: boolean) {
  return function Shell({ children }: { children: React.ReactNode }) {
    return bare
      ? <div data-composer-shell="bare">{children}</div>
      : <div className="nova-shell" data-composer-shell>{children}</div>;
  };
}

function Cap({ icon, label, onClick, active, disabled }: {
  icon: React.ReactNode; label: string; onClick: () => void; active?: boolean; disabled?: boolean;
}) {
  const name = label.replace('&amp;', '&');
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={name}
      aria-label={name}
      aria-expanded={active ? true : undefined}
      className="nova-btn nova-btn-icon flex size-8 flex-shrink-0 items-center justify-center rounded-full disabled:opacity-35"
    >
      {icon}
    </button>
  );
}

function Chip({ source, onRemove }: { source: NovaSource; onRemove: () => void }) {
  const Icon = source.kind === 'kb' ? BookOpen : source.kind === 'doc' ? FileText : Paperclip;
  return (
    <span className="inline-flex max-w-[190px] items-center gap-1.5 rounded-full border border-[var(--nova-border)] bg-[var(--nova-surface-subtle)] py-1 pl-2 pr-1 ask-text-sm text-[var(--nova-text-primary)]">
      <Icon size={11} className="flex-shrink-0 text-[var(--nova-text-muted)]" />
      <span className="truncate">{source.title}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${source.title}`}
        /* Same 24px hit area as the context chip — law 16: the same gesture gets the same size. */
        className="relative flex size-4 flex-shrink-0 items-center justify-center rounded-full text-[var(--nova-text-muted)] transition-colors before:absolute before:-inset-1 before:content-[''] hover:bg-[var(--nova-border)] hover:text-[var(--nova-text-primary)]"
      ><X size={10} /></button>
    </span>
  );
}

function Pop({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute bottom-full left-0 z-20 mb-2 w-[300px] max-w-[calc(100vw-48px)] overflow-hidden rounded-lg border border-[var(--nova-border)] bg-white shadow-lg">
      {children}
    </div>
  );
}

function PopTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="border-b border-[var(--nova-border)] px-3 py-2 ask-text-xs ask-w-600 uppercase tracking-wider text-[var(--nova-text-muted)]">
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
      className="flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-[var(--nova-surface-hover)]"
    >
      <span className="mt-0.5 flex-shrink-0 text-[var(--nova-text-secondary)]">{icon}</span>
      <span className="min-w-0">
        <span className="block ask-text-sm ask-w-500 text-[var(--nova-text-primary)]">{title}</span>
        <span className="mt-0.5 block ask-text-sm leading-[1.45] text-[var(--nova-text-muted)]">{sub}</span>
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
      <div className="flex items-center gap-1.5 border-b border-[var(--nova-border)] px-2 py-1.5">
        {/* Law 3: a bare ‹ glyph was the only non-lucide icon in this file and reads as
            punctuation. Law 2: 28px, not 24px. */}
        <button
          type="button" onClick={onBack} aria-label="Back"
          className="flex size-7 flex-shrink-0 items-center justify-center rounded text-[var(--nova-text-muted)] hover:bg-[var(--nova-surface-hover)] hover:text-[var(--nova-text-primary)]"
        ><ChevronLeft size={15} /></button>
        <span className="ask-text-xs ask-w-600 uppercase tracking-wider text-[var(--nova-text-muted)]">{title}</span>
      </div>
      <div className="flex items-center gap-1.5 border-b border-[var(--nova-border)] px-3 py-2">
        <Search size={13} className="flex-shrink-0 text-[var(--nova-text-muted)]" />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="min-w-0 flex-1 bg-transparent ask-text-sm text-[var(--nova-text-primary)] placeholder:text-[var(--nova-text-muted)] focus:outline-none"
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
        <p className="px-3 py-4 text-center ask-text-sm text-[var(--nova-text-muted)]">No articles match “{q}”</p>
      )}
      {results.map((a) => {
        const added = chosen.some((s) => s.id === a.id);
        return (
          <div key={a.id} className="flex items-start gap-2 px-3 py-2 hover:bg-[var(--nova-surface-hover)]">
            <span className="min-w-0 flex-1">
              <span className="block ask-text-sm ask-w-500 text-[var(--nova-text-primary)]">{a.title}</span>
              <span className="mt-0.5 block ask-text-sm leading-[1.45] text-[var(--nova-text-muted)]">{a.summary}</span>
              <span className="mt-0.5 block ask-text-xs uppercase tracking-wider text-[var(--nova-text-muted)]">
                {a.id} · {a.category}
              </span>
            </span>
            <button
              type="button"
              disabled={added}
              onClick={() => onAdd({ id: a.id, kind: 'kb', title: a.title, meta: a.id })}
              className={`mt-0.5 inline-flex h-6 flex-shrink-0 items-center gap-1 rounded-full border px-2 ask-text-sm ask-w-500 transition-colors ${
                added ? 'border-[var(--nova-border)] bg-[var(--nova-surface-subtle)] text-[var(--nova-text-muted)]'
                  : 'border-[var(--nova-border)] bg-white text-[var(--nova-text-primary)] hover:border-[var(--nova-border-strong)]'}`}
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
        <p className="px-3 pb-1 pt-2 ask-text-xs ask-w-600 uppercase tracking-wider text-[var(--nova-text-muted)]">
          Recent documents
        </p>
      )}
      {results.length === 0 && (
        <p className="px-3 py-4 text-center ask-text-sm text-[var(--nova-text-muted)]">No documents match “{q}”</p>
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
            className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-[var(--nova-surface-hover)]"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate ask-text-sm text-[var(--nova-text-primary)]">{d.name}</span>
              <span className="mt-0.5 block ask-text-xs uppercase tracking-wider text-[var(--nova-text-muted)]">
                {d.type} · updated {d.updated}
              </span>
            </span>
            <span className={`flex size-4 flex-shrink-0 items-center justify-center rounded border ${
              added ? 'border-[var(--nova-action)] bg-[var(--nova-action)] text-white' : 'border-[var(--nova-border)]'}`}
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
