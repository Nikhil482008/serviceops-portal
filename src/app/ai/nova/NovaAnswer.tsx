import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { evidenceOf, type Turn } from './turnModel';
import { AnswerBlock } from './conversation/AnswerBlock';
import {
  DEFAULT_VIEW, ResponseUtilityBar, type AnswerView, type UtilityAction,
} from './conversation/ResponseUtilityBar';
import { EvidenceBlock } from './conversation/EvidenceBlock';
import { CitationProvider } from './conversation/NovaCitations';
import { NovaEvidenceDrawer } from './conversation/NovaEvidenceDrawer';
import { ActionGroup, DiscardedNotice } from './conversation/ActionGroup';
import { FollowUpSuggestions } from './conversation/FollowUpSuggestions';
import { RequesterBlocks } from './conversation/RequesterBlocks';
import { assertRunnable } from './conversation/TechnicianBlocks';
import { downloadCsv, primaryCsv } from './conversation/LeadershipCharts';
import { RequesterDockCtx } from './dock/RequesterDockCtx';
import { TurnOutcomes } from './dock/TurnOutcomes';
import { TechTurnCtx } from './tech/TechTurnCtx';
import { AttachedActions } from './tech/AttachedActions';
import { useTechActions } from './tech/useTechActions';

/* The response, in the order a reader wants it.
 *
 *   1. ANSWER      what Nova concludes (incl. the object it made)   AnswerBlock
 *   2. CAVEAT      a limit, beside the object it qualifies           EvidenceBlock (gaps)
 *   3. EVIDENCE    how it got there, collapsed — the ONE trust path  EvidenceBlock (fold)
 *   4. ACTIONS     what I can do — the conclusion of the answer      ActionGroup
 *   5. FOLLOW-UP   what else I could ask, AFTER the action is done   FollowUpSuggestions
 *
 * This file is now only the ORDER, and the one piece of state that spans it. Everything that
 * knows how a layer LOOKS lives in its own component, which is what makes the same four layers
 * reusable across the requester, technician and leadership views: the depth, the content and the
 * available actions change; the sequence does not.
 *
 * The ••• menu's in-place variants (shorter, technical, plain, closed-today, re-rank, full log,
 * no reminder) live in ONE `variants` map the block renderer reads; none creates a turn.
 *
 * ⚠️ THIS COMPONENT TAKES A TURN, NOT AN ANSWER. It cannot be handed a canned answer object
 * and told to render it — there is no prop for one. The only route onto the screen is through
 * the machine, and the guard below is the last link: `answering | settled`, and `settled` is
 * unreachable except from `answering` (turnModel.setState).
 */
/** THE CHIPS CARRY THE REMAINDER. The dock and the follow-ups were authored from the same
 *  questions — the dock's requester options in `nextSteps.ts` are those questions, copied — so
 *  restoring the chips without this puts REQ-02's three questions on screen twice, six inches
 *  apart. The dock wins: it is nearer the hand, larger, and holds actions the chips cannot.
 *
 *  Matched on letters and digits only, so "Tell Priya it's urgent" cannot slip past on an
 *  apostrophe, while "What was the fix?" and "What was the fix for the card?" stay two
 *  questions — they are, and the shorter one is worth asking after the longer one is answered. */
const plain = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, '');

function spare(
  questions: Array<string | { label: string; disabled?: boolean }>,
  offered?: string[],
): Array<string | { label: string; disabled?: boolean }> {
  if (!offered?.length) return questions;
  const taken = new Set(offered.map(plain));
  return questions.filter((q) => !taken.has(plain(typeof q === 'string' ? q : q.label)));
}

