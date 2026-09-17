import { getTicket, type MockTicket } from '../mockTickets';

/* A MAJOR INCIDENT IN THIRTY SECONDS, COMPOSED FROM THE RECORD.
 *
 * A technician with a client on the line needs three facts and a sentence they can say out loud.
 * The three facts are on the incident record — when it started and why, who it hits and by when,
 * and where the fix has got to — so they are read from it rather than typed beside it. Change
 * the client count on INC-1088 and the Impact line changes; nobody has to remember to.
 */

export type Token = { t: 'text'; v: string } | { t: 'ref'; v: string };

export interface IncidentBrief {
  ref: string;
  headline: string;
  lines: Array<{ label: string; parts: Token[] }>;
}

/** "1,240" — counts a person reads, not a raw number. */
const n = (x: number) => x.toLocaleString('en-US');

export function incidentBrief(ref: string): IncidentBrief | null {
  const t: MockTicket | undefined = getTicket(ref);
  const d = t?.detail;
  if (!t || !d) return null;

  const lines: IncidentBrief['lines'] = [];
  const line = (label: string, build: (text: (v: string) => void, chip: (v: string) => void) => void) => {
    const parts: Token[] = [];
    build((v) => parts.push({ t: 'text', v }), (v) => parts.push({ t: 'ref', v }));
    lines.push({ label, parts });
  };

  line("What's happening", (text) => {
    text(`salary files have been rejected since ${d.detected}; ${lower(d.cause)}.`);
  });
  line('Impact', (text) => {
    text(`${d.clients} clients, ${n(d.employees)} employees' salaries pending. Client cut-off is ${d.cutoff}.`);
  });
  line('Status', (text, chip) => {
    text(`${d.fixBy} applied a fix at ${d.fixAt} and started the re-run at ${d.rerunAt}. Credits expected by ${d.eta}. `);
    chip(t.ref);
    text(`, ${t.priority}.`);
  });

  return {
    ref: t.ref,
    /* The conclusion in the order a caller wants it: the fix, then the progress, then the time. */
    headline: `Fix is in, re-run is running, credits by ${d.eta}`,
    lines,
  };
}

/** The cause reads as a clause here, so it starts lower-case unless it opens on a proper noun. */
const lower = (s: string) => (/^[A-Z][a-z]/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s);
