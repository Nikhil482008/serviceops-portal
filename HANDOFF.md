# Handoff — 2026-08-11 19:03

## Read first
CLAUDE.md `## Key context` → the **OS Upgrade (Admin › Patch Management)** bullet, then the
**Admin listing layout** bullet (it is the standard for every admin listing from now on), then the
**Patch Deployment — deployment type, saved views, and the create form** bullet. The V2 rule still
stands ("version 2" feature asks → `TicketDrawerV2.tsx` only).

An earlier session the same day shipped **BOM Management (Admin)**, **Global Search + tiered
filtering**, a round of **BOM refinements**, and the **three-level Admin nav** — all committed and
documented in CLAUDE.md; see commits up to `9675549`.

## What we worked on this session
Two features. First the **OS Upgrade admin module** — a new listing and detail page under Admin ›
Patch Management carrying the whole ISO-upload flow. Then **OS Upgrade as a deployment type** in
Patch Deployment: a create form, a saved view, and a type-specific detail Overview. Along the way
we set the standard for how every admin listing is laid out.

## Completed

**OS Upgrade admin module** (new files)
- `osUpgradeData.ts` — 15 `OSU-#` images, prerequisite profiles, the deterministic fleet generator
  + evaluator, upload-attempt seeds, `prereqPhrase()`.
- `AdminOsUpgradeModule.tsx` — the listing, the upload state machine, the Upload Status panel.
- `AdminOsUpgradeDetail.tsx` — Summary (ISO File → OS Image Details → Prerequisites) + Computers.
- `OsUpgradeUpload.tsx` — the Upload ISO popup (listing only), the minimised dock, shared pills.
- Reached from the **OS Upgrade card** in Patch Management AND a **level-2 sidebar nav row**
  (`Patch Management` added to `SIDEBAR_TREE`); both route through `CARD_MODULES` in `AdminPage`.
- Upload flow verified end to end in the browser: empty → in progress → pause/resume → stop →
  failed → retry → uploaded, with the dock, the listing row, the header KPI, the detail card and
  the history panel all moving together.

**Patch Deployment**
- `deploymentType: 'Patch' | 'OS Upgrade'` + `archived` on `PatchDeployment`; the type shows as the
  first row of the right-panel **Patch Deployment Fields** card, threaded from the record.
- **Saved views** dropdown (search, pin, active highlight) plus the star + filter-chip row, with a
  new **OS Upgrade Deployments** view.
- **`CreatePatchDeployment.tsx`** — the create form behind the listing CTA, with the new
  **Deployment Type** field. OS Upgrade collapses Configuration Type to **Install only** and swaps
  the payload picker to OS images (uploaded ones only).
- Overview is now **two layouts branched on the run's type**: OS Upgrade gets the
  Package-Deployment layout (count + preview cards, 2×2 stats beside the remote-office
  drill-down); a Patch run keeps its donuts and both drill-downs, unchanged.

**Admin chrome**
- Admin listing standard — white surface, head + docs link, compact left-icon search, full-bleed
  table with no card. Every admin pane now uses `px-4`.

## In progress
Nothing mid-flight. Everything under Next steps is a deliberate gap, not unfinished work.

## Next steps
1. **An OS Upgrade deployment still carries PATCH data** — the header KPI, the Overview payload
   card, the Patches tab and the deployment matrix all read `DEPLOYED_PATCHES`. The Overview card
   is deliberately still labelled "Patches" for that reason. Swapping the payload has to be done as
   one piece (`PatchDeploymentDrawer` + `PatchDeploymentPatchesTab`), or the labels contradict the
   tabs they link to.
2. The **listing** still opens `UploadIsoModal` from a row's upload icon. Intentional — a row has
   nowhere inline to put a picker — but if that popup should go too, the options are to send the
   row icon into the detail page or expand the row inline.
3. The **Patch Deployment detail page** was only partly revisited; its Endpoint / Patches /
   Deployment / Audit Trail tabs are untouched.
4. Optional: retrofit the **BOM Management** admin screens to the new listing layout (they still
   use the older card-wrapped one).
5. On a short viewport (~820px tall) the OS Upgrade Summary empty state runs ~15px over. Closing
   that would mean tightening the field spacing the user explicitly asked to keep roomy.

## Decisions made
- **Compatibility is evaluated, never stored.** `computersFor()` generates a deterministic fleet
  and `evaluate()` judges it against that image's own `PREREQUISITES`, so the Prerequisites card
  and the Compatible/Incompatible/Unknown counts cannot drift. The grid's spec columns are
  generated from the prerequisites, so no row is flagged for a value the reader cannot see.
- **Prerequisite phrasing is derived, not authored.** `prereqPhrase()` builds "4 GB or more" /
  "Turned on" / "One of Windows 10 2004 or later" from the rule's key and operator, so a new OS
  profile reads correctly for free. `p.value` is untouched because the evaluator compares on it.
- **One overlay at a time** in the OS Upgrade module — popup, activity panel and dock are mutually
  exclusive, or an admin gets two sets of controls for one transfer.
- **The detail page's uploader is inline, no dialog.** "Click Upload → read a dialog → click Upload
  again" was two steps for one intent; the guidelines now sit beside the dropzone, read *before*
  choosing rather than after.
- **"Current" in the upload history = the newest attempt that LANDED**, not the newest row — a
  failed attempt on top of a good file does not replace it.
- **Archived deployments belong to exactly one view**, enforced in `inView()` rather than in each
  `match`, so a new view cannot resurrect them. "All Deployments" therefore shows 29, not 32.
- **`deploymentType` is threaded, not hard-coded** into the fields card — hard-coding would make
  every Patch run claim to be an OS Upgrade.
- Kept the asset **Hardware tab's** field spacing verbatim on the Summary grids, and took the
  height needed for the one-screen fit out of the upload chrome instead.

## Gotchas & notes
- ⚠️ **A JSX comment `{/* … */}` is invalid directly inside a parenthesised expression** — e.g.
  straight after `{cond && (`. It parses as an object literal and the build fails with
  `Expected ")" but found "className"`. Use a plain `/* … */` there. This bit three times.
- ⚠️ **A bare `<button>` does NOT inherit font-size in this app** — preflight leaves it at the
  16px default. Link-style buttons need an explicit `text-[Npx]`; check with `getComputedStyle`
  when one looks too big.
- ⚠️ `overflow-x-auto` + `min-w` does NOT stop a table clipping — nowrap columns simply demand more
  width. The Upload Status history uses **`table-fixed` + a `colgroup`** so Status can never be
  pushed out of view.
- ⚠️ `vite build` does **not** typecheck (the script is bare `vite build`), so type errors compile
  through silently. Verify in the browser, not just by building.
- Demo hooks in the uploader: only `.iso` under 10 GB is accepted, and a file named
  `*fail*` / `*corrupt*` fails at 62% — the only way to reach the Failed state from the UI.
- A **parallel Claude session was editing this repo** throughout (three-level admin nav,
  `vite.config.ts` watcher ignores, a `.gitignore` screenshot rule). It swept some of this
  session's staged files into its own commit `9675549`, whose message does not describe them.
- Run `git status --short` before staging; do not blind-`git add -A` (a `credentials.txt` was
  committed to a public repo that way earlier in this project).
- `pnpm` is not on PATH by default here; `corepack prepare pnpm@10 --activate` fixes it.
  `npm install` still crashes on this pnpm-managed tree — use `pnpm add`.
