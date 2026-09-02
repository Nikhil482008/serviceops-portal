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
    /* Centre on the slot. The layer's origin is the viewport's top-left and its transform-origin
       is top-left too, so this is the slot's centre minus half the orb's UNSCALED size. */
    return {
      x: r.left + r.width / 2 - DRAWER_ORB / 2,
      y: r.top + r.height / 2 - DRAWER_ORB / 2,
      scale: size / DRAWER_ORB,
    };
  }, []);

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
      const target = open && !closing ? drawerSlotRef.current : fabSlotRef.current;
      const size = open && !closing ? DRAWER_ORB : FAB_ORB;
      setFlight(seat(target, size));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [open, closing, seat]);

  const doOpen = useCallback(() => {
    if (open) return;
    clearTimers();
    setClosing(false);
    setOpen(true);

    if (prefersReducedMotion()) {
      /* No flight. The orb is placed at its destination and the stylesheet fades it in — running
         the FLIP against a stylesheet that has switched transitions off would snap it instead. */
      requestAnimationFrame(() => setFlight(seat(drawerSlotRef.current, DRAWER_ORB)));
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
        setFlight(seat(drawerSlotRef.current, DRAWER_ORB));
      }));
    });
    after(NOVA_STAGE.orb + NOVA_DUR.enter, () => setFlying('none'));
  }, [open, seat]);

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
      />

      {/* The one orb. Above the drawer so it is never clipped by it mid-flight, and
          `pointer-events-none` so it never takes a click meant for what is underneath. */}
      <div
        className="nova-orb-layer z-[10030]"
        data-flying={flying}
        style={{
          transform: flight
            ? `translate3d(${flight.x}px, ${flight.y}px, 0) scale(${flight.scale})`
            : 'translate3d(-9999px, -9999px, 0)',
        }}
      >
        <AskAiOrb state={open && !closing ? orbState : 'dormant'} size={DRAWER_ORB} />
      </div>
    </>
  );
}
