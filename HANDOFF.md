# Handoff — 2026-09-17 16:35

## Read first
CLAUDE.md's Nova bullets, in this order:

1. **THE ACTION DOCK** — `nova/dock/ActionDock.tsx` and its four selectors. It changed for
   every persona this session.
2. **THE LEADERSHIP ANSWER** — `conversation/LeadershipCharts.tsx` (`ChartFrame`, `InsightLine`),
   the insight layer at the foot of `nova/mockAnalytics.ts`, and `scripts/leadershipScripts.ts`.
   A CXO answer's insight now lives in exactly one element.
3. **THE ORB** — `components/ui/siri-orb` + `nova/NovaOrb.tsx`, and the deliberate second
   construction `nova/AskAiCore.tsx`.
4. **THE ENTRY POINT** — `ai/NovaHandle.tsx`.
5. **THE REPHRASE** — `nova/novaRephrase.ts`.

`DESIGN.md` still governs type/radius/buttons. Measurements live beside their CSS in
`src/styles/theme.css`, each under its own `/* == SECTION */` banner.

## What we worked on this session
**One surface per job.** Three passes, all the same idea: when a thing is offered in two places,
pick one. **Actions** — the dock and the band the requester already had are now the ONLY way an
action is offered, on every persona; the technician's attached actions and the floating ask-chip
strip were removed. **Charts** — the ChartFrame header became *title · Chart type · ⋯*, and the
bare sentence under every visual became an `InsightLine` whose rail colour is computed from the
data. **Insights** — the blue-rail callout went, because on CXO-02 it printed the chart's own
fact a second time on the same turn.

## Completed

### ActionDock is the single action surface
- **`dock/RequesterDock.tsx` → `dock/ActionDock.tsx`**, with a `persona` prop. Both shapes are
  unchanged: the same verb tiles, go-arrows, soft recommended treatment, the same
  "Nova can do this for you" header with ×, the same one-row band fused to the top of the box.
- **FOUR SELECTORS, ONE SHAPE.** Each persona already derived its actions somewhere; they now all
  arrive as `NextStep[]` at one place, for the LATEST turn only:

  | | selector | notes |
  |---|---|---|
  | a parked plan | `dock/planSteps.ts` | asked FIRST — a turn waiting on a plan has no answer, and the other three walk past it |
  | leadership | `dock/leadershipSteps.ts` | each CXO case's own authored follow-ups |
  | technician | `dock/techSteps.ts` over the **unchanged** `tech/techActions.ts` | the meta becomes the detail line |
  | requester | `dock/nextSteps.ts` | untouched |

- **Deleted:** `tech/AttachedActions.tsx` (the └ connector, the "NOVA RECOMMENDS" eyebrow, the
  inline chip stack) and `tech/TechAskChips.tsx` (the floating ask strip). 104 lines of CSS with
  them. The relabel crossfade survived — it moved into the dock row.
- **`PlanCard` draws no actions.** TEC-07 was the last turn in the product whose actions lived
  somewhere other than where every other turn's did.

### Module rules, now true on every persona
- Latest turn only; never during an investigation; past turns offer nothing — expressed by
  **absence** rather than by greying, because the dock is not inside the turn.
- Exactly one recommended action, always first.
- **Four rows at most, plus "Ask something else."** Do-actions outrank asks; an over-cap ask is
  dropped **disabled-first**, then from the end of the authored order.
- Carry-forward unchanged: remaining valid do-actions ride onto the new turn's dock.
- × folds to the band, the band re-expands, the band's own × dismisses for the current turn.
- Keyboard: 1–4 run rows, `/` opens the composer, **Cmd/Ctrl+Enter runs the recommended action**
  when focus is not in a text field. That chord came from the attached actions and was kept.

### Selection-awareness lives in the dock
Ticking cards on TEC-01 / TEC-03 / TEC-06 relabels the recommended row **in place** — same
element, same id, same position, 120ms crossfade, no height change — and the reader's own turn
still shows the resolved refs. Asserted as identity (`rows()[0] === before`), not as text.

