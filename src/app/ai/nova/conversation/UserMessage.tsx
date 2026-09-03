import { useState } from 'react';
import { Copy, Check, Pencil, Bookmark } from 'lucide-react';

/* WHAT I SAID.
 *
 * A BOUNDED AREA, NOT A LABELLED ONE.
 * One container, right-aligned, holding the question and nothing else. No initials mark, no
 * name, no timestamp — those three existed to answer "who said this", and a surface on one side
 * of the column answers it before any of them can be read.
 *
 * What identifies each speaker now:
 *   THE READER   a filled box, right-aligned, never full width
 *   NOVA         no surface at all, left, under a named identity row
 * Neither can be mistaken for the other at a glance or scrolled past at speed, and neither needs
 * a border to make the point.
 *
 * ⚠️ The identity is no longer on screen, so the visually-hidden heading is the ONLY thing left
 * telling a screen-reader user who is speaking. It is not decoration; do not remove it.
 */
export function UserMessage({ question, onEditQuery }: {
  question: string;
  onEditQuery: (question: string) => void;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try { await navigator.clipboard.writeText(question); } catch { /* denied */ }
    /* Confirm regardless: the clipboard can refuse silently, and a button that does nothing
       visible reads as broken even when it worked. */
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };

  return (
    <div className="nova-msg nova-said-wrap">
      <h3 className="sr-only">You asked</h3>

      <div className="nova-said-box">
        <p className="nova-t-said">{question}</p>
      </div>

      {/* Under the box and aligned to its right edge — beside the thing they act on (law 8).
          Hidden until hover or focus on pointer devices, ALWAYS shown where there is no hover;
          see `.nova-msg-actions` in theme.css.
          ⚠️ The visible control is 24px so the row stays dense; `.nova-hit` pads the PRESSABLE
          area out to 44px with a pseudo-element. Smaller text must not mean a smaller target. */}
      <div
        className="nova-msg-actions -mr-1.5 flex items-center gap-1"
        style={{ marginTop: 'var(--nova-gap-para)' }}
      >
        <MsgAction
          icon={copied ? <Check size={12} /> : <Copy size={12} />}
          label={copied ? 'Copied' : 'Copy'}
          onClick={copy}
        />
        <MsgAction icon={<Pencil size={12} />} label="Edit query" onClick={() => onEditQuery(question)} />
        {/* STUBBED. There is no prompt library to save into yet. */}
        <MsgAction icon={<Bookmark size={12} />} label="Save prompt" onClick={() => {}} />
      </div>
    </div>
  );
}

function MsgAction({ icon, label, onClick }: {
  icon: React.ReactNode; label: string; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="nova-btn nova-btn-ghost nova-hit ask-text-sm inline-flex h-6 items-center gap-1 rounded px-1.5"
    >
      {icon}
      {label}
    </button>
  );
}
