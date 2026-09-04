import { useState } from 'react';
import { Check, ChevronDown, Pencil, Plus, X } from 'lucide-react';
import type { PlanImpactRow, PlanProposal } from '../scripts/registry';
import type { TurnPlan } from '../turnModel';
import { Emph } from './blocks';

/* THE PLAN — a reviewable user-control object, and visually NOT the planning that produced it.
 *
 * Planning was a temporary activity state (the live strip, the current check). This is a
 * deliberate proposal: numbered steps, the exact consequences of approving, the evidence behind
 * it one fold away, and two actions whose hierarchy is unmistakable. The card is the one filled
 * surface in the turn — the same rule the draft ticket card follows — because it is the thing
 * being approved.
 *
 * ── THE APPROVAL BOUNDARY ────────────────────────────────────────────────────────────────────
 * Nothing executes until "Approve & run". Every modification produces a NEW proposal (the diff
 * rendered above it, never a silent swap) that must be approved again — the stream enforces it,
 * this card only speaks it: "Nova won't change anything until you approve."
 *
 * ── EVIDENCE, NOT REASONING ──────────────────────────────────────────────────────────────────
 * "Why Nova recommends this" lists user-safe facts the investigation established. No "I decided",
 * no chain-of-thought — the same rule the whole module follows.
 */

export type PlanAction =
  | { action: 'approve' }
  | { action: 'revise'; text: string }
  | { action: 'remove_step'; step: string }
  | { action: 'edit_step'; step: string; label: string }
  | { action: 'add_step' };

/** One consequence row of "What will change". */
export function PlanImpact({ row }: { row: PlanImpactRow }) {
  return (
    <div className="flex items-baseline gap-4 py-1.5">
      <dt className="nova-t-label w-[104px] flex-shrink-0">{row.label}</dt>
      <dd className="min-w-0 flex-1 nova-t-body">
        {row.from != null && row.to != null ? (
          <>
            <span className="text-[var(--nova-ink-muted)]">{row.from}</span>
            <span aria-hidden="true" className="mx-1.5 text-[var(--nova-ink-faint)]">→</span>
            <span className="ask-w-500">{row.to}</span>
          </>
        ) : (
          <span>{row.value}</span>
        )}
      </dd>
    </div>
  );
}

