import { useRef, useState } from 'react';
import { Check, ChevronRight, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import type { BannerSpec, DiffRow, DraftField, RequesterBlock } from '../scripts/registry';
import {
  addNote, closeTicket, createTicket, escalate, getDraft, listOpenForUser,
  updateDraft, updateTicket, useTicketStore, type MockTicket,
} from '../mockTickets';

/* THE REQUESTER PRIMITIVES — one set, composed by data, wired to ONE store.
 *
 * A script authors `blocks` (see RequesterBlock in the registry); this file renders them. No
 * case owns a layout: REQ-01's draft card and REQ-04's "didn't work" draft card are the same
 * component fed different data, which is what keeps seven cases from becoming seven designs.
 *
 * ── THE APPROVAL RULE, ENFORCED IN ONE PLACE ─────────────────────────────────────────────────
 * Every block that can change a ticket renders as a PROPOSAL. Its primary button is the confirm;
 * only that click calls the store; the card is then REPLACED by a ConfirmBanner naming what
 * happened. The secondary collapses it to a muted one-liner. Nothing here mutates on render,
 * and nothing outside the store's mutation functions changes a record.
 *
 * ── LANGUAGE ─────────────────────────────────────────────────────────────────────────────────
 * Requester words only. No queue names a requester never chose, no severity matrices — a ticket
 * is "being worked on", a fix "took about two minutes", a fault gets "picked up".
 */

const CARD = 'overflow-hidden rounded-lg border border-[var(--nova-rule)] bg-[var(--nova-surface)]';
const PRIMARY = 'nova-btn nova-btn-primary inline-flex h-9 items-center rounded px-4 ask-text-base ask-w-500 disabled:opacity-40';
const GHOST = 'nova-btn nova-btn-ghost inline-flex h-9 items-center rounded px-3 ask-text-base disabled:opacity-40';

const bannerText = (spec: BannerSpec, ref: string) => spec.text.replace('{ref}', ref);

/* ── AnswerHead ─────────────────────────────────────────────────────────── */
export function AnswerHead({ n, text, body }: { n?: string; text: string; body?: string }) {
  return (
    <div style={{ marginTop: n ? 16 : 0 }}>
      {n && <p className="nova-t-label">{n}</p>}
      <p className="ask-text-lg leading-[1.35] text-[var(--nova-ink)] ask-w-600">{text}</p>
      {body && <p className="nova-t-body mt-1 text-[var(--nova-ink-muted)]">{body}</p>}
    </div>
  );
}

/* ── ConfirmBanner ──────────────────────────────────────────────────────── */
export function ConfirmBanner({ spec, mutatedRef, onAsk }: {
  spec: BannerSpec; mutatedRef: string; onAsk: (q: string) => void;
}) {
  return (
    <div className="rounded border border-[#CBE3D4] bg-[#F2F9F5] px-3 py-2.5" data-confirm-banner>
      <p className="nova-t-body flex items-start gap-2 text-[#0F6E4F]">
        <span aria-hidden="true" className="flex-shrink-0">✓</span>
        <span className="min-w-0">{bannerText(spec, mutatedRef)}</span>
      </p>
      {!!spec.actions?.length && (
        <p className="mt-1.5 flex flex-wrap gap-1.5 pl-5">
          {spec.actions.map((x) => (
            <button
              key={x.label}
              type="button"
              className="nova-btn nova-hit nova-tertiary"
              onClick={() => (x.ask ? onAsk(x.ask) : toast('Not in this demo'))}
            >{x.label}</button>
          ))}
        </p>
      )}
    </div>
  );
}

/** The secondary path — a muted record that a proposal was set aside, never a vanish. */
function DiscardedLine({ label }: { label: string }) {
  return <p className="nova-t-meta" data-discarded>{label} — nothing was changed.</p>;
}

/* ── shared proposal shell: idle → confirmed(banner) / discarded ────────── */
function useProposal(onConfirmed?: () => void) {
  const [phase, setPhase] = useState<'idle' | 'done' | 'discarded'>('idle');
  const [ref, setRef] = useState('');
  return {
    phase,
    ref,
    confirm(mutatedRef: string) { setRef(mutatedRef); setPhase('done'); onConfirmed?.(); },
    discard() { setPhase('discarded'); },
  };
}

/* ── DraftCard ──────────────────────────────────────────────────────────── */
export function DraftCard({ id, title, fields, primary, secondary, banner, category, onAsk, onConfirmed }: {
  id: string; title: string; fields: DraftField[]; primary: string; secondary: string;
  banner: BannerSpec; category?: string;
  onAsk: (q: string) => void; onConfirmed?: () => void;
}) {
  useTicketStore();
  const draft = getDraft(id);
  const p = useProposal(onConfirmed);
  const [editing, setEditing] = useState<string | null>(null);

  if (draft.createdRef || p.phase === 'done') {
    return <ConfirmBanner spec={banner} mutatedRef={draft.createdRef ?? p.ref} onAsk={onAsk} />;
  }
  if (draft.discarded || p.phase === 'discarded') return <DiscardedLine label="Draft discarded" />;

  const valueOf = (f: DraftField) =>
    (f.label === 'Subject' ? draft.subject : f.label === 'Priority' ? draft.priority : undefined) ?? f.value;

  const create = () => {
    const subject = valueOf(fields.find((f) => f.label === 'Subject') ?? { label: '', value: title });
    const priority = valueOf(fields.find((f) => f.label === 'Priority') ?? { label: '', value: 'Medium' });
    const rec = createTicket({
      title: subject, priority,
      ...(category ? { assignee: category } : {}),
      ...(draft.linkedAsset ? { affectedAssets: [draft.linkedAsset] } : {}),
    });
    updateDraft(id, { createdRef: rec.ref });
    p.confirm(rec.ref);
  };

  return (
    <div className={CARD} data-draft-card>
      <p className="nova-t-label border-b border-[var(--nova-rule)] px-4 py-3">{title}</p>
      <dl className="px-4 py-1">
        {fields.map((f, i) => (
          <div key={f.label} className={`flex items-baseline gap-4 py-2 ${i > 0 ? 'border-t border-[var(--nova-rule)]' : ''}`}>
            <dt className="nova-t-label w-[104px] flex-shrink-0">{f.label}</dt>
            <dd className="min-w-0 flex-1">
              {f.editable && f.options ? (
                <select
                  value={valueOf(f)}
                  onChange={(e) => updateDraft(id, { priority: e.target.value })}
                  aria-label={f.label}
                  className="app-select h-7 rounded border border-[var(--nova-rule)] bg-white px-2 pr-7 ask-text-sm text-[var(--nova-ink)]"
                >
                  {f.options.map((o) => <option key={o}>{o}</option>)}
                </select>
              ) : f.editable && editing === f.label ? (
                <input
                  defaultValue={valueOf(f)}
                  /* eslint-disable-next-line jsx-a11y/no-autofocus -- the reader just asked to edit */
                  autoFocus
                  aria-label={f.label}
                  onBlur={(e) => { updateDraft(id, { subject: e.target.value || f.value }); setEditing(null); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                  className="h-7 w-full rounded border border-[var(--nova-primary)] bg-white px-2 ask-text-sm text-[var(--nova-ink)] outline-none"
                />
              ) : (
                <button
                  type="button"
                  disabled={!f.editable}
                  onClick={() => f.editable && setEditing(f.label)}
                  className={`group/df inline-flex max-w-full items-center gap-1.5 rounded text-left ask-text-base text-[var(--nova-ink)] ${
                    f.editable ? 'nova-btn -mx-1 px-1 hover:bg-[#F1F5F9]' : 'cursor-default'}`}
                >
                  <span className="min-w-0 truncate">{valueOf(f)}</span>
                  {f.editable && <Pencil size={11} aria-hidden="true" className="flex-shrink-0 text-[var(--nova-ink-faint)] opacity-0 group-hover/df:opacity-100" />}
                </button>
              )}
              {f.inferred && <span className="nova-t-meta ml-2">· inferred</span>}
            </dd>
          </div>
        ))}
        {draft.linkedAsset && (
          <div className="flex items-baseline gap-4 border-t border-[var(--nova-rule)] py-2" data-linked-asset>
            <dt className="nova-t-label w-[104px] flex-shrink-0">Linked asset</dt>
            <dd className="ask-text-base text-[var(--nova-ink)]">{draft.linkedAsset}</dd>
          </div>
        )}
      </dl>
      <div className="flex items-center gap-1.5 border-t border-[var(--nova-rule)] px-4 py-3">
        <button type="button" className={PRIMARY} onClick={create}>{primary}</button>
        <button type="button" className={GHOST} onClick={() => { updateDraft(id, { discarded: true }); p.discard(); }}>{secondary}</button>
      </div>
    </div>
  );
}

/* ── StatusCard ─────────────────────────────────────────────────────────── */
const STEPS = ['Logged', 'Assigned', 'In progress', 'Resolved'];
const stepOf = (t: MockTicket): number =>
  t.status === 'Resolved' || t.status === 'Closed' ? 3
    : t.status === 'In progress' ? 2
      : t.status === 'Pending approval' ? 1 : 0;

export function StatusCard({ ticket, actions, onAsk }: {
  ticket: MockTicket;
  actions?: Array<{ label: string; ask?: string }>;
  onAsk: (q: string) => void;
}) {
  const cur = stepOf(ticket);
  const note = ticket.notes.length ? ticket.notes[ticket.notes.length - 1].text : ticket.latestNote;
  return (
    <div className={CARD} data-status-card>
      <div className="px-4 py-3">
        <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="nova-t-label">{ticket.ref}</span>
          <span className="nova-t-body ask-w-500 text-[var(--nova-ink)]">{ticket.title}</span>
          <span className="ml-auto rounded-full bg-[#EDF3F9] px-2 py-[1px] ask-text-sm text-[#2D5478]" data-status-pill>{ticket.status}</span>
        </p>
        <p className="nova-t-meta mt-1.5">
          With {ticket.assignee} · updated {ticket.lastUpdate}
          {ticket.nextUpdate && ` · next update ${ticket.nextUpdate}`}
        </p>
        {/* The stepper — where this sits on its way to fixed. */}
        <div className="mt-3 flex items-center" aria-label={`Progress: ${STEPS[cur]}`} role="img">
          {STEPS.map((s, i) => (
            <div key={s} className="flex flex-1 flex-col items-start">
              <div className="flex w-full items-center">
                <span
                  aria-hidden="true"
                  className={`size-[10px] flex-shrink-0 rounded-full border-2 ${
                    i < cur ? 'border-[#3D8BD0] bg-[#3D8BD0]'
                      : i === cur ? 'border-[#3D8BD0] bg-white'
                        : 'border-[#D7DEE7] bg-white'}`}
                />
                {i < STEPS.length - 1 && (
                  <span aria-hidden="true" className={`mx-1 h-[2px] flex-1 rounded ${i < cur ? 'bg-[#3D8BD0]' : 'bg-[#E3E9F0]'}`} />
                )}
              </div>
              <span className={`mt-1 ask-text-sm ${i === cur ? 'ask-w-500 text-[var(--nova-ink)]' : 'text-[var(--nova-ink-faint)]'}`}>{s}</span>
            </div>
          ))}
        </div>
        {note && (
          <p className="nova-t-body mt-3 border-l-2 border-[var(--nova-rule)] pl-3 text-[var(--nova-ink-muted)]" data-latest-note>
            “{note}”
          </p>
        )}
      </div>
      {!!actions?.length && (
        <div className="flex flex-wrap gap-1.5 border-t border-[var(--nova-rule)] px-4 py-2.5">
          {actions.map((x) => (
            <button key={x.label} type="button" className="nova-btn nova-hit nova-tertiary"
              onClick={() => (x.ask ? onAsk(x.ask) : toast('Not in this demo'))}
            >{x.label}</button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── DiffCard ───────────────────────────────────────────────────────────── */
export function DiffCard({ title, rows, why, primary, secondary, banner, mutation, refId, onAsk, onConfirmed }: {
  title: string; rows: DiffRow[]; why: string; primary: string; secondary: string;
  banner: BannerSpec; mutation: 'escalate' | 'reopen' | 'raise-priority'; refId: string;
  onAsk: (q: string) => void; onConfirmed?: () => void;
}) {
  const p = useProposal(onConfirmed);
  if (p.phase === 'done') return <ConfirmBanner spec={banner} mutatedRef={p.ref} onAsk={onAsk} />;
  if (p.phase === 'discarded') return <DiscardedLine label={secondary} />;

  const run = () => {
    if (mutation === 'escalate') escalate(refId);
    else if (mutation === 'reopen') updateTicket(refId, { status: 'Open' });
    else updateTicket(refId, { priority: 'High' });
    p.confirm(refId);
  };

  return (
    <div className={CARD} data-diff-card>
      <p className="nova-t-label border-b border-[var(--nova-rule)] px-4 py-3">{title}</p>
      <dl className="px-4 py-1">
        {rows.map((r, i) => (
          <div key={r.label} className={`flex items-baseline gap-4 py-2 ${i > 0 ? 'border-t border-[var(--nova-rule)]' : ''}`}>
            <dt className="nova-t-label w-[104px] flex-shrink-0">{r.label}</dt>
            <dd className="min-w-0 flex-1 nova-t-body">
              <span className="text-[var(--nova-ink-muted)]">{r.from}</span>
              <span aria-hidden="true" className="mx-1.5 text-[var(--nova-ink-faint)]">→</span>
              <span className="ask-w-500">{r.to}</span>
            </dd>
          </div>
        ))}
      </dl>
      <p className="nova-t-meta border-t border-[var(--nova-rule)] px-4 py-2.5">Why: {why}</p>
      <div className="flex items-center gap-1.5 border-t border-[var(--nova-rule)] px-4 py-3">
        <button type="button" className={PRIMARY} onClick={run}>{primary}</button>
        <button type="button" className={GHOST} onClick={p.discard}>{secondary}</button>
      </div>
    </div>
  );
}

/* ── StepList ───────────────────────────────────────────────────────────── */
export function StepList({ steps, windows, mac, tickable, short, detail, variant }: {
  steps?: string[]; windows?: string[]; mac?: string[]; tickable?: boolean;
  short?: string[]; detail?: string;
  variant?: 'default' | 'short' | 'detail';
}) {
  const [platform, setPlatform] = useState<'windows' | 'mac'>('windows');
  const [ticked, setTicked] = useState<Set<number>>(new Set());
  const both = !!windows && !!mac;
  const list = variant === 'short' && short ? short
    : (both ? (platform === 'windows' ? windows! : mac!) : (steps ?? []));

  return (
    <div data-step-list data-variant={variant ?? 'default'}>
      {both && variant !== 'short' && (
        <div className="mb-2 inline-flex rounded border border-[var(--nova-rule)] p-0.5" role="tablist" aria-label="Platform">
          {(['windows', 'mac'] as const).map((pl) => (
            <button
              key={pl}
              type="button"
              role="tab"
              aria-selected={platform === pl}
              onClick={() => setPlatform(pl)}
              className={`nova-btn rounded px-2.5 py-1 ask-text-sm ${
                platform === pl ? 'bg-[#EAF1F8] ask-w-500 text-[var(--nova-ink)]' : 'text-[var(--nova-ink-muted)] hover:bg-[#F5F7FA]'}`}
            >{pl === 'windows' ? 'Windows' : 'Mac'}</button>
          ))}
        </div>
      )}
      <ol className="space-y-1.5">
        {list.map((s, i) => (
          <li key={s} className="flex items-start gap-2.5">
            {tickable ? (
              <button
                type="button"
                role="checkbox"
                aria-checked={ticked.has(i)}
                aria-label={`Step ${i + 1} done`}
                onClick={() => setTicked((prev) => {
                  const n = new Set(prev);
                  if (n.has(i)) n.delete(i); else n.add(i);
                  return n;
                })}
                className={`nova-btn mt-[3px] flex size-4 flex-shrink-0 items-center justify-center rounded border ${
                  ticked.has(i) ? 'border-[#3D8BD0] bg-[#3D8BD0] text-white' : 'border-[#C6CFDA] bg-white hover:border-[#3D8BD0]'}`}
              >
                {ticked.has(i) && <Check size={11} aria-hidden="true" />}
              </button>
            ) : (
              <span className="w-4 flex-shrink-0 text-right ask-text-sm tabular-nums text-[var(--nova-ink-faint)]" aria-hidden="true">{i + 1}</span>
            )}
            <span className={`min-w-0 nova-t-body ${tickable && ticked.has(i) ? 'text-[var(--nova-ink-faint)] line-through' : 'text-[var(--nova-ink)]'}`}>
              {s}
            </span>
          </li>
        ))}
      </ol>
      {variant === 'detail' && detail && (
        <p className="nova-t-meta mt-2 border-l-2 border-[var(--nova-rule)] pl-3" data-step-detail>{detail}</p>
      )}
    </div>
  );
}

/* ── YesNoPrompt ────────────────────────────────────────────────────────── */
export function YesNoPrompt({ prompt, yes, no, onAsk, onConfirmed }: {
  prompt: string;
  yes: { record: string; askAfter?: string };
  no: { ask: string };
  onAsk: (q: string) => void;
  onConfirmed?: () => void;
}) {
  const [answer, setAnswer] = useState<'yes' | 'no' | null>(null);
  if (answer === 'yes') {
    return <p className="nova-t-body flex items-center gap-2 text-[#0F6E4F]" data-yesno-record><span aria-hidden="true">✓</span>{yes.record}</p>;
  }
  if (answer === 'no') return <p className="nova-t-meta" data-yesno-record>You said it didn't work — drafting a ticket below.</p>;
  return (
    <div className="flex flex-wrap items-center gap-2" data-yesno>
      <span className="nova-t-body ask-w-500 text-[var(--nova-ink)]">{prompt}</span>
      <button type="button" className={PRIMARY.replace('h-9', 'h-8')} onClick={() => { setAnswer('yes'); onConfirmed?.(); if (yes.askAfter) onAsk(yes.askAfter); }}>Yes</button>
      <button type="button" className={GHOST.replace('h-9', 'h-8')} onClick={() => { setAnswer('no'); onAsk(no.ask); }}>No</button>
    </div>
  );
}

/* ── NoteComposer ───────────────────────────────────────────────────────── */
export function NoteComposer({ refId, prefill, title, primary, secondary, banner, changes, close, onAsk, onConfirmed }: {
  refId: string; prefill: string; title?: string; primary: string; secondary: string;
  banner: BannerSpec; changes?: Array<DiffRow & { patch?: 'assets' }>;
  /** A resolution note — confirming also closes the ticket. */
  close?: boolean;
  onAsk: (q: string) => void; onConfirmed?: () => void;
}) {
  const p = useProposal(onConfirmed);
  const [text, setText] = useState(prefill);
  const areaRef = useRef<HTMLTextAreaElement | null>(null);
  if (p.phase === 'done') return <ConfirmBanner spec={banner} mutatedRef={p.ref} onAsk={onAsk} />;
  if (p.phase === 'discarded') return <DiscardedLine label={secondary} />;

  const run = () => {
    addNote(refId, text);
    if (changes?.some((c) => c.patch === 'assets')) {
      updateTicket(refId, { affectedAssets: ['PRN-0311', 'PRN-0314'], affectedUsers: 2 });
    }
    if (close) closeTicket(refId, text);
    p.confirm(refId);
  };

  return (
    <div className={CARD} data-note-composer>
      {title && <p className="nova-t-label border-b border-[var(--nova-rule)] px-4 py-3">{title}</p>}
      <div className="px-4 py-3">
        <textarea
          ref={areaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          aria-label="Note"
          className="w-full resize-y rounded border border-[var(--nova-rule)] bg-white px-3 py-2 ask-text-base leading-[1.5] text-[var(--nova-ink)] outline-none focus:border-[var(--nova-primary)]"
        />
        {!!changes?.length && (
          <div className="mt-2" data-note-changes>
            <p className="nova-t-label">This update also changes</p>
            <dl className="mt-1">
              {changes.map((c) => (
                <div key={c.label} className="flex items-baseline gap-4 py-1">
                  <dt className="nova-t-label w-[104px] flex-shrink-0">{c.label}</dt>
                  <dd className="nova-t-body">
                    <span className="text-[var(--nova-ink-muted)]">{c.from}</span>
                    <span aria-hidden="true" className="mx-1.5 text-[var(--nova-ink-faint)]">→</span>
                    <span className="ask-w-500">{c.to}</span>
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </div>
      <div className="flex items-center gap-1.5 border-t border-[var(--nova-rule)] px-4 py-3">
        <button type="button" className={PRIMARY} disabled={!text.trim()} onClick={run}>{primary}</button>
        <button
          type="button"
          className={GHOST}
          onClick={() => (secondary === 'Edit' ? areaRef.current?.focus() : p.discard())}
        >{secondary}</button>
      </div>
    </div>
  );
}

/* ── RequestList + StatChips ────────────────────────────────────────────── */
const recency = (t: MockTicket): number =>
  t.lastUpdate === 'just now' ? 0
    : /hour/.test(t.lastUpdate) ? 1
      : /day/.test(t.lastUpdate) ? 2 + (parseInt(t.lastUpdate, 10) || 0) / 100 : 9;

export function RequestList({ onAsk }: { onAsk: (q: string) => void }) {
  useTicketStore();
  const rows = [...listOpenForUser()].sort((a, b) =>
    (a.needsYou === b.needsYou ? recency(a) - recency(b) : a.needsYou ? -1 : 1));
  return (
    <ul className={CARD} data-request-list>
      {rows.map((t, i) => (
        <li key={t.ref} className={i > 0 ? 'border-t border-[var(--nova-rule)]' : ''}>
          <button
            type="button"
            onClick={() => onAsk(`What's happening with ${t.ref}?`)}
            className="nova-btn flex w-full flex-wrap items-baseline gap-x-2 gap-y-0.5 px-4 py-2.5 text-left hover:bg-[#F1F5F9]"
          >
            <span className="nova-t-label">{t.ref}</span>
            <span className="min-w-0 flex-1 truncate nova-t-body text-[var(--nova-ink)]">{t.title}</span>
            {t.needsYou && (
              <span className="rounded-full bg-[#FBF2E3] px-2 py-[1px] ask-text-sm text-[#7A5200]" data-needs-you>Needs you</span>
            )}
            <span className="rounded-full bg-[#EDF3F9] px-2 py-[1px] ask-text-sm text-[#2D5478]">{t.status}</span>
            <span className="nova-t-meta">{t.lastUpdate}</span>
            <ChevronRight size={12} aria-hidden="true" className="text-[var(--nova-ink-faint)]" />
          </button>
        </li>
      ))}
    </ul>
  );
}

export function StatChips() {
  useTicketStore();
  const open = listOpenForUser();
  const chips = [
    { n: open.filter((t) => t.status === 'In progress' && !t.needsYou).length, label: 'in progress' },
    { n: open.filter((t) => t.needsYou).length, label: 'needs you', warn: true },
    { n: open.filter((t) => t.status === 'Pending approval').length, label: 'pending approval' },
  ].filter((c) => c.n > 0);
  return (
    <p className="flex flex-wrap gap-1.5" data-stat-chips>
      {chips.map((c) => (
        <span
          key={c.label}
          className={`rounded-full px-2.5 py-[2px] ask-text-sm ${
            c.warn ? 'bg-[#FBF2E3] text-[#7A5200]' : 'bg-[#EDF3F9] text-[#2D5478]'}`}
        >{c.n} {c.label}</span>
      ))}
    </p>
  );
}

/* ── AgeBar ─────────────────────────────────────────────────────────────── */
export function AgeBar({ open, typical, pct }: { open: string; typical: string; pct: number }) {
  return (
    <div data-age-bar>
      <div className="relative h-2 w-full max-w-[420px] overflow-hidden rounded-full bg-[#F1F5F9]">
        <div className="h-full rounded-full bg-[#D9822B]" style={{ width: '100%' }} aria-hidden="true" />
        <span
          aria-hidden="true"
          className="absolute top-[-2px] h-3 w-[2px] bg-[var(--nova-ink)]"
          style={{ left: `${Math.min(95, Math.max(2, pct))}%` }}
        />
      </div>
      <p className="nova-t-meta mt-1">Open {open} · typical: {typical}</p>
    </div>
  );
}

/* ── ResolutionNote ─────────────────────────────────────────────────────── */
export function ResolutionNote({ ticket, action, onAsk }: {
  ticket: MockTicket;
  action?: { label: string; ask: string };
  onAsk: (q: string) => void;
}) {
  return (
    <div className="border-l-2 border-[var(--nova-rule)] pl-3" data-resolution-note>
      <p className="nova-t-meta">Resolved by {ticket.resolvedBy ?? ticket.assignee} · {ticket.resolvedAgo}</p>
      <p className="nova-t-body mt-0.5 text-[var(--nova-ink)]">{ticket.resolution}</p>
      {action && (
        <button type="button" className="nova-btn nova-hit nova-tertiary mt-1.5 -ml-1" onClick={() => onAsk(action.ask)}>
          {action.label}
        </button>
      )}
    </div>
  );
}

/* ── the small one-offs that are still shared shapes ────────────────────── */
function Timeline({ steps, footer }: { steps: Array<{ label: string; note: string }>; footer: string }) {
  return (
    <div data-timeline>
      <ol className="space-y-2">
        {steps.map((s, i) => (
          <li key={s.label} className="flex items-start gap-2.5">
            <span className="mt-[2px] flex size-5 flex-shrink-0 items-center justify-center rounded-full bg-[#EDF3F9] ask-text-sm text-[#2D5478]" aria-hidden="true">{i + 1}</span>
            <span className="min-w-0">
              <span className="nova-t-body ask-w-500 text-[var(--nova-ink)]">{s.label}</span>
              <span className="nova-t-meta ml-2">{s.note}</span>
            </span>
          </li>
        ))}
      </ol>
      <p className="nova-t-meta mt-2">{footer}</p>
    </div>
  );
}

function AssetPicker({ prompt, options, confirm, draftId, banner, onAsk, onConfirmed }: {
  prompt: string; options: string[]; confirm: string; draftId: string; banner: BannerSpec;
  onAsk: (q: string) => void; onConfirmed?: () => void;
}) {
  const p = useProposal(onConfirmed);
  const [picked, setPicked] = useState<string | null>(null);
  if (p.phase === 'done') return <ConfirmBanner spec={banner} mutatedRef={p.ref} onAsk={onAsk} />;
  return (
    <div className={CARD} data-asset-picker>
      <p className="nova-t-label border-b border-[var(--nova-rule)] px-4 py-3">{prompt}</p>
      <ul className="px-4 py-1" role="radiogroup" aria-label={prompt}>
        {options.map((o, i) => (
          <li key={o} className={i > 0 ? 'border-t border-[var(--nova-rule)]' : ''}>
            <button
              type="button"
              role="radio"
              aria-checked={picked === o}
              onClick={() => setPicked(o)}
              className="nova-btn flex w-full items-center gap-2 py-2 text-left ask-text-base text-[var(--nova-ink)] hover:bg-[#F5F7FA]"
            >
              <span aria-hidden="true" className={`size-[10px] flex-shrink-0 rounded-full border-2 ${picked === o ? 'border-[#3D8BD0] bg-[#3D8BD0]' : 'border-[#C6CFDA]'}`} />
              {o}
            </button>
          </li>
        ))}
      </ul>
      <div className="border-t border-[var(--nova-rule)] px-4 py-3">
        <button
          type="button"
          className={PRIMARY.replace('h-9', 'h-8')}
          disabled={!picked}
          onClick={() => {
            const id = picked!.split(' ')[0];
            updateDraft(draftId, { linkedAsset: id });
            p.confirm(id);
          }}
        >{confirm}</button>
      </div>
    </div>
  );
}

function TeamCard({ heading, members }: { heading: string; members: Array<{ name: string; onShift: boolean; load: string }> }) {
  return (
    <div className={CARD} data-team-card>
      <p className="nova-t-label border-b border-[var(--nova-rule)] px-4 py-3">{heading}</p>
      <ul className="px-4 py-1">
        {members.map((m, i) => (
          <li key={m.name} className={`flex items-baseline gap-2 py-2 ${i > 0 ? 'border-t border-[var(--nova-rule)]' : ''}`}>
            <span aria-hidden="true" className={`size-2 flex-shrink-0 self-center rounded-full ${m.onShift ? 'bg-[#12805C]' : 'bg-[#C6CFDA]'}`} />
            <span className="nova-t-body text-[var(--nova-ink)]">{m.name}</span>
            <span className="nova-t-meta">{m.onShift ? 'on shift' : 'off shift'} · {m.load}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CloseList({ primary, banner, onAsk, onConfirmed }: {
  primary: string; banner: BannerSpec; onAsk: (q: string) => void; onConfirmed?: () => void;
}) {
  useTicketStore();
  const p = useProposal(onConfirmed);
  const [sel, setSel] = useState<Set<string>>(new Set());
  if (p.phase === 'done') return <ConfirmBanner spec={banner} mutatedRef={p.ref} onAsk={onAsk} />;
  const rows = listOpenForUser().filter((t) => t.status === 'In progress');
  return (
    <div className={CARD} data-close-list>
      <ul className="px-4 py-1">
        {rows.map((t, i) => (
          <li key={t.ref} className={i > 0 ? 'border-t border-[var(--nova-rule)]' : ''}>
            <label className="flex cursor-pointer items-baseline gap-2.5 py-2">
              <input
                type="checkbox"
                checked={sel.has(t.ref)}
                onChange={() => setSel((prev) => {
                  const n = new Set(prev);
                  if (n.has(t.ref)) n.delete(t.ref); else n.add(t.ref);
                  return n;
                })}
                className="mt-[3px] size-4 self-start accent-[#3D8BD0]"
              />
              <span className="nova-t-label">{t.ref}</span>
              <span className="nova-t-body text-[var(--nova-ink)]">{t.title}</span>
            </label>
          </li>
        ))}
      </ul>
      <div className="border-t border-[var(--nova-rule)] px-4 py-3">
        <button
          type="button"
          className={PRIMARY.replace('h-9', 'h-8')}
          disabled={!sel.size}
          onClick={() => {
            [...sel].forEach((ref) => closeTicket(ref, 'Closed by requester — confirmed fixed.'));
            p.confirm([...sel].join(', '));
          }}
        >{primary}</button>
      </div>
    </div>
  );
}

/* ── the renderer — blocks in, primitives out ───────────────────────────── */
export function RequesterBlocks({ blocks, question, onAsk, onConfirmed, stepsVariant }: {
  blocks: RequesterBlock[];
  /** The turn's own question — a `status` block whose ref is `$question` reads it from here. */
  question: string;
  onAsk: (q: string) => void;
  /** The answer's MAIN proposal was confirmed — the parent swaps the chip set. */
  onConfirmed?: () => void;
  stepsVariant?: 'default' | 'short' | 'detail';
}) {
  const store = useTicketStore();

  const resolveRef = (ref: string): string => {
    if (ref !== '$question') return ref;
    const m = question.match(/\b((?:INC|REQ)-\d+)\b/i);
    return m ? m[1].toUpperCase() : '';
  };

  return (
    <div className="space-y-4" style={{ marginTop: 12 }} data-requester-blocks>
      {blocks.map((b, i) => {
        const key = `b${i}`;
        switch (b.w) {
          case 'head': return <AnswerHead key={key} n={b.n} text={b.text} body={b.body} />;
          case 'confidence': return (
            <p key={key} className="nova-t-meta" data-confidence>{b.text}</p>
          );
          case 'draft': return (
            <DraftCard key={key} id={b.id} title={b.title} fields={b.fields} category={b.category}
              primary={b.primary} secondary={b.secondary} banner={b.banner}
              onAsk={onAsk} onConfirmed={onConfirmed} />
          );
          case 'status': {
            const t = store.tickets.find((x) => x.ref === resolveRef(b.ref));
            return t ? <StatusCard key={key} ticket={t} actions={b.actions} onAsk={onAsk} /> : null;
          }
          case 'diff': return (
            <DiffCard key={key} title={b.title} rows={b.rows} why={b.why}
              primary={b.primary} secondary={b.secondary} banner={b.banner}
              mutation={b.mutation} refId={b.ref} onAsk={onAsk} onConfirmed={onConfirmed} />
          );
          case 'steps': return (
            <StepList key={key} steps={b.steps} windows={b.windows} mac={b.mac}
              tickable={b.tickable} short={b.short} detail={b.detail} variant={stepsVariant} />
          );
          case 'yesno': return (
            <YesNoPrompt key={key} prompt={b.prompt} yes={b.yes} no={b.no}
              onAsk={onAsk} onConfirmed={onConfirmed} />
          );
          case 'note': return (
            <NoteComposer key={key} refId={b.ref} prefill={b.prefill} title={b.title}
              primary={b.primary} secondary={b.secondary} banner={b.banner} changes={b.changes}
              close={b.close} onAsk={onAsk} onConfirmed={onConfirmed} />
          );
          case 'list': return <RequestList key={key} onAsk={onAsk} />;
          case 'statchips': return <StatChips key={key} />;
          case 'agebar': return <AgeBar key={key} open={b.open} typical={b.typical} pct={b.pct} />;
          case 'resolution': {
            const t = store.tickets.find((x) => x.ref === b.ref);
            return t ? <ResolutionNote key={key} ticket={t} action={b.action} onAsk={onAsk} /> : null;
          }
          case 'timeline': return <Timeline key={key} steps={b.steps} footer={b.footer} />;
          case 'picker': return (
            <AssetPicker key={key} prompt={b.prompt} options={b.options} confirm={b.confirm}
              draftId={b.draftId} banner={b.banner} onAsk={onAsk} onConfirmed={onConfirmed} />
          );
          case 'team': return <TeamCard key={key} heading={b.heading} members={b.members} />;
          case 'closelist': return (
            <CloseList key={key} primary={b.primary} banner={b.banner} onAsk={onAsk} onConfirmed={onConfirmed} />
          );
          default: return null;
        }
      })}
    </div>
  );
}
