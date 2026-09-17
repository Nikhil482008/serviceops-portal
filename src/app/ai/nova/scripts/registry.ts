import { REQUESTER_SCRIPTS } from './requesterScripts';
import { LEADERSHIP_SCRIPTS } from './leadershipScripts';
import { TECHNICIAN_SCRIPTS } from './technicianScripts';
import type { ChangeResult } from '../tech/mutations';

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
  /** Editable through the module's one editability pattern: a select when `options` names
   *  what the value may be, a text field when it does not. An INFERRED field should almost
   *  always be editable - a guess the reader can see but not correct is one they must accept. */
  editable?: boolean;
  options?: string[];
}
export interface DiffRow {
  label: string; from: string; to: string;
  /** Which editor the AFTER value opens. OMITTED MEANS A FACT — no pencil, no hover, not
   *  focusable — so a row is only arguable where someone decided it should be. */
  editor?: 'text' | 'select' | 'multi';
  /** `select` and `multi`: what this value may become. */
  options?: string[];
  /** Not a change the reader is being offered, but a CONSEQUENCE of one — an SLA clock pausing
   *  because the ticket went on hold. Rendered as a plain value row, no arrow. */
  fact?: boolean;
}
export interface BannerSpec {
  /** May contain `{ref}`, replaced with the mutated record's ref. */
  text: string;
  actions?: Array<{ label: string; ask: string }>;
}

/* `BlockAction` was here — a declarative card button (ask / run / copy / table). The technician
   cards render no buttons now: a card's forward action is attached under the TURN (see
   tech/techActions.ts), so the type went with the footers it described. */
/** A term the plain-language pass replaced, and what it replaced it with. */
export interface JargonPair { term: string; replacement: string; note?: string }

