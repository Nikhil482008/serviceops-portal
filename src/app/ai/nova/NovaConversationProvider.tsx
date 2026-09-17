import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
  type ReactNode,
} from 'react';
import { mockInvestigation, type NovaEvent, type NovaInvestigation } from './novaStream';
import { applyEvent, MODIFY_COMMAND, newTurn, planPending, recordAsk, setState, type Turn } from './turnModel';
import { caseIdFor, chatTitleOf, roleOfCase, seededChats, type NovaChat } from './novaChats';
import { useAskAiActionsOptional } from '../AskAiProvider';
import { BOXES_CYCLE_MS } from './conversation/NovaBoxesLoader';

/* THE ONE WAY TO ASK NOVA ANYTHING.
 *
 * ── WHICH PATTERN, AND WHY ───────────────────────────────────────────────────────────────────
 * A React context provider with SPLIT volatile/stable halves, because that is what this codebase
 * already does twice — `AskAiProvider` and `DrawerStackProvider` are both exactly this shape, and
 * `AskAiProvider`'s own comment explains the split: a consumer that only DISPATCHES subscribes to
 * a value whose identity never changes, so a streaming answer cannot re-render it. There is no
 * store library in this repo (no redux, no zustand, no jotai — checked), so introducing one for
 * one feature would be the novel thing, not the consistent one.
 *
 * The controller lives above the drawer rather than inside it for a reason that is not stylistic:
 * an investigation has to outlive the component showing it. If the feed consumed the stream, then
 * closing the drawer mid-investigation would abort the turn, and a settled turn 1 could not sit
 * above a running turn 2 once either unmounted. Turns are state; the drawer is a view of them.
 *
 * ⚠️ STATED DEVIATION from the brief's wording. The brief says "the feed component consumes an
 * AsyncIterable". Here the CONTROLLER consumes it and the feed renders turn state. The purpose
 * behind that sentence — "swapping in a real backend must require zero changes to the feed
 * component" — is met more strongly this way: the feed does not touch the source at all, and
 * `NovaInvestigation.run(signal)` remains the single seam. Say the word and I will move
 * consumption back into the feed, but the turn-outlives-the-view property goes with it.
 */

/** The floor on a visible investigation. An answer that arrives sooner WAITS.
 *
 *  Without this a fast mock — or a cached backend response — would flash the feed and land on the
 *  answer, and the whole point of the surface is that you can see what it did. */
export const MIN_INVESTIGATION_MS = 2400;
/** How long an answer WAITS before it is shown.
 *
 *  The floor above is the minimum; on top of it the answer waits for the thinking mark to finish
 *  the pass it is in (`BOXES_CYCLE_MS`), so the loader is never cut off in the middle of a move.
 *  Both are skipped entirely by the dev skip, which is what makes it a demo control rather than a
 *  second code path. */
export const holdUntil = (elapsed: number): number =>
  Math.max(MIN_INVESTIGATION_MS, Math.ceil(Math.max(1, elapsed) / BOXES_CYCLE_MS) * BOXES_CYCLE_MS);
/** How long `answering` lasts before `settled`. The answer is revealing during it. */
const ANSWER_REVEAL_MS = 320;

/* ── THE CLOCK ────────────────────────────────────────────────────────────────────────────
 * "Thought for 14s" reads two stamps on the turn (`thoughtFor`), and this controller is the only
 * thing that writes them — beside the floor and the reveal, the other timing it already owns.
 * Never the reducer: how long Nova thought is a fact about the presentation of the work, not
 * about the work, and folding it from events would put a wall clock inside a pure function.
 *
 * It runs while the stream is moving, STOPS while the stream is parked on the reader (a
 * clarifying question, a plan awaiting approval — time the reader spent is not time Nova
 * thought), and stops for good once the answer is on screen, the turn failed, or it was stopped. */
const stopClock = (t: Turn): Turn => (t.thinkingSince !== undefined
  ? { ...t, thoughtMs: (t.thoughtMs ?? 0) + Math.max(0, Date.now() - t.thinkingSince), thinkingSince: undefined }
  : t);
const startClock = (t: Turn): Turn => (
  /* Only a clock that was started (never for an instant run), and never once there is a plan:
     the investigation is over the moment a plan is up for review, and what runs after approval
     is execution, which the identity row names as such. */
  t.thinkingSince !== undefined || t.thoughtMs === undefined || t.plan || t.answer || t.error || t.stopped
    ? t : { ...t, thinkingSince: Date.now() });
