# Handoff — 2026-09-04 17:40

## Read first
CLAUDE.md's Nova bullets — especially the four new ones: the trust/evidence experience, the
three-level answer ending (utility bar + data-driven ••• menu + chips-last), TEC-07 plan-first,
and the REQ-01..07 requester responses over the mock ticket store. `DESIGN.md` still governs
type/radius/buttons.

## What we worked on this session
One long Nova session, five connected passes, all in `src/app/ai/nova/`:
trust/evidence refinement → end-of-response utility bar + contextual ••• menu → TEC-07
plan-first interaction → the full hardcoded requester experience (REQ-01..07) over a shared
mock ticket store.

## Completed
- **Trust refinement**: "How Nova knows" is the ONE trust gateway (Based-on strip + "View
  sources" removed); evidence drawer portaled to `<body>` (z-10035) with a back button —
  fixed the orb bleeding through its header (stacking-context trap); actions sit tight under
  the answer; draft answers hold their chips until created.
- **Utility bar** (`ResponseUtilityBar`): Copy/Share left; "N sources" · 👍👎 · ••• right,
  BEFORE the chips (suggestions end the turn). Menu = authored type-specific group + common
  group (Regenerate = real in-place instant re-run; Change visual = derived table⇄cards;
  Double-check = real claim→source re-verification; View sources expands the fold; Flag).
- **TEC-07 plan-first**: planning strip → PlanCard (steps/impact/evidence/Approve&run/Modify) →
  three modification types with visible diffs, each re-requiring approval → execution ✓●○ with a
  deterministic notify failure + named retry → completion DERIVED from the approved plan.
  New events: `plan_proposed`/`exec_begin`/`exec_step`; parked on the ask seam; `respondToPlan`.
- **Requester build**: `mockTickets.ts` store (only mutations write; live via
  useSyncExternalStore); `RequesterBlocks.tsx` primitives (DraftCard/StatusCard/DiffCard/
  StepList/YesNoPrompt/NoteComposer/RequestList/StatChips/AgeBar/ResolutionNote/ConfirmBanner
  + picker/team/timeline/closelist); `scripts/requesterScripts.ts` = REQ-02..07 + ~17 chip
  scripts + a generic "What's happening with <ref>?" status script; REQ-01's answer re-authored
  as a draft block (registry). Propose→confirm→ConfirmBanner everywhere; cross-case store
  visibility (create INC-1042 in REQ-01 → it lists in REQ-06); chips = 2 functional + 1
  disabled ("Not in this demo"); pills restyled to a plain hairline.
- **Verification**: 24 jsdom suites, ~1,050 checks, ALL GREEN — incl. new `req.mjs` (50),
  `plan.mjs` (36), `endbar.mjs` (34), `trust.mjs` (41). Nine suites migrated to the new design
  with supersession comments. `npm run build` clean.

## In progress
Nothing mid-flight.

## Next steps
- Eyeball pass in the browser: plan card proportions, stepper rhythm, pill hairline, drawer slide.
- TEC-04/TEC-05/TEC-06 + remaining CXO cases still run on intent fallbacks.
- The mock store resets on reload (in-memory by design); persistence only if the demo needs it.

## Decisions made
- "How Nova knows" is the single trust path; sources count in the bar is the drawer's entry point.
- Draft/diff/note confirms are ONE click (the card IS the proposal) — superseded the older
  two-step Confirm; suites repointed.
- Global "Make it shorter"/"Elaborate" menu items retired; REQ-04 has authored StepList variants.
- REQ-06's headline is count-free ("Here's everything still open…") — the spec's "Four things"
  contradicted its own seed data (five open) and the list is live.
- `requesterScripts.ts` keeps local helper copies (type-only registry imports) to avoid a TDZ
  cycle: the registry imports its value.

## Gotchas & notes
- React maps onBlur→focusout and onMouseEnter→mouseover in jsdom driving; textContent joins
  spans without spaces ("1→2"); a suite's `one('.nova-drawer textarea')` grabs an open
  NoteComposer's textarea — pick the one outside `article`.
- Re-running REQ-01 after creation shows the ConfirmBanner immediately (the drafts map
  remembers `createdRef`) — store-truthful, but drive discard tests on REQ-04's draft.
- The requester brief said not to update CLAUDE.md/HANDOFF.md; the explicit /tatago afterwards
  overrode that — both files updated on the user's own command.
