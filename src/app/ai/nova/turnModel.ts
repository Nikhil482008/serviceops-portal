/* One conversation turn, and the pure rules that read it.
 *
 * A turn is a question, the investigation it caused, and the answer it produced. The conversation
 * is an array of these. Turn 2 running cannot disturb turn 1, because a turn only ever changes in
 * response to an event addressed to its own id.
 *
 * Everything here is PURE. The same rules can be driven from a hand-written array of events in a
 * test without rendering anything, which is how the stall rule and the collapse rule are checked
 * against cases the authored scripts never produce.
 */
import type { AnswerObject, DiscoveryRole, NovaEvent, NovaStep, ScriptView } from './novaStream';
import type { AskQuestion, PlanDiff, PlanProposal, StepMetric, StepSource } from './scripts/registry';

export type StepStatus = 'pending' | 'active' | 'complete';
export interface FeedStep {
  id: string; label: string; status: StepStatus; sources?: StepSource[];
  lane?: string; phase?: string; metric?: StepMetric;
  /** What completing this check adds to the live scope strip. */
  tally?: Record<string, number>;
}
export interface FeedDiscovery {
  id: string; role: DiscoveryRole; headline: string; detail: string;
  /** The eyebrow shown above it by the reveal view. */
  tease?: string;
  /** Source labels this finding rests on — what "Supported by" lists. */
  support?: string[];
  /** An AI conclusion, not a system fact — labelled as such wherever it renders. */
  inference?: boolean;
  /** Evidence strength in words, never an invented percentage. */
  basis?: string;
  /** Which step had just finished when this arrived — recorded at apply time so the expanded
   *  trail can interleave findings with the checks that produced them, rather than listing all
   *  the steps and then all the findings as two unrelated columns. */
  afterStepId?: string;
}

/** A set of clarifying questions, and what came back.
 *
 * `answers` is questionId → choiceId, and a question MISSING from it was skipped rather than
 * answered — which is why the row badge is derived from this map instead of being stored per
 * question. Two places holding "was this answered" is two places that can disagree, and the map
 * is the one the stream was actually given.
 *
 * `status` is only ever pending or resolved. Whether the reader answered everything, some of it
 * or none of it is a property of `answers`, not a third state. */
export interface FeedAsk {
  id: string;
  questions: AskQuestion[];
  answers: Record<string, string>;
  status: 'pending' | 'resolved';
}

/** The plan a plan-first turn is parked on (or has approved). `diff` is what the latest
 *  modification changed — kept beside the proposal so a revision is always visible. */
export interface TurnPlan {
  proposal: PlanProposal;
  diff?: PlanDiff;
  status: 'review' | 'approved';
}

/** One step of the approved plan, executing. */
export interface ExecStepState {
  id: string;
  label: string;
  status: 'todo' | 'active' | 'done' | 'failed';
  /** Why it failed — shown beside the retry, never folded away. */
  note?: string;
  /** What the recovery action is called — "Retry notification", named, never a bare "Retry". */
  retry?: string;
}

/**  idle → investigating → answering → settled
 *                       ↘ error
 *
 * `answering` is a real state and not a formality: it is the ONLY state from which `settled` can
 * be reached (enforced in the reducer), which is what makes "the answer renderer is reachable
 * only from answering" a property of the machine rather than a rule someone has to remember. */
export type TurnState = 'idle' | 'investigating' | 'answering' | 'settled' | 'error';

export interface Turn {
  id: string;
  question: string;
  caseId?: string;
  context?: Record<string, unknown>;
  state: TurnState;
  topic: string;
  /** Chosen by the investigation, not by the drawer. */
  view: ScriptView;
  scope?: StepMetric[];
  steps: FeedStep[];
  discoveries: FeedDiscovery[];
  /** Clarifying questions this turn raised. Almost always empty — only a script that authored
   *  an `ask` beat produces one. */
  asks: FeedAsk[];
  /** The plan-first surface. Only a script with a `proposal` beat produces either. */
  plan: TurnPlan | null;
  execution: { steps: ExecStepState[] } | null;
  /** The identity row's action phrase, when the investigation named one. */
  activity?: string;
  answer: AnswerObject | null;
  error: { message: string; recoverable: boolean } | null;
  /** Wall-clock, for the minimum-visible-investigation floor. */
  startedAt: number;
  /** The stream ended. NOT the same as finished — a stream can end with no answer at all. */
  ended: boolean;
  /** The READER stopped this, rather than it failing. A distinct fact from `error`, because the
   *  two need opposite tones: a failure is red and unexpected, a stop is neutral and was asked
   *  for. Conflating them would tell someone their own decision went wrong. */
  stopped: boolean;
}

