import { REQUESTER_SCRIPTS } from './requesterScripts';

/* The authored investigation scripts, by case id.
 *
 * A script is DECLARATIVE — a list of beats, not a list of events. One `step` beat becomes a
 * `step_start` and, a pause later, a `step_complete`; the emitter in `novaStream.ts` does that
 * expansion. Writing events by hand would mean every script repeating the same start/complete
 * pairing, and one of them eventually getting it wrong.
 *
 * ⚠️ NOTHING IN THE UI IMPORTS THIS FILE. The only consumer is the mock emitter. That is what
 * makes "no component is handed a canned answer object" structurally true rather than a
 * convention: a component cannot render an answer it has no way to obtain, and the only route
 * from here to the screen is through the event stream and the turn reducer.
 *
 * Three cases are authored in full. Everything else resolves to an intent fallback — see
 * `fallbacks.ts`. That is deliberate: the thing under evaluation is pacing, and twenty
 * hand-written scripts would be twenty chances to disagree about it.
 */

/** One row of a draft card. */
export interface AnswerField {
  label: string;
  value: string;
  /** Nova decided this; the reader did not say it. Marked on the card because they are about to
   *  approve it. */
  inferred?: boolean;
}

/** What a discovery is DOING for the answer, which is what the evidence footer labels it as.
 *
 *  routing  — why it landed where it landed
 *  evidence — what the conclusion rests on
 *  gap      — what was NOT established. The most valuable row and the easiest to leave out.
 */
export type DiscoveryRole = 'routing' | 'evidence' | 'gap';

/** What an `answer` event carries.
 *
 * `form` selects the renderer. Modelled on the reference portal's handler shape so the two can be
 * compared field for field; `draft` is the "New incident" card, `text` is a plain answer.
 *
 * ⚠️ THERE IS NO `evidence` FIELD, on purpose. The footer is DERIVED from the turn's discoveries
 * (see `NovaAnswer`). It used to be authored here as three static strings that happened to match
 * what the feed had said a moment earlier — and two strings that happen to agree are two strings
 * that will one day disagree. The reader watches Nova surface a fact during the wait and then
 * meets that same fact under the draft; that is only true if it is the same object. */
/** One column of the report's chart. */
export interface ChartBar { label: string; value: number }

/** A compact key/value row — status, owner, next update, SLA. Structured information rendered
 *  structurally, instead of four facts buried in one sentence a reader has to parse. */
export interface AnswerKV { label: string; value: string; tone?: 'ok' | 'warn' | 'risk' }

/** A ranked table. `align` is per column so numbers can sit right where they belong. */
export interface AnswerTable {
  cols: string[];
  rows: string[][];
  /** Number the rows 1..n. For "top N" answers, the rank IS part of the reading. */
  ranked?: boolean;
  /** Column index whose value drives an inline bar behind the cell — a table that is also a
   *  ranking, without a second chart to keep in step with it. */
  barCol?: number;
}

/** A headline number. Three of these is a leadership answer's whole first screen. */
export interface AnswerMetric {
  label: string;
  value: string;
  /** "↓ 8.4% vs last month" — a number alone is not an answer, it is a reading. */
  delta?: string;
  direction?: 'up' | 'down';
  /** Is the direction GOOD? Fewer open tickets is good; more breaches is not. Without this the
   *  renderer would have to guess, and it would guess wrong half the time. */
  good?: boolean;
}

/* ── REQUESTER BLOCKS ─────────────────────────────────────────────────────────────────────────
 * The requester answers compose from ONE set of primitives, described as data. A script says
 * WHAT the answer contains; `RequesterBlocks` renders it and wires it to the mock ticket store.
 * Every block that changes state names its mutation, follows propose → confirm → ConfirmBanner,
 * and nothing mutates on the initial answer. */

export interface DraftField {
  label: string; value: string;
  inferred?: boolean;
  /** Inline-editable on click — Subject as text, Priority as a small select. */
  editable?: boolean;
  options?: string[];
}
export interface DiffRow { label: string; from: string; to: string }
export interface BannerSpec {
  /** May contain `{ref}`, replaced with the mutated record's ref. */
  text: string;
  actions?: Array<{ label: string; ask?: string }>;
}

export type RequesterBlock =
  /** AnswerHead as a block, so a two-part answer (REQ-07) can carry two of them. */
  | { w: 'head'; n?: string; text: string; body?: string }
  | { w: 'confidence'; text: string }
  | { w: 'draft'; id: string; title: string; fields: DraftField[];
      primary: string; secondary: string; banner: BannerSpec;
      /** followUps swap to the answer's `followUpsAfter` once created. */
      category?: string }
  | { w: 'status'; ref: string; actions?: Array<{ label: string; ask?: string }> }
  | { w: 'diff'; id: string; title: string; rows: DiffRow[]; why: string;
      primary: string; secondary: string; banner: BannerSpec;
      mutation: 'escalate' | 'reopen' | 'raise-priority'; ref: string }
  | { w: 'steps'; id: string; tickable?: boolean;
      /** Either one list, or one per platform (toggle shown when both exist). */
      steps?: string[]; windows?: string[]; mac?: string[];
      /** Authored alternates the ••• menu swaps in — never generated. */
      short?: string[]; detail?: string }
  | { w: 'yesno'; id: string; prompt: string;
      yes: { record: string; askAfter?: string }; no: { ask: string } }
  | { w: 'note'; id: string; ref: string; prefill: string; title?: string;
      primary: string; secondary: string; banner: BannerSpec;
      /** "This update also changes" rows — applied to the ticket on confirm. */
      changes?: Array<DiffRow & { patch?: 'assets' }>;
      /** The note IS a resolution note — confirming also closes the ticket (REQ-07). */
      close?: boolean }
  | { w: 'list' }
  | { w: 'statchips' }
  | { w: 'agebar'; open: string; typical: string; pct: number }
  | { w: 'resolution'; ref: string; action?: { label: string; ask: string } }
  | { w: 'timeline'; steps: Array<{ label: string; note: string }>; footer: string }
  | { w: 'picker'; id: string; prompt: string; options: string[]; confirm: string;
      draftId: string; banner: BannerSpec }
  | { w: 'team'; heading: string; members: Array<{ name: string; onShift: boolean; load: string }> }
  | { w: 'closelist'; id: string; primary: string; banner: BannerSpec };

/** A follow-up chip: functional, or shown-but-disabled ("Not in this demo"). */
export type FollowUp = string | { label: string; disabled: true };

