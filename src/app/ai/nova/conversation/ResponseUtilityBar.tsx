import { useEffect, useRef, useState } from 'react';
import {
  BarChart3, Check, ChevronLeft, Copy, Flag, MoreHorizontal, Share2, ShieldCheck,
  ThumbsDown, ThumbsUp,
} from 'lucide-react';
import { toast } from 'sonner';
import type { AnswerObject } from '../novaStream';
import { citationOrder } from './NovaCitations';

/* THE QUIET LAYER UNDER EVERY ANSWER — "what can I do with this response?"
 *
 * Three levels of action end a response, and they must not compete:
 *   LEVEL 1  the answer itself
 *   LEVEL 2  the contextual follow-up pills — "what should I do next?"  (FollowUpSuggestions)
 *   LEVEL 3  this bar — copy, share, sources, feedback, and the ••• response controls
 *
 * The bar sits under a hairline, all-ghost, icon-sized: a utility layer, never a rival to the
 * pills above it. The sources count is an ENTRY POINT into the existing evidence drawer, not a
 * second source surface — the count is `evidenceOf`'s, the same number the drawer header shows,
 * so the two can never disagree.
 *
 * ── THE ••• MENU IS CONTEXTUAL, NOT A DUMP ───────────────────────────────────────────────────
 * Base: shorter / elaborate / regenerate. "Change visual" exists only when the answer actually
 * carries a table or metric cards; "View sources" only when the investigation read any. An
 * option that cannot apply is absent, not disabled.
 */

export type AnswerDensity = 'standard' | 'concise' | 'detailed';
export type AnswerVisual = 'default' | 'table' | 'cards';
export interface AnswerView { density: AnswerDensity; visual: AnswerVisual }
export const DEFAULT_VIEW: AnswerView = { density: 'standard', visual: 'default' };

export type UtilityAction =
  | { kind: 'shorter' } | { kind: 'elaborate' } | { kind: 'regenerate' }
  | { kind: 'visual'; visual: AnswerVisual };

/** The Doherty ceiling — the held "Updating…" beat before a view change applies. */
const ACK_MS = 450;

const strip = (t?: string) => String(t ?? '').replace(/\[\[[^\]]+\]\]/g, '').replace(/\*\*/g, '').trim();

/** The answer as plain text, for the clipboard — every layer, markers stripped. */
export function answerToText(a: AnswerObject): string {
  const lines: string[] = [];
  const push = (t?: string) => { const s = strip(t); if (s) lines.push(s); };
  push(a.headline ?? a.title);
  push(a.insight);
  (a.metrics ?? []).forEach((m) => push(`${m.label}: ${m.value}${m.delta ? ` (${m.delta})` : ''}`));
  if (a.table) {
    push(a.table.cols.join(' · '));
    a.table.rows.forEach((r) => push(r.join(' · ')));
  }
  (a.kv ?? []).forEach((k) => push(`${k.label}: ${k.value}`));
  push(a.text);
  (a.fields ?? []).forEach((f) => push(`${f.label}: ${f.value}${f.inferred ? ' (inferred)' : ''}`));
  push(a.aside);
  if (a.recommendation) push(`Recommended: ${strip(a.recommendation)}`);
  return lines.join('\n');
}

/** The representations THIS answer can take — empty when it has no visual at all. */
function visualOptions(a: AnswerObject): Array<{ id: AnswerVisual; label: string }> {
  if (a.table) return [{ id: 'default', label: 'Table' }, { id: 'cards', label: 'Summary cards' }];
  if (a.metrics?.length) return [{ id: 'default', label: 'Summary cards' }, { id: 'table', label: 'Table' }];
  return [];
}

