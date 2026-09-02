import { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { NovaHost } from '../ai/nova/NovaHost';
import { ORB_STATES, ORB_STATE_NOTE, AskAiOrb, type OrbState } from '../ai/nova/AskAiOrb';
import { prefersReducedMotion } from '../ai/nova/novaMotion';
import type { UserRole } from '../ai/nova/novaSuggestions';

/* The isolated demo for the Nova drawer.
 *
 * This page is SCAFFOLDING, and says so on itself. The role switcher here is a demo control — the
 * product takes `userRole` from the auth object and shows no such thing, because a person has one
 * role and asking them to pick it is asking them to configure what the system already knows.
 *
 * The orb switcher is the same: the product never labels its own state, and this exists so all
 * seven can be seen side by side without having to drive a conversation into each one.
 */

const ROLES: UserRole[] = ['requester', 'technician', 'leadership'];

export function NovaDemoPage({ onNavigate }: { onNavigate: (page: string) => void }) {
  const [orbState, setOrbState] = useState<OrbState>('idle');
  const [userRole, setUserRole] = useState<UserRole>('technician');
  /* Read once for the banner. The behaviour itself reads it live, at the moment each animation
     is scheduled — this is only a report of what is currently true. */
  const reduced = prefersReducedMotion();

  const pill = (on: boolean) =>
    `inline-flex h-[30px] items-center rounded-full px-3 text-[12px] font-medium transition-colors ${
      on ? 'bg-[#3D8BD0] text-white'
        : 'border border-[#DFE5ED] bg-white text-[#364658] hover:border-[#3D8BD0] hover:bg-[#F5F7FA]'}`;

  return (
    <div className="flex h-screen bg-[#f9fafb]">
      <Sidebar activePage="nova-demo" onNavigate={onNavigate} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header selectedCount={0} onOpenAdmin={() => onNavigate('admin')} />

        <div className="border-b border-[#e5e7eb] bg-white px-6 py-4">
          <h1 className="text-[20px] font-semibold text-[#364658]">Ask AI — Nova shell</h1>
          <p className="mt-1 text-[13px] text-[#7B8FA5]">
            Entry animation and drawer shell. Mock data, no backend — the input does not send.
            Press the orb button, bottom right.
          </p>
        </div>

        <main className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
          <div className="max-w-[760px] space-y-8">

            {/* Reduced motion is a REQUIREMENT here, so the page says which way it is currently
                running rather than leaving it to be inferred from what does or does not move. */}
            <div
              className={`rounded-lg border px-4 py-3 text-[13px] ${
                reduced ? 'border-[#3D8BD0] bg-[#EBF5FF] text-[#364658]' : 'border-[#E5E7EB] bg-white text-[#7B8FA5]'}`}
            >
              <b className="font-medium text-[#364658]">
                {reduced ? 'Reduced motion is ON' : 'Reduced motion is off'}
              </b>{' '}
              {reduced
                ? '— every movement is replaced by one 120ms opacity fade and the orb holds still as a static gradient.'
                : '— the full ~520ms choreography is running. Turn on “reduce motion” in your OS to see the other path.'}
            </div>

            {/* ── the seven states ─────────────────────────────── */}
            <section>
              <h2 className="text-[15px] font-semibold text-[#364658]">Orb states</h2>
              <p className="mt-1 text-[13px] text-[#7B8FA5]">
                One component, one <code className="text-[12px]">state</code> prop. Each state changes
                scale, drift speed and hue — nothing else. The same instance renders in the FAB and
                in the drawer, so switching here changes both.
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                {ORB_STATES.map((s) => (
                  <button
                    key={s}
                    onClick={() => setOrbState(s)}
                    aria-pressed={orbState === s}
                    className={pill(orbState === s)}
                  >{s}</button>
                ))}
              </div>
              <p className="mt-2 text-[12px] text-[#7B8FA5]">{ORB_STATE_NOTE[orbState]}</p>

              {/* All seven at rest, so they can be compared rather than remembered. */}
              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
                {ORB_STATES.map((s) => (
                  <button
                    key={s}
                    onClick={() => setOrbState(s)}
                    className={`flex flex-col items-center gap-2 rounded-lg border px-2 py-3 transition-colors ${
                      orbState === s ? 'border-[#3D8BD0] bg-[#F7FBFF]' : 'border-[#E5E7EB] bg-white hover:border-[#3D8BD0]'}`}
                  >
                    <span className="flex size-[76px] items-center justify-center">
                      <AskAiOrb state={s} size={76} />
                    </span>
                    <span className="text-[11px] text-[#7B8FA5]">{s}</span>
                  </button>
                ))}
              </div>
            </section>

            {/* ── role ─────────────────────────────────────────── */}
            <section>
              <h2 className="text-[15px] font-semibold text-[#364658]">Suggestion set</h2>
              <p className="mt-1 text-[13px] text-[#7B8FA5]">
                Driven by <code className="text-[12px]">userRole</code>, which the product takes from
                the auth object. <b className="font-medium text-[#364658]">This switcher is demo
                scaffolding</b> — there is no role selector in the drawer.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {ROLES.map((r) => (
                  <button key={r} onClick={() => setUserRole(r)} aria-pressed={userRole === r} className={pill(userRole === r)}>
                    {r}
                  </button>
                ))}
              </div>
            </section>

            {/* ── what the entry actually does ─────────────────── */}
            <section>
              <h2 className="text-[15px] font-semibold text-[#364658]">Entry choreography</h2>
              <p className="mt-1 text-[13px] text-[#7B8FA5]">
                ~520ms, transform and opacity only. Exit is 180ms and deliberately not the entry
                reversed — arriving is an event, leaving is an instruction already given.
              </p>
              <ul className="mt-3 space-y-1.5 text-[13px] text-[#364658]">
                {[
                  ['0ms', 'FAB scales to 0.9, scrim fades in'],
                  ['0ms', 'Drawer slides from the right — 280ms'],
                  ['60ms', 'Orb flies from the FAB’s rect to the drawer’s slot — 280ms'],
                  ['120ms', 'Dotted grid fades in, settling from 1.03'],
                  ['200ms', 'Greeting rises 8px'],
                  ['260ms', 'Suggestion cards rise 10px, 50ms apart'],
                  ['460ms', 'Input fades in and takes focus'],
                ].map(([t, what]) => (
                  <li key={t as string} className="flex gap-3">
                    <span className="w-[54px] flex-shrink-0 text-right font-mono text-[12px] tabular-nums text-[#9CA3AF]">{t}</span>
                    <span>{what}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </main>
      </div>

      <NovaHost userRole={userRole} orbState={orbState} />
    </div>
  );
}
