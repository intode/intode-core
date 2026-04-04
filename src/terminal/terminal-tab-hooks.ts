/** DI hooks for terminal tab restore & tmux config — Pro injects guards at bootstrap */

type GuardFn = () => boolean;

let restoreGuard: GuardFn = () => true;
let tmuxGuard: GuardFn = () => true;

export function setTerminalTabRestoreGuard(fn: GuardFn): void { restoreGuard = fn; }
export function setTmuxConfigGuard(fn: GuardFn): void { tmuxGuard = fn; }

export function canRestoreTerminalTabs(): boolean { return restoreGuard(); }
export function canConfigureTmux(): boolean { return tmuxGuard(); }
