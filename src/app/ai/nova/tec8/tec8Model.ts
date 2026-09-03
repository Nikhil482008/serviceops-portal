/* TEC-8 — the whole scenario, as data and pure rules.
 *
 * ── WHY THIS IS A SEPARATE MODEL AND NOT A SCRIPT ────────────────────────────────────────────
 * Every other case in this module is an investigation: a stream of beats that ends in an answer.
 * TEC-8 is not that. It is a NEGOTIATION — Nova proposes, the reader edits, the reader approves,
 * and only then does anything happen. That needs a state machine the reader can drive backwards
 * and forwards, not a stream that plays once, so it gets its own model rather than being bent
 * into the beat list.
 *
 * ── EVERYTHING HERE IS DETERMINISTIC ─────────────────────────────────────────────────────────
 * No model call, no randomness, no generated copy. Every sentence the reader sees is authored in
 * this file or derived from it by a pure function, so the same state always renders the same
 * screen — which is what makes a state switcher meaningful for design review.
 *
 * ── THE PLAN IS DERIVED, NOT AUTHORED TWICE ──────────────────────────────────────────────────
 * The brief lists the original plan (7 steps) and the revised plan (6 steps) in full. Writing
 * both out would be two lists that agree today and disagree the first time either is edited.
 * Instead there are three SETTINGS — priority, queue, who to notify — and the steps, the impact
 * summary, the execution rows and the completion lines are all computed from them. Change a
 * setting and every one of those four surfaces moves together, because there is only one fact.
 */

export type Tec8State =
  | 'empty'
  | 'prompt'
  | 'investigating'
  | 'plan_ready'
  | 'modify'
  | 'plan_updated'
  | 'executing'
  | 'complete'
  | 'partial_failure';

/** In flow order. The switcher renders them in this order and nothing else defines it. */
export const TEC8_STATES: Tec8State[] = [
  'empty', 'prompt', 'investigating', 'plan_ready', 'modify',
  'plan_updated', 'executing', 'complete', 'partial_failure',
];

/** What the prototype switcher calls each one. */
export const TEC8_STATE_LABEL: Record<Tec8State, string> = {
  empty: 'Empty',
  prompt: 'Prompt',
  investigating: 'Investigating',
  plan_ready: 'Plan',
  modify: 'Modify',
  plan_updated: 'Updated plan',
  executing: 'Executing',
  complete: 'Complete',
  partial_failure: 'Partial failure',
};

/* ── the conversation's fixed copy ───────────────────────────────────────────────────────── */

export const TEC8_PROMPT =
  'Find the oldest unresolved VPN ticket assigned to my team, check what has already been tried, '
  + "and prepare an escalation. Don't make any changes until I approve the plan.";

/** Paragraphs, so the renderer never has to split on newlines and guess. */
export const TEC8_ACK: string[] = [
  'I found 3 unresolved VPN tickets assigned to your team.',
  'The oldest is INC-4471 — VPN disconnects from home network.',
  "I'll review its history and prepare the escalation plan. Nothing will be changed until you "
  + 'approve it.',
];

/** WHAT was checked — never how anything was reasoned.
 *
 *  Every row is a task a person could have performed. Nothing here reports an inference, a
 *  weighing of options, or a conclusion being reached; the justification for the plan lives in
 *  `TEC8_EVIDENCE`, as evidence, and even that is a list of facts rather than a train of
 *  thought. */
export const TEC8_CHECKS: string[] = [
  'Finding matching tickets',
  'Identifying the oldest unresolved ticket',
  'Reviewing ticket history',
  'Checking previous troubleshooting',
  'Reviewing SLA status',
  'Preparing escalation recommendation',
];

export const TEC8_TICKET = {
  id: 'INC-4471',
  title: 'VPN disconnects from home network',
  status: 'Waiting on vendor',
  priority: 'Medium',
  age: '6 days',
  sla: 'At risk',
  tried: ['Credential refresh', 'VPN client reinstall', 'Network test'],
} as const;

/** Why the plan is what it is. FACTS ABOUT THE TICKET, every one of them checkable against the
 *  context block above — not a narration of how a conclusion was reached. */
