# Handoff — 2026-09-03 09:48

## Read first

Read the **Nova bullets in `CLAUDE.md`** (they start at "Nova is the Ask AI experience") before
touching anything under `src/app/ai/nova/`. The module roughly tripled this session and several of
its rules are load-bearing but invisible from the code — the two mounts, the clip the particle
field has to sit outside of, the coprime animation periods, and the type scale.

Then read **"UX Design Instructions"** at the very top of `CLAUDE.md`. Those 20 laws were added at
the user's explicit request and apply to every interface in this workspace, not just Nova.

## What we worked on this session

The Ask Nova experience, end to end: a new animated **Nova Core**, a rebuilt **empty state**, a
composable **response system** (headline → insight → structured data → evidence → actions →
follow-ups), and a final **restraint pass** that put the whole drawer on one type scale and one
8-point rhythm.

## Completed

- **UX laws saved.** The 20 laws are inserted verbatim at the top of **both** `Test4/CLAUDE.md`
  and this repo's `CLAUDE.md`, above the project heading, with the "do not apply mechanically"
  rule kept binding.
- **The Nova Core.** `AskAiOrb` now renders a `.nova-core` root above the clipped `.orb` mass, so
  a halo, an expanding ring and a 14-particle field live *outside* the clip. Motion is a grammar:
  direction = data flow, amplitude = attention, density/speed = effort, one flash = an event.
  Cursor and composer-focus drive it through CSS custom properties written on a ref.
  Wired into **both** `NovaShell` (the product) and `NovaHost` (the demo page).
- **Empty state.** Identity demoted to a 10px eyebrow, the greeting promoted to the hero, four
  large cards replaced by four borderless 40px rows, dot grid reduced from 1.0 → 0.42 (0.22 once
  a conversation exists).
- **Response system.** `conversation/blocks.tsx` (`Emph`, `NovaHeadline`, `NovaKeyValues`,
  `NovaDataTable`, `NovaMetrics`, `NovaInsight`); `AnswerObject` gained
  `headline` / `insight` / `kv` / `table` / `metrics`; `AnswerBlock` composes them. REQ-02 is now a
  5-row key/value grid, TEC-01 a ranked table, CXO-02 three metric cards.
- **New case CXO-07**, "Show me the trending HR cases" — the reference benchmark. Ranked table
  whose magnitude bar rides the count column, so the table *is* the chart.
- **Restraint pass.** One scale (12/14/16/22 with 16/20/24/32 line heights), one 8-point rhythm
  (32 spacing declarations, 5 distinct values, all multiples of 4), avatar 36 → 24px, checks
  collapsed to a ~40px summary, follow-up pills with no visible heading.

### Real bugs found and fixed (not stale tests)

- **No script ever emitted `step.sources`** — so the Sources tab built in an earlier session, and
  the new Sources section, could never render anything. REQ-01 and REQ-02 now carry them.
- **A draft answer had no headline**, so REQ-01 opened on the words "New incident" — the label of
  the object rather than the answer.
- **Retry was dead code.** `error.recoverable` was set by every error event and no caller ever
  passed `onRetry`. There is now `retryTurn` / `stopTurn` in the controller and one shared
  `NovaFailure` across all three views.
- **The primary action button had no `onClick` at all.**
- **Five of ten footer labels were questions rendered as a dismiss.** The script now declares
  `runAsks` / `cancelAsks`.
- **`activeIndex` would have left a row pulsing forever after a stop.**
- **`.nova-msg` was dropped in a rewrite**, leaving Copy / Edit query / Save prompt at opacity 0
  on every pointer device — in the DOM, in the tab order, invisible.

## In progress

Nothing mid-flight. Every suite is green and the working tree builds.

## Next steps

1. **Look at it.** Nothing below has been seen rendered — I can only drive the DOM. Spacing, the
   Core's motion, the table's bar weight and `prefers-reduced-motion` all need one pass by eye.
2. **Decide on the user-message treatment.** It has now been a right-aligned bubble, a full-width
   tinted container, and a tightened container with a 24px avatar. The current one matches the
   last instruction; it has not been seen.
3. **Delete or revive `NovaThinking.tsx`** — unreferenced since `NovaReveal` replaced it.
4. **Replace the placeholder identity.** `deriveRequester()` returns a hardcoded "Arnav Desai", so
   the greeting's name is not a logged-in user. One line to change when auth exists.
5. **Fix `CatalogItemDetailsModal.tsx:92`** — pre-existing (commit `66bd31a`), escaped quotes in
   raw JSX, imported by 18 drawers, returns 500 from the dev server. Not mine, still broken.

## Decisions made

- **Two mounts stay two mounts.** `NovaShell` (product) and `NovaHost` (demo) were kept separate
  so the harness can test what the product does not yet do — but every Core change must be applied
  to both. Wiring only `NovaHost` shipped an invisible change once this session.
- **The particle field lives outside `.orb`'s clip, and the clip stays.** Three independent design
  agents all concluded the clip made inward flow impossible. It did — so the field moved up a
  level rather than the clip coming off. The clip exists because a blur tail once painted over
  neighbouring cards; 3px dots have a ~2px tail and are safe outside it.
- **Hierarchy comes from weight and space before size.** The answer is 1.4× the body, not 2×, and
  the insight outranks the prose beneath it with no size step at all.
- **Follow-ups are pills with no visible heading**, per the reference screenshot. The heading is
  kept `sr-only`: shape and iconography identify the group visually and neither reaches a screen
  reader. ⚠️ Note the brief's §13 shows a visible "YOU COULD ALSO ASK" heading, which contradicts
  the later explicit instruction; the explicit instruction won.
- **Nothing is fabricated.** No "you have 3 tickets approaching SLA" line, because no honest
  source for that number exists in this prototype. The slot is wired and empty.

## Gotchas & notes

- **`vite build` proves nothing about behaviour** — esbuild strips types without checking them.
  Verification is jsdom + the project's non-hoisted esbuild, driven, not asserted from source.
- **Substring matching over source is only safe when the needle cannot occur in prose.** Three
  false positives this session: `'right'` inside "brighter", `'**inline emphasis**'` inside a code
  comment, and the comment *forbidding* `dangerouslySetInnerHTML` reading as a violation of it.
  Strip comments before scanning.
- **A CSS reader must resolve `var()` and match a rule to its own closing brace.** Most sizes here
  are tokens, and many rules are one-liners — slicing to the next `\n}` reads another rule's
  declarations and reports them as this one's.
- **Bash heredocs in this environment eat one backslash level.** `\\s` arrives as `s` and silently
  breaks every regex it lands in. Write patch scripts as files, or use character classes (`[ ]*`
  rather than `\s*`) so there is nothing to mangle.
- **Suites** (session scratchpad, not committed): scale 31 · response 44 · core 61 · convo 47 ·
  uxlaws 38 · pipeline 57 · pipeline2 29 · polish 51 · reveal 40 · cxo 31 · tec 9 · lengths 37 ·
  composer 36 · usecases 37 · nova 50 · novawire 19 — **617 checks, all passing**.
  `parsecheck.mjs` 323 files clean.
- **Twelve older assertions were rewritten, not deleted**, as the design changed under them. Green
  suites that no longer describe the product are worse than red ones.
