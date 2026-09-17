import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { type OrbState } from './NovaOrb';
import { NOVA_STAGE, NOVA_DUR, prefersReducedMotion, stageAt, waveReachMs } from './novaMotion';
import { NovaTurn } from './NovaTurn';
import { MODIFY_COMMAND, planPending } from './turnModel';
import { toast } from 'sonner';
import { NovaComposer } from './NovaComposer';
import type { NovaContext, NovaSource } from './novaSources';
import { useNovaActions, useNovaConversation } from './NovaConversationProvider';
import { ROLE_SUGGESTIONS, type UserRole } from './novaSuggestions';
import { NovaGreeting } from './conversation/NovaGreeting';
import { NovaSuggestions } from './conversation/NovaSuggestions';
import { NovaHeader } from './conversation/NovaHeader';
import { NovaChatHistory } from './conversation/NovaChatHistory';
import { NovaDeletePrompt, NovaPromptDialog } from './conversation/NovaPromptDialog';
import { addPrompt, promptNameFor, removePrompt, updatePrompt, type SavedPrompt } from './novaPrompts';
import { caseIdFor, roleOfCase } from './novaChats';
import { RequesterDock, type ComposerSeat } from './dock/RequesterDock';
import { clearCompose, useComposeRequest } from './dock/composeRequest';
import { nextStepsFor, type DockEnv, type NextStep } from './dock/nextSteps';
import { useDockStore } from './dock/proposals';
import { useTicketStore } from './mockTickets';
import { TechAskChips } from './tech/TechAskChips';
import { useTechActions } from './tech/useTechActions';
import { clearFocus, useTechStore } from './tech/techStore';

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
 * The orb never swaps. `orbSlotRef` is repointed between the big centred slot and the 18px seat
 * in the header and the host re-seats it — so the thing that was greeting you is the thing now
 * sitting in the header, still, as the way back home.
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
  onOrbStill, onRoleChange, context = null,
}: {
  open: boolean;
  closing: boolean;
  onClose: () => void;
  userRole: UserRole;
  orbState: OrbState;
  orbSlotRef: React.RefObject<HTMLElement | null>;
  now?: Date;
  onOrbSlotChange?: () => void;
  onOrbState?: (s: OrbState | null) => void;
  /** The Core leans toward whatever is being attended to. Reported UP because the Core lives in
   *  the host's flight layer, not in this drawer. */
  onAttend?: (on: boolean) => void;
  /** Where this was opened FROM — a ticket, a dashboard. Inherited, never chosen. */
  context?: NovaContext | null;
  /** The orb holds STILL while it sits in the header. Reported up like its state, because the
   *  one orb lives in the host's flight layer. */
  onOrbStill?: (still: boolean) => void;
  /** DEV ONLY — the dev-tools role switcher. Absent in production, where the role is login's. */
  onRoleChange?: (role: UserRole) => void;
}) {
  const { turns, activeChatId, chats } = useNovaConversation();
  const {
    askNova, askFollowUp, retryTurn, stopTurn, answerAsk, respondToPlan, modifyPlan,
    newChat, openChat, saveChat, renameChat, deleteChat, restoreChat,
  } = useNovaActions();

  const [staged, setStaged] = useState<Staged>(NONE);
  const [phase, setPhase] = useState<Phase>(turns.length ? 'live' : 'greet');
  /* Context is inherited but not imposed: dropping it is one click and it stays dropped. */
  const [ctxOff, setCtxOff] = useState(false);
  /* "Edit query" hands a past question back to the composer. The nonce is what lets the SAME
     question be sent back twice — and it goes through the composer so editing then sending
     re-enters askNova exactly as typing does. There is no second path. */
  const [seed, setSeed] = useState<{ text: string; nonce: number; clearable?: boolean; selectAll?: boolean } | null>(null);
  const liveContext = ctxOff ? null : context;
  /* Autoscroll follows the thread UNTIL the reader scrolls up, and resumes when they come back. */
  const [stuck, setStuck] = useState(true);
  /* Voice is the composer's state, but LISTENING is the Core's. The composer reports it up so
     one fact drives both, rather than the Core guessing from something adjacent. */
  const [listening, setListening] = useState(false);
  /* THE HEADER'S STATE. `scrolled` gives the sticky header its rule and blur once the thread is
     beneath it; `wide` is the expanded drawer; `promptDraft` is the Save-prompt dialog, opened
     from beside a message. */
  const [scrolled, setScrolled] = useState(false);
  const [wide, setWide] = useState(false);
  const [promptDraft, setPromptDraft] = useState<{ mode: 'save' | 'edit'; id?: string; name: string; prompt: string } | null>(null);
  const [promptDelete, setPromptDelete] = useState<SavedPrompt | null>(null);
  /* THE FULL CHAT HISTORY, over the panel's whole height. `historyQ` is whatever the shelf's
     search had in it when Show all was pressed — carried, not asked for twice. */
  const [history, setHistory] = useState(false);
  const [historyQ, setHistoryQ] = useState('');
  const historyRef = useRef(false);
  historyRef.current = history;

  const panelRef = useRef<HTMLDivElement | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const greetingRef = useRef<HTMLDivElement | null>(null);
  const bigSlotRef = useRef<HTMLDivElement | null>(null);
  const markerSlotRef = useRef<HTMLElement | null>(null);
  const cardRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const pulseTimer = useRef<number | null>(null);
  const cards = ROLE_SUGGESTIONS[userRole];

  const latest = turns[turns.length - 1];
  /* THE PERSONA. A use-case row IS its persona — a CXO row is leadership, a TEC row a technician,
     a REQ row a requester — whatever the stub role says; the role decides only for a thread with
     no case in it (a typed question). The stub defaults to technician, which is how every
     requester case was reading as a technician until the REQ rule was added beside the other two.
     Leadership reads the Command Centre; technicians the linear feed's dense variant; everyone
     else the linear feed, and the Next-step dock. */
  const requesterCase = turns.some((t) => t.caseId?.startsWith('REQ-'));
  const technicianCase = turns.some((t) => t.caseId?.startsWith('TEC-'));
  const leadership = turns.some((t) => t.caseId?.startsWith('CXO-'))
    || (userRole === 'leadership' && !requesterCase && !technicianCase);
  const technician = !leadership && (technicianCase || (userRole === 'technician' && !requesterCase));
  const requester = !leadership && !technician;
  /* PARKED IS NOT RUNNING — the same distinction the turn header draws, drawn here too. A turn
     waiting on a plan leaves `state` at 'investigating' because the stream really is still open,
     and the composer read that as work in flight and offered STOP. Stop what? Nothing is
     happening; the reader is the thing that has not moved. Same root cause as the black cube in
     the gutter, in a second place. */
  const running = !!latest && (latest.state === 'investigating' || latest.state === 'answering')
    && !planPending(latest);

  // ══ the next-step dock ═══════════════════════════════════════════════════════════════════
  /* DERIVED ON EVERY RENDER from the turns, the ticket store and the dock store — never kept.
     The env is how an option opens a turn: `ask` as a chip did, `navigate` as a reply whose
     chosen line stands where the question would. Both remember the turn they opened so focus
     can follow its headline once it lands. */
  const [dockH, setDockH] = useState(0);
  /* WHAT OVERLAYS THE THREAD, measured. The requester's dock is in FLOW now — it sits in the
     input's own seat, so it cannot cover a message and needs no padding. What is still over the
     thread is the fade the seat sits on (and, for a technician, the ask-chips floating on it),
     and the scroll area pads by exactly that, re-read whenever it changes and whenever the
     drawer is resized. Never a constant: the chips wrap at narrow widths. */
  const overlayRef = useRef<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    const el = overlayRef.current;
    if (!el) { setDockH(0); return; }
    const read = () => setDockH(Math.ceil(el.getBoundingClientRect().height));
    read();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(read) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  });
  const pendingFocus = useRef<string | null>(null);
  const tickets = useTicketStore();
  const dockSnap = useDockStore();
  const dockEnv = useMemo<DockEnv>(() => ({
    ask: (label, caseId) => { pendingFocus.current = askNova(label, { caseId }) ?? null; },
    navigate: (label, caseId, n, ref) => {
      pendingFocus.current = askNova(label, { caseId, context: { chosen: { n, label }, ...(ref ? { ref } : {}) } }) ?? null;
    },
  }), [askNova]);
  const steps = useMemo<NextStep[]>(
    () => (requester ? nextStepsFor({ turns, dock: dockSnap }, dockEnv) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `tickets` is the store's snapshot: a new one means re-derive
    [requester, turns, dockSnap, dockEnv, tickets],
  );
  /* Not while an investigation runs — it would be offering the LAST turn's steps under a
     question that is still being answered. Not when there is nothing left to offer either:
     then the input says "Anything else?" instead. */
  const dockShown = phase === 'live' && !history && requester && !running && steps.length > 0;
  const dockEmpty = phase === 'live' && requester && !running && steps.length === 0;

  /* "NOT WHAT I MEANT?" — the reading was wrong and the reader is about to say it again. The
     original message goes back into the box SELECTED, because the next thing they type is meant
     to replace it. The dock, if one is up, has already opened the composer for it to land in. */
  const compose = useComposeRequest();
  const composeSeen = useRef(compose?.nonce);
  useEffect(() => {
    if (!compose || compose.nonce === composeSeen.current) return;
    composeSeen.current = compose.nonce;
    setSeed({ text: compose.text, nonce: compose.nonce, selectAll: true });
    clearCompose();
  }, [compose]);

  /* FOCUS FOLLOWS THE RESULT. An ask or navigate option opened a turn; once that turn has its
     answer, focus lands on the answer's headline — the reader hears the conclusion, not the
     input. */
  useEffect(() => {
    const id = pendingFocus.current;
    if (!id) return;
    const t = turns.find((x) => x.id === id);
    if (!t || (t.state !== 'answering' && t.state !== 'settled')) return;
    pendingFocus.current = null;
    requestAnimationFrame(() => {
      panelRef.current?.querySelector<HTMLElement>(`[data-turn="${id}"] .nova-headline`)?.focus();
    });
  }, [turns]);
  // ══ the technician's ask-chips ═══════════════════════════════════════════════════════════
  /* THE SAME SELECTOR the attached do-actions use, for the newest turn — so what the reader can
     ASK and what they can DO are two halves of one set rather than two lists that drift. */
  const techSet = useTechActions(technician ? latest : undefined);
  const techStore = useTechStore();
  const askChips = techSet?.asks ?? [];
  const chipsShown = phase === 'live' && !history && !running && askChips.length > 0;

  /* FOCUS FOLLOWS AN ACTION'S REPLY. The action asked for it when it opened the turn; once the
     answer lands, focus goes to its headline and the request is cleared. */
  useEffect(() => {
    const id = techStore.focusTurn;
    if (!id) return;
    const t = turns.find((x) => x.id === id);
    if (!t || (t.state !== 'answering' && t.state !== 'settled')) return;
    clearFocus();
    requestAnimationFrame(() => {
      panelRef.current?.querySelector<HTMLElement>(`[data-turn="${id}"] .nova-headline`)?.focus();
    });
  }, [turns, techStore.focusTurn]);

  /* An in-turn action (a card's confirm, a close from a status card) produces no new answer;
     focus lands on the chosen line it left beneath the one it acted on. */
  const onDockRan = useCallback((s: NextStep) => {
    if (s.kind !== 'mutate') return;
    requestAnimationFrame(() => {
      const lines = panelRef.current?.querySelectorAll<HTMLElement>(`[data-turn="${s.turnId}"] [data-chosen-line]`);
      lines?.[lines.length - 1]?.focus();
    });
  }, []);

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
    /* The greeting's 120px slot only exists while the greeting does — the history replaces it,
       so the orb flies to the header seat exactly as it does on the way to a thread. */
    orbSlotRef.current = phase === 'greet' && !history ? bigSlotRef.current : markerSlotRef.current;
    /* The FIRST assignment only points the ref: the entry's own schedule is already flying the
       orb from the trigger at 60ms, and asking again here would seat it on frame one. */
    if (slotArmed.current) onOrbSlotChange?.();
    slotArmed.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, open, history]);

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

  /* Seated in the header, the orb is STILL — no drift, no pulse. Reported like its state; the
     hosts pass it to the one orb. */
  useEffect(() => { onOrbStill?.(phase === 'live' || history); }, [phase, history, onOrbStill]);
  /* The expanded drawer comes back at its normal width next time it opens. */
  useEffect(() => { if (!open) setWide(false); }, [open]);

  // ══ autoscroll ═══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const onScroll = () => {
      /* 24px of slack: a thread pinned to the very last pixel unsticks on a rounding error.
         Not while the history is up: scrolling a list of chats is not the reader leaving the
         thread's tail, and it must not switch the thread's autoscroll off behind their back. */
      if (!history) setStuck(el.scrollHeight - el.scrollTop - el.clientHeight < 24);
      /* The sticky header earns its rule and blur only once something is beneath it. */
      setScrolled(el.scrollTop > 0);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [phase, history]);

  /* A list opens at its top, whatever the thread underneath was scrolled to. */
  useEffect(() => {
    const el = scrollerRef.current;
    if (history && el) { el.scrollTop = 0; setScrolled(false); }
  }, [history]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (el && stuck) el.scrollTop = el.scrollHeight;
  }, [turns, stuck]);

  // ══ asking ═══════════════════════════════════════════════════════════════════════════════
  /* Still ONE way in. The composer collects the text and the sources; `askNova` is what turns
     either into a turn, exactly as a suggestion card or a use-case row does. */
  const submit = useCallback((q: string, sources: NovaSource[]) => {
    /* `/modify plan <change>` is not a question — it is a revision of the plan the thread is
       parked on. It goes to that plan and opens no turn; the revised plan arrives in place with
       its diff and the request echoed above it. */
    /* No word boundary after the prefix: it ends in a colon, and a boundary between ':' and
       the space that follows is never true. The prefix is matched as the literal it is. */
    if (q.toLowerCase().startsWith(MODIFY_COMMAND.toLowerCase())) {
      if (!q.slice(MODIFY_COMMAND.length).trim()) { toast(`Describe the change after "${MODIFY_COMMAND}"`); return; }
      if (!modifyPlan(q)) toast('No plan is waiting for changes');
      return;
    }
    askNova(q, {
      context: {
        /* TYPED, BY WHOM — the only place that says so; see turnModel's `wasTyped`. It gates the
           reading step, which is a requester change: everything else that opens a turn opens it
           with Nova's own words, and the other two personas are untouched. */
        typed: leadership ? 'leadership' : technician ? 'technician' : 'requester',
        ...(liveContext ? { from: liveContext.id, fromLabel: liveContext.label } : {}),
        ...(sources.length ? { sources: sources.map((s) => `${s.kind}:${s.id}`) } : {}),
      },
    });
  }, [askNova, liveContext, modifyPlan, leadership, technician]);

  // ══ the header: home · new chat · expand · the conversation menu ═══════════════════════
  const focusComposer = () => requestAnimationFrame(() => panelRef.current?.querySelector('textarea')?.focus());
  /* ONE COMPOSER, THREE SEATS — the plain box, the box under the folded strip, and the box the
     dock morphs into. Built here rather than three times, so a prop added to one is added to all
     three and they cannot quietly become different inputs. */
  const composerFor = (seat: ComposerSeat) => (
    <NovaComposer
      userRole={userRole}
      context={liveContext}
      onDismissContext={() => setCtxOff(true)}
      onSend={submit}
      seed={seat.seed !== undefined ? seat.seed : seed}
      onAttend={onAttend}
      onListening={setListening}
      /* Law 15 (cancel) and law 6 (never wonder whether it registered): while a turn is
         running the send control becomes STOP, in the same place, because the place your
         hand is already on is the place the escape hatch has to be. */
      running={running}
      onStop={latest ? () => stopTurn(latest.id) : undefined}
      placeholder={seat.placeholder}
      escBlurs={requester}
      bare={seat.bare}
      autoFocus={seat.autoFocus}
      onDraft={seat.onDraft}
    />
  );
  /* Leaving the greeting goes through `clearing`, so the cards fade as they always have. */
  const leaveHome = () => setPhase((p) => (p === 'greet' ? 'clearing' : p));
  /* HOME: the greeting and the cards, with the conversation kept — recorded under Recent chats
     first, so the title menu can bring it back. Anything running keeps running. */
  const goHome = () => { setHistory(false); saveChat(); setPhase('greet'); };
  /* START FRESH. Whatever is on screen is recorded first, so nothing is lost and nothing is
     asked. Disabled on an empty thread, so it cannot be reached with nothing to start from. */
  const startNewChat = () => {
    setHistory(false);
    if (!turns.length) return;
    newChat();
    setPhase('greet');
    focusComposer();
  };
  const newChatRef = useRef(startNewChat);
  newChatRef.current = startNewChat;
  /* RETURN TO A CHAT. The one on screen just needs the thread shown again. */
  const requestOpenChat = (id: string) => {
    setHistory(false);
    if (id !== activeChatId) openChat(id);
    leaveHome();
  };
  /* USE puts the prompt in the composer with the caret at the end — the same path Edit query
     takes. Read, change, then send; a saved prompt is never sent sight unseen. */
  const usePrompt = (p: SavedPrompt) => setSeed({ text: p.prompt, nonce: Date.now() });
  const savePromptFor = (question: string) =>
    setPromptDraft({ mode: 'save', name: promptNameFor(question), prompt: question });
  const savePrompt = (name: string, prompt: string) => {
    if (promptDraft?.mode === 'edit' && promptDraft.id) {
      updatePrompt(promptDraft.id, { name, prompt });
      toast('Prompt updated');
    } else {
      /* Tagged with the role of the case it reaches, so the menu can put the reader's own first
         without anyone filing it. */
      addPrompt({ name, prompt, role: roleOfCase(caseIdFor(prompt)) ?? userRole });
      toast('Prompt saved');
    }
    setPromptDraft(null);
  };
  /* DELETE A CHAT. The one on screen goes home and is reversible — the toast carries Undo, so
     it asks nothing first; another chat just leaves the list. */
  const deleteThisChat = (id?: string) => {
    const mine = !id || id === activeChatId;
    const gone = deleteChat(id);
    if (mine) setPhase('greet');
    if (gone) toast(`Deleted “${gone.title}”`, { action: { label: 'Undo', onClick: () => restoreChat(gone) } });
  };
  /* EXPAND. The panel widens on the next frame; the orb's seat has moved, so the host re-seats
     it — a FLIP, the same one the greeting → thread transition uses. */
  const toggleWide = () => {
    setWide((v) => !v);
    requestAnimationFrame(() => requestAnimationFrame(() => onOrbSlotChange?.()));
  };

  // ══ keyboard ═════════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      /* Ctrl/⌘+Shift+O — new chat. The product's own shortcuts are Ctrl/⌘+J (open Nova) and
         Alt+letter inside a ticket, so nothing collides. */
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && !e.altKey && e.code === 'KeyO') {
        e.preventDefault(); newChatRef.current(); return;
      }
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

  /* ESCAPE STEPS ONE LAYER. From the full history it returns to the conversation instead of
     throwing away the drawer — but the drawer does not own Escape: `AskAiProvider` listens on
     window and closes Ask AI from anywhere. The way in is the one the popovers already use:
     CAPTURE, on window, swallowing the key. This listener is registered when the drawer mounts,
     which is BEFORE any popover it can open, so it cannot rely on ordering to stand aside for
     them — it checks for one on screen and lets it have the press. */
  useEffect(() => {
    if (!open) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || !historyRef.current) return;
      if (document.querySelector('.nova-pop, .nova-modal-scrim')) return;
      /* And an inline edit inside the list opts out the same way it does under a popover:
         cancelling a rename is not leaving the list, and capture order means the field's own
         stopPropagation could never get in first. The suite caught this one — the second
         rename in the history had no field to type into. */
      const t = e.target as HTMLElement | null;
      if (t && 'closest' in t && t.closest('[data-esc-local]')) return;
      e.preventDefault();
      e.stopPropagation();
      setHistory(false);
    };
    window.addEventListener('keydown', onEsc, true);
    return () => window.removeEventListener('keydown', onEsc, true);
  }, [open]);

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
        className="nova-scrim fixed inset-0 z-[10015] bg-[var(--nova-scrim)]"
        data-open={shown ? 'true' : 'false'}
        data-closing={closing ? 'true' : 'false'}
        onClick={onClose}
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Ask AI"
        className="nova-drawer fixed right-0 top-0 z-[10020] flex h-screen max-w-[95vw] flex-col overflow-hidden border-l border-[var(--nova-border)] bg-white shadow-2xl"
        data-open={shown ? 'true' : 'false'}
        data-closing={closing ? 'true' : 'false'}
        data-phase={phase}
        data-wide={wide ? 'true' : 'false'}
        data-history={history ? 'true' : 'false'}
        /* The pointer's position, written onto the panel as custom properties via the ref —
           `.nova-grid-hi` reads them for the accent highlight on the dots. Never setState: a 120Hz
           pointer would re-render the whole thread for a ring of dots. */
        onMouseMove={(e) => {
          const p = panelRef.current;
          /* Default screen only — nothing is written once there is a conversation. */
          if (!p || phase !== 'greet') return;
          const r = p.getBoundingClientRect();
          p.style.setProperty('--dots-x', `${Math.round(e.clientX - r.left)}px`);
          p.style.setProperty('--dots-y', `${Math.round(e.clientY - r.top)}px`);
          p.style.setProperty('--dots-on', '1');
        }}
        onMouseLeave={() => panelRef.current?.style.setProperty('--dots-on', '0')}
      >
        <div className="nova-grid pointer-events-none absolute inset-0" data-in={staged.grid ? 'true' : 'false'} />
        <div className="nova-grid-hi pointer-events-none absolute inset-0" data-in={staged.grid ? 'true' : 'false'} aria-hidden="true" />
        <div className="nova-ripple pointer-events-none absolute inset-0" data-in={staged.ripple ? 'true' : 'false'} />

        <div
          ref={scrollerRef}
          className="relative flex min-h-0 flex-1 flex-col overflow-y-auto px-6 pb-2"
          data-scroller
          /* THE DOCK OVERLAYS THE TAIL of this area, so the area pads by the dock's MEASURED
             height (plus its 10px stand-off) — never a guess, at any option count. */
          style={dockH ? { paddingBottom: dockH + 10 } : undefined}
        >
          {/* THE HEADER — inside the scroller, sticky, so the thread scrolls BENEATH it and the
              rule and blur it earns are over real content. See NovaHeader. */}
          <NovaHeader
            phase={phase}
            markerSlotRef={markerSlotRef}
            scrolled={scrolled}
            wide={wide}
            userRole={userRole}
            onRoleChange={onRoleChange}
            now={now?.getTime() ?? Date.now()}
            onHome={goHome}
            onNewChat={startNewChat}
            onToggleWide={toggleWide}
            onClose={onClose}
            onOpenChat={requestOpenChat}
            onUsePrompt={usePrompt}
            onRename={renameChat}
            onDelete={deleteThisChat}
            onEditPrompt={(x) => setPromptDraft({ mode: 'edit', id: x.id, name: x.name, prompt: x.prompt })}
            onDeletePrompt={setPromptDelete}
            onNewPrompt={() => setPromptDraft({ mode: 'save', name: '', prompt: '' })}
            historyOpen={history}
            onShowAll={(query) => { setHistoryQ(query); setHistory(true); }}
            onCloseHistory={() => setHistory(false)}
          />
          {/* EVERY CHAT, when Show all asked for them. It takes the panel: the greeting and the
              thread are both things you would be leaving to look at this. */}
          {history && (
            <NovaChatHistory
              chats={chats}
              activeChatId={activeChatId}
              now={now?.getTime() ?? Date.now()}
              initialQuery={historyQ}
              onOpen={requestOpenChat}
              onRename={(t, id) => renameChat(t, id)}
              onDelete={deleteThisChat}
            />
          )}

          {/* The greeting stays MOUNTED through `clearing` so its fade has something to fade. */}
          {phase !== 'live' && !history && (
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
          {/* ONE rhythm unit between turns, the same unit inside them, and the SAME unit between
              the header and the first message — the reader's question sits close under the
              header rather than floating. A comment cannot live between `&& (` and the element:
              that position must be the one expression the conditional returns. */}
          {phase === 'live' && !history && (
            /* ⚠️ `minmax(0, 1fr)`, NOT the default `auto`. A grid's auto column takes its
               MIN-CONTENT width, so any card whose content grows — the editable value's "Edit"
               pill was the one that exposed it — widens the column past the drawer and drags
               every card in the thread with it. Measured: the draft card went 385px → 417px on
               hover. A bounded column makes the content give way instead. */
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', rowGap: 'var(--nova-gap-turn)', paddingTop: 'var(--nova-gap-turn)' }} data-thread>
              {turns.map((t, i) => (
                <NovaTurn
                  key={t.id}
                  turn={t}
                  live={i === turns.length - 1}
                  onFollowUp={askFollowUp}
                  onEditQuery={(q) => setSeed({ text: q, nonce: Date.now() })}
                  onRetry={() => retryTurn(t.id)}
                  onRegenerate={() => retryTurn(t.id, true)}
                  leadership={leadership}
                  technician={technician}
                  requester={requester}
                  /* WHAT THE DOCK IS ALREADY OFFERING, so the chips beneath the answer do not
                     repeat it. The drawer is the only place that holds both lists. */
                  offered={dockShown ? steps.map((x) => x.label) : undefined}
                  onAnswerAsk={(askId, answers, done) => answerAsk(t.id, askId, answers, done)}
                  onPlanRespond={(id, payload) => respondToPlan(t.id, id, payload)}
                  onPlanModify={() => setSeed({ text: `${MODIFY_COMMAND} `, nonce: Date.now(), clearable: true })}
                  onSavePrompt={savePromptFor}
                />
              ))}
            </div>
          )}
        </div>

        {!history && (
        /* THE FOOTER: the dock, docked above the input, and the input. One positioned parent, so
           the dock sits at `bottom: 100%` of it — over the scroll area's padded tail, 10px above
           the box — and never takes space of its own. */
        <div className="relative" data-dock-footer>
          {/* ONE OVERLAY, ONE MEASUREMENT. Whatever is docked lives in here; the observer below
              reads THIS element, so an empty overlay measures zero without anyone reporting it
              and two docked things cannot overwrite each other's height. */}
          {/* The technician's ask-chips still float ABOVE the box — they are a second, quieter
              offer and the box is the first one. The requester's dock is not: it TAKES the seat,
              which is why it is rendered below rather than here. */}
          <div ref={overlayRef} className="nova-dock-overlay" data-dock-overlay>
            {chipsShown && (
              <TechAskChips chips={askChips} onAsk={(q) => askNova(q)} />
            )}
          </div>
          {/* ONE SEAT, whatever is in it. 12px either side, 12px beneath, on the fade — the
              geometry the input has always had, kept so that the dock arriving does not move the
              bottom of the drawer. */}
          <div {...rise(staged.input, 0, 'relative bg-white px-3 pb-3 pt-1')} data-dock-seat>
            {dockShown ? (
              /* KEYED ON THE OPTION SET: a new turn brings a fresh dock, so a folded strip or a
                 half-typed draft never survives into an answer the reader has not read yet. */
              <RequesterDock
                key={steps.map((x) => x.id).join('|')}
                steps={steps}
                onRan={onDockRan}
                renderComposer={composerFor}
              />
            ) : composerFor({ bare: false, autoFocus: false, placeholder: dockEmpty ? 'Anything else?' : undefined })}
          </div>
        </div>
        )}

        {/* Save prompt, over the panel. */}
        {promptDraft && (
          <NovaPromptDialog
            mode={promptDraft.mode}
            initial={{ name: promptDraft.name, prompt: promptDraft.prompt }}
            anchor={panelRef.current}
            onCancel={() => setPromptDraft(null)}
            onSave={savePrompt}
          />
        )}
        {promptDelete && (
          <NovaDeletePrompt
            name={promptDelete.name}
            anchor={panelRef.current}
            onCancel={() => setPromptDelete(null)}
            onConfirm={() => { removePrompt(promptDelete.id); toast('Prompt removed'); setPromptDelete(null); }}
          />
        )}
      </div>
    </>
  );
}

export const NOVA_EXIT_MS = NOVA_DUR.exit;
export { prefersReducedMotion };
