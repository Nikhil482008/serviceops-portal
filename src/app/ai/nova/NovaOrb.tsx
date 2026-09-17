import { useEffect, useRef, useState } from 'react';
import { NOVA_ORB_COLORS, SiriOrb } from '../../../components/ui/siri-orb';

/* NOVA'S ORB — the state model, and nothing else.
 *
 * There is ONE orb construction in this tree (components/ui/siri-orb). This file holds no
 * drawing: it is the map from the drawer's state model to that component's props, kept in one
 * place because six call sites would otherwise each carry their own opinion about how fast
 * "investigating" is.
 *
 * ── WHAT REPLACED WHAT ───────────────────────────────────────────────────────────────────────
 * The previous orb was a 190-line component over ~400 lines of CSS: a clipped mass with three
 * drifting lobes, a bloom outside the clip, two travelling veins, a fourteen-particle field on
 * twenty-nine independent periods, and a one-shot ring. It was carefully built and it had one
 * structural problem — it was authored at 120px and scaled by `--orb-fit`, so its TONE was tuned
 * for one size and every other size was a compromise. The 14px thread marker needed its own
 * override of the ramp to read as anything at all.
 *
 * The replacement derives every measurement from `size`, so it is the same object at 8px and at
 * 120px with no per-size correction anywhere.
 *
 * ── THE STATES, AS SPEED AND HUE ─────────────────────────────────────────────────────────────
 *   dormant        22s  · present but not attending
 *   arriving       14s  · the only state that reads as motion
 *   idle           20s  · open, waiting
 *   listening      18s  · taking the question
 *   investigating   9s  · working — and c1 cools 300° → 270°, so effort is a temperature and
 *                         not just a tempo
 *   discovery       6s  · for ~700ms, with one 1.06 scale pulse, then back to investigating
 *   settled        20s  · eased back down
 *
 * Speed carries effort, hue carries the KIND of effort, and the construction never changes. That
 * is what makes the orb one object in seven moods rather than seven objects.
 */

export const ORB_BASE = 120;

export type OrbState =
  | 'dormant'
  | 'arriving'
  | 'idle'
  | 'listening'
  | 'investigating'
  | 'discovery'
  | 'settled';

export const ORB_STATES: OrbState[] = [
  'dormant', 'arriving', 'idle', 'listening', 'investigating', 'discovery', 'settled',
];

/** What each state is for, in one line. Used by the demo's switcher and by nothing else —
 *  the product surface never labels its own state. */
export const ORB_STATE_NOTE: Record<OrbState, string> = {
  dormant: 'Not present. The trigger is the only trace.',
  arriving: 'Coming on screen. The only state that reads as motion.',
  idle: 'Open, waiting, nothing asked yet.',
  listening: 'Taking the question.',
  investigating: 'Working, and saying what it is working on.',
  discovery: 'It has found something worth raising before the answer.',
  settled: 'The answer is complete and the drawer is quiet again.',
};

/** Seconds per sweep, per state. */
const SPEED: Record<OrbState, number> = {
  dormant: 22,
  arriving: 14,
  idle: 20,
  listening: 18,
  investigating: 9,
  discovery: 6,
  settled: 20,
};

/** WORKING IS COOLER. c1 leads the mix, so moving it 300° → 270° tips the whole orb toward blue
 *  without changing anything about how it is built — the reader sees concentration, not a second
 *  component. Nothing else in the palette moves: two of three staying put is what keeps it
 *  recognisably the same object. */
const INVESTIGATING_C1 = 'oklch(68% 0.22 270)';

/** How long the discovery beat holds before the orb goes back to working. It is punctuation: a
 *  state you can sit in is a state, and this is an event. */
const DISCOVERY_MS = 700;

export function NovaOrb({ state = 'idle', size = ORB_BASE, still = false, className = '', ...rest }: {
  state?: OrbState;
  /** Pixels. The component derives blur, shadow and ring from it. */
  size?: number;
  /** Hold the sweep. The thread marker is the same object as the hero — it just does not move,
   *  because one drifting orb per message would put five moving things on a surface whose whole
   *  argument is calm. */
  still?: boolean;
  className?: string;
} & Omit<React.HTMLAttributes<HTMLDivElement>, 'color'>) {
  /* DISCOVERY IS A ONE-OFF. Entering it starts a pulse and a timer; when the timer ends the orb
     is back at the working speed whether or not the drawer has moved the state on, because an
     event that outlives its moment stops being an event. */
  const [beat, setBeat] = useState(false);
  const was = useRef(state);
  useEffect(() => {
    const entered = state === 'discovery' && was.current !== 'discovery';
    was.current = state;
    if (!entered) return;
    setBeat(true);
    const t = window.setTimeout(() => setBeat(false), DISCOVERY_MS);
    return () => window.clearTimeout(t);
  }, [state]);

  const live = state === 'discovery' && !beat ? 'investigating' : state;
  const colors = live === 'investigating' || live === 'discovery'
    ? { ...NOVA_ORB_COLORS, c1: INVESTIGATING_C1 }
    : NOVA_ORB_COLORS;

  return (
    <SiriOrb
      size={`${size}px`}
      animationDuration={SPEED[live]}
      colors={colors}
      className={`nova-orb ${className}`}
      data-orb-state={live}
      data-orb-still={still ? 'true' : undefined}
      data-orb-beat={beat ? 'true' : undefined}
      /* Decorative. It carries no information a screen reader needs — the state it is expressing
         is always also said in words by the drawer around it. */
      aria-hidden="true"
      {...rest}
    />
  );
}
