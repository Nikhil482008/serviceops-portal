/* The investigation event stream: its contract, and a mock that speaks it.
 *
 * ── WHY A STREAM AND NOT A CHAIN OF TIMEOUTS ─────────────────────────────────────────────────
 * A chain of setTimeouts puts the pacing, the content and the rendering in one place, and makes
 * the consumer the thing that "knows" an investigation has five steps. The day a real backend
 * arrives, all of it is rewritten.
 *
 * So the shape here is the one an SSE endpoint would produce: an async iterable of events.
 * `NovaInvestigation.run(signal)` is the ONLY seam. Swapping the mock for a `fetch`-backed reader
 * is a change to this file and nothing else — the consumer is never handed anything but an
 * iterator, so it cannot tell the difference.
 */
import {
  scriptFor, scriptForQuestion,
  type AnswerObject, type AskQuestion, type Beat, type DiscoveryRole, type PlanDiff,
  type PlanProposal, type PlanStep, type Script,
  type ScriptView, type StepMetric, type StepSource,
} from './scripts/registry';
import { fallbackScript, intentOf } from './scripts/fallbacks';

export interface NovaStep {
  id: string;
  label: string;
  /** Workspace axes. Ignored by the other two views. */
  lane?: string;
  phase?: string;
  metric?: StepMetric;
  /** What this check read. Surfaced by the reveal view's Sources tab. */
  sources?: StepSource[];
  /** What completing this check adds to the live scope strip. */
  tally?: Record<string, number>;
}

export type NovaEvent =
  /** OPTIONAL, and normally first: what this investigation intends to do.
   *
   *  ⚠️ NOT in the brief's list, and stated as an addition. The feed shows PENDING steps so the
   *  reader can see the scope, and nothing in step_start/step_complete says what is coming — a
   *  feed rendering pending rows without this would be inventing them, which is the same
   *  fabrication the brief forbids for discoveries. A stream that omits it simply has no pending
   *  rows and is otherwise identical. */
  | { type: 'plan'; steps: NovaStep[] }
  | { type: 'step_start'; id: string; label: string }
  | { type: 'step_complete'; id: string; label: string; sources?: StepSource[];
      tally?: Record<string, number> }
  | { type: 'discovery'; id: string; role: DiscoveryRole; headline: string; detail: string;
      tease?: string; support?: string[]; inference?: boolean; basis?: string }
  /** Nova needs something from the reader before it can carry on.
   *
   *  ⚠️ THE STREAM IS NOW BLOCKED. Nothing further arrives until `respond` is called with the
   *  answers (or the turn is aborted). Modelled on a real tool call — the server emits it, the
   *  client posts the result back, the stream resumes — rather than on a modal, because a
   *  question that does not actually gate the work is a question nobody needs to answer. */
  | { type: 'ask'; id: string; questions: AskQuestion[] }
  /** A PLAN for review. The stream is parked exactly as on an ask — nothing executes until
   *  `respond(proposal.id, { action: 'approve' })`. Every modification re-emits this event with
   *  a NEW proposal id and the diff, so an approval always names the exact plan it approves. */
  | { type: 'plan_proposed'; proposal: PlanProposal; diff?: PlanDiff }
  /** Execution begins — over the APPROVED proposal's steps, derived from nothing else. */
  | { type: 'exec_begin'; steps: Array<{ id: string; label: string }> }
  /** One execution step's progress. A `failed` step parks the stream awaiting
   *  `respond('retry:' + id, …)` — the partial state, with its retry, is a real state and not
   *  a claim of success. */
  | { type: 'exec_step'; id: string; status: 'active' | 'done' | 'failed'; note?: string;
      retry?: string }
  | { type: 'answer'; payload: AnswerObject }
  | { type: 'error'; message: string; recoverable: boolean };

/** What the controller is handed. `topic` is the phrase in the feed's header, and it comes from
 *  whoever produced the stream — never derived from the question by the consumer, because a
 *  consumer that guesses the subject will one day guess it wrong. */