export interface AnswerObject {
  form: 'draft' | 'text' | 'report';
  /** What the answer IS, in a few words.
   *
   *  ⚠️ `headline` OUTRANKS THIS. When a script authors both, the headline is what renders as
   *  the conclusion and `title` becomes the caption of the object below it — the draft card's
   *  name. For a `text` answer with a headline, `title` is not rendered at all: two conclusions
   *  in a row is worse than one, and the headline is the better-written of the two. Authoring a
   *  title for such a script is therefore writing copy nobody will read. */
  title: string;
  /** THE CONCLUSION, and the largest thing in the response.
   *
   *  Separate from `title` on purpose. `title` names the artefact ("New incident"); this is what
   *  the reader came for ("Waiting on the vendor, not on you"). When both exist the headline
   *  leads and the title captions the object below it — answering before explaining. */
  headline?: string;
  /** The lead line above the card. Supports **inline emphasis**: ticket ids, numbers, dates,
   *  statuses. Never whole sentences — see `Emph` in AnswerBlock. */
  text?: string;
  /** Structured facts, rendered as a compact key/value grid rather than as prose. */
  kv?: AnswerKV[];
  /** Structured data, rendered as a table. */
  table?: AnswerTable;
  /** Headline numbers, rendered as cards. */
  metrics?: AnswerMetric[];
  /** What the data MEANS, stated before the data itself. Data -> insight -> evidence, never
   *  data -> "you figure it out". */
  insight?: string;
  fields?: AnswerField[];
  /* WHAT THESE TWO BUTTONS ARE, declared rather than guessed.
   *
   * They were rendered identically everywhere — a solid primary and a quiet ghost — while the
   * labels underneath were four different KINDS of thing: create a record, open one, run an
   * export, and (five times out of ten) ask Nova another question. Law 16: the same treatment
   * for different actions is a lie about what will happen. Law 7: only a real commitment earns
   * the dominant button.
   *
   * Declaring it on the fixture is deliberate. The alternative is sniffing the label with
   * `toLowerCase().includes()`, which is exactly the pattern this module was built to replace. */
  footer?: {
    run: string;
    cancel: string;
    /** `run` is another question for Nova, not a commitment. It asks. */
    runAsks?: boolean;
    /** `cancel` is an alternative question, not a dismissal. */
    cancelAsks?: boolean;
  };
  aside?: string;
  /** THE PROVENANCE STRIP — the two-to-four source labels that sit directly under the answer
   *  as "Based on" chips. Authored, because the strip is a claim about what the answer RESTS
   *  ON, not a list of everything the investigation touched; each label must name a source some
   *  check actually read. */
  basedOn?: string[];
  /** Analytics provenance: the scope of the data behind a numbers answer — record count, date
   *  range, population. "4,218 incidents · Jun 1–30". What makes a chart answer checkable. */
  dataScope?: string;
  /** Follow-ups this ANSWER earns. Authored per script rather than drawn from a generic list —
   *  "what happens after I create it?" is only a sensible question under a draft card. An entry
   *  may be `{ label, disabled: true }`: shown so the intent is visible, but not in this demo. */
  followUps?: FollowUp[];
  /** The chip set AFTER the answer's main block is confirmed (REQ-01: post-creation). */
  followUpsAfter?: FollowUp[];
  /** The interactive requester surface — see RequesterBlock. Rendered between the answer text
   *  and the evidence fold, wired to the mock ticket store. */
  blocks?: RequesterBlock[];
  /** The ••• menu's TYPE-SPECIFIC top group for this answer. The common group (Regenerate ·
   *  View sources · Flag) is appended by the bar itself. */
  menu?: string[];
  /* ── report form only ─────────────────────────────────────────────── */
  /** The headline movement: "SLA breaches ↑ 18%". */
  metric?: { label: string; value: string; direction?: 'up' | 'down' };
  chart?: ChartBar[];
  /** What is behind the movement, in one phrase. */
  driver?: string;
  /* ── reveal form ────────────────────────────────────────────────── */
  /** The single next action, in a sentence. Separate from `footer.run`, which is the BUTTON: the
   *  sentence says what to do and why now, the button does it. Collapsing them loses the why. */
  recommendation?: string;
  /** SCAFFOLDING, not product content. Rendered in its own dev register so it can never be
   *  mistaken for something Nova said — it was previously in `text`, which put dev-facing copy in
   *  the same voice as a real answer, and above the answer's own headline. */
  devNote?: string;
}

/** How an investigation presents itself.
 *
 *  steps    — the full list, every row visible as it happens. The requester view: someone who
 *             does not do this for a living wants to SEE that work is being done.
 *  thinking — two lines only, the last thing finished and the thing running now, expandable to
 *             the whole trail with its sources. The technician view: they know what a triage
 *             looks like, so the running commentary is noise until they want to audit it. */
export type ScriptView = 'steps' | 'thinking' | 'workspace' | 'reveal';

/** A number a check LANDS ON. The workspace view shows the label while a check is running and
 *  this once it finishes, so a row reads "Counting breaches" → "27 breached" — the response
 *  forming in front of the reader rather than a spinner that resolves to prose. */
export interface StepMetric { value: string; label: string }

/** Something a check actually READ.
 *
 *  Typed rather than a bare string so the Sources tab can group and ICON them without guessing
 *  from the text — "INC-4390" and "Change calendar" are different kinds of thing, and inferring
 *  that from a prefix works right up until a source is named something unexpected. */
export interface StepSource {
  label: string;
  kind: 'ticket' | 'kb' | 'doc' | 'data';
  /** WHAT KIND OF TRUTH this is. A system record and an AI inference must never wear the same
   *  label — confusing the two is the one failure a trust surface exists to prevent. Defaults
   *  by `kind` (kb → approved KB, everything else → system record); authored only where the
   *  default would be wrong (a HISTORICAL case, a USER claim, an INFERENCE). */
  authority?: 'system' | 'kb' | 'history' | 'user' | 'inference';
  /** "Updated 3h ago" — authored and deterministic. Operational data ages; a source that will
   *  not say how old it is asks for trust it has not earned. */
  freshness?: string;
  /** One line of what the source currently holds — "Status · Waiting on vendor". The evidence
   *  drawer's summary row, so a reader can verify WITHOUT opening the original. */
  detail?: string;
}

/** One option on a clarifying question.
 *
 * `detail` is the second line under the label — what picking it would MEAN, not a restatement
 * of it. A choice a reader cannot tell apart from its neighbour is a choice that costs time
 * without buying anything.
 *
 * `other` turns the option into a TEXT FIELD. A fixed list is a guess about what the answer
 * could be, and the person answering is the one who knows; without this, a technician whose
 * situation is not among the three has to pick the closest wrong one, which is worse than not
 * asking. It is authored per question rather than injected everywhere, because there are
 * questions where free text is genuinely not an answer. */
export interface AskChoice { id: string; label: string; detail?: string; other?: boolean }

/** A question Nova asks BEFORE it answers.
 *
 * ⚠️ EVERY QUESTION MUST CARRY AN ESCAPE, and it is authored rather than injected — the last
 * choice on each of TEC-03's three is "I don't know yet". Law 13 says preselect the safest
 * option, and it also says never let a default create a commitment nobody made: preselecting an
 * answer to a DIAGNOSTIC question does exactly that, because Nova would then be told something
 * the technician never said. So nothing is preselected, and the way out is a real answer the
 * reader picks on purpose. */
export interface AskQuestion {
  id: string;
  question: string;
  choices: AskChoice[];
}

/* ── THE PLAN-FIRST INTERACTION (TEC-07) ─────────────────────────────────────────────────────
 * A complex request is not answered — it is PLANNED, reviewed, optionally revised, APPROVED,
 * and only then executed. The proposal beat parks the stream exactly the way an ask does: the
 * plan on screen at the moment of approval is the plan that executes, because execution is
 * derived from the approved proposal object and from nothing else. */

/** One step of a proposed plan. `label` is what the reader approves; `execLabel` is the same
 *  work in the present tense while it runs; `done` is the completion row it earns — derived
 *  into the final answer, so a removed step's outcome can never appear. */
export interface PlanStep {
  id: string;
  label: string;
  detail?: string;
  execLabel?: string;
  done?: AnswerKV;
  /** Fails deterministically on first execution — the partial-completion path. `retry` names
   *  the recovery action; a retried step succeeds. */
  fail?: { note: string; retry: string };
}

/** One row of "What will change" — either a transition (`from → to`) or a stated consequence.
 *  `stepId` ties it to the step that causes it, so removing the step removes the claim. */
export interface PlanImpactRow {
  label: string;
  from?: string;
  to?: string;
  value?: string;
  stepId?: string;
}

/** What was different about a revised plan — rendered above the new proposal so a modification
 *  is always VISIBLE, never a silent swap. */
export interface PlanDiff {
  removed?: string[];
  updated?: Array<{ label: string; from: string; to: string }>;
  added?: string[];
}

export interface PlanProposal {
  id: string;
  /** "Here's how I'll handle this." — the one line above the plan. */
  intro: string;
  steps: PlanStep[];
  impact: PlanImpactRow[];
  /** Evidence points only — user-safe facts, never reasoning. The "Why Nova recommends this"
   *  fold. */
  evidence?: string[];
  /** Button labels, declared: the primary names its consequence ("Approve & run"). */
  approve: string;
  modify: string;
  /** Ghost text seeding the modify input — the deterministic demo modification, offered rather
   *  than hidden. */
  hint?: string;
  /** ONE optional step "+ Add step" can append — declared, so an addition is still authored
   *  content rather than a step the prototype pretends it can invent. */
  addable?: PlanStep;
}

