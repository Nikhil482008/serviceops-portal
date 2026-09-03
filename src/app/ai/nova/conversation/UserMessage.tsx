import { useState } from 'react';
import { Copy, Check, Pencil, Bookmark } from 'lucide-react';
import { deriveRequester } from '../../../components/TicketPropertiesPanel';

/* WHAT I SAID.
 *
 * ── IT MUST NOT LOOK LIKE WHAT NOVA SAID ─────────────────────────────────────────────────────
 * The question and the answer used to be the same ink at the same size against the same
 * background, so a reader scrolling the thread had to read a line to find out whose it was.
 *
 * Four signals now separate them, and any one of them is enough on its own:
 *   SURFACE     a tinted container — Nova never uses a fill
 *   AVATAR      the reader's initials — Nova has an orb and a name
 *   SIZE        13px against the answer's 18px headline
 *   ATTRIBUTION "You · Just now", which Nova's side states as "Nova · Just now"
 *
 * The container is full width rather than a right-aligned bubble. At 462px a right bubble capped
 * at 85% wraps a nine-word question onto three ragged lines, and the drawer is not a messaging
 * app — the reader is issuing an instruction, not chatting. Full width reads as an input line,
 * which is what it is.
 */

/** ⚠️ There is no auth object in this prototype. `deriveRequester()` returns the same hardcoded
 *  placeholder identity the ticket panel and the greeting already use. */
const ME = deriveRequester();

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
    /* ⚠️ `.nova-msg` is the HOVER SCOPE for the message actions — the stylesheet reveals them
       on `.nova-msg:hover`. It was dropped when this component was rewritten, which left Copy,
       Edit query and Save prompt at opacity 0 on every pointer device: present in the DOM, in the
       tab order, and invisible. */
    <div className="nova-msg">
      <h3 className="sr-only">You asked</h3>

      <div className="nova-said">
        <span className="nova-said-avatar" aria-hidden="true" style={{ background: ME.color }}>
          {ME.initials}
        </span>
        <p className="nova-t-said min-w-0 flex-1">{question}</p>
      </div>

      {/* Attribution, and the actions that belong to this message. Right-aligned under the
          container so the reader's side of the thread has an edge Nova's never uses. */}
      <div className="nova-said-foot">
        <div className="nova-msg-actions flex items-center gap-1">
          <MsgAction
            icon={copied ? <Check size={12} /> : <Copy size={12} />}
            label={copied ? 'Copied' : 'Copy'}
            onClick={copy}
          />
          <MsgAction icon={<Pencil size={12} />} label="Edit query" onClick={() => onEditQuery(question)} />
          {/* STUBBED. There is no prompt library to save into yet. */}
          <MsgAction icon={<Bookmark size={12} />} label="Save prompt" onClick={() => {}} />
        </div>
        <span className="nova-t-meta flex-shrink-0">You · Just now</span>
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
      className="nova-btn nova-btn-ghost inline-flex h-5 items-center gap-1 rounded px-1.5 text-[12px]"
    >
      {icon}
      {label}
    </button>
  );
}
