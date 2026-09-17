import { useMemo } from 'react';

/* THE ORB — one construction, every size, every surface.
 *
 * Six conic gradients over a single animated angle, blurred into each other, under a lit-disc
 * finish. The six spin at different multiples of that one angle — ×2, ×2, ×-3, ×2, ×1, ×-2 —
 * which is the whole trick: a single 0→360° cycle would return every layer to its start together
 * and the eye would learn the loop in about a minute. Different multiples, two of them negative,
 * mean the arrangement only repeats when all six coincide, which at these ratios is far outside
 * how long anyone looks at it.
 *
 * ── WHY THE ::after IS NOT OPTIONAL ──────────────────────────────────────────────────────────
 * Without it this is a flat swirl in a circular mask — pretty, and clearly a texture. The radial
 * fade to the background at the centre pushes the colour to the rim, and the top-left white sheen
 * puts a light source somewhere. Those two together are what make it read as a lit SPHERE, which
 * is the difference between a logo and an object. The 1px inset white ring and the soft drop
 * shadow finish the same argument: it sits on the page rather than being printed on it.
 *
 * ── ONE COMPONENT AT EVERY SIZE ──────────────────────────────────────────────────────────────
 * The blur radius is `size * 0.09` and the shadow scales the same way, so the 14px gutter mark
 * and the 120px entry orb are the same object at two distances rather than two drawings. Nothing
 * here is authored at a reference size and scaled by a transform; a transform would scale the
 * shadow and the ring too, and a 14px orb would wear a 120px orb's rim.
 *
 * ── STATE IS PROPS, NEVER A SECOND COMPONENT ─────────────────────────────────────────────────
 * Everything a Nova state changes — how fast, which hue leads — arrives as `animationDuration`
 * and `colors`. See NovaOrb, which is the state→props map and holds no construction of its own.
 */

export interface SiriOrbColors {
  /** The ground the sheen fades to. Also what the centre fades toward. */
  bg: string;
  c1: string;
  c2: string;
  c3: string;
}

/** NOVA'S IDENTITY, and the only place it is written down. Violet, magenta, sky — in oklch
 *  because the three have to look like one family at equal lightness, which is exactly what a
 *  perceptual space gets right and sRGB does not: the same three in hex drift apart in weight. */
export const NOVA_ORB_COLORS: SiriOrbColors = {
  bg: 'oklch(97% 0.015 300)',
  c1: 'oklch(68% 0.22 300)',
  c2: 'oklch(74% 0.19 340)',
  c3: 'oklch(80% 0.13 250)',
};

/* ── THE FALLBACK ────────────────────────────────────────────────────────────────────────────
 * `@property` is what makes `--angle` an ANGLE rather than a string, and therefore what makes it
 * interpolate. Without it the keyframes still run, but the value jumps 0→360° at the end of the
 * cycle instead of sweeping: a still orb that twitches once every twenty seconds, which is worse
 * than a still orb.
 *
 * There is no `@supports` test for an at-rule, so this asks the JS twin — `CSS.registerProperty`,
 * which ships in the same engine release as `@property` in every browser that has either. When it
 * is absent the orb is marked static and CSS paints a plain Nova disc: the same three colours in
 * one conic sweep, the same sheen, no animation. It still looks like Nova; it just does not move.
 */
const SUPPORTS_ANGLE = typeof CSS !== 'undefined' && typeof (CSS as unknown as {
  registerProperty?: unknown;
}).registerProperty === 'function';

export function SiriOrb({
  size = '120px',
  animationDuration = 20,
  colors = NOVA_ORB_COLORS,
  className = '',
  style,
  ...rest
}: {
  /** A CSS length. Every other measurement is derived from it, so one number sets the object. */
  size?: string;
  /** Seconds for one full sweep of the angle. Lower is faster, and faster is "working". */
  animationDuration?: number;
  colors?: SiriOrbColors;
  className?: string;
  style?: React.CSSProperties;
} & Omit<React.HTMLAttributes<HTMLDivElement>, 'color'>) {
  const vars = useMemo(() => ({
    '--orb-size': size,
    '--orb-dur': `${animationDuration}s`,
    '--orb-bg': colors.bg,
    '--orb-c1': colors.c1,
    '--orb-c2': colors.c2,
    '--orb-c3': colors.c3,
  } as React.CSSProperties), [size, animationDuration, colors]);

  return (
    <div
      className={`siri-orb ${className}`}
      data-static={SUPPORTS_ANGLE ? undefined : 'true'}
      style={{ ...vars, ...style }}
      {...rest}
    />
  );
}
