import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AskAiOrb, ORB_BASE, type OrbState } from './AskAiOrb';
import { NovaDrawer, NOVA_EXIT_MS } from './NovaDrawer';
import { NOVA_STAGE, NOVA_DUR, prefersReducedMotion, stageAt } from './novaMotion';
import { getOpener, useAskAiActions, useAskAiState } from '../AskAiProvider';
import { useDrawerStack } from '../../components/DrawerStack';
import { contextFor } from './novaSources';
import type { UserRole } from './novaSuggestions';

/* Nova, wired to the PRODUCT's Ask AI state.
 *
 * The demo host (`NovaHost`) owns its own FAB and its own open/close. This one owns neither: the
 * provider decides when the assistant is open, and the orb flies from whatever actually opened it
 * — the right-edge "AI" tab, the rail sparkle, Ctrl/⌘+J.
 *
 * Two hosts on purpose. Making the demo a wrapper around this one would mean the harness could
 * only ever test what the product already does, which is the opposite of what a harness is for.
 * What they SHARE is everything that matters: the orb, the drawer, the schedule.
 *
 * ── THE ORIGIN RECT ──────────────────────────────────────────────────────────────────────────
 * `rememberOpener` already existed, to send focus back where it came from. It is the same
 * question the FLIP asks — "what did the user press?" — so the flight reads it rather than
 * introducing a second answer that could disagree with focus.
 *
 * The orb flies from the opener's RECT, not its centre point. On the 26×52 edge tab that puts a
 * small soft glow behind the "AI" letters, so the orb reads as coming OUT of the tab rather than
 * appearing beside it — and no icon changes, which was the constraint.
 */

/** How big the orb is at the trigger. Derived from the trigger's own rect and clamped, so a 26px
 *  edge tab and a 40px rail button both get something proportionate rather than a fixed guess. */
const originSize = (r: DOMRect) => Math.max(22, Math.min(40, Math.min(r.width, r.height)));

interface Flight { x: number; y: number; scale: number }

