/* Ask AI — feature gating.
 *
 * This repo has no flag service. Its one convention is a `hidden?: boolean` filtered ONCE at the
 * module boundary so no consumer has to remember to apply it (adminData.ts:424-429, and the same
 * shape on Sidebar's BOM rows). The gate here follows that: ONE exported boolean, read by both
 * the rail button and the panel mount, so the two cannot disagree about whether the feature
 * exists — a rail button that opens nothing is worse than no rail button.
 *
 * When false the button does not render AT ALL (not disabled, not hidden with CSS) and the panel
 * is never mounted, so its lazy chunk is never requested either.
 */

export const AI_FLAGS = {
  /** Master switch for the Ask AI rail entry point and its panel. */
  ai_assistant_enabled: true,
  /** Which surface every entry point opens.
   *
   *  true  → the Nova shell: the entry choreography, the orb, the greeting and suggestion cards.
   *  false → `panel/AskAiPanel`, the pre-redesign panel with the working mock conversation.
   *
   *  ⚠️ They are NOT equivalent yet. Nova is a shell — it has no message list — so with this on,
   *  the composer and the Use Cases page's rows open the drawer but have nowhere to put a
   *  question. That is the state the redesign is deliberately in; this flag is how you get the
   *  old conversation back in one edit rather than a revert. */
  ai_nova_shell: true,
} as const;

export const isAskAiEnabled = () => AI_FLAGS.ai_assistant_enabled;
export const isNovaShell = () => AI_FLAGS.ai_nova_shell;

/* Why an env var and not just the constant above: the mock adapter has to be the default in this
 * prototype (there is no backend to talk to), but a developer pointing at a real endpoint should
 * not have to edit a tracked file to do it. `import.meta.env` is already used in this codebase —
 * four sites, all for BASE_URL — so the mechanism is not new, only the variable is.
 *
 * VITE_AI_TRANSPORT=sse  →  the stubbed SSE adapter (throws NotConfigured until a contract lands)
 * anything else / unset  →  the mock adapter
 */
export const aiTransport = (): 'mock' | 'sse' => {
  const raw = (import.meta.env?.VITE_AI_TRANSPORT ?? '').toString().toLowerCase();
  return raw === 'sse' ? 'sse' : 'mock';
};
