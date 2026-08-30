/**
 * Whether the Android native context menu should be left alone for this target.
 *
 * The app suppresses the menu everywhere by default — a long press on the UI
 * should not raise "copy / share" over a button. Two places need it back, and
 * for the same reason: they are text the user edits, and the native menu is the
 * only copy/paste affordance they have.
 */
export function keepsNativeContextMenu(target: EventTarget | null): boolean {
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return true;
  return target instanceof HTMLElement && target.closest('.cm-content') !== null;
}
