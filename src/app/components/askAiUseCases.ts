/* The 20 benchmark questions Ask AI is judged against.
 *
 * Grouped by WHO ASKS, because the three personas want different things from the same estate: a
 * requester wants their own thing dealt with, a technician wants the shift's work compressed, and
 * leadership wants the shape of the month. A question that reads well for one reads as noise to
 * another, which is the whole reason the benchmark is split rather than being one list of twenty.
 *
 * `points` is the difficulty weight — how much work a good answer has to do. A one-pointer is a
 * lookup ("what's still open for me"); a four-pointer has to gather, compare and then WRITE
 * something a person will send ("write my handover for the night shift"). It is not a score.
 */

import { TEC8_PROMPT } from '../ai/nova/tec8/tec8Model';

export type AskAiPersona = 'Requester' | 'Technician' | 'Leadership';

export interface AskAiUseCase {
  /** REQ-01 / TEC-04 / CXO-02 — the persona is legible in the id, so a case can be quoted alone. */
  id: string;
  persona: AskAiPersona;
  question: string;
  points: number;
}

/** In persona order, and within a persona in the order they were authored — the ids carry that
 *  order, so sorting by anything else would make the id column look shuffled. */
export const ASK_AI_USE_CASES: AskAiUseCase[] = [
  // ── Requester — my own thing, dealt with ────────────────────────────
  {
    id: 'REQ-01', persona: 'Requester', points: 2,
    question: 'My laptop screen flickers whenever I put it on the docking station. Can you log a ticket for me?',
  },
  {
    id: 'REQ-02', persona: 'Requester', points: 1,
    question: 'Any update on my VPN issue?',
  },
  {
    id: 'REQ-03', persona: 'Requester', points: 2,
    question: 'My ticket about losing access to the shared loans mailbox has been sitting for months. Escalate it — I need this working.',
  },
  {
    id: 'REQ-04', persona: 'Requester', points: 2,
    question: 'I changed my domain password and now VPN says authentication failed. What do I do?',
  },
  {
    id: 'REQ-05', persona: 'Requester', points: 2,
    question: "On my ticket about the passbook printer fading — the branch says counter 3's printer is now doing it too. Add that to the ticket.",
  },
  {
    id: 'REQ-06', persona: 'Requester', points: 1,
    question: "What's still open for me right now?",
  },
  {
    id: 'REQ-07', persona: 'Requester', points: 2,
    question: 'The mail-to-counterparty bounce problem seems fine now — can that ticket be closed? And was the fuel-station card decline thing ever fixed?',
  },

  // ── Technician — the shift, compressed ──────────────────────────────
  {
    id: 'TEC-01', persona: 'Technician', points: 3,
    question: 'I just started my shift. What should I look at first?',
  },
  {
    id: 'TEC-02', persona: 'Technician', points: 3,
    question: 'I have the corporate banking RM on the line about the bulk salary upload failures. Give me a 30-second brief.',
  },
  {
    id: 'TEC-03', persona: 'Technician', points: 3,
    question: 'User in Bengaluru says VPN drops every 30 minutes on the dot and reconnects fine. Ring any bells?',
  },
  {
    id: 'TEC-04', persona: 'Technician', points: 2,
    question: "Put the Commercial Street POS outage ticket on hold — we're waiting on the telco fibre repair, their ref TT-BLR-99120. Note that on the ticket.",
  },
  {
    id: 'TEC-05', persona: 'Technician', points: 3,
    question: 'Draft a reply to the requester on the merchant settlement ticket: transmission fault found, file will go in a supplementary run today, credits by evening. Keep it professional, no jargon.',
  },
  {
    id: 'TEC-06', persona: 'Technician', points: 2,
    question: 'Which of the pending tickets are stuck waiting on vendors, and for what?',
  },
  {
    id: 'TEC-07', persona: 'Technician', points: 4,
    question: "Write my handover for the night shift: what's burning, what's blocked, and anything the regulator cares about.",
  },

  {
    /* THE AGENTIC ONE, and the only case in this table that is not a question.
     *
     * Every other row asks Nova for something it can answer. This one asks it to DO something,
     * which is why it is a four-pointer and why it opens its own surface: the deliverable is a
     * plan the technician approves, not a reply they read. */
    id: 'TEC-8', persona: 'Technician', points: 4,
    question: TEC8_PROMPT,
  },

  // ── Leadership — the shape of the month ─────────────────────────────
  {
    id: 'CXO-01', persona: 'Leadership', points: 4,
    question: 'Walk me through June versus May — volumes, what changed, and what drove it.',
  },
  {
    id: 'CXO-02', persona: 'Leadership', points: 3,
    question: 'Are we meeting our SLAs? Where do we breach most?',
  },
  {
    id: 'CXO-03', persona: 'Leadership', points: 3,
    question: 'Which vendors are hurting our service quality the most?',
  },
  {
    id: 'CXO-04', persona: 'Leadership', points: 2,
    question: "What's currently open that we've flagged as regulatory reportable?",
  },
  {
    id: 'CXO-05', persona: 'Leadership', points: 3,
    question: 'Any security incidents this year I should be worried about? Did we lose money or data in any of them?',
  },
  {
    /* The data question, and the one the response system exists for: a ranking answered as a
       ranking rather than as a sentence about a ranking. */
    id: 'CXO-07', persona: 'Leadership', points: 3,
    question: 'Show me the trending HR cases.',
  },
  {
    id: 'CXO-06', persona: 'Leadership', points: 3,
    question: 'What problems keep coming back that we should fix permanently instead of patching?',
  },
];

/** The filter row's options. `null` is All — modelled as the absence of a persona rather than a
 *  fourth value, so "no filter" and "a filter" cannot both be true. */
export const ASK_AI_PERSONAS: AskAiPersona[] = ['Requester', 'Technician', 'Leadership'];

/** Counted from the list, never typed in: the subtitle says "the 20 benchmark questions", and a
 *  hand-written 20 beside a list of 19 is the first thing to go wrong when a case is added. */
export const ASK_AI_CASE_COUNT = ASK_AI_USE_CASES.length;
