/** DI hooks for overlay lifecycle — Pro injects native terminal hide/show */

type OverlayOpenHook = () => void;
type OverlayCloseHook = (restore: boolean) => void;

let onOverlayOpen: OverlayOpenHook = () => {};
let onOverlayClose: OverlayCloseHook = () => {};

export function setOverlayHooks(hooks: { onOpen: OverlayOpenHook; onClose: OverlayCloseHook }): void {
  onOverlayOpen = hooks.onOpen;
  onOverlayClose = hooks.onClose;
}

export function notifyOverlayOpen(): void { onOverlayOpen(); }
/** @param restore — true: restore hidden terminal, false: keep hidden (e.g. navigating away) */
export function notifyOverlayClose(restore = true): void { onOverlayClose(restore); }