export const newTurn = (
  id: string, question: string, caseId?: string, context?: Record<string, unknown>,
): Turn => ({
  id,
  question,
  caseId,
  context,
  state: 'investigating',
  topic: '',
  view: 'steps',
  steps: [],
  discoveries: [],
  asks: [],
  plan: null,
  execution: null,
  answer: null,
  error: null,
  startedAt: Date.now(),
  ended: false,
  stopped: false,
});

/** Fold one event into one turn. */
export function applyEvent(t: Turn, e: NovaEvent): Turn {
  switch (e.type) {
    case 'plan':
      /* A plan may arrive after steps have started (a backend revising its scope), so known steps
         keep their status and only unknown ones are appended as pending. */
      return {
        ...t,
        steps: e.steps.map((p: NovaStep) => {
          const known = t.steps.find((x) => x.id === p.id);
          /* A revised plan must not drop the scaffold off a step that has already started. */
          if (known) {
            return {
              ...known,
              lane: p.lane ?? known.lane,
              phase: p.phase ?? known.phase,
              metric: p.metric ?? known.metric,
              sources: p.sources ?? known.sources,
              tally: p.tally ?? known.tally,
            };
          }
          return {
            id: p.id, label: p.label, status: 'pending' as StepStatus,
            lane: p.lane, phase: p.phase, metric: p.metric, sources: p.sources,
            tally: p.tally,
          };
        }),
      };

    case 'step_start': {
      const seen = t.steps.some((x) => x.id === e.id);
      /* One active at a time. Anything overtaken is completed — a backend that drops a
         `step_complete` must not leave two rows pulsing. */
      const steps = t.steps.map((x) => (
        x.id === e.id ? { ...x, label: e.label, status: 'active' as StepStatus }
          : x.status === 'active' ? { ...x, status: 'complete' as StepStatus }
            : x
      ));
      return { ...t, steps: seen ? steps : [...steps, { id: e.id, label: e.label, status: 'active' }] };
    }

    case 'step_complete': {
      const seen = t.steps.some((x) => x.id === e.id);
      const steps = t.steps.map((x) => (
        x.id === e.id
          ? {
            ...x, label: e.label, status: 'complete' as StepStatus,
            sources: e.sources ?? x.sources, tally: e.tally ?? x.tally,
          }
          : x));
      return {
        ...t,
        steps: seen ? steps
          : [...steps, { id: e.id, label: e.label, status: 'complete' as StepStatus, sources: e.sources }],
      };
    }

    case 'discovery': {
      if (t.discoveries.some((d) => d.id === e.id)) return t;   // a reconnecting stream repeats
      const done = t.steps.filter((x) => x.status === 'complete');
      return {
        ...t,
        discoveries: [...t.discoveries, {
          id: e.id, role: e.role, headline: e.headline, detail: e.detail, tease: e.tease,
          support: e.support, inference: e.inference, basis: e.basis,
          afterStepId: done.length ? done[done.length - 1].id : undefined,
        }],
      };
    }

    case 'ask': {
      if (t.asks.some((a) => a.id === e.id)) return t;   // a reconnecting stream repeats
      return {
        ...t,
        /* Whatever was running is finished FIRST. The stream has genuinely stopped to ask, so a
           row left pulsing underneath the question would be claiming work that is not happening
           — and it is the reader, not Nova, that everything is now waiting on. */
        steps: t.steps.map((x) => (x.status === 'active' ? { ...x, status: 'complete' as StepStatus } : x)),
        asks: [...t.asks, { id: e.id, questions: e.questions, answers: {}, status: 'pending' }],
      };
    }

    case 'plan_proposed':
      return {
        ...t,
        /* The investigation is over the moment a plan is up for review — nothing may look like
           it is still running behind a decision the reader now owns. */
        steps: t.steps.map((x) => (x.status === 'active' ? { ...x, status: 'complete' as StepStatus } : x)),
        plan: { proposal: e.proposal, diff: e.diff, status: 'review' },
      };

    case 'exec_begin':
      return {
        ...t,
        plan: t.plan ? { ...t.plan, status: 'approved' } : t.plan,
        execution: { steps: e.steps.map((s) => ({ id: s.id, label: s.label, status: 'todo' as const })) },
      };

    case 'exec_step': {
      if (!t.execution) return t;
      return {
        ...t,
        execution: {
          steps: t.execution.steps.map((s) => (
            s.id === e.id
              ? {
                ...s, status: e.status,
                note: e.status === 'failed' ? e.note : undefined,
                retry: e.status === 'failed' ? e.retry : undefined,
              }
              : e.status === 'active' && s.status === 'active'
                /* One active at a time, same rule as the investigation's steps. */
                ? { ...s, status: 'done' as const }
                : s
          )),
        },
      };
    }

    case 'answer':
      /* An answer ends the work, so nothing is left mid-flight behind it. The STATE is not set
         here — the controller sets `answering` once the minimum investigation time has passed,
         which is what stops an instant mock from flashing past the feed. */
      return {
        ...t,
        steps: t.steps.map((x) => (x.status === 'active' ? { ...x, status: 'complete' as StepStatus } : x)),
        answer: e.payload,
      };

    case 'error':
      /* Completed steps are NOT wiped. What was learned before the failure is still true, and
         throwing it away to show an error takes away the only thing the reader has. */
      return { ...t, error: { message: e.message, recoverable: e.recoverable } };

    default:
      return t;
  }
}