export type Beat =
  /** `sources` is what the step actually READ. Optional, and only the thinking view surfaces it —
   *  a technician auditing an answer wants to know where it came from; a requester does not.
   *  `lane` and `phase` are the workspace view's two axes: WHERE a check is looking (Tickets,
   *  SLA, Teams…) and WHICH pass it belongs to. Both optional; the other two views ignore them. */
  | { kind: 'step'; id: string; label: string; sources?: StepSource[];
      lane?: string; phase?: string; metric?: StepMetric;
      /** What completing this check ADDS to the investigation's quantified scope — e.g.
       *  `{ ticket: 4, 'data source': 1 }`. The live strip is the running SUM of these over
       *  completed checks, which is what keeps it honest: a number can only move because a
       *  named check finished, and only by what that check's own copy claims it read. */
      tally?: Record<string, number> }
  /** `tease` is the eyebrow above a finding — "Interesting…", "One final check". It is the whole
   *  mechanic of the reveal view: a line that says something was found WITHOUT saying what, so the
   *  next second is spent wanting to know rather than waiting. Optional; the other views ignore
   *  it, and a finding with none still renders. */
  | { kind: 'discovery'; id: string; role: DiscoveryRole; headline: string; detail: string;
      tease?: string;
      /** The source labels this finding rests on — what "Supported by" lists. Authored beside
       *  the finding, so a finding cannot claim support the script never gave it. */
      support?: string[];
      /** An AI CONCLUSION rather than a system fact. Rendered with its own label, because the
       *  reader must never mistake Nova's judgement for an authoritative record state. */
      inference?: boolean;
      /** Evidence strength IN WORDS — "Strong evidence · 6 matching incidents" — never a
       *  fabricated percentage. */
      basis?: string }
  /* ASK THE READER, then wait. The emitter STOPS here until the answers come back — see
   *  `novaStream.ts`. That is the honest shape: a real backend emits a tool call, the client
   *  posts the result, and the stream resumes. A beat that fired and carried on would be a
   *  question nobody had to answer, which is a form nobody would trust. */
  | { kind: 'ask'; id: string; questions: AskQuestion[] }
  /* PROPOSE A PLAN, then wait. Parks the stream like an ask: nothing executes until the reader
   * approves, and every modification produces a NEW proposal that needs approval again. The
   * `revision` is the deterministic natural-language demo modification (§15 of the plan-first
   * brief); step-level edits and removals are derived from the current proposal in the emitter. */
  | { kind: 'proposal'; proposal: PlanProposal;
      revision: { proposal: PlanProposal; diff: PlanDiff } }
  | { kind: 'answer'; payload: AnswerObject }
  | { kind: 'error'; message: string; recoverable: boolean };

export interface Script {
  /** The phrase in the feed's header: "Nova is investigating ___". */
  topic: string;
  /** How this script is reached when there is NO case id — i.e. when someone TYPED the question.
   *
   *  Without this, clicking a use-case row and typing that same row's question by hand produced
   *  different investigations: the row carried an id and got the authored script, the typed text
   *  carried nothing and fell through to the intent fallback. "Indistinguishable from having
   *  typed it by hand" has to be true in both directions. */
  match?: RegExp;
  /** Defaults to 'steps'. */
  view?: ScriptView;
  /** The header strip: what this investigation is working across. Shown by the workspace view so
   *  the scale is legible before any of it has finished. */
  scope?: StepMetric[];
  /** The identity row's ACTION phrase while this script runs — "Planning your night-shift
   *  handover" — for scripts whose work is better named by a verb than by "Looking into". */
  activity?: string;
  beats: Beat[];
}

export const step = (id: string, label: string, sources?: StepSource[]): Beat =>
  ({ kind: 'step', id, label, sources });

/** A workspace / chapter check: which lane and pass it belongs to, the number it lands on, and
 *  what it read to get there. */
const lane = (
  id: string, phase: string, laneName: string, label: string,
  metric?: StepMetric, sources?: StepSource[],
): Beat => ({ kind: 'step', id, label, phase, lane: laneName, metric, sources });

/** Attach a tally to a step beat. A wrapper rather than a seventh positional argument on
 *  `lane()` — six unlabelled arguments is already at the edge of readable. */
const tallied = (b: Beat, tally: Record<string, number>): Beat => ({ ...b, tally });

/* Shorthands. Sources are written beside the check that read them, so a script author cannot
   add a source without saying which check it belongs to. */
export const tk = (label: string, x?: Partial<StepSource>): StepSource => ({ label, kind: 'ticket', ...x });
export const kb = (label: string, x?: Partial<StepSource>): StepSource => ({ label, kind: 'kb', ...x });
export const doc = (label: string, x?: Partial<StepSource>): StepSource => ({ label, kind: 'doc', ...x });
export const dat = (label: string, x?: Partial<StepSource>): StepSource => ({ label, kind: 'data', ...x });

/* ── REQ-01 ──────────────────────────────────────────────────────────
   "My laptop screen flickers whenever I put it on the docking station. Can you log a ticket?"

   Nine checks and three findings — the middle of the run now does real narrowing rather than
   jumping from "similar tickets exist" to a draft. The third finding is a LIMIT, because an
   investigation that only ever reports good news is a demo rather than a tool.

   ⚠️ The ROUTED AS row in the evidence footer is back, and it is back honestly: there is now a
   `routing` finding behind it. It had been dropped when the footer became derived, because no
   discovery carried that claim — inventing one to fill the footer is the thing to avoid, adding
   the check that earns it is not. */
const REQ_01: Script = {
  topic: 'your laptop display issue',
  match: /laptop.*(flicker|dock)|dock.*laptop|screen flickers/i,
  beats: [
    step('r1s1', 'Reading your description'),
    /* SOURCES on the checks that actually read something. TEC-01 has carried these since the
       context tabs landed; the requester scripts never did, so "Why Nova says this" had a
       Sources section that could not appear on the most-used path. A source is attached to the
       CHECK that opened it, never to the answer — which is what stops the list from naming
       anything the investigation did not touch. */
    step('r1s2', 'Checking your assigned assets', [dat('Your assigned assets')]),
    step('r1s3', 'Identifying the docking station model', [dat('Asset register · docking stations')]),
    step('r1s4', 'Looking for similar tickets', [tk('INC-4102'), tk('INC-4188'), tk('INC-4231')]),
    step('r1s5', 'Comparing symptoms across those tickets', [tk('INC-4290'), tk('INC-4356')]),
    {
      kind: 'discovery', id: 'r1d1', role: 'evidence',
      headline: '6 similar laptop/display tickets',
      detail: 'All routed to End User Computing - Laptop & Desktop.',
    },
    step('r1s6', 'Checking the dock firmware advisories', [kb('KB-2210 · WD19 dock firmware'), doc('Dell WD19 release notes')]),
    {
      kind: 'discovery', id: 'r1d3', role: 'evidence',
      headline: '5 of those 6 were the same dock model',
      detail: 'WD19 docks running firmware below 4.2.',
    },
    step('r1s7', 'Working out the right category and priority', [doc('Categorisation policy')]),
    /* ROUTING is where the ticket LANDS — the decision, not the evidence behind it. The dock-model
       finding above was carrying this role and the footer duly printed it under ROUTED AS, which
       is how a mislabelled role becomes a wrong claim on the answer card. */
    {
      kind: 'discovery', id: 'r1d4', role: 'routing',
      headline: 'End User Computing → Laptop & Desktop',
      detail: 'Matches where all six similar tickets were handled.',
    },
    step('r1s8', 'Checking whether you have already raised this'),
    {
      kind: 'discovery', id: 'r1d2', role: 'gap',
      headline: "Your docking station isn't in your asset list",
      detail: "I can log the ticket without it, but it won't be linked.",
    },
    step('r1s9', 'Preparing the draft'),
    {
      kind: 'answer',
      payload: {
        form: 'draft',
        title: 'New incident',
        /* A DRAFT NEEDS A CONCLUSION TOO. Without a headline this answer opened on the word "New
           incident" — the label of the object, not the answer to the question — and the reader had
           to read the card to find out that Nova had already worked out where it goes. */
        headline: 'I can raise this for you — the draft is ready',
        /* ⚠️ NO "6 similar tickets" HERE. The evidence footer already carries that
           finding, derived from the discovery the reader watched arrive during the wait.
           Repeating it in the body is one fact in two places with two chances to disagree
           — and it pushed the thing the reader must actually DO into the second half of
           the sentence. The body says only the next action. */
        text: 'Review the draft and create it.',
        /* THE DRAFT IS NOW A BLOCK — the shared DraftCard wired to the mock ticket store.
           `inferred` marks what NOVA decided rather than what the reader said; Subject and
           Priority are editable in place, because this card is a thing about to be approved.
           Creating goes propose → confirm (the primary) → store.createTicket → ConfirmBanner,
           and the chip set swaps to the post-creation questions. */
        blocks: [
          { w: 'draft', id: 'req01', title: 'New incident', category: 'End User Computing',
            fields: [
              { label: 'Type', value: 'Incident' },
              { label: 'Subject', value: 'Laptop screen flickers when docked', editable: true },
              { label: 'Category', value: 'End User Computing', inferred: true },
              { label: 'Subcategory', value: 'Laptop & Desktop', inferred: true },
              { label: 'Priority', value: 'Medium', inferred: true, editable: true, options: ['Low', 'Medium', 'High'] },
              { label: 'Requester', value: 'you' },
            ],
            primary: 'Create ticket', secondary: 'Discard',
            banner: {
              text: '{ref} created — End User Computing will pick it up',
              actions: [
                { label: 'View ticket' },
                { label: 'Add a note', ask: 'Add a note to INC-1042' },
              ],
            } },
        ],
        menu: ['Edit draft', 'Copy summary'],
        followUps: [
          "Add my docking station's asset tag",
          'What happens after I create it?',
          { label: 'Make it high priority', disabled: true },
        ],
        followUpsAfter: [
          'Add a note to INC-1042',
          'Show me its status',
          { label: 'Notify my manager', disabled: true },
        ],
      },
    },
  ],
};