/** The optional evidence fold — points only, the same tertiary treatment as "How Nova knows". */
export function PlanEvidence({ points }: { points: string[] }) {
  const [open, setOpen] = useState(false);
  if (!points.length) return null;
  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="nova-btn nova-hit nova-tertiary -ml-1"
      >
        <ChevronDown size={12} className="nova-chev flex-shrink-0" data-open={open ? 'true' : 'false'} aria-hidden="true" />
        Why Nova recommends this
      </button>
      {open && (
        <ul className="mt-1.5 space-y-1 pl-1.5" data-plan-evidence>
          {points.map((p) => (
            <li key={p} className="nova-t-body flex items-start gap-2">
              <span className="mt-[1px] flex-shrink-0 ask-text-sm text-[#12805C]" aria-hidden="true">✓</span>
              <span className="min-w-0">{p}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** What the latest modification changed — struck-through removals, from→to updates. Visible,
 *  because a plan that silently swapped under the reader is a plan they never reviewed. */
function PlanDiffView({ plan }: { plan: TurnPlan }) {
  const d = plan.diff;
  if (!d) return null;
  return (
    <div className="space-y-1" data-plan-diff>
      {(d.removed ?? []).map((r) => (
        <p key={r} className="nova-t-body">
          <span className="nova-t-label mr-2 align-middle text-[#8C2018]">Removed</span>
          <s className="text-[var(--nova-ink-muted)]">{r}</s>
        </p>
      ))}
      {(d.updated ?? []).map((u) => (
        <p key={u.label} className="nova-t-body">
          <span className="nova-t-label mr-2 align-middle text-[#7A5200]">Updated</span>
          {u.label}:{' '}
          <span className="text-[var(--nova-ink-muted)]">{u.from}</span>
          <span aria-hidden="true" className="mx-1.5 text-[var(--nova-ink-faint)]">→</span>
          <span className="ask-w-500">{u.to}</span>
        </p>
      ))}
      {(d.added ?? []).map((a) => (
        <p key={a} className="nova-t-body">
          <span className="nova-t-label mr-2 align-middle text-[#0F6E4F]">Added</span>
          {a}
        </p>
      ))}
    </div>
  );
}

/** The lightweight modify surface — natural language first, then the steps themselves, each
 *  editable or removable in place. Never a form, never a navigation. */
function PlanEditor({ proposal, onRespond, onClose }: {
  proposal: PlanProposal;
  onRespond: (a: PlanAction) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const send = () => {
    if (!text.trim()) return;
    onRespond({ action: 'revise', text: text.trim() });
    onClose();
  };

  return (
    <div data-plan-editor>
      <p className="nova-t-body ask-w-500">What would you like to change?</p>
      <div className="mt-2 flex items-center gap-1.5">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
          placeholder={proposal.hint ?? 'Describe the change…'}
          className="h-9 w-full min-w-0 flex-1 rounded border border-[var(--nova-rule)] bg-white px-3 ask-text-base text-[var(--nova-ink)] outline-none placeholder:text-[var(--nova-ink-faint)] focus:border-[var(--nova-primary)]"
        />
        <button
          type="button"
          disabled={!text.trim()}
          onClick={send}
          className="nova-btn nova-btn-primary inline-flex h-9 flex-shrink-0 items-center rounded px-3 ask-text-base ask-w-500 disabled:opacity-40"
        >Update plan</button>
      </div>

      <p className="nova-t-meta" style={{ marginTop: 12, marginBottom: 4 }}>Or change a step directly</p>
      <ul className="space-y-0.5">
        {proposal.steps.map((s, i) => (
          <li key={s.id} className="group/pstep flex items-center gap-2 rounded px-1 py-0.5 hover:bg-[#F5F7FA]">
            {editing === s.id ? (
              <>
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && draft.trim()) {
                      onRespond({ action: 'edit_step', step: s.id, label: draft.trim() });
                      setEditing(null); onClose();
                    }
                    if (e.key === 'Escape') setEditing(null);
                  }}
                  /* eslint-disable-next-line jsx-a11y/no-autofocus -- the reader just asked to edit this row */
                  autoFocus
                  className="h-7 w-full min-w-0 flex-1 rounded border border-[var(--nova-primary)] bg-white px-2 ask-text-sm text-[var(--nova-ink)] outline-none"
                />
                <button
                  type="button"
                  aria-label="Save step"
                  disabled={!draft.trim()}
                  onClick={() => {
                    onRespond({ action: 'edit_step', step: s.id, label: draft.trim() });
                    setEditing(null); onClose();
                  }}
                  className="nova-btn nova-btn-icon flex size-7 flex-shrink-0 items-center justify-center rounded"
                ><Check size={13} aria-hidden="true" /></button>
              </>
            ) : (
              <>
                <span className="w-4 flex-shrink-0 text-right ask-text-sm tabular-nums text-[var(--nova-ink-faint)]" aria-hidden="true">{i + 1}</span>
                <span className="min-w-0 flex-1 ask-text-sm text-[var(--nova-ink)]">{s.label}</span>
                <button
                  type="button"
                  aria-label={`Edit step: ${s.label}`}
                  onClick={() => { setEditing(s.id); setDraft(s.label); }}
                  className="nova-btn nova-btn-icon flex size-7 flex-shrink-0 items-center justify-center rounded opacity-0 focus-visible:opacity-100 group-hover/pstep:opacity-100"
                ><Pencil size={12} aria-hidden="true" /></button>
                <button
                  type="button"
                  aria-label={`Remove step: ${s.label}`}
                  onClick={() => { onRespond({ action: 'remove_step', step: s.id }); onClose(); }}
                  className="nova-btn nova-btn-icon flex size-7 flex-shrink-0 items-center justify-center rounded opacity-0 focus-visible:opacity-100 group-hover/pstep:opacity-100"
                ><X size={13} aria-hidden="true" /></button>
              </>
            )}
          </li>
        ))}
      </ul>
      {proposal.addable && (
        <button
          type="button"
          onClick={() => { onRespond({ action: 'add_step' }); onClose(); }}
          className="nova-btn nova-hit nova-tertiary mt-1"
          data-plan-add
        >
          <Plus size={12} aria-hidden="true" />
          Add step: {proposal.addable.label}
        </button>
      )}
      <div style={{ marginTop: 12 }}>
        <button
          type="button"
          onClick={onClose}
          className="nova-btn nova-btn-ghost inline-flex h-8 items-center rounded px-3 ask-text-sm"
        >Cancel</button>
      </div>
    </div>
  );
}

export function PlanCard({ plan, live, onRespond }: {
  plan: TurnPlan;
  /** The stream can still be released — false once the turn stopped or failed. */
  live: boolean;
  onRespond: (a: PlanAction) => void;
}) {
  const [modifying, setModifying] = useState(false);
  const p = plan.proposal;

  /* Once approved the proposal freezes into a quiet record — the execution list below it is
     what is alive now. */
  if (plan.status === 'approved') {
    return (
      <p className="flex items-center gap-1.5 ask-text-sm text-[var(--nova-ink-muted)]" style={{ marginTop: 16 }} data-plan-approved>
        <span className="text-[#12805C]" aria-hidden="true">✓</span>
        Plan approved · {p.steps.length} step{p.steps.length === 1 ? '' : 's'}
      </p>
    );
  }

  return (
    <section style={{ marginTop: 16 }} aria-label="Proposed plan" data-plan-card>
      {/* The one line above the card — "Here's how I'll handle this." / "Plan updated." — is a
          live announcement: the plan arriving IS the event. */}
      <p className="ask-text-base ask-w-600 text-[var(--nova-ink)]" role="status" aria-live="polite">
        {p.intro}
      </p>

      {plan.diff && <div style={{ marginTop: 8 }}><PlanDiffView plan={plan} /></div>}

      <div className="overflow-hidden rounded-lg border border-[var(--nova-rule)] bg-[var(--nova-surface)]" style={{ marginTop: 12 }}>
        <div className="px-4 py-3">
          <p className="nova-t-label">Plan</p>
          <ol className="mt-2 space-y-2">
            {p.steps.map((s, i) => (
              <li key={s.id} className="flex items-start gap-2.5">
                <span className="w-4 flex-shrink-0 text-right ask-text-sm ask-w-500 tabular-nums text-[var(--nova-ink-faint)]" aria-hidden="true">
                  {i + 1}
                </span>
                <span className="min-w-0">
                  <span className="nova-t-body ask-w-500 text-[var(--nova-ink)]">{s.label}</span>
                  {s.detail && <span className="nova-t-meta mt-0.5 block"><Emph>{s.detail}</Emph></span>}
                </span>
              </li>
            ))}
          </ol>
        </div>

        {p.impact.length > 0 && (
          <div className="border-t border-[var(--nova-rule)] px-4 py-3">
            <p className="nova-t-label">What will change</p>
            <dl className="mt-1" data-plan-impact>
              {p.impact.map((row) => <PlanImpact key={row.label} row={row} />)}
            </dl>
          </div>
        )}
      </div>

      <div style={{ marginTop: 12 }}>
        <PlanEvidence points={p.evidence ?? []} />
      </div>

      {modifying ? (
        <div style={{ marginTop: 12 }}>
          <PlanEditor proposal={p} onRespond={onRespond} onClose={() => setModifying(false)} />
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-1.5" style={{ marginTop: 12 }}>
          <button
            type="button"
            disabled={!live}
            onClick={() => onRespond({ action: 'approve' })}
            className="nova-btn nova-btn-primary inline-flex h-9 items-center rounded px-4 ask-text-base ask-w-500 disabled:opacity-40"
          >{p.approve}</button>
          <button
            type="button"
            disabled={!live}
            onClick={() => setModifying(true)}
            className="nova-btn nova-btn-ghost inline-flex h-9 items-center rounded px-3 ask-text-base disabled:opacity-40"
          >{p.modify}</button>
          <span className="nova-t-meta w-full">Nova won't change anything until you approve.</span>
        </div>
      )}
    </section>
  );
}
