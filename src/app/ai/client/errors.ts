/* Ask AI — failure, in plain language.
 *
 * Every code maps to one sentence that says what broke and what to do next, because "Something
 * went wrong" is the same message for a dropped wifi connection and an expired session, and the
 * two need different reactions from the user.
 */
import type { AiErrorCode } from '../types';

export class AiError extends Error {
  code: AiErrorCode;
  constructor(code: AiErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'AiError';
    this.code = code;
  }
}

/** What the thread shows. Second person, says the next action, no apology. */
export const AI_ERROR_TEXT: Record<AiErrorCode, string> = {
  network:
    "Couldn't reach the assistant. Check your connection and try again.",
  timeout:
    'The assistant took too long to respond. Try again, or ask something narrower.',
  unauthorized:
    'Your session expired. Sign in again, then retry.',
  rate_limited:
    "You've sent a lot of requests. Wait a moment and try again.",
  aborted:
    'Stopped.',
  not_configured:
    'The assistant is running against mock data — no AI service is configured for this build.',
};

/** Whether offering Retry makes sense. Stopping was deliberate, so it is not a failure to retry;
 *  an unconfigured backend will not become configured by asking twice. */
export const AI_ERROR_RETRYABLE: Record<AiErrorCode, boolean> = {
  network: true,
  timeout: true,
  unauthorized: true,
  rate_limited: true,
  aborted: false,
  not_configured: false,
};

/** Scrubbed for logging. Prompts and response bodies never reach the console or the error
 *  reporter — only the code and where it came from. */
export const scrubForLog = (code: AiErrorCode, where: string) =>
  `[ask-ai] ${where} failed: ${code}`;