/* ── REQ-02 (SUPERSEDED) ─────────────────────────────────────────────
   The live REQ-02 is authored in requesterScripts.ts against the mock ticket store (INC-0988).
   This vendor-story version is kept only as authoring reference — it is NOT in the SCRIPTS map,
   is unreferenced, and esbuild drops it from the bundle. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const REQ_02_LEGACY: Script = {
  topic: 'your open VPN ticket',
  match: /(any )?update on my vpn|vpn.*any update/i,
  beats: [
    /* SOURCES on the checks that actually opened something. Without them "Why Nova says this"
       has a Sources section that can never appear — which is how the flagship requester case
       shipped with provenance that existed only in the component. */
    step('r2s1', 'Finding your open requests', [dat('Your open requests')]),
    step('r2s2', 'Filtering to the VPN ones',
      [tk('INC-4471', { freshness: 'Updated 3h ago', detail: 'Status · Waiting on vendor' })]),
    step('r2s3', 'Reading the latest activity',
      [tk('INC-4471 · activity', { freshness: 'Updated 3h ago' })]),
    {
      kind: 'discovery', id: 'r2d1', role: 'evidence',
      headline: 'INC-4471 moved to Waiting on vendor yesterday',
      detail: 'The network team raised it with the VPN gateway supplier.',
      support: ['INC-4471', 'INC-4471 · activity'],
    },
    step('r2s4', 'Checking who it is waiting on',
      [dat('Vendor update', { freshness: 'Updated yesterday', detail: 'Gateway supplier · investigating' })]),
    step('r2s5', "Reading the vendor's last response"),
    step('r2s6', 'Checking the SLA clock',
      [doc('SLA policy · P3 Response', { detail: 'Clock · Paused', freshness: 'Checked just now' })]),
    {
      kind: 'discovery', id: 'r2d3', role: 'routing',
      headline: 'The clock is paused while it sits with the vendor',
      detail: 'It resumes when they respond, so no breach is being counted against this.',
      support: ['SLA policy · P3 Response'],
    },
    step('r2s7', 'Looking for anything else of yours that is related'),
    step('r2s8', 'Checking whether there is a workaround meanwhile'),
    {
      kind: 'discovery', id: 'r2d2', role: 'gap',
      headline: "The supplier's own reference isn't on the ticket",
      detail: 'So I cannot tell you where it sits in their queue.',
      support: ['INC-4471'],
    },
    {
      kind: 'answer',
      payload: {
        form: 'text',
        title: 'Waiting on the vendor, not on you',
        /* THE CONCLUSION FIRST. This sentence is the whole answer; a reader who stops here has
           what they came for, and everything under it is why. */
        headline: 'Waiting on the vendor, not on you',
        /* THE SAME FIVE FACTS, STRUCTURED. They used to be one 44-word sentence, which meant
           reaching any one of them required parsing all of it — and someone checking on their own
           ticket is scanning for exactly one. */
        kv: [
          { label: 'Status', value: '**Waiting on vendor**[[INC-4471]]', tone: 'warn' as const },
          { label: 'Ticket', value: '**INC-4471** — VPN disconnects from home network' },
          { label: 'With', value: '**Gateway supplier**[[Vendor update]], since yesterday afternoon' },
          { label: 'Next update', value: '**Within 2 working days**' },
          { label: 'SLA', value: '**Paused**[[SLA policy · P3 Response]] while it is with the vendor', tone: 'ok' as const },
        ],
        text: 'Nothing is needed from you.',
        /* The requester strip stays SIMPLE — the ticket and the two things that changed. */
        basedOn: ['INC-4471', 'SLA policy · P3 Response', 'Vendor update'],
        followUps: [
          'Chase the vendor',
          'Notify me when it changes',
          'Show me the full history',
        ],
      },
    },
  ],
};

/* ── REQ-04 (SUPERSEDED) ─────────────────────────────────────────────────────────────────────
   The live REQ-04 is authored in requesterScripts.ts with the tickable StepList, the platform
   toggle and the Did-this-fix-it prompt. Kept only as reference — NOT in the SCRIPTS map. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const REQ_04_LEGACY: Script = {
  topic: 'your VPN sign-in failure',
  match: /(changed|reset).{0,30}password.{0,60}vpn|vpn.{0,40}authentication failed/i,
  beats: [
    step('r4s1', 'Reading your description'),
    step('r4s2', 'Checking your account activity'),
    {
      kind: 'discovery', id: 'r4d1', role: 'routing',
      headline: 'Your password changed 2 days ago',
      detail: 'Cached credentials may still hold the old one.',
    },
    step('r4s3', 'Searching VPN troubleshooting articles'),
    step('r4s4', 'Comparing against similar incidents'),
    {
      kind: 'discovery', id: 'r4d2', role: 'evidence',
      headline: '6 of 8 similar cases were fixed the same way',
      detail: 'Clearing the saved credential resolved them without a ticket.',
    },
    step('r4s5', 'Preparing the best next step'),
    {
      kind: 'discovery', id: 'r4d3', role: 'gap',
      headline: 'I could not read your VPN client version',
      detail: 'If the fix below does not work, that is the next thing to check.',
    },
    {
      kind: 'answer',
      payload: {
        form: 'text',
        title: 'Likely cause: cached VPN credentials',
        headline: 'Your saved password is the one from before you changed it',
        text: 'Windows is still offering the credential saved **before your password change**, so the gateway rejects it before multi-factor is ever reached. Clearing the saved credential and signing in once by hand resolves it in **most cases**.',
        footer: { run: 'Show me how to fix it', cancel: 'Raise a ticket instead', runAsks: true, cancelAsks: true },
        followUps: [
          'Walk me through clearing it',
          'It still fails after that',
          'Raise a ticket instead',
        ],
      },
    },
  ],
};

/* ── TEC-01 ──────────────────────────────────────────────────────────
   "I just started my shift. What should I look at first?"

   Five chapters, twelve checks, four teased findings. Written as a MYSTERY: each chapter ends on
   a fact rather than a verb, and a finding is teased before it is stated.

   ⚠️ The order is load-bearing. Understand → history → compare → verify → decide is how a person
   narrows something, and it is why the teases work: by the third chapter the reader has enough to
   have formed a guess, so "Interesting…" lands on a question they are already asking. */
