import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ChevronDown, ChevronLeft, ChevronRight, History, Maximize2, Minimize2, Pencil, Plus, Search, Trash2, X,
} from 'lucide-react';
import { useNovaActions, useNovaConversation } from '../NovaConversationProvider';
import { agoLabel, chatMatches, isToday, ROLE_LABEL, type NovaChat } from '../novaChats';
import { splitPrompts, usePrompts, type SavedPrompt } from '../novaPrompts';
import type { UserRole } from '../novaSuggestions';
import { NovaPopover } from './NovaPopover';
import { setVendorSeed, vendorSeedKind, useTicketStore } from '../mockTickets';
import { vendorPendingLarge } from '../vendorSeed';

/* THE HEADER.
 *
 *   [orb 18] [conversation title ▾]                         (·) [+] [⤢] [×]
 *
 * One 48px row, sticky over the dotted ground. It says what this conversation is ABOUT — the
 * one thing the old row never said — and nothing that the turn beneath it already says.
 *
 * ── THE ORB IS THE WAY HOME ─────────────────────────────────────────────────────────────────
 * Seated in the header at 18px, still, the orb is a button: it returns to the greeting and the
 * cards WITHOUT discarding the conversation, which is recorded under Recent chats first so the
 * title menu can bring it back. There is no separate back arrow. On the home view it is
 * disabled — already home. The orb itself is drawn by the host's flight layer over the seat
 * (`markerSlotRef`); that layer takes no pointer events, so the click lands here.
 *
 * ── THE TITLE OPENS THE CONVERSATION MENU ───────────────────────────────────────────────────
 * Two tabs — Recent chats · Saved prompts — in one popover anchored under the title. This
 * replaced the "Chats" and "Saved prompts" text buttons: two labels that wrapped the moment the
 * drawer narrowed, at the same weight as everything else in the row. Double-click, or a row's
 * Rename, edits a title inline.
 *
 * ── THREE ICONS, NO LABELS, NO BLUE ─────────────────────────────────────────────────────────
 * New chat, expand, close — 20px glyphs on 36px targets (44 on touch), muted at rest, full
 * contrast on hover. The dev-tools dot sits left of them: 6px, amber, dev builds only, easy to
 * miss and impossible to mistake for a product control.
 */

