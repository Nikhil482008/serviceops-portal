import {
  ArrowUpRight, Bell, Bookmark, CircleCheck, CirclePause, CirclePlay, Clock, Eye, Hash, Link, Send,
  SquarePen,
} from 'lucide-react';
import type { ReactNode } from 'react';

/* THE ACTION ICONS — one per verb, named by what the action DOES.
 *
 * Named rather than passed as components so the name can travel in a turn's context (the user
 * turn for an action shows its icon) and be serialised, logged, or one day served. The same map
 * draws the icon on the attached button and on the reader's turn, so the two cannot disagree. */
export type DoIcon =
  | 'start' | 'open' | 'send' | 'hold' | 'apply' | 'link' | 'chase' | 'subscribe' | 'save' | 'reminder' | 'refs'
  /** Change something already proposed — the plan's second action. */
  | 'revise';

export function doIcon(name: DoIcon, size = 14): ReactNode {
  const p = { size, 'aria-hidden': true as const };
  switch (name) {
    case 'start': return <CirclePlay {...p} />;
    case 'open': return <ArrowUpRight {...p} />;
    case 'send': return <Send {...p} />;
    case 'hold': return <CirclePause {...p} />;
    case 'apply': return <CircleCheck {...p} />;
    case 'link': return <Link {...p} />;
    case 'chase': return <Bell {...p} />;
    case 'subscribe': return <Eye {...p} />;
    case 'save': return <Bookmark {...p} />;
    case 'reminder': return <Clock {...p} />;
    case 'refs': return <Hash {...p} />;
    case 'revise': return <SquarePen {...p} />;
    default: return null;
  }
}

export const isDoIcon = (v: unknown): v is DoIcon =>
  typeof v === 'string' && ['start', 'open', 'send', 'hold', 'apply', 'link', 'chase', 'subscribe', 'save', 'reminder', 'refs', 'revise'].includes(v);
