import { useEffect, useRef, useState } from 'react';
import type { BannerSpec } from '../scripts/registry';
import { useRequesterDock } from '../dock/RequesterDockCtx';
import { useTechTurn } from '../tech/TechTurnCtx';
import {
  proposalKey, proposalOf, registerProposal, setProposalCanRun, setProposalTally, settleProposal, unregisterRunner,
} from '../dock/proposals';

/* THE CARD KIT — the surface, the two button recipes, the confirmation banner and the
 * propose → confirm → banner state, shared by the requester, technician and leadership blocks.
 *
 * Extracted from RequesterBlocks so the technician primitives can use the SAME banner and the
 * same proposal state without importing the requester renderer (which imports them back). One
 * ConfirmBanner, one "discarded" line, one shell — which is what keeps twenty cards from
 * becoming twenty designs.
 *
 * ── AND ONE PROPOSAL STATE THAT KNOWS WHERE ITS BUTTON WENT ─────────────────────────────────
 * In a requester turn the card's confirm is the Next-step dock's option 1, not a button in the
 * card's footer. `useProposal` reads the dock context: inside a requester turn it REGISTERS the
 * card's runner and phase with the dock's store (so the dock can offer and run it) and tells the
 * card to render no footer; outside one it is exactly the local state it always was.
 */

/* WHITE. The body used to wear `--nova-surface-subtle`, which is also the hover ground — so a
   row under the pointer painted the colour that was already beneath it and nothing appeared to
   happen. The grey belongs to the header band and to the row being pointed at; the body is the
   ground both of them are read against. */
export const CARD = 'overflow-hidden rounded-lg border border-[var(--nova-rule)] bg-[var(--nova-surface)]';
export const PRIMARY = 'nova-btn nova-btn-primary inline-flex h-9 items-center rounded px-4 ask-text-base ask-w-500 disabled:opacity-40';
export const GHOST = 'nova-btn nova-btn-ghost inline-flex h-9 items-center rounded px-3 ask-text-base disabled:opacity-40';
export const PRIMARY_SM = PRIMARY.replace('h-9', 'h-8');
export const GHOST_SM = GHOST.replace('h-9', 'h-8');
export const QUIET = 'nova-btn nova-hit nova-tertiary';

export const bannerText = (spec: BannerSpec, ref: string): string => spec.text.replace(/\{ref\}/g, ref);

/* ── ConfirmBanner ──────────────────────────────────────────────────────── */
export function ConfirmBanner({ spec, mutatedRef, onAsk }: {
  spec: BannerSpec; mutatedRef: string; onAsk: (q: string) => void;
}) {
  /* NO INLINE ACTIONS IN A REQUESTER TURN. "Add a note" after a creation is a forward action,
     and forward actions live in the dock — the banner says what happened and nothing else. A
     technician's banner keeps its actions until the technician dock exists. */
  const dock = useRequesterDock();
  const actions = dock ? [] : (spec.actions ?? []);
  return (
    <div className="rounded border border-[var(--nova-success-border)] bg-[var(--nova-success-tint)] px-3 py-2.5" data-confirm-banner>
      <p className="nova-t-body flex items-start gap-2 text-[var(--nova-success)]">
        <span aria-hidden="true" className="flex-shrink-0">✓</span>
        <span className="min-w-0">{bannerText(spec, mutatedRef)}</span>
      </p>
      {actions.length > 0 && (
        <p className="mt-1.5 flex flex-wrap gap-1.5 pl-5">
          {actions.map((x) => (
            <button
              key={x.label}
              type="button"
              className={QUIET}
              onClick={() => onAsk(x.ask)}
            >{x.label}</button>
          ))}
        </p>
      )}
    </div>
  );
}

/** The secondary path — a muted record that a proposal was set aside, never a vanish. */
export function DiscardedLine({ label }: { label: string }) {
  return <p className="nova-t-meta" data-discarded>{label} — nothing was changed.</p>;
}