const DEV: boolean = (() => {
  try { return !!(import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV; } catch { return false; }
})();

const ROLES: UserRole[] = ['requester', 'technician', 'leadership'];

/** How many conversations the resting list shows. The search reaches all of them. */
const RECENT_CAP = 6;

type Tab = 'chats' | 'prompts';
/** The tab the reader last used, for THIS session. Deliberately a module variable and not
 *  storage: the menu had no persistence before, and a tab is not worth inventing some. */
let lastTab: Tab = 'chats';

export function NovaHeader({
  phase, markerSlotRef, scrolled, wide, userRole, onRoleChange, now, historyOpen,
  onHome, onNewChat, onToggleWide, onClose, onOpenChat, onUsePrompt, onRename, onDelete,
  onEditPrompt, onDeletePrompt, onNewPrompt, onShowAll, onCloseHistory,
}: {
  phase: 'greet' | 'clearing' | 'live';
  /** The orb's seat — the host's flight layer parks the orb over whatever this points at. */
  markerSlotRef: React.RefObject<HTMLElement | null>;
  /** The thread has scrolled beneath the header. */
  scrolled: boolean;
  wide: boolean;
  userRole: UserRole;
  onRoleChange?: (role: UserRole) => void;
  now: number;
  /** The full chat history is on screen instead of the conversation. */
  historyOpen: boolean;
  onHome: () => void;
  onNewChat: () => void;
  onToggleWide: () => void;
  onClose: () => void;
  onOpenChat: (id: string) => void;
  onUsePrompt: (p: SavedPrompt) => void;
  /** Rename a chat — the one on screen, or any other by id. */
  onRename: (title: string, id?: string) => void;
  onDelete: (id?: string) => void;
  onEditPrompt: (p: SavedPrompt) => void;
  onDeletePrompt: (p: SavedPrompt) => void;
  onNewPrompt: () => void;
  /** Show all — the full history, carrying whatever the shelf's search had in it. */
  onShowAll: (query: string) => void;
  onCloseHistory: () => void;
}) {
  const { turns, title, chats, activeChatId, skipInvestigation } = useNovaConversation();
  const { setSkipInvestigation, saveChat } = useNovaActions();
  const [menu, setMenu] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);
  const titleBtn = useRef<HTMLButtonElement | null>(null);
  const renameRef = useRef<HTMLInputElement | null>(null);
  const closeMenu = useCallback(() => setMenu(false), []);
  /* Opening the menu RECORDS the thread first, so the conversation you are in is a row like any
     other and can be renamed or deleted from it. Idempotent, and it stops nothing. */
  const toggleMenu = () => setMenu((v) => { if (!v) saveChat(); return !v; });
  const home = phase === 'greet';
  const hasChat = turns.length > 0;

  const startRename = () => {
    if (!title) return;
    setMenu(false);
    setRenaming(title);
  };
  const commitRename = () => {
    const t = (renaming ?? '').trim();
    if (t && t !== title) onRename(t);
    setRenaming(null);
  };
  useEffect(() => {
    if (renaming === null) return;
    renameRef.current?.focus();
    renameRef.current?.select();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renaming !== null]);

  return (
    <header
      className="nova-head"
      role="banner"
      aria-label="Conversation"
      data-scrolled={scrolled ? 'true' : 'false'}
      data-header
    >
      {/* THE ORB'S SEAT, and the way home. The seat is exactly 18px because the host sizes the
          orb from it; the target around it is the 36px the row's other buttons get. */}
      <button
        type="button"
        className="nova-head-orb-hit"
        aria-label="Home"
        title="Home"
        disabled={home && !historyOpen}
        onClick={onHome}
        data-home
      >
        <span ref={markerSlotRef as React.RefObject<HTMLSpanElement | null>} className="nova-head-orb" aria-hidden="true" />
      </button>

      {historyOpen ? (
        <>
          {/* The same slot the title occupies, doing what a title slot does in a sub-view:
              naming it, and leaving it. */}
          <button
            type="button"
            className="nova-head-back nova-btn"
            aria-label="Back to the conversation"
            title="Back"
            onClick={onCloseHistory}
            data-back
          >
            <ChevronLeft size={16} aria-hidden="true" className="flex-shrink-0" />
            <span>Chat history</span>
          </button>
          <span className="nova-head-count" data-chat-count>
            {chats.length} {chats.length === 1 ? 'chat' : 'chats'}
          </span>
        </>
      ) : renaming !== null ? (
        <input
          ref={renameRef}
          className="nova-head-rename"
          value={renaming}
          aria-label="Conversation title"
          maxLength={80}
          onChange={(e) => setRenaming(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); commitRename(); }
            else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setRenaming(null); }
          }}
          onBlur={commitRename}
          data-rename
        />
      ) : (
        <button
          ref={titleBtn}
          type="button"
          className="nova-head-title"
          aria-haspopup="menu"
          aria-expanded={menu}
          title={title ?? 'New conversation'}
          onClick={toggleMenu}
          onDoubleClick={startRename}
          data-title
          data-empty={title ? 'false' : 'true'}
        >
          <span className="nova-head-title-text">{title ?? 'New conversation'}</span>
          <ChevronDown size={14} aria-hidden="true" className="flex-shrink-0" />
        </button>
      )}

      <div className="nova-head-right">
        {DEV && (
          <NovaDevTools
            userRole={userRole}
            onRoleChange={onRoleChange}
            skip={skipInvestigation}
            onToggleSkip={() => setSkipInvestigation(!skipInvestigation)}
          />
        )}
        {/* Not while the history is up: the back arrow is one press, and a list of past
            conversations is not where starting a new one belongs. */}
        {!historyOpen && (
          <button
            type="button"
            className="nova-hbtn nova-btn"
            aria-label="New chat"
            title="New chat"
            disabled={!hasChat}
            onClick={onNewChat}
            data-new-chat
          ><Plus size={20} aria-hidden="true" /></button>
        )}
        <button
          type="button"
          className="nova-hbtn nova-btn"
          aria-label={wide ? 'Collapse' : 'Expand'}
          title={wide ? 'Collapse' : 'Expand'}
          aria-pressed={wide}
          onClick={onToggleWide}
          data-expand
        >{wide ? <Minimize2 size={20} aria-hidden="true" /> : <Maximize2 size={20} aria-hidden="true" />}</button>
        <button
          type="button"
          className="nova-hbtn nova-btn"
          aria-label="Close"
          title="Close"
          onClick={onClose}
        ><X size={20} aria-hidden="true" /></button>
      </div>

      {menu && (
        <NovaConversationMenu
          anchor={titleBtn.current}
          chats={chats}
          activeChatId={activeChatId}
          userRole={userRole}
          now={now}
          onClose={closeMenu}
          onOpen={(id) => { setMenu(false); onOpenChat(id); }}
          onRenameChat={onRename}
          onDeleteChat={(id) => { setMenu(false); onDelete(id); }}
          onUse={(p) => { setMenu(false); onUsePrompt(p); }}
          onEditPrompt={(p) => { setMenu(false); onEditPrompt(p); }}
          onDeletePrompt={(p) => { setMenu(false); onDeletePrompt(p); }}
          onNewPrompt={() => { setMenu(false); onNewPrompt(); }}
          onShowAll={(query) => { setMenu(false); onShowAll(query); }}
        />
      )}
    </header>
  );
}

