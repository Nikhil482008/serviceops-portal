# Handoff — 2026-08-20 14:38

## Read first

`CLAUDE.md` → the **sticky headers** bullet (the scroll-container rule bit twice this session
and my first fix made it worse) and the **two lists name the BOM modules** bullet. Then the
**CI targeting** and **`ruleAutoIds` / `ruleHits`** bullets, which the earlier part of this
session rewrote. For the reasoning behind every decision and the record of what was deleted,
`../../BOM/HANDOFF.md` is the narrative — it is much longer than this file and was updated
continuously.

## What we worked on this session

`public/bom-admin/index.html` — the **BOM Management** screens (Licensing, Scheduler, Retention,
BOM Policies) — plus one React-side change. Two model corrections, a UI standardisation pass
across every screen, a table audit against `DESIGN.md` §4, and several bugs found by driving the
page rather than reading it.

## Completed

**CI selection & reuse** — automatic and manual **combine** (`ciSnapshot` is the single read
behind the rows, the overlap and the coverage total); rows state counts and criteria, never
hostnames; the add block offers what is missing. **Reuse** means a rule configured in *another
module*, resolved recursively with a cycle guard through **`ruleAutoIds`** (enrolment scope) and
**`ruleHits`** (discovered scope — Licensing hands out the seats). Rolled out to all three
editors; the BOM-Policy chooser had no mount left and was deleted.

**Chrome** — every drawer/modal header is title + close, with evidence moved onto the content it
describes; section headings lost their em-dash appendages to ⓘ buttons; the three page sub-lines
are one short line each; the retention rule drawer is two folds and says "rule" everywhere.

**KPI cards** on Scheduler and Retention moved onto the **product standard** (two lines, header
action revealed on hover *and* focus and pinned on touch, ⓘ definition, one chip, truncating
context). The default-policy card shows **both** limits as the figure — *10 versions or 90 days*.

**One enabled/disabled switch** across all four screens; a disabled schedule policy can no longer
be Run now, and the Run button now *looks* unavailable rather than merely being inert.

**Tables** — audited against `DESIGN.md` §4. The CSS was already right; the inconsistencies were
terminology (the page still said "Exception" after the drawer was renamed), layout (Retention's
toolbar sat outside its card while the Scheduler's sat inside), headers (a blank Actions header;
the same count labelled *Coverage* on one table and *Applies To* on the other) and widths.

**Fixes** — tooltips became a document-level fixed layer; the sticky toolbar and table header
work in both mounts; the chevron came off the Add CIs block; `.govby`'s anchor stopped falling
through to the browser-default blue underline; **BOM Policies is hidden** from the hub *and* from
`adminData.ts`.

## In progress

Nothing mid-flight. Everything is built, verified and left green.

## Next steps

1. **Close the KPI gap** — Licensing and BOM Policies are still on the older bottom-action card
   grammar, so the module shows two card shapes. Asserted as a KNOWN GAP in `admkpicheck.mjs`.
2. **One manual devtools pass, in the EMBEDDED mount.** jsdom has no layout, so every geometry
   claim is asserted as construction. The sticky headers in particular were wrong twice and are
   only provable by eye.
3. **Settle the BOM Policy story** — reuse now means "another module's rule", which contradicts
   `BOM/CLAUDE.md`'s "one policy drives rules in three modules". Nothing is broken; the idea just
   has two shapes now, and only one is reachable.
4. **Decide the recorded removals** — every deletion is a `KNOWN REMOVAL` check. Most notable:
   the picker's "only licensed CIs can be targeted" line, and the Applies-to kind pill.

## Decisions made

- **`ciSnapshot` is the single read**, so a naive `auto + manual` is structurally impossible.
- **Two resolvers on purpose** — Licensing counts the discovered estate, the other two the
  enrolled set. Collapsing them would make one module lie.
- **The count is the affordance** — where chrome was deleted, the number itself became the link,
  so no drawer became unreachable.
- **Removals are recorded, never silent** — each has a `KNOWN REMOVAL` check naming what went and
  where the fact now lives.
- **Deviations are stated** — the Scheduler's switch card breaks the KPI standard twice, both
  with reasons beside the code.

## Gotchas & notes

- **A broken template renders NOTHING and logs nothing.** Every renderer is wrapped in a
  try/catch that logs and moves on, so an empty card row is the only symptom. Backticks inside an
  HTML comment inside a template literal did exactly that. `admkpicheck.mjs` now calls each
  renderer directly so the throw is the failure.
- **Scroll containers**: either axis non-`visible` makes one. This cost two attempts — see
  `CLAUDE.md`.
- **Check misattribution, repeatedly.** Checks that matched the right string on the wrong
  element; a grep that matched its own rationale comment; assertions that the shared CSS existed
  rather than the result on the screen being ported to; and two checks that asserted the
  declaration I had written rather than the behaviour I wanted. **Assert the behaviour, on the
  screen under test.**
- **Suites in the session scratchpad**: `cicheck` 188, `admbomcheck` 175, `condcheck` 116,
  `admkpicheck` 111, `schedcheck` 76, `headcheck` 61, `liccheck` 61, `tablecheck` 49, `tglcheck`
  40, `tipcheck` 30, `admincheck` 18, `rtsame` 17, `admdatacheck` 11 — all green.
- **`public/` is not what the built app serves** — `dist/` is. Run `npm run build` before judging
  a change to `public/bom-admin/index.html`.
