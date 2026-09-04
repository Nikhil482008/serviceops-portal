import {
  Ticket, Clock, Search, List, Zap, Users, Shield, PenLine, Inbox,
  TrendingUp, Gauge, Building2, TriangleAlert,
} from 'lucide-react';
import { ROLE_SUGGESTIONS, type NovaIcon, type UserRole } from '../novaSuggestions';

/* WHAT YOU COULD ASK — and deliberately not the point of the screen.
 *
 * ── WHY THESE ARE NO LONGER CARDS ────────────────────────────────────────────────────────────
 * Four bordered boxes, each ~76px tall with a title and a subtitle, came to ~340px of the panel:
 * more area than the Core, the identity and the greeting put together. Four rectangles stacked
 * in a column is also the single most generic shape in enterprise software, so the most
 * distinctive thing on the screen was framed by the least distinctive.
 *
 * They are now one line each, ~40px, and they carry NO border at rest. The row is text on the
 * page; the surface only appears under the pointer, where it is a response rather than a
 * decoration. That halves the block, doubles the whitespace, and leaves the Core as the only
 * thing on the screen drawing the eye — which is the entire point of the redesign.
 *
 * The subtitle survives on the same line, muted and truncating. It answers "what will I get",
 * which is the only reason a suggestion is pressable rather than guessable.
 *
 * ── THE STAGGER IS NOT DECORATION ────────────────────────────────────────────────────────────
 * They still deal out from behind the Core (`nova-deal`, `--deal` measured per row in
 * NovaDrawer), because the entry's whole argument is that the Core CAUSED everything else on
 * the screen. Rows that simply faded in would be four things that happened to arrive.
 */

const ICONS: Record<NovaIcon, typeof Ticket> = {
  ticket: Ticket, clock: Clock, search: Search, list: List,
  zap: Zap, users: Users, shield: Shield, pen: PenLine, inbox: Inbox,
  trending: TrendingUp, gauge: Gauge, building: Building2, alert: TriangleAlert,
};

export function NovaSuggestions({ userRole, staged, out, onAsk, rowRef }: {
  userRole: UserRole;
  /** How many have arrived. The entry deals them one at a time. */
  staged: number;
  /** The greeting is leaving — the rows go with it. */
  out: boolean;
  onAsk: (prompt: string) => void;
  /** Each row reports its element so the drawer can measure its distance from the Core. */
  rowRef: (el: HTMLButtonElement | null, i: number) => void;
}) {
  return (
    <div className="mt-6">
      {ROLE_SUGGESTIONS[userRole].map((c, i) => {
        const Icon = ICONS[c.icon];
        const here = staged > i;
        return (
          <button
            key={c.title}
            type="button"
            ref={(el) => rowRef(el, i)}
            /* ONE way in. A suggestion is a question someone chose, so it asks it — the same
               call the composer makes and the same call a use-case row makes. */
            onClick={() => onAsk(c.prompt)}
            className="nova-sugg nova-deal"
            data-in={here ? 'true' : 'false'}
            data-out={out ? 'true' : 'false'}
            tabIndex={here && !out ? 0 : -1}
          >
            {/* data-tone: each row's own hue — see .nova-sugg-icon[data-tone] in theme.css. */}
            <span className="nova-sugg-icon" data-tone={String(i % 4)} aria-hidden="true"><Icon size={15} /></span>
            <span className="nova-sugg-title">{c.title}</span>
            <span className="nova-sugg-sub">{c.subtitle}</span>
          </button>
        );
      })}
    </div>
  );
}
