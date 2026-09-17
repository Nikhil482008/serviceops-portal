import { useEffect, useRef, useState } from 'react';
import { GHOST_SM, PRIMARY_SM } from './cardKit';
import { NovaLayer } from './NovaPopover';

/* SAVE / EDIT A PROMPT, and the delete confirmation — one dialog pattern, three contents.
 *
 * The prompt arrives PREFILLED from the message it was saved beside, and so does the name,
 * generated the same way a chat's title is. Nobody copies a question out of the thread to keep
 * it. The name is focused and selected on open, because it is the one field that usually wants
 * a word changed; the prompt is left exactly as it was asked.
 *
 * Enter in the name saves; Ctrl/⌘+Enter in the prompt saves (plain Enter is a new line there);
 * Escape cancels. Save is disabled until both fields have something in them — an empty prompt
 * cannot be used, so it cannot be saved. */
export function NovaPromptDialog({ mode = 'save', initial, onCancel, onSave, anchor }: {
  mode?: 'save' | 'edit';
  initial: { name: string; prompt: string };
  onCancel: () => void;
  onSave: (name: string, prompt: string) => void;
  /** The drawer panel the layer covers. */
  anchor?: HTMLElement | null;
}) {
  const title = mode === 'edit' ? 'Edit prompt' : 'Save prompt';
  const [name, setName] = useState(initial.name);
  const [prompt, setPrompt] = useState(initial.prompt);
  const nameRef = useRef<HTMLInputElement | null>(null);
  const valid = name.trim().length > 0 && prompt.trim().length > 0;

  useEffect(() => {
    nameRef.current?.focus();
    nameRef.current?.select();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      e.preventDefault();
      onCancel();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onCancel]);

  const save = () => { if (valid) onSave(name.trim(), prompt.trim()); };

  return (
    <NovaLayer anchor={anchor} onScrimDown={onCancel} data-prompt-dialog={mode}>
      <form
        className="nova-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onSubmit={(e) => { e.preventDefault(); save(); }}
      >
        <p className="nova-modal-title">{title}</p>
        <label className="nova-field">
          <span className="nova-field-label">Name</span>
          <input
            ref={nameRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-label="Prompt name"
            placeholder="What you would call this"
            maxLength={80}
          />
        </label>
        <label className="nova-field">
          <span className="nova-field-label">Prompt</span>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            aria-label="Prompt text"
            placeholder="What you would ask Nova"
            rows={4}
            onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); save(); } }}
          />
        </label>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className={GHOST_SM} onClick={onCancel}>Cancel</button>
          <button type="submit" className={PRIMARY_SM} disabled={!valid}>Save</button>
        </div>
      </form>
    </NovaLayer>
  );
}

/* The delete confirmation — the same layer, one line of copy, two buttons. Lightweight because
   it is asking about one saved prompt, not a conversation. */
export function NovaDeletePrompt({ name, onCancel, onConfirm, anchor }: {
  name: string;
  onCancel: () => void;
  onConfirm: () => void;
  anchor?: HTMLElement | null;
}) {
  const primary = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    primary.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      e.preventDefault();
      onCancel();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onCancel]);
  return (
    <NovaLayer anchor={anchor} onScrimDown={onCancel} data-delete-prompt="">
      <div className="nova-modal" role="alertdialog" aria-modal="true" aria-label={`Delete ${name}`}>
        <p className="nova-modal-title">Delete &ldquo;{name}&rdquo;?</p>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className={GHOST_SM} onClick={onCancel}>Cancel</button>
          <button ref={primary} type="button" className={PRIMARY_SM} onClick={onConfirm}>Delete</button>
        </div>
      </div>
    </NovaLayer>
  );
}
