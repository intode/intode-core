/** DI hooks for background keep-alive — Pro injects these at bootstrap */

type StartFn = () => void;
type StopFn = () => void;
type UpdateFn = (activeCount: number) => void;

let startFn: StartFn | null = null;
let stopFn: StopFn | null = null;
let updateFn: UpdateFn | null = null;

export function setKeepAliveHooks(hooks: { start: StartFn; stop: StopFn; update: UpdateFn }): void {
  startFn = hooks.start;
  stopFn = hooks.stop;
  updateFn = hooks.update;
}

export function keepAliveStart(): void { startFn?.(); }
export function keepAliveStop(): void { stopFn?.(); }
export function keepAliveUpdate(count: number): void { updateFn?.(count); }
