/** DI hooks for background keep-alive — Pro injects these at bootstrap */

export interface KeepAliveStartOptions {
  /**
   * Whether the host may ask the user for anything it needs first (e.g. notification permission).
   * `false` for starts the user did not just initiate, such as an automatic reconnect: a prompt
   * nobody asked for, possibly behind a native view, is worse than a keep-alive without it.
   */
  askPermission?: boolean;
}

type StartFn = (options?: KeepAliveStartOptions) => void;
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

export function keepAliveStart(options?: KeepAliveStartOptions): void { startFn?.(options); }
export function keepAliveStop(): void { stopFn?.(); }
export function keepAliveUpdate(count: number): void { updateFn?.(count); }
