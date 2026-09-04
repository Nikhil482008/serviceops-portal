import { useState } from 'react';
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
 * It replaced a single 216-line component that rendered all four as one run of markup with the
 * evidence in the middle and the actions buried above it — which is precisely why the response
 * read as a wall.
 *
 * ⚠️ THIS COMPONENT TAKES A TURN, NOT AN ANSWER. It cannot be handed a canned answer object
 * and told to render it — there is no prop for one. The only route onto the screen is through
 * the machine, and the guard below is the last link: `answering | settled`, and `settled` is
 * unreachable except from `answering` (turnModel.setState).
 */
export function NovaAnswer({ turn, live, onFollowUp, onRetry }: {
  turn: Turn;
  /** False once a newer turn exists. Old suggestions stay VISIBLE but stop working — removing
   *  them would rewrite the history the reader is scrolling through. */
  live: boolean;
  onFollowUp: (question: string) => void;
  /** Re-run this same question in place — the ••• menu's Regenerate. */
  onRetry?: () => void;
}) {
  const [discarded, setDiscarded] = useState(false);
  /* The primary action has been carried out — only then do the follow-up pills appear on an
     action-driven answer, so nothing competes with the thing the reader came to do. */
  const [acted, setActed] = useState(false);
  /* The trust ladder's third rung. One state for every way in — an inline citation, or a
     source chip in the fold — so the drawer always opens the same drawer. */
  const [evidence, setEvidence] = useState<{ open: boolean; focus?: string }>({ open: false });
  const openEvidence = (focus?: string) => setEvidence({ open: true, focus });
  /* The reader's rendering of this answer — density and visual, driven by the ••• menu. The
     facts are the script's; only their presentation is the reader's. */
  const [answerView, setAnswerView] = useState<AnswerView>(DEFAULT_VIEW);
  const [elaborateSignal, setElaborateSignal] = useState(0);
  /* Which authored rendering of a StepList block is showing — REQ-04's "Make it shorter" /
     "Show technical details" swap between HARDCODED variants, never a generated cut. */
  const [stepsVariant, setStepsVariant] = useState<'default' | 'short' | 'detail'>('default');
  const onUtility = (action: UtilityAction) => {
    if (action.kind === 'shorter') setAnswerView((v) => ({ ...v, density: 'concise' }));
    else if (action.kind === 'elaborate') {
      setAnswerView((v) => ({ ...v, density: 'detailed' }));
      setElaborateSignal((s) => s + 1);
    } else if (action.kind === 'regenerate') setAnswerView(DEFAULT_VIEW);
    else setAnswerView((v) => ({ ...v, visual: action.visual }));
  };
  /* The ••• menu's TYPE-SPECIFIC items. The two the whole system knows are the StepList variant
     swaps; everything else authored-but-unwired says so out loud rather than silently no-oping. */
  const onMenuItem = (label: string) => {
    if (label === 'Make it shorter') setStepsVariant((v) => (v === 'short' ? 'default' : 'short'));
    else if (label === 'Show technical details') setStepsVariant((v) => (v === 'detail' ? 'default' : 'detail'));
    else toast('Not in this demo');
  };

  /* The state machine is the gate. Not a convenience check — the whole enforcement. */
  if (turn.state !== 'answering' && turn.state !== 'settled') return null;
  const a = turn.answer;
  if (!a) return null;

  if (discarded) return <DiscardedNotice onUndo={() => setDiscarded(false)} />;

  return (
    <div style={{ marginTop: 'var(--nova-gap-block)' }}>
      {/* The transition from "what I did" to "what I found". One hairline across Nova’s own
          content column — it separates two layers of ONE message, not two speakers. */}
      {turn.steps.length > 0 && (
        <div className="mb-3 border-t border-[var(--nova-rule)]" aria-hidden="true" />
      )}

      {/* Citations inside the answer resolve through this provider — CLAIM → SOURCE is one
          click, straight into the drawer focused on the right record. */}
      <CitationProvider answer={a} onOpen={openEvidence}>
        <AnswerBlock answer={a} view={answerView} />
      </CitationProvider>
      {/* The requester's interactive surface — data-described blocks wired to the mock ticket
          store, every mutation behind its own confirm. Confirming the MAIN proposal swaps the
          chip set below (followUpsAfter). */}
      {!!a.blocks?.length && (
        <RequesterBlocks
          blocks={a.blocks}
          question={turn.question}
          onAsk={onFollowUp}
          onConfirmed={() => setActed(true)}
          stepsVariant={stepsVariant}
        />
      )}
      <EvidenceBlock turn={turn} onViewSources={openEvidence} openSignal={elaborateSignal} />
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
        onOpenSources={() => openEvidence()}
        onExpandEvidence={() => setElaborateSignal((s) => s + 1)}
        onRegenerate={onRetry}
        onMenuItem={onMenuItem}
      />
      {(a.form !== 'draft' || !a.footer || a.footer.runAsks || acted) && (
        <FollowUpSuggestions
          questions={(acted && a.followUpsAfter) || a.followUps || []}
          live={live}
          onAsk={onFollowUp}
        />
      )}
      {evidence.open && (
        <NovaEvidenceDrawer
          turn={turn}
          focus={evidence.focus}
          onClose={() => setEvidence({ open: false })}
        />
      )}
    </div>
  );
}
