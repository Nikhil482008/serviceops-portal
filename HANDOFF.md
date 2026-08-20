# Handoff — 2026-08-20 18:00

## Read first

`CLAUDE.md` → the **Ask AI** bullet (its provider placement, the rail-pinning constraint and the
two hazards in the ticket chat), then the **AI accent tokens** bullet and the **Licence
distribution** one. The Ask AI work is 2 of 7 phases against an approved plan at
`C:\Users\Nikhil Khemaria\.claude\plans\linked-crunching-milner.md` — **read that plan before
continuing**; it records the four decisions the work is built on and six known deviations.

## What we worked on this session

Two unrelated pieces. The BOM dashboard's "Licence distribution" card had its second view changed
from CBOM to **AI BOM**. Then the first two phases of a new **Ask AI** feature: a persistent entry
point at the bottom of the left icon rail, and the extraction of the ticket panel's chat
primitives into a shared `src/app/ai/` module so both surfaces draw from one set.

## Completed

**Licence distribution → AI BOM.** `aiLicences` / `aiLicenceTotal` / `aiLicenceCounts` derived in
`bomDashboardData.ts` from `aiAssets()` — the AI Components register's own accessor — in the same
top-5-then-Other shape as the SBOM half. Worst-risk-wins per slice, including `Other`. View-all
follows the view to `ai-components`. 47 checks (`aibomcheck.mjs`).

**`cb4d106` — tokens + extraction.** `src/app/ai/` created: `types.ts`, `flags.ts`, `timing.ts`,
and `components/` (`AiMessageBubble`, `AiSuggestionChip`, `AskAiBar`, `AiMarkdown`). Five AI tokens
added to `theme.css`. ~28,000 characters of dead code deleted from `TicketPropertiesPanel` — the
295-line `{false && …}` block, `suggestedActions`/`handleSuggestedAction`, `previousGroup`, a
dangling `data-onboarding` hook and five debug `console.log`s.

**`2f57ebb` — the rail entry point.** `AskAiRailButton` pinned to the rail's bottom behind
`ai_assistant_enabled`, plus `AskAiProvider` (split contexts) wrapping `DrawerStackProvider` in
`App.tsx`. Ctrl/⌘+J. 41 checks (`airail.mjs`).

## In progress

Nothing mid-flight — both commits are complete and green. **Phase 3 (the docked panel) has not
been started.** It is the next thing to build: `ai/panel/AskAiPanel.tsx`, lazy-loaded and mounted
in `App.tsx` beside `GlobalSearch`, consuming `AskAiProvider`'s state.

## Next steps

1. **Phase 3 — the docked panel.** `fixed right-0`, no scrim, `z-[10020]`, 420px default,
   resizable 360–720, width persisted. Header → thread → sticky composer. **Answer the markdown
   question first** (below) — it blocks the message renderer.
2. **Phase 4 — context registry** (`registerAIContext`, snapshot at send time, cap 100 rows,
   deterministic truncation, redaction) wired to the Vulnerabilities list only.
3. **Phase 5 — action registry** with preview-before-apply. Note `filterList` and `sortList` need
   filter/sort state ADDED to `VulnerabilitiesListPage` first; the page has only a search string.
4. **Phase 6 — `aiClient`** with the mock adapter shipping and the SSE adapter stubbed.
5. **Phase 7 — `ai/README.md`.**
6. **Replace the Alt+I DOM scrape** in `DrawerShortcuts` with a real call, in the panel commit.

## Decisions made

- **Ask AI transport is mock-only, contract stubbed.** There is no backend anywhere in this repo —
  zero `fetch`, zero env, zero streaming — so the endpoint shape is not invented. `aiClient` gets
  an SSE-shaped interface and only the mock adapter ships.
- **The panel overlays; content does not shrink.** Shrinking is structurally possible (the shell is
  flex) but the shell is copy-pasted across ~23 pages and 14 drawers hardcode
  `window.innerWidth - 54`. Recorded as a known deviation rather than silently chosen.
- **Verification uses the repo's jsdom + esbuild harness**, not a new test runner. There is no test
  framework here and TypeScript is not even installed.
- **Accent tokenised for `ai/` + the ticket panel only.** ~24 drawer files keep literal hex; a full
  ~170-site sweep in a repo with no type-checker was not worth bundling in.
- **Glyph is lucide `Sparkles`, not the gradient `AiSparkle`.** The rail's other 17 icons are flat
  `currentColor`, and `AiSparkle`'s fixed gradient would ignore the white the rail paints its
  selected icon with.
- **No shared `useTypewriter` hook**, though the plan listed one. The ticket panel animates a
  prefix of text it already has; the panel renders deltas with no known ending. One hook over both
  would mean the streaming side pretending to know an ending it has not been told.

## Gotchas & notes

- ⚠️ **The rail cannot use `overflow-y-auto` to pin its footer.** Any non-`visible` axis makes a
  scroll container on **both**, which clips the four `absolute left-full` hover flyouts. The footer
  is absolutely positioned and the list carries `pb-[41px]`.
- ⚠️ **Pre-existing, unfixed:** 17 rail items × 40px = 680px, so below that viewport height the
  tail of the rail is unreachable. Not new, not made worse — fixing it needs those flyouts portaled.
- ⚠️ **A latent freeze in the ticket chat.** Follow-up pills are scheduled off a GUESS at the
  typewriter's duration; appending that message changes `chatMessages.length`, the typing effect's
  only dependency, and the restarted effect fails its own `!displayedText` guard. Typing stops one
  character in. Only harmless because the guess runs long.
- ⚠️ **jsdom cannot diff the gradient border.** Its CSS parser drops the double-background
  shorthand entirely, so the pre-refactor element has no background at all, while the same property
  written as `var(...)` survives. The token's value is proved equal to the literal textually instead.
- ⚠️ **A snapshot that does not contain the markup under test passes for the wrong reason.**
  `aiextract.mjs` did exactly that on its first run — it snapshotted only the thread while the pills
  it was meant to verify were in the welcome state. It now captures two states and asserts its own
  coverage before comparing.
- **Harnesses** (session scratchpad, all self-contained): `aiextract.mjs` 23 — byte-identical
  comparison against a baseline recorded from the pre-refactor tree, so re-running it after a
  future edit still means something; `airail.mjs` 41; `aibomcheck.mjs` 47.
- **Open question for phase 3:** the panel needs headings, lists, **tables** and code blocks.
  `react-markdown` + `remark-gfm` is the recommendation (React elements, no
  `dangerouslySetInnerHTML`, and a hand-rolled GFM table parser is where the bugs live) — but the
  dependency-free option was chosen twice already this session, so it was **not** assumed. Decide
  before building the message renderer.
- `npm run build` proves only that the code parses — esbuild strips types without checking them,
  and there is no type-checker in this repo.
