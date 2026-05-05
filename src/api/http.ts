/**
 * Shared HTTP helpers.
 *
 * timedFetch — wraps fetch() with an AbortController-based timeout. The
 * controller is aborted after `timeoutMs` and the timer is cleared on
 * settlement. Callers see a regular fetch Promise that may reject with
 * an AbortError on timeout.
 */
export async function timedFetch(
  uri: string,
  init: RequestInit = {},
  timeoutMs = 5000,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(uri, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
