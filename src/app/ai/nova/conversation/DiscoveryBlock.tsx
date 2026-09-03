import type { FeedDiscovery } from '../turnModel';

/* FOUND SOMETHING — the thing that makes waiting feel like watching work rather than watching a
 * spinner.
 *
 * ── WHY IT LIVES ONLY DURING THE INVESTIGATION ───────────────────────────────────────────────
 * A finding has two jobs and they belong to two moments. WHILE NOVA IS WORKING it is engagement:
 * proof that something real is being turned up, delivered before anyone asked. ONCE THERE IS AN
 * ANSWER the same fact becomes justification, and it belongs under "Why Nova says this".
 *
 * So it is rendered here only while the turn is open, and EvidenceBlock takes over afterwards.
 * Printing it in both places was the redundancy that made the response read as a wall: the
 * reader met every finding twice and had to work out whether the second copy was new.
 */
export function DiscoveryBlock({ discoveries }: { discoveries: FeedDiscovery[] }) {
  if (!discoveries.length) return null;
  return (
    <section className="mt-3.5">
      <h4 className="nova-t-label text-[var(--nova-found)]">
        Found something
      </h4>
      {/* One of only TWO live regions in the drawer, and the rule for both is the same: announce
          what is worth interrupting for, and nothing else. Steps tick several times a minute, so
          announcing each one makes this unusable with a screen reader. A finding qualifies; so
          does a clarifying question, which is the other one — see `AskUserQuestion`, where the
          stream is actually blocked until the reader deals with it. */}
      <div className="mt-1.5 space-y-2" aria-live="polite">
        {discoveries.map((d) => (
          <div key={d.id} className="nova-disc">
            <p className="nova-t-body ask-w-500">{d.headline}</p>
            <p className="nova-t-meta mt-0.5">{d.detail}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
