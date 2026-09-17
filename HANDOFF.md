# Handoff — 2026-09-17 08:52

## Read first
CLAUDE.md's Nova bullets, in this order — they are the four things that changed shape:

1. **THE ORB** — `components/ui/siri-orb` + `nova/NovaOrb.tsx`, and the deliberate second
   construction `nova/AskAiCore.tsx`.
2. **THE REQUESTER'S SEAT** — `nova/dock/RequesterDock.tsx`, two shapes in one seat.
3. **THE ENTRY POINT** — `ai/NovaHandle.tsx`.
4. **THE REPHRASE** — `nova/novaRephrase.ts`.

`DESIGN.md` still governs type/radius/buttons. Measurements live beside their CSS in
`src/styles/theme.css`, each under its own `/* == SECTION */` banner.

## What we worked on this session
Six connected pieces: **TEC-03 / TEC-06 / TEC-07** rebuilt as composed answers; the **requester's
dock** taking the input's seat and collapsing to a band fused to it; a **rephrase step** in front
of every typed requester message; the **orb replaced everywhere** by one shared construction (then
partly reverted by request); a new **edge handle**; and the **follow-up chips** restored.

## Completed

### The orb
- **`components/ui/siri-orb.tsx`** — six conic gradients over a registered `--orb-angle` at
  multiples ×2 ×2 ×-3 ×2 ×1 ×-2. The `::after` lit-disc finish is what makes it a sphere.
- **Nova's palette is the component default**, in oklch, declared once in `NOVA_ORB_COLORS`.
- **Every measurement derives from `size`** — the 8px label dot and the 120px hero are one object.
- **`NovaOrb` holds no drawing**, only the state→props map (speed + hue).
- **Deleted** `AskAiOrb.tsx` and 53 CSS rules / 415 lines. **Then restored by request** as
  `AskAiCore.tsx` for the flight layer only — see CLAUDE.md for why it cannot be narrowed further.
- Measured **60fps**: 401 frames, median 16.7ms, p95 16.7ms, zero over 20ms, three orbs animating
  with the ticket table scrolling.

### The bug that started it
The TEC-07 gutter mark rendered as a **black cube**. Two defects, one symptom: `plan_proposed`
completes the live steps but leaves `state` at `investigating` (the stream really is parked), so
the header put the **boxes loader** in the gutter and left it there — and the loader was painted in
`--nova-g700/800/900`, the three darkest neutrals. Fixed at the shared turn header. The **same root
cause** was fixed in a second place nobody reported: the composer was offering **Stop** for work
that had stopped.

### The requester's seat
- The **dock takes the input's place**; the collapsed state is a **band fused to the top of the
  box** in one container. ✕ and "Ask something else" both fold to it, differing only in caret
  placement.
- The dock reads as a **menu**: verb-icon tiles instead of number badges, a go-arrow per row,
  "Nova can do this for you" as a sentence, and one line under it saying the rows are optional.
- The **composer morph was removed** — its Back control, its ghost rows and 35 lines of CSS solved
  a problem the band does not have.
- The **enhance (sparkle) control is gone** from every input placement.

### TEC-03 · TEC-06 · TEC-07
Composed from the store (`patternMatch.ts`, `vendorWait.ts`). TEC-06 renders identically at 9
tickets/3 vendors and 62/27. TEC-07's plan is **text** (`PlanList`) with one derived summary card
(`PlanSummaryCard`), diffs computed by **step id** (`planRevise.ts`), and two attached actions.

### The rephrase, the handle, the chips
As described in CLAUDE.md. The chips came back with a `spare` filter so they never repeat a dock
option — see the gap below.

## In progress
Nothing mid-flight. Every suite is green.

## Next steps
1. **The follow-up chips have almost no content left.** After de-duplicating against the dock,
   REQ-01/02/04 show **no chips at all** and REQ-03/05/06/07 show **one** — three of which
   paraphrase a dock option ("What was the fix?" beside "What was the fix for the card?"). The
   dock's requester options in `nextSteps.ts` **are** those questions, copied. Making the chips
   worth their space needs newly authored questions, which is content, not code.
2. **✕ on the band is unrecoverable for that turn.** No path back to the actions — verified, not
   assumed. Either give the dismissal an undo, or make ✕ fold rather than destroy.
3. **The edge handle's geometry was never confirmed** against the original design — Part 4 of the
   orb brief described a handle that did not exist in this repo, and I built one to the written
   spec. Worth one pass by eye.
4. **`novaEnhance.ts` is unimported.** Delete it or wire it somewhere.

## Decisions made
- **The orb's identity lives in exactly one declaration**, in oklch — the three hues have to read
  as one family at equal lightness, which sRGB gets wrong.
- **"Parked" is not "running."** Two surfaces read a parked plan as work in flight. Both now ask
  `planPending`.
- **✕ and "Ask something else" are one shape and two intents.** They used to be two shapes; the
  only difference worth expressing is where the caret lands.
- **The dock and the follow-up chips are different offers** — actions Nova takes vs. questions the
  reader asks — which is why the chips came back. But the dock's options were authored BY COPYING
  those questions, so the chips now carry only the remainder.
- **A verb tile beats a number badge.** The number told the reader a row's POSITION: the one fact
  about a set of choices that is never the thing being chosen between.
- **No dead chips.** The restored follow-ups each ended in a `disabled: true` entry, from before
  that rule existed; all eight were dropped.

## Gotchas & notes
- **There is still no typecheck.** `vite build` strips types without checking. Three undeclared or
  mistyped bindings shipped this session and were caught only by the jsdom suites (`setAlreadyGood`
  after the enhance removal; `a.test(q)` where `test` was a RegExp property; and a comment claiming
  the composer survived a mode change when it does not).
- **Bash heredocs eat one backslash level.** Any patch script with a regex, a `\b` or a template
  literal must be written with the Write tool. This cost four round-trips this session.
- **Do not parse `theme.css` with a hand-rolled walker.** One attempt mis-read a comment as a
  selector. The safe shape is a **bounded slice between two comment headers**, asserted in both
  directions — `j2_orbcss.py` in the scratchpad is the working example, and its assertion caught
  six rules living outside the slice.
- **If a rule looks like it is styling something that is not there, check whether the thing it
  styles went missing.** `.nova-src-kind` had no rule at all — the disc each source-kind glyph sits
  in was gone, so four 9px glyphs overlapping by 5px rendered as one smudge. The tells were a hover
  rule setting `border-color` on an element with no border, and a component comment still
  describing "one ring weight, one glyph size, a 5px overlap".
- **jsdom has no layout engine.** Every rect is zero, so a check on a computed padding can only say
  "none". To prove a measured value, stub the rect and assert the number moves.
- **`newChat()` in the harnesses closes the drawer**, and a requester's box is behind the dock.
  Every `send` helper now clicks `[data-dock-else]` first — clicking, not pressing `/`, because the
  key is correctly ignored under a popover or the evidence sheet.
- Suites, all green: `dock` 156 · `aat` 146 · `hnk` 117 · `cxo7` 95 · `tec6` 60 · `pipeline` 59 ·
  `req` 58 · `polish` 55 · `tec7` 51 · `response` 50 · `seat` 49 · `convo` 48 · `trust` 43 ·
  `uxlaws` 39 · `usecases` 37 · `endbar` 34 · `pipeline2` 30 · `tec3` 29 · `reqstatus` 25 ·
  `reqsix` 22 · `tec3data` 20, plus `undeclared` (94 files, 6,948 calls).
