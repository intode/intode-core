/** DI hooks for workspace form extensions — Pro injects visibility guards */

type VisibilityFn = () => boolean;

let jumpHostVisible: VisibilityFn = () => false;

export function setJumpHostVisible(fn: VisibilityFn): void { jumpHostVisible = fn; }
export function isJumpHostVisible(): boolean { return jumpHostVisible(); }
