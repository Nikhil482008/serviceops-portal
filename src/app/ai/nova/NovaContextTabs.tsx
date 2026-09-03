import { useMemo, useState } from 'react';
import { ChevronDown, Search, Ticket, BookOpen, FileText, Database } from 'lucide-react';
import type { StepSource } from './novaStream';
import type { Turn } from './turnModel';

/* CONTEXT — what Nova produced, and what it read to produce it.
 *
 * Two tabs over one turn:
 *   Outputs  every fact a check landed on, plus every finding. The thinking, distilled.
 *   Sources  every record, article, document and dataset those checks actually read.
 *
 * ── WHY THIS IS NOT A SECOND COPY OF THE TRAIL ───────────────────────────────────────────────
 * The chapters above are CHRONOLOGICAL — they tell the story of the investigation, and they are
 * meant to be watched. This is a REFERENCE — flat, searchable, and read after the fact by someone
 * checking the work. Same data, two jobs. Which is why the trail keeps the verbs ("Measuring SLA
 * clocks") and this keeps only what came out of them ("6 inside two hours of breach"): a
 * reference that repeats the narration is just the narration again.
 *
 * ⚠️ Sources are AUTHORED PER CHECK in the script, never derived from the label. Inferring that a
 * step called "Reading the handover" read a document called "handover" works right until a check
 * reads three things or none, and then the panel is confidently wrong about where an answer came
 * from — which is the one thing a source list exists to prevent.
 */

const KIND_ICON = {
  ticket: Ticket,
  kb: BookOpen,
  doc: FileText,
  data: Database,
} as const;

const KIND_LABEL = {
  ticket: 'Record',
  kb: 'Knowledge',
  doc: 'Document',
  data: 'Data',
} as const;

export function NovaContextTabs({ turn }: { turn: Turn }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'outputs' | 'sources'>('outputs');
  const [q, setQ] = useState('');
  const [searching, setSearching] = useState(false);

  /* Only the checks that produced something. A check with no result contributed to the story but
     has nothing to put in a reference list. */
  const outputs = useMemo(
    () => turn.steps.filter((s) => s.status === 'complete' && s.metric),
    [turn.steps],
  );

  /* Deduped by label: two checks reading INC-4390 read ONE thing, and listing it twice would
     inflate the count that sits in the header. */
  const sources = useMemo(() => {
    const seen = new Map<string, StepSource>();
    turn.steps.forEach((s) => {
      if (s.status !== 'complete') return;
      s.sources?.forEach((src) => { if (!seen.has(src.label)) seen.set(src.label, src); });
    });
    return [...seen.values()];
  }, [turn.steps]);

  const total = outputs.length + turn.discoveries.length;
  if (!total && !sources.length) return null;

  const term = q.trim().toLowerCase();
  const shownSources = term
    ? sources.filter((s) => s.label.toLowerCase().includes(term))
    : sources;
  const shownOutputs = term
    ? outputs.filter((s) => `${s.metric?.value} ${s.metric?.label}`.toLowerCase().includes(term))
    : outputs;
  const shownFindings = term
    ? turn.discoveries.filter((d) => `${d.headline} ${d.detail}`.toLowerCase().includes(term))
    : turn.discoveries;

  return (
    <section className="mt-4 rounded-lg border border-[#EEF2F6] bg-[#FBFCFD]">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-1.5 rounded-lg px-3 py-2 text-left transition-colors hover:bg-[#F5F7FA]"
      >
        <span className="text-[12px] font-semibold text-[#364658]">Context</span>
        <span className="text-[11px] text-[#9CA3AF]">
          {total} output{total === 1 ? '' : 's'} · {sources.length} source{sources.length === 1 ? '' : 's'}
        </span>
        <ChevronDown
          size={14}
          className={`ml-auto text-[#9CA3AF] transition-transform ${open ? '' : '-rotate-90'}`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div className="px-3 pb-3">
          {/* Two tabs, not two panels stacked. The reader is answering one of two questions —
              "what did it conclude" or "what did it look at" — and showing both at once makes
              them scroll past the one they did not ask. */}
          <div role="tablist" aria-label="Context" className="flex rounded-lg bg-[#F1F5F9] p-0.5">
            {(['outputs', 'sources'] as const).map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
                className={`flex-1 rounded-[6px] px-2 py-1 text-[12px] font-medium capitalize transition-colors ${
                  tab === t ? 'bg-white text-[#364658] shadow-sm' : 'text-[#7B8FA5] hover:text-[#364658]'}`}
              >{t}</button>
            ))}
          </div>

          <div className="mt-2 flex items-center gap-2">
            <span className="text-[11px] text-[#9CA3AF]">
              {tab === 'sources'
                ? `${shownSources.length} source${shownSources.length === 1 ? '' : 's'}`
                : `${shownOutputs.length + shownFindings.length} item${shownOutputs.length + shownFindings.length === 1 ? '' : 's'}`}
            </span>
            {searching ? (
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onBlur={() => { if (!q) setSearching(false); }}
                placeholder="Search context…"
                aria-label="Search context"
                className="ml-auto min-w-0 flex-1 bg-transparent text-[12px] text-[#364658] placeholder:text-[#B6C1CE] focus:outline-none"
              />
            ) : (
              <button
                type="button"
                onClick={() => setSearching(true)}
                aria-label="Search context"
                className="ml-auto flex size-6 items-center justify-center rounded text-[#9CA3AF] transition-colors hover:bg-[#F1F5F9] hover:text-[#364658]"
              ><Search size={13} /></button>
            )}
          </div>

          <div role="tabpanel" className="mt-1.5 max-h-[220px] space-y-1 overflow-y-auto">
            {tab === 'outputs' ? (
              <>
                {shownFindings.map((d) => (
                  <div key={d.id} className="rounded px-1.5 py-1">
                    <p className="text-[12px] font-semibold leading-[1.4] text-[#364658]">{d.headline}</p>
                    <p className="text-[11px] leading-[1.45] text-[#9CA3AF]">{d.detail}</p>
                  </div>
                ))}
                {shownOutputs.map((s) => (
                  <p key={s.id} className="px-1.5 py-1 text-[12px] text-[#7B8FA5]">
                    <b className="font-semibold text-[#364658]">{s.metric!.value}</b> {s.metric!.label}
                  </p>
                ))}
                {!shownFindings.length && !shownOutputs.length && <Empty q={q} />}
              </>
            ) : (
              <>
                {shownSources.map((src) => {
                  const Icon = KIND_ICON[src.kind];
                  return (
                    <div key={src.label} className="flex items-center gap-2 rounded px-1.5 py-1">
                      <span className="flex size-5 flex-shrink-0 items-center justify-center rounded bg-[#EFF4FA] text-[#7B9AC0]">
                        <Icon size={11} />
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[12px] text-[#364658]">{src.label}</span>
                      <span className="flex-shrink-0 text-[10px] uppercase tracking-wider text-[#B6C1CE]">
                        {KIND_LABEL[src.kind]}
                      </span>
                    </div>
                  );
                })}
                {!shownSources.length && <Empty q={q} />}
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function Empty({ q }: { q: string }) {
  return (
    <p className="px-1.5 py-3 text-center text-[11px] text-[#B6C1CE]">
      {q ? `Nothing matches “${q}”` : 'Nothing here yet'}
    </p>
  );
}
