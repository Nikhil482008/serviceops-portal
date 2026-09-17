import { Search } from 'lucide-react';
import { NovaOrb } from '../NovaOrb';
import { NovaBoxesLoader } from './NovaBoxesLoader';

/* WHAT NOVA SAID.
 *
 * ── AN IDENTITY ROW, NOT A GUTTER ────────────────────────────────────────────────────────────
 * The previous version put a silent orb in a 32px gutter with a hairline running down from it.
 * It said "a different speaker" but never said WHO, and the spine turned three loosely related
 * blocks into one undifferentiated run — the opposite of what it was for.
 *
 * A named row costs one line and does the whole job: the orb for recognition, the name for
 * certainty, the time for orientation. Everything Nova produces then hangs beneath it, indented
 * to the name, so grouping comes from alignment rather than from a drawn line.
 *
 * ⚠️ NOT A CARD. The brief is explicit and it is right: a card around the whole response makes
 * the answer, the working and the actions one object, which is what forced readers to parse it
 * as a wall. The layers separate themselves — see AnswerBlock / EvidenceBlock / ActionGroup.
 *
 * ── ONE THINKING MARK, EVERYWHERE ────────────────────────────────────────────────────────────
 * While a turn is running the orb's slot carries the BOXES loader instead of the orb —
 * before the name, in the accent, whatever the row goes on to SAY (the phase, the topic, or the
 * bare "Working"). Every case shares this row, so that is the whole of "across all use cases":
 * there is no per-view spinner to keep in step, and nothing below it spins at all. The moment
 * there is an answer the row is exactly what it was before: orb, name, timestamp.
 *
 * ⚠️ THE SLOT DOES NOT RESIZE. The loader is bigger than the orb and is centred on the same
 * 20px slot with zero size of its own, so the row's height — and every row beneath it — is
 * identical whether Nova is thinking or done.
 */

/** THE GUTTER MARK, one number. Drawn at 14px inside the 20px slot the row has always
 *  reserved, so the mark is the size it should be and every row keeps the height it had. */
const NOVA_MARK = 14;

/** Orientation, not precision. Down to the minute it would be noise in a thread you are reading
 *  in real time; an hour later "14:32" is what you actually want. */
function stamp(at: number, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - at) / 1000));
  if (s < 60) return 'Just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  return new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function NovaMessage({ startedAt, working, activity, phase, lead, children }: {
  startedAt: number;
  /** Something is still happening. The orb keeps its investigating state so the identity row
   *  itself carries the liveness, and no second spinner is needed anywhere below it. */
  working: boolean;
  /** WHAT is happening, when the view can say so — the topic, worn in the slot "Working"
   *  otherwise occupies. "Working" is the fallback, not a second line: a row that can name the
   *  subject has no business also saying the generic word. */
  activity?: string;
  /** A NAMED PHASE that owns the slot outright — "Planning your night-shift handover",
   *  "Plan ready", "Executing the approved plan". A full phrase, so no prefix is added. */
  phase?: string;
  /** THE ROW LEADS. The work is over and the first line of the content — "Thought for 10s ·
   *  Reviewed …" — takes this row's place. */
  lead?: boolean;
  children: React.ReactNode;
}) {
  /* ── THE ROW LEADS ──────────────────────────────────────────────────────────────────────
     Once the work is over there were two header lines, one above the other: "Nova · Just now"
     and then "Thought for 10s · Reviewed …". The second already says whose message this is and
     what happened in it, so the first steps aside: the thinking row sits where the name did,
     beside the orb — the one mark of who is speaking, kept — and the name and the time go with
     the line they were on. The column keeps its indent, so nothing beneath it moves. */
  if (lead) {
    return (
      <div data-nova-lead>
        <h3 className="sr-only">Nova replied</h3>
        <div className="flex items-start gap-2">
          <span
            className="relative flex size-5 flex-shrink-0 items-center justify-center overflow-visible"
            /* Centred on the row's FIRST line: (row height − orb) / 2, from the tokens the row
               is set in, so it tracks the type scale rather than a magic number. */
            style={{ marginTop: 'calc((var(--ask-fs-base) * 1.55 + 8px - 20px) / 2)' }}
            aria-hidden="true"
          >
            <NovaOrb size={NOVA_MARK} still state="settled" />
          </span>
          {/* The same 28px the identity row's name sits at — orb plus gap — so the answer
              beneath is aligned exactly as before. */}
          <div className="min-w-0 flex-1">{children}</div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h3 className="sr-only">Nova replied</h3>

      {/* QUIET. The name is the same size as the body and the timestamp a step below it — an
          identity row that grows with the answer starts competing with it, and nobody opens an
          assistant to read its name. */}
      <div className="flex items-center gap-2">
        <span className="relative flex size-5 flex-shrink-0 items-center justify-center overflow-visible">
          {working
            ? <NovaBoxesLoader size={35} />
            : <NovaOrb size={NOVA_MARK} still state="settled" />}
        </span>
        <span className="nova-t-head">Nova</span>
        <span className="ask-text-sm text-[var(--nova-ink-muted)]" aria-hidden="true">·</span>
        {working && phase ? (
          <span className="min-w-0 truncate ask-text-sm ask-w-500 text-[var(--nova-ink)]">{phase}</span>
        ) : working && activity ? (
          <span className="flex min-w-0 items-center gap-1.5 ask-text-sm text-[var(--nova-ink-muted)]">
            <Search size={12} className="flex-shrink-0 text-[var(--nova-text-muted)]" aria-hidden="true" />
            <span className="min-w-0 truncate">
              Looking into <span className="ask-w-500 text-[var(--nova-ink)]">{activity}</span>
            </span>
          </span>
        ) : (
          <span className="ask-text-sm text-[var(--nova-ink-muted)]">
            {working ? 'Working' : stamp(startedAt)}
          </span>
        )}
      </div>

      {/* Indented to the name. This is the ONLY grouping device for Nova's side — no border,
          no fill, no spine. */}
      <div className="min-w-0" style={{ marginLeft: 'var(--nova-indent)', marginTop: 'var(--nova-gap-block)' }}>
        {children}
      </div>
    </div>
  );
}

export const __stampForTest = stamp;