/** Record what the reader chose, and close the set when they are done with it.
 *
 * NOT an event, and deliberately so: every other change to a turn arrives from the stream, but
 * this one originates in the UI and the reader must see it land immediately (law 6). It is
 * applied optimistically and the stream is released in the same breath, so no round trip sits
 * between a click and its acknowledgement.
 *
 * `answers` MERGES rather than replaces, so one pick at a time is a legal call — which is what
 * lets every pick be written to the turn as it happens instead of being held in the card. Close
 * the drawer half way through and the choices are still there, because a turn outlives the view
 * of it.
 *
 * Only a PENDING ask changes. A second click, a replayed event, or a click on a turn that has
 * already moved on is a no-op rather than a rewrite of settled history. */
export function recordAsk(
  t: Turn, askId: string, answers: Record<string, string>, done: boolean,
): Turn {
  const target = t.asks.find((a) => a.id === askId);
  if (!target || target.status !== 'pending') return t;
  return {
    ...t,
    asks: t.asks.map((a) => (a.id === askId ? {
      ...a,
      answers: { ...a.answers, ...answers },
      status: done ? 'resolved' as const : 'pending' as const,
    } : a)),
  };
}

/** Has every question in this set been answered? The card asks before it closes the set, so the
 *  rule lives here rather than being re-derived at each call site. */
export const askComplete = (a: FeedAsk): boolean =>
  a.questions.every((q) => !!a.answers[q.id]);

/** The question set the turn is parked on, if any. */
export const pendingAsk = (t: Turn): FeedAsk | null =>
  t.asks.find((a) => a.status === 'pending') ?? null;

/** Parked on a plan awaiting the reader's approval. */
export const planPending = (t: Turn): boolean =>
  !!t.plan && t.plan.status === 'review' && !t.answer && !t.stopped && t.state !== 'error';

/** Set a turn's state, refusing the one transition that would break the machine.
 *
 * ⚠️ `settled` is reachable ONLY from `answering`. That is the enforcement behind "the answer
 * renderer must be reachable only from the answering state": the renderer draws on
 * `answering | settled`, and there is no route into `settled` that does not pass through
 * `answering` — not from `investigating`, not from `idle`, not from `error`. */
export function setState(t: Turn, state: TurnState): Turn {
  if (state === 'settled' && t.state !== 'answering') return t;
  if (state === 'answering' && t.state !== 'investigating') return t;
  return { ...t, state };
}

/** Which row is pulsing.
 *
 * ⚠️ DERIVED, ON PURPOSE — this is how "the feed must never visibly complete and then sit idle"
 * is enforced. It is not a rule the controller has to remember at each place a stream can end; it
 * is a property of the state. While there is no answer and no error, SOMETHING is always active:
 * the genuinely active step if there is one, and otherwise the last step that completed, which
 * goes back to pulsing.
 *
 * That covers three cases with one expression: the stream running out of steps, the ordinary gap
 * between one step completing and the next starting, and the hold while the minimum investigation
 * time runs down after an answer has already arrived. */
export function activeIndex(t: Turn): number {
  /* Terminal FIRST. A stop ends the turn exactly as an answer or an error does, and without
     this the row the reader stopped on would keep pulsing forever. */
  if (t.answer || t.error || t.stopped || !t.steps.length) return -1;
  /* PARKED ON A QUESTION. Nothing is running, and the always-something-pulsing rule above must
     not paint over that: a row ticking away while Nova waits on the reader tells them their
     answer is optional, and it is the only thing the turn is blocked on. */
  if (pendingAsk(t)) return -1;
  /* PARKED ON A PLAN, or executing one. The investigation trail is over either way — the plan
     card or the execution list is what is alive now, and a check pulsing beneath a decision
     the reader owns would claim work that is not happening. */
  if (t.plan) return -1;
  const live = t.steps.findIndex((x) => x.status === 'active');
  if (live >= 0) return live;
  for (let i = t.steps.length - 1; i >= 0; i--) if (t.steps[i].status === 'complete') return i;
  return -1;
}

/* ── the evidence view ─────────────────────────────────────────────────── */

