import { useEffect, type KeyboardEvent, type ReactNode } from 'react';
import { clearSelection, selectionOf, toggleSelected, useTechStore } from './techStore';
import { useTechTurn } from './TechTurnCtx';

/* ROWS ARE TARGETS.
 *
 * A technician turn is mostly a list, and the per-row buttons are gone. A row does two things:
 *   CLICK   opens it — a StatusCard turn, through askNova, as a navigate action (Enter too)
 *   SELECT  a 16px checkbox at the row's left edge, visible on hover and focus and persistent once
 *           checked; Space toggles it; Escape clears the whole selection
 * The attached action beneath the list reads the selection and relabels itself; the selection is
 * the turn's and is cleared the moment the turn goes past.
 *
 * The row IS a <button> — the one kind of button a card may render (`data-in-element="row"`).
 * The checkbox is an input, and the "Clear" in the count pill is in-element too. */

export function useSelection(): { turnId: string | null; live: boolean; sel: readonly string[]; toggle: (ref: string, single?: boolean) => void; clear: () => void } {
  const tech = useTechTurn();
  const store = useTechStore();
  const turnId = tech?.turnId ?? null;
  const live = !!tech?.live;
  const sel = turnId ? (store.selection[turnId] ?? []) : [];
  /* A PAST TURN HAS NO SELECTION. Cleared here rather than by whoever appended the next turn, so
     the rule holds for every way a turn can go past — a typed question, a chip, an action. */
  useEffect(() => { if (turnId && !live && selectionOf(turnId).length) clearSelection(turnId); }, [turnId, live]);
  return {
    turnId, live, sel,
    toggle: (ref, single) => { if (turnId && live) toggleSelected(turnId, ref, single); },
    clear: () => { if (turnId) clearSelection(turnId); },
  };
}

/** Escape inside a list clears its selection — and stops there, so the drawer does not close. */
export const escClears = (clear: () => void, has: boolean) => (e: KeyboardEvent) => {
  if (e.key !== 'Escape' || !has) return;
  e.preventDefault();
  e.stopPropagation();
  clear();
};

export function SelectRow({ refId, selected, live, single, onToggle, onOpen, children, className = '', rowProps }: {
  refId: string;
  selected: boolean;
  live: boolean;
  /** A radio-shaped selection: picking one replaces the last. */
  single?: boolean;
  onToggle: () => void;
  onOpen: () => void;
  children: ReactNode;
  className?: string;
  rowProps?: Record<string, unknown>;
}) {
  return (
    <li
      className={`nova-sel-row ${className}`}
      data-sel-row={refId}
      data-selected={selected ? 'true' : 'false'}
      {...rowProps}
    >
      <span className="nova-sel-box">
        <input
          type="checkbox"
          role={single ? 'radio' : undefined}
          className="nova-sel-check"
          aria-label={`Select ${refId}`}
          checked={selected}
          disabled={!live}
          tabIndex={live ? 0 : -1}
          onChange={onToggle}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onOpen(); } }}
        />
      </span>
      <button
        type="button"
        className="nova-sel-open nova-btn"
        data-in-element="row"
        data-open-row={refId}
        disabled={!live}
        tabIndex={live ? 0 : -1}
        aria-label={`Open ${refId}`}
        onClick={onOpen}
        onKeyDown={(e) => {
          /* Space SELECTS, Enter OPENS. A button's default would fire the click on both. */
          if (e.key === ' ') { e.preventDefault(); onToggle(); }
        }}
      >
        {children}
      </button>
    </li>
  );
}

/** "2 selected · Clear", at the list's header. Nothing while nothing is selected. */
export function SelectionPill({ n, onClear }: { n: number; onClear: () => void }) {
  if (!n) return null;
  return (
    <span className="nova-sel-pill" data-selection-pill data-n={n}>
      {n} selected
      <span className="nova-sel-sep" aria-hidden="true">·</span>
      <button type="button" className="nova-sel-clear nova-btn" data-in-element="clear" onClick={onClear}>Clear</button>
    </span>
  );
}
