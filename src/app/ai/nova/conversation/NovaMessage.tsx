import { AskAiOrb } from '../AskAiOrb';

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
 */

/** Orientation, not precision. Down to the minute it would be noise in a thread you are reading
 *  in real time; an hour later "14:32" is what you actually want. */
function stamp(at: number, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - at) / 1000));
  if (s < 60) return 'Just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  return new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function NovaMessage({ startedAt, working, children }: {
  startedAt: number;
  /** Something is still happening. The orb keeps its investigating state so the identity row
   *  itself carries the liveness, and no second spinner is needed anywhere below it. */
  working: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="sr-only">Nova replied</h3>

      {/* QUIET. The name is the same size as the body and the timestamp a step below it — an
          identity row that grows with the answer starts competing with it, and nobody opens an
          assistant to read its name. */}
      <div className="flex items-center gap-2">
        <AskAiOrb size={20} still={!working} state={working ? 'investigating' : 'settled'} />
        <span className="nova-t-head">Nova</span>
        <span className="ask-text-sm text-[var(--nova-ink-muted)]" aria-hidden="true">·</span>
        <span className="ask-text-sm text-[var(--nova-ink-muted)]">
          {working ? 'Working' : stamp(startedAt)}
        </span>
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
