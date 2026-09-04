import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, ExternalLink, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  AUTHORITY_LABEL, evidenceOf, sourceAuthority,
  type FeedDiscovery, type Turn,
} from '../turnModel';
import type { StepSource } from '../scripts/registry';

/* THE EVIDENCE DRAWER — level 3 of the trust ladder.
 *
 * The conversation stays lightweight; anything deeper than the strip and the fold happens here,
 * in a sheet that slides OVER the chat rather than navigating away from it. The one action that
 * intentionally leaves the conversation is "Open original" on a source — everything else keeps
 * the reader exactly where they were.
 *
 * ── CLAIM → SOURCE, NOT CLAIM → LIST ─────────────────────────────────────────────────────────
 * Opened from an inline citation or a Based-on chip, the drawer arrives already on the Sources
 * tab, scrolled to and highlighting that specific source. A reader checking one claim must never
 * be handed the whole pile and told to find it themselves.
 *
 * ── EVERYTHING IS DERIVED ────────────────────────────────────────────────────────────────────
 * Findings are the turn's discoveries; sources are what completed checks read; a finding's
 * "Supported by" is authored beside the finding in the script. This component holds no data of
 * its own — it is a window onto `evidenceOf`, the same view the strip and the fold read.
 */

/** WHAT KIND OF TRUTH a source is. Shown only where it materially helps — the drawer and the
 *  finding meta — never stamped on every chip in the chat. */
export function NovaSourceType({ source }: { source: StepSource }) {
  const auth = sourceAuthority(source);
  return (
    <span className="nova-ev-type" data-authority={auth}>{AUTHORITY_LABEL[auth]}</span>
  );
}

/** HOW OLD it is. Operational data ages; a source that says "Updated 3h ago" has told the
 *  reader something a bare label cannot. Renders nothing when the script authored nothing —
 *  a guessed freshness would be fabrication. */
export function NovaSourceFreshness({ source }: { source: StepSource }) {
  if (!source.freshness) return null;
  return <span className="nova-ev-fresh">{source.freshness}</span>;
}

/** One source: what it is, how authoritative, how fresh, what it currently holds — enough to
 *  verify WITHOUT opening the original, which stays one deliberate click further. */
export function NovaSource({ source, focused, refCb }: {
  source: StepSource;
  focused: boolean;
  refCb?: (el: HTMLLIElement | null) => void;
}) {
  return (
    <li ref={refCb} className="nova-ev-row" data-focused={focused ? 'true' : 'false'}>
      <div className="min-w-0 flex-1">
        <p className="nova-ev-label">{source.label}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <NovaSourceType source={source} />
          <NovaSourceFreshness source={source} />
        </p>
        {source.detail && <p className="nova-ev-detail">{source.detail}</p>}
      </div>
      <button
        type="button"
        className="nova-btn nova-hit nova-tertiary flex-shrink-0"
        /* The ONE action that leaves the conversation — and in this prototype the records are
           not wired, which the toast says plainly rather than pretending. */
        onClick={() => toast(`Opening ${source.label} — records are not wired in this prototype`)}
      >
        <ExternalLink size={11} aria-hidden="true" />
        Open original
      </button>
    </li>
  );
}

/** One finding: the claim, its strength IN WORDS, and the sources that support it. An inference
 *  is labelled as Nova's conclusion — a reader must never mistake it for a record state. */
export function NovaFinding({ finding, onJump }: {
  finding: FeedDiscovery;
  /** Jump to a supporting source on the Sources tab. */
  onJump: (label: string) => void;
}) {
  return (
    <li className="nova-ev-find">
      <p className="nova-t-body flex items-start gap-2">
        <span className="mt-[1px] flex-shrink-0 ask-text-sm text-[#12805C]" aria-hidden="true">✓</span>
        <span className="min-w-0">
          <span className="ask-w-500 text-[var(--nova-ink)]">{finding.headline}</span>
          {finding.inference && <span className="nova-ev-type ml-2" data-authority="inference">AI inference</span>}
        </span>
      </p>
      {finding.basis && <p className="nova-ev-basis">{finding.basis}</p>}
      {!!finding.support?.length && (
        <p className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <span className="nova-t-meta">Supported by</span>
          {finding.support.map((label) => (
            <button key={label} type="button" className="nova-src nova-src-btn" onClick={() => onJump(label)}>
              {label}
            </button>
          ))}
        </p>
      )}
    </li>
  );
}

const KIND_FILTERS: Array<{ id: StepSource['kind'] | 'all'; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'ticket', label: 'Tickets' },
  { id: 'kb', label: 'Knowledge' },
  { id: 'doc', label: 'Documents' },
  { id: 'data', label: 'Data' },
];

