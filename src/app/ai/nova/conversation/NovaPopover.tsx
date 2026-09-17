import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/* THE ONE OVERLAY PATTERN for the header.
 *
 * The conversation menu and the dev-tools popover open the same thing: a panel anchored under
 * the control that opened it. One overlay rather than two, so learning one is learning both.
 *
 * ── ABOVE THE ORB, WHICH IS ABOVE THE DRAWER ────────────────────────────────────────────────
 * The orb flies in its own fixed layer OVER the drawer, so it can travel from the trigger into
 * the panel — which means nothing the drawer draws on itself can paint over the orb, and the
 * big greeting-phase orb showed straight through the first version of this panel. So it is
 * portaled to the body and pinned to its anchor's rect, at the evidence sheet's z-index, for
 * exactly the reason the sheet is.
 *
 * ── ESCAPE IS CAUGHT HERE, FIRST — UNLESS A FIELD OWNS IT ───────────────────────────────────
 * The drawer closes itself on Escape. This listens in the CAPTURE phase on window and swallows
 * the key, so one press closes the overlay and the drawer is still there. A descendant marked
 * `data-esc-local` (an inline rename, say) is skipped: cancelling an edit is not closing the
 * panel, and capture order means such a field could never win by stopping propagation.
 *
 * ── FOCUS GOES IN, AND COMES BACK ───────────────────────────────────────────────────────────
 * On open, focus lands on the element marked `data-autofocus`, else the first item, else the
 * panel; on close it returns to the control that opened it. Clicking that control while open
 * toggles it closed through its own handler, so it is excluded from the outside-click check —
 * otherwise mousedown would close and click would reopen.
 */

/** An element's rect, kept current across resizes — what a portaled layer pins itself to. */
export function useAnchorRect(anchor: HTMLElement | null | undefined): DOMRect | null {
  const [rect, setRect] = useState<DOMRect | null>(null);
  useLayoutEffect(() => {
    if (!anchor) return;
    const measure = () => setRect(anchor.getBoundingClientRect());
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [anchor]);
  return rect;
}

export function NovaPopover({ id, label, role = 'dialog', onClose, returnTo, anchor, width = 300, align = 'start', children }: {
  id: string;
  label: string;
  /** A menu of commands, or a dialog of controls. */
  role?: 'dialog' | 'menu';
  onClose: () => void;
  /** The control that opened this — focus returns to it. */
  returnTo?: HTMLElement | null;
  /** What the panel hangs under. */
  anchor?: HTMLElement | null;
  width?: number;
  /** Which edge of the anchor the panel lines up with. */
  align?: 'start' | 'end';
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const rect = useAnchorRect(anchor);

  useEffect(() => {
    const el = ref.current;
    const first = el?.querySelector<HTMLElement>('[data-autofocus]')
      ?? el?.querySelector<HTMLElement>('[data-nav-item]:not([disabled])')
      ?? el;
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      /* A field being edited inside the panel owns Escape — cancelling an edit must not also
         close the panel around it. This listener is on `window` in the CAPTURE phase (so one
         press closes the panel and not the drawer behind it), and capture runs window → target,
         so the field's own stopPropagation could never get in first. It declares itself
         instead. */
      const t = e.target as HTMLElement | null;
      if (el && t && el.contains(t) && t.closest('[data-esc-local]')) return;
      e.stopPropagation();
      e.preventDefault();
      onClose();
    };
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (el && !el.contains(t) && !(returnTo && returnTo.contains(t))) onClose();
    };
    window.addEventListener('keydown', onKey, true);
    document.addEventListener('mousedown', onDown);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      document.removeEventListener('mousedown', onDown);
      returnTo?.focus();
    };
  }, [onClose, returnTo]);

  if (typeof document === 'undefined') return null;
  const style = rect && rect.width > 0
    ? {
      left: Math.max(8, align === 'end' ? rect.right - width : rect.left),
      width,
      top: rect.bottom + 4,
      maxHeight: `min(560px, ${Math.max(200, window.innerHeight - rect.bottom - 20)}px)`,
    }
    : { width };
  return createPortal(
    <div
      ref={ref}
      className="nova-pop nova-scroll"
      style={style}
      role={role}
      aria-label={label}
      data-pop={id}
      tabIndex={-1}
      onKeyDown={onListKeys}
    >
      {children}
    </div>,
    document.body,
  );
}

/** ↑ / ↓ move through the items, wrapping; Home / End jump. Disabled items are skipped. On the
 *  POPOVER root, so a search box or heading above the items is inside its reach. Items are
 *  whatever carries `data-nav-item`. */
export const onListKeys = (e: React.KeyboardEvent): void => {
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
  const items = [...(e.currentTarget as HTMLElement).querySelectorAll<HTMLElement>('[data-nav-item]')]
    .filter((el) => !el.hasAttribute('disabled'));
  if (!items.length) return;
  e.preventDefault();
  const i = items.indexOf(document.activeElement as HTMLElement);
  const next = e.key === 'Home' ? 0
    : e.key === 'End' ? items.length - 1
      : e.key === 'ArrowDown' ? (i + 1) % items.length
        : (i - 1 + items.length) % items.length;
  items[next].focus();
};

/** A DIALOG LAYER over the drawer: the scrim covers the panel's rect and nothing else, so it
 *  reads as the drawer dimming rather than the page. Same portal, same reason as the popover. */
export function NovaLayer({ anchor, onScrimDown, children, ...attrs }: {
  anchor?: HTMLElement | null;
  onScrimDown?: () => void;
  children: ReactNode;
} & Record<`data-${string}`, string | undefined>) {
  const rect = useAnchorRect(anchor);
  if (typeof document === 'undefined') return null;
  const style = rect && rect.width > 0
    ? { left: rect.left, top: rect.top, width: rect.width, height: rect.height }
    : undefined;
  return createPortal(
    <div
      className="nova-modal-scrim"
      style={style}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onScrimDown?.(); }}
      {...attrs}
    >
      {children}
    </div>,
    document.body,
  );
}
