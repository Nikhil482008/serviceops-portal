import type { AnswerObject, JargonPair, RequesterBlock } from '../scripts/registry';
import { getDraft, getKb, getTicket, type MockDraft } from '../mockTickets';
import { statusPlainLines } from './statusSentences';
import { buildHandover, handoverText } from './TechnicianBlocks';

/* The blocks as PLAIN TEXT — what "Copy talking points", "Copy resolution steps" and the
 * utility bar's Copy actually put on the clipboard. Derived from the same descriptors and the
 * same store the screen reads, so the copied text cannot disagree with the rendered card. */

const plainRefs = (s: string) => s.replace(/\[((?:INC|REQ|PRB|CHG|KB)-\d+)\]/g, '$1');

type NoteBlock = Extract<RequesterBlock, { w: 'note' }>;

/** TEC-05's draft: the authored tone, minus reverted simplifications, plus what a later chip
 *  appended — or exactly what the reader typed over it. */
export function composeDraftText(b: Pick<NoteBlock, 'tones' | 'tone' | 'prefill' | 'jargon'>, d: MockDraft): { tone: 'formal' | 'friendly' | 'shorter'; text: string } {
  const tone = d.tone ?? b.tone ?? 'formal';
  let base = b.tones?.[tone] ?? b.prefill;
  for (const term of d.reverted ?? []) {
    const p = (b.jargon as JargonPair[] | undefined)?.find((j) => j.term === term);
    if (p) base = base.replace(p.replacement, p.term);
  }
  const text = (d.edited ?? base) + (d.appended ? ` ${d.appended}` : '');
  return { tone, text };
}

export function blocksToText(a: AnswerObject): string[] {
  const out: string[] = [];
  for (const b of a.blocks ?? []) {
    switch (b.w) {
      case 'brief':
        out.push(`What's happening: ${b.what}`, `Impact: ${b.impact}`, `Status: ${b.status}`, `Say this: "${b.sayThis}"`);
        break;
      case 'facts':
        out.push('What we know:', ...b.facts.map((f) => `· ${plainRefs(f)}`),
          'What I recommend:', ...b.steps.map((s, i) => `${i + 1}. ${plainRefs(s)}`), b.confidence);
        break;
      case 'kb': {
        const kb = getKb(b.id);
        if (kb) out.push(`${kb.id} — ${kb.title}`, ...kb.steps.map((s, i) => `${i + 1}. ${s}`));
        break;
      }
      case 'note':
        out.push(b.draftId ? composeDraftText(b, getDraft(b.draftId)).text : b.prefill);
        break;
      case 'handover':
        out.push(handoverText(buildHandover({ note: getDraft(b.id).note })));
        break;
      case 'callout':
        out.push(plainRefs(b.text));
        break;
      /* THE CONSEQUENCE, which the callout used to contribute to the clipboard before it merged
         into the chart's insight line. The authored clause only — resolving the dataset here to
         copy the FACT as well would read the default grouping, and the reader may have changed
         it on screen; a copy that quietly disagrees with the card is worse than a short one. */
      case 'chart':
        if (b.soWhat) out.push(plainRefs(b.soWhat));
        break;
      case 'status': {
        /* The requester's status answer IS the three sentences - without this the clipboard got
           the turn's title and nothing else. The ref is resolved by the caller's block, so a
           '$question' block contributes nothing rather than a wrong ticket. */
        const t = getTicket(b.ref);
        if (t) out.push(...statusPlainLines(t));
        break;
      }
      default:
        break;
    }
  }
  return out;
}