/* ── shared proposal shell: idle → confirmed(banner) / discarded ────────── */
export interface ProposalOpts {
  /** The block's own id — what the dock files this card under. */
  id: string;
  /** The card can commit right now. A note with no text, a picker with nothing picked, cannot. */
  canRun?: boolean;
  /** Why not — the dock's tooltip while the option is disabled. */
  why?: string;
}

export function useProposal(onConfirmed?: () => void, opts?: ProposalOpts) {
  const dock = useRequesterDock();
  /* A TECHNICIAN ACTION TURN. The card renders no footer here either — its action is attached
     under the turn — and it never swaps itself for a banner: the turn is immutable, and what
     changed is the next turn's to say. The card registers its INPUTS through `useTurnInputs`. */
  const tech = useTechTurn();
  const turnId = dock?.turnId;
  const key = turnId && opts ? proposalKey(turnId, opts.id) : null;
  /* A card that re-mounts (a regenerate, a re-opened chat) picks its phase back up from the
     store rather than forgetting that its note was already posted. */
  const [phase, setPhase] = useState<'idle' | 'done' | 'discarded'>(() => (key ? proposalOf(turnId!, opts!.id)?.phase : undefined) ?? 'idle');
  const [ref, setRef] = useState(() => (key ? proposalOf(turnId!, opts!.id)?.ref : undefined) ?? '');
  /* The card's committer, re-pointed every render so the dock runs the card AS IT STANDS —
     with the reader's edits — and never a closure over the first render's values. */
  const runRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (!key || !turnId || !opts) return;
    registerProposal(key, turnId, opts.id, () => runRef.current());
    return () => unregisterRunner(key);
  }, [key, turnId, opts?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (key) setProposalCanRun(key, opts?.canRun ?? true, opts?.why);
  }, [key, opts?.canRun, opts?.why]);

  return {
    phase,
    ref,
    /** True inside a requester turn (the dock has its runner) or a technician action turn (the
     *  attached action has its inputs): the card renders no footer. */
    dock: !!key || !!tech,
    /** A technician turn: the card stays as it was after its action runs. */
    frozen: !!tech && !key,
    confirm(mutatedRef: string) {
      if (!tech || key) { setRef(mutatedRef); setPhase('done'); }
      if (key) settleProposal(key, 'done', mutatedRef);
      onConfirmed?.();
    },
    discard() {
      setPhase('discarded');
      if (key) settleProposal(key, 'discarded');
    },
    /** Hand the dock this render's committer. Called once per render, after `run` is defined. */
    register(run: () => void) { runRef.current = run; },
  };
}

/* ── a technician card's INPUTS ───────────────────────────────────────────────────────────
 * Inside a technician action turn a card registers what its action needs — the hold as edited,
 * the note as typed, the refs as entered — under its block id. The attached action calls it at
 * click time and carries the value to the reply's stream, which performs the mutation. Nothing
 * outside such a turn; the hook is inert there. `canRun` / `why` disable the action while the
 * card says it cannot run (an empty note, nothing entered). */
export function useTurnInputs(
  blockId: string,
  inputs: () => Record<string, unknown>,
  canRun = true,
  why?: string,
  /** How much this card would do right now — see ProposalRec.tally. */
  tally?: number,
): void {
  const tech = useTechTurn();
  const key = tech ? proposalKey(tech.turnId, blockId) : null;
  const ref = useRef(inputs);
  ref.current = inputs;
  useEffect(() => {
    if (!key || !tech) return;
    registerProposal(key, tech.turnId, blockId, () => ref.current());
    return () => unregisterRunner(key);
  }, [key, tech?.turnId, blockId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (key) setProposalCanRun(key, canRun, why); }, [key, canRun, why]);
  useEffect(() => { if (key && tally !== undefined) setProposalTally(key, tally); }, [key, tally]);
}