/* THE CONVERSATION MENU — two tabs, one shelf.
 *
 *   RECENT CHATS    return to something
 *   SAVED PROMPTS   reuse something
 *
 * They were one list, and a reader looking for a conversation had to scan past four prompts to
 * find it. Two tabs mean one kind of thing at a time, and the menu got shorter rather than
 * taller. The strip is sticky, so it stays put if a list ever scrolls.
 *
 * ── TWO PARTS, AND A SEARCH ─────────────────────────────────────────────────────────────────
 * Recent chats separates TODAY from OLDER with a hairline. Two, not the four a browsing list
 * would want: a shelf of six rows only has to answer "was this today?". A group renders only
 * when it has rows, so there is never a heading over nothing or a divider under one list. The
 * search is always there and always compact — one 28px line above the groups.
 *
 * ── A ROW'S ACTIONS ARE TWO ICONS, ON HOVER ─────────────────────────────────────────────────
 * A pencil and a bin appear where the timestamp is, on hover or focus, and act immediately —
 * no `···`, nothing to expand, no row growing under the cursor to reach one thing. They are
 * absolutely positioned on the row's own hover ground so they COVER the time rather than
 * displacing it, which is why nothing reflows. Clicking the row itself is the third action
 * (open the chat, use the prompt), so it needs no control of its own.
 *
 * ── AND THE CURRENT CHAT'S ACTIONS LIVE ON ITS ROW ──────────────────────────────────────────
 * "Rename this chat" and "Delete this chat" used to sit at the bottom, under both lists, where
 * "this chat" meant whichever one happened to be on screen — conversation NAVIGATION and
 * conversation MANAGEMENT in the same column. Each row now manages itself.
 */
