/* THE CHIP — drawn from the palette, one recipe for every family.
 *
 * The reference draws a chip three ways and only three: tint at −10, dot at −60, text at the
 * family's own text shade. This component is that recipe and nothing else. Which FAMILY a chip
 * wears is the only decision left, and it is made here, once, in tables — so a priority is red
 * everywhere it is a priority, and no card gets to pick its own shade of "high".
 *
 * ── WHICH FAMILY MEANS WHAT ──────────────────────────────────────────────────────────────────
 * The reference assigns the first seven families itself: Red is Danger, Orange is Warning,
 * Yellow is Caution, Green is Success, Blue is Brand and information, Purple is AI. The last
 * five are categories, and two of those are already spoken for (Indigo = LDAP source, Teal =
 * SCIM source). What this module has to name are its own categories — the three personas — and
 * it takes the three free category families for them, in the order the palette lists them.
 *
 * A REFERENCE (INC-0611) IS NOT A CHIP. It is a monospace tag, because it is an identifier and
 * not a state; `RefChip` stays as it is.
 */
import { type ReactNode } from 'react';

export type ChipFamily =
  | 'neutral' | 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple'
  | 'indigo' | 'teal' | 'magenta' | 'cyan' | 'lime';

export function NovaChip({ family = 'neutral', children, dot = true, size, title }: {
  family?: ChipFamily;
  children: ReactNode;
  /** The −60 dot. On by default; off for a chip whose family is decorative rather than a state. */
  dot?: boolean;
  size?: 'sm';
  title?: string;
}) {
  return (
    <span className="nova-chip" data-family={family} data-size={size} title={title}>
      {dot && <span className="nova-chip-dot" aria-hidden="true" />}
      {children}
    </span>
  );
}

/* ── THE TABLES ──────────────────────────────────────────────────────────────────────────── */

/** Priority. P1 and Critical are danger; High too — a reader's eye should land on them first.
 *  Medium is a warning, P3 the everyday case is caution-coloured only where the store calls it
 *  Medium; Low and P4 are neutral, because a low priority is not a state to notice. */
export const priorityFamily = (p: string | undefined): ChipFamily => {
  const v = (p ?? '').toLowerCase();
  if (v === 'p1' || v === 'critical' || v === 'high') return 'red';
  if (v === 'p2' || v === 'medium') return 'orange';
  if (v === 'p3') return 'yellow';
  return 'neutral';
};

/** Status. Open is information (Blue); anything WAITING is caution — the ticket is not wrong,
 *  it is parked, and a reader should know that at a glance; Resolved is success; Closed and
 *  everything else is neutral. In progress is Cyan: a category colour for "being worked", so it
 *  reads as activity without borrowing a state it does not have. */
export const statusFamily = (s: string | undefined): ChipFamily => {
  const v = (s ?? '').toLowerCase();
  if (v === 'open') return 'blue';
  if (v === 'in progress') return 'cyan';
  if (v.startsWith('waiting') || v.startsWith('pending') || v === 'on hold') return 'yellow';
  if (v === 'resolved') return 'green';
  return 'neutral';
};

/** The three personas, on the three category families the design system leaves free. */
export const personaFamily = (p: string | undefined): ChipFamily => {
  const v = (p ?? '').toLowerCase();
  if (v === 'requester') return 'cyan';
  if (v === 'technician') return 'lime';
  if (v === 'leadership') return 'magenta';
  return 'neutral';
};
