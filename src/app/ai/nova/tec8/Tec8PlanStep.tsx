import { useEffect, useRef, useState } from 'react';
import { MoreHorizontal } from 'lucide-react';
import type { Tec8PlanState, Tec8Settings, Tec8Step } from './tec8Model';

/* ONE STEP OF THE PLAN.
 *
 * ── THE EDIT AFFORDANCE IS SUBTLE, AND IT IS STILL A REAL TARGET ─────────────────────
 * A "···" that appears on hover is the convention (law 3) and keeps seven steps readable rather
 * than turning each into a toolbar. It is 44px square regardless, and it is present in the DOM
 * at all times so the keyboard can reach it — an affordance that only exists on hover does not
 * exist for anyone not using a mouse.
 *
 * ── STEPS THAT CHANGE THE TICKET SAY SO ──────────────────────────────────────
 * Three of these steps read a record and four change one, and nothing about their shape says
 * which. The "Changes the ticket" mark is a WORD, not a colour — the distinction is the entire
 * basis on which approval is being given, and it must survive greyscale, low vision and a
 * screen reader.
 *
 * ── EDITING IS PROGRESSIVE ─────────────────────────────────────────────────
 * Choosing Edit reveals ONE control — the single setting that step is the expression of — not a
 * form of every field the plan has. A step is one decision, so editing it is one choice.
 */

const CHOICES: Record<string, Array<{ value: string; label: string }>> = {
  priority: [
    { value: 'raise', label: 'Raise to High' },
    { value: 'none', label: 'No change' },
  ],
  queue: [
    { value: 'VPN Escalation', label: 'VPN Escalation' },
    { value: 'Network Escalation', label: 'Network Escalation' },
  ],
  notify: [
    { value: 'Team lead', label: 'Team lead' },
    { value: 'Manager', label: 'Manager' },
  ],
  note: [
    { value: 'true', label: 'Add an internal note' },
    { value: 'false', label: 'No note' },
  ],
};

const CONTROL_LABEL: Record<string, string> = {
  priority: 'Priority', queue: 'Assignment', notify: 'Notification', note: 'Internal note',
};

export function Tec8PlanStep({
  n, step, plan, updated, editable, first, last, onSettings, onRemove, onMove,
}: {
  n: number;
  step: Tec8Step;
  plan: Tec8PlanState;
  /** Touched by the most recent modification — earns the "Updated" mark. */
  updated: boolean;
  /** False once the plan has been approved: an approved plan is a record, not a draft. */
  editable: boolean;
  first: boolean;
  last: boolean;
  onSettings: (s: Tec8Settings) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
}) {
  const [menu, setMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  /* Escape closes, and a click anywhere else closes — a menu that can only be dismissed by
     choosing something is a menu that has taken the screen hostage. */
  useEffect(() => {
    if (!menu) return;
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenu(false); };
    const away = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setMenu(false);
    };
    window.addEventListener('keydown', key);
    window.addEventListener('mousedown', away);
    return () => {
      window.removeEventListener('keydown', key);
      window.removeEventListener('mousedown', away);
    };
  }, [menu]);

  const control = step.control;
  const currentValue = control === 'note'
    ? String(plan.settings.note)
    : control ? String(plan.settings[control]) : '';

  const apply = (value: string) => {
    if (!control) return;
    const next: Tec8Settings = { ...plan.settings };
    if (control === 'note') next.note = value === 'true';
    else if (control === 'priority') next.priority = value as 'raise' | 'none';
    else if (control === 'queue') next.queue = value as Tec8Settings['queue'];
    else if (control === 'notify') next.notify = value as Tec8Settings['notify'];
    onSettings(next);
    setEditing(false);
  };

  return (
    <li className="tec8-step" ref={wrapRef}>
      <span className="tec8-step-n" aria-hidden="true">{n}</span>

      <div className="min-w-0 flex-1">
        <p className="tec8-step-title">
          {step.title}
          {step.mutating && (
            /* A WORD, never a colour alone. This is the basis of the approval. */
            <span className="tec8-step-mut">Changes the ticket</span>
          )}
          {updated && <span className="tec8-step-upd">Updated</span>}
        </p>
        {step.change && <p className="tec8-step-change">{step.change}</p>}
        {step.detail && <p className="tec8-step-detail">{step.detail}</p>}

        {editing && control && (
          <div className="tec8-step-edit">
            <label className="nova-t-label" htmlFor={`tec8-edit-${step.id}`}>
              {CONTROL_LABEL[control]}
            </label>
            <select
              id={`tec8-edit-${step.id}`}
              className="tec8-select"
              value={currentValue}
              onChange={(e) => apply(e.target.value)}
            >
              {CHOICES[control].map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
            <button
              type="button"
              className="nova-btn nova-btn-ghost tec8-btn-quiet"
              onClick={() => setEditing(false)}
            >Done</button>
          </div>
        )}
      </div>

      {editable && (
        <div className="tec8-step-tools">
          <button
            type="button"
            className="nova-btn nova-btn-icon tec8-dots"
            aria-haspopup="menu"
            aria-expanded={menu}
            aria-label={`Change step ${n}: ${step.title}`}
            onClick={() => setMenu((v) => !v)}
          >
            <MoreHorizontal size={14} aria-hidden="true" />
          </button>

          {menu && (
            <div className="tec8-menu" role="menu">
              {control && (
                <button
                  type="button"
                  role="menuitem"
                  className="tec8-menu-item"
                  onClick={() => { setEditing(true); setMenu(false); }}
                >Edit step</button>
              )}
              <button
                type="button"
                role="menuitem"
                className="tec8-menu-item"
                disabled={first}
                onClick={() => { onMove(-1); setMenu(false); }}
              >Move up</button>
              <button
                type="button"
                role="menuitem"
                className="tec8-menu-item"
                disabled={last}
                onClick={() => { onMove(1); setMenu(false); }}
              >Move down</button>
              <button
                type="button"
                role="menuitem"
                className="tec8-menu-item tec8-menu-danger"
                onClick={() => { onRemove(); setMenu(false); }}
              >Remove step</button>
            </div>
          )}
        </div>
      )}
    </li>
  );
}
