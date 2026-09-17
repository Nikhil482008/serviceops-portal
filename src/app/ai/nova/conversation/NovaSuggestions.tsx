import {
  ChevronRight, Ticket, Clock, Search, List, Zap, Users, Shield, PenLine, Inbox,
  TrendingUp, Gauge, Building2, TriangleAlert,
} from 'lucide-react';
import { ROLE_SUGGESTIONS, type NovaIcon, type UserRole } from '../novaSuggestions';

/* WHAT YOU COULD ASK — four cards under the greeting, reference-matched on feedback.
 *
 * ── THE CARD ─────────────────────────────────────────────────────────────────────────────────
 * A small boxed icon well on the left (a 28px hairline square, the glyph in muted ink), the title
 * over its one-line promise, and a chevron that only exists under the pointer. At rest the card
 * is a quiet hairline surface; under the pointer it gives ONE quiet response — the border tints
 * toward the accent, the glyph takes the accent, the chevron appears. Made minimal on feedback:
 * no halo, no accent bar, no tinted well. The dots behind the card answer the pointer too
 * (`.nova-grid-hi` in NovaDrawer), which is what makes the hover feel like the ground noticing
 * the cursor rather than a box changing colour.
 *
 * The icons are the SAME muted ink at rest — the per-row hues were retired with the card style;
 * the accent is the only colour the surface takes, and it takes it only when asked.
 *
 * ── THE STAGGER IS NOT DECORATION ────────────────────────────────────────────────────────────
 * They still deal out from behind the Core (`nova-deal`, `--deal` measured per row in
 * NovaDrawer), because the entry's whole argument is that the Core CAUSED everything else on
 * the screen. Cards that simply faded in would be four things that happened to arrive.
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
    <div className="mt-6" data-suggestions>
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
            <span className="nova-sugg-icon" aria-hidden="true"><Icon size={14} /></span>
            <span className="nova-sugg-text">
              <span className="nova-sugg-title">{c.title}</span>
              <span className="nova-sugg-sub">{c.subtitle}</span>
            </span>
            <span className="nova-sugg-chev" aria-hidden="true"><ChevronRight size={14} /></span>
          </button>
        );
      })}
    </div>
  );
}