### The dock and the follow-up chips take turns
While the dock is OPEN the chips under the answer are not drawn; fold it to the band, or dismiss
it with ✕, and they come back **whole**. Two offers at the bottom of one answer is two answers to
"what now" — and on a leadership turn they were the same two sentences, since the dock's rows were
authored from those follow-ups.

This **replaces the `spare()` label filter**, which decided by comparing wording: it only caught
the collision when the strings matched, and the price of catching it was a chip row with nothing
left in it. `ActionDock` reports its mode up (`onMode`); the drawer holds it **beside the
option-set key**, so a fresh dock cannot be read as folded for the frame before its effect lands.

It also gives ✕ on the band something back — dismissing the actions used to leave the turn with
no offer at all.

### The ChartFrame header, and the insight line
**The header is title · Chart type · ⋯.** "Add to dashboard" had the header's one named slot and
is now the ⋯ menu's **first** item; **Chart type** took its place, because changing how a picture
is drawn is the thing a reader reaches for most often on a chart and the only control that changes
the picture itself. The menu reads **Add to dashboard · Full screen · Export ▸ · Regenerate**, and
**Data filter** (group-by) sits after them — it stayed where it lived rather than moving to the
header. Every way out of either menu — Escape, a click away, a choice — puts the caret back on the
control that opened it.

**Regenerate is new.** It had been deleted with the old toolbar because it *cycled* chart types
without naming the next one. It re-runs the chart now: the dataset is re-resolved (a nonce the
memo depends on) and the visual redrawn. Naming the types is the header control's job.

**`InsightLine` replaces the bare sentence** under every visual: a 3px rail in the severity's
colour, a wash fading to transparent at 60%, and a bold 1–2 word state before the sentence.
`insightOf(data, key)` in `mockAnalytics.ts` returns `{state, severity, sentence}`, and the
severity is **computed from the dataset's own numbers** — a gauge against its target, a ranking's
top share against 35%, a volume move against ±2/25%. Change `SLA.compliance` to 95.4 and the same
insight reads "On track" in green with no edit outside the insight layer; that is asserted by
rewriting the seed, re-resolving and putting it back (`insightmap.mjs`).

**Five sentences were trimmed** to fit two lines in the 268px text column — the gauge, the VPN
daily trend, the regulatory deadlines, the vendor ranking and the problem matrix. They are one
string used in four places (the insight, the frame's accessible name, the dashboard tile, the PDF
subtitle), so the trim reaches all four. The column holds **~80 characters** across two lines
including the bold state lead; that figure is measured in the browser, and the earlier
character-per-line estimate was wrong by a third.

### The callout is gone; the InsightLine is the only insight surface
**A leadership answer used to say things twice.** On CXO-02 the Breaches frame read "VPN alone
is 41% of breaches" and a blue-rail callout two elements above it read the same fact again, in a
second colour, claiming an urgency the data had not earned. So the **section order lost the
callout** — it is now **Headline → KpiStrip → ChartFrame → Breakdown → Drill** — and all
**thirteen** leadership callouts were removed.

**The merge rule: the fact once, the consequence appended.** Each removed callout's "so what"
became the chart block's new **`soWhat`** field, which `InsightLine` renders as a second sentence
after the dataset's own:

> **Concentrated** — VPN alone is 41% of breaches. Fixing it puts us back above target.

The fact is never repeated; where a callout only restated the insight (CXO-01's "tickets rose 3×")
nothing moved, because nothing was carried. **Severity is still `insightOf`'s** — a consequence,
however urgent its wording, does not repaint the rail.

**The line still has to read in two lines**, and the text column is **268px ≈ 80 characters**
including the bold state and the em dash. Measured in the live element, never counted: at 82
characters the CXO-02 merge ran to three lines and at 81 it did not, because the break lands on a
word. Four clauses had no room and were **dropped** (CXO-01's password-policy cause, CXO-03's
"fibre repairs", CXO-04's owner, CXO-06's "top two ≈ 55 tickets"); each is reachable elsewhere on
the same turn or one turn deeper, and `cxo7.mjs` asserts both the drop and the recovery path.

**Three clauses were answer-level and went to the headline's supporting line** (`payload.text`,
rendered 8px under the conclusion): CXO-05's "two are still under investigation", CXO-06/savings'
"assumes 130 productive hours" — an unstated divisor is what makes a capacity claim unarguable —
and CXO-07's "likely a process issue, not a system one", which is the turn's only interpretation
and the thing `response.mjs` §8 exists to guard. ⚠️ A lead line is dropped in **concise** density,
so those three vanish under ••• "Make it shorter".