export type RequesterBlock =
  /** AnswerHead as a block, so a two-part answer (REQ-07) can carry two of them. */
  | { w: 'head'; n?: string; text: string; body?: string }
  | { w: 'confidence'; text: string }
  | { w: 'draft'; id: string; title: string; fields: DraftField[];
      primary: string; secondary: string; banner: BannerSpec;
      /** followUps swap to the answer's `followUpsAfter` once created. */
      category?: string }
  | { w: 'status'; ref: string; actions?: Array<{ label: string; ask: string }> }
  | { w: 'diff'; id: string; title: string; rows: DiffRow[]; why: string;
      /** The reason is the READER'S to give, not Nova's to justify — true of a reopen, where
       *  they are the one who knows why. Renders as an editable row instead of the muted line. */
      whyEditable?: boolean;
      primary: string; secondary: string; banner: BannerSpec;
      /** `raise-prb` creates a problem record; `notify-owners` adds a note to every ref in
       *  `refs`. Both are leadership actions, both behind the same confirm. */
      mutation: 'escalate' | 'reopen' | 'raise-priority' | 'raise-prb' | 'notify-owners'
        /* Technician: append a sentence to a draft, set a reminder. In a technician turn the
           card only collects the inputs; the attached action runs them (tech/mutations.ts). */
        | 'append-draft' | 'remind';
      ref: string; refs?: string[]; draftId?: string; sentence?: string }
  | { w: 'steps'; id: string; tickable?: boolean;
      /** Either one list, or one per platform (toggle shown when both exist). */
      steps?: string[]; windows?: string[]; mac?: string[];
      /** Authored alternates the ••• menu swaps in — never generated. */
      short?: string[]; detail?: string }
  | { w: 'note'; id: string; ref: string; prefill: string; title?: string;
      primary: string; secondary: string; banner: BannerSpec;
      /** "This update also changes" rows — applied to the ticket on confirm. */
      changes?: Array<DiffRow & { patch?: 'assets' }>;
      /** The note IS a resolution note — confirming also closes the ticket (REQ-07). */
      close?: boolean;
      /** A draft for someone OUTSIDE the ticket system (CXO-03's vendor note): confirming saves
       *  it to the outbox and touches no ticket. */
      outbox?: boolean;
      /* ── technician ─────────────────────────────────────────────────── */
      /** Three AUTHORED tones the ToneToggle swaps between — never generated. */
      tones?: { formal: string; friendly: string; shorter: string };
      tone?: 'formal' | 'friendly' | 'shorter';
      /** The draft store key — tone, edits, reverts and appended sentences live in the store so a
       *  later turn can change this composer in place. */
      draftId?: string;
      /** Visible to the requester (an external reply), rather than an internal note. */
      external?: boolean;
      /** A vendor chase — the note goes on the ticket and "last chased" resets. */
      chase?: boolean;
      /** Sending it moves the ticket to Waiting on requester. */
      awaits?: boolean;
      /** Not a ticket note at all: the text becomes the handover's final section. */
      target?: 'handover';
      /** Who it is for — the card's caption. */
      to?: string;
      /** The plain-language pass, rendered as a collapsible JargonCheck under the draft. */
      jargon?: JargonPair[] }
  /** TEC-06 - who we are waiting on: the headline and three capped sentences. */
  | { w: 'vendorbrief' }
  /** The three most urgent, plus the not-verified footnote about where chase dates come from. */
  | { w: 'vendorcards' }
  /** Five vendors and an Others, on one bar. */
  | { w: 'vendorstrip' }
  /** The rest of the queue, flat. */
  | { w: 'vendorrest' }
  /** The whole queue, one collapsed group per vendor - the turn that holds the volume. */
  | { w: 'vendorgroups2' }
  /** The chases about to be sent, all ticked, grouped by vendor. */
  | { w: 'chasepreview'; id: string }
  /** Every ticket with no vendor ref, editable, grouped by who to ask. */
  | { w: 'missingrefs'; id: string }
  /** TEC-03 - "ring any bells?": the diagnosis, three sentences and a confidence line, all
   *  composed from the resolved cases the KB article is linked to. */
  | { w: 'patternbrief' }
  /** The open tickets carrying the same signature, as match-mode TriageCards. */
  | { w: 'matchcards' }
  /** How often it has come back, on one axis. Not a chart: nothing to configure. */
  | { w: 'recurrence' }
  /** The resolved cases themselves, when the reader asks to see them. */
  | { w: 'resolvedcases' }
  /** TEC-02 - thirty seconds on a major incident: three facts off the record, and the sentence
   *  to say out loud. */
  | { w: 'incbrief'; ref: string; sayThis: string }
  /** A draft whose purpose is to leave: copy it, or send it. Carries its own tone control and
   *  the record of what it simplified. */
  | { w: 'draftblk'; id: string; ref: string; label: string; prefill: string;
      tone?: 'formal' | 'friendly' | 'shorter';
      tones?: Partial<Record<'formal' | 'friendly' | 'shorter', string>>;
      jargon?: JargonPair[]; draftId?: string; awaits?: boolean }
  /** Two sentences that say why this answer is the shape it is. */
  | { w: 'prose'; lines: Array<{ label: string; text: string }> }
  /** TEC-01 - the start of a shift: the ordering, its reasons, and the first three tickets.
   *  `rest` lists the remainder instead, as the same cards. */
  | { w: 'shift'; rest?: boolean }
  /** REQ-06 turn 1 - the shape of what is outstanding, from ONE grouping call. */
  | { w: 'summary' }
  /** REQ-06 turn 2 - one card per ticket, asked for rather than volunteered. */
  | { w: 'ticketcards' }
  | { w: 'ageline'; open: string; typical: string }
  | { w: 'resolution'; ref: string; action?: { label: string; ask: string } }
  | { w: 'timeline'; steps: Array<{ label: string; note: string }>; footer: string }
  | { w: 'picker'; id: string; prompt: string; options: string[]; confirm: string;
      draftId: string; banner: BannerSpec }
  | { w: 'team'; heading: string; members: Array<{ name: string; onShift: boolean; load: string }> }
  | { w: 'closelist'; id: string; primary: string; banner: BannerSpec }
  /* ── LEADERSHIP (CXO) blocks — numbers-first, every number from mockAnalytics ─────────── */
  /** A KPI strip, by set name (KPI_SETS in mockAnalytics). */
  | { w: 'kpis'; set: string }
  /** One-line key-driver statement. `{{keys}}` resolve against VALUES. Max one per section.
   *
   *  ⚠️ NOT FOR LEADERSHIP. A CXO answer's insight lives in its chart's InsightLine and nowhere
   *  else — a callout beside a chart said the chart's own fact a second time, in a second colour
   *  (CXO-02 printed the VPN 41% twice on one turn). The "so what" that used to follow the fact
   *  is now the chart block's `soWhat`. This block survives for the TECHNICIAN's TEC-04 hold
   *  note, which sits beside a card, not a chart, and duplicates nothing. */
  | { w: 'callout'; text: string }
  /** A chart inside a ChartFrame. `data` + `groupBy` resolve through `dataset()`; `kinds` is the
   *  chart-type menu (the frame keeps only the types valid for the data's shape); `drill` names
   *  the script a click runs, with the clicked segment carried as context.filter. */
  | { w: 'chart'; id: string; data: string; title: string; groupBy?: Array<{ id: string; label: string }>;
      kinds?: Array<'bars' | 'grouped' | 'line' | 'table' | 'gauge' | 'timeline' | 'list' | 'matrix'>;
      drill?: { case: string }; export?: string;
      /** THE CONSEQUENCE, appended to the InsightLine as its second sentence.
       *
       *  The dataset's headline says WHAT IS TRUE; this says what follows from it — the clause
       *  the blue-rail callout used to carry ("fix that and we're back above target"). Authored
       *  here rather than derived, because a consequence is a judgement about the business and
       *  `insightOf` only reads numbers. NEVER restate the fact: the reader has just read it one
       *  sentence earlier, and the whole reason the callout went is that it said things twice.
       *  Ends with a full stop; the frame joins it with a single space. */
      soWhat?: string;
      /** Technician: the reduced toolbar (group by · table only). */
      compact?: boolean;
      /** Technician: a named row on the chart OPENS its record — a navigate action. */
      pick?: 'open' }
  /** The three named security incidents, one line each. */
  | { w: 'incidents' }
  /** The recurring-problem cards: name · sparkline · tickets/hours · fix · raise action. */
  | { w: 'problems' }
  /** A single detailed incident card — timeline, accounts, controls added since. */
  | { w: 'incident-detail'; id: string }
  /* ── TECHNICIAN blocks — evidence-first, and every card carries an action ────────────── */
  /** Stat chips that FILTER the block below them (tec01 → the queue, tec06 → the vendor list,
   *  tec07 → the handover's sections). */
  | { w: 'techchips'; set: 'tec01' | 'tec06' | 'tec07' }
  /** The ranked queue, built live from the store; `why` is the authored one-liner per ref. */
  | { w: 'queue'; id: string; top?: number; why?: Record<string, string> }
  /** The 30-second talk-track. `to` is who the "Say this" line is sent to. */
  | { w: 'brief'; ref: string; to: string; what: string; impact: string; status: string; sayThis: string;
      short: { status: string; sayThis: string } }
  /** The incident timeline — events from the ticket's `detail`, NOW, and the future markers. */
  | { w: 'inctimeline'; ref: string }
  /** A countdown to the ticket's client cut-off. */
  | { w: 'sla'; ref: string; label: string }
  /** WHAT WE KNOW + WHAT I RECOMMEND — both halves, always. */
  | { w: 'kb'; id: string; linkKey?: string }
  /** TEC-03's picker turn: two candidate rows and "enter a ref"; a pick is the turn's selection. */
  | { w: 'linkpicker'; options: string[] }
  /** A store query as a table, rows selectable (`single` for a one-of pick) and clickable. */
  | { w: 'tickettable'; preset: 'blrOpenVpn' | 'vendorSla'; single?: boolean }
  /** TEC-04's diff + note: ONE confirm applies the status, the note and the reminder. */
  | { w: 'hold'; ref: string; rows: DiffRow[]; why: string; note: string; reminder: string;
      pendingReason: string; vendorRef: string;
      /** The ref could not be matched in the vendor's own feed — recorded as typed. */
      vendorRefUnverified?: boolean;
      banner: BannerSpec; bannerNoReminder: BannerSpec }
  | { w: 'vendorlist' }
  /** WHAT CHANGED — the card on a mutate action's reply. Rows come from the mutation's return
   *  value (`answer.changed`); only the next-line is authored. `next` may read `{{key}}` from
   *  the result's `fill`; `nextFallback` stands in when the key has no value. */
  | { w: 'changed'; next: string; nextFallback?: string }
  /** AN EDITABLE TURN — a short form the turn's own action commits. One field per row; the
   *  values travel to the mutation as `values`, keyed by the row's `key`. */
  | { w: 'fieldsedit'; id: string; title: string; rows: Array<{ key: string; label: string }>;
      /** The record this form is ABOUT, when it edits one rather than several. */
      ref?: string;
      /** The line under the fields — what the reader is being asked for, and why. */
      note: string; noteFilled?: string }
  /** The handover document, built LIVE from the store. */
  | { w: 'handover'; id: string }
  | { w: 'changes'; set: 'overnight' | 'sinceHandover' }
  | { w: 'people'; heading: string; ref: string }
  | { w: 'updates'; ref: string };

