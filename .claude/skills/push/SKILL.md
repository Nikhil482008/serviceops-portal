---
name: push
description: Commit and push the latest local changes of this ITSM project to GitHub (origin/main), which auto-deploys to the live GitHub Pages site. Use whenever the user says "push", "push it", "push to github", or "/push".
---

# Push latest code to GitHub

When the user asks to **push**, do the following for the repository at the project root
(`e:\Claude\serviceOps cluade\ITSM Detail Page`).

## Repository facts
- Remote: `origin` → https://github.com/ronak-patel-motadata/ServiceOps-Ticket-Detail-.git
- Branch: `main`
- Live site (auto-deploys on every push to `main`, ~1–2 min): https://ronak-patel-motadata.github.io/ServiceOps-Ticket-Detail-/
- Git identity to use for commits: name `Ronak Patel`, email `nirav.bhatt@motadata.com`
  (pass via `-c user.name=... -c user.email=...` on the commit command).

## Steps

1. **Check there is something to push.**
   Run `git status --porcelain`. 
   - If it is empty AND `git status -sb` shows the branch is not ahead of origin, tell the user "Nothing to push — already up to date" and stop.

2. **Verify the build passes (guardrail).**
   Run `pnpm build`. 
   - If the build FAILS, do NOT commit or push. Show the error and ask the user whether to push anyway. Only skip this step if the user explicitly said to push without building.

3. **Stage everything.** Run `git add -A`.

4. **Commit.** Generate a concise, descriptive commit message from the actual changes
   (look at `git diff --cached --stat` / the work done this session). If the user supplied
   their own message, use that instead. Always append the Co-Authored-By trailer.
   Use this exact form (PowerShell-safe — two `-m` flags, no here-strings):
   ```
   git -c user.name="Ronak Patel" -c user.email="nirav.bhatt@motadata.com" commit -m "<summary>" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
   ```

5. **Push.** Run `git push`. (The branch already tracks `origin/main`, so no `-u` is needed.)

6. **Report back** to the user:
   - Confirm the push succeeded and show the new commit's short hash + summary.
   - Remind them the live site will reflect the change in ~1–2 minutes:
     https://ronak-patel-motadata.github.io/ServiceOps-Ticket-Detail-/
   - Optionally mention they can watch the deploy under the repo's **Actions** tab.

## Notes
- Do NOT use `--no-verify`, force-push, or amend existing pushed commits unless the user explicitly asks.
- If `git push` fails due to the remote being ahead (rejected), run `git pull --rebase` first, then push again — but only if there are no conflicts. If there are conflicts, stop and tell the user.
- The CI deploy workflow lives at `.github/workflows/deploy.yml`; you don't need to touch it.
