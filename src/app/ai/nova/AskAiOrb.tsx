/* The orb — the assistant's only ambient presence, and the one thing that is continuous between
 * the FAB and the drawer.
 *
 * Three stacked radial gradients, blurred, each drifting on its own clock. The blur is what turns
 * three hard-edged circles into one soft body; the three different periods are what stop them
 * ever returning to the same arrangement, which is what would make it read as a loop rather than
 * as something alive.
 *
 * Deliberately NOT Lottie, not video, not SVG turbulence: those are all a second rendering
 * pipeline for one decoration, and none of them can be told to hold still by a media query the
 * way three CSS animations can.
 *
 * All seven states change three things and no more — scale, drift speed, hue. Everything about
 * how that happens lives in `theme.css` under `.orb[data-orb-state=…]`, so a state is a fact this
 * component states rather than a set of styles it computes.
 */

/** The drawer's state model. One at a time; see ask-ai/CLAUDE.md §7.
 *
 *  ⚠️ The names are settled, the meanings are provisional until `ask-ai/docs/ux-context.md`
 *  lands — that document governs. */
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
  dormant: 'Not present. The FAB is the only trace.',
  arriving: 'Coming on screen. The only state that reads as motion.',
  idle: 'Open, waiting, nothing asked yet.',
  listening: 'Taking the question.',
  investigating: 'Working, and saying what it is working on.',
  discovery: 'It has found something worth raising before the answer.',
  settled: 'The answer is complete and the drawer is quiet again.',
};

export function AskAiOrb({ state = 'idle', size = 120, className = '' }: {
  state?: OrbState;
  /** Rendered at a fixed px size so the FAB and the drawer differ by a TRANSFORM, not by layout.
   *  That is what lets one element fly between them without anything reflowing. */
  size?: number;
  className?: string;
}) {
  return (
    <div
      className={`orb ${className}`}
      data-orb-state={state}
      style={{ width: size, height: size }}
      /* Decorative. It carries no information a screen reader needs — the state it is expressing
         is always also said in words by the drawer around it. */
      aria-hidden="true"
    >
      <span className="orb-blob orb-blob-1" />
      <span className="orb-blob orb-blob-2" />
      <span className="orb-blob orb-blob-3" />
    </div>
  );
}
