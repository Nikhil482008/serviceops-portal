import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { X, RotateCcw } from 'lucide-react';
import { type OrbState } from './AskAiOrb';
import { NOVA_STAGE, NOVA_DUR, prefersReducedMotion, stageAt, waveReachMs } from './novaMotion';
import { NovaTurn } from './NovaTurn';
import { NovaComposer } from './NovaComposer';
import type { NovaContext, NovaSource } from './novaSources';
import { useNovaActions, useNovaConversation } from './NovaConversationProvider';
import { ROLE_SUGGESTIONS, type UserRole } from './novaSuggestions';
import { NovaGreeting } from './conversation/NovaGreeting';
import { NovaSuggestions } from './conversation/NovaSuggestions';

/* The Nova drawer.
 *
 * It renders a CONVERSATION and calls `askNova`. It does not run investigations, does not hold
 * answers, and cannot produce one — every question, from every entry point, goes through the one
 * controller entry function, and what comes back is turn state.
 *
 * ── THREE PHASES, ONE ORB ────────────────────────────────────────────────────────────────────
 *   greet     the greeting, the cards, the composer   (only while the thread is empty)
 *   clearing  160ms — greeting and cards fade and drift DOWN, the orb leaves for the header
 *   live      the thread
 *
 * The orb never swaps. `orbSlotRef` is repointed between the big centred slot and the 24px header
 * marker and the host re-seats it — so the thing that was greeting you is the thing now working.
 *
 * ⚠️ The marker slot lives in the SAME header row as the close button, which exists in every phase
 * at a fixed height. A band of its own would have added ~44px to the column exactly while the
 * greeting was mid-fade, reflowing it as it moved.
 */

interface Staged { grid: boolean; ripple: boolean; greeting: boolean; cards: number; input: boolean }
const NONE: Staged = { grid: false, ripple: false, greeting: false, cards: 0, input: false };

type Phase = 'greet' | 'clearing' | 'live';

const DEAL_FRACTION = 1 / 6;
const DEAL_MIN = 16;
const DEAL_MAX = 72;
const RIPPLE_BOX = 2.8;
const CLEAR_MS = 160;
const DISCOVERY_PULSE_MS = 520;

