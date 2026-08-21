/* The mock transport. This is what ships.
 *
 * There is no backend anywhere in this repo — no fetch, no env, no streaming — so the whole
 * feature has to be demoable and testable with the service switched off. This adapter streams
 * canned answers at the same cadence the product already types at, and covers the paths that are
 * easy to forget: an action proposal, and an error.
 *
 * Answers are chosen by keyword against the question and the page context. That is a lookup, not
 * intelligence, and the copy says so where it matters — a mock that quietly invents CVE counts
 * teaches people to trust numbers nobody computed.
 */
import type { AiFrame, AiSendRequest, AiSuggestion } from '../types';
import { AI_TYPE_SPEED_MS } from '../timing';

/** Words per delta. Streaming a character at a time is what the ticket panel does and it costs a
 *  React commit per character; a word reads the same and is ~5× cheaper. */
const CHUNK = 3;

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException('Aborted', 'AbortError'));
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => { clearTimeout(t); reject(new DOMException('Aborted', 'AbortError')); }, { once: true });
  });

/* ── the canned answers ────────────────────────────────────────────────
 *
 * Written against the Vulnerabilities fixture, which is what this pass wires up. Each one names
 * where its numbers come from so a reader can tell derived from decorative.
 */

const A_SUMMARY = `Looking at the **20 rows on this page**:

- **4 are Critical** and between them touch 312 endpoints
- **9 are Important**, mostly Windows servicing-stack updates
- **7 are Moderate or Low**

The two worth doing first are the ones carrying exploited CVEs — see below.

> These counts come from the rows currently in view, not the whole catalogue.`;

const A_EXPLOITED = `**Two rows on this page carry a known-exploited CVE.**

| Patch | Severity | Exploited CVE | Endpoints |
| --- | --- | --- | --- |
| PCH-4811 | Critical | CVE-2024-38080 | 148 |
| PCH-4788 | Critical | CVE-2024-38112 | 164 |

Both are in CISA's Known Exploited Vulnerabilities catalogue, which is the reason to treat them
differently from a high CVSS score alone: a score predicts how bad exploitation *would* be,
whereas this says it *is happening*.

Suggested order: **PCH-4788 first** — wider blast radius at the same severity.`;

const A_REMEDIATION = `### Remediation plan — Windows patches

**1. Stage the two exploited-CVE patches**
Deploy PCH-4788 and PCH-4811 to a pilot ring first. Both require a reboot.

**2. Batch the servicing-stack updates**
Nine Important rows are SSUs. They supersede one another, so deploying only the newest of each
family is enough.

**3. Leave the Moderate and Low rows to the monthly window**
Nothing in that group is exploited or internet-facing.

\`\`\`text
Ring 1  (pilot, 24h)    PCH-4788, PCH-4811
Ring 2  (broad, 72h)    + the 9 Important SSUs
Ring 3  (monthly)       remainder
\`\`\`

I can apply a filter to show you just ring 1 — say the word.`;

const A_GROUP = `Grouped by affected product, the 20 rows fall out as:

- **Windows 11 servicing** — 8 rows
- **Windows Server** — 5 rows
- **Microsoft Edge** — 3 rows
- **Office / 365 Apps** — 2 rows
- **.NET runtime** — 2 rows

Windows 11 servicing is the biggest single group but carries none of the exploited CVEs.`;

const A_GENERIC = `I can help with what is on this page — summarising it, spotting the rows that
matter most, drafting a remediation plan, or grouping and filtering the table.

This build runs against **mock data with no AI service configured**, so my answers here are
scripted rather than generated. The wiring is real; the model is not connected yet.`;

const A_NOCONTEXT = `You've removed the page context, so I'm answering generally rather than about
the 20 rows in front of you.

Ask me about this page again by adding the context chip back above the composer.`;

const FOLLOWUPS: AiSuggestion[] = [
  { label: 'Show only exploited', prompt: 'Filter to just the rows with a known exploited CVE' },
  { label: 'Sort by endpoints', prompt: 'Sort these by impacted endpoints, most first' },
];

/* Keyword → answer. Ordered most-specific first, the same shape `aiWelcome` uses. */
const pick = (q: string, hasContext: boolean): { text: string; followUps?: AiSuggestion[] } => {
  const s = q.toLowerCase();
  if (!hasContext) return { text: A_NOCONTEXT };
  if (/exploit|kev|known.exploited|cisa/.test(s)) return { text: A_EXPLOITED, followUps: FOLLOWUPS };
  if (/remediat|plan|fix|patch.*plan|windows/.test(s)) return { text: A_REMEDIATION, followUps: FOLLOWUPS };
  if (/group|by product|affected product/.test(s)) return { text: A_GROUP };
  if (/summar|overview|critical|what.*here/.test(s)) return { text: A_SUMMARY, followUps: FOLLOWUPS };
  return { text: A_GENERIC };
};

/**
 * Streams a canned answer.
 *
 * Two demo hooks, deliberately reachable from the UI so the states that are easy to leave untested
 * can actually be seen:
 *   - a question containing "filter" proposes a `filterList` ACTION instead of prose
 *   - a question containing "fail" or "error" ends in an error frame
 */
export async function* mockStream(req: AiSendRequest): AsyncGenerator<AiFrame> {
  const last = [...req.messages].reverse().find((m) => m.role === 'user')?.text ?? '';
  const s = last.toLowerCase();

  /* Latency before the first token. Without it the typing indicator never renders and nobody
     finds out whether it works. */
  await sleep(420, req.signal);

  if (/\bfail\b|\berror\b|\bbreak\b/.test(s)) {
    yield { t: 'delta', text: 'Checking that for you…' };
    await sleep(500, req.signal);
    yield { t: 'error', code: 'rate_limited' };
    return;
  }

  const proposesAction = /\bfilter\b|\bshow only\b|\bnarrow\b/.test(s);

  if (proposesAction) {
    const lead = 'I can narrow the table to the rows carrying a known-exploited CVE.';
    for (const frame of chunks(lead)) { await sleep(AI_TYPE_SPEED_MS * CHUNK * 4, req.signal); yield frame; }
    await sleep(300, req.signal);
    yield {
      t: 'action',
      action: {
        id: `act-${req.messages.length}`,
        kind: 'filterList',
        payload: { field: 'exploitedCves', operator: 'isNotEmpty', value: [] },
      },
    };
    yield { t: 'done' };
    return;
  }

  const { text, followUps } = pick(last, !!req.context);
  for (const frame of chunks(text)) {
    await sleep(AI_TYPE_SPEED_MS * CHUNK * 4, req.signal);
    yield frame;
  }
  if (followUps) yield { t: 'followups', items: followUps };
  yield { t: 'done' };
}

/** Split into word-ish deltas, keeping the whitespace so the reassembled text is byte-identical
 *  to the source — a naive `split(' ')` loses newlines, which is how markdown arrives mangled. */
function* chunks(text: string): Generator<AiFrame> {
  const parts = text.split(/(\s+)/);
  let buf = '';
  let words = 0;
  for (const p of parts) {
    buf += p;
    if (/\S/.test(p)) words++;
    if (words >= CHUNK) { yield { t: 'delta', text: buf }; buf = ''; words = 0; }
  }
  if (buf) yield { t: 'delta', text: buf };
}