export const TEC8_EVIDENCE: string[] = [
  'Ticket has been open for 6 days',
  'No successful resolution recorded',
  'SLA is at risk',
  'Similar VPN incidents were escalated successfully',
  'Current ownership has not resolved the issue',
];

/** The modification the demo performs. Offered as a one-click chip as well as being typeable,
 *  so a reviewer can reach the revised plan without retyping a sentence. */
export const TEC8_MOD_EXAMPLE =
  "Don't change the priority. Assign it to the Network Escalation queue instead, and notify my "
  + 'manager instead of the team lead.';

export const TEC8_FOLLOW_UPS: string[] = [
  'Show similar incidents',
  'Check the ticket history',
  'Find the KB article',
];

/* ── the plan ───────────────────────────────────────────────────────── */

export type Tec8Queue = 'VPN Escalation' | 'Network Escalation';
export type Tec8Notify = 'Team lead' | 'Manager';

export interface Tec8Settings {
  /** `raise` is Medium → High; `none` leaves it alone. */
  priority: 'raise' | 'none';
  queue: Tec8Queue;
  notify: Tec8Notify;
  note: boolean;
}

/** A PLAN IS THREE THINGS, and it has to be all three.
 *
 *  The settings say what each step would do. `dropped` says which steps the reader removed —
 *  removal cannot be expressed as a setting, because "assign to nobody" is not a queue. `order`
 *  says what sequence they run in, which nothing else records once the reader has moved one.
 *
 *  They travel together so that APPROVAL can capture the whole thing in one value. Approving a
 *  plan and then comparing only its settings would miss exactly the edits a reader is most
 *  likely to make after approving — which is the hole §24 exists to close. */
export interface Tec8PlanState {
  settings: Tec8Settings;
  /** Step ids the reader removed. */
  dropped: string[];
  /** Step ids in the order the reader arranged them. Null means authoring order. */
  order: string[] | null;
}

export const TEC8_ORIGINAL: Tec8Settings = {
  priority: 'raise', queue: 'VPN Escalation', notify: 'Team lead', note: true,
};

/** What the demo modification produces. Not used to RENDER the revised plan — that is derived
 *  like any other — but it is what the natural-language interpreter is expected to arrive at,
 *  and the harness asserts the two agree. */
export const TEC8_REVISED: Tec8Settings = {
  priority: 'none', queue: 'Network Escalation', notify: 'Manager', note: true,
};

export const TEC8_PLAN_ORIGINAL: Tec8PlanState = {
  settings: TEC8_ORIGINAL, dropped: [], order: null,
};
export const TEC8_PLAN_REVISED: Tec8PlanState = {
  settings: TEC8_REVISED, dropped: [], order: null,
};

export interface Tec8Step {
  id: string;
  title: string;
  /** The line under the title. Empty for steps whose `change` says it better. */
  detail: string;
  /** Present tense, for the execution list: "Assigning to Network Escalation". */
  running: string;
  /** Past tense, for the completion list: "Assignment moved to Network Escalation". */
  done: string;
  /** Does this step change system state? Drives the safety marking on the step and decides
   *  whether it appears in the completion summary. */
  mutating: boolean;
  /** Which setting this step is the expression of — the compact editor edits that setting. */
  control?: keyof Tec8Settings;
  /** A value movement worth showing on the step itself: "Medium → High". */
  change?: string;
}

