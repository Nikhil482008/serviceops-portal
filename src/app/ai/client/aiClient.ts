/* The ONLY place Ask AI talks to a service. No component calls an endpoint directly.
 *
 * The transport is chosen by `VITE_AI_TRANSPORT` and defaults to the mock, because this repo has
 * no backend at all — this module is the first network seam in the project. The SSE adapter is a
 * STUB on purpose: inventing an endpoint contract would mean the real integration starts by
 * deleting guesses. It throws a named error the UI knows how to explain.
 */
import type { AiFrame, AiSendRequest } from '../types';
import { aiTransport } from '../flags';
import { AiError, scrubForLog } from './errors';
import { mockStream } from './mockAdapter';

/** How long to wait for the WHOLE response before giving up. */
const TIMEOUT_MS = 30_000;

/** The stubbed real transport. Replace the body when the backend contract lands; everything
 *  upstream of here already speaks `AiFrame`. */
async function* sseStream(_req: AiSendRequest): AsyncGenerator<AiFrame> {
  throw new AiError('not_configured', 'No AI endpoint is configured for this build.');
}

/**
 * Send a conversation and stream frames back.
 *
 * Never throws for an expected failure — errors arrive as a terminal `{t:'error'}` frame so the
 * caller has one loop to write rather than a loop plus a catch. An abort is a normal outcome, not
 * an error: the user pressed Stop.
 */
export async function* send(req: AiSendRequest): AsyncGenerator<AiFrame> {
  const source = aiTransport() === 'sse' ? sseStream : mockStream;

  /* A timeout that races the WHOLE stream, not each frame: a service that dribbles one token a
     minute is failing even though no single gap looks wrong. */
  const deadline = Date.now() + TIMEOUT_MS;

  try {
    for await (const frame of source(req)) {
      if (req.signal?.aborted) {
        yield { t: 'error', code: 'aborted' };
        return;
      }
      if (Date.now() > deadline) {
        console.warn(scrubForLog('timeout', 'aiClient.send'));
        yield { t: 'error', code: 'timeout' };
        return;
      }
      yield frame;
    }
  } catch (err) {
    /* An AbortError is the user pressing Stop — expected, and reported as such. */
    if (err instanceof DOMException && err.name === 'AbortError') {
      yield { t: 'error', code: 'aborted' };
      return;
    }
    const code = err instanceof AiError ? err.code : 'network';
    /* Scrubbed: the code and the call site, never the prompt or the response body. */
    console.warn(scrubForLog(code, 'aiClient.send'));
    yield { t: 'error', code };
  }
}

export const aiClient = { send };
