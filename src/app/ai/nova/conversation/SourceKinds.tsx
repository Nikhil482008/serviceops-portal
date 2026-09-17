import { BookOpen, Database, FileText, Ticket, type LucideIcon } from 'lucide-react';
import type { StepSource } from '../scripts/registry';

/* WHAT KIND OF RECORDS THIS ANSWER RESTS ON — a small stack of marks in front of the count.
 *
 *     ⊙⊙⊙  17 sources
 *
 * ── WHY A COUNT ALONE WAS NOT ENOUGH ─────────────────────────────────────────────────────────
 * "17 sources" is a quantity, and a quantity is the least interesting thing about evidence.
 * Seventeen knowledge articles and seventeen live ticket records are very different grounds for
 * the same sentence, and the reader deciding whether to trust an answer wants the SECOND fact
 * first. One mark per kind present says it before the number does, in the width of three
 * characters.
 *
 * ── DERIVED, AND HONEST ──────────────────────────────────────────────────────────────────────
 * The marks are read off the sources themselves — one per DISTINCT kind, in the order the model
 * declares them, so the row cannot claim a kind the answer did not read. There are four kinds,
 * so there is no "+2 more" case to design and no cap to tune: at most four marks, always.
 *
 * ⚠️ NOT FAVICONS, AND DELIBERATELY NOT BRANDED. The reference for this is a row of coloured
 * product logos, which works when the sources are public websites. These are internal records —
 * a ticket, an approved KB article, a document, a data source — and they have no logos. Colour
 * here would have to be invented, and invented colour on a TRUST surface is the one place it
 * must not be. So the marks are the module's own ink on its own hairline, and the thing that
 * makes them read as premium is precision: one ring weight, one glyph size, a 5px overlap, and
 * they darken with the control they sit in.
 *
 * ── SAID OUT LOUD ────────────────────────────────────────────────────────────────────────────
 * The marks are `aria-hidden`; the caller pairs them with `sourceKindSentence`, which spells the
 * same fact ("12 tickets, 4 knowledge articles, 1 document") for a screen reader. A glyph a
 * listener cannot hear is decoration, and this is not decoration.
 */

/** The four kinds, in the order `StepSource` declares them — so the marks never reorder between
 *  two answers that happen to have read their sources in a different sequence. */
const KIND_ORDER: Array<StepSource['kind']> = ['ticket', 'kb', 'doc', 'data'];

/** ONE MAP. The marks in front of the source count and the filter pills in the evidence drawer
 *  are the same four kinds, and a kind that looked like a ticket in one place and a page in the
 *  other would be two vocabularies for one idea. Exported so there is nothing to keep in step. */
export const KIND_ICON: Record<StepSource['kind'], LucideIcon> = {
  ticket: Ticket,
  kb: BookOpen,
  doc: FileText,
  data: Database,
};

/** Singular / plural, for the spoken version and the tooltip. */
const KIND_NOUN: Record<StepSource['kind'], [string, string]> = {
  ticket: ['ticket', 'tickets'],
  kb: ['knowledge article', 'knowledge articles'],
  doc: ['document', 'documents'],
  data: ['data source', 'data sources'],
};

/** How many of each kind, in declaration order, kinds with none dropped. */
export function sourceKindCounts(sources: StepSource[]): Array<{ kind: StepSource['kind']; n: number }> {
  const by = new Map<StepSource['kind'], number>();
  sources.forEach((s) => by.set(s.kind, (by.get(s.kind) ?? 0) + 1));
  return KIND_ORDER.filter((k) => by.has(k)).map((k) => ({ kind: k, n: by.get(k)! }));
}

/** "12 tickets, 4 knowledge articles and 1 document" — the marks, spelled. */
export function sourceKindSentence(sources: StepSource[]): string {
  const parts = sourceKindCounts(sources)
    .map(({ kind, n }) => `${n} ${KIND_NOUN[kind][n === 1 ? 0 : 1]}`);
  if (parts.length <= 1) return parts.join('');
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

/** The stack. Decorative on its own — always render `sourceKindSentence` beside it, usually as
 *  `sr-only` text inside the same control. */
export function SourceKinds({ sources }: { sources: StepSource[] }) {
  const kinds = sourceKindCounts(sources);
  if (!kinds.length) return null;
  return (
    <span className="nova-src-kinds" aria-hidden="true" data-source-kinds={kinds.length}>
      {kinds.map(({ kind, n }) => {
        const Icon = KIND_ICON[kind];
        return (
          <span
            key={kind}
            className="nova-src-kind"
            data-kind={kind}
            /* A pointer that stops on the stack gets the breakdown without opening anything. */
            title={`${n} ${KIND_NOUN[kind][n === 1 ? 0 : 1]}`}
          >
            <Icon size={9} strokeWidth={2} aria-hidden="true" />
          </span>
        );
      })}
    </span>
  );
}
