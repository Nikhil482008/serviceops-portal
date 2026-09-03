import { useCallback, useEffect, useRef, useState } from 'react';
import {
  TEC8_CHECKS, TEC8_MOD_EXAMPLE, TEC8_MOD_REJECTED,
  TEC8_PLAN_ORIGINAL, TEC8_PLAN_REVISED, TEC8_STATES,
  approvalCovers, interpretModification, planSteps,
  type Tec8Outcome, type Tec8PlanState, type Tec8Settings, type Tec8State,
} from './tec8Model';

/* THE TEC-8 STATE MACHINE.
 *
 * One store, one set of transitions, and every screen in the flow is a pure function of it. That
 * is what makes §19's state switcher meaningful: jumping straight to `complete` produces exactly
 * the screen the flow would have produced, because there is nowhere else for the screen to come
 * from.
 *
 * ⚠️ TWO WAYS IN, AND ONLY ONE OF THEM IS THE PRODUCT. The buttons in the conversation move
 * through `canAdvance`; `goTo` is the REVIEW TOOL and skips it deliberately. They are separate
 * functions so that nothing in the product can accidentally acquire the switcher's freedom —
 * most importantly, nothing can reach `executing` without an approval having happened.
 */

/** One natural-language modification, kept so the thread can show the whole negotiation rather
 *  than only its outcome. */
export interface Tec8Round {
  text: string;
  /** The plan this round produced. */
  plan: Tec8PlanState;
  /** The plan it was produced FROM — what the diff is computed against. */
  previous: Tec8PlanState;
}

export interface Tec8Store {
  state: Tec8State;
  /** The live plan — what the reader is looking at and editing. */
  plan: Tec8PlanState;
  /** The natural-language rounds, oldest first. */
  rounds: Tec8Round[];
  /** The exact plan that was authorised. Null until Approve is pressed. */
  approved: Tec8PlanState | null;
  /** Nova could not act on the last sentence. */
  rejected: string | null;
  checkIndex: number;
  execIndex: number;
  outcome: Tec8Outcome;
}

const FRESH: Tec8Store = {
  state: 'empty',
  plan: TEC8_PLAN_ORIGINAL,
  rounds: [],
  approved: null,
  rejected: null,
  checkIndex: 0,
  execIndex: 0,
  outcome: 'success',
};

/** The demo round, used when a reviewer jumps straight past the modification. */
const DEMO_ROUND: Tec8Round = {
  text: TEC8_MOD_EXAMPLE,
  plan: TEC8_PLAN_REVISED,
  previous: TEC8_PLAN_ORIGINAL,
};

/** What each state looks like when it is JUMPED TO rather than arrived at.
 *
 *  Anything from `plan_updated` onwards assumes the demo modification has been made — that is
 *  the path the brief describes, and a reviewer opening `?state=complete` should see the plan
 *  the rest of the document talks about rather than an unmodified one. */
function presetFor(state: Tec8State, outcome: Tec8Outcome): Tec8Store {
  const revised = ['plan_updated', 'executing', 'complete', 'partial_failure'].includes(state);
  const done = state === 'complete' || state === 'partial_failure';
  const plan = revised ? TEC8_PLAN_REVISED : TEC8_PLAN_ORIGINAL;
  return {
    ...FRESH,
    state,
    plan,
    rounds: revised ? [DEMO_ROUND] : [],
    approved: ['executing', 'complete', 'partial_failure'].includes(state) ? plan : null,
    checkIndex: state === 'investigating' ? 0 : TEC8_CHECKS.length,
    execIndex: done ? planSteps(plan).length : 0,
    outcome: state === 'partial_failure' ? 'partial' : outcome,
  };
}

/* ── direct state access ───────────────────────────────────────────────── */

/** Short names for the same states, so `?state=plan` works as well as `?state=plan_ready`. */
const ALIAS: Record<string, Tec8State> = {
  plan: 'plan_ready',
  updated: 'plan_updated',
  approved: 'executing',
  execute: 'executing',
  failure: 'partial_failure',
  partial: 'partial_failure',
};

export function parseTec8State(raw: string | null | undefined): Tec8State | null {
  if (!raw) return null;
  const k = raw.trim().toLowerCase().replace(/-/g, '_');
  if ((TEC8_STATES as string[]).includes(k)) return k as Tec8State;
  return ALIAS[k] ?? null;
}

/** How long each check and each executed step is shown for. Not motion — these are the pace of
 *  the work itself, so reduced-motion does not shorten them; it only removes the animation. */
const CHECK_MS = 700;
const EXEC_MS = 850;

