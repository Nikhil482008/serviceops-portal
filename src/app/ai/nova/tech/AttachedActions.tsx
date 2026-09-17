import { useEffect, useRef, useState } from 'react';
import { useNovaActions } from '../NovaConversationProvider';
import { proposalKey, callProposal } from '../dock/proposals';
import { doIcon } from './icons';
import type { DoIcon } from './icons';
import type { DoAction, TechActionSet } from './techActions';
import { clearSelection, requestFocus } from './techStore';
import type { MutationCall } from './mutations';

/* THE ACTIONS ATTACHED UNDER A NOVA TURN.
 *
 * ── AN ACTION IS INPUT ───────────────────────────────────────────────────────────────────────
 * Clicking one appends the reader's turn — the label as clicked, with the action's icon — and
 * runs it through askNova exactly as a typed question does. A mutate action collects its inputs
 * (from the card that registered them, or the fixed set it was authored with) and hands them to
 * the reply's stream, which performs the change on its `mutate` beat and reports what changed. A
 * navigate action opens the record. Nothing runs at click time; nothing is confirmed twice.
 *
 * ── IMMUTABLE ────────────────────────────────────────────────────────────────────────────────
 * A past turn's actions are greyed and not focusable. Nothing else about the turn changes.
 *
 * ── THE BUTTON ───────────────────────────────────────────────────────────────────────────────
 * A soft chip: 10px radius, a hairline, a quiet fill, a 15px icon and a label with weight in it.
 * EVERY action wears the same chrome; the recommendation is named outright by a NOVA RECOMMENDS
 * eyebrow above it, and carried by the accent icon and the semibold label, with the chip sitting
 * on white a half-step forward of its siblings. An optional
 * `meta` suffix after a middle dot, muted and at the body weight. A selection-aware label
 * crossfades in place over 120ms; the row rises in on first render, 180ms with a 30ms stagger.
 * Cmd/Ctrl+Enter runs the latest turn's recommended action when focus is not in a text field. */

function Label({ text }: { text: string }) {
  /* CROSSFADE, IN PLACE. The outgoing label fades over the incoming one for 120ms; the button
     is not re-mounted, so nothing above it moves. */
  const [prev, setPrev] = useState<string | null>(null);
  const last = useRef(text);
  useEffect(() => {
    if (last.current === text) return;
    setPrev(last.current);
    last.current = text;
    const t = window.setTimeout(() => setPrev(null), 120);
    return () => clearTimeout(t);
  }, [text]);
  return (
    <span className="nova-do-text" data-relabel={prev !== null ? 'true' : 'false'}>
      <span key={text} className="nova-do-text-in">{text}</span>
      {prev !== null && <span className="nova-do-text-out" aria-hidden="true">{prev}</span>}
    </span>
  );
}

/** Everything an action row needs to be DRAWN. `DoAction` satisfies it; so does the plan's pair,
 *  which has no case id and no mutation because it releases a parked stream instead. */
export interface ActionRowItem {
  id: string;
  label: string;
  meta?: string;
  icon: DoIcon;
  /** Only ever a `data-kind` attribute here — the row draws every kind the same way, and the
   *  distinction is for the suite and for anyone reading the DOM. */
  kind: string;
  recommended: boolean;
  disabled?: boolean;
  disabledReason?: string;
}

/** THE ROWS THEMSELVES — appearance and keyboard, nothing about what an action means.
 *  Cmd/Ctrl+Enter runs the recommended one, which is a property of the row group and so lives
 *  here rather than in either caller. */
export function ActionRows({ items, live, onRun, label }: {
  items: ActionRowItem[];
  live: boolean;
  onRun: (item: ActionRowItem) => void;
  /** Overrides the group's accessible name. */
  label?: string;
}) {
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const runRef = useRef(onRun);
  runRef.current = onRun;

  useEffect(() => {
    if (!live) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || !(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return;
      const t = e.target as HTMLElement | null;
      const typing = !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
      if (typing) return;
      if (document.querySelector('.nova-pop, .nova-modal-scrim, [data-evidence-drawer], [data-kb-sheet]')) return;
      const rec = itemsRef.current.find((d) => d.recommended && !d.disabled);
      if (!rec) return;
      e.preventDefault();
      e.stopPropagation();
      runRef.current(rec);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [live]);

  if (!items.length) return null;

  return (
    <div className="nova-attached" data-attached-actions data-live={live ? 'true' : 'false'} data-count={items.length}>
      <div className="nova-attached-list" role="group" aria-label={label ?? (live ? 'Actions' : 'Actions (no longer available)')}>
        {items.map((d, i) => (
          <div key={d.id} className={`nova-do-row ${d.recommended ? 'nova-do-row-rec' : ''}`}>
            {d.recommended && (
              /* aria-hidden: the button below carries the same words for a screen reader, so the
                 recommendation is announced once, as part of the control it belongs to. */
              <span className="nova-do-tag" aria-hidden="true">Nova recommends</span>
            )}
            {/* DRAWN, not typed — see .nova-attached-conn. No text node here on purpose. */}
            <span className="nova-attached-conn" aria-hidden="true" />
            <button
              type="button"
              className={`nova-do ${d.recommended ? 'nova-do-rec' : ''}`}
              data-do={d.id}
              data-kind={d.kind}
              data-recommended={d.recommended ? 'true' : undefined}
              aria-disabled={d.disabled || !live || undefined}
              disabled={!live}
              tabIndex={live ? 0 : -1}
              title={d.disabled ? (d.disabledReason ?? 'Not available yet') : undefined}
              style={{ ['--i' as string]: i }}
              onClick={() => onRun(d)}
            >
              <span className="nova-do-icon">{doIcon(d.icon, 15)}</span>
              <span className="nova-do-label">
                <Label text={d.label} />
                {d.meta && <span className="nova-do-meta"> · {d.meta}</span>}
                {d.recommended && <span className="sr-only"> · Nova recommends this</span>}
              </span>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AttachedActions({ turnId, live, set }: { turnId: string; live: boolean; set: TechActionSet }) {
  const { askNova } = useNovaActions();

  const run = (d: DoAction) => {
    if (!live || d.disabled) return;
    let mutation: MutationCall | undefined;
    if (d.kind === 'mutate' && d.mutation) {
      if (d.mutation.block) {
        /* The card's inputs, AS THEY STAND — with the reader's edits. */
        const key = proposalKey(d.mutation.onTurn ?? turnId, d.mutation.block);
        const r = callProposal(key);
        if (!r.found) return;
        mutation = { name: d.mutation.name, inputs: (r.value as Record<string, unknown>) ?? {} };
        /* The card is NOT settled. A technician turn is immutable — the card stays exactly as it
           was, and whether this has already run is read from the conversation. Settling it would
           have retired the reply block the moment a draft was saved, so the next turn could not
           have offered to send it. */
      } else {
        mutation = { name: d.mutation.name, inputs: d.mutation.inputs ?? {} };
      }
    }
    const id = askNova(d.said ?? d.label, {
      caseId: d.caseId,
      context: {
        action: { icon: d.icon, kind: d.kind },
        ...(mutation ? { mutation } : {}),
        ...(d.ref ? { ref: d.ref } : {}),
      },
    });
    clearSelection(turnId);
    if (id) requestFocus(id);
  };

  return <ActionRows items={set.dos} live={live} onRun={(d) => run(d as DoAction)} />;
}