const TEC_01: Script = {
  topic: 'what needs you first',
  view: 'reveal',
  match: /(start(ed|ing)?|beginning).{0,20}(my )?shift|what should I (look at|pick up) first/i,
  beats: [
    lane('t1s1', 'Understand', '', 'Reading your shift window',
      { value: 'Early shift', label: '08:00\u201316:00' },
      [dat('Shift roster · week 24'), doc('Team working agreement')]),
    lane('t1s2', 'Understand', '', 'Identifying your queue',
      { value: '24', label: 'tickets assigned to you' },
      [dat('My open tickets view'), dat('Assignment rules')]),
    lane('t1s3', 'Understand', '', "Checking your team's board",
      { value: '61', label: 'open across the team' },
      [dat('Service Desk board')]),

    lane('t1s4', 'Check history', '', "Reading last night's handover",
      { value: '3', label: 'items left for you' },
      [doc('Night shift handover · 12 Jun')]),
    lane('t1s5', 'Check history', '', 'Checking what closed overnight',
      { value: '11', label: 'closed by the night shift' },
      [dat('Resolution log · last 12h')]),
    lane('t1s6', 'Check history', '', 'Looking for anything reopened',
      { value: '2', label: 'reopened since Friday' },
      [tk('INC-4402'), tk('INC-4418')]),

    lane('t1s7', 'Compare', '', 'Measuring SLA clocks',
      { value: '6', label: 'inside two hours of breach' },
      [doc('SLA policy · P1 Critical'), dat('SLA clock service')]),
    lane('t1s8', 'Compare', '', 'Ranking by time to breach'),
    {
      kind: 'discovery', id: 't1d1', role: 'routing',
      tease: 'Interesting\u2026',
      headline: '2 of those 6 breach within the hour',
      detail: 'INC-4482 and INC-4501, both P1, both raised before 06:00.',
    },

    lane('t1s9', 'Verify', '', 'Checking whether anyone is already on them',
      { value: 'Unassigned', label: 'both still open' },
      [tk('INC-4482'), tk('INC-4501')]),
    lane('t1s10', 'Verify', '', 'Checking the Commercial Street POS outage'),
    {
      kind: 'discovery', id: 't1d2', role: 'evidence',
      tease: 'One final check\u2026',
      headline: 'The POS outage is parked on the telco',
      detail: 'Nothing is needed from you until their ref TT-BLR-99120 clears.',
    },
    lane('t1s11', 'Verify', '', 'Looking for a change behind either of them',
      { value: 'CHG-0912', label: 'closed at 02:10' },
      [dat('Change calendar · last 24h'), tk('CHG-0912')]),
    {
      kind: 'discovery', id: 't1d4', role: 'evidence',
      tease: 'That explains something',
      headline: 'INC-4501 started ten minutes after a change closed',
      detail: 'CHG-0912 touched the same authentication service.',
    },

    lane('t1s12', 'Decide', '', 'Weighing impact against the clock'),
    {
      kind: 'discovery', id: 't1d3', role: 'gap',
      tease: 'One thing I could not check',
      headline: 'I could not see the on-call roster',
      detail: 'If someone picked these up outside the tool, this order changes.',
    },
    {
      kind: 'answer',
      payload: {
        form: 'text',
        title: 'Start with INC-4482',
        headline: '2 tickets breach within the hour, and neither is assigned',
        /* The reading BEFORE the ranking. A ranked table with no sentence over it makes the
           reader work out the point of the ordering, which is the job being delegated. */
        insight: '**INC-4482** goes first — it has the shorter clock. Open **INC-4501** straight after: a change closed on the same service **ten minutes** before it was raised.',
        /* Ranked, because "what do I pick up first" is a ranking question. The bar behind the
           clock column makes the gap between first and third readable without arithmetic. */
        table: {
          cols: ['Ticket', 'Issue', 'Clock'],
          rows: [
            ['**INC-4482**', 'Payment gateway timeouts', '**14m**'],
            ['**INC-4501**', 'Card terminals offline', '**38m**'],
            ['INC-4460', 'POS outage — waiting on vendor', '2h 10m'],
          ],
          ranked: true,
        },
        text: 'The POS outage looks like the loudest thing on your board, but it is **waiting on someone else**.',
        recommendation: 'Acknowledge **INC-4482 before 09:40** — that is when its response clock runs out.',
        footer: { run: 'Open INC-4482', cancel: 'Show me the full queue', cancelAsks: true },
        followUps: [
          'Open INC-4482',
          'Show me CHG-0912',
          'Who else is on shift?',
        ],
      },
    },
  ],
};

/* ── TEC-02 ──────────────────────────────────────────────────────────
   "I have the corporate banking RM on the line about the bulk salary upload failures.
    Give me a 30-second brief."

   The one case with a person waiting on the other end of a phone, which changes what the answer
   has to be: not an analysis but something sayable out loud, with the thing they will be asked
   ("when will it be fixed?") answered honestly — including that the estimate is unconfirmed. */
const TEC_02: Script = {
  topic: 'the bulk salary upload failures',
  view: 'reveal',
  match: /bulk salary|salary upload|corporate banking RM|30.second brief/i,
  beats: [
    lane('t2s1', 'Understand', '', 'Reading who is on the line',
      { value: 'Corporate Banking', label: 'relationship manager' }),
    tallied(lane('t2s2', 'Understand', '', 'Finding the tickets they mean',
      { value: '4 open', label: '1 major incident' },
      [tk('INC-4390'), dat('Corporate Banking ticket view')]),
    /* ⚠️ A tally never claims more than the step's own copy: this one found "4 open"
       tickets in one source, so that is exactly what it adds. */
    { ticket: 4, 'data source': 1 }),

    tallied(lane('t2s3', 'Check history', '', 'Reading the major incident timeline',
      { value: 'INC-4390', label: 'raised 04:12 today' },
      [tk('INC-4390'), doc('Major incident log')]), { 'data source': 1 }),
    tallied(lane('t2s4', 'Check history', '', 'Checking what they have already been told',
      { value: '2', label: 'updates sent' },
      [dat('Customer comms log')]), { 'data source': 1 }),
    {
      kind: 'discovery', id: 't2d1', role: 'routing',
      tease: 'Worth knowing before you speak',
      headline: 'They were last updated three hours ago',
      detail: 'The 09:00 update promised a fix by noon.',
      support: ['Customer comms log'],
    },

    tallied(lane('t2s5', 'Compare', '', 'Checking how many payrolls are affected',
      { value: '3', label: 'corporate clients' }), { client: 3 }),
    tallied(lane('t2s6', 'Compare', '', 'Measuring what is held up',
      { value: '₹4.2 cr', label: 'in salary transfers' },
      [dat('Payments queue'), doc('Bulk upload runbook')]), { 'data source': 2 }),
    tallied(lane('t2s7', 'Compare', '', 'Looking for the same failure before',
      { value: '1', label: 'in March, same cause' },
      [tk('INC-2871 · March', { authority: 'history', detail: 'Resolved · same root cause' }),
        kb('KB-1190 · Bulk upload format errors', { freshness: 'Updated 2d ago' })]),
    { ticket: 1, 'KB article': 1 }),
    {
      kind: 'discovery', id: 't2d2', role: 'evidence',
      tease: 'Interesting\u2026',
      headline: "March's incident was a file-format change",
      detail: 'The same upstream vendor changed their delimiter without notice.',
      support: ['INC-2871 · March', 'KB-1190 · Bulk upload format errors'],
      /* Nova's conclusion, not a record state — and it says so, with its strength in words
         rather than an invented percentage. */
      inference: true,
      basis: 'Strong evidence · same vendor, same failure signature as March',
    },

    tallied(lane('t2s8', 'Verify', '', 'Checking the current fix status',
      { value: 'In UAT', label: 'patch built 10:40' },
      [dat('Release pipeline', { freshness: 'Checked just now', detail: 'CHG-1044 · In UAT' }),
        tk('CHG-1044', { freshness: 'Updated 20m ago' })]), { 'data source': 1 }),
    lane('t2s9', 'Verify', '', 'Checking who owns the next step',
      { value: 'Payments', label: 'Engineering' }),
    lane('t2s10', 'Verify', '', 'Checking the noon estimate still holds'),
    {
      kind: 'discovery', id: 't2d3', role: 'gap',
      tease: 'One thing I could not check',
      headline: 'I could not confirm the noon estimate',
      detail: 'Payments Engineering has not posted an update since 09:40.',
      support: ['Release pipeline'],
    },
    {
      kind: 'answer',
      payload: {
        form: 'text',
        title: 'Your 30 seconds',
        headline: 'Salary uploads have been failing since 04:12 — same cause as March',
        kv: [
          { label: 'Impact', value: '**3 corporate clients**, about **₹4.2 crore** held[[Payments queue]]' },
          { label: 'Cause', value: 'Upstream vendor **changed their file format** without notice[[INC-2871 · March]]' },
          { label: 'Fix', value: 'Patch in **UAT since 10:40**, owned by Payments Engineering[[Release pipeline]]' },
          { label: 'Careful', value: 'The **noon** estimate is from 09:00 and **unconfirmed since 09:40**[[Customer comms log]]', tone: 'risk' as const },
        ],
        text: 'Bulk salary uploads have been failing since 04:12 for three corporate clients, holding about ₹4.2 crore in transfers. Cause is the same as March: the upstream vendor changed their file format without notice. A patch is in UAT as of 10:40 and Payments Engineering owns the release. They were last told 09:00 that it would be fixed by noon — do not repeat that time, because nobody has confirmed it since 09:40.',
        basedOn: ['INC-4390', 'Payments queue', 'KB-1190 · Bulk upload format errors'],
        recommendation: 'Promise them a confirmed time rather than the old one — ask Payments Engineering for a fresh estimate while you have the RM on the line.',
        footer: { run: 'Open INC-4390', cancel: 'Draft an update for them', cancelAsks: true },
        followUps: [
          'Draft an update for the RM',
          'Who is on the bridge call?',
          'Show me the March incident',
        ],
      },
    },
  ],
};