export function useTec8() {
  const [store, setStore] = useState<Tec8Store>(() => {
    /* Direct state access, read once. The app has no URL router (`activePage` is a `useState`),
       so this is a single query-param read rather than a second routing system. */
    const q = typeof window === 'undefined' ? null
      : new URLSearchParams(window.location.search).get('state');
    const wanted = parseTec8State(q);
    return wanted ? presetFor(wanted, wanted === 'partial_failure' ? 'partial' : 'success') : FRESH;
  });
  /* What a run that reaches the end should land on. A prototype control, not a product one. */
  const [outcome, setOutcome] = useState<Tec8Outcome>(store.outcome);
  const storeRef = useRef(store);
  storeRef.current = store;

  /* Keep the address bar honest, so any state is linkable and survives a reload. `replaceState`
     rather than `pushState`: the flow's own Back is the conversation, not the browser's. */
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    url.searchParams.set('state', store.state);
    window.history.replaceState(null, '', url.toString());
  }, [store.state]);

  /* ── the investigation ── */
  useEffect(() => {
    if (store.state !== 'investigating') return;
    const t = window.setInterval(() => {
      setStore((s) => {
        if (s.state !== 'investigating') return s;
        const next = s.checkIndex + 1;
        if (next >= TEC8_CHECKS.length) {
          return { ...s, checkIndex: TEC8_CHECKS.length, state: 'plan_ready' };
        }
        return { ...s, checkIndex: next };
      });
    }, CHECK_MS);
    return () => window.clearInterval(t);
  }, [store.state]);

  /* ── execution ── */
  useEffect(() => {
    if (store.state !== 'executing') return;
    const total = planSteps(store.approved ?? store.plan).length;
    const t = window.setInterval(() => {
      setStore((s) => {
        if (s.state !== 'executing') return s;
        const next = s.execIndex + 1;
        if (next >= total) {
          return {
            ...s,
            execIndex: total,
            state: s.outcome === 'partial' ? 'partial_failure' : 'complete',
          };
        }
        return { ...s, execIndex: next };
      });
    }, EXEC_MS);
    return () => window.clearInterval(t);
  }, [store.state, store.approved, store.plan]);

  /* ── the product's own transitions ── */

  const start = useCallback(() => {
    setStore((s) => ({ ...FRESH, state: 'investigating', outcome: s.outcome }));
  }, []);

  const modify = useCallback(() => {
    setStore((s) => (s.state === 'plan_ready' || s.state === 'plan_updated'
      ? { ...s, state: 'modify', rejected: null } : s));
  }, []);

  const cancelModify = useCallback(() => {
    setStore((s) => (s.state === 'modify'
      ? { ...s, state: s.rounds.length ? 'plan_updated' : 'plan_ready', rejected: null } : s));
  }, []);

  /** Apply a typed sentence. A sentence Nova cannot act on is REFUSED and said so — never
   *  approximated into a plan nobody asked for. */
  const applyModification = useCallback((text: string) => {
    setStore((s) => {
      const next = interpretModification(text, s.plan);
      if (!next) return { ...s, rejected: TEC8_MOD_REJECTED };
      return {
        ...s,
        state: 'plan_updated',
        plan: next,
        rounds: [...s.rounds, { text, plan: next, previous: s.plan }],
        rejected: null,
        /* Editing invalidates an approval that no longer describes this plan (§24). */
        approved: approvalCovers(s.approved, next) ? s.approved : null,
      };
    });
  }, []);

  /** A per-step edit: same rule about invalidating approval, and the transcript's last round is
   *  kept in step so the block on screen is the plan being described. */
  const setPlan = useCallback((plan: Tec8PlanState) => {
    setStore((s) => ({
      ...s,
      plan,
      rounds: s.rounds.length
        ? [...s.rounds.slice(0, -1), { ...s.rounds[s.rounds.length - 1], plan }]
        : s.rounds,
      approved: approvalCovers(s.approved, plan) ? s.approved : null,
    }));
  }, []);

  const setSettings = useCallback((settings: Tec8Settings) => {
    setPlan({ ...storeRef.current.plan, settings });
  }, [setPlan]);

  /** THE APPROVAL BOUNDARY. It snapshots the plan, and execution reads only that snapshot. */
  const approve = useCallback(() => {
    setStore((s) => (s.state === 'plan_ready' || s.state === 'plan_updated'
      ? { ...s, state: 'executing', approved: s.plan, execIndex: 0, outcome }
      : s));
  }, [outcome]);

  /** Re-run the failed tail. It re-executes the APPROVED plan, not the live one — a retry is
   *  finishing what was authorised, not authorising something new. */
  const retry = useCallback(() => {
    setStore((s) => (s.state === 'partial_failure'
      ? { ...s, state: 'executing', execIndex: 0, outcome: 'success' } : s));
  }, []);

  /** THE REVIEW TOOL. Deliberately outside `canAdvance`. */
  const goTo = useCallback((state: Tec8State) => {
    setStore(() => presetFor(state, state === 'partial_failure' ? 'partial' : outcome));
  }, [outcome]);

  const reset = useCallback(() => setStore({ ...FRESH, outcome }), [outcome]);

  return {
    store,
    outcome,
    setOutcome,
    start,
    modify,
    cancelModify,
    applyModification,
    setPlan,
    setSettings,
    approve,
    retry,
    goTo,
    reset,
  };
}

export type Tec8Api = ReturnType<typeof useTec8>;