export interface NovaInvestigation {
  topic: string;
  /** The identity row's action phrase while this runs, when the work names itself better with a
   *  verb — "Planning your night-shift handover". */
  activity?: string;
  /** How the feed should present this investigation. A property of the WORK, not of the
   *  component — so a backend can choose it, and the drawer never has to know who is asking. */
  view: ScriptView;
  /** What this investigation is working ACROSS. The workspace header reads it. */
  scope?: StepMetric[];
  run(signal: AbortSignal): AsyncIterable<NovaEvent>;
  /** Send the reader's answers back, releasing a stream parked on an `ask`.
   *
   *  THE SECOND SEAM, and the only other one. `run` is how events come out; this is how the one
   *  kind of input goes in. A real transport implements it as a POST carrying the tool result;
   *  the mock resolves a promise. Callers know neither.
   *
   *  Safe to call with an unknown id, twice, or after the turn ended — it is a no-op every
   *  time. A UI cannot be made to guarantee exactly-once delivery of a click. */
  respond?(askId: string, answers: Record<string, string>): void;
}

// ══ pacing ══════════════════════════════════════════════════════════════════════════════════

export const PACE_MIN = 600;
export const PACE_MAX = 1400;
/** Two gaps closer than this read as a fixed interval, which reads as a progress bar in disguise. */
const PACE_SPREAD = 160;

const sleep = (ms: number, signal: AbortSignal) => new Promise<void>((res, rej) => {
  if (signal.aborted) return rej(new DOMException('aborted', 'AbortError'));
  if (ms <= 0) return res();
  const t = setTimeout(res, ms);
  signal.addEventListener('abort', () => {
    clearTimeout(t);
    rej(new DOMException('aborted', 'AbortError'));
  }, { once: true });
});

/** Randomised, and never twice at nearly the same interval.
 *
 * The rejection is the point. Plain `Math.random` in a range happily produces 900, 905, 898, and
 * three near-identical gaps in a row is exactly the evenly-spaced tick the brief rules out. */
function* pacing(): Generator<number> {
  let last = 0;
  for (;;) {
    let ms = 0;
    for (let tries = 0; tries < 24; tries++) {
      ms = PACE_MIN + Math.floor(Math.random() * (PACE_MAX - PACE_MIN + 1));
      if (Math.abs(ms - last) >= PACE_SPREAD) break;
    }
    last = ms;
    yield ms;
  }
}

// ══ the mock ════════════════════════════════════════════════════════════════════════════════

/** Choose the script: an authored one by case id, otherwise the intent's fallback.
 *
 * A caseId that has no authored script falls through to the intent rather than erroring — the
 * use-case table has twenty rows and three of them are authored. */
export const pickScript = (question: string, caseId?: string): Script => {
  /* id first, then the question's own words, then the intent. The middle step is what makes a
     typed question and its use-case row the same investigation. */
  const s = scriptFor(caseId) ?? scriptForQuestion(question) ?? fallbackScript(intentOf(question));
  /* A TEC case with no authored script still gets the technician PRESENTATION. The view belongs
     to who is asking, and the fallback only decides what gets done — so the two are chosen
     separately rather than a fallback silently dragging the requester view along with it. */
  if (!s.view && caseId?.startsWith('TEC-')) return { ...s, view: 'reveal' };
  /* Same rule for leadership. An unauthored CXO case gets the workspace PRESENTATION over its
     intent fallback — thin, but consistent, and the fallback still decides what gets done. */
  if (!s.view && caseId?.startsWith('CXO-')) return { ...s, view: 'workspace' };
  return s;
};

/**
 * @param instant  Skip every pause. The DEV-ONLY skip toggle uses this: the same beats, the same
 *                 events, in the same order, with the waiting removed — so a skipped turn still
 *                 produces real discoveries and real counts rather than a different code path
 *                 that could drift from the real one.
 */