/** Every step the settings CAN produce, before removals and reordering. */
function allSteps(s: Tec8Settings): Tec8Step[] {
  const steps: Tec8Step[] = [
    {
      id: 'history',
      title: 'Review the ticket history',
      detail: 'Confirm what has already been tried.',
      running: 'Reviewing ticket history',
      done: 'Ticket history reviewed',
      mutating: false,
    },
    {
      id: 'related',
      title: 'Check related VPN incidents',
      detail: 'Compare similar incidents and their outcomes.',
      running: 'Checking related VPN incidents',
      done: 'Related incidents checked',
      mutating: false,
    },
    {
      id: 'sla',
      title: 'Verify SLA and current ownership',
      detail: 'Confirm whether the ticket needs escalation.',
      running: 'Verifying SLA and ownership',
      done: 'SLA and ownership verified',
      mutating: false,
    },
  ];

  if (s.priority === 'raise') {
    steps.push({
      id: 'priority',
      title: 'Raise priority',
      detail: '',
      change: 'Medium → High',
      running: 'Raising priority',
      done: 'Priority raised to High',
      mutating: true,
      control: 'priority',
    });
  }

  steps.push({
    id: 'assign',
    title: `Assign to ${s.queue}`,
    detail: 'Move the ticket to the appropriate escalation queue.',
    running: `Assigning to ${s.queue}`,
    done: `Assignment moved to ${s.queue}`,
    mutating: true,
    control: 'queue',
  });

  if (s.note) {
    steps.push({
      id: 'note',
      title: 'Add an internal note',
      detail: 'Summarize the investigation and previous troubleshooting.',
      running: 'Adding internal note',
      done: 'Internal investigation note added',
      mutating: true,
      control: 'note',
    });
  }

  const lead = s.notify === 'Team lead';
  steps.push({
    id: 'notify',
    title: lead ? 'Notify the team lead' : 'Notify your manager',
    detail: `Inform ${lead ? 'the lead' : 'your manager'} that the incident has been escalated.`,
    running: lead ? 'Notifying team lead' : 'Notifying manager',
    done: `${s.notify} notified`,
    mutating: true,
    control: 'notify',
  });

  return steps;
}

/** THE ONE PLACE A PLAN IS BUILT. The original plan, the revised plan, the execution list and
 *  the completion summary are all this function under different arguments, which is why none of
 *  them can disagree with another about what a step says or whether it is in the plan. */
export function planSteps(plan: Tec8PlanState): Tec8Step[] {
  const steps = allSteps(plan.settings).filter((x) => !plan.dropped.includes(x.id));
  if (!plan.order) return steps;
  const at = (id: string) => {
    const i = plan.order!.indexOf(id);
    return i === -1 ? Number.MAX_SAFE_INTEGER : i;   // never reordered → keep authoring position
  };
  return [...steps].sort((a, b) => at(a.id) - at(b.id));
}

/** Move one step, returning the order array that expresses it. Pure, so the caller decides
 *  whether the move was legal (`dir` off either end is a no-op, not an error). */
export function movedOrder(plan: Tec8PlanState, id: string, dir: -1 | 1): string[] {
  const ids = planSteps(plan).map((s) => s.id);
  const i = ids.indexOf(id);
  const j = i + dir;
  if (i === -1 || j < 0 || j >= ids.length) return ids;
  const next = [...ids];
  next[i] = ids[j];
  next[j] = ids[i];
  return next;
}

export interface Tec8Impact {
  label: string;
  value: string;
  /** False means "nothing happens here" — rendered quiet, so the row still appears and the
   *  reader can see the question was considered rather than dropped. */
  changed: boolean;
}

/** WHAT APPROVAL BUYS.
 *
 *  Derived from the VISIBLE STEPS, not from the settings. That difference is the whole reason
 *  removing a step is safe: drop "Raise priority" and this immediately reads "No change",
 *  because there is no second description of the plan that could be left behind. */
export function planImpact(plan: Tec8PlanState): Tec8Impact[] {
  const has = (id: string) => planSteps(plan).some((s) => s.id === id);
  const s = plan.settings;
  return [
    {
      label: 'Priority',
      value: has('priority') ? 'Medium → High' : 'No change',
      changed: has('priority'),
    },
    {
      label: 'Assignment',
      value: has('assign') ? `Current team → ${s.queue}` : 'No change',
      changed: has('assign'),
    },
    {
      label: 'Internal note',
      value: has('note') ? '1 note will be added' : 'No note will be added',
      changed: has('note'),
    },
    {
      label: 'Notification',
      value: has('notify') ? `${s.notify} will be notified` : 'No one will be notified',
      changed: has('notify'),
    },
  ];
}

export interface Tec8DiffRow { label: string; value: string; moved: boolean }

/** WHAT THE MODIFICATION DID, as movements rather than as a second list to re-read.
 *
 *  A row appears for every consequential setting, changed or not: "Priority — No change" is the
 *  most important line in the revised plan, because it is the thing the reader asked NOT to
 *  happen and the only way to show it was heard is to say it. */