**The clipboard follows the clause.** `blocksToText` used to copy the callout; it copies the
chart's `soWhat` now. Only the authored clause — resolving the dataset there to copy the FACT as
well would read the DEFAULT grouping, and the reader may have changed it on screen.

**The `Callout` component survives**, used by exactly one script: the technician's TEC-04 hold
note, which sits beside a card rather than a chart and duplicates nothing.

### Explicitly NOT the dock's
**ChartFrame's toolbar** — chart type, group-by, expand, regenerate, add-to-dashboard — stays in
the frame. It manipulates the visual in place. A **chart drill** is inseparable from the mark that
was pressed: a dock row would have to name a segment, and then there would be one row per bar. A
**breadcrumb** says where the reader is. None of the three is a conversation action.

## In progress
Nothing mid-flight.

## Next steps
1. **CXO-06 names one action in two places.** The dock's recommended row is "Raise a problem
   record for the VPN one"; the VPN problem card carries its own "Raise a problem record" button,
   as the printer and mailbox cards do. The cards are the only route to the other two, so removing
   them would lose capability — but the VPN one is a genuine duplicate on that turn. Either drop
   the card button for the row the dock already leads with, or drop that row.
2. **The requester follow-up chips have their content back** — dropping `spare()` restored every
   question REQ-01/02/04 used to show. They are the same sentences the dock offers as actions,
   which is fine now that the two are never on screen together, but a second pass could author
   questions that are genuinely different from the actions rather than the same list twice.
3. **✕ on the band is unrecoverable for that turn.** Unchanged, still a known gap.
4. **The edge handle's geometry was never confirmed** against the original design.
5. **`novaEnhance.ts` is unimported.** Delete it or wire it somewhere.
6. **No chart is green in the seed data.** Nothing in the fixture is above target or improving,
   so `good` only appears when the data changes. That is honest, not a gap — but if a green rail
   should be visible in a demo, the seed needs a metric that is winning.
7. **CXO-03 lost the only clause that said WHY TelcoNet is slow.** "Fibre repairs" had no room
   on an insight line already running two full lines, so it was dropped; it survives only in the
   vendor-note draft, two clicks away. Recoverable by trimming the vendor headline — it needs a
   decision about which words to give up, not a fix.
