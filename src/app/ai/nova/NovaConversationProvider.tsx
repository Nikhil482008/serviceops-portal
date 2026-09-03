import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
  type ReactNode,
} from 'react';
import { mockInvestigation, type NovaEvent } from './novaStream';
import { applyEvent, newTurn, setState, type Turn } from './turnModel';
import { useAskAiActionsOptional } from '../AskAiProvider';

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
/** How long `answering` lasts before `settled`. The answer is revealing during it. */
const ANSWER_REVEAL_MS = 320;

interface ConversationState {
  turns: Turn[];
  /** DEV ONLY — see `setSkipInvestigation`. */
  skipInvestigation: boolean;
}

interface ConversationActions {
  /** THE entry point. Every way of asking Nova a question goes through this and nothing else. */
  askNova(question: string, opts?: { caseId?: string; context?: Record<string, unknown> }): void;
  /** A follow-up chip. Same call, plus the turn it came from as context — wired now so the chips
   *  have something to call, and so a chip can never become a second way in. */
  askFollowUp(question: string, fromTurnId: string): void;
  /** Run the same question again, in place. UX law 15: an error the reader cannot act on is a
   *  dead end — and `error.recoverable` was being set by the stream with nothing reading it. */
  retryTurn(id: string): void;
  /** Stop a running investigation. UX law 15 again (cancel), and law 6: an action with no way
   *  out is an action people hesitate to take. */
  stopTurn(id: string): void;
  reset(): void;
  setSkipInvestigation(on: boolean): void;
}

const StateCtx = createContext<ConversationState | null>(null);
const ActionsCtx = createContext<ConversationActions | null>(null);

let seq = 0;
const nextTurnId = () => `turn-${Date.now().toString(36)}-${seq++}`;

const wait = (ms: number) => new Promise<void>((r) => { setTimeout(r, Math.max(0, ms)); });

export function NovaConversationProvider({ children }: { children: ReactNode }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [skipInvestigation, setSkipInvestigation] = useState(false);
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

  /** Change one turn, by id. Every write goes through this, so a turn can only ever be changed by
   *  something addressed to it — which is what keeps turn 2 from disturbing turn 1. */
  const patch = useCallback((id: string, fn: (t: Turn) => Turn) => {
    setTurns((prev) => prev.map((t) => (t.id === id ? fn(t) : t)));
  }, []);

  const run = useCallback(async (turn: Turn, instant: boolean) => {
    const ctl = new AbortController();
    controllers.current.set(turn.id, ctl);
    const inv = mockInvestigation(turn.question, turn.caseId, instant);
    /* topic AND view. The investigation decides both; copying only one left every technician
       turn rendering the requester's step list while the stream had correctly asked for the
       thinking view — the kind of miss a build cannot see, because both are valid strings. */
    patch(turn.id, (t) => ({ ...t, topic: inv.topic, view: inv.view, scope: inv.scope }));

    try {
      for await (const e of inv.run(ctl.signal) as AsyncIterable<NovaEvent>) {
        if (ctl.signal.aborted) return;
        patch(turn.id, (t) => applyEvent(t, e));

        if (e.type === 'answer') {
          /* THE FLOOR. The answer is already in the turn — the feed is still showing its last
             step pulsing, because `activeIndex` keeps something alive until the state moves on.
             Only after the floor has passed does the machine advance. */
          if (!instant) await wait(MIN_INVESTIGATION_MS - (Date.now() - turn.startedAt));
          if (ctl.signal.aborted) return;
          patch(turn.id, (t) => setState(t, 'answering'));
          await wait(instant ? 0 : ANSWER_REVEAL_MS);
          if (ctl.signal.aborted) return;
          patch(turn.id, (t) => setState(t, 'settled'));
          continue;
        }

        if (e.type === 'error') {
          patch(turn.id, (t) => ({ ...t, state: 'error' }));
          continue;
        }
      }
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') {
        patch(turn.id, (t) => ({
          ...t,
          state: 'error',
          error: { message: 'The investigation stopped unexpectedly.', recoverable: true },
        }));
      }
    } finally {
      controllers.current.delete(turn.id);
      patch(turn.id, (t) => ({ ...t, ended: true }));
    }
  }, [patch]);

  const askNova = useCallback<ConversationActions['askNova']>((question, opts) => {
    const q = String(question || '').trim();
    if (!q) return;
    /* Opening is part of asking. Otherwise every caller has to remember to open the drawer too,
       and the one that forgets produces an invisible investigation. */
    askAi?.open();
    const turn = newTurn(nextTurnId(), q, opts?.caseId, opts?.context);
    setTurns((prev) => [...prev, turn]);
    void run(turn, skipRef.current);
  }, [askAi, run]);

  const askFollowUp = useCallback<ConversationActions['askFollowUp']>((question, fromTurnId) => {
    askNova(question, { context: { followUpOf: fromTurnId } });
  }, [askNova]);

  const retryTurn = useCallback<ConversationActions['retryTurn']>((id) => {
    const old = turnsRef.current.find((t) => t.id === id);
    if (!old) return;
    /* Whatever was still in flight is abandoned first, or two streams write the same turn. */
    controllers.current.get(id)?.abort();
    controllers.current.delete(id);
    /* Same id, same question, same context — the turn KEEPS ITS PLACE in the thread rather than
       a second copy of the question appearing below the first. */
    const fresh = newTurn(id, old.question, old.caseId, old.context);
    setTurns((prev) => prev.map((t) => (t.id === id ? fresh : t)));
    void run(fresh, skipRef.current);
  }, [run]);

  const stopTurn = useCallback<ConversationActions['stopTurn']>((id) => {
    const ctl = controllers.current.get(id);
    if (!ctl) return;
    ctl.abort();
    controllers.current.delete(id);
    patch(id, (t) => (t.answer
      /* Stopped during the MINIMUM-VISIBLE floor: the answer already exists and the wait was
         ours, not the work's. Handing it over is the honest response to "stop" — refusing to
         show what is already computed would be theatre. */
      ? { ...t, state: 'settled' as const, ended: true }
      : { ...t, state: 'idle' as const, stopped: true, ended: true }));
  }, [patch]);

  const reset = useCallback(() => {
    controllers.current.forEach((c) => c.abort());
    controllers.current.clear();
    setTurns([]);
  }, []);

  useEffect(() => () => { controllers.current.forEach((c) => c.abort()); }, []);

  const state = useMemo<ConversationState>(
    () => ({ turns, skipInvestigation }), [turns, skipInvestigation],
  );
  const actions = useMemo<ConversationActions>(
    () => ({ askNova, askFollowUp, retryTurn, stopTurn, reset, setSkipInvestigation }),
    [askNova, askFollowUp, retryTurn, stopTurn, reset],
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