export function NovaDrawer({
  open, closing, onClose, userRole, orbState, orbSlotRef, now, onOrbSlotChange, onOrbState, onAttend,
  context = null,
}: {
  open: boolean;
  closing: boolean;
  onClose: () => void;
  userRole: UserRole;
  orbState: OrbState;
  orbSlotRef: React.RefObject<HTMLDivElement | null>;
  now?: Date;
  onOrbSlotChange?: () => void;
  onOrbState?: (s: OrbState | null) => void;
  /** The Core leans toward whatever is being attended to. Reported UP because the Core lives in
   *  the host's flight layer, not in this drawer. */
  onAttend?: (on: boolean) => void;
  /** Where this was opened FROM — a ticket, a dashboard. Inherited, never chosen. */
  context?: NovaContext | null;
}) {
  const { turns, skipInvestigation } = useNovaConversation();
  const {
    askNova, askFollowUp, retryTurn, stopTurn, answerAsk, respondToPlan, reset, setSkipInvestigation,
  } = useNovaActions();

  const [staged, setStaged] = useState<Staged>(NONE);
  const [phase, setPhase] = useState<Phase>(turns.length ? 'live' : 'greet');
  /* Context is inherited but not imposed: dropping it is one click and it stays dropped. */
  const [ctxOff, setCtxOff] = useState(false);
  /* "Edit query" hands a past question back to the composer. The nonce is what lets the SAME
     question be sent back twice — and it goes through the composer so editing then sending
     re-enters askNova exactly as typing does. There is no second path. */
  const [seed, setSeed] = useState<{ text: string; nonce: number } | null>(null);
  const liveContext = ctxOff ? null : context;
  /* Autoscroll follows the thread UNTIL the reader scrolls up, and resumes when they come back. */
  const [stuck, setStuck] = useState(true);
  /* Voice is the composer's state, but LISTENING is the Core's. The composer reports it up so
     one fact drives both, rather than the Core guessing from something adjacent. */
  const [listening, setListening] = useState(false);

  const panelRef = useRef<HTMLDivElement | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const greetingRef = useRef<HTMLDivElement | null>(null);
  const bigSlotRef = useRef<HTMLDivElement | null>(null);
  const markerSlotRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const pulseTimer = useRef<number | null>(null);
  const cards = ROLE_SUGGESTIONS[userRole];

  const latest = turns[turns.length - 1];
  const running = !!latest && (latest.state === 'investigating' || latest.state === 'answering');

  // ══ greeting → thread ════════════════════════════════════════════════════════════════════
  /* TWO effects, not one. The first version held both the transition and its timer in a single
     effect keyed on [turns.length, phase] — so entering `clearing` re-ran the effect, its own
     cleanup cancelled the timer it had just set, and the drawer stuck in `clearing` forever:
     greeting faded out, thread never shown.
     It only bit the paths where the drawer was ALREADY OPEN (a typed question, a suggestion
     card). A use-case row mounts the drawer with a turn already present, so it initialises
     straight to `live` and never passes through `clearing` at all — which is exactly why the
     first suite missed it. */
  useEffect(() => {
    if (!turns.length) { setPhase('greet'); return; }
    setPhase((p) => (p === 'greet' ? 'clearing' : p));
  }, [turns.length]);

  useEffect(() => {
    if (phase !== 'clearing') return;
    const t = window.setTimeout(() => setPhase('live'), stageAt(CLEAR_MS));
    return () => clearTimeout(t);
  }, [phase]);

  // ══ the entry choreography ═══════════════════════════════════════════════════════════════
  const measure = (): number | null => {
    const panel = panelRef.current;
    const slot = bigSlotRef.current;
    if (!panel || !slot) return null;
    const panelR = panel.getBoundingClientRect();
    const slotR = slot.getBoundingClientRect();
    if (!panelR.width || !panelR.height) return null;   // jsdom, or not laid out yet

    const cx = slotR.left + slotR.width / 2 - panelR.left;
    const cy = slotR.top + slotR.height / 2 - panelR.top;
    const far = Math.max(
      Math.hypot(cx, cy), Math.hypot(panelR.width - cx, cy),
      Math.hypot(cx, panelR.height - cy), Math.hypot(panelR.width - cx, panelR.height - cy),
    );
    /* Both the gradient's centre and the mask's position read these; they must be the same two
       values or the wave drifts as it grows — see theme.css. */
    panel.style.setProperty('--ripple-cx', `${((cx / panelR.width) * 100).toFixed(2)}%`);
    panel.style.setProperty('--ripple-cy', `${((cy / panelR.height) * 100).toFixed(2)}%`);
    panel.style.setProperty('--ripple-max', `${Math.ceil(far * RIPPLE_BOX)}px`);

    /* `offsetTop`, not a rect: the cards sit at their pre-entry transform right now, and a rect
       would measure where a card is being animated FROM. */
    const orbTop = slot.offsetTop + slot.offsetHeight / 2;
    cardRefs.current.forEach((el) => {
      if (!el) return;
      const d = Math.abs(el.offsetTop + el.offsetHeight / 2 - orbTop);
      el.style.setProperty('--deal', `${Math.round(Math.min(DEAL_MAX, Math.max(DEAL_MIN, d * DEAL_FRACTION)))}px`);
    });

    const g = greetingRef.current;
    if (!g) return null;
    return waveReachMs(Math.abs(g.offsetTop + g.offsetHeight / 2 - orbTop), far);
  };

  useLayoutEffect(() => {
    if (!open) { setStaged(NONE); setCtxOff(false); return; }
    if (closing) return;

    if (phase !== 'greet') {
      /* No greeting to stage: no wave, no deal-out — both are things the orb does TO the
         greeting. The ground and the composer still arrive. */
      const t = [
        window.setTimeout(() => setStaged((s) => ({ ...s, grid: true })), stageAt(NOVA_STAGE.grid)),
        window.setTimeout(() => setStaged((s) => ({ ...s, input: true })), stageAt(NOVA_STAGE.grid + 80)),
      ];
      return () => t.forEach(clearTimeout);
    }

    const waveHitsGreeting = measure();
    const timers: number[] = [];
    const at = (ms: number, fn: () => void) => timers.push(window.setTimeout(fn, stageAt(ms)));

    at(NOVA_STAGE.grid, () => setStaged((s) => ({ ...s, grid: true })));
    /* The wave is pure motion, so under reduced motion it is not scheduled at all rather than
       scheduled and then suppressed by the stylesheet — the DOM should not claim it fired. */
    if (!prefersReducedMotion()) at(NOVA_STAGE.ripple, () => setStaged((s) => ({ ...s, ripple: true })));
    at(waveHitsGreeting === null ? NOVA_STAGE.greetingFallback : NOVA_STAGE.ripple + waveHitsGreeting,
      () => setStaged((s) => ({ ...s, greeting: true })));
    cards.forEach((_, i) => at(NOVA_STAGE.cards + i * NOVA_STAGE.cardStagger,
      () => setStaged((s) => ({ ...s, cards: Math.max(s.cards, i + 1) }))));
    at(NOVA_STAGE.input, () => {
      setStaged((s) => ({ ...s, input: true }));
      /* Focus only if nobody has taken it themselves — an animation finishing is not a reason to
         move a reader's caret. */
      /* The composer owns its own textarea now, so the focus target is queried rather than held
         as a ref through a component boundary — a ref forwarded two levels for one focus() call
         is more coupling than the call is worth. Still conditional: an animation finishing is not
         a reason to move a caret the reader has already placed. */
      const a = document.activeElement;
      if (!a || a === document.body || a === panelRef.current) {
        panelRef.current?.querySelector('textarea')?.focus();
      }
    });
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, closing, cards, phase]);

  // ══ the orb ══════════════════════════════════════════════════════════════════════════════
  const slotArmed = useRef(false);
  useLayoutEffect(() => {
    if (!open) { slotArmed.current = false; return; }
    orbSlotRef.current = phase === 'greet' ? bigSlotRef.current : markerSlotRef.current;
    /* The FIRST assignment only points the ref: the entry's own schedule is already flying the
       orb from the trigger at 60ms, and asking again here would seat it on frame one. */
    if (slotArmed.current) onOrbSlotChange?.();
    slotArmed.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, open]);

  useEffect(() => {
    if (!onOrbState) return;
    /* LISTENING outranks everything: it is the only state the reader is actively CAUSING, and a
       Core that kept showing 'settled' while someone was talking to it would be saying the
       microphone is not on. */
    if (listening) { onOrbState('listening'); return; }
    if (phase === 'greet') { onOrbState('idle'); return; }
    if (latest?.state === 'error') { onOrbState('dormant'); return; }
    onOrbState(running ? 'investigating' : 'settled');
  }, [phase, running, latest?.state, listening, onOrbState]);

  /* One pulse per discovery, then back to work. Presentation only — nothing in the stream waits
     for it. Keyed on the newest turn's discovery count, so it fires as findings land. */
  const discCount = latest?.discoveries.length ?? 0;
  useEffect(() => {
    if (!onOrbState || !discCount || !running) return;
    onOrbState('discovery');
    if (pulseTimer.current) clearTimeout(pulseTimer.current);
    pulseTimer.current = window.setTimeout(
      () => onOrbState('investigating'), prefersReducedMotion() ? 0 : DISCOVERY_PULSE_MS,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [discCount]);

  useEffect(() => () => { if (pulseTimer.current) clearTimeout(pulseTimer.current); }, []);

  // ══ autoscroll ═══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const onScroll = () => {
      /* 24px of slack: a thread pinned to the very last pixel unsticks on a rounding error. */
      setStuck(el.scrollHeight - el.scrollTop - el.clientHeight < 24);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [phase]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (el && stuck) el.scrollTop = el.scrollHeight;
  }, [turns, stuck]);

  // ══ asking ═══════════════════════════════════════════════════════════════════════════════
  /* Still ONE way in. The composer collects the text and the sources; `askNova` is what turns
     either into a turn, exactly as a suggestion card or a use-case row does. */
  const submit = useCallback((q: string, sources: NovaSource[]) => {
    askNova(q, {
      context: {
        ...(liveContext ? { from: liveContext.id, fromLabel: liveContext.label } : {}),
        ...(sources.length ? { sources: sources.map((s) => `${s.kind}:${s.id}`) } : {}),
      },
    });
  }, [askNova, liveContext]);

  // ══ keyboard ═════════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }
      if (e.key !== 'Tab') return;
      const root = panelRef.current;
      if (!root) return;
      /* `tabIndex >= 0`, not "is not [disabled]": a leading `button` term re-admits every card
         that was given tabindex="-1" precisely because it has not arrived yet. */
      const f = [...root.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]')]
        .filter((el) => !el.hasAttribute('disabled') && el.tabIndex >= 0);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open && !closing) return null;

  const shown = open && !closing;
  const greetOut = phase !== 'greet';
  const rise = (on: boolean, px: number, extra = '') => ({
    className: `nova-rise ${extra}`,
    'data-in': on ? 'true' : 'false',
    style: { '--rise': `${px}px` } as React.CSSProperties,
  });

  return (
    <>
      <div
        className="nova-scrim fixed inset-0 z-[10015] bg-[#364658]/20"
        data-open={shown ? 'true' : 'false'}
        data-closing={closing ? 'true' : 'false'}
        onClick={onClose}
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Ask AI"
        className="nova-drawer fixed right-0 top-0 z-[10020] flex h-screen w-[462px] max-w-[95vw] flex-col overflow-hidden border-l border-[#e5e7eb] bg-white shadow-2xl"
        data-open={shown ? 'true' : 'false'}
        data-closing={closing ? 'true' : 'false'}
        data-phase={phase}
      >
        <div className="nova-grid pointer-events-none absolute inset-0" data-in={staged.grid ? 'true' : 'false'} />
        <div className="nova-ripple pointer-events-none absolute inset-0" data-in={staged.ripple ? 'true' : 'false'} />

        {/* Fixed-height header in every phase. */}
        <div className="relative flex items-center gap-2.5 px-4 pt-3">
          <div
            ref={markerSlotRef}
            className="size-6 flex-shrink-0"
            style={{ opacity: phase === 'greet' ? 0 : 1 }}
            aria-hidden="true"
          />
          {/* A LABEL, not the question. The question is rendered directly beneath this, in the
              thread, where it belongs — printing it twice spent the header on nothing. */}
          {phase !== 'greet' && (
            <p className="nova-t-head nova-feed-in min-w-0 flex-1 truncate">Ask Nova</p>
          )}
          <div className="ml-auto flex flex-shrink-0 items-center gap-0.5">
            {/* ⚠️ DEV ONLY — REMOVE BEFORE ANY PRODUCTION BUILD.
                It was sitting between the answer and the composer, which is the most valuable
                strip in the drawer. Here it is a header affordance: reachable for a demo,
                out of the reading column. */}
            <button
              type="button"
              onClick={() => setSkipInvestigation(!skipInvestigation)}
              aria-pressed={skipInvestigation}
              title="Dev only · skip the investigation"
              aria-label="Dev only: skip the investigation"
              className={`nova-btn flex size-8 items-center justify-center rounded ask-text-sm ask-w-600 ${
                skipInvestigation
                  ? 'bg-[#FBF2E3] text-[#7A5200]'
                  : 'nova-btn-ghost text-[var(--nova-ink-faint)]'}`}
            >DEV</button>
            {phase !== 'greet' && (
              <button
                type="button"
                onClick={() => { reset(); setPhase('greet'); }}
                aria-label="New chat"
                title="New chat"
                className="flex size-8 items-center justify-center rounded text-[#7B8FA5] transition-colors hover:bg-[#F3F4F6] hover:text-[#364658]"
              ><RotateCcw size={15} /></button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex size-8 items-center justify-center rounded text-[#7B8FA5] transition-colors hover:bg-[#F3F4F6] hover:text-[#364658]"
            ><X size={16} /></button>
          </div>
        </div>

        <div ref={scrollerRef} className="relative flex min-h-0 flex-1 flex-col overflow-y-auto px-6 pb-2">
          {/* The greeting stays MOUNTED through `clearing` so its fade has something to fade. */}
          {phase !== 'live' && (
            <div className={`m-auto w-full ${greetOut ? 'pointer-events-none' : ''}`}>
              <div ref={bigSlotRef} className="mx-auto size-[120px] flex-shrink-0" aria-hidden="true" />

              {/* WHO IS HERE — identity demoted to an eyebrow, the greeting promoted to the
                  hero. See NovaGreeting for why, and for why there is no fabricated
                  "you have 3 tickets approaching SLA" line under it. */}
              <div ref={greetingRef} {...rise(staged.greeting, 8, 'mt-6')} data-out={greetOut ? 'true' : 'false'}>
                <NovaGreeting userRole={userRole} now={now} context={null} />
              </div>

              {/* WHAT YOU COULD ASK — four one-line rows, dealt from behind the Core. */}
              <NovaSuggestions
                userRole={userRole}
                staged={staged.cards}
                out={greetOut}
                onAsk={(prompt) => askNova(prompt)}
                rowRef={(el, i) => { cardRefs.current[i] = el; }}
              />
            </div>
          )}

          {/* The thread. Every turn keeps its own steps, findings and answer; a new one appends. */}
          {/* ONE rhythm unit between turns, and the same unit inside them — see --nova-gap.
              `pt-4`: the header carries no divider, so this gap is the only thing separating it
              from the reader's first message — 4px left the question looking stuck to the chrome.
              A comment cannot live between `&& (` and the element: that position must be the one
              expression the conditional returns. */}
          {phase === 'live' && (
            <div className="pt-4" style={{ display: 'grid', rowGap: 'var(--nova-gap-turn)' }}>
              {turns.map((t, i) => (
                <NovaTurn
                  key={t.id}
                  turn={t}
                  live={i === turns.length - 1}
                  onFollowUp={askFollowUp}
                  onEditQuery={(q) => setSeed({ text: q, nonce: Date.now() })}
                  onRetry={() => retryTurn(t.id)}
                  onRegenerate={() => retryTurn(t.id, true)}
                  onAnswerAsk={(askId, answers, done) => answerAsk(t.id, askId, answers, done)}
                  onPlanRespond={(id, payload) => respondToPlan(t.id, id, payload)}
                />
              ))}
            </div>
          )}
        </div>

        <div {...rise(staged.input, 0, 'relative bg-white px-3 pb-3 pt-1')}>
          <NovaComposer
            userRole={userRole}
            context={liveContext}
            onDismissContext={() => setCtxOff(true)}
            onSend={submit}
            seed={seed}
            onAttend={onAttend}
            onListening={setListening}
            /* Law 15 (cancel) and law 6 (never wonder whether it registered): while a turn is
               running the send control becomes STOP, in the same place, because the place your
               hand is already on is the place the escape hatch has to be. */
            running={running}
            onStop={latest ? () => stopTurn(latest.id) : undefined}
          />
        </div>
      </div>
    </>
  );
}

export const NOVA_EXIT_MS = NOVA_DUR.exit;
export { prefersReducedMotion };