export function NovaConversationMenu({
  anchor, chats, activeChatId, userRole, now, onClose,
  onOpen, onRenameChat, onDeleteChat, onUse, onEditPrompt, onDeletePrompt, onNewPrompt, onShowAll,
}: {
  anchor: HTMLElement | null;
  chats: NovaChat[];
  activeChatId: string | null;
  userRole: UserRole;
  now: number;
  onClose: () => void;
  onOpen: (id: string) => void;
  onRenameChat: (title: string, id?: string) => void;
  onDeleteChat: (id: string) => void;
  onUse: (p: SavedPrompt) => void;
  onEditPrompt: (p: SavedPrompt) => void;
  onDeletePrompt: (p: SavedPrompt) => void;
  onNewPrompt: () => void;
  onShowAll: (query: string) => void;
}) {
  const [tab, setTab] = useState<Tab>(lastTab);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState('');
  const [q, setQ] = useState('');
  const tabsRef = useRef<HTMLDivElement | null>(null);

  const pick = (t: Tab) => { lastTab = t; setTab(t); setRenamingId(null); };

  const all = usePrompts();
  const { mine, other } = splitPrompts(all, userRole);
  /* Role influences ORDER, not labels: the reader's own first, then everyone else's. */
  const prompts = [...mine, ...other];

  const sorted = [...chats].sort((a, b) => b.updatedAt - a.updatedAt);
  const needle = q.trim().toLowerCase();
  /* `chatMatches` is in novaChats with the rest of a chat's rules — the full history searches
     too, and two copies of what a match is would drift. */
  const matched = sorted.filter((c) => chatMatches(c, needle));
  /* A search reaches every chat; the resting list is the most recent handful. */
  const recent = needle ? matched : matched.slice(0, RECENT_CAP);
  const parts: Array<{ label: string; rows: NovaChat[] }> = [
    { label: 'Today', rows: recent.filter((c) => isToday(c.updatedAt, now)) },
    { label: 'Older', rows: recent.filter((c) => !isToday(c.updatedAt, now)) },
  ].filter((x) => x.rows.length > 0);

  /* Left / Right / Home / End move between the tabs; the popover's own handler owns Up / Down
     for the list beneath, so the two never collide. */
  const tabKeys = (e: React.KeyboardEvent) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    e.stopPropagation();
    const next: Tab = e.key === 'Home' ? 'chats' : e.key === 'End' ? 'prompts' : (tab === 'chats' ? 'prompts' : 'chats');
    pick(next);
    requestAnimationFrame(() => tabsRef.current?.querySelector<HTMLElement>(`[data-tab="${next}"]`)?.focus());
  };

  const startRename = (c: NovaChat) => { setRenamingId(c.id); setRenameText(c.title); };
  const commitRename = (id: string) => {
    const t = renameText.trim();
    if (t) onRenameChat(t, id);
    setRenamingId(null);
  };

  return (
    <NovaPopover id="conversation" label="Conversation" role="menu" onClose={onClose} returnTo={anchor} anchor={anchor} width={300}>
      <div className="nova-menu">
        <div ref={tabsRef} className="nova-menu-tabs" role="tablist" aria-label="Conversation" onKeyDown={tabKeys}>
          <button
            type="button"
            role="tab"
            id="nova-tab-chats"
            aria-selected={tab === 'chats'}
            aria-controls="nova-panel-chats"
            tabIndex={tab === 'chats' ? 0 : -1}
            className="nova-menu-tab"
            data-tab="chats"
            onClick={() => pick('chats')}
          >Recent chats</button>
          <button
            type="button"
            role="tab"
            id="nova-tab-prompts"
            aria-selected={tab === 'prompts'}
            aria-controls="nova-panel-prompts"
            tabIndex={tab === 'prompts' ? 0 : -1}
            className="nova-menu-tab"
            data-tab="prompts"
            onClick={() => pick('prompts')}
          >Saved prompts</button>
          {tab === 'prompts' && (
            <button
              type="button"
              className="nova-menu-add nova-btn"
              aria-label="Save a prompt"
              title="Save a prompt"
              onClick={onNewPrompt}
              data-new-prompt
            ><Plus size={14} aria-hidden="true" /></button>
          )}
        </div>

        {tab === 'chats' ? (
          <div
            key="chats"
            className="nova-menu-panel"
            role="tabpanel"
            id="nova-panel-chats"
            aria-labelledby="nova-tab-chats"
            data-panel="chats"
          >
            {chats.length > 0 && (
              <label className="nova-menu-search">
                <Search size={12} aria-hidden="true" className="flex-shrink-0" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search chats…" aria-label="Search chats" />
              </label>
            )}
            {chats.length === 0 ? (
              <p className="nova-menu-empty" data-chats-empty>Your recent conversations will appear here.</p>
            ) : recent.length === 0 ? (
              <p className="nova-menu-empty" data-chats-nomatch>No chats match &ldquo;{q.trim()}&rdquo;.</p>
            ) : parts.map((part, pi) => (
              <div key={part.label} role="group" aria-label={part.label} data-chat-group={part.label}>
                {pi > 0 && <div role="separator" className="nova-menu-sep" />}
                <p className="nova-menu-label">{part.label}</p>
                {part.rows.map((c) => {
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
                return (
                  <div key={c.id} className="nova-menu-row" data-chat-item={c.id} data-current={current ? 'true' : 'false'}>
                    <button
                      type="button"
                      role="menuitem"
                      className="nova-menu-item"
                      data-nav-item
                      aria-current={current ? 'true' : undefined}
                      onClick={() => onOpen(c.id)}
                    >
                      <span className="nova-menu-item-text">{c.title}</span>
                      {current && <span className="nova-menu-current" data-current-mark>Current</span>}
                      <span className="nova-menu-item-when">{agoLabel(c.updatedAt, now)}</span>
                    </button>
                    <span className="nova-menu-acts">
                      <RowIcon label={`Rename ${c.title}`} onClick={() => startRename(c)}><Pencil size={13} aria-hidden="true" /></RowIcon>
                      <RowIcon label={`Delete ${c.title}`} onClick={() => onDeleteChat(c.id)}><Trash2 size={13} aria-hidden="true" /></RowIcon>
                    </span>
                  </div>
                );
                })}
              </div>
            ))}
            {/* THE SHELF ENDS BY SAYING HOW MUCH OF IT THIS WAS. Six of fourteen is not "your
                chats", and the count is what makes the row worth pressing. */}
            {chats.length > 0 && (
              <>
                <div role="separator" className="nova-menu-sep" />
                <button
                  type="button"
                  role="menuitem"
                  className="nova-menu-all nova-btn"
                  data-nav-item
                  data-show-all
                  onClick={() => onShowAll(q)}
                >
                  <History size={14} aria-hidden="true" className="flex-shrink-0" />
                  <span className="nova-menu-all-text">Show all</span>
                  <span className="nova-menu-all-count">{chats.length}</span>
                  <ChevronRight size={14} aria-hidden="true" className="flex-shrink-0" />
                </button>
              </>
            )}
          </div>
        ) : (
          <div
            key="prompts"
            className="nova-menu-panel"
            role="tabpanel"
            id="nova-panel-prompts"
            aria-labelledby="nova-tab-prompts"
            data-panel="prompts"
          >
            {prompts.length === 0 ? (
              <div className="nova-menu-empty" data-prompts-empty>
                <p>Save prompts you use often and find them here.</p>
                <button type="button" className="nova-tertiary nova-btn mt-2" data-nav-item onClick={onNewPrompt}>
                  <Plus size={12} aria-hidden="true" />Save a prompt
                </button>
              </div>
            ) : prompts.map((p) => (
              <div key={p.id} className="nova-menu-row" data-prompt-item={p.id}>
                <button
                  type="button"
                  role="menuitem"
                  className="nova-menu-item nova-menu-item-two"
                  data-nav-item
                  title={p.prompt}
                  onClick={() => onUse(p)}
                >
                  <span className="nova-menu-item-text">{p.name}</span>
                  <span className="nova-menu-preview">&ldquo;{p.prompt}&rdquo;</span>
                </button>
                <span className="nova-menu-acts">
                  <RowIcon label={`Edit ${p.name}`} onClick={() => onEditPrompt(p)}><Pencil size={13} aria-hidden="true" /></RowIcon>
                  <RowIcon label={`Delete ${p.name}`} onClick={() => onDeletePrompt(p)}><Trash2 size={13} aria-hidden="true" /></RowIcon>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </NovaPopover>
  );
}

/** One of a row's two actions. Hidden until the row is hovered or something in it has focus —
 *  the default state stays clean — and always present where there is no hover at all. */
export function RowIcon({ label, onClick, children, menu = true }: {
  label: string; onClick: () => void; children: React.ReactNode;
  /** False in the full history, which is a region and not a menu — a menuitem outside a menu
   *  is a lie a screen reader repeats. */
  menu?: boolean;
}) {
  return (
    <button
      type="button"
      role={menu ? 'menuitem' : undefined}
      className="nova-menu-act nova-btn"
      aria-label={label}
      title={label.split(' ')[0]}
      data-nav-item
      data-act={label.split(' ')[0].toLowerCase()}
      onClick={onClick}
    >{children}</button>
  );
}

/* ⚠️ DEV ONLY — REMOVE BEFORE ANY PRODUCTION BUILD. A 6px amber dot; its popover holds the two
   demo controls: the role switcher (there is no auth object in this prototype) and the skip
   that removes the investigation's pacing. */
export function NovaDevTools({ userRole, onRoleChange, skip, onToggleSkip }: {
  userRole: UserRole;
  onRoleChange?: (role: UserRole) => void;
  skip: boolean;
  onToggleSkip: () => void;
}) {
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement | null>(null);
  const close = useCallback(() => setOpen(false), []);
  /* Subscribed, so the pressed state is the store's answer rather than a copy of it. */
  useTicketStore();
  const seed = vendorSeedKind();
  return (
    <>
      <button
        ref={btn}
        type="button"
        className="nova-dev-dot nova-btn"
        aria-label="Dev tools"
        title="Dev tools"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        data-dev-dot
      ><span aria-hidden="true" /></button>
      {open && (
        <NovaPopover id="dev" label="Dev tools" onClose={close} returnTo={btn.current} anchor={btn.current} width={240} align="end">
          <div className="nova-dev">
            <p className="nova-menu-label">Dev tools</p>
            <div>
              <p className="nova-dev-label">Role</p>
              <div className="nova-seg" role="group" aria-label="Role">
                {ROLES.map((r) => (
                  <button
                    key={r}
                    type="button"
                    className="nova-seg-btn"
                    aria-pressed={userRole === r}
                    disabled={!onRoleChange}
                    onClick={() => onRoleChange?.(r)}
                  >{ROLE_LABEL[r]}</button>
                ))}
              </div>
            </div>
            {/* THE VENDOR DATASET. Not a feature flag — a way to look at TEC-06 at the scale
                it has to survive, which is the only scale where its caps are visible. */}
            <div>
              <p className="nova-dev-label">Vendor data</p>
              <div className="nova-seg" role="group" aria-label="Vendor dataset">
                {(['small', 'large'] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    className="nova-seg-btn"
                    aria-pressed={seed === k}
                    data-vendor-seed={k}
                    onClick={() => setVendorSeed(k, vendorPendingLarge)}
                  >{k === 'small' ? '9 tickets' : '62 tickets'}</button>
                ))}
              </div>
            </div>
            {/* THE VENDOR DATASET. Not a feature flag — a way to look at TEC-06 at the scale
                it has to survive, which is the only scale where its caps are visible. */}
            <div>
              <p className="nova-dev-label">Vendor data</p>
              <div className="nova-seg" role="group" aria-label="Vendor dataset">
                {(['small', 'large'] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    className="nova-seg-btn"
                    aria-pressed={seed === k}
                    data-vendor-seed={k}
                    onClick={() => setVendorSeed(k, vendorPendingLarge)}
                  >{k === 'small' ? '9 tickets' : '62 tickets'}</button>
                ))}
              </div>
            </div>
            <button
              type="button"
              className="nova-dev-toggle nova-btn"
              aria-pressed={skip}
              aria-label="Dev only: skip the investigation"
              title="Dev only · skip the investigation"
              onClick={onToggleSkip}
              data-nav-item
            >
              Skip the investigation
              <span className="nova-dev-state">{skip ? 'On' : 'Off'}</span>
            </button>
          </div>
        </NovaPopover>
      )}
    </>
  );
}
