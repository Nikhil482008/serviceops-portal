/* THE NOVA CORE — the assistant's whole visual presence, and the one thing that is continuous
 * between the FAB, the hero and the thread.
 *
 * ── WHAT THIS IS FOR ─────────────────────────────────────────────────────────────────────────
 * It is not decoration and it is not a logo. It is the answer to "what is Nova doing right now",
 * given without text. That only works if the motion has a GRAMMAR — one physical dimension
 * carrying one meaning, consistently — rather than seven unrelated looks. The grammar is:
 *
 *   RADIAL DIRECTION  = data flow.   Particles wander while nothing is happening, stream INWARD
 *                                    while Nova ingests, and are cast OUTWARD once when it emits.
 *                                    This is the load-bearing cue: direction is categorical, so
 *                                    it is legible at a glance, unlike "slightly faster".
 *   RADIAL AMPLITUDE  = attention.   The mass swells toward whatever it is attending to — the
 *                                    cursor, the caret, a voice.
 *   DENSITY + SPEED   = effort.      How much is moving, and how fast.
 *   A DISCRETE FLASH  = an event.    One brief convergence and bloom. Events are punctuation,
 *                                    never a continuous state.
 *   HUE               = almost nothing. It is the least discriminable channel at 34px, so it is
 *                                    a supporting cue only and never the sole difference.
 *
 * ── WHY THE MASS IS STILL THREE CSS LOBES ────────────────────────────────────────────────────
 * Three OFFSET lobes — violet, magenta, cool blue at half strength — blurred, each drifting on
 * its own clock. Not concentric: three centred gradients add to a circle by construction, which
 * is why that read as one flat splotch. Keeping this as the body is what makes continuity free:
 * the FAB, the 120px hero and the 20px thread marker are ONE element at three scales, and the
 * FLIP in NovaHost already flies it between them.
 *
 * Deliberately NOT canvas, WebGL or Lottie: those are a second rendering pipeline for one
 * decoration, none of them can be told to hold still by a media query, and a canvas inside an
 * element that is transform-scaled to 0.28 and flown is a rasterisation problem nobody needs.
 *
 * ── ONE AUTHORED GEOMETRY ────────────────────────────────────────────────────────────────────
 * Everything is authored at `ORB_BASE` px and scaled by `--orb-fit`. Lobe offsets, drift
 * distances, blur radius and every particle orbit are therefore written ONCE, and a 34px Core is
 * the same object as a 120px one rather than a second tuning of it.
 *
 * ── AND WHY IT NEVER LOOKS LIKE A LOOP ───────────────────────────────────────────────────────
 * Every period in the system is pairwise near-coprime. The three lobes are 7500 / 9825 / 6225ms
 * (LCM ≈ 22.6 hours on their own). Each new layer keeps that discipline — see PARTICLES below,
 * whose durations carry distinct large prime factors, and whose orbit and twinkle run on
 * DIFFERENT periods so even a single particle is a product of two incommensurate cycles. The
 * composite does not repeat in any session anyone will sit through.
 */

/** The size the Core is authored at. Everything else is this, scaled. */
export const ORB_BASE = 120;

/** The state model. One at a time; the drawer drives it from real turn state. */
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

/* ── THE PARTICLES ────────────────────────────────────────────────────────────────────────────
 * A fixed table, not Math.random(): the field must be identical on every open, or the Core is a
 * different object each time you look at it and the eye never learns it.
 *
 * Per particle: an angle, the two radii it wanders between, the radius it streams in FROM, its
 * orbit period and an independent twinkle period. Angles are deliberately NOT evenly spaced —
 * an even fan reads as a mechanism. Radii start OUTSIDE the 60px body radius, so "inward" is
 * genuinely a journey from outside the mass into it.
 *
 * ⚠️ THE DURATIONS ARE THE NON-REPETITION BUDGET. Each carries a distinct large prime factor
 * (97, 113, 127, 131, 157, 163, 179, 211, 233 …) and none shares one with 7500/9825/6225 except
 * where the LCM is already astronomical. Replacing any of these with a round number — 8000ms,
 * 12000ms — is what would make the field visibly cycle.
 */
interface Particle { a: number; r0: number; r1: number; far: number; dur: number; fade: number; delay: number }

