import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Pencil } from 'lucide-react';

/* THE ONE WAY TO CHANGE A VALUE IN A CARD.
 *
 * Before this there were four: the draft card's hover-pencil-then-input, its priority select
 * that was permanently a select, the note composer's always-open textarea, and the plan card's
 * pencil-and-tick row. Four answers to "can I change this?", each with its own affordance, its
 * own keys and its own idea of when a change is saved. A reader had to learn each card.
 *
 * ── THE SHAPE ────────────────────────────────────────────────────────────────────────────────
 *   REST      the value as ordinary text, with a muted 14px pencil at its right edge. No
 *             underline, no border, no field box — nothing that says "form" on a surface that
 *             is meant to read as an answer.
 *   HOVER     the value tints to the panel token and the pencil becomes a small white pill
 *             reading "Edit". The tint reaches 8px past the text on each side, and it does that
 *             with padding the element ALWAYS has plus a matching negative margin — so the tint
 *             appears around text that has not moved. Nothing reflows on hover, ever.
 *   EDIT      the value is replaced IN PLACE by the field. Same position, same size, so the row
 *             does not jump; the tint and the pencil go, because the box is now the affordance.
 *
 * ── COMMITTING IS PER KIND, AND THE KIND IS THE REASON ───────────────────────────────────────
 *   text      Enter commits · Esc cancels · blur commits      — a line you finish typing
 *   select    change commits · blur cancels                   — choosing IS the commit
 *   textarea  Cmd/Ctrl+Enter commits · Esc cancels · blur commits — Enter is a newline here
 * Focus returns to the value on both commit and cancel, so a keyboard reader is never dropped
 * back at the top of the card.
 *
 * ── AND IT SAYS WHEN A MACHINE'S GUESS BECAME A PERSON'S DECISION ────────────────────────────
 * An inferred value carries "· inferred". The moment it is edited that becomes "· edited", in
 * full ink. The textarea kind says the same thing as a line beneath the paragraph — "Drafted by
 * Nova" becoming "Edited" — because a marker trailing a five-line paragraph is not read.
 */

export type EditableKind = 'text' | 'select' | 'textarea' | 'multi';

/* ── A SET, AND HOW IT READS ─────────────────────────────────────────────────────────────────
 * A set-valued field reads as a sentence — "Requester + Team lead" — and "No one" is a real
 * answer rather than an empty string. Both directions live here so that everything which has to
 * reason about such a value (the editor, and any card comparing an after-value to a before-one)
 * agrees on what the words mean.
 *
 * ORDER IS THE OPTION LIST'S, never the order the reader ticked. Two readers who pick the same
 * recipients must produce the same sentence, or a diff row would report a change that nobody
 * made. */
export const SET_JOIN = ' + ';
export const SET_EMPTY = 'No one';

export const parseSet = (value: string, options: readonly string[]): string[] => {
  if (!value || value === SET_EMPTY) return [];
  const named = value.split(SET_JOIN).map((s) => s.trim());
  return options.filter((o) => named.includes(o));
};

export const formatSet = (picked: readonly string[], options: readonly string[]): string => {
  const inOrder = options.filter((o) => picked.includes(o));
  return inOrder.length ? inOrder.join(SET_JOIN) : SET_EMPTY;
};

