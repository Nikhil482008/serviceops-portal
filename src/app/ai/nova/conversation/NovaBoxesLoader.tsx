/* THE THINKING MARK — the BoxesLoader, in Nova's accent.
 *
 * Four isometric cubes trade places on a 3×2 field, 800ms a pass. It replaces the orb in the
 * identity row for exactly as long as Nova is working, and the row returns to the orb, the name
 * and the timestamp the moment there is an answer.
 *
 * ── WHY THIS IS NOT `react-awesome-loaders` ─────────────────────────────────────────────────
 * The library was asked for by name and is NOT installed, deliberately: it declares gsap, jquery,
 * node-sass, three, zdog, polished, styled-components, react-responsive AND react-scripts as
 * dependencies — a whole second toolchain, one of them a native SASS build that does not compile
 * on this Node, for one loader. So the BoxesLoader's OWN source was read (npm pack,
 * `lib/index.js`) and reproduced here exactly: the same four cubes at the same `translate`
 * seats (`100/0`, `0/100`, `100/100`, `200/0`), the same three-stop keyframes per cube, the same
 * four faces per cube (main, right, left, shadow) with the same `translateZ` and rotations, and
 * the same 800ms linear loop. What changed is the palette — `main` is Nova's accent and `right` /
 * `left` are its own `darken(.15)` / `darken(.05)`, the library's recipe — and the markup, which
 * is CSS in `theme.css` rather than styled-components.
 *
 * ── ONE PASS IS A REAL DURATION ─────────────────────────────────────────────────────────────
 * `BOXES_CYCLE_MS` is exported because the CONTROLLER reads it: an answer that arrives mid-pass
 * waits for the pass to finish (NovaConversationProvider), so the loader is never cut off in the
 * middle of a move.
 */
import { prefersReducedMotion } from '../novaMotion';

/** One full pass of the four cubes. The provider holds an early answer to a multiple of this. */
export const BOXES_CYCLE_MS = 800;

/** Where each cube sits, and the three stops of its move — the library's own `boxTransforms`
 *  and `animParams`, cube for cube. The keyframes themselves live in CSS beside the rule. */
const SEATS = [[100, 0], [0, 100], [100, 100], [200, 0]] as const;
/** The four faces every cube is built from. */
const FACES = ['main', 'right', 'left', 'shadow'] as const;

export function NovaBoxesLoader({ size = 35 }: {
  /** The square the field is scaled into. The field's own box is 332×268 — the library's
   *  `size*3 × size*2` plus its 70px padding — so the scale is `size / 332`. */
  size?: number;
}) {
  const still = prefersReducedMotion();
  return (
    <span
      className="nova-boxes"
      data-still={still ? 'true' : 'false'}
      role="img"
      aria-label="Working"
      style={{
        '--nova-boxes-scale': size / 332,
        '--nova-boxes-duration': `${BOXES_CYCLE_MS}ms`,
      } as React.CSSProperties}
    >
      <span className="nova-boxes-stage">
        {SEATS.map((seat, i) => (
          <span
            key={i}
            className="nova-boxes-box"
            data-b={i}
            style={{ '--tx': `${seat[0]}%`, '--ty': `${seat[1]}%` } as React.CSSProperties}
          >
            {FACES.map((f) => <span key={f} data-face={f} />)}
          </span>
        ))}
      </span>
    </span>
  );
}
