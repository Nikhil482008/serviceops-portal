import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AskAiOrb, type OrbState } from './AskAiOrb';
import { NovaDrawer, NOVA_EXIT_MS } from './NovaDrawer';
import { NOVA_STAGE, NOVA_DUR, prefersReducedMotion, stageAt } from './novaMotion';
import type { UserRole } from './novaSuggestions';

/* The host: the FAB, the drawer, and the ONE orb that travels between them.
 *
 * The orb is a single element in a fixed layer, not one instance in the FAB and another in the
 * drawer. Two instances cross-fading is the obvious build and it is the wrong one — the whole
 * point of the entry is that the thing you pressed is the thing that is now talking to you, and a
 * cross-fade says the opposite: that one disappeared and another arrived.
 *
 * So the FAB and the drawer each own an empty SLOT, and this component measures both and flies the
 * orb between them. That is a FLIP without the inversion step: because the orb is already
 * position:fixed and sized in px, "first" and "last" are just two transforms, and going between
 * them is one composited property.
 */

const FAB_ORB = 34;    // orb size inside the FAB
const DRAWER_ORB = 120; // and inside the drawer

/** Where the orb currently is, as a transform. Held in state so React owns the one property
 *  being animated, rather than a ref writing style behind React's back. */
interface Flight { x: number; y: number; scale: number }