/** After an event: a park stops the clock; anything else through means the stream is moving. */
const clockAfter = (t: Turn, e: NovaEvent): Turn =>
  (e.type === 'ask' || e.type === 'plan_proposed' ? stopClock(t) : startClock(t));

interface ConversationState {
  turns: Turn[];
  /** DEV ONLY — see `setSkipInvestigation`. */
  skipInvestigation: boolean;
  /** Every conversation — this session's, recorded as the reader left them, and the seeded
   *  ones from before it. Newest activity first is the LIST's job; this is unordered. */
  chats: NovaChat[];
  /** Which chat `turns` is. Null: a new one, not recorded until the reader leaves it. */
  activeChatId: string | null;
  /** What this conversation is about — its chat's title, a rename, or the first question's
   *  subject. Null before anything has been asked. */
  title: string | null;
}

interface ConversationActions {
  /** THE entry point. Every way of asking Nova a question goes through this and nothing else.
   *  Returns the id of the turn it opened, so a caller can follow it (the dock moves focus to
   *  the reply's headline once it lands). */
  askNova(question: string, opts?: { caseId?: string; context?: Record<string, unknown> }): string | undefined;
  /** A follow-up chip. Same call, plus the turn it came from as context — wired now so the chips
   *  have something to call, and so a chip can never become a second way in. */
  askFollowUp(question: string, fromTurnId: string, context?: Record<string, unknown>): void;
  /** Run the same question again, in place. UX law 15: an error the reader cannot act on is a
   *  dead end — and `error.recoverable` was being set by the stream with nothing reading it.
   *  `instant` skips the pacing — the ••• menu's Regenerate, which replaces the answer without
   *  replaying the wait. */
  retryTurn(id: string, instant?: boolean): void;
  /** Stop a running investigation. UX law 15 again (cancel), and law 6: an action with no way
   *  out is an action people hesitate to take. */
  stopTurn(id: string): void;
  /** Send the reader's answers to a clarifying question set, releasing a parked investigation.
   *
   *  The turn is patched FIRST and the stream released second — the acknowledgement is local,
   *  so it lands in the same frame as the click rather than after a round trip (law 6). */
  answerAsk(
    turnId: string, askId: string, answers: Record<string, string>, done: boolean,
  ): void;
  /** Release a stream parked on a plan proposal (or a failed execution step). `payload.action`
   *  says what the reader chose — approve / revise / remove_step / edit_step / add_step / retry.
   *  The approval is patched onto the turn FIRST so the click lands in the same frame. */
  respondToPlan(turnId: string, id: string, payload: Record<string, string>): void;
  /** `/modify plan <change>` — the reader's change becomes its own turn and the revised plan
   *  arrives as Nova's reply to it. Returns false when nothing is waiting to be changed. */
  modifyPlan(message: string): boolean;
  /** START FRESH. Records the thread under Chats (stopping anything still running), clears it.
   *  An empty thread records nothing. */
  newChat(): void;
  /** RETURN TO A CHAT. Records the current thread first, then restores the chosen one exactly
   *  as it was left — or, for a chat seeded from before this session, replays its questions
   *  through the same investigation, instantly, at the chat's own time. */
  openChat(id: string): void;
  /** RECORD THE THREAD under Recent chats without leaving it — going home keeps the
   *  investigation running and the conversation reachable from the title menu. */
  saveChat(): void;
  /** Rename a chat — the one on screen by default, or any other by id. */
  renameChat(title: string, id?: string): void;
  /** Drop a chat. The one on screen (recorded first, then cleared) by default, or any other by
   *  id, which leaves the thread alone. Returned either way, so it can be put back. */
  deleteChat(id?: string): NovaChat | null;
  restoreChat(chat: NovaChat): void;
  reset(): void;
  setSkipInvestigation(on: boolean): void;
}

const StateCtx = createContext<ConversationState | null>(null);
const ActionsCtx = createContext<ConversationActions | null>(null);

let seq = 0;
const nextTurnId = () => `turn-${Date.now().toString(36)}-${seq++}`;
let chatSeq = 0;
const nextChatId = () => `chat-${Date.now().toString(36)}-${chatSeq++}`;

const wait = (ms: number) => new Promise<void>((r) => { setTimeout(r, Math.max(0, ms)); });

