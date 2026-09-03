import { useState } from 'react';
import { CornerDownLeft, Plus } from 'lucide-react';
import { TEC8_MOD_EXAMPLE, planSteps, type Tec8PlanState, type Tec8Settings } from './tec8Model';

/* MODIFYING THE PLAN, WITHOUT LEAVING THE CONVERSATION.
 *
 * ── THE PRIMARY MECHANISM IS THE SENTENCE ─────────────────────────────────────
 * Three changes at once — leave the priority, use a different queue, tell someone else — is one
 * sentence and three separate control hunts. The typed input is therefore the main path and the
 * per-step controls are the fallback, not the other way round. That is also why this is a panel
 * inside the thread rather than a settings screen: the reader is talking to Nova, and being sent
 * somewhere to edit a form would end that.
 *
 * ── THE EXAMPLE IS A CHIP, NOT PLACEHOLDER TEXT ────────────────────────────────
 * A placeholder disappears the moment it is useful. As a chip the reader can read it, edit it,
 * or send it as-is — which is what makes the demo path one click without making the input a
 * decoration.
 *
 * ⚠️ "+ Add step" OFFERS WHAT IS MISSING. Steps are derived from the plan, so adding one means
 * turning a setting back on rather than inventing a free-text task Nova has no way to perform.
 * Offering an empty step that could never execute would be the dishonest version of this control.
 */
export function Tec8PlanEditor({ plan, onApply, onSettings, onCancel, rejected }: {
  plan: Tec8PlanState;
  /** The typed sentence. The caller interprets it — this component never guesses. */
  onApply: (text: string) => void;
  onSettings: (s: Tec8Settings) => void;
  onCancel: () => void;
  /** Nova could not act on the last sentence. Shown here, next to the input that produced it. */
  rejected: string | null;
}) {
  const [text, setText] = useState('');
  const [adding, setAdding] = useState(false);

  const present = new Set(planSteps(plan).map((s) => s.id));
  const missing: Array<{ id: string; label: string; apply: () => void }> = [
    {
      id: 'priority',
      label: 'Raise priority',
      apply: () => onSettings({ ...plan.settings, priority: 'raise' }),
    },
    {
      id: 'note',
      label: 'Add an internal note',
      apply: () => onSettings({ ...plan.settings, note: true }),
    },
  ].filter((c) => !present.has(c.id));

  const send = () => {
    const t = text.trim();
    if (!t) return;
    onApply(t);
    setText('');
  };

  return (
    <section className="tec8-editor">
      <label className="nova-t-label" htmlFor="tec8-mod-input">What should I change?</label>

      <div className="tec8-input-row">
        <textarea
          id="tec8-mod-input"
          className="tec8-input"
          rows={2}
          value={text}
          placeholder="Tell me what to change…"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            /* Enter sends, Shift+Enter is a newline — the composer's own rule, so the two
               inputs in this product do not behave differently. */
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
          }}
        />
        <button
          type="button"
          className="nova-btn nova-btn-primary tec8-send"
          disabled={!text.trim()}
          onClick={send}
        >
          <CornerDownLeft size={13} aria-hidden="true" />
          Update plan
        </button>
      </div>

      {rejected && (
        /* Law 15 — the failure is explained in plain language, next to the input, and the text
           the reader typed is still in it. */
        <p className="tec8-rejected" role="status">{rejected}</p>
      )}

      <div className="tec8-editor-foot">
        <button
          type="button"
          className="nova-btn nova-pill nova-hit tec8-example"
          onClick={() => setText(TEC8_MOD_EXAMPLE)}
        >{TEC8_MOD_EXAMPLE}</button>
      </div>

      <div className="tec8-editor-actions">
        {missing.length > 0 ? (
          <div className="tec8-add">
            <button
              type="button"
              className="nova-btn nova-btn-ghost tec8-btn-quiet"
              aria-expanded={adding}
              onClick={() => setAdding((v) => !v)}
            >
              <Plus size={13} aria-hidden="true" /> Add step
            </button>
            {adding && (
              <div className="tec8-menu tec8-menu-up" role="menu">
                {missing.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    role="menuitem"
                    className="tec8-menu-item"
                    onClick={() => { m.apply(); setAdding(false); }}
                  >{m.label}</button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <p className="nova-t-meta">Every step this plan can run is already in it.</p>
        )}

        <button
          type="button"
          className="nova-btn nova-btn-ghost tec8-btn-quiet"
          onClick={onCancel}
        >Keep the plan as it is</button>
      </div>
    </section>
  );
}
