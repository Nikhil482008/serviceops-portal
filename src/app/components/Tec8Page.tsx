import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { Tec8Conversation } from '../ai/nova/tec8/Tec8Conversation';
import { useTec8 } from '../ai/nova/tec8/useTec8';
import { TEC8_STATES, TEC8_STATE_LABEL, type Tec8State } from '../ai/nova/tec8/tec8Model';

/* TEC-8 — the review surface for the action-plan flow.
 *
 * ── WHY THIS IS A PAGE AND NOT A ROUTE ─────────────────────────────────────
 * The brief asks for `/ai/tec-8?state=plan`. THIS APP HAS NO URL ROUTER — `App.tsx` keeps
 * `activePage` in a `useState` and the rail sets it — and §18 also says not to introduce a
 * second routing system. So TEC-8 is a page in the existing convention, plus a single
 * `?state=` query parameter read on mount and kept current with `replaceState`. Combined with
 * `?page=tec8`, every state is a real link: `?page=tec8&state=plan`.
 *
 * ── THE COLUMN IS DRAWER-WIDTH ON PURPOSE ────────────────────────────────────
 * 480px, because that is roughly what the Ask Nova drawer gives a conversation. Reviewing a plan
 * at 900px would flatter it: line lengths, wrapping and the step list all behave differently at
 * the width this will actually ship at.
 */
export function Tec8Page({ onNavigate }: { onNavigate: (page: string) => void }) {
  const api = useTec8();
  const { store } = api;

  const pill = (on: boolean) =>
    `inline-flex h-[30px] items-center rounded-full px-3 text-[12px] font-medium transition-colors ${
      on ? 'bg-[#3D8BD0] text-white'
        : 'border border-[#DFE5ED] bg-white text-[#364658] hover:border-[#3D8BD0] hover:bg-[#F5F7FA]'}`;

  return (
    <div className="flex h-screen bg-[#f9fafb]">
      <Sidebar activePage="tec8" onNavigate={onNavigate} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header selectedCount={0} onOpenAdmin={() => onNavigate('admin')} />

        <div className="border-b border-[#e5e7eb] bg-white px-6 py-4">
          <h1 className="text-[20px] font-semibold text-[#364658]">
            TEC-8 — AI action plan with user approval
          </h1>
          <p className="mt-1 text-[13px] text-[#7B8FA5]">
            Nova investigates, proposes a plan, and changes nothing until it is approved.
            Deterministic mock data — no model, no backend, no random copy.
          </p>
        </div>

        {/* ── PROTOTYPE TOOLING. Not part of the product; a technician never sees this. ── */}
        <div className="border-b border-[#e5e7eb] bg-[#FFFBEB] px-6 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#8A6D1F]">
              Prototype only · TEC-8 state
            </span>
            {TEC8_STATES.map((st: Tec8State) => (
              <button
                key={st}
                type="button"
                aria-pressed={store.state === st}
                className={pill(store.state === st)}
                onClick={() => api.goTo(st)}
              >{TEC8_STATE_LABEL[st]}</button>
            ))}
            <span className="mx-1 h-4 w-px bg-[#E5D9B6]" aria-hidden="true" />
            {/* What a run that reaches the end lands on — the only way to drive execution into
                the partial-failure path from the UI rather than jumping to it. */}
            <span className="text-[11px] text-[#8A6D1F]">Runs end in</span>
            <button
              type="button"
              aria-pressed={api.outcome === 'success'}
              className={pill(api.outcome === 'success')}
              onClick={() => api.setOutcome('success')}
            >Success</button>
            <button
              type="button"
              aria-pressed={api.outcome === 'partial'}
              className={pill(api.outcome === 'partial')}
              onClick={() => api.setOutcome('partial')}
            >Partial failure</button>
            <button
              type="button"
              className={pill(false)}
              onClick={api.reset}
            >Reset</button>
          </div>
          <p className="mt-2 text-[11px] text-[#8A6D1F]">
            State is in the address bar — <code>?page=tec8&amp;state={store.state}</code> reopens
            exactly this screen.
          </p>
        </div>

        <main className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
          <div className="mx-auto w-full max-w-[480px]" data-tec8-column>
            <Tec8Conversation
              api={api}
              /* The ONE intentional way out of the conversation. */
              onViewTicket={() => onNavigate('request')}
            />
          </div>
        </main>
      </div>
    </div>
  );
}
