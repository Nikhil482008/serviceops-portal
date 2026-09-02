import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useAskAiActionsOptional } from '../ai/AskAiProvider';
import {
  ASK_AI_USE_CASES, ASK_AI_PERSONAS, ASK_AI_CASE_COUNT,
  type AskAiPersona,
} from './askAiUseCases';

/* Ask AI — Use Cases.
 *
 * An index of the benchmark, not a module listing: every row is a question someone would actually
 * type, and clicking it asks that question in the side panel. So the row IS the control — the
 * whole row, not a link inside it — because there is nothing else on it to click.
 *
 * This page renders the questions and opens the panel with one. What the panel then DOES with it
 * is the next piece of work; the seam between them is `askQuestion` on the Ask AI provider.
 */

/** Persona filter. `null` is All — the absence of a filter rather than a fourth value, so "no
 *  filter" and "a filter" can never both be true. */
type PersonaFilter = AskAiPersona | null;

function FilterPill({ label, active, onClick }: {
  label: string; active: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex h-[34px] items-center rounded-full px-4 text-[13px] font-medium transition-colors ${
        active
          ? 'bg-[#3D8BD0] text-white'
          : 'border border-[#DFE5ED] bg-white text-[#364658] hover:border-[#3D8BD0] hover:bg-[#F5F7FA]'
      }`}
    >{label}</button>
  );
}

export function AskAiUseCasesPage({ onNavigate }: { onNavigate: (page: string) => void }) {
  const [persona, setPersona] = useState<PersonaFilter>(null);
  /* Optional, so this page still renders if it is ever mounted outside the provider — a page of
     questions is worth reading even when the thing that answers them is not mounted. */
  const ai = useAskAiActionsOptional();

  const shown = persona ? ASK_AI_USE_CASES.filter((c) => c.persona === persona) : ASK_AI_USE_CASES;

  const ask = (question: string) => {
    if (!ai) return;
    ai.setScope('askai.usecases');
    ai.askQuestion(question);
  };

  const TH = 'whitespace-nowrap px-6 py-3 text-left text-[13px] font-semibold text-[#364658]';

  return (
    <div className="flex h-screen bg-[#f9fafb]">
      <Sidebar activePage="ask-ai-cases" onNavigate={onNavigate} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header selectedCount={0} onOpenAdmin={() => onNavigate('admin')} />

        {/* Page head. Title left, the two controls right: which persona you are reading as, and a
            way into the panel without picking a question first. */}
        <div className="border-b border-[#e5e7eb] bg-white">
          <div className="flex items-center justify-between gap-4 px-6 py-4">
            <h1 className="text-[20px] font-semibold text-[#364658]">Ask AI — Use Cases</h1>
            <div className="flex flex-shrink-0 items-center gap-2">
              <FilterPill label="All" active={persona === null} onClick={() => setPersona(null)} />
              {ASK_AI_PERSONAS.map((p) => (
                <FilterPill key={p} label={p} active={persona === p} onClick={() => setPersona(p)} />
              ))}
              {/* Separated from the pills: they narrow this page, this leaves it. */}
              <button
                onClick={() => ai?.open()}
                className="ml-2 inline-flex h-[34px] items-center gap-1.5 rounded border border-[#3D8BD0] bg-white px-4 text-[13px] font-medium text-[#3D8BD0] transition-colors hover:bg-[#F5FAFF]"
              >
                Open chat <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </div>

        <main className="min-h-0 flex-1 overflow-y-auto bg-white">
          {/* What the list IS, and what a row does — said once, here, rather than as a hint on
              twenty rows. The count is derived; a typed 20 beside a list of 19 is the first thing
              to go wrong when a case is added. */}
          <p className="border-b border-[#F0F2F5] px-6 py-3 text-[13px] text-[#7B8FA5]">
            The {ASK_AI_CASE_COUNT} benchmark questions, grouped by who asks. Click one to ask it in
            the side panel.
          </p>

          <table className="w-full">
            <thead className="border-b border-[#e5e7eb]">
              <tr>
                <th className={`${TH} w-[140px]`}>Case</th>
                <th className={`${TH} w-[160px]`}>Persona</th>
                <th className={TH}>Question</th>
                <th className={`${TH} w-[100px] text-right`}>Points</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e5e7eb]">
              {shown.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-[13px] text-[#9CA3AF]">
                    No cases for this persona.
                  </td>
                </tr>
              ) : shown.map((c) => (
                /* The ROW is the control. A row whose only content is a question has nothing else
                   to click, so making the id a link and leaving the rest inert would put the
                   target on the smallest thing on the row. */
                <tr
                  key={c.id}
                  onClick={() => ask(c.question)}
                  tabIndex={0}
                  role="button"
                  aria-label={`Ask: ${c.question}`}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ask(c.question); }
                  }}
                  className="cursor-pointer transition-colors hover:bg-[#f9fafb] focus-visible:bg-[#f9fafb] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#3D8BD0]"
                >
                  <td className="px-6 py-3.5 align-top text-[13px] font-medium text-[#3D8BD0]">{c.id}</td>
                  <td className="px-6 py-3.5 align-top text-[13px] text-[#364658]">{c.persona}</td>
                  {/* The question WRAPS. It is the reason the row exists, and a truncated question
                      is a different question. */}
                  <td className="px-6 py-3.5 text-[13px] leading-[1.6] text-[#364658]">{c.question}</td>
                  {/* The figure carries the weight, the unit is a qualifier — same grammar the KPI
                      cards use, so a number and its unit read the same way across the product. */}
                  <td className="whitespace-nowrap px-6 py-3.5 align-top text-right text-[13px] text-[#9CA3AF]">
                    <span className="tabular-nums text-[#7B8FA5]">{c.points}</span> pt
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </main>
      </div>
    </div>
  );
}