export function NovaEvidenceDrawer({ turn, focus, onClose }: {
  turn: Turn;
  /** A source label to arrive on — set by a citation or a Based-on chip. */
  focus?: string;
  onClose: () => void;
}) {
  const ev = evidenceOf(turn);
  const [tab, setTab] = useState<'findings' | 'sources'>(focus ? 'sources' : 'findings');
  const [picked, setPicked] = useState<string | null>(focus ?? null);
  const [q, setQ] = useState('');
  const [kind, setKind] = useState<StepSource['kind'] | 'all'>('all');
  const rowRefs = useRef<Record<string, HTMLLIElement | null>>({});
  const closeRef = useRef<HTMLButtonElement | null>(null);

  /* CLAIM → SOURCE: land on the Sources tab, scrolled to the cited record. */
  useEffect(() => {
    if (!picked) return;
    const el = rowRefs.current[picked];
    if (el?.scrollIntoView) el.scrollIntoView({ block: 'center' });
  }, [picked, tab]);

  useEffect(() => {
    closeRef.current?.focus();
    /* CAPTURE phase, and the event is swallowed: the Nova drawer closes itself on Escape too,
       and without this one keypress would dismiss BOTH layers - the sheet the reader meant to
       close and the conversation they meant to keep. */
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      e.preventDefault();
      onClose();
    };
    window.addEventListener('keydown', key, true);
    return () => window.removeEventListener('keydown', key, true);
  }, [onClose]);

  const jump = (label: string) => { setTab('sources'); setPicked(label); };

  const term = q.trim().toLowerCase();
  const filtered = useMemo(() => ev.sources.filter((s) => (
    (kind === 'all' || s.kind === kind)
    && (!term || `${s.label} ${s.detail ?? ''}`.toLowerCase().includes(term))
  )), [ev.sources, kind, term]);

  const kindsPresent = new Set(ev.sources.map((s) => s.kind));

  /* PORTALED to <body>: rendered in place, the sheet lives inside the Nova drawer's stacking
     context (fixed + z-index), so no z-index of its own could lift it above the orb layer —
     the orb's halo bled through the header. At the root its z-index actually competes. */
  return createPortal(
    <aside
      className="nova-ev-sheet"
      role="dialog"
      aria-modal="true"
      aria-label="Evidence for this answer"
      data-evidence-drawer
    >
      <header className="flex items-start gap-2 border-b border-[var(--nova-rule)] px-4 py-3">
        <button
          type="button"
          aria-label="Back to conversation"
          onClick={onClose}
          className="nova-btn nova-btn-icon -ml-1 flex size-8 flex-shrink-0 items-center justify-center rounded"
        >
          <ArrowLeft size={15} aria-hidden="true" />
        </button>
        <div className="min-w-0 flex-1">
          <h3 className="ask-text-base ask-w-600 text-[var(--nova-ink)]">Evidence for this answer</h3>
          {/* Human words, deliberately — "outputs" is an internal concept nobody asked for. */}
          <p className="nova-t-meta mt-0.5">
            {ev.findings.length} key finding{ev.findings.length === 1 ? '' : 's'}
            {' · '}{ev.sources.length} source{ev.sources.length === 1 ? '' : 's'}
          </p>
        </div>
        <button
          ref={closeRef}
          type="button"
          aria-label="Close evidence"
          onClick={onClose}
          className="nova-btn nova-btn-icon flex size-8 items-center justify-center rounded"
        >
          <X size={15} aria-hidden="true" />
        </button>
      </header>

      <div role="tablist" aria-label="Evidence" className="flex gap-1 border-b border-[var(--nova-rule)] px-4 pt-2">
        {(['findings', 'sources'] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className="nova-ev-tab"
            data-active={tab === t ? 'true' : 'false'}
          >
            {t === 'findings' ? `Findings (${ev.findings.length})` : `Sources (${ev.sources.length})`}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {tab === 'findings' ? (
          ev.findings.length ? (
            <ul className="space-y-4">
              {ev.findings.map((f) => <NovaFinding key={f.id} finding={f} onJump={jump} />)}
            </ul>
          ) : (
            <p className="nova-t-meta">No findings were recorded for this answer.</p>
          )
        ) : (
          <>
            <div className="flex items-center gap-2 rounded border border-[var(--nova-rule)] px-2">
              <Search size={12} className="flex-shrink-0 text-[var(--nova-ink-faint)]" aria-hidden="true" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search sources…"
                className="h-8 w-full bg-transparent ask-text-sm text-[var(--nova-ink)] outline-none placeholder:text-[var(--nova-ink-faint)]"
              />
            </div>
            {kindsPresent.size > 1 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {KIND_FILTERS.filter((f) => f.id === 'all' || kindsPresent.has(f.id)).map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    className="nova-ev-filter"
                    data-active={kind === f.id ? 'true' : 'false'}
                    aria-pressed={kind === f.id}
                    onClick={() => setKind(f.id)}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            )}
            {filtered.length ? (
              <ul className="mt-3 space-y-2">
                {filtered.map((s) => (
                  <NovaSource
                    key={s.label}
                    source={s}
                    focused={picked === s.label}
                    refCb={(el) => { rowRefs.current[s.label] = el; }}
                  />
                ))}
              </ul>
            ) : (
              <p className="nova-t-meta mt-3">No sources match.</p>
            )}
          </>
        )}
      </div>
    </aside>,
    document.body,
  );
}
