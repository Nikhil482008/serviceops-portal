import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { AnswerObject } from '../scripts/registry';

/* INLINE CITATIONS — a claim that can be checked carries the number of the source that checks
 * it.
 *
 * ── AUTHORED, NOT DETECTED ───────────────────────────────────────────────────────────────────
 * A citation is a `[[source label]]` token written in the script, beside the claim it supports —
 * never inferred from the prose. Detection would eventually cite the wrong source, and a wrong
 * citation is worse than none: it teaches the reader that the numbers mean nothing.
 *
 * ── NUMBERED BY APPEARANCE ───────────────────────────────────────────────────────────────────
 * `citationOrder` scans the answer's fields in their RENDER order, so [1] is always the first
 * marker the reader meets. The numbering is derived at render from the answer object — there is
 * no second list to keep in step with the text.
 *
 * ── CONTEXT, NOT PROPS ───────────────────────────────────────────────────────────────────────
 * `Emph` renders inside a dozen blocks. Threading an onCite through every one of them would touch
 * every block signature for one feature; a context lets any emphasised text resolve its markers,
 * and text rendered OUTSIDE a provider simply drops the tokens — so a stray citation in a script
 * can never render as literal brackets.
 */

interface CitationApi {
  /** 1-based number for a source label; 0 if the label is not cited in this answer. */
  indexOf(label: string): number;
  /** Open the evidence drawer focused on this source. */
  open(label: string): void;
}

const Ctx = createContext<CitationApi | null>(null);

/** Every cited label, in the order the reader meets them. Fields are scanned in AnswerBlock's
 *  own render order, which is what makes the numbering match the page. */
export function citationOrder(a: AnswerObject): string[] {
  const texts: Array<string | undefined> = [
    a.headline, a.insight,
    ...(a.kv?.map((k) => k.value) ?? []),
    a.text, a.aside, a.recommendation,
  ];
  const order: string[] = [];
  texts.forEach((t) => {
    if (!t) return;
    for (const m of String(t).matchAll(/\[\[([^\]]+)\]\]/g)) {
      if (!order.includes(m[1])) order.push(m[1]);
    }
  });
  return order;
}

export function CitationProvider({ answer, onOpen, children }: {
  answer: AnswerObject;
  onOpen: (label: string) => void;
  children: ReactNode;
}) {
  const order = useMemo(() => citationOrder(answer), [answer]);
  const api = useMemo<CitationApi>(() => ({
    indexOf: (label) => order.indexOf(label) + 1,
    open: onOpen,
  }), [order, onOpen]);
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export const useCitations = (): CitationApi | null => useContext(Ctx);

/** The marker itself: a small numbered chip after the claim. CLAIM → SOURCE is one click — it
 *  opens the evidence drawer already focused on the right record, never a generic list. */
export function NovaInlineCitation({ label }: { label: string }) {
  const ctx = useCitations();
  if (!ctx) return null;
  const n = ctx.indexOf(label);
  if (!n) return null;
  return (
    <button
      type="button"
      className="nova-cite"
      data-cite={label}
      aria-label={`Source ${n}: ${label}`}
      onClick={(e) => { e.stopPropagation(); ctx.open(label); }}
    >
      {n}
    </button>
  );
}