export function NovaAnswer({ turn, live, dense, requester, offered, onFollowUp, onRetry }: {
  turn: Turn;
  /** False once a newer turn exists — and then a past answer offers nothing. */
  live: boolean;
  /** A REQUESTER turn: forward actions live in the Next-step dock. The cards register their
   *  runners instead of drawing buttons, the dock's chosen lines render beneath the answer, and
   *  there is no chips row. Technician and leadership turns keep both. */
  requester?: boolean;
  /** Labels the dock is already offering. See `spare` below. */
  offered?: string[];
  /** The technician register — references in the caveat and the fold are clickable chips. */
  dense?: boolean;
  /** A follow-up, with optional context — a drill carries `{ caseId, filter }`. */
  onFollowUp: (question: string, context?: Record<string, unknown>) => void;
  /** Re-run this same question in place — the ••• menu's Regenerate. */
  onRetry?: () => void;
}) {
  const [discarded, setDiscarded] = useState(false);
  /* The primary action has been carried out — only then do the follow-up pills appear. */
  const [acted, setActed] = useState(false);
  /* The trust ladder's third rung — one state for every way into the evidence drawer. */
  const [evidence, setEvidence] = useState<{ open: boolean; focus?: string }>({ open: false });
  const openEvidence = (focus?: string) => setEvidence({ open: true, focus });
  /* The reader's rendering of this answer — density and visual, driven by the ••• menu. */
  const [answerView, setAnswerView] = useState<AnswerView>(DEFAULT_VIEW);
  const [elaborateSignal, setElaborateSignal] = useState(0);
  /* Which authored rendering of a StepList block is showing — REQ-04's "Make it shorter" /
     "Show technical details" swap between HARDCODED variants, never a generated cut. */
  const [stepsVariant, setStepsVariant] = useState<'default' | 'short' | 'detail'>('default');
  /* The ••• "Show as table": every ChartFrame in this turn renders its table fallback. */
  const [tables, setTables] = useState(false);
  const [variants, setVariants] = useState<Record<string, unknown>>({});
  /* Stable identity, or every card would re-register with the dock on every render. */
  const dockCtx = useMemo(() => (requester ? { turnId: turn.id } : null), [requester, turn.id]);
  /* A TECHNICIAN ACTION TURN (TEC-01..06 and the scripts their actions reach). Its cards render
     no buttons and register their inputs; the do-actions are attached under the turn. A null set
     is every other turn — TEC-07, a leadership turn, a requester turn — and nothing changes. */
  const techSet = useTechActions(turn);
  const techCtx = useMemo(() => (techSet ? { turnId: turn.id, live } : null), [techSet, turn.id, live]);
  const bump = (k: string, v: unknown) => setVariants((x) => ({ ...x, [k]: v }));
  const toggle = (k: string) => setVariants((x) => ({ ...x, [k]: !x[k] }));

  const onUtility = (action: UtilityAction) => {
    if (action.kind === 'shorter') setAnswerView((v) => ({ ...v, density: 'concise' }));
    else if (action.kind === 'elaborate') {
      setAnswerView((v) => ({ ...v, density: 'detailed' }));
      setElaborateSignal((s) => s + 1);
    } else if (action.kind === 'regenerate') setAnswerView(DEFAULT_VIEW);
    else setAnswerView((v) => ({ ...v, visual: action.visual }));
  };
  /* The ••• menu's TYPE-SPECIFIC items: an in-place variant, a real export or a follow-up
     question. Nine authored items matched no branch here and so only ever toasted "Not in this
     demo" — they were removed from the scripts, and `assertRunnable` is what stops another being
     authored. An approved plan step (p7) also flips closed-today. */
  const onMenuItem = (label: string) => {
    const a = turn.answer;
    const hasTonedDraft = !!a?.blocks?.some((b) => b.w === 'note' && !!b.tones);
    if (label === 'Make it shorter') {
      setStepsVariant((v) => (v === 'short' ? 'default' : 'short'));
      toggle('shorter');
      if (hasTonedDraft) bump('toneSignal', { tone: 'shorter', nonce: Date.now() });
    }
    else if (label === 'Show technical details') { setStepsVariant((v) => (v === 'detail' ? 'default' : 'detail')); toggle('technical'); }
    else if (label === 'Show as table') setTables(true);
    else if (label === 'Show as plain text') toggle('plain');
    else if (label === 'Include closed-today') toggle('closedToday');
    else if (label === 'Re-rank by SLA only') bump('rank', 'sla');
    else if (label === 'Re-rank by priority only') bump('rank', 'priority');
    else if (label === 'Show full queue') bump('fullQueue', true);
    else if (label === 'Show the full incident log') bump('fullLog', true);
    else if (label === 'Edit note') bump('focusNote', Date.now());
    else if (label === 'Hold without a reminder') bump('noReminder', true);
    else if (label === 'Show what the requester will see') toggle('preview');
    else if (/^Open (KB-\d+)/i.test(label)) {
      const id = label.match(/(KB-\d+)/i)![1].toUpperCase();
      setVariants((x) => ({ ...x, kbOpen: id, kbNonce: (Number(x.kbNonce) || 0) + 1 }));
    }
    else if (/^Export/i.test(label)) {
      /* A real CSV of the turn's PRIMARY dataset — its first chart — named by the item. */
      const seg = (turn.context?.filter as { segment?: string } | undefined)?.segment;
      const out = primaryCsv(a?.blocks, seg);
      if (!out) { toast('Nothing to export in this answer'); return; }
      const name = /vendor review/i.test(label) ? 'vendor-review.csv'
        : /vendor call/i.test(label) ? 'vendor-call.csv'
          : /change board/i.test(label) ? 'change-board.csv'
            : /incident register/i.test(label) ? 'incident-register.csv'
              : /list/i.test(label) ? 'regulatory-open.csv'
                : `${(turn.caseId ?? 'nova').toLowerCase()}-${out.data}.csv`;
      downloadCsv(name, out.csv);
    }
    else if (/^Show (underlying|the \d+ breached)/i.test(label)) onFollowUp(label);
    /* Every authored item above is handled. One that is not is an AUTHORING bug — it used to
       reach the reader as a toast reading "Not in this demo"; now it reaches the author. */
    else assertRunnable(label, false);
  };
  /* A LOCAL chip — TEC-05's "Make it shorter" switches the draft's tone in place. */
  const onLocal = (key: string) => {
    if (key === 'shorter') bump('toneSignal', { tone: 'shorter', nonce: Date.now() });
    else assertRunnable(key, false);
  };

  /* The state machine is the gate. Not a convenience check — the whole enforcement. */
  if (turn.state !== 'answering' && turn.state !== 'settled') return null;
  const a = turn.answer;
  if (!a) return null;

  if (discarded) return <DiscardedNotice onUndo={() => setDiscarded(false)} />;

  const body = (
    <div style={{ marginTop: 'var(--nova-gap-block)' }}>
      {/* NO HAIRLINE above the answer. One used to run here, between "what I did" and "what I
          found". With the working reduced to a single line of text there is nothing left for a
          rule to separate it FROM — whitespace and the type do the job, and a line under a
          sentence made the sentence read as a section header. */}

      {/* Citations inside the answer resolve through this provider — CLAIM → SOURCE is one
          click, straight into the drawer focused on the right record. */}
      <CitationProvider answer={a} onOpen={openEvidence}>
        <AnswerBlock
          answer={a}
          view={answerView}
          /* SOME BLOCKS WRITE THE TURN'S CONCLUSION. The status of one ticket, the shape of all
             of them, the start of a shift - each derives a headline from the record, so a turn
             that leads with one and authors no headline of its own must not have its TITLE
             promoted into that slot. Two headlines is one too many. Not a persona test: it is
             about which block leads. */
          titleLed={!(!a.headline
            && ['status', 'summary', 'ticketcards', 'shift', 'incbrief', 'patternbrief', 'vendorbrief']
              .includes(a.blocks?.[0]?.w ?? ''))}
        />
      </CitationProvider>
      {/* The interactive surface — data-described blocks wired to the mock ticket store, every
          mutation behind its own confirm. Confirming the MAIN proposal swaps the chip set below
          (followUpsAfter). */}
      <RequesterDockCtx.Provider value={dockCtx}>
        {!!a.blocks?.length && (
          <RequesterBlocks
            blocks={a.blocks}
            question={turn.question}
            context={turn.context}
            variants={{ ...variants, closedToday: !!variants.closedToday !== !!a.planSteps?.includes('p7') }}
            changed={a.changed}
            headline={a.headline}
            onAsk={onFollowUp}
            onConfirmed={() => setActed(true)}
            stepsVariant={stepsVariant}
            tables={tables}
          />
        )}
        {/* WHAT THE DOCK RAN HERE — the chosen lines, and the banner or record an action with no
            card of its own leaves behind. Beneath the answer it acted on. */}
        {requester && <TurnOutcomes turnId={turn.id} />}
      </RequesterDockCtx.Provider>
      <EvidenceBlock turn={turn} onViewSources={openEvidence} openSignal={elaborateSignal} dense={dense} onAsk={onFollowUp} />
      <ActionGroup
        answer={a}
        onAsk={onFollowUp}
        onDiscard={() => setDiscarded(true)}
        onDone={() => setActed(true)}
      />
      {/* A DRAFT holds its follow-ups back until the reader has created (or discarded) it —
          the CTA is the conclusion of that answer, not one option in a list of five. A primary
          that merely OPENS a record is navigation, so its suggestions show straight away. */}
      {/* The quiet utility layer — copy, share, the sources entry point, feedback, and the
          contextual ••• response controls. BEFORE the suggestions: these act on the response
          the reader just finished, the pills start the NEXT thing, so the conversation ends on
          where it goes rather than on its own chrome. */}
      <ResponseUtilityBar
        answer={a}
        sourceLabels={evidenceOf(turn).sources.map((s) => s.label)}
        view={answerView}
        onAction={onUtility}
        onRegenerate={onRetry}
        onMenuItem={onMenuItem}
      />
      {/* WHAT THE READER COULD ASK NEXT — which is not the same thing as what NOVA CAN DO next,
          and that is why these came back. The dock below holds ACTIONS: things Nova performs on
          the reader's behalf, each of which changes something. These are QUESTIONS: things the
          reader wants to know before deciding. "Create the ticket" and "What happens after I
          create it?" are not two offers of the same thing, and suppressing the second because the
          first exists left every requester answer with no way forward except to commit to
          something.

          They sit UNDER THE ANSWER, where the thing they are about is - the dock is a different
          place for a different kind of move. */}
      {(a.form !== 'draft' || !a.footer || a.footer.runAsks || acted) && (
        <FollowUpSuggestions
          questions={spare((acted && a.followUpsAfter) || a.followUps || [], offered)}
          live={live}
          onAsk={onFollowUp}
          onLocal={onLocal}
        />
      )}
      {evidence.open && (
        <NovaEvidenceDrawer
          turn={turn}
          focus={evidence.focus}
          onClose={() => setEvidence({ open: false })}
        />
      )}
      {/* WHAT I CAN DO — attached under the turn, with the └ connector. Every forward action
          this turn offers, in one place; a past turn's are greyed and not focusable. */}
      {techSet && <AttachedActions turnId={turn.id} live={live} set={techSet} />}
    </div>
  );

  if (!techCtx) return body;
  return <TechTurnCtx.Provider value={techCtx}>{body}</TechTurnCtx.Provider>;
}