/** A follow-up chip: a question Nova answers, or a LOCAL variant switch on this answer.
 *
 *  There is NO disabled member, deliberately. A chip that cannot be answered is not authored:
 *  showing the intent behind a "Not in this demo" tooltip spends the reader's attention on a
 *  dead end, and the working chips carry the same intent. Authoring one is now a type error. */
export type FollowUp = string
  /** A LOCAL variant switch — never a new turn (TEC-05's "Make it shorter"). */
  | { label: string; local: string };

/** WHY NOVA GAVE THIS ANSWER — the requester's evidence, authored per case.
 *
 *  Never chain-of-thought. A REASONING line is a fact and what it implies for the answer, with
 *  the things a reader scans for (ids, counts, dates, statuses) in **bold**; not "I considered",
 *  not "I decided". CHECKED names the information considered — nouns, not an activity log — and
 *  never repeats the investigation trail. UNVERIFIED is authored only when something materially
 *  limits the answer, and says what is missing and what it costs. CONCLUSION is for an answer
 *  that is an inference: stated beneath the facts, labelled as one. */
export interface HowKnows {
  reasoning: string[];
  checked: string[];
  unverified?: string[];
  conclusion?: string;
}

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
  /** HOW NOVA KNOWS, for the requester — what the fold shows when it is expanded. See HowKnows.
   *  Cases without it keep the generic fold (the findings, each with its provenance). */
  how?: HowKnows;
  /** Follow-ups this ANSWER earns. Authored per script rather than drawn from a generic list —
   *  "what happens after I create it?" is only a sensible question under a draft card. An entry
   *  may be `{ label, local }`: a variant switch on THIS answer, which opens no turn. */
  followUps?: FollowUp[];
  /** The chip set AFTER the answer's main block is confirmed (REQ-01: post-creation). */
  followUpsAfter?: FollowUp[];
  /** Plan-first turns only: the ids of the steps that were APPROVED and ran — derived by the
   *  emitter, never authored. */
  planSteps?: string[];
  /** A mutate action's reply: what the mutation reported — derived by the emitter on the
   *  script's `mutate` beat, never authored. The `changed` block renders it. */
  changed?: ChangeResult;
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
  /** WHAT THIS STEP PUTS IN THE HANDOVER — one noun phrase, and the only place it is written.
   *  The summary card's "Covers" row is the surviving steps' phrases joined, so removing a step
   *  removes its claim by construction rather than by an author remembering to. */
  covers?: string;
  /** What it reads to do that — the "Source" row, de-duplicated across steps. */
  reads?: string;
  /** Where the result goes. Only the delivery steps have one; it is the "Posts to" row. */
  posts?: string;
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
  /** STEP IDS, all three — never titles. A retitled step is one CHANGED step, not one removed
   *  and one added, and two steps that happen to share a title are still two steps. */
  added?: string[];
  removed?: string[];
  changed?: string[];
  /** The removed steps WITH THE SEAT THEY HELD, so the list can strike them where they were
   *  instead of listing them elsewhere and making the reader find the gap. */
  gone?: Array<{ step: PlanStep; at: number }>;
  /** Which summary rows read differently now — the banded rows and their "changed" caption. */
  rows?: string[];
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
  /** THE TWO ATTACHED ACTIONS, declared. The primary names the OUTCOME and its meta names the
   *  safety — "you review before it posts" — because the one thing a reader needs to know before
   *  pressing a button called Build is whether anything leaves the building. */
  approve: string;
  approveMeta?: string;
  modify: string;
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
  /* SEVERAL CHECKS AT ONCE. The leadership feed scans lanes in PARALLEL: every step in a burst
   * starts together, then they complete one by one at the usual irregular pace. The reducer
   * keeps one active step PER LANE, so a burst reads as the whole estate being scanned rather
   * than a checklist being walked. */
  | { kind: 'burst'; steps: Array<Extract<Beat, { kind: 'step' }>> }
  /* PROPOSE A PLAN, then wait. Parks the stream like an ask: nothing executes until the reader
   * approves, and every modification produces a NEW proposal that needs approval again. The
   * `revision` is the deterministic natural-language demo modification (§15 of the plan-first
   * brief); step-level edits and removals are derived from the current proposal in the emitter. */
  | { kind: 'proposal'; proposal: PlanProposal;
      /** DERIVED, not authored — see tech/planRevise.ts. Kept on the type because a real
       *  backend would send a revised plan rather than have the client compute one. */
      revision?: { proposal: PlanProposal; diff: PlanDiff } }
  /* RUN THE ACTION. A What-changed script places this after its work-feed steps: the emitter
   * performs the mutation named in the turn's context (the action's inputs travel there) and
   * attaches its result to the answer. A turn opened with no mutation in its context skips it
   * and the reply says so, rather than inventing a change. */
  | { kind: 'mutate' }
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
  /** This script's own pacing window, in ms — a What-changed feed runs 600–900ms a step. */
  pace?: [number, number];
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
    /* CHAPTERS AND FACTS. `lane` carries both — the chapter this check belongs to, and the fact
       it lands on when it finishes. A check with no fact keeps its verb rather than inventing a
       figure; three of the nine below are like that, and each one says why. */
    lane('r1s1', 'Understand', '', 'Reading your description',
      { value: 'Flicker when docked', label: 'what you described' }),
    /* SOURCES on the checks that actually read something. TEC-01 has carried these since the
       context tabs landed; the requester scripts never did, so "Why Nova says this" had a
       Sources section that could not appear on the most-used path. A source is attached to the
       CHECK that opened it, never to the answer — which is what stops the list from naming
       anything the investigation did not touch. */
    tallied(lane('r1s2', 'Understand', '', 'Checking your assigned assets',
      { value: '6', label: 'assets on your name' }, [dat('Your assigned assets')]), { asset: 6 }),
    /* NO FACT. The gap finding two checks below says the reader's dock is not in their asset
       list — so naming their model here as a result would contradict the limit the answer is
       about to state. The verb is the honest end for this one. */
    lane('r1s3', 'Understand', '', 'Identifying the docking station model', undefined,
      [dat('Asset register · docking stations')]),
    /* SIX — the same six the finding names. The next check re-reads them, so it adds nothing:
       a tally says what a check READ, and reading the same tickets twice is not twelve. */
    /* NO FACT — the finding two lines below IS "6 similar tickets", and a check that prints its
       own finding's sentence first spoils the reveal the tease is setting up. */
    tallied(lane('r1s4', 'Compare', '', 'Looking for similar tickets', undefined,
      [tk('INC-4102'), tk('INC-4188'), tk('INC-4231')]), { ticket: 6 }),
    /* The SYMPTOM is this check's own; the dock model belongs to the finding below it. */
    lane('r1s5', 'Compare', '', 'Comparing symptoms across those tickets',
      { value: 'Same symptom', label: 'flicker only when docked' }, [tk('INC-4290'), tk('INC-4356')]),
    {
      kind: 'discovery', id: 'r1d1', tease: 'This has come up before', role: 'evidence',
      headline: '6 similar laptop/display tickets',
      detail: 'All routed to End User Computing - Laptop & Desktop.',
    },
    tallied(lane('r1s6', 'Compare', '', 'Checking the dock firmware advisories',
      { value: 'KB-2210', label: 'the dock firmware advisory' },
      [kb('KB-2210 · WD19 dock firmware'), doc('Dell WD19 release notes')]), { 'KB article': 1 }),
    {
      kind: 'discovery', id: 'r1d3', tease: 'And it narrows further', role: 'evidence',
      headline: '5 of those 6 were the same dock model',
      detail: 'WD19 docks running firmware below 4.2.',
    },
    /* PRIORITY here, category in the routing finding below — between them they are the two
       halves of this check's label, and neither says the other's half twice. */
    lane('r1s7', 'Decide', '', 'Working out the right category and priority',
      { value: 'Medium', label: 'priority, by the policy' }, [doc('Categorisation policy')]),
    /* ROUTING is where the ticket LANDS — the decision, not the evidence behind it. The dock-model
       finding above was carrying this role and the footer duly printed it under ROUTED AS, which
       is how a mislabelled role becomes a wrong claim on the answer card. */
    {
      kind: 'discovery', id: 'r1d4', tease: 'Where this will go', role: 'routing',
      headline: 'End User Computing → Laptop & Desktop',
      detail: 'Matches where all six similar tickets were handled.',
    },
    lane('r1s8', 'Decide', '', 'Checking whether you have already raised this',
      { value: 'Nothing open', label: 'for this already' }),
    {
      kind: 'discovery', id: 'r1d2', tease: 'One thing I could not check', role: 'gap',
      headline: "Your docking station isn't in your asset list",
      detail: "I can log the ticket without it, but it won't be linked.",
    },
    /* NO FACT: preparing a draft reads nothing. The draft itself is the result, and it is the
       next thing on screen. */
    lane('r1s9', 'Decide', '', 'Preparing the draft'),
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
           Creating goes propose → confirm (the Next-step dock's option 1) → store.createTicket →
           ConfirmBanner, and the dock moves on to the post-creation options. */
        blocks: [
          { w: 'draft', id: 'req01', title: 'New incident', category: 'End User Computing',
            fields: [
              { label: 'Type', value: 'Incident' },
              { label: 'Subject', value: 'Laptop screen flickers when docked', editable: true },
              /* INFERRED, THEREFORE CORRECTABLE. A guess a reader can see but not change is a
                 guess they have to accept. */
              { label: 'Category', value: 'End User Computing', inferred: true, editable: true, options: ['End User Computing', 'Network & VPN', 'Access & Identity', 'Payments & Cards', 'Branch Systems', 'HR Services'] },
              { label: 'Subcategory', value: 'Laptop & Desktop', inferred: true, editable: true, options: ['Laptop & Desktop', 'Peripherals', 'Docking & Displays', 'Operating System'] },
              { label: 'Priority', value: 'Medium', inferred: true, editable: true, options: ['Low', 'Medium', 'High'] },
              { label: 'Requester', value: 'you' },
            ],
            primary: 'Create ticket', secondary: 'Discard',
            /* No inline actions on the banner: "Add a note" is the dock's, after creation. */
            banner: { text: '{ref} created — End User Computing will pick it up' } },
        ],
        how: {
          reasoning: [
            '**6 similar laptop/display tickets** match your symptoms.',
            'All six were handled under **End User Computing → Laptop & Desktop**, so the draft goes there.',
            '**5 of the 6** were the same **WD19 dock** on older firmware — which is why the dock model matters.',
          ],
          checked: ['Your assigned assets', 'Similar tickets and how they were handled', 'Dock firmware advisories', 'Whether you had already raised this'],
        },
        menu: ['Copy summary'],
        /* NO CHIPS. A requester turn's forward actions — before and after creation — are the
           Next-step dock's, authored in dock/nextSteps.ts. */
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
  topic: 'your unresolved VPN ticket',
  match: /(any )?update on my vpn|vpn.*any update/i,
  beats: [
    /* SOURCES on the checks that actually opened something. Without them "Why Nova says this"
       has a Sources section that can never appear — which is how the flagship requester case
       shipped with provenance that existed only in the component. */
    step('r2s1', 'Finding your unresolved requests', [dat('Your unresolved requests')]),
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
const TEC_01_REVEAL: Script = {   /* the earlier REVEAL presentation — reachable as TEC-01/reveal */
  topic: 'what needs you first',
  view: 'reveal',
  match: /reveal (my |the )?shift|shift.{0,20}reveal/i,
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
const TEC_02_REVEAL: Script = {   /* the earlier live-scope presentation — reachable as TEC-02/reveal */
  topic: 'the bulk salary upload failures',
  view: 'reveal',
  match: /march.{0,60}salary|salary.{0,60}march/i,
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
const TEC_03_ASK: Script = {   /* the clarifying-question presentation — reachable as TEC-03/ask */
  topic: 'the Bengaluru VPN drops',
  view: 'steps',
  match: /ask me first.{0,80}vpn|vpn.{0,80}ask me first/i,
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
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const CXO_02_LEGACY: Script = {  /* SUPERSEDED by leadershipScripts.ts — not in the SCRIPTS map */
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
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const CXO_07_LEGACY: Script = {  /* SUPERSEDED by leadershipScripts.ts — not in the SCRIPTS map */
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
const TEC_07_PLAN: Script = {   /* the plan-first interaction — reachable as TEC-07/plan */
  topic: 'your night-shift handover',
  activity: 'Planning your night-shift handover',
  match: /plan (my|the|a) .{0,40}handover|handover plan/i,
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
            covers: 'the 2 burning incidents', reads: 'Open queue · evening snapshot',
            done: { label: 'Burning', value: '**INC-4390** and **INC-4482** summarised with next actions' } },
          { id: 'p2', label: 'List the blocked tickets with what unblocks them',
            detail: 'The 3 vendor-blocked tickets, each with who owes what.',
            execLabel: 'Listing the blocked tickets',
            covers: 'the 3 blocked tickets', reads: 'Vendor status board',
            done: { label: 'Blocked', value: '**3 tickets** listed with what unblocks each' } },
          { id: 'p3', label: 'Flag the regulator deadline on INC-4371',
            detail: 'The 48-hour reporting window closes tomorrow at 14:00.',
            execLabel: 'Flagging the regulator deadline',
            covers: "INC-4371's regulator deadline", reads: 'Compliance register',
            done: { label: 'Regulator', value: '**INC-4371** flagged — window closes tomorrow 14:00', tone: 'warn' } },
          { id: 'p4', label: 'Attach the overnight SLA clocks',
            detail: 'Which clocks keep running tonight and which resume at 08:00.',
            execLabel: 'Attaching the SLA clocks',
            covers: 'the 4 overnight SLA clocks', reads: 'SLA clocks · overnight',
            done: { label: 'SLA', value: '**4 overnight clocks** attached' } },
          { id: 'p5', label: 'Post the handover to the night-shift channel',
            execLabel: 'Posting the handover',
            posts: 'the night-shift channel',
            done: { label: 'Handover', value: 'Posted to the **night-shift channel**', tone: 'ok' } },
          { id: 'p6', label: 'Notify the night-shift lead',
            detail: 'A direct notification so it is read at shift start, not found later.',
            execLabel: 'Notifying the night-shift lead',
            posts: 'the night-shift lead, directly',
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
        approve: 'Build the handover',
        approveMeta: 'you review before it posts',
        modify: 'Change the plan',
        addable: { id: 'p7', label: "Include today's closed tickets",
          detail: 'What the day shift finished, so the night shift does not chase it.',
          execLabel: "Including today's closed tickets",
          covers: "today's closed tickets", reads: 'Ticket activity · today',
          done: { label: 'Closed today', value: '**9 tickets** closed by the day shift' } },
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
  /* TEC-01 through TEC-07, every technician chip's own script, and the ref / KB scripts a
     dense-feed chip reaches. */
  ...TECHNICIAN_SCRIPTS,
  /* The earlier technician presentations — reveal chapters, the live scope strip, the
     clarifying ask, the plan-first handover — kept REACHABLE by a distinct typed phrasing so
     those interaction patterns stay live in the product rather than becoming dead code. */
  'TEC-01/reveal': TEC_01_REVEAL,
  'TEC-02/reveal': TEC_02_REVEAL,
  'TEC-03/ask': TEC_03_ASK,
  'TEC-07/plan': TEC_07_PLAN,
  /* CXO-01 through CXO-07, their drills, and every leadership chip's own script. */
  ...LEADERSHIP_SCRIPTS,
};

/** The authored script for a case, or null so the caller falls back by intent. */
export const scriptFor = (caseId?: string): Script | null =>
  (caseId && SCRIPTS[caseId]) || null;

/** The authored script a TYPED question reaches, by its own words. Ordered by the registry's own
 *  key order, and first match wins — the three patterns are disjoint by construction. */
export const scriptForQuestion = (question: string): Script | null =>
  Object.values(SCRIPTS).find((s) => s.match?.test(question)) ?? null;
