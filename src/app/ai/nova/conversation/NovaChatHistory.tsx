import { useState } from 'react';
import { Pencil, Search, Trash2 } from 'lucide-react';
import { agoLabel, chatMatches, chatPreview, groupOf, type ChatGroup, type NovaChat } from '../novaChats';
import { RowIcon } from './NovaHeader';

/* CHAT HISTORY — every conversation, in the drawer itself.
 *
 * The title menu's Recent chats tab is a SHELF: the six most recent, two groups, one line each.
 * It answers "take me back to the thing I was just doing". It cannot answer "what did I ask
 * about the Bengaluru VPN drops last week" — six rows and a title are not enough to recognise a
 * conversation by, and a dropdown that grew to hold thirty would be a page pretending to be a
 * menu. So the shelf ends in one row — Show all — and that row opens this.
 *
 * ── WHAT THIS HAS THAT THE SHELF DOES NOT ───────────────────────────────────────────────────
 *   every chat, not six          · all four date groups, not two
 *   a line of what it was about  · room to read the title without truncating it
 *
 * ── THE LINE UNDER THE TITLE IS NOT A SUMMARY WRITTEN HERE ──────────────────────────────────
 * It is `chatPreview`: the answer's own headline where the conversation reached one, and the
 * reader's own opening words where it did not. Nothing on this screen is generated to fill a
 * space — a list of conversations is exactly the wrong place to invent a sentence about one.
 *
 * ── AND IT IS THE SAME ROW ──────────────────────────────────────────────────────────────────
 * Hover ground, the pencil-and-bin pair, inline rename, the CURRENT mark, the search: all of it
 * is the shelf's, reused down to the class names. A reader who learned the shelf has learned
 * this; the only difference is how much of it there is.
 */

/** Oldest last. `groupOf` decides which one a chat is in — the shelf collapses these four to
 *  two, and this is the list they were written for. */
const ORDER: ChatGroup[] = ['Today', 'Yesterday', 'Previous 7 days', 'Older'];

export function NovaChatHistory({
  chats, activeChatId, now, initialQuery = '', onOpen, onRename, onDelete,
}: {
  chats: NovaChat[];
  activeChatId: string | null;
  now: number;
  /** Whatever was typed in the shelf's search when Show all was pressed — carried over rather
   *  than asked for twice. */
  initialQuery?: string;
  onOpen: (id: string) => void;
  onRename: (title: string, id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [q, setQ] = useState(initialQuery);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState('');

  const needle = q.trim().toLowerCase();
  const matched = [...chats].sort((a, b) => b.updatedAt - a.updatedAt).filter((c) => chatMatches(c, needle));
  const groups = ORDER
    .map((label) => ({ label, rows: matched.filter((c) => groupOf(c.updatedAt, now) === label) }))
    .filter((g) => g.rows.length > 0);

  const startRename = (c: NovaChat) => { setRenamingId(c.id); setRenameText(c.title); };
  const commitRename = (id: string) => {
    const t = renameText.trim();
    if (t) onRename(t, id);
    setRenamingId(null);
  };

  return (
    <section className="nova-hist" role="region" aria-label="Chat history" data-history-list>
      {/* Sticky under the header, so the list scrolls and the way to filter it does not. */}
      <div className="nova-hist-searchbar">
        <label className="nova-hist-search">
          <Search size={14} aria-hidden="true" className="flex-shrink-0" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search chats…"
            aria-label="Search chats"
            autoFocus
            data-history-search
          />
        </label>
      </div>

      {matched.length === 0 ? (
        <p className="nova-menu-empty" data-history-empty>
          {chats.length === 0
            ? 'Your conversations will appear here.'
            : `No chats match “${q.trim()}”.`}
        </p>
      ) : groups.map((g) => (
        <div key={g.label} role="group" aria-label={g.label} data-history-group={g.label}>
          <p className="nova-menu-label">{g.label}</p>
          {g.rows.map((c) => {
            const current = c.id === activeChatId;
            if (renamingId === c.id) {
              return (
                <input
                  key={c.id}
                  className="nova-menu-rename"
                  value={renameText}
                  aria-label={`Rename ${c.title}`}
                  maxLength={80}
                  autoFocus
                  onChange={(e) => setRenameText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); commitRename(c.id); }
                    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setRenamingId(null); }
                  }}
                  onBlur={() => commitRename(c.id)}
                  data-rename-row={c.id}
                  data-esc-local
                />
              );
            }
            const preview = chatPreview(c);
            return (
              <div
                key={c.id}
                className="nova-menu-row nova-hist-row"
                data-chat-item={c.id}
                data-current={current ? 'true' : 'false'}
              >
                <button
                  type="button"
                  className="nova-menu-item nova-hist-item"
                  data-nav-item
                  aria-current={current ? 'true' : undefined}
                  onClick={() => onOpen(c.id)}
                >
                  <span className="nova-hist-head">
                    <span className="nova-menu-item-text">{c.title}</span>
                    {current && <span className="nova-menu-current" data-current-mark>Current</span>}
                    <span className="nova-menu-item-when">{agoLabel(c.updatedAt, now)}</span>
                  </span>
                  {preview && <span className="nova-hist-preview">{preview}</span>}
                </button>
                <span className="nova-menu-acts">
                  <RowIcon menu={false} label={`Rename ${c.title}`} onClick={() => startRename(c)}><Pencil size={13} aria-hidden="true" /></RowIcon>
                  <RowIcon menu={false} label={`Delete ${c.title}`} onClick={() => onDelete(c.id)}><Trash2 size={13} aria-hidden="true" /></RowIcon>
                </span>
              </div>
            );
          })}
        </div>
      ))}
    </section>
  );
}
