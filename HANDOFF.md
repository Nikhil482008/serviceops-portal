# Handoff — 2026-09-17 12:13

## Read first
CLAUDE.md's Nova bullets, in this order:

1. **THE ACTION DOCK** — `nova/dock/ActionDock.tsx` and its four selectors. This is the one that
   changed this session, and it changed for every persona.
2. **THE ORB** — `components/ui/siri-orb` + `nova/NovaOrb.tsx`, and the deliberate second
   construction `nova/AskAiCore.tsx`.
3. **THE ENTRY POINT** — `ai/NovaHandle.tsx`.
4. **THE REPHRASE** — `nova/novaRephrase.ts`.

`DESIGN.md` still governs type/radius/buttons. Measurements live beside their CSS in
`src/styles/theme.css`, each under its own `/* == SECTION */` banner.

## What we worked on this session
**One action surface for all three personas.** The dock and the band that the requester already
had are now the ONLY way an action is offered — to technicians and to leadership as well. The
technician's attached actions were removed, and so was the floating strip of ask-chips above the
box.

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
- Suites, all green: `aat` 163 · `hnk` 117 · `cxo7` 97 · `unify` 94 (new) · `tec6` 60 ·
  `pipeline` 59 · `req` 58 · `polish` 55 · `response` 51 · `tec7` 51 · `seat` 49 · `convo` 48 ·
  `trust` 43 · `uxlaws` 39 · `usecases` 37 · `endbar` 34 · `pipeline2` 30 · `tec3` 29 ·
  `reqstatus` 25 · `reqsix` 22 · `tec3data` 20 · `dock` 157, plus `undeclared` (95 files,
  7,023 calls).
- **`layout2.json` through `cdp.mjs`** is the geometry check jsdom cannot do: three REAL drawer
  widths (693 expanded · 462 default · 418 clamped) × dock / band+box / plain box, and in every
  one the scroller's bottom edge and the seat's top edge are the same pixel (`overlap: 0`), the
  last message is fully visible, and the tail padding is a constant 38px because the only thing
  over the thread is the fade.
