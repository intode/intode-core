import type { ConnectionStatus } from '../ssh/plugin-api';

/** Why the terminal's session is down, or `null` when it is not. */
export type SessionDownReason = 'disconnected' | 'suspended';

/**
 * Folds a `connectionStatus` event into the banner state.
 *
 * `suspended` is a host that closed the session on purpose while the app was in the background
 * (to save battery). It is kept apart from `disconnected` only for the wording — both mean the
 * shell is gone and a tap reconnects. States in between (connecting, reconnecting) do not
 * change what the banner says.
 */
export function sessionDownReason(
  status: ConnectionStatus,
  current: SessionDownReason | null,
): SessionDownReason | null {
  switch (status) {
    case 'connected':
      return null;
    case 'suspended':
      return 'suspended';
    case 'disconnected':
    case 'error':
      return 'disconnected';
    default:
      return current;
  }
}

export function sessionBannerTitle(reason: SessionDownReason, reconnecting: boolean): string {
  if (reconnecting) return 'Reconnecting…';
  return reason === 'suspended'
    ? 'Paused to save battery — Tap to reconnect'
    : 'Disconnected — Tap to reconnect';
}
