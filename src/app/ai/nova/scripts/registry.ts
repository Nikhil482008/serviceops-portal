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
  /** Follow-ups this ANSWER earns. Authored per script rather than drawn from a generic list —
   *  "what happens after I create it?" is only a sensible question under a draft card. */
  followUps?: string[];
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
}

export type Beat =
  /** `sources` is what the step actually READ. Optional, and only the thinking view surfaces it —
   *  a technician auditing an answer wants to know where it came from; a requester does not.
   *  `lane` and `phase` are the workspace view's two axes: WHERE a check is looking (Tickets,
   *  SLA, Teams…) and WHICH pass it belongs to. Both optional; the other two views ignore them. */
  | { kind: 'step'; id: string; label: string; sources?: StepSource[];
      lane?: string; phase?: string; metric?: StepMetric }
  /** `tease` is the eyebrow above a finding — "Interesting…", "One final check". It is the whole
   *  mechanic of the reveal view: a line that says something was found WITHOUT saying what, so the
   *  next second is spent wanting to know rather than waiting. Optional; the other views ignore
   *  it, and a finding with none still renders. */
  | { kind: 'discovery'; id: string; role: DiscoveryRole; headline: string; detail: string;
      tease?: string }
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
  beats: Beat[];
}

const step = (id: string, label: string, sources?: StepSource[]): Beat =>
  ({ kind: 'step', id, label, sources });

/** A workspace / chapter check: which lane and pass it belongs to, the number it lands on, and
 *  what it read to get there. */
const lane = (
  id: string, phase: string, laneName: string, label: string,
  metric?: StepMetric, sources?: StepSource[],
): Beat => ({ kind: 'step', id, label, phase, lane: laneName, metric, sources });

/* Shorthands. Sources are written beside the check that read them, so a script author cannot
   add a source without saying which check it belongs to. */
const tk = (label: string): StepSource => ({ label, kind: 'ticket' });
const kb = (label: string): StepSource => ({ label, kind: 'kb' });
const doc = (label: string): StepSource => ({ label, kind: 'doc' });
const dat = (label: string): StepSource => ({ label, kind: 'data' });

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
        text: 'It matches **6 similar tickets**, so the category and priority are already filled in. Review and create it.',
        /* `inferred` marks what NOVA decided rather than what the reader said. Type, Subject and
           Requester come from their own words; category, subcategory and priority are Nova's
           call — and this card is a thing they are about to approve. */
        fields: [
          { label: 'Type', value: 'Incident' },
          { label: 'Subject', value: 'Laptop screen flickers when docked' },
          { label: 'Category', value: 'End User Computing', inferred: true },
          { label: 'Subcategory', value: 'Laptop & Desktop', inferred: true },
          { label: 'Priority', value: 'Medium', inferred: true },
          { label: 'Requester', value: 'you' },
        ],
        footer: { run: 'Create ticket', cancel: 'Discard' },
        /* No `aside`. It said "we have handled 6 laptop/display issues like this before", which is
           the same fact as the BASED ON row, which is the same fact as the finding the reader
           already watched arrive. Three tellings of one thing; the footer's is the scannable one. */
        followUps: [
          "Add the dock's asset tag",
          'Make this high priority',
          'What happens after I create it?',
        ],
      },
    },
  ],
};

/* ── REQ-02 ──────────────────────────────────────────────────────────
   "Any update on my VPN issue?" — a status question, so the answer is a reading of what is on
   file rather than something to create. Eight checks: the extra ones are the difference between
   "it is with the vendor" and knowing whether that costs the requester anything. */
const REQ_02: Script = {
  topic: 'your open VPN ticket',
  match: /(any )?update on my vpn|vpn.*any update/i,
  beats: [
    /* SOURCES on the checks that actually opened something. Without them "Why Nova says this"
       has a Sources section that can never appear — which is how the flagship requester case
       shipped with provenance that existed only in the component. */
    step('r2s1', 'Finding your open requests', [dat('Your open requests')]),
    step('r2s2', 'Filtering to the VPN ones', [tk('INC-4471')]),
    step('r2s3', 'Reading the latest activity', [tk('INC-4471 · activity')]),
    {
      kind: 'discovery', id: 'r2d1', role: 'evidence',
      headline: 'INC-4471 moved to Waiting on vendor yesterday',
      detail: 'The network team raised it with the VPN gateway supplier.',
    },
    step('r2s4', 'Checking who it is waiting on', [dat('Vendor status')]),
    step('r2s5', "Reading the vendor's last response"),
    step('r2s6', 'Checking the SLA clock', [doc('SLA policy · P3 Response')]),
    {
      kind: 'discovery', id: 'r2d3', role: 'routing',
      headline: 'The clock is paused while it sits with the vendor',
      detail: 'It resumes when they respond, so no breach is being counted against this.',
    },
    step('r2s7', 'Looking for anything else of yours that is related'),
    step('r2s8', 'Checking whether there is a workaround meanwhile'),
    {
      kind: 'discovery', id: 'r2d2', role: 'gap',
      headline: "The supplier's own reference isn't on the ticket",
      detail: 'So I cannot tell you where it sits in their queue.',
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
          { label: 'Status', value: '**Waiting on vendor**', tone: 'warn' as const },
          { label: 'Ticket', value: '**INC-4471** — VPN disconnects from home network' },
          { label: 'With', value: '**Gateway supplier**, since yesterday afternoon' },
          { label: 'Next update', value: '**Within 2 working days**' },
          { label: 'SLA', value: '**Paused** while it is with the vendor', tone: 'ok' as const },
        ],
        text: 'Nothing is needed from you.',
        followUps: [
          'Chase the vendor',
          'Notify me when it changes',
          'Show me the full history',
        ],
      },
    },
  ],
};

