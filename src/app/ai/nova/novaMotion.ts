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
} as const;

/** The entry choreography, as offsets from the moment the drawer is asked to open.
 *
 * Read down the list: the drawer starts moving immediately, the orb leaves the FAB once the
 * drawer has somewhere to put it, and the content arrives behind the movement rather than with
 * it. Total ≈ 520ms, which is the whole budget — the input is the last thing and it lands at
 * 460 + 120 of its own fade. */
export const NOVA_STAGE = {
  /** FAB shrinks, scrim fades. */
  fab: 0,
  /** Drawer slides in. */
  drawer: 0,
  /** Orb flies from the FAB's rect to the drawer's slot. */
  orb: 60,
  /** Dotted grid fades in and settles from 1.03. */
  grid: 120,
  /** Greeting rises 8px. */
  greeting: 200,
  /** First suggestion card; the rest follow at `cardStagger`. */
  cards: 260,
  cardStagger: 50,
  /** Input fades in and takes focus. */
  input: 460,
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