export function NovaShell({ orbState = 'idle', userRole = 'technician' }: {
  orbState?: OrbState;
  /** ⚠️ STUB. There is no auth object in this prototype, so the product cannot read a real role
   *  yet — see ask-ai/HANDOFF.md. When one exists this is where it arrives. */
  userRole?: UserRole;
}) {
  const { open, scope } = useAskAiState();
  const { close } = useAskAiActions();
  /* WHAT IS ON SCREEN BEHIND THE DRAWER, which is what "about this ticket" means.
     A record beats a page: someone with INC-0035 open is asking about that ticket, not about the
     list behind it. This shell renders inside DrawerStackProvider, so the open record is readable
     here without threading anything through the drawer. */
  const stack = useDrawerStack();
  const active = stack?.active ?? null;
  const context = contextFor(
    active ? { id: active.id, subject: active.subject } : null,
    scope || '',
  );

  const [closing, setClosing] = useState(false);
  /* What the drawer says the orb is doing. `null` means nobody has an opinion and the host's own
     default stands — which is what makes the greeting's idle and the feed's investigating one
     state machine rather than two. */
  const [liveOrb, setLiveOrb] = useState<OrbState | null>(null);
  const [flying, setFlying] = useState<'none' | 'true' | 'exit'>('none');
  const [flight, setFlight] = useState<Flight | null>(null);
  /* Attention is a fact about the DRAWER — caret in the composer — that the Core expresses. It
     lives here because the Core lives here. */
  const [attend, setAttend] = useState(false);
  const drawerSlotRef = useRef<HTMLDivElement | null>(null);
  const layerRef = useRef<HTMLDivElement | null>(null);
  const flightRef = useRef<Flight | null>(null);
  const timers = useRef<number[]>([]);

  const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  const after = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, stageAt(ms)));

  /** A rect, as the transform that seats the orb over it — in SCALED units, because the layer's
   *  transform-origin is its own top-left corner. */
  const seatRect = useCallback((r: DOMRect | null, size: number): Flight | null => {
    if (!r) return null;
    const scale = size / ORB_BASE;
    return {
      x: r.left + r.width / 2 - (ORB_BASE * scale) / 2,
      y: r.top + r.height / 2 - (ORB_BASE * scale) / 2,
      scale,
    };
  }, []);

  const openerRect = () => {
    const el = getOpener();
    return el ? el.getBoundingClientRect() : null;
  };
  const seatOnOpener = useCallback(() => {
    const r = openerRect();
    return r ? seatRect(r, originSize(r)) : null;
  }, [seatRect]);
  /* The orb's size comes from THE SLOT, not from a constant.
     The drawer has two seats — the 120px one under the greeting and the 24px marker in the
     header — and passing a number from here would mean the host holding a second opinion about
     how big the orb is in each. The slot's own box is the one fact; a 24px slot gets a 24px orb
     because that is what 24px means. */
  const seatInDrawer = useCallback(() => {
    const r = drawerSlotRef.current?.getBoundingClientRect() ?? null;
    if (!r) return null;
    const size = Math.min(r.width, r.height) || ORB_BASE;   // 0 in jsdom, which has no layout
    return seatRect(r, size);
  }, [seatRect]);

  /* The drawer moved its slot (greeting → header marker, or back). Same element, new rect, one
     armed transition — a FLIP, and the reason the marker is the orb rather than a picture of it. */
  const moveOrb = useCallback(() => {
    if (prefersReducedMotion()) { setFlight(seatInDrawer()); return; }
    setFlying('true');
    requestAnimationFrame(() => requestAnimationFrame(() => setFlight(seatInDrawer())));
    window.setTimeout(() => setFlying('none'), NOVA_DUR.enter + 40);
  }, [seatInDrawer]);

  /* The whole entry runs off the provider's `open` going true, because that is the one signal
     every entry point already produces — the tab, the rail, and the keyboard shortcut alike. */
  useLayoutEffect(() => {
    if (!open) return;
    clearTimers();
    setClosing(false);
    /* Start on the trigger, before paint. A first frame at the destination is not a flight. */
    setFlight(seatOnOpener());

    if (prefersReducedMotion()) {
      requestAnimationFrame(() => setFlight(seatInDrawer()));
      return;
    }
    after(NOVA_STAGE.orb, () => {
      setFlying('true');
      /* Two frames: one to arm the transition, one for the new transform to be a CHANGE rather
         than the value it mounted with. A single rAF snaps instead of flying. */
      requestAnimationFrame(() => requestAnimationFrame(() => setFlight(seatInDrawer())));
    });
    /* NOT `NOVA_DUR.enter`. The flight takes 280ms but the BLOOM — small dense point → 1.08 →
       settle — takes 420, and the stylesheet hangs it off this same `data-flying` attribute so
       arriving is one fact rather than two that can disagree. Clearing the flag at 280 cut the
       bloom off a third of the way through its overshoot. The flight's transition is simply
       removed 140ms after it finished, which costs nothing. */
    after(NOVA_STAGE.orb + NOVA_DUR.bloom, () => setFlying('none'));
  }, [open, seatOnOpener, seatInDrawer]);

  const doClose = useCallback(() => {
    if (!open || closing) return;
    clearTimers();
    setClosing(true);
    if (!prefersReducedMotion()) {
      setFlying('exit');
      requestAnimationFrame(() => setFlight(seatOnOpener()));
    }
    /* Close the PROVIDER only once the exit has played — it is what unmounts this component, and
       an element removed on the same tick has nothing left to animate. `close()` also returns
       focus to the opener, which is the same element the orb just flew back to. */
    after(NOVA_EXIT_MS, () => {
      setClosing(false);
      setFlying('none');
      close();
    });
  }, [open, closing, close, seatOnOpener]);

  useEffect(() => clearTimers, []);

  /* ══ CURSOR ─ written to the element, never to React ══════════════════════════
     A pointer at 120Hz through setState would re-render the drawer, the thread and the composer a
     hundred times a second for a four-pixel lean. The handler writes two custom properties
     straight onto the layer and the stylesheet does the rest, so the reconciler never hears about
     it. Moves are coalesced into one rAF, so a burst costs one write.

     Travel is deliberately tiny (4px body, 9px halo) and the falloff wide. This is meant to be
     DISCOVERED — you notice the Core is aware of you some seconds after you have stopped
     noticing anything else. A bigger number would make it a toy. */
  useEffect(() => {
    if (!open || closing || prefersReducedMotion()) return;
    const el = layerRef.current;
    if (!el) return;
    const FALLOFF = 280;
    let queued = 0;
    let pending: { x: number; y: number } | null = null;

    const write = () => {
      queued = 0;
      const f = flightRef.current;
      if (!pending || !f) return;
      const cx = f.x + (ORB_BASE * f.scale) / 2;
      const cy = f.y + (ORB_BASE * f.scale) / 2;
      const dx = (pending.x - cx) / FALLOFF;
      const dy = (pending.y - cy) / FALLOFF;
      const d = Math.hypot(dx, dy);
      /* Beyond the falloff it returns to centre rather than clamping to the rim — a Core left
         leaning at whatever the cursor last did looks stuck, not attentive. */
      const k = d > 1 ? 0 : 1 - d;
      el.style.setProperty('--core-mx', (Math.max(-1, Math.min(1, dx)) * k).toFixed(3));
      el.style.setProperty('--core-my', (Math.max(-1, Math.min(1, dy)) * k).toFixed(3));
    };

    const onMove = (e: PointerEvent) => {
      pending = { x: e.clientX, y: e.clientY };
      if (!queued) queued = requestAnimationFrame(write);
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      if (queued) cancelAnimationFrame(queued);
      el.style.setProperty('--core-mx', '0');
      el.style.setProperty('--core-my', '0');
    };
  }, [open, closing]);

  /* The flight, mirrored to a ref so the cursor handler can read the Core's live position without
     taking `flight` as a dependency and re-subscribing on every frame of the flight itself. */
  flightRef.current = flight;

  /* Re-seat on resize: the orb is fixed against a viewport that can change under it. */
  useEffect(() => {
    const onResize = () => setFlight(closing || !open ? seatOnOpener() : seatInDrawer());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [open, closing, seatOnOpener, seatInDrawer]);

  if (!open) return null;

  return (
    <>
      <NovaDrawer
        open={open && !closing}
        closing={closing}
        onClose={doClose}
        userRole={userRole}
        orbState={orbState}
        orbSlotRef={drawerSlotRef}
        onOrbSlotChange={moveOrb}
        onOrbState={setLiveOrb}
        onAttend={setAttend}
        context={context}
      />
      <div
        ref={layerRef}
        className="nova-orb-layer z-[10030]"
        data-flying={flying}
        style={{
          transform: flight
            ? `translate3d(${flight.x}px, ${flight.y}px, 0) scale(${flight.scale})`
            : 'translate3d(-9999px, -9999px, 0)',
          /* THE TRIGGER IS THE CORE, SMALLER. The expressive layers do not switch off at the
             trigger — they FADE, as a function of how big the Core currently is, so opening
             reads as one object growing into its full self rather than two objects swapping. At
             26px a particle is a third of a pixel; drawing it would be shimmer, not presence. */
          ['--core-detail' as string]: flight && flight.scale < 0.55 ? '0' : '1',
          ['--core-attend' as string]: attend ? '1' : '0',
        }}
      >
        <AskAiOrb state={closing ? 'dormant' : (liveOrb ?? orbState)} size={ORB_BASE} detail />
      </div>
    </>
  );
}
