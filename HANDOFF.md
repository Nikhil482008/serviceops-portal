# Handoff — 2026-08-20 05:06

## Read first

`CLAUDE.md` → the **CI targeting** bullet (the model changed twice this session and the second
change reverted the first), the **`ruleAutoIds` / `ruleHits`** bullet (two resolvers on purpose
— do not collapse them), and the **BOM dashboard shared pieces** bullet. For the reasoning
behind every decision below, and the record of what was deleted, `../../BOM/HANDOFF.md` is the
narrative — it was updated continuously as the session went and is much longer than this file.

## What we worked on this session

Almost entirely `public/bom-admin/index.html` — the **BOM Management** screens (Licensing,
Scheduler, Retention, BOM Policies). Two model corrections, one large UI standardisation pass,
and three real bugs found by driving the page rather than reading it.

## Completed

**CI selection — the model, corrected twice.** It went to *one method per rule*, then the user
corrected that: automatic and manual **combine**. `targetIds` is their union again, and
**`ciSnapshot` is the single read** behind the rows, the overlap and the coverage total, so the
numbers on screen cannot disagree. The add block offers what is **missing** (`+ Add CIs` →
`+ Also add by CI type` / `+ Also add specific CIs` → hidden when both are set), and rows state
**counts and criteria, never hostnames** — a name list does not survive 100 CIs.

**Reuse redefined.** "Use a BOM Policy" became **"Reuse an existing rule"** — a rule configured
in *another module*, grouped by source, excluding the module being edited. That makes resolution
recursive and therefore cyclable, so both resolvers carry a `seen` set: **`ruleAutoIds`**
(enrolment-intersected — Scheduler, Retention) and **`ruleHits`** (discovered estate —
Licensing, because it hands out the seats). Rolled out to all three editors; the BOM-Policy
chooser had no mount left and was deleted.

**Chrome, swept.** Every drawer/modal header in BOM Management is title + close; evidence that
existed nowhere else moved to `.dw-cap` captions or the footer (the full before/after table is in
`BOM/HANDOFF.md`). Section headings lost their em-dash appendages to ⓘ buttons. The three page
sub-lines are one short line each.

**Retention rule drawer** says "rule" everywhere, in two folds (Schedule/Retention policy +
Coverage), with the whichever-comes-first mechanic in an ⓘ and per-field `default` tags.

**KPI cards** on Scheduler and Retention moved onto the **product standard** (`BOM/CLAUDE.md` §4,
`BomKpiCard.tsx`): two lines, header action revealed on hover *and* focus and pinned on touch,
ⓘ definition, at most one chip, context that truncates first.

**One enabled/disabled switch** across all four screens (`toggleHTML`), replacing four
verb-labelled text buttons; **a disabled schedule policy can no longer be Run now**.

**Two clipping bugs fixed.** Tooltips became a document-level fixed layer (they were clipped by
`.dw-body` and cut off at the drawer edge). The toolbar and table header now stick under the
topbar.

## In progress

Nothing mid-flight. Everything is built, verified and left green.

## Next steps

1. **Close the KPI gap:** Licensing and BOM Policies are still on the prototype's older
   bottom-action card grammar, so the module now shows two card shapes. Asserted as a KNOWN GAP
   in `admkpicheck.mjs` so it cannot be mistaken for conformance.
2. **One manual devtools pass.** jsdom has no layout, so every geometry claim this session —
   the sticky offsets, the one-line coverage preview truncating, the KPI row's `flex:none`
   behaviour, tooltip clamping — is asserted as *construction*, not pixels.
3. **Settle the BOM Policy story.** Reuse now means "another module's rule", which contradicts
   `BOM/CLAUDE.md`'s "one policy drives rules in three modules". Policies still exist and legacy
   `policyId` still resolves, but the reusable-audience idea has two shapes and only one is
   reachable from the drawers.
4. **Decide the recorded removals** — every deletion is a `KNOWN REMOVAL` check rather than a
   silent drop. Most notable: the picker's "only licensed CIs can be targeted" scope line, and
   the "Applies to" column's kind pill.

## Decisions made

- **`ciSnapshot` is the single read.** Rows, overlap and total come from it, so a naive
  `auto + manual` is structurally impossible.
- **Two resolvers, deliberately.** Licensing counts the discovered estate; the other two count
  the enrolled set. Collapsing them would make one module lie.
- **The count is the affordance.** Where chrome was deleted (the coverage card, the preview
  card), the number itself became the link, so no drawer became unreachable.
- **Removals are recorded, not silent.** Every deleted line has a `KNOWN REMOVAL` check naming
  what went and where the fact now lives.
- **Deviations are stated.** The Scheduler's switch card breaks the KPI standard twice (a state,
  not a number; a pinned action) — both with reasons beside the code.

## Gotchas & notes

- **A broken template renders NOTHING and logs nothing.** Every renderer is wrapped in a
  try/catch that logs and moves on, so an empty card row is the only symptom. I broke the
  Retention row with **backticks inside an HTML comment inside a template literal** and only
  caught it because a suite calls each renderer directly. `admkpicheck.mjs` now does that by
  design.
- **`overflow-x:auto` makes a box a scroll container on BOTH axes** (CSS computes the visible
  axis to `auto`), which is why the sticky table header never worked. `overflow-y:clip` keeps
  the sideways scrolling without creating a scroll container.
- **Check misattribution, twice more.** A grep for "never say *automatically*" matched its own
  rationale comment; another asserted the shared CSS existed rather than the result on the
  screen being ported to, which is how Licensing shipped without the option gap.
- **Suites live in the session scratchpad** (`cicheck` 188, `admbomcheck` 174, `condcheck` 116,
  `admkpicheck` 111, `schedcheck` 76, `liccheck` 61, `headcheck` 54, `tglcheck` 40, `tipcheck`
  30, `admincheck` 18, `rtsame` 17) — all green.
- **`public/` is not what the built app serves** — `dist/` is. Run `npm run build` before
  judging a change to `public/bom-admin/index.html`.