export function NovaHost({ userRole, orbState, now }: {
  userRole: UserRole;
  /** The drawer's state. The host does not decide it — a demo or, later, the conversation does. */
  orbState: OrbState;
  now?: Date;
}) {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [flying, setFlying] = useState<'none' | 'true' | 'exit'>('none');
  const [flight, setFlight] = useState<Flight | null>(null);
  const [liveOrb, setLiveOrb] = useState<OrbState | null>(null);
  /* Attention is a fact about the DRAWER (is the caret in the composer, is a menu open) that the
     Core expresses. It lives here because the Core lives here. */
  const [attend, setAttend] = useState(false);

  const layerRef = useRef<HTMLDivElement | null>(null);
  const flightRef = useRef<Flight | null>(null);
  const fabRef = useRef<HTMLButtonElement | null>(null);
  const fabSlotRef = useRef<HTMLSpanElement | null>(null);
  const drawerSlotRef = useRef<HTMLDivElement | null>(null);
  const timers = useRef<number[]>([]);

  const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  const after = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, stageAt(ms)));

  /** A slot's rect, as the transform that puts the orb over it. The orb is authored at
   *  DRAWER_ORB px, so the FAB is simply a smaller scale of the same element. */
  const seat = useCallback((el: Element | null, size: number): Flight | null => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const scale = size / DRAWER_ORB;
    /* Centre on the slot — in SCALED units.
       The layer's `transform-origin` is top left, so `scale()` shrinks the box toward its own
       corner: after scaling, the orb's centre sits half the SCALED size from that corner, not
       half the authored 120px. Subtracting 60 regardless of scale put the FAB's orb
       (60 - 17) = 43px up and to the left of where it belonged, which is why it read as a
       detached blob floating above an empty white circle. The drawer was unaffected only
       because its scale is exactly 1, where the two expressions happen to agree. */
    return {
      x: r.left + r.width / 2 - (DRAWER_ORB * scale) / 2,
      y: r.top + r.height / 2 - (DRAWER_ORB * scale) / 2,
      scale,
    };
  }, []);

  /* The drawer's seat, sized by the slot itself — 120px under the greeting, 24px as the header
     marker. See the same note in NovaShell: the slot's box is the single fact about how big the
     orb is there, and the host does not keep a second opinion. */
  const seatDrawer = useCallback(() => {
    const el = drawerSlotRef.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return seat(el, Math.min(r.width, r.height) || DRAWER_ORB);
  }, [seat]);

  /* Same element, new rect, one armed transition. */
  const moveOrb = useCallback(() => {
    if (prefersReducedMotion()) { setFlight(seatDrawer()); return; }
    setFlying('true');
    requestAnimationFrame(() => requestAnimationFrame(() => setFlight(seatDrawer())));
    window.setTimeout(() => setFlying('none'), NOVA_DUR.enter + 40);
  }, [seatDrawer]);

  /* Park the orb on the FAB whenever it is not open. `useLayoutEffect` so it is placed before
     paint — a first frame at the wrong position is a visible jump, not a subtle one. */
  useLayoutEffect(() => {
    if (open || closing) return;
    setFlight(seat(fabSlotRef.current, FAB_ORB));
  }, [open, closing, seat]);

  /* Re-seat on resize. The orb is fixed-positioned against a viewport that can change size, and
     a drawer left open across a resize would otherwise keep the orb where the slot used to be. */
  useEffect(() => {
    const onResize = () => {
      if (open && !closing) { setFlight(seatDrawer()); return; }
      setFlight(seat(fabSlotRef.current, FAB_ORB));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [open, closing, seat, seatDrawer]);

  const doOpen = useCallback(() => {
    if (open) return;
    clearTimers();
    setClosing(false);
    setOpen(true);

    if (prefersReducedMotion()) {
      /* No flight. The orb is placed at its destination and the stylesheet fades it in — running
         the FLIP against a stylesheet that has switched transitions off would snap it instead. */
      requestAnimationFrame(() => setFlight(seatDrawer()));
      return;
    }

    /* The orb leaves at 60ms — after the drawer has begun moving, so it has somewhere to land
       rather than flying at a panel that is not there yet. */
    after(NOVA_STAGE.orb, () => {
      setFlying('true');
      /* Two frames: one for the transition to be armed on the element, one for the new transform
         to be a CHANGE rather than the value it mounted with. A single rAF here is the classic
         way to get a snap instead of a flight. */
      requestAnimationFrame(() => requestAnimationFrame(() => {
        setFlight(seatDrawer());
      }));
    });
    /* NOT `NOVA_DUR.enter`. The flight takes 280ms but the BLOOM — small dense point → 1.08 →
       settle — takes 420, and the stylesheet hangs it off this same `data-flying` attribute so
       arriving is one fact rather than two that can disagree. Clearing the flag at 280 cut the
       bloom off a third of the way through its overshoot. The flight's transition is simply
       removed 140ms after it finished, which costs nothing. */
    after(NOVA_STAGE.orb + NOVA_DUR.bloom, () => setFlying('none'));
  }, [open, seat, seatDrawer]);

  const doClose = useCallback(() => {
    if (!open) return;
    clearTimers();
    setClosing(true);

    if (!prefersReducedMotion()) {
      setFlying('exit');
      requestAnimationFrame(() => setFlight(seat(fabSlotRef.current, FAB_ORB)));
    }

    /* Unmount only once the exit has actually played. Removing the element on the same tick
       leaves nothing to animate, which is the usual reason an exit "does not work". */
    after(NOVA_EXIT_MS, () => {
      setOpen(false);
      setClosing(false);
      setFlying('none');
      /* Focus goes back to what opened the drawer. Anything else drops the reader at the top of
         the page they were already on. */
      fabRef.current?.focus();
    });
  }, [open, seat]);

  useEffect(() => clearTimers, []);

  /* ══ CURSOR ─ written to the element, never to React ══════════════════════════
     A pointer at 120Hz through setState would re-render the drawer, the thread and the composer
     a hundred times a second for a four-pixel lean. So the handler writes two custom properties
     straight onto the layer and the stylesheet does the rest — the reconciler never hears about
     it. Coalesced into one rAF so a burst of moves costs one write.

     The falloff is deliberately wide and the travel deliberately tiny (4px body, 9px halo). This
     is meant to be DISCOVERED — you notice the Core is aware of you a few seconds after you
     stop noticing anything else. A larger number would make it a toy. */
  useEffect(() => {
    if (!open || closing) return;
    if (prefersReducedMotion()) return;
    const el = layerRef.current;
    if (!el) return;

    const FALLOFF = 280;
    let queued = 0;
    let pending: { x: number; y: number } | null = null;

    const write = () => {
      queued = 0;
      const f = flightRef.current;
      if (!pending || !f) return;
      const cx = f.x + (DRAWER_ORB * f.scale) / 2;
      const cy = f.y + (DRAWER_ORB * f.scale) / 2;
      const dx = (pending.x - cx) / FALLOFF;
      const dy = (pending.y - cy) / FALLOFF;
      const d = Math.hypot(dx, dy);
      /* Beyond the falloff it returns to centre rather than clamping to the rim — a Core that
         stays leaning at whatever the cursor last did is a Core that looks stuck. */
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

  /* The flight, mirrored to a ref so the cursor handler can read the Core's live position
     without taking `flight` as a dependency and re-subscribing on every frame of the flight. */
  flightRef.current = flight;

  const shrunk = open && !closing;

  return (
    <>
      {/* The FAB. It holds a HOLE where the orb sits, not an orb — so there is never a moment
          with two of them on screen. */}
      <button
        ref={fabRef}
        onClick={open ? doClose : doOpen}
        aria-label="Ask AI"
        aria-expanded={open}
        className="nova-fab fixed bottom-6 right-6 z-[10010] flex size-14 items-center justify-center rounded-full border border-[#E5E7EB] bg-white shadow-lg transition-shadow hover:shadow-xl"
        data-shrunk={shrunk ? 'true' : 'false'}
      >
        <span ref={fabSlotRef} className="block size-[34px]" aria-hidden="true" />
      </button>

      <NovaDrawer
        open={open}
        closing={closing}
        onClose={doClose}
        userRole={userRole}
        orbState={orbState}
        orbSlotRef={drawerSlotRef}
        now={now}
        onOrbSlotChange={moveOrb}
        onOrbState={setLiveOrb}
        onAttend={setAttend}
      />

      {/* The one orb. Above the drawer so it is never clipped by it mid-flight, and
          `pointer-events-none` so it never takes a click meant for what is underneath. */}
      <div
        ref={layerRef}
        className="nova-orb-layer z-[10030]"
        data-flying={flying}
        style={{
          transform: flight
            ? `translate3d(${flight.x}px, ${flight.y}px, 0) scale(${flight.scale})`
            : 'translate3d(-9999px, -9999px, 0)',
          /* THE FAB IS THE CORE, SMALLER. The expressive layers do not switch off at the FAB —
             they FADE, as a function of how big the Core currently is, so opening reads as one
             object growing into its full self rather than two objects swapping. At 34px a
             particle is a third of a pixel; rendering it would be shimmer, not presence. */
          ['--core-detail' as string]: flight && flight.scale < 0.55 ? '0' : '1',
          ['--core-attend' as string]: attend ? '1' : '0',
        }}
      >
        <AskAiOrb
          state={open && !closing ? (liveOrb ?? orbState) : 'dormant'}
          size={DRAWER_ORB}
          detail
        />
      </div>
    </>
  );
}