/* ── TEC-03 ──────────────────────────────────────────────────
   "User in Bengaluru says VPN drops every 30 minutes on the dot and reconnects fine. Ring any
   bells?"

   THE ONLY SCRIPT THAT ASKS BEFORE IT ANSWERS, and the reason it is this one: "ring any bells?"
   is a question about a pattern, and a pattern cannot be matched from a single sentence. Blast
   radius, network and recent change are the three facts a technician would ask for out loud
   before saying yes — so Nova asks for them too, rather than guessing and being confidently
   wrong.

   ⚠️ THE ASK IS EARLY, ON PURPOSE. Two cheap checks establish that the question is worth asking
   at all, and then it asks — before eight more checks have been spent on an investigation that
   the answers might have pointed somewhere else. Asking at the END would be a survey.

   ⚠️ WHAT THE ANSWERS DO NOT DO. The beats after the ask are fixed, so the conclusion is the
   same whichever choices are picked. That is a limit of an authored script, not a claim about
   the product: the card echoes the real selections back, and the conclusion is written to hold
   under every combination — a gateway-wide rekey fault reads the same whether one person or
   forty have noticed it yet. Nothing here pretends the choices steered the investigation. */
const TEC_03: Script = {
  topic: 'the Bengaluru VPN drops',
  view: 'steps',
  match: /vpn.*(drop|disconnect).*(30|thirty)|every 30 minutes.*vpn|ring any bells/i,
  beats: [
    step('t3s1', 'Reading what you have described'),
    step('t3s2', 'Checking VPN tickets raised from Bengaluru',
      [tk('INC-4402'), tk('INC-4417'), dat('Bengaluru site · last 30 days')]),

    {
      kind: 'ask',
      id: 't3a1',
      questions: [
        {
          id: 't3q1',
          question: 'How many people are seeing this?',
          choices: [
            { id: 'one', label: 'Just this one user', detail: 'Nobody else has reported it yet.' },
            { id: 'few', label: 'A few people in the same office' },
            { id: 'site', label: 'The whole Bengaluru site', detail: 'Widespread — treat as an incident.' },
            { id: 'other', label: 'Something else', other: true },
            { id: 'unknown', label: "I don't know yet" },
          ],
        },
        {
          id: 't3q2',
          question: 'What are they connected to?',
          choices: [
            { id: 'wifi', label: 'Office Wi-Fi' },
            { id: 'wired', label: 'Office wired network' },
            { id: 'home', label: 'Home or mobile broadband' },
            { id: 'other', label: 'Something else', other: true },
            { id: 'unknown', label: "I don't know yet" },
          ],
        },
        {
          id: 't3q3',
          question: 'Has anything changed for them recently?',
          choices: [
            { id: 'device', label: 'New laptop or dock' },
            { id: 'account', label: 'Password or account change' },
            { id: 'nothing', label: 'Nothing they know of' },
            { id: 'other', label: 'Something else', other: true },
            { id: 'unknown', label: "I don't know yet" },
          ],
        },
      ],
    },

    step('t3s3', 'Matching the 30-minute pattern against known faults',
      [kb('KB-3320 · IPsec rekey timeout'), doc('VPN gateway runbook')]),
    {
      kind: 'discovery', id: 't3d1', role: 'evidence',
      headline: '9 Bengaluru VPN drops this month, all on the half hour',
      detail: 'Every one of them reconnected without help, exactly as yours does.',
    },
    step('t3s4', 'Checking the Bengaluru gateway configuration',
      [dat('VPN gateway · BLR-01')]),
    {
      kind: 'discovery', id: 't3d2', role: 'routing',
      headline: 'BLR-01 rekeys every 1800 seconds',
      detail: 'The clients are set to 3600. The mismatch drops the tunnel on the gateway\u2019s clock.',
    },
    step('t3s5', 'Checking whether a fix is already scheduled', [tk('CHG-1102')]),
    {
      kind: 'discovery', id: 't3d3', role: 'gap',
      headline: 'I could not confirm their VPN client version',
      detail: 'The endpoint has not checked in since Friday, so the profile it holds is unverified.',
    },
    {
      kind: 'answer',
      payload: {
        form: 'text',
        title: 'Bengaluru VPN drops',
        headline: 'Yes — this is the BLR-01 rekey mismatch, and it is already known',
        kv: [
          { label: 'Cause', value: 'Gateway rekeys at **1800s**, the client profile expects **3600s**' },
          { label: 'Seen before', value: '**9 times** this month from Bengaluru, all self-recovering' },
          { label: 'Fix', value: '**CHG-1102** aligns the gateway timer — scheduled **Thursday 22:00**' },
          { label: 'Careful', value: 'Their **client version is unconfirmed** since Friday', tone: 'risk' as const },
        ],
        text: 'The drop every 30 minutes on the dot is the giveaway: BLR-01 renegotiates its keys at 1800 seconds while the client profile expects 3600, so the tunnel is torn down on the gateway\u2019s clock and rebuilt immediately. It is harmless but it will keep happening until CHG-1102 lands on Thursday.',
        insight: 'Nothing is wrong with their laptop — tell them that first, or they will spend the week reinstalling things.',
        recommendation: 'Link this to CHG-1102 rather than raising a new incident, and let them know it self-recovers so they stop reporting each drop.',
        footer: { run: 'Link to CHG-1102', cancel: 'Draft a reply to the user', cancelAsks: true },
        followUps: [
          'Draft a reply to the user',
          'Who else has hit this in Bengaluru?',
          'What does CHG-1102 change?',
        ],
      },
    },
  ],
};

/* ── CXO-02 ──────────────────────────────────────────────────────────
   "Are we meeting our SLAs? Where do we breach most?"

   Deliberately the LONGEST script in the set — twelve checks across five lanes and three passes,
   roughly 30–40 seconds end to end. Leadership is the audience that has to believe Nova went and
   looked, and a four-step investigation cannot carry that; the length IS the argument.

   Read the shape rather than the rows: pass one establishes the scale, a finding narrows it, pass
   two tests whether the finding is isolated, and only then does pass three quantify the change.
   That is the order an analyst works in, and it is why the discoveries land between the passes
   instead of all at the end. */
