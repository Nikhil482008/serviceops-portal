# Handoff — 2026-08-19 21:37

## Read first

`CLAUDE.md` → the **BOM dashboard shared pieces** bullet, the **click-through two rules** bullet,
and the **two data rules in `bomData.ts`** bullet. Those three carry everything a change to this
module can accidentally undo. For the reasoning behind each decision (and the losses recorded
along the way), `../../BOM/HANDOFF.md` is the narrative — it was updated as the session went.

## What we worked on this session

The BOM dashboard, end to end, across roughly twenty-five requested changes — layout, wording,
click-through, and two data bugs found underneath them. Then one larger feature: a shared
CI-selection flow for the Scheduler and Retention editors in the `bom-admin` prototype.

## Completed

**Dashboard layout** — settled at three bands: KPIs, then `Components with highest exposure ·
Licence distribution · Managed paths` (3-up), then `Expiring trust material · Deprecated AI models`
(2-up). Every `Card` header is a fixed 50px so all bodies start at the same y — they never were
before. Page subtitle and several footer paragraphs removed.

**Deprecated AI models** rebuilt as a **diverging end-of-life axis** (`EolTimeline`): one shared
scale, fixed −450 → +180 domain, outliers clamped with a cut-to-a-point end, a single rule at zero.
It replaced a column that drew two different measurements — "how far overdue" and "how much life
left" — with no scale in common.

**Licence distribution** gained an **SBOM/CBOM switch**. CBOM has no licence data, so the switch
changes what the card counts (algorithms + post-quantum posture), not just its filter. The control
sits **out of flow** in the chart's top-left corner: in flow it would push the ring down and the
ring on the card beside it would not follow.

**Managed paths** splits by product — NextGen · ServiceOps · FlotoMate · ObserveOps — with each
path's product a **hash of its own identity**, not a random draw, so the ring is identical on every
render and the suite can assert it.

**Click-through** on two rules: a row opens its detail page, a slice opens the list behind its
count (`BomComponentListDrawer`), whose rows open details.

**Elsewhere** — Sources chips in the components register took the License chip's neutral grey; the
ingest panel's Product name became a combobox with free text marked "New product"; the BOM flyout
was reordered with three entries hidden (not deleted).

**`bom-admin` prototype** — a shared **CI-selection section** in the Schedule and Retention
editors: State 0 is one `+ Add CIs` button opening a real menu; State 1 is a summary with Edit,
plus a button naming the *other* method and a caret to the full choice. Existing pickers reused,
both given back arrows.

## In progress

Nothing mid-flight. Every change is built, verified and left green.

## Next steps

1. **One manual devtools pass** on the dashboard at three widths. jsdom has no layout, so bar
   geometry, ring alignment and the fixed header height are asserted as *construction*, not pixels.
2. **Decide the losses.** Several things were removed at request and are recorded as `KNOWN
   REMOVAL` checks rather than deleted — most importantly the AI panel's "N models · no EOL data"
   line (nine of fourteen models publish no EOL date and the panel now reads as complete) and the
   licence card's Denied/Restricted/Undeclared states. Each is one line to restore.
3. **Dashboard 2's AI panel** still uses its own fitted-span treatment. The two dashboards now
   disagree about how a model lifecycle is drawn.
4. **`ngrok`** was attempted and dropped — see Gotchas if it comes back.

## Decisions made

- **The list behind a count comes from the charts' own population**, not `SOFTWARE_COMPONENTS`.
  That register is 12 hand-authored rows; the donut counts 711. Clicking "167" and getting six is
  the failure this module is built against.
- **A generated component version does not inherit the catalogue entry's CVEs.** An advisory
  applies to a version *range*, and the spread was attaching it to the very versions that would be
  the fix. No range data exists in the fixture, so the catalogue version carries the finding.
- **CI targeting became one method per rule.** `targetIds` used to union automatic and hand-picked;
  `BOM/CLAUDE.md` already described the Scheduler as having two intents, so the code and the doc
  disagreed and the doc won. Checked the seeds first — none carries both.
- **"Randomly" was implemented as a stable hash.** A chart that redraws differently between two
  renders is not a reading, and `Math.random()` would make every check unrepeatable.
- **Deviations flagged, not hidden.** Day labels sit outside their bars (white-on-fill fails AA);
  the ring caption dropped to 8px, below the design system's scale; the licence heading now names
  something the CBOM view does not show. All three are recorded in the suites.

## Gotchas & notes

- **`vite build` does not typecheck.** Behaviour is verified by bundling with the project's esbuild
  and driving it in jsdom. The `bom-admin` prototype is a vanilla page, so jsdom runs the real
  document — a page whose script dies at load still renders its markup and passes every static check.
- **Check misattribution is the recurring trap here.** Several checks matched the right *string* on
  the wrong *element*: four asserted "the components card carries its scale line" while actually
  matching the licence card's footer several panels away; another proved "Dashboard 1 keeps its
  ranked list" by testing for caption wording that has since changed three times. **A
  `body.includes` on a page with fifteen panels is not a claim about a card.** Every panel is now
  found by its own `h3` (`panelOf`) — the previous lookup, `txt(card).startsWith(title)`, assumed
  nothing is ever drawn before the title, and one control broke ten lookups at once.
- **Escape bubbling.** In the admin prototype the page has a global unwinder that knows nothing
  about a menu, so one press closed two layers until the menu started stopping the event.
- **ngrok:** winget ships 3.3.1, the account needs ≥3.20.0; `ngrok update` fetched 3.39.11 and
  **Windows Defender then refused to run it** as potentially-unwanted software. Not worked around —
  that is the machine owner's call. If retried, Vite 6 also needs `server.allowedHosts` for the
  tunnel host or it answers "Blocked request" and nothing else.
- **Suites** live in the session scratchpad: `dashcheck` (484), `dash2check` (145), `aicheck` (226),
  `ingestcheck` (92), `cicheck` (76, the new CI-selection flow), `admbomcheck` (172), plus
  `kpicheck`, `managecheck`, `drawercheck`, `ovcheck`, `bomprobe`, `chaincheck`. All green.
- **`public/` is not what the built app serves** — `dist/` is. Run `npm run build` before judging a
  change to `public/bom-admin/index.html`; this session's build was confirmed byte-identical.