/** What a source's authority label reads as. */
export const AUTHORITY_LABEL: Record<NonNullable<StepSource['authority']>, string> = {
  system: 'System record',
  kb: 'Approved KB',
  history: 'Historical case',
  user: 'User provided',
  inference: 'AI inference',
};

/** A source's effective authority — authored, else defaulted by kind. Knowledge articles are
 *  approved KB; everything else the system read is a system record. */
export const sourceAuthority = (s: StepSource): NonNullable<StepSource['authority']> =>
  s.authority ?? (s.kind === 'kb' ? 'kb' : 'system');

export interface TurnEvidence {
  /** Non-gap discoveries — the key findings. */
  findings: FeedDiscovery[];
  /** The limits on the answer. Never folded away. */
  gaps: FeedDiscovery[];
  /** Every source a completed check read, deduped by label, in reading order. */
  sources: StepSource[];
}

/** THE ONE EVIDENCE VIEW. The provenance strip, the "How Nova knows" fold and the evidence
 *  drawer all read this — one derivation, so three surfaces cannot disagree about what the
 *  answer rests on. Sources come only from checks that COMPLETED: a check that never finished
 *  read nothing anyone should be told about. */
export function evidenceOf(t: Turn): TurnEvidence {
  const seen = new Map<string, StepSource>();
  t.steps.forEach((s) => {
    if (s.status !== 'complete') return;
    s.sources?.forEach((src) => { if (!seen.has(src.label)) seen.set(src.label, src); });
  });
  return {
    findings: t.discoveries.filter((d) => d.role !== 'gap'),
    gaps: t.discoveries.filter((d) => d.role === 'gap'),
    sources: [...seen.values()],
  };
}

/** One figure on the live scope strip: how much of something the investigation has read. */
export interface ScopeCount { n: number; unit: string }

/** The live scope — the strip's numbers, DERIVED.
 *
 * The sum of every COMPLETED check's tally, in the order the units first appeared. Completed
 * only, deliberately: a number moves at the moment the check that earned it lands, so the strip
 * ticks in step with the work rather than on a schedule of its own — and a stalled stream
 * honestly shows a strip that has stopped growing. Scripts with no tallies produce an empty
 * scope, which is what lets a view treat "this script quantifies itself" as an opt-in. */
export function liveScope(t: Turn): ScopeCount[] {
  const totals = new Map<string, number>();
  for (const s of t.steps) {
    if (s.status !== 'complete' || !s.tally) continue;
    for (const [unit, n] of Object.entries(s.tally)) {
      totals.set(unit, (totals.get(unit) ?? 0) + n);
    }
  }
  return [...totals.entries()].filter(([, n]) => n > 0).map(([unit, n]) => ({ n, unit }));
}

/** "1 KB article" / "4 KB articles". Units here are simple English nouns; the day one is not,
 *  give the unit its own plural in the tally key rather than teaching this function grammar. */
export const scopeLabel = (n: number, unit: string): string =>
  n === 1 ? unit : `${unit}s`;

/** How many steps genuinely finished. Reads the stored status, not the derived one — a step that
 *  is pulsing again because the stream stalled has still completed. */
export const completedCount = (t: Turn): number =>
  t.steps.filter((x) => x.status === 'complete').length;

/** The collapsed row's counts. Computed from the events that actually arrived. */
export const turnCounts = (t: Turn) => ({
  checks: completedCount(t),
  findings: t.discoveries.length,
});

/** Steps hidden behind the "N checks completed" row while a long investigation is running.
 *  Only COMPLETED steps at the head can collapse: the active row and whatever the plan says is
 *  still coming are the two things the list is being read for. */
export const STEP_WINDOW = 6;
export function collapseSteps(steps: FeedStep[], window = STEP_WINDOW): {
  hidden: FeedStep[]; shown: FeedStep[];
} {
  if (steps.length <= window) return { hidden: [], shown: steps };
  const firstUnfinished = steps.findIndex((x) => x.status !== 'complete');
  const ceiling = firstUnfinished === -1 ? steps.length : firstUnfinished;
  const n = Math.min(steps.length - window, ceiling);
  if (n <= 0) return { hidden: [], shown: steps };
  return { hidden: steps.slice(0, n), shown: steps.slice(n) };
}

/* `EVIDENCE_LABEL` was here: a role → caption map ("Routed as" / "Based on" / "Not checked") for
   the flat evidence footer. That footer is gone — EvidenceBlock splits findings by role instead
   of captioning them, because the split is the useful part: a GAP is a limit on the answer and
   stays visible, everything else is justification and collapses. Nothing rendered the captions
   any more, so they are deleted rather than left to rot. `DiscoveryRole` itself is still the
   thing that decides which side a finding lands on. */