const CXO_02: Script = {
  topic: 'SLA risk across the estate',
  view: 'workspace',
  match: /\bSLA\b.*(meet|breach|risk)|are we meeting|where do we breach/i,
  scope: [
    { value: '1,284', label: 'tickets' },
    { value: '3', label: 'teams' },
    { value: '4', label: 'data sources' },
  ],
  beats: [
    // ── pass one · the scale ────────────────────────────────────────
    lane('c2a1', 'Live analysis', 'Tickets', 'Reading open tickets',
      { value: '1,284', label: 'open tickets analysed' },
      [dat('Ticket data · June', { freshness: 'Checked just now', detail: '1,284 open tickets · all teams' })]),
    lane('c2a2', 'Live analysis', 'SLA', 'Counting breaches',
      { value: '27', label: 'breached' },
      [dat('SLA data · June', { freshness: 'Checked just now', detail: '74 breaches recorded' })]),
    lane('c2a3', 'Live analysis', 'SLA', 'Checking breach patterns'),
    lane('c2a4', 'Live analysis', 'Teams', 'Reading Service Desk workload',
      { value: 'Service Desk', label: '14 of 27' },
      [dat('Team workload data', { freshness: 'Checked just now' })]),
    lane('c2a5', 'Live analysis', 'Teams', 'Reading Network workload',
      { value: 'Network', label: '9 of 27' }),
    lane('c2a6', 'Live analysis', 'Teams', 'Comparing team workload'),
    lane('c2a7', 'Live analysis', 'Trends', 'Comparing June against May'),
    {
      kind: 'discovery', id: 'c2d1', role: 'routing',
      headline: 'VPN incidents are driving 41% of new SLA breaches',
      detail: 'Most of them started after the latest authentication-policy change.',
    },

    // ── pass two · is it isolated ───────────────────────────────────
    lane('c2b1', 'Checking whether this is isolated', 'Network', 'Network team',
      { value: 'Confirmed', label: 'same window' }),
    lane('c2b2', 'Checking whether this is isolated', 'Auth', 'Authentication service',
      { value: '3 June', label: 'policy rollout' }),
    lane('c2b3', 'Checking whether this is isolated', 'Regions', 'Checking regional pattern',
      { value: '78%', label: 'Bengaluru and Pune' }),
    {
      kind: 'discovery', id: 'c2d2', role: 'evidence',
      headline: 'Two offices account for 78% of them',
      detail: 'Bengaluru and Pune both moved to the new auth policy on 3 June.',
    },
    {
      kind: 'discovery', id: 'c2d3', role: 'gap',
      headline: 'I could not read the VPN gateway logs',
      detail: 'The 41% comes from ticket text, not from the gateway itself.',
    },

    // ── pass three · quantify ────────────────────────────────────
    lane('c2c1', 'Putting it together', 'Trends', 'Modelling the month-on-month change',
      { value: '+18%', label: 'breaches vs May' }),
    lane('c2c2', 'Putting it together', 'Trends', 'Ranking the drivers'),
    {
      kind: 'answer',
      payload: {
        form: 'report',
        title: "Here's what changed",
        headline: 'SLA breaches are up 18%, and it is three teams — not the estate',
        /* Headline numbers with their movement. A number with no comparison is a reading, not an
           answer; `good` is authored because the arrow cannot tell "fewer tickets" from "more
           breaches". */
        metrics: [
          { label: 'Open', value: '1,284', delta: '8.4% vs May', direction: 'down' as const, good: true },
          { label: 'Breached', value: '74', delta: '18% vs May', direction: 'up' as const, good: false },
          { label: 'Compliance', value: '94.2%', delta: '1.1pt', direction: 'down' as const, good: false },
        ],
        metric: { label: 'SLA breaches', value: '18%', direction: 'up' },
        chart: [
          { label: 'Feb', value: 14 },
          { label: 'Mar', value: 16 },
          { label: 'Apr', value: 15 },
          { label: 'May', value: 23 },
          { label: 'Jun', value: 27 },
        ],
        driver: 'VPN authentication incidents',
        text: 'Breaches are up 18% on May[[SLA data · June]], and the rise is not spread across '
          + 'the estate — it sits almost entirely in VPN authentication tickets[[Ticket data · June]] '
          + 'from two offices that moved to the new policy on 3 June.',
        basedOn: ['Ticket data · June', 'SLA data · June', 'Team workload data'],
        /* What makes an analytics answer checkable: the population, counted and dated. */
        dataScope: '1,284 open tickets · Jun 1–30 · all teams',
        footer: { run: 'View affected tickets', cancel: 'Export summary' },
        followUps: [
          'Which office is worse?',
          'What would fixing it cost?',
          'Show me last month for comparison',
        ],
      },
    },
  ],
};

/* ── CXO-07 ────────────────────────────────────────────
   "Show me the trending HR cases."

   THE DATA QUESTION, and the one that most tempts a paragraph. The answer is a ranking, so the
   answer is a TABLE — with the reading of it stated first, because a leader asking what is
   trending wants the shape, not the rows. The rows are the evidence for the shape.

   Deliberately short: six checks, one finding. A counting question does not need a nine-step
   investigation, and padding it would make every question look equally hard. */
const CXO_07: Script = {
  topic: 'what employees are raising with HR',
  view: 'steps',
  match: /trending hr|hr cases|top hr|hr.*(trend|most common)/i,
  beats: [
    step('c7s1', 'Reading your reporting window', [dat('Last 90 days')]),
    step('c7s2', 'Finding HR requests in that window', [dat('HR service desk')]),
    step('c7s3', 'Grouping them by case category', [dat('HR category tree')]),
    step('c7s4', 'Counting each category'),
    {
      kind: 'discovery', id: 'c7d1', role: 'evidence',
      headline: 'Travel and Vacation & Leaves are almost level',
      detail: 'Six tickets between them across the whole quarter.',
    },
    step('c7s5', 'Comparing against the previous 90 days', [dat('Apr–Jun comparison')]),
    step('c7s6', 'Checking whether any category is accelerating'),
    {
      kind: 'answer',
      payload: {
        form: 'text',
        title: 'Top HR cases',
        headline: 'Travel and leave requests are two thirds of everything HR sees',
        /* THE READING, ABOVE THE TABLE. "Here are the tickets by category" hands over a grid and
           leaves the interpretation to the reader; this says what the grid means and lets the
           grid prove it. */
        insight: '**Travel** is the most common HR case at **256 tickets**, barely ahead of **Vacation & Leaves** at **250**. Together they account for **65%** of reported cases — the remaining categories are long-tail.',
        table: {
          cols: ['HR case', 'Tickets', 'vs prev 90d'],
          rows: [
            ['**Travel**', '**256**', '+12%'],
            ['**Vacation & Leaves**', '**250**', '+3%'],
            ['**HR Software**', '**137**', '−18%'],
            ['Payroll queries', '89', '+4%'],
            ['Benefits', '61', '−2%'],
          ],
          ranked: true,
          /* The bar rides the count column, so the table IS the ranking chart. A separate bar
             chart beside it would be a second thing to keep in step with the same numbers. */
          barCol: 1,
        },
        text: 'Travel rose **12%** on the previous quarter, which is the only movement large enough to be worth a look.',
        footer: { run: 'Show tickets behind these numbers', cancel: 'Compare with previous 90 days', runAsks: true, cancelAsks: true },
        followUps: [
          'What is driving the travel increase?',
          'Show other trending employee issues',
          'Which HR team owns these?',
        ],
      },
    },
  ],
};

/* ── TEC-07 ──────────────────────────────────────────────────────────────────────────────────
   "Write my handover for the night shift: what's burning, what's blocked, and anything the
   regulator cares about."

   THE PLAN-FIRST CASE. The request is complex and consequential (it posts a note and notifies a
   person), so Nova PLANS before it acts: tallied checks feed the live strip while it works out
   the approach, the proposal parks the stream for review, a canned natural-language revision
   demonstrates modification (drop the SLA section, notify the on-call engineer instead), and
   execution — derived from the approved proposal, never from this file's original — runs with a
   deterministic notification failure so the partial state and its retry are reachable. */