8. **A lead line is dropped in concise density.** The three callout clauses that folded under a
   headline (CXO-05's open investigations, CXO-06's FTE assumption, CXO-07's interpretation)
   vanish under ••• "Make it shorter". True of every `text` field already; it now applies to a
   disclosure rather than to prose, which is worth a second look.
9. **CXO-07's clause went to the headline rather than being dropped.** By the letter of the brief
   it had a matching chart and should have gone; it is that turn's only interpretation, and
   `response.mjs` §8 exists to assert "the insight interprets rather than restates". One line in
   `leadershipScripts.ts` reverses it if the letter is preferred.
10. **`compact` is declared on the chart block and set by no script.** The technician's reduced
   frame renders on no turn in the product. It is kept and kept aligned with the full frame
   (same header, same insight line); delete it or give it a turn.

## Decisions made
- **The asks belong in the dock, not beside it.** The brief's four-row cap only makes sense if
  do-actions and asks compete for the same rows. A second, quieter offer floating above the box
  was the thing this task exists to remove.
- **An authored verb beats a derived one.** `stepIcon` reads `NextStep.icon` first (every
  technician action declares a `DoIcon`, and it travels in the turn's context so the reader's own
  turn wears the same glyph), and falls back to the label. The technician verbs were merged into
  the label map too, but **appended after** the existing rules so no requester row was repainted.
- **A row with no meta gets NO detail line.** An empty second line is not a smaller row; it is a
  row that looks like it lost something.
- **The reassurance line is the requester's alone.** "Nothing runs until you choose" makes reading
  a list free for someone being offered actions on their own ticket. A technician and an executive
  are reading a list of things they were going to do anyway.
- **"Change the plan" routes through `composeRequest`.** The dock has the box's seat, so filling
  an input that is not rendered is filling nothing. That store now carries `select: 'all' | 'end'`
  — a correction hands text back SELECTED, a prefix hands it back with the caret at the end.
- **Greying a past turn's actions was replaced by absence.** Stronger, and it falls out of the
  dock not being inside the turn.
- **A consequence is authored; a severity is computed.** `soWhat` sits on the chart block because
  "fix that and we're back above target" is a judgement about the business, and `insightOf` only
  reads numbers. The two never mix: a consequence, however urgent its wording, does not repaint
  the rail. The tally was identical before and after the merge — 22 warn / 4 bad / 8 neutral.
- **Measure the line; do not count it.** "Fix that and we're back above target" is 82 characters
  and wraps to three lines; "Fixing it puts us back above target" is 81 and fits in two. One
  character shorter, one line better, because the break lands on a word. Every candidate was
  rendered in the live element before it was chosen — the character-per-line estimate that
  preceded this was wrong by a third.
- **Re-point an assertion, never delete it.** Twelve suite checks guarded real claims about a
  leadership answer (the key driver is stated; the assumption behind the FTE number is stated).
  The claims survived the redesign; only their address changed. Where a clause was dropped, the
  DROP is asserted too, plus the path by which a reader can still reach it — so a deletion cannot
  quietly become a regression.
- **Prove absence over the source, not the screen.** Clicking proves seven main turns and five
  drills; a walk over `REG.SCRIPTS` proves every leadership turn there is, including ones added
  later. Both run: the registry check for completeness, the browser for what actually renders.

## Gotchas & notes
- **A dock row holds no copy of what it will send.** It calls the card back (`callProposal`) at
  the moment it runs. That is what makes TEC-05's Send post the reader's edit rather than the
  script's sentence, and it is exactly the thing that would have broken silently when the button
  moved out of the turn into the footer. `unify.mjs` edits the block and reads the reply.
- **Harness `send()` helpers must fold the dock first** — the box is behind it on every persona
  now, not just the requester's. Click `[data-dock-else]`; do not press `/`, which is correctly
  ignored under a popover or the evidence sheet.
- **Still no typecheck.** `vite build` strips types without checking.
- **Bash heredocs eat a backslash level** — write patch scripts with the Write tool.
- **Do not parse `theme.css` with a hand-rolled walker.** Bounded slices between two comment
  headers, asserted in both directions; `u4_css.py` in the scratchpad is this session's example
  and its post-conditions caught what the slices left behind.
- **The insight text column is 268px ≈ 80 characters across two lines**, bold state and em dash
  included, at the default 462px drawer. Anything longer needs measuring in the browser, not
  arithmetic. `measure2.json` through `cdp.mjs` does it: set `textContent`, divide the box height
  by the computed line-height.
- **Do not edit a source file while a `cdp.mjs` sweep is running.** Vite's HMR reloads the page,
  `window.__read` and friends vanish, and every remaining step fails with "not a function" — which
  reads exactly like a broken plan rather than a reload.
- Suites, all green: `aat` 164 · `hnk` 117 · `cxo7` 101 · `unify` 96 · `tec6` 60 ·
  `pipeline` 59 · `req` 58 · `polish` 55 · `response` 51 · `tec7` 51 · `seat` 49 · `convo` 48 ·
  `trust` 43 · `uxlaws` 39 · `usecases` 37 · `endbar` 34 · `pipeline2` 30 · `tec3` 29 ·
  `reqstatus` 25 · `reqsix` 22 · `tec3data` 20 · `dock` 157, plus `undeclared` (95 files,
  7,023 calls).
- **`layout2.json` through `cdp.mjs`** is the geometry check jsdom cannot do: three REAL drawer
  widths (693 expanded · 462 default · 418 clamped) × dock / band+box / plain box, and in every
  one the scroller's bottom edge and the seat's top edge are the same pixel (`overlap: 0`), the
  last message is fully visible, and the tail padding is a constant 38px because the only thing
  over the thread is the fade.
