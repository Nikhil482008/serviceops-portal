/* Where the panel is attached to the app, and where its bundle is kept out of the initial load.
 *
 * Split from the panel itself so App.tsx can import something tiny and synchronous. The panel is
 * behind `React.lazy`, so its chunk — the markdown renderer, the client, the composer — is not
 * requested until someone opens it for the first time. Nothing here renders until then either:
 * `open` is false on first paint, so `<Suspense>` never even shows a fallback.
 */
import { Suspense, lazy, useEffect } from 'react';
import { isAskAiEnabled } from './flags';
import { useAskAiActions, useAskAiState } from './AskAiProvider';
import { AskAiEdge } from './AskAiEdge';

const AskAiPanel = lazy(() => import('./panel/AskAiPanel'));

export function AskAiPanelMount({ activePage }: { activePage: string }) {
  const { open } = useAskAiState();
  const { setScope } = useAskAiActions();

  /* The panel's thread is keyed by scope, and until the context registry lands the page id IS the
     scope. That is what keeps one screen's conversation out of another's, and it is the same
     mechanism a registered screen will use — it will just supply a richer name. */
  useEffect(() => { setScope(activePage); }, [activePage, setScope]);

  /* Flag off → nothing at all, and the panel's chunk is never fetched either. */
  if (!isAskAiEnabled()) return null;

  return (
    <>
      {/* The edge strip is app chrome and renders whether or not the panel is open — it hides
          itself when the assistant is on screen. Mounted here rather than in Sidebar so it is not
          repeated by each of the ~23 pages that draw their own rail. */}
      <AskAiEdge />
      {open && (
        <Suspense fallback={null}>
          <AskAiPanel />
        </Suspense>
      )}
    </>
  );
}