const TEC_07: Script = {
  topic: 'your night-shift handover',
  activity: 'Planning your night-shift handover',
  match: /handover.*night|night.?shift.*handover|write my handover/i,
  view: 'reveal',
  beats: [
    tallied({ ...step('t7s1', 'Scanning the open queue', [dat('Open queue · evening snapshot', { freshness: 'Live' })]), phase: 'Take stock' } as Beat, { ticket: 6 }),
    tallied({ ...step('t7s2', 'Pulling what changed since this morning', [dat('Ticket activity · today', { freshness: 'Updated just now' })]), phase: 'Take stock' } as Beat, { ticket: 3 }),
    {
      kind: 'discovery', id: 't7d1', role: 'evidence',
      headline: '2 incidents are still burning into the evening',
      detail: 'INC-4390 (payroll uploads) and INC-4482 (VPN gateway) are active with people waiting.',
      support: ['Open queue · evening snapshot'],
    },
    tallied({ ...step('t7s3', "Reading this morning's handover", [doc('Handover · this morning')]), phase: 'Compare' } as Beat, { 'data source': 1 }),
    tallied({ ...step('t7s4', 'Checking what each blocked ticket is waiting on', [dat('Vendor status board', { freshness: 'Updated 1h ago' })]), phase: 'Compare' } as Beat, { 'data source': 1 }),
    {
      kind: 'discovery', id: 't7d2', role: 'evidence',
      headline: '3 tickets are blocked on vendors',
      detail: 'Two on the gateway supplier, one on the payroll processor.',
      support: ['Vendor status board'],
    },
    tallied({ ...step('t7s5', 'Checking regulator-sensitive cases', [doc('Compliance register', { freshness: 'Checked just now' }), tk('INC-4371', { detail: 'Payroll data incident · reporting window open' })]), phase: 'Check exposure' } as Beat, { 'data source': 1 }),
    {
      kind: 'discovery', id: 't7d3', role: 'evidence',
      headline: 'INC-4371 reports to the regulator inside 48 hours',
      detail: 'The notification window closes tomorrow at 14:00 — the night shift must not sit on it.',
      support: ['Compliance register', 'INC-4371'],
    },
    tallied({ ...step('t7s6', 'Checking which SLA clocks run overnight', [dat('SLA clocks · overnight')]), phase: 'Check exposure' } as Beat, { 'data source': 1 }),
    step('t7s7', 'Building the handover plan'),
    {
      kind: 'proposal',
      proposal: {
        id: 't7plan',
        intro: "Here's how I'll handle this.",
        steps: [
          { id: 'p1', label: 'Summarise the two burning incidents',
            detail: 'INC-4390 and INC-4482 — current state, owner, and the next action each needs.',
            execLabel: 'Summarising the burning incidents',
            done: { label: 'Burning', value: '**INC-4390** and **INC-4482** summarised with next actions' } },
          { id: 'p2', label: 'List the blocked tickets with what unblocks them',
            detail: 'The 3 vendor-blocked tickets, each with who owes what.',
            execLabel: 'Listing the blocked tickets',
            done: { label: 'Blocked', value: '**3 tickets** listed with what unblocks each' } },
          { id: 'p3', label: 'Flag the regulator deadline on INC-4371',
            detail: 'The 48-hour reporting window closes tomorrow at 14:00.',
            execLabel: 'Flagging the regulator deadline',
            done: { label: 'Regulator', value: '**INC-4371** flagged — window closes tomorrow 14:00', tone: 'warn' } },
          { id: 'p4', label: 'Attach the overnight SLA clocks',
            detail: 'Which clocks keep running tonight and which resume at 08:00.',
            execLabel: 'Attaching the SLA clocks',
            done: { label: 'SLA', value: '**4 overnight clocks** attached' } },
          { id: 'p5', label: 'Post the handover to the night-shift channel',
            execLabel: 'Posting the handover',
            done: { label: 'Handover', value: 'Posted to the **night-shift channel**', tone: 'ok' } },
          { id: 'p6', label: 'Notify the night-shift lead',
            detail: 'A direct notification so it is read at shift start, not found later.',
            execLabel: 'Notifying the night-shift lead',
            done: { label: 'Notified', value: '**Night-shift lead**, directly', tone: 'ok' },
            fail: { note: 'The notification service timed out — the handover is posted, but nobody has been told yet.', retry: 'Retry notification' } },
        ],
        impact: [
          { label: 'Handover note', value: '1 note posted to the night-shift channel', stepId: 'p5' },
          { label: 'Notification', value: 'The night-shift lead will be notified', stepId: 'p6' },
          { label: 'Tickets', value: 'No ticket fields change' },
        ],
        evidence: [
          '2 incidents are still active into the evening',
          '3 tickets are blocked on vendors',
          'INC-4371 reports to the regulator inside 48 hours',
        ],
        approve: 'Approve & run',
        modify: 'Modify plan',
        hint: 'e.g. Notify the on-call engineer instead, and drop the SLA section',
        addable: { id: 'p7', label: "Carry over this morning's unfinished items",
          detail: 'Anything the day shift inherited and did not close.',
          execLabel: 'Carrying over the unfinished items',
          done: { label: 'Carried over', value: "This morning's **2 unfinished items** included" } },
      },
      /* The DEMO MODIFICATION, deterministic: whatever the reader types, the prototype applies
         this revision — drop the SLA section, notify the on-call engineer instead of the lead. */
      revision: {
        proposal: {
          id: 't7plan-r',
          intro: 'Plan updated.',
          steps: [
            { id: 'p1', label: 'Summarise the two burning incidents',
              detail: 'INC-4390 and INC-4482 — current state, owner, and the next action each needs.',
              execLabel: 'Summarising the burning incidents',
              done: { label: 'Burning', value: '**INC-4390** and **INC-4482** summarised with next actions' } },
            { id: 'p2', label: 'List the blocked tickets with what unblocks them',
              detail: 'The 3 vendor-blocked tickets, each with who owes what.',
              execLabel: 'Listing the blocked tickets',
              done: { label: 'Blocked', value: '**3 tickets** listed with what unblocks each' } },
            { id: 'p3', label: 'Flag the regulator deadline on INC-4371',
              detail: 'The 48-hour reporting window closes tomorrow at 14:00.',
              execLabel: 'Flagging the regulator deadline',
              done: { label: 'Regulator', value: '**INC-4371** flagged — window closes tomorrow 14:00', tone: 'warn' } },
            { id: 'p5', label: 'Post the handover to the night-shift channel',
              execLabel: 'Posting the handover',
              done: { label: 'Handover', value: 'Posted to the **night-shift channel**', tone: 'ok' } },
            { id: 'p6', label: 'Notify the on-call engineer',
              detail: 'A direct notification so it is read at shift start, not found later.',
              execLabel: 'Notifying the on-call engineer',
              done: { label: 'Notified', value: '**On-call engineer**, directly', tone: 'ok' },
              fail: { note: 'The notification service timed out — the handover is posted, but nobody has been told yet.', retry: 'Retry notification' } },
          ],
          impact: [
            { label: 'Handover note', value: '1 note posted to the night-shift channel', stepId: 'p5' },
            { label: 'Notification', value: 'The on-call engineer will be notified', stepId: 'p6' },
            { label: 'Tickets', value: 'No ticket fields change' },
          ],
          evidence: [
            '2 incidents are still active into the evening',
            '3 tickets are blocked on vendors',
            'INC-4371 reports to the regulator inside 48 hours',
          ],
          approve: 'Approve & run',
          modify: 'Modify plan',
          hint: 'e.g. Put the SLA section back',
          addable: { id: 'p7', label: "Carry over this morning's unfinished items",
            detail: 'Anything the day shift inherited and did not close.',
            execLabel: 'Carrying over the unfinished items',
            done: { label: 'Carried over', value: "This morning's **2 unfinished items** included" } },
        },
        diff: {
          removed: ['Attach the overnight SLA clocks'],
          updated: [{ label: 'Notification', from: 'Night-shift lead', to: 'On-call engineer' }],
        },
      },
    },
    {
      kind: 'answer',
      payload: {
        form: 'text',
        title: 'Handover posted',
        headline: 'Your handover is posted',
        /* kv is DERIVED at execution time from the approved plan's `done` rows — authored kv
           here would be a second copy that a modification could contradict. */
        text: 'Everything the night shift needs is in one note. Nothing changed on the tickets themselves.',
        basedOn: ['Open queue · evening snapshot', 'Vendor status board', 'Compliance register'],
        followUps: [
          'Show the burning incidents',
          "What's likely to breach overnight",
          'Draft the morning summary too',
        ],
        footer: { run: 'View handover', cancel: 'Anything I should do before I leave?', cancelAsks: true },
      },
    },
  ],
};

export const SCRIPTS: Record<string, Script> = {
  'REQ-01': REQ_01,
  /* REQ-02 through REQ-07, and every requester chip's own script. */
  ...REQUESTER_SCRIPTS,
  'TEC-01': TEC_01,
  'TEC-02': TEC_02,
  'TEC-03': TEC_03,
  'TEC-07': TEC_07,
  'CXO-02': CXO_02,
  'CXO-07': CXO_07,
};

/** The authored script for a case, or null so the caller falls back by intent. */
export const scriptFor = (caseId?: string): Script | null =>
  (caseId && SCRIPTS[caseId]) || null;

/** The authored script a TYPED question reaches, by its own words. Ordered by the registry's own
 *  key order, and first match wins — the three patterns are disjoint by construction. */
export const scriptForQuestion = (question: string): Script | null =>
  Object.values(SCRIPTS).find((s) => s.match?.test(question)) ?? null;