export function mockInvestigation(
  question: string,
  caseId?: string,
  instant = false,
): NovaInvestigation {
  const script = pickScript(question, caseId);
  /* Streams parked on an ask, by ask id. A Map rather than a single slot because nothing in the
     contract says a script may only ever have one question set outstanding. */
  const parked = new Map<string, (answers: Record<string, string>) => void>();

  return {
    topic: script.topic,
    activity: script.activity,
    view: script.view ?? 'steps',
    scope: script.scope,
    respond(askId, answers) {
      const release = parked.get(askId);
      if (!release) return;          // unknown, already released, or the turn is over
      parked.delete(askId);
      release(answers);
    },
    async *run(signal: AbortSignal) {
      const gaps = pacing();
      const pause = async () => { if (!instant) await sleep(gaps.next().value as number, signal); };
      /* Park the stream on an id until `respond` releases it. The ask branch below predates this
         helper and keeps its inline copy; the proposal branch parks repeatedly, so it earns one. */
      const park = (id: string) => new Promise<Record<string, string>>((resolve, reject) => {
        if (signal.aborted) return reject(new DOMException('aborted', 'AbortError'));
        parked.set(id, resolve);
        signal.addEventListener('abort', () => {
          parked.delete(id);
          reject(new DOMException('aborted', 'AbortError'));
        }, { once: true });
      });
      /* The plan the reader APPROVED — execution and the completion answer derive from this,
         which is the §16 guarantee: what was on screen at approval is what runs. */
      let approvedPlan: PlanProposal | null = null;

      /* The plan first, so the scope is legible before anything starts happening. */
      /* The plan carries the WHOLE scaffold — lanes and passes included — so the workspace can
         draw its columns before any of them has finished. A lane that only appears once its
         first check completes would make the surface jump as it filled. */
      const steps = script.beats
        .filter((b): b is Extract<Beat, { kind: 'step' }> => b.kind === 'step')
        .map((b) => ({
          id: b.id, label: b.label, lane: b.lane, phase: b.phase,
          metric: b.metric, sources: b.sources, tally: b.tally,
        }));
      if (steps.length) yield { type: 'plan', steps };

      for (let i = 0; i < script.beats.length; i++) {
        const b = script.beats[i];
        if (signal.aborted) return;

        if (b.kind === 'step') {
          yield { type: 'step_start', id: b.id, label: b.label };
          await pause();
          if (signal.aborted) return;
          yield { type: 'step_complete', id: b.id, label: b.label, sources: b.sources, tally: b.tally };
          /* A discovery or an answer that follows a step rides on it with NO pause, so the list
             never flickers through a frame in which nothing is running. */
          continue;
        }

        if (b.kind === 'discovery') {
          yield {
            type: 'discovery', id: b.id, role: b.role,
            headline: b.headline, detail: b.detail, tease: b.tease,
            support: b.support, inference: b.inference, basis: b.basis,
          };
          continue;
        }

        if (b.kind === 'ask') {
          yield { type: 'ask', id: b.id, questions: b.questions };
          /* AND STOP. Note this ignores `instant`: the dev skip toggle removes the time spent
             waiting on NOVA, and none of it is Nova's. Racing the abort signal is what lets a
             stopped or closed turn collect the parked generator instead of leaking it. */
          const answers = await new Promise<Record<string, string>>((resolve, reject) => {
            if (signal.aborted) return reject(new DOMException('aborted', 'AbortError'));
            parked.set(b.id, resolve);
            signal.addEventListener('abort', () => {
              parked.delete(b.id);
              reject(new DOMException('aborted', 'AbortError'));
            }, { once: true });
          });
          /* The mock does not branch on them — see TEC-03's note. They are threaded through
             anyway so the seam a real backend uses is exercised rather than imagined. */
          void answers;
          await pause();
          continue;
        }

        if (b.kind === 'proposal') {
          let current: PlanProposal = b.proposal;
          let diff: PlanDiff | undefined;
          let rev = 0;
          /* REVIEW LOOP. Approve breaks out; every other action derives a NEW proposal (new id,
             visible diff) and parks again — a modified plan always needs approval again. */
          for (;;) {
            yield { type: 'plan_proposed', proposal: current, diff };
            const res = await park(current.id);
            const action = res.action ?? 'approve';
            if (action === 'approve') break;
            const bump = (p: PlanProposal, d: PlanDiff): void => {
              rev += 1;
              current = { ...p, id: `${b.proposal.id}-r${rev}`, intro: 'Plan updated.' };
              diff = d;
            };
            if (action === 'revise') {
              /* The deterministic demo modification — whatever was typed, this is what the
                 prototype knows how to change. An honest mock, not a parser. */
              bump(b.revision.proposal, b.revision.diff);
            } else if (action === 'remove_step') {
              const gone = current.steps.find((s) => s.id === res.step);
              if (!gone) continue;
              bump({
                ...current,
                steps: current.steps.filter((s) => s.id !== res.step),
                impact: current.impact.filter((i) => i.stepId !== res.step),
              }, { removed: [gone.label] });
            } else if (action === 'edit_step') {
              const was = current.steps.find((s) => s.id === res.step);
              if (!was || !res.label || res.label === was.label) continue;
              bump({
                ...current,
                steps: current.steps.map((s) => (s.id === res.step ? { ...s, label: res.label } : s)),
              }, { updated: [{ label: 'Step', from: was.label, to: res.label }] });
            } else if (action === 'add_step') {
              const add = current.addable;
              if (!add || current.steps.some((s) => s.id === add.id)) continue;
              bump({ ...current, steps: [...current.steps, add], addable: undefined },
                { added: [add.label] });
            }
            await pause();
          }
          approvedPlan = current;

          /* EXECUTION — the approved steps, in order, ✓●○ driven by events. */
          yield {
            type: 'exec_begin',
            steps: current.steps.map((s: PlanStep) => ({ id: s.id, label: s.execLabel ?? s.label })),
          };
          const retried = new Set<string>();
          for (const s of current.steps) {
            if (signal.aborted) return;
            yield { type: 'exec_step', id: s.id, status: 'active' };
            await pause();
            if (s.fail && !retried.has(s.id)) {
              yield { type: 'exec_step', id: s.id, status: 'failed', note: s.fail.note, retry: s.fail.retry };
              /* PARTIAL COMPLETION IS A PARKED STATE, not a claim of success — nothing more
                 happens until the reader retries (or abandons the turn). */
              await park(`retry:${s.id}`);
              retried.add(s.id);
              yield { type: 'exec_step', id: s.id, status: 'active' };
              await pause();
            }
            yield { type: 'exec_step', id: s.id, status: 'done' };
          }
          continue;
        }

        if (b.kind === 'answer') {
          /* A plan-first turn's completion DERIVES its checklist from the approved plan's own
             `done` rows — a removed step's outcome cannot appear, a swapped notification reads
             as what actually ran. */
          const payload = approvedPlan
            ? {
              ...b.payload,
              kv: approvedPlan.steps.map((s) => s.done).filter((x): x is NonNullable<typeof x> => !!x),
            }
            : b.payload;
          yield { type: 'answer', payload };
          continue;
        }
        if (b.kind === 'error') {
          yield { type: 'error', message: b.message, recoverable: b.recoverable };
          return;
        }
      }
      /* And then the iterator simply ends. It does NOT emit a "finished" event, because a real
         stream can be cut off mid-flight and the consumer has to behave the same either way. */
    },
  };
}

export type {
  AnswerObject, AskChoice, AskQuestion, DiscoveryRole, PlanDiff, PlanImpactRow, PlanProposal,
  PlanStep, ScriptView, StepSource,
} from './scripts/registry';