export function planDiff(from: Tec8PlanState, to: Tec8PlanState): Tec8DiffRow[] {
  const a = planImpact(from);
  const b = planImpact(to);
  const val = (rows: Tec8Impact[], label: string) => rows.find((r) => r.label === label)!;

  const priorityTo = val(b, 'Priority');
  const assignFrom = val(a, 'Assignment');
  const assignTo = val(b, 'Assignment');

  return [
    {
      label: 'Priority',
      value: priorityTo.changed ? priorityTo.value : 'No change',
      moved: val(a, 'Priority').value !== priorityTo.value,
    },
    {
      label: 'Assignment',
      value: assignTo.changed ? `Current team → ${to.settings.queue}` : 'No change',
      moved: assignFrom.value !== assignTo.value,
    },
    {
      label: 'Notification',
      value: from.settings.notify === to.settings.notify
        ? val(b, 'Notification').value
        : `${from.settings.notify} → ${to.settings.notify}`,
      moved: from.settings.notify !== to.settings.notify
        || val(a, 'Notification').changed !== val(b, 'Notification').changed,
    },
  ];
}

/** Which STEPS the modification touched, by id — what earns an "Updated" mark. */
export function touchedSteps(from: Tec8PlanState, to: Tec8PlanState): string[] {
  const before = new Map(planSteps(from).map((s) => [s.id, s.title]));
  const after = planSteps(to);
  return after.filter((s) => !before.has(s.id) || before.get(s.id) !== s.title).map((s) => s.id);
}

/* ── reading a modification ──────────────────────────────────────────────── */

/** Turn the reader's sentence into a plan.
 *
 * ⚠️ NOT A LANGUAGE MODEL, and it does not pretend to be one. It recognises the four things
 * this plan can actually change and nothing else. That is the honest shape for a deterministic
 * prototype: a request it cannot act on is REFUSED (returns null) so the caller can say so,
 * rather than being quietly approximated into a plan the reader never asked for — which on a
 * screen whose whole purpose is authorising real changes would be the worst possible failure.
 *
 * "instead of X" is handled explicitly because the demo sentence names BOTH targets — "notify
 * my manager instead of the team lead" mentions the lead only to rule it out.
 */