const PARTICLES: Particle[] = [
  { a: 12,  r0: 52, r1: 63, far: 88, dur: 13100, fade: 9700,  delay: -2300 },
  { a: 47,  r0: 61, r1: 49, far: 96, dur: 15700, fade: 12700, delay: -6100 },
  { a: 88,  r0: 46, r1: 58, far: 82, dur: 18900, fade: 10300, delay: -1100 },
  { a: 121, r0: 57, r1: 68, far: 92, dur: 21100, fade: 14300, delay: -8700 },
  { a: 158, r0: 64, r1: 51, far: 99, dur: 12700, fade: 16300, delay: -4300 },
  { a: 191, r0: 49, r1: 60, far: 85, dur: 23300, fade: 11300, delay: -9700 },
  { a: 224, r0: 59, r1: 47, far: 94, dur: 16300, fade: 13100, delay: -3700 },
  { a: 259, r0: 54, r1: 66, far: 90, dur: 19700, fade: 15700, delay: -7300 },
  { a: 292, r0: 67, r1: 53, far: 101, dur: 14300, fade: 17900, delay: -5300 },
  { a: 318, r0: 48, r1: 62, far: 83, dur: 22300, fade: 9700,  delay: -11300 },
  { a: 341, r0: 62, r1: 50, far: 97, dur: 17300, fade: 12100, delay: -1700 },
  { a: 68,  r0: 71, r1: 56, far: 104, dur: 25300, fade: 18100, delay: -13700 },
  { a: 205, r0: 44, r1: 55, far: 79, dur: 11300, fade: 20300, delay: -6700 },
  { a: 276, r0: 69, r1: 58, far: 102, dur: 26900, fade: 10700, delay: -15100 },
];

export function AskAiOrb({
  state = 'idle', size = ORB_BASE, className = '', still = false, detail,
}: {
  state?: OrbState;
  /** Hold the drift. The thread marker is the same object as the hero — it just does not move,
   *  because one drifting Core per message would put five moving things on a surface whose whole
   *  argument is calm. Implies no field and no veins. */
  still?: boolean;
  /** Render the expressive layers — veins and the particle field. Defaults to "big enough to
   *  see them". Below about 72px they are sub-pixel shimmer, which is noise, not presence. */
  detail?: boolean;
  /** Rendered at a fixed px box so the FAB and the drawer differ by a TRANSFORM, not by layout.
   *  That is what lets one element fly between them without anything reflowing. */
  size?: number;
  className?: string;
}) {
  const rich = (detail ?? size >= 72) && !still;

  return (
    <div
      className={`nova-core ${className}`}
      data-orb-state={state}
      data-orb-still={still ? 'true' : undefined}
      data-core-rich={rich ? 'true' : 'false'}
      style={{ width: size, height: size, ['--orb-fit' as string]: size / ORB_BASE }}
      /* Decorative. It carries no information a screen reader needs — the state it is expressing
         is always also said in words by the drawer around it. */
      aria-hidden="true"
    >
      {/* The bloom. Larger than the body and OUTSIDE its clip, so the Core has an atmosphere
          rather than a hard edge. Breathes on its own long period. */}
      <span className="orb-halo" />

      {/* The mass. Clipped and round: without this the 3σ tail of the blur reaches well past the
          element's bounds and paints over whatever it is sitting on. */}
      <div className="orb">
        <div className="orb-body">
          <span className="orb-blob orb-blob-1" />
          <span className="orb-blob orb-blob-2" />
          <span className="orb-blob orb-blob-3" />
        </div>
        {/* Internal light, travelling. Two veins on different periods and different paths, so the
            interior is never twice in the same configuration. Inside the clip on purpose — this
            is light moving THROUGH the mass, not around it. */}
        {rich && (
          <>
            <span className="orb-vein orb-vein-1" />
            <span className="orb-vein orb-vein-2" />
          </>
        )}
      </div>

      {/* One expanding ring. Fires ONCE on entering discovery or settled — punctuation, not a
          state. Outside the clip so it can leave the body. */}
      <span className="core-pulse" />

      {/* The field. Outside the clip, because the whole point is that they come from beyond the
          mass and are drawn into it. */}
      {rich && (
        <div className="orb-field">
          {PARTICLES.map((p, i) => (
            <span
              key={i}
              className="orb-particle"
              style={{
                ['--p-a' as string]: `${p.a}deg`,
                ['--p-r0' as string]: `${p.r0}px`,
                ['--p-r1' as string]: `${p.r1}px`,
                ['--p-far' as string]: `${p.far}px`,
                ['--p-dur' as string]: `${p.dur}ms`,
                ['--p-fade' as string]: `${p.fade}ms`,
                ['--p-delay' as string]: `${p.delay}ms`,
              }}
            >
              <i />
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