export function ResponseUtilityBar({
  answer: a, sourceLabels, view, onAction, onOpenSources, onExpandEvidence, onRegenerate, onMenuItem,
}: {
  answer: AnswerObject;
  /** What the investigation actually read — `evidenceOf`'s labels. The count shown, and what
   *  Double-check verifies the answer's claims against. */
  sourceLabels: string[];
  view: AnswerView;
  /** Applied AFTER the working beat — the parent owns the view state. */
  onAction: (action: UtilityAction) => void;
  onOpenSources: () => void;
  /** "View sources" in the menu: expand the evidence fold in place (Part 4), rather than the
   *  drawer the count button opens. */
  onExpandEvidence?: () => void;
  /** Regenerate: genuinely re-run this turn's question in place. */
  onRegenerate?: () => void;
  /** An authored type-specific item was chosen (Copy * is handled here first). */
  onMenuItem?: (label: string) => void;
}) {
  const sourcesCount = sourceLabels.length;
  const [copied, setCopied] = useState(false);
  const [vote, setVote] = useState<'up' | 'down' | null>(null);
  const [flagged, setFlagged] = useState(false);
  /** The double-check's outcome — a REAL derived verification, see doubleCheck(). */
  const [checked, setChecked] = useState<null | { ok: boolean; claims: number }>(null);
  const [menu, setMenu] = useState<'closed' | 'root' | 'visual'>('closed');
  const [working, setWorking] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const moreRef = useRef<HTMLButtonElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  /* Outside click closes; Escape closes and hands focus back to the trigger. */
  useEffect(() => {
    if (menu === 'closed') return;
    const down = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setMenu('closed');
    };
    document.addEventListener('mousedown', down);
    return () => document.removeEventListener('mousedown', down);
  }, [menu]);

  useEffect(() => {
    if (menu !== 'closed') listRef.current?.querySelector('button')?.focus();
  }, [menu]);

  const copy = async () => {
    try { await navigator.clipboard?.writeText(answerToText(a)); } catch { /* jsdom / denied */ }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  /* DOUBLE-CHECK — not theatre: it re-derives the claim → source mapping the answer rests on.
     Every inline citation and every based-on label must name a source some completed check
     actually read; the honesty this module enforces at author time, verified again on demand. */
  const doubleCheck = () => {
    setMenu('closed');
    setWorking(true);
    window.setTimeout(() => {
      setWorking(false);
      const known = new Set(sourceLabels);
      /* Deduped — a source cited inline AND named in basedOn is one claim, not two. */
      const claims = [...new Set([...citationOrder(a), ...(a.basedOn ?? [])])];
      setChecked({ ok: claims.every((l) => known.has(l)), claims: claims.length });
    }, ACK_MS);
  };

  const flag = () => {
    setMenu('closed');
    setFlagged(true);
    toast('Flagged for review — thanks, this helps improve Nova');
  };

  const run = (action: UtilityAction) => {
    setMenu('closed');
    setWorking(true);
    window.setTimeout(() => {
      setWorking(false);
      onAction(action);
    }, ACK_MS);
  };

  /* Regenerate genuinely re-runs the turn's question in place when the parent wired it;
     the honest toast is only the fallback for a mount with no retry seam. */
  const regenerate = () => {
    setMenu('closed');
    if (onRegenerate) { onAction({ kind: 'regenerate' }); onRegenerate(); return; }
    run({ kind: 'regenerate' });
    window.setTimeout(
      () => toast('Regenerated — this prototype’s answers are scripted, so the result is identical'),
      ACK_MS,
    );
  };

  /* An authored type-specific item. Copy-anything is a real copy; the rest is the parent's. */
  const authored = (label: string) => {
    setMenu('closed');
    if (/^Copy/i.test(label)) { void copy(); return; }
    onMenuItem?.(label);
  };

  const menuKeys = (e: React.KeyboardEvent) => {
    const items = [...(listRef.current?.querySelectorAll('button:not(:disabled)') ?? [])] as HTMLButtonElement[];
    const i = items.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === 'Escape') { e.stopPropagation(); setMenu('closed'); moreRef.current?.focus(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length]?.focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length]?.focus(); }
    else if (e.key === 'Home') { e.preventDefault(); items[0]?.focus(); }
    else if (e.key === 'End') { e.preventDefault(); items[items.length - 1]?.focus(); }
  };

  const visuals = visualOptions(a);
  /* The authored top group, minus anything that belongs to the common group below. */
  const specific = (a.menu ?? []).filter((l) => !/^(Regenerate|View sources|Flag)/i.test(l));
  const item = 'nova-btn flex w-full items-center gap-2 px-3 py-1.5 text-left ask-text-sm text-[var(--nova-ink)] hover:bg-[#F3F6FA] disabled:opacity-40 disabled:hover:bg-transparent';
  const iconBtn = 'nova-btn nova-btn-icon nova-hit flex size-7 items-center justify-center rounded';

  return (
    <div
      className="border-t border-[var(--nova-rule)]"
      style={{ marginTop: 16, paddingTop: 8 }}
      data-utility-bar
    >
      <div className="flex flex-wrap items-center gap-1">
      {/* LEFT — consume the response */}
      <button type="button" className={iconBtn} aria-label="Copy response" title="Copy response" onClick={copy}>
        {copied
          ? <Check size={13} className="text-[#12805C]" aria-hidden="true" />
          : <Copy size={13} aria-hidden="true" />}
      </button>
      <button
        type="button"
        className={iconBtn}
        aria-label="Share"
        title="Share"
        onClick={() => toast('Share — conversations aren’t shareable in this prototype')}
      >
        <Share2 size={13} aria-hidden="true" />
      </button>

      <span className="flex-1" />

      {/* RIGHT — provenance, feedback, controls */}
      {working && <span className="nova-t-meta mr-1" data-working>Updating…</span>}
      {sourcesCount > 0 && (
        <button
          type="button"
          className="nova-btn nova-hit nova-tertiary"
          onClick={onOpenSources}
          data-sources-count
        >
          {sourcesCount} source{sourcesCount === 1 ? '' : 's'}
        </button>
      )}
      <button
        type="button"
        className={iconBtn}
        aria-label="Helpful"
        title="Helpful"
        aria-pressed={vote === 'up'}
        onClick={() => setVote((v) => (v === 'up' ? null : 'up'))}
      >
        <ThumbsUp size={13} aria-hidden="true" className={vote === 'up' ? 'text-[var(--nova-primary)]' : ''} />
      </button>
      <button
        type="button"
        className={iconBtn}
        aria-label="Not helpful"
        title="Not helpful"
        aria-pressed={vote === 'down'}
        onClick={() => setVote((v) => (v === 'down' ? null : 'down'))}
      >
        <ThumbsDown size={13} aria-hidden="true" className={vote === 'down' ? 'text-[var(--nova-primary)]' : ''} />
      </button>

      <div ref={wrapRef} className="relative">
        <button
          ref={moreRef}
          type="button"
          className={iconBtn}
          aria-label="More"
          title="More"
          aria-haspopup="menu"
          aria-expanded={menu !== 'closed'}
          disabled={working}
          onClick={() => setMenu((m) => (m === 'closed' ? 'root' : 'closed'))}
        >
          <MoreHorizontal size={14} aria-hidden="true" />
        </button>

        {menu !== 'closed' && (
          <div
            ref={listRef}
            role="menu"
            aria-label="Response controls"
            onKeyDown={menuKeys}
            className="absolute bottom-full right-0 z-10 mb-1 w-52 rounded-lg border border-[var(--nova-rule)] bg-white py-1 shadow-lg"
            data-more-menu
          >
            {menu === 'root' ? (
              <>
                {/* TYPE-SPECIFIC top group — authored per answer. Anything naming the common
                    group is filtered out so a case cannot list Regenerate twice. */}
                {specific.map((label) => (
                  <button key={label} type="button" role="menuitem" className={item}
                    onClick={() => authored(label)}
                  >{label}</button>
                ))}
                {specific.length > 0 && (
                  <div className="my-1 border-t border-[var(--nova-rule)]" aria-hidden="true" />
                )}

                {/* COMMON group — on every response. */}
                <button type="button" role="menuitem" className={item} onClick={regenerate}>
                  Regenerate response
                </button>
                {visuals.length > 0 && (
                  <button type="button" role="menuitem" className={item} onClick={() => setMenu('visual')}>
                    <BarChart3 size={12} aria-hidden="true" className="text-[var(--nova-ink-muted)]" />
                    Change visual
                  </button>
                )}
                {sourcesCount > 0 && (
                  <button type="button" role="menuitem" className={item} onClick={doubleCheck}>
                    <ShieldCheck size={12} aria-hidden="true" className="text-[var(--nova-ink-muted)]" />
                    Double-check response
                  </button>
                )}
                {sourcesCount > 0 && (
                  <button type="button" role="menuitem" className={item}
                    onClick={() => { setMenu('closed'); (onExpandEvidence ?? onOpenSources)(); }}
                  >View sources</button>
                )}
                <button type="button" role="menuitem" className={item} disabled={flagged} onClick={flag}>
                  <Flag size={12} aria-hidden="true" className="text-[var(--nova-ink-muted)]" />
                  {flagged ? 'Flagged for review' : 'Flag this response'}
                </button>
              </>
            ) : (
              <>
                <button type="button" className={`${item} text-[var(--nova-ink-muted)]`} onClick={() => setMenu('root')}>
                  <ChevronLeft size={12} aria-hidden="true" />
                  Change visual
                </button>
                <div className="my-1 border-t border-[var(--nova-rule)]" aria-hidden="true" />
                {visuals.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    role="menuitemradio"
                    aria-checked={view.visual === v.id}
                    className={item}
                    onClick={() => (view.visual === v.id ? setMenu('closed') : run({ kind: 'visual', visual: v.id }))}
                  >
                    <span className="flex size-3 items-center justify-center" aria-hidden="true">
                      {view.visual === v.id && <Check size={12} className="text-[var(--nova-primary)]" />}
                    </span>
                    {v.label}
                  </button>
                ))}
              </>
            )}
          </div>
        )}
      </div>
      </div>

      {/* The double-check's verdict — derived above, stated here, never a bare "looks good". */}
      {checked && (
        <p className="nova-t-meta mt-1.5 flex items-start gap-1.5" role="status" data-doublecheck>
          {checked.ok ? (
            <>
              <span className="flex-shrink-0 text-[#12805C]" aria-hidden="true">✓</span>
              <span>
                Double-checked — {checked.claims === 0
                  ? `the answer rests on ${sourcesCount} source${sourcesCount === 1 ? '' : 's'} Nova read directly`
                  : `all ${checked.claims} cited claim${checked.claims === 1 ? '' : 's'} trace to sources Nova read`}.
              </span>
            </>
          ) : (
            <>
              <span className="flex-shrink-0 text-[#B98900]" aria-hidden="true">⚠</span>
              <span>Double-checked — some claims could not be traced to a source. Review the evidence before relying on them.</span>
            </>
          )}
        </p>
      )}
    </div>
  );
}
