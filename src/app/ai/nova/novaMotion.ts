/* The motion scale, mirrored for the parts CSS cannot reach.
 *
 * The entry is CHOREOGRAPHED — six things start at six different moments — and a stagger is a
 * schedule, which CSS transitions cannot express on their own. So the timings live in
 * `theme.css` as the tokens everything styles against, and are repeated here for the timers.
 *
 * ⚠️ These two must not drift. If a duration changes, change it in BOTH places — the token is
 * what the drawer is styled with, this is what the schedule is run from, and a mismatch shows up
 * as content arriving after the movement that was supposed to carry it.
 */

/** Milliseconds. Mirrors `--ai-dur-*` in theme.css. */
export const NOVA_DUR = {
  fast: 120,
  base: 220,
  enter: 280,
  slow: 420,
  /** Exit is NOT the entry reversed — see the token's own note. */
  exit: 180,
  /** The dot-grid ripple: the wave from the orb's centre to the panel edges. */
  ripple: 600,
  /** The orb's bloom — small dense point → 1.08 → settle. */
  bloom: 420,
  /** A card's deal-out from behind the orb. */
  card: 380,
} as const;

/** The entry choreography, as offsets from the moment the drawer is asked to open.
 *
 * Read down the list: the drawer starts moving, the orb leaves the trigger once the drawer has
 * somewhere to put it, and then EVERYTHING ELSE IS CAUSED BY THE ORB. That is the change from the
 * first version, which was a slide plus a fade — six things arriving on six timers that happened
 * to be in a pleasing order, none of which pointed at anything.
 *
 * Now the orb lands, a wave of brightness leaves it through the dotted ground, and the cards deal
 * out from behind it. The greeting is not on this list at all: it is revealed by the ripple's
 * leading edge reaching it, measured at run time (`waveReachMs`), so it is genuinely lit by the
 * wave rather than timed to look as though it were.
 *
 * Total ≈ 840ms — longer than the old ~520ms, because a 600ms wave is most of the sequence on
 * its own. The reader is not waiting through it: the greeting is up by ~240ms and the first card
 * by ~300ms; what runs on to 840 is the wave finishing and the input settling. */
export const NOVA_STAGE = {
  /** Trigger gives way, scrim fades. */
  fab: 0,
  /** Drawer slides in. */
  drawer: 0,
  /** Orb flies from the trigger's rect to the drawer's slot, blooming as it goes. */
  orb: 60,
  /** The ripple leaves the orb — just before it finishes settling, so it reads as caused by the
   *  landing rather than as a second event that happened afterwards. */
  ripple: 200,
  /** Dotted grid is present before the wave can travel through it. */
  grid: 120,
  /** Fallback only. The greeting's real moment is measured — see `waveReachMs`. */
  greetingFallback: 260,
  /** First suggestion card; the rest follow at `cardStagger`. Overlaps the ripple on purpose. */
  cards: 300,
  cardStagger: 45,
  /** Input fades in — plain, no travel — and takes focus. The calm end of the sequence. */
  input: 620,
} as const;

/** Does this user want motion?
 *
 * Read at the moment it is needed rather than cached, because the setting can change while the
 * app is open. The CSS honours the same query; this exists so the JS-driven FLIP and the staged
 * timers are SKIPPED rather than run against a stylesheet that has switched them off — which
 * would leave the orb mid-flight with nothing animating it. */
export const prefersReducedMotion = (): boolean => {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

/** The whole entry, collapsed. Under reduced motion every stage fires at once and the only
 *  thing that changes is opacity — one 120ms fade, which is the entire budget. */
export const stageAt = (offset: number): number => (prefersReducedMotion() ? 0 : offset);

/** When the ripple's leading edge reaches something `distance` px from the orb's centre.
 *
 * The ripple's radius is driven by ONE ease-out curve over `NOVA_DUR.ripple`, so "when does the
 * wave get there" is that curve inverted. The stylesheet uses cubic-bezier(0.215, 0.61, 0.355, 1)
 * — the bezier form of `p = 1 - (1 - t)³` — which is chosen precisely BECAUSE it inverts in
 * closed form: `t = 1 - ∛(1 - p)`. Solving the bezier numerically here would give the same answer
 * to within a frame and would be a second description of the same curve, free to drift from it.
 *
 * `max` is the distance the wave travels in full (orb centre → the panel's furthest corner). A
 * zero or missing `max` means nothing has been measured yet, so the caller's fallback stands. */
export const waveReachMs = (distance: number, max: number): number | null => {
  if (!(max > 0) || !(distance >= 0)) return null;
  const p = Math.min(1, distance / max);
  return NOVA_DUR.ripple * (1 - Math.cbrt(1 - p));
};
