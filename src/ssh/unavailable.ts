/**
 * Telling "this build has no implementation for that call" apart from
 * "the server refused it".
 *
 * The two need different words. A server error is worth showing verbatim
 * ("Permission denied" is actionable); a missing implementation is not — the
 * runtime's own wording names the bridge method and the OS, which means nothing
 * to the person holding the phone and reads as a defect to a store reviewer.
 *
 * This matches the *shape* of the runtime's message, never a platform name, so
 * core stays unaware of which platforms exist.
 */

/** Capacitor rejects unimplemented bridge methods with this wording. */
const UNIMPLEMENTED_PATTERN = /is not implemented on/i;

/** Some runtimes set a code instead of, or as well as, the message. */
const UNIMPLEMENTED_CODES = new Set(['UNIMPLEMENTED', 'UNAVAILABLE']);

export function isUnavailableError(e: unknown): boolean {
  if (!e) return false;
  const code = (e as { code?: unknown }).code;
  if (typeof code === 'string' && UNIMPLEMENTED_CODES.has(code.toUpperCase())) return true;
  const message = e instanceof Error ? e.message : typeof e === 'string' ? e : String((e as { message?: unknown }).message ?? '');
  return UNIMPLEMENTED_PATTERN.test(message);
}

/** What we say instead. Neutral on purpose — never name an OS here. */
export const UNAVAILABLE_TEXT = 'Not available on this platform';

/**
 * The same sentence when there is no error to inspect — a capability flag said
 * up front that the runtime does not have the operation, so nothing was called.
 *
 * @param action Human wording for what was attempted, e.g. `'Media preview'`.
 */
export function unavailableTitle(action: string): string {
  return `${action} is not available on this platform`;
}

/**
 * One line for a failed action, safe to show as-is.
 *
 * @param action Human wording for what was attempted, e.g. `'Rename'`.
 */
export function describeFailure(action: string, e: unknown): { title: string; detail?: string } {
  if (isUnavailableError(e)) {
    return { title: unavailableTitle(action) };
  }
  const detail = e instanceof Error ? e.message : String(e);
  return { title: `${action} failed`, detail };
}