export function EditableValue({
  label, value, kind = 'text', options, inferred, markEdited, readOnly, draftedLabel, rows = 4,
  strong, focusSignal, onCommit,
}: {
  /** What this value IS. Used for the accessible names — "Edit Subject", and "Subject" on the
   *  field itself — so a screen reader hears the same word the label column shows. */
  label: string;
  value: string;
  kind?: EditableKind;
  /** `select` only. */
  options?: readonly string[];
  /** Nova guessed this. Shows "· inferred", and "· edited" once a person changes it. */
  inferred?: boolean;
  /** Say "· edited" after a change even though this value was never marked inferred — what a
   *  diff row's after-value needs, since its arrow already declares it a proposal. */
  markEdited?: boolean;
  /** Not the reader's to change: muted, no pencil, no tint, not focusable. */
  readOnly?: boolean;
  /** This value is the record's TITLE, and carries a title's weight. */
  strong?: boolean;
  /** `textarea` only — the line beneath, before an edit. Defaults to "Drafted by Nova". */
  draftedLabel?: string;
  /** `textarea` only. */
  rows?: number;
  /** Bumped by a card's own "Edit" action — opens the editor and focuses it. */
  focusSignal?: number;
  onCommit: (next: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  /* The set kind edits a SET; `draft` still carries the sentence it commits. */
  const [picked, setPicked] = useState<string[]>([]);
  const [edited, setEdited] = useState(false);
  const rest = useRef<HTMLSpanElement | null>(null);
  const field = useRef<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null>(null);
  /* A commit and the blur it causes are one act. Without this the blur handler runs after the
     commit has already closed the editor and commits a second time — harmless for text, a
     silent cancel for a select. */
  const settled = useRef(false);
  /* THE HEIGHT THE VALUE OCCUPIED, measured at the click. A textarea sized only by `rows` opens
     at the wrong size whenever the prose is longer or shorter than that - and shorter is the bad
     one, because it hides the reader's own words the moment they go to change them. */
  const restH = useRef<number | null>(null);

  /* ⚠️ ESCAPE MUST NOT LEAVE THIS FIELD. `AskAiProvider` listens for it on `window` and closes
     the whole assistant, so cancelling an edit closed the drawer — caught in a browser, because
     jsdom's harness dispatches the key at the element and never lets it reach that listener.
     Stopping propagation is what the header's inline rename already does for the same reason;
     `data-esc-local` on the wrapper below covers the drawer's own capture-phase listener, which
     runs before this handler can speak. */
  const stop = (e: KeyboardEvent) => { e.preventDefault(); e.stopPropagation(); };

  const open = () => {
    if (readOnly) return;
    restH.current = rest.current?.offsetHeight ?? null;
    setDraft(value);
    if (kind === 'multi') setPicked(parseSet(value, options ?? []));
    settled.current = false;
    setEditing(true);
  };
  /* Focus goes back to the value on BOTH paths — committing and cancelling — so a keyboard
     reader ends where they started rather than at the top of the card. */
  const back = () => requestAnimationFrame(() => rest.current?.focus());
  const commit = (next: string) => {
    if (settled.current) return;
    settled.current = true;
    const t = kind === 'textarea' ? next : next.trim();
    if (t && t !== value) { onCommit(t); setEdited(true); }
    setEditing(false);
    back();
  };
  const cancel = () => {
    if (settled.current) return;
    settled.current = true;
    setEditing(false);
    back();
  };

  /* A card's own "Edit" action (the ••• menu, a secondary button) opens this one. */
  useEffect(() => { if (focusSignal) open(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [focusSignal]);
  useEffect(() => {
    if (!editing) return;
    const el = field.current;
    if (!el) return;
    el.focus();
    if ('setSelectionRange' in el && typeof el.value === 'string') {
      try { el.setSelectionRange(el.value.length, el.value.length); } catch { /* select() on a select throws */ }
    }
  }, [editing]);

  /* WHO DECIDED THIS. An inferred field says so at rest and says "· edited" once a person
     changes it. A DIFF row's after-value needs only the second half: the arrow already says the
     value is a proposal, so "· inferred" beside it would be saying it twice — but the moment a
     reader edits it, that IS worth recording, including when they set it back to the before
     value. Changing it is the fact, not what they changed it to. */
  const marker = ((inferred || (markEdited && edited)) && kind !== 'textarea') ? (
    <span className="nova-edit-mark" data-edited={edited ? 'true' : 'false'}>
      {edited ? '· edited' : '· inferred'}
    </span>
  ) : null;

  /* THE VALUE AND ITS MARKER ARE ONE THING. The marker sits inside the band, right after the
     word it qualifies, so the tint covers both and the right edge is left to the pencil. */
  const lead = (
    <span className="nova-edit-lead">
      <span className="nova-edit-text" data-strong={strong ? 'true' : 'false'}>{value}</span>
      {marker}
    </span>
  );

  /* ── READ-ONLY ─────────────────────────────────────────────────────────────────────────── */
  if (readOnly) {
    return (
      <span className="nova-edit" data-kind={kind} data-readonly="true">
        <span className="nova-edit-ro" data-strong={strong ? 'true' : 'false'}>{value}</span>
        {marker}
      </span>
    );
  }

  /* ── EDITING ───────────────────────────────────────────────────────────────────────────── */
  if (editing) {
    const common = { 'aria-label': label, className: 'nova-inp', 'data-editor': kind } as const;
    return (
      <span className="nova-edit" data-kind={kind} data-editing="true" data-esc-local>
        {kind === 'select' ? (
          <select
            {...common}
            ref={field as React.RefObject<HTMLSelectElement>}
            value={draft}
            /* CHOOSING IS THE COMMIT. A select that needed a second confirming action would be
               asking twice for one decision. */
            onChange={(e) => commit(e.target.value)}
            onBlur={cancel}
            onKeyDown={(e: KeyboardEvent) => { if (e.key === 'Escape') { stop(e); cancel(); } }}
          >
            {(options ?? []).map((o) => <option key={o}>{o}</option>)}
          </select>
        ) : kind === 'multi' ? (
          /* WHICH OF THESE, not what. A checklist says the whole choice is visible and that more
             than one is allowed — both of which a text field hides. Done is the commit because
             a set is only finished when the reader says it is; there is no last keystroke that
             means "that's the list". */
          <span
            className="nova-multi"
            role="group"
            aria-label={label}
            data-editor="multi"
            /* The editor's own Done is an in-element control, not a forward action — declared
               so the requester-card guard lets it through. */
            data-in-element="editor"
            ref={field as React.RefObject<HTMLSpanElement> as never}
            onKeyDown={(e: KeyboardEvent) => { if (e.key === 'Escape') { stop(e); cancel(); } }}
            /* Leaving the checklist altogether is the reader moving on, so it commits — the same
               act `text` and `textarea` already treat as a commit. Staying inside it (tabbing
               between the boxes and Done) is not leaving. */
            onBlur={(e) => {
              const to = e.relatedTarget as Node | null;
              if (to && e.currentTarget.contains(to)) return;
              commit(formatSet(picked, options ?? []));
            }}
          >
            <span className="nova-multi-list">
              {(options ?? []).map((o, i) => (
                <label key={o} className="nova-multi-row">
                  <input
                    type="checkbox"
                    checked={picked.includes(o)}
                    /* eslint-disable-next-line jsx-a11y/no-autofocus -- the reader just asked to edit this */
                    autoFocus={i === 0}
                    onChange={() => setPicked((was) => (
                      was.includes(o) ? was.filter((x) => x !== o) : [...was, o]
                    ))}
                  />
                  <span>{o}</span>
                </label>
              ))}
            </span>
            <button
              type="button"
              className="nova-multi-done"
              onClick={() => commit(formatSet(picked, options ?? []))}
            >Done</button>
          </span>
        ) : kind === 'textarea' ? (
          <textarea
            {...common}
            ref={field as React.RefObject<HTMLTextAreaElement>}
            value={draft}
            rows={rows}
            /* `rows` is the floor when there is little to show; the measured height is the floor
               when there is more. The box that appears is the box that was already there. */
            style={restH.current ? { minHeight: restH.current } : undefined}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => commit(draft)}
            onKeyDown={(e: KeyboardEvent) => {
              /* Enter is a NEWLINE in a paragraph, so the commit key is the one that means
                 "done" everywhere else a paragraph is typed. */
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { stop(e); commit(draft); }
              else if (e.key === 'Escape') { stop(e); cancel(); }
            }}
          />
        ) : (
          <input
            {...common}
            ref={field as React.RefObject<HTMLInputElement>}
            value={draft}
            /* A value that wrapped to two lines leaves a two-line hole; a one-line field would
               drop the row by half its height the moment it opened. Same floor the textarea
               uses, same reason. */
            style={restH.current ? { minHeight: restH.current } : undefined}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => commit(draft)}
            onKeyDown={(e: KeyboardEvent) => {
              if (e.key === 'Enter') { stop(e); commit(draft); }
              else if (e.key === 'Escape') { stop(e); cancel(); }
            }}
          />
        )}
        {kind === 'textarea' && <DraftedLine edited={edited} draftedLabel={draftedLabel} />}
      </span>
    );
  }

  /* ── AT REST ───────────────────────────────────────────────────────────────────────────── */
  return (
    <span className="nova-edit" data-kind={kind} data-editing="false">
      <span
        ref={rest}
        role="button"
        tabIndex={0}
        aria-label={`Edit ${label}`}
        className="nova-edit-val"
        data-editable
        onClick={open}
        onKeyDown={(e: KeyboardEvent) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
        }}
      >
        {lead}
        {/* The glyph alone. The word "Edit" beside it was the third way this row said the same
            thing — after the pencil and the tint — and it is the one that pushed the value. */}
        <span className="nova-edit-pencil" aria-hidden="true">
          <Pencil size={12} />
        </span>
      </span>
      {kind === 'textarea' && <DraftedLine edited={edited} draftedLabel={draftedLabel} />}
    </span>
  );
}

/** The textarea kind's marker: a line BENEATH the paragraph, because a marker trailing five
 *  lines of prose is not read. Same mechanism as "· inferred", different words. */
function DraftedLine({ edited, draftedLabel }: { edited: boolean; draftedLabel?: string }) {
  return (
    <span className="nova-edit-drafted" data-edited={edited ? 'true' : 'false'}>
      {edited ? 'Edited' : (draftedLabel ?? 'Drafted by Nova')}
    </span>
  );
}