export function interpretModification(text: string, from: Tec8PlanState): Tec8PlanState | null {
  const t = String(text || '').toLowerCase();
  if (!t.trim()) return null;
  const next: Tec8Settings = { ...from.settings };
  const dropped = new Set(from.dropped);
  let understood = false;

  /* priority */
  if (/(don'?t|do not|no|never)\b[^.]*\bpriority\b/.test(t)
    || /\bpriority\b[^.]*\b(unchanged|no change|as is|alone|the same)\b/.test(t)
    || /\bkeep (the )?priority\b/.test(t)) {
    next.priority = 'none';
    dropped.delete('priority');
    understood = true;
  } else if (/\b(raise|increase|bump)\b[^.]*\bpriority\b/.test(t)
    || /\bpriority\b[^.]*\bhigh\b/.test(t)) {
    next.priority = 'raise';
    dropped.delete('priority');
    understood = true;
  }

  /* which queue */
  if (/network escalation/.test(t) && !/instead of[^.]*network escalation/.test(t)) {
    next.queue = 'Network Escalation';
    dropped.delete('assign');
    understood = true;
  } else if (/vpn escalation/.test(t) && !/instead of[^.]*vpn escalation/.test(t)) {
    next.queue = 'VPN Escalation';
    dropped.delete('assign');
    understood = true;
  }

  /* who to tell */
  if (/\bmanager\b/.test(t) && !/instead of[^.]*\bmanager\b/.test(t)) {
    next.notify = 'Manager';
    dropped.delete('notify');
    understood = true;
  } else if (/\bteam lead\b/.test(t) && !/instead of[^.]*\bteam lead\b/.test(t)) {
    next.notify = 'Team lead';
    dropped.delete('notify');
    understood = true;
  }

  /* the note */
  if (/(don'?t|do not|no|without|skip)\b[^.]*\b(note|comment)\b/.test(t)) {
    next.note = false;
    understood = true;
  } else if (/\badd (an? )?(internal )?(note|comment)\b/.test(t)) {
    next.note = true;
    dropped.delete('note');
    understood = true;
  }

  return understood ? { settings: next, dropped: [...dropped], order: from.order } : null;
}

/** What Nova says when it could not act on the sentence. Authored, so it is never a generated
 *  apology, and it names what CAN be changed rather than only what could not. */
export const TEC8_MOD_REJECTED =
  "I can't change that from here. On this plan I can change the priority, the queue it goes to, "
  + 'whether an internal note is added, and who gets notified.';

/* ── execution ──────────────────────────────────────────────────────────── */

export type Tec8Outcome = 'success' | 'partial';

export interface Tec8ExecRow {
  step: Tec8Step;
  status: 'done' | 'running' | 'upcoming' | 'failed';
}

/** The execution list at a given moment.
 *
 * `index` is how many steps have finished; the row at `index` is the one running. On a partial
 * failure the LAST step FAILS rather than simply not appearing — a step that quietly never ran
 * is precisely what this state exists to make impossible. */
export function execRows(
  steps: Tec8Step[], index: number, outcome: Tec8Outcome, finished: boolean,
): Tec8ExecRow[] {
  return steps.map((step, i) => {
    if (finished) {
      const failed = outcome === 'partial' && i === steps.length - 1;
      return { step, status: failed ? 'failed' as const : 'done' as const };
    }
    if (i < index) return { step, status: 'done' as const };
    if (i === index) return { step, status: 'running' as const };
    return { step, status: 'upcoming' as const };
  });
}

/** The completion list: what ACTUALLY changed, in the order the plan did it.
 *
 * ⚠️ Built from the APPROVED plan, never from the live one. If the two have drifted, the reader
 * is owed the truth about what ran — not a description of whatever the screen happens to say
 * now. */
export function completionLines(
  approved: Tec8PlanState, outcome: Tec8Outcome,
): Array<{ text: string; ok: boolean }> {
  const steps = planSteps(approved).filter((s) => s.mutating);
  const lines = steps.map((s, i) => ({
    text: s.done,
    ok: !(outcome === 'partial' && i === steps.length - 1),
  }));
  /* The thing that did NOT happen, stated as a result. It was the reader's own instruction, and
     leaving it out would make the summary silent about the one change they asked to prevent. */
  if (!planSteps(approved).some((s) => s.id === 'priority')) {
    lines.push({ text: 'Priority unchanged', ok: true });
  }
  return lines;
}

/** Only these transitions are reachable by USING the prototype. The state switcher bypasses it
 *  deliberately — that is what it is for — but no button in the conversation ever does.
 *
 *  The two rules that matter: a plan can be revised any number of times before approval, and
 *  execution is reachable ONLY from a plan the reader has approved. */
export function canAdvance(from: Tec8State, to: Tec8State): boolean {
  const allowed: Record<Tec8State, Tec8State[]> = {
    empty: ['prompt'],
    prompt: ['investigating'],
    investigating: ['plan_ready'],
    plan_ready: ['modify', 'executing'],
    modify: ['plan_ready', 'plan_updated'],
    plan_updated: ['modify', 'executing'],
    executing: ['complete', 'partial_failure'],
    complete: [],
    partial_failure: ['executing'],
  };
  return allowed[from].includes(to);
}

/** Has the reader authorised what is currently on screen?
 *
 *  §24: approval authorises the EXACT plan shown at the time. Edit it afterwards and the
 *  authorisation no longer covers it — this is the predicate that says so, and it compares the
 *  WHOLE plan (settings, removals and order), not just the settings. */
export function approvalCovers(approved: Tec8PlanState | null, live: Tec8PlanState): boolean {
  if (!approved) return false;
  const sig = (p: Tec8PlanState) => JSON.stringify([
    p.settings.priority, p.settings.queue, p.settings.notify, p.settings.note,
    [...p.dropped].sort(),
    planSteps(p).map((s) => s.id),
  ]);
  return sig(approved) === sig(live);
}