/* ── REQ-04 ──────────────────────────────────────────────────────────────────────────────────
   "I changed my domain password and now VPN says authentication failed." — a troubleshoot, and
   the one case where the honest answer is a cause plus a next step, not a ticket. */
const REQ_04: Script = {
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
    lane('t2s2', 'Understand', '', 'Finding the tickets they mean',
      { value: '4 open', label: '1 major incident' },
      [tk('INC-4390'), dat('Corporate Banking ticket view')]),

    lane('t2s3', 'Check history', '', 'Reading the major incident timeline',
      { value: 'INC-4390', label: 'raised 04:12 today' },
      [tk('INC-4390'), doc('Major incident log')]),
    lane('t2s4', 'Check history', '', 'Checking what they have already been told',
      { value: '2', label: 'updates sent' },
      [dat('Customer comms log')]),
    {
      kind: 'discovery', id: 't2d1', role: 'routing',
      tease: 'Worth knowing before you speak',
      headline: 'They were last updated three hours ago',
      detail: 'The 09:00 update promised a fix by noon.',
    },

    lane('t2s5', 'Compare', '', 'Checking how many payrolls are affected',
      { value: '3', label: 'corporate clients' }),
    lane('t2s6', 'Compare', '', 'Measuring what is held up',
      { value: '₹4.2 cr', label: 'in salary transfers' },
      [dat('Payments queue'), doc('Bulk upload runbook')]),
    lane('t2s7', 'Compare', '', 'Looking for the same failure before',
      { value: '1', label: 'in March, same cause' },
      [tk('INC-2871 · March'), kb('KB-1190 · Bulk upload format errors')]),
    {
      kind: 'discovery', id: 't2d2', role: 'evidence',
      tease: 'Interesting\u2026',
      headline: "March's incident was a file-format change",
      detail: 'The same upstream vendor changed their delimiter without notice.',
    },

    lane('t2s8', 'Verify', '', 'Checking the current fix status',
      { value: 'In UAT', label: 'patch built 10:40' },
      [dat('Release pipeline'), tk('CHG-1044')]),
    lane('t2s9', 'Verify', '', 'Checking who owns the next step',
      { value: 'Payments', label: 'Engineering' }),
    lane('t2s10', 'Verify', '', 'Checking the noon estimate still holds'),
    {
      kind: 'discovery', id: 't2d3', role: 'gap',
      tease: 'One thing I could not check',
      headline: 'I could not confirm the noon estimate',
      detail: 'Payments Engineering has not posted an update since 09:40.',
    },
    {
      kind: 'answer',
      payload: {
        form: 'text',
        title: 'Your 30 seconds',
        headline: 'Salary uploads have been failing since 04:12 — same cause as March',
        kv: [
          { label: 'Impact', value: '**3 corporate clients**, about **₹4.2 crore** held' },
          { label: 'Cause', value: 'Upstream vendor **changed their file format** without notice' },
          { label: 'Fix', value: 'Patch in **UAT since 10:40**, owned by Payments Engineering' },
          { label: 'Careful', value: 'The **noon** estimate is from 09:00 and **unconfirmed since 09:40**', tone: 'risk' as const },
        ],
        text: 'Bulk salary uploads have been failing since 04:12 for three corporate clients, holding about ₹4.2 crore in transfers. Cause is the same as March: the upstream vendor changed their file format without notice. A patch is in UAT as of 10:40 and Payments Engineering owns the release. They were last told 09:00 that it would be fixed by noon — do not repeat that time, because nobody has confirmed it since 09:40.',
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
      { value: '1,284', label: 'open tickets analysed' }),
    lane('c2a2', 'Live analysis', 'SLA', 'Counting breaches',
      { value: '27', label: 'breached' }),
    lane('c2a3', 'Live analysis', 'SLA', 'Checking breach patterns'),
    lane('c2a4', 'Live analysis', 'Teams', 'Reading Service Desk workload',
      { value: 'Service Desk', label: '14 of 27' }),
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
        text: 'Breaches are up 18% on May, and the rise is not spread across the estate — it '
          + 'sits almost entirely in VPN authentication tickets from two offices that moved to '
          + 'the new policy on 3 June.',
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

export const SCRIPTS: Record<string, Script> = {
  'REQ-01': REQ_01,
  'REQ-02': REQ_02,
  'REQ-04': REQ_04,
  'TEC-01': TEC_01,
  'TEC-02': TEC_02,
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