export function NovaConversationProvider({ children }: { children: ReactNode }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [skipInvestigation, setSkipInvestigation] = useState(false);
  /* CHATS. The thread on screen is `turns`; `activeChatId` says which chat that is. A chat is
     RECORDED when the reader leaves it — New chat, or opening another — so nothing typed is ever
     lost, and never before then, so an empty thread never becomes an empty chat. */
  const [chats, setChats] = useState<NovaChat[]>(() => seededChats(Date.now()));
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const chatsRef = useRef<NovaChat[]>(chats);
  chatsRef.current = chats;
  const activeRef = useRef<string | null>(activeChatId);
  activeRef.current = activeChatId;
  /* A rename of the thread on screen, before or after it is recorded. */
  const [titleOverride, setTitleOverride] = useState<string | null>(null);
  const titleRef = useRef<string | null>(titleOverride);
  titleRef.current = titleOverride;
  /* Optional so this provider can be mounted in a test or a harness without the drawer's own
     provider above it. */
  const askAi = useAskAiActionsOptional();

  const skipRef = useRef(skipInvestigation);
  skipRef.current = skipInvestigation;
  /* A mirror, so `retryTurn` can read the question it is retrying without taking `turns` as a
     dependency — which would rebuild every action on every step and undo the split-context
     point of this provider. Same shape as `skipRef` above. */
  const turnsRef = useRef<Turn[]>(turns);
  turnsRef.current = turns;
  const controllers = useRef(new Map<string, AbortController>());
  /* Kept because an investigation is not write-only: one parked on a clarifying question has to
     be handed the answers. Same lifetime as its AbortController, and cleaned up by the same
     identity check below. */
  const investigations = useRef(new Map<string, NovaInvestigation>());
  /* WHERE A RUNNING INVESTIGATION'S EVENTS LAND.
     A plan modification is a new message, so the revised plan must arrive as a NEW reply — but the
     stream is still the one parked on the original proposal, and restarting it would throw away
     the plan the reader is in the middle of shaping. So the run keeps going and its output is
     REDIRECTED: origin turn id → the turn now receiving its events, and back again so a click on
     the new card still reaches the investigation that owns the parked promise. */
  const redirect = useRef(new Map<string, string>());
  const originOf = useRef(new Map<string, string>());
  const liveId = useCallback((originId: string) => redirect.current.get(originId) ?? originId, []);
  const streamId = useCallback((activeId: string) => originOf.current.get(activeId) ?? activeId, []);

  /** Change one turn, by id. Every write goes through this, so a turn can only ever be changed by
   *  something addressed to it — which is what keeps turn 2 from disturbing turn 1. */
  const patch = useCallback((id: string, fn: (t: Turn) => Turn) => {
    setTurns((prev) => prev.map((t) => (t.id === id ? fn(t) : t)));
  }, []);

  const run = useCallback(async (turn: Turn, instant: boolean) => {
    /* Everything this run writes goes to whichever turn is currently receiving its events. */
    const emit = (fn: (t: Turn) => Turn) => patch(liveId(turn.id), fn);
    const ctl = new AbortController();
    controllers.current.set(turn.id, ctl);
    const inv = mockInvestigation(turn.question, turn.caseId, instant, turn.context, turn.id);
    investigations.current.set(turn.id, inv);
    /* topic AND view. The investigation decides both; copying only one left every technician
       turn rendering the requester's step list while the stream had correctly asked for the
       thinking view — the kind of miss a build cannot see, because both are valid strings. */
    emit((t) => ({
      ...t, topic: inv.topic, view: inv.view, scope: inv.scope, activity: inv.activity,
      /* THE CLOCK starts with the work — and never for an instant run. A replayed chat or a
         regenerate did not think; "Thought for 0s" would claim it had. */
      ...(instant ? {} : { thoughtMs: 0, thinkingSince: Date.now() }),
    }));

    try {
      for await (const e of inv.run(ctl.signal) as AsyncIterable<NovaEvent>) {
        if (ctl.signal.aborted) return;
        emit((t) => clockAfter(applyEvent(t, e), e));

        if (e.type === 'answer') {
          /* THE FLOOR. The answer is already in the turn — the feed is still showing its last
             step pulsing, because `activeIndex` keeps something alive until the state moves on.
             Only after the floor has passed does the machine advance. */
          if (!instant) {
            const elapsed = Date.now() - turn.startedAt;
            await wait(holdUntil(elapsed) - elapsed);
          }
          if (ctl.signal.aborted) return;
          emit((t) => stopClock(setState(t, 'answering')));
          await wait(instant ? 0 : ANSWER_REVEAL_MS);
          if (ctl.signal.aborted) return;
          emit((t) => setState(t, 'settled'));
          continue;
        }

        if (e.type === 'error') {
          emit((t) => ({ ...stopClock(t), state: 'error' }));
          continue;
        }
      }
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') {
        emit((t) => ({
          ...stopClock(t),
          state: 'error',
          error: { message: 'The investigation stopped unexpectedly.', recoverable: true },
        }));
      }
    } finally {
      /* ONLY IF THIS RUN IS STILL THE CURRENT ONE.
         `retryTurn` aborts the old run and starts a new one under the SAME turn id, all
         synchronously — so the old run's rejection is delivered a microtask later, after the
         replacement has already registered itself. Deleting by id there tore down the new run's
         controller and stamped `ended: true` on a turn that had only just started. Comparing
         identity makes the cleanup belong to the run that owns it. */
      if (controllers.current.get(turn.id) === ctl) {
        controllers.current.delete(turn.id);
        investigations.current.delete(turn.id);
        emit((t) => ({ ...stopClock(t), ended: true }));
      }
    }
  }, [patch, liveId]);

  const askNova = useCallback<ConversationActions['askNova']>((question, opts) => {
    const q = String(question || '').trim();
    if (!q) return;
    /* Opening is part of asking. Otherwise every caller has to remember to open the drawer too,
       and the one that forgets produces an invisible investigation. */
    askAi?.open();
    const turn = newTurn(nextTurnId(), q, opts?.caseId, opts?.context);
    setTurns((prev) => [...prev, turn]);
    void run(turn, skipRef.current);
    return turn.id;
  }, [askAi, run]);

  const askFollowUp = useCallback<ConversationActions['askFollowUp']>((question, fromTurnId, context) => {
    /* A drill names the script it wants (`caseId`) and the segment it clicked (`filter`); both
       ride the same askNova call every other question uses. */
    const { caseId, ...rest } = (context ?? {}) as { caseId?: string } & Record<string, unknown>;
    askNova(question, { caseId, context: { followUpOf: fromTurnId, ...rest } });
  }, [askNova]);

  const retryTurn = useCallback<ConversationActions['retryTurn']>((id, instant) => {
    const old = turnsRef.current.find((t) => t.id === id);
    if (!old) return;
    /* Whatever was still in flight is abandoned first, or two streams write the same turn. */
    controllers.current.get(id)?.abort();
    controllers.current.delete(id);
    /* Same id, same question, same context — the turn KEEPS ITS PLACE in the thread rather than
       a second copy of the question appearing below the first. */
    const fresh = newTurn(id, old.question, old.caseId, old.context);
    setTurns((prev) => prev.map((t) => (t.id === id ? fresh : t)));
    void run(fresh, instant ?? skipRef.current);
  }, [run]);

  const stopTurn = useCallback<ConversationActions['stopTurn']>((id) => {
    /* A revision turn is fed by the ORIGINAL run — stop has to abort that one. */
    const ctl = controllers.current.get(streamId(id));
    if (!ctl) return;
    ctl.abort();
    controllers.current.delete(streamId(id));
    patch(id, (t) => stopClock(t.answer
      /* Stopped during the MINIMUM-VISIBLE floor: the answer already exists and the wait was
         ours, not the work's. Handing it over is the honest response to "stop" — refusing to
         show what is already computed would be theatre. */
      ? { ...t, state: 'settled' as const, ended: true }
      : { ...t, state: 'idle' as const, stopped: true, ended: true }));
  }, [patch, streamId]);

  const answerAsk = useCallback<ConversationActions['answerAsk']>(
    (turnId, askId, answers, done) => {
      patch(turnId, (t) => recordAsk(t, askId, answers, done));
      if (!done) return;                 // a pick, not the end of the set — nothing to release
      /* Merged, because `answers` here is only the LAST pick and the stream is owed all of them.
         Reading the turn from the ref rather than from `turns` keeps this action's identity
         stable, which is the whole point of the split provider. */
      const t = turnsRef.current.find((x) => x.id === turnId);
      const full = { ...(t?.asks.find((a) => a.id === askId)?.answers ?? {}), ...answers };
      /* A no-op if the stream already went away — stopped, retried, or reset. The choices stay
         recorded above regardless, because they are a thing the reader did. */
      investigations.current.get(turnId)?.respond?.(askId, full);
    }, [patch],
  );

  const respondToPlan = useCallback<ConversationActions['respondToPlan']>(
    (turnId, id, payload) => {
      /* Approval acknowledged locally, in the same frame as the click — the exec_begin event
         confirms it a beat later. Every other action's acknowledgement IS the next
         plan_proposed / exec_step event. */
      if (payload.action === 'approve') {
        patch(turnId, (t) => (t.plan ? { ...t, plan: { ...t.plan, status: 'approved' } } : t));
      }
      /* The parked promise belongs to the investigation that started this, whichever turn is
         showing its plan now. */
      investigations.current.get(streamId(turnId))?.respond?.(id, payload);
    }, [patch, streamId],
  );

  /* A MODIFICATION IS A MESSAGE. The change the reader typed becomes its own turn, the plan it
     replaces becomes a record, and the revised plan arrives as the reply — one exchange per
     change, read top to bottom, exactly like every other exchange in the thread. */
  const modifyPlan = useCallback<ConversationActions['modifyPlan']>((message) => {
    const text = message.replace(new RegExp(`^${MODIFY_COMMAND}\\s*`, 'i'), '').trim();
    if (!text) return false;
    const target = [...turnsRef.current].reverse().find(planPending);
    if (!target?.plan) return false;

    const origin = streamId(target.id);
    const fresh = newTurn(nextTurnId(), message, target.caseId, target.context);
    /* The reply inherits the investigation ITSELF — its presentation, its checks and its
       findings — because it is the same investigation and whatever it finally answers rests on
       exactly those sources; the evidence fold, the source count and the evidence drawer all read
       them. What it does not do is re-display the trail while the plan is under review: see
       NovaReveal, where `revisionOf` makes the reply the plan and nothing else. */
    setTurns((prev) => prev.map((t) => (t.id === target.id
      ? { ...t, state: 'idle' as const, ended: true, plan: t.plan ? { ...t.plan, status: 'superseded' as const } : null }
      : t)).concat({
      ...fresh,
      revisionOf: target.id,
      topic: target.topic,
      view: target.view,
      activity: target.activity,
      scope: target.scope,
      steps: target.steps,
      discoveries: target.discoveries,
    }));
    redirect.current.set(origin, fresh.id);
    originOf.current.set(fresh.id, origin);

    investigations.current.get(origin)?.respond?.(target.plan.proposal.id, { action: 'revise', text });
    return true;
  }, [streamId]);

  const reset = useCallback(() => {
    controllers.current.forEach((c) => c.abort());
    controllers.current.clear();
    investigations.current.clear();
    redirect.current.clear();
    originOf.current.clear();
    setTurns([]);
  }, []);

  /** RECORD THE THREAD under its chat. The thread stays. Returns the record, or null for an
   *  empty thread, which records nothing. A thread recorded for the first time becomes the
   *  active chat, so later records update it rather than making a second. `stopped` is for
   *  LEAVING: anything in flight is written down the way `stopTurn` would leave it, so a parked
   *  plan or ask comes back inert rather than as a button with no stream behind it. */
  const record = useCallback((stopped: boolean): NovaChat | null => {
    const cur = turnsRef.current;
    if (!cur.length) return null;
    const settled: Turn[] = !stopped ? cur : cur.map((t) => {
      const inFlight = t.state === 'investigating' || t.state === 'answering' || planPending(t);
      if (!inFlight) return t;
      return stopClock(t.answer
        ? { ...t, state: 'settled' as const, ended: true }
        : { ...t, state: 'idle' as const, stopped: true, ended: true });
    });
    const id = activeRef.current ?? nextChatId();
    const was = chatsRef.current.find((c) => c.id === id);
    const first = settled[0];
    /* Last ACTIVITY, not last look: reading an old chat must not move it up the list. */
    const last = Math.max(...settled.map((t) => t.startedAt));
    const rec: NovaChat = {
      id,
      title: titleRef.current ?? was?.title ?? chatTitleOf(settled),
      role: was?.role ?? roleOfCase(caseIdFor(first.question, first.caseId)),
      createdAt: was?.createdAt ?? first.startedAt,
      updatedAt: Math.max(was?.updatedAt ?? 0, last),
      turns: settled,
    };
    setChats((prev) => [rec, ...prev.filter((c) => c.id !== id)]);
    if (!activeRef.current) { activeRef.current = id; setActiveChatId(id); }
    return rec;
  }, []);

  /** LEAVING THE THREAD: stop everything in flight, then record it. */
  const park = useCallback((): NovaChat | null => {
    controllers.current.forEach((c) => c.abort());
    controllers.current.clear();
    investigations.current.clear();
    redirect.current.clear();
    originOf.current.clear();
    return record(true);
  }, [record]);

  const saveChat = useCallback<ConversationActions['saveChat']>(() => { record(false); }, [record]);

  const renameChat = useCallback<ConversationActions['renameChat']>((title, id) => {
    const t = title.trim();
    if (!t) return;
    const target = id ?? activeRef.current;
    if (!id || id === activeRef.current) setTitleOverride(t);
    if (target) setChats((prev) => prev.map((c) => (c.id === target ? { ...c, title: t } : c)));
  }, []);

  const deleteChat = useCallback<ConversationActions['deleteChat']>((id) => {
    /* Another chat: it leaves the list and the thread on screen is not disturbed. */
    if (id && id !== activeRef.current) {
      const gone = chatsRef.current.find((c) => c.id === id) ?? null;
      if (gone) setChats((prev) => prev.filter((c) => c.id !== id));
      return gone;
    }
    /* The one on screen: recorded (so Undo has something to put back), then cleared. */
    const rec = park();
    if (rec) setChats((prev) => prev.filter((c) => c.id !== rec.id));
    setTurns([]);
    setActiveChatId(null);
    setTitleOverride(null);
    return rec;
  }, [park]);

  const restoreChat = useCallback<ConversationActions['restoreChat']>((chat) => {
    setChats((prev) => [chat, ...prev.filter((c) => c.id !== chat.id)]);
  }, []);

  const newChat = useCallback<ConversationActions['newChat']>(() => {
    park();
    setTurns([]);
    setActiveChatId(null);
    setTitleOverride(null);
  }, [park]);

  const openChat = useCallback<ConversationActions['openChat']>((id) => {
    if (id === activeRef.current) return;
    const target = chatsRef.current.find((c) => c.id === id);
    if (!target) return;
    park();
    setActiveChatId(id);
    setTitleOverride(null);
    if (target.turns.length) { setTurns(target.turns); return; }
    /* Seeded from before this session: the questions, replayed through the same investigation,
       instantly, stamped with the chat's own time — the real conversation, produced by the same
       code, rather than a stored picture of one. Recorded like any other chat when left. */
    const qs = target.seed?.questions ?? [];
    const fresh = qs.map((q, i) => ({
      ...newTurn(nextTurnId(), q),
      startedAt: target.updatedAt - (qs.length - 1 - i) * 90_000,
    }));
    setTurns(fresh);
    fresh.forEach((t) => { void run(t, true); });
  }, [park, run]);

  useEffect(() => () => { controllers.current.forEach((c) => c.abort()); }, []);

  const state = useMemo<ConversationState>(
    () => ({
      turns, skipInvestigation, chats, activeChatId,
      title: chats.find((c) => c.id === activeChatId)?.title ?? titleOverride ?? (turns.length ? chatTitleOf(turns) : null),
    }),
    [turns, skipInvestigation, chats, activeChatId, titleOverride],
  );
  const actions = useMemo<ConversationActions>(
    () => ({
      askNova, askFollowUp, retryTurn, stopTurn, answerAsk, respondToPlan, modifyPlan,
      newChat, openChat, saveChat, renameChat, deleteChat, restoreChat, reset, setSkipInvestigation,
    }),
    [askNova, askFollowUp, retryTurn, stopTurn, answerAsk, respondToPlan, modifyPlan, newChat, openChat, saveChat, renameChat, deleteChat, restoreChat, reset],
  );

  return (
    <StateCtx.Provider value={state}>
      <ActionsCtx.Provider value={actions}>{children}</ActionsCtx.Provider>
    </StateCtx.Provider>
  );
}

export function useNovaConversation(): ConversationState {
  const v = useContext(StateCtx);
  if (!v) throw new Error('useNovaConversation must be used inside NovaConversationProvider');
  return v;
}
export function useNovaActions(): ConversationActions {
  const v = useContext(ActionsCtx);
  if (!v) throw new Error('useNovaActions must be used inside NovaConversationProvider');
  return v;
}
/** For surfaces that may render outside the provider — the Use Cases page renders standalone in
 *  a harness, and a page of questions is worth reading even when nothing can answer them. */
export const useNovaActionsOptional = (): ConversationActions | null => useContext(ActionsCtx);
export const useNovaConversationOptional = (): ConversationState | null => useContext(StateCtx);
