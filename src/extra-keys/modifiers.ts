import { KEY_TAB, KEY_UP, KEY_DOWN, KEY_LEFT, KEY_RIGHT } from '../lib/constants';

export interface KeyModifiers {
  ctrl: boolean;
  shift: boolean;
}

/**
 * xterm's modifier parameter: 1 + shift(1) + alt(2) + ctrl(4).
 * Only shift and ctrl are reachable from the extra-key bar.
 */
function modifierParam(mods: KeyModifiers): number {
  return 1 + (mods.shift ? 1 : 0) + (mods.ctrl ? 4 : 0);
}

/** Final byte of the CSI sequence each arrow key sends. */
const ARROW_FINALS: Record<string, string> = {
  [KEY_UP]: 'A',
  [KEY_DOWN]: 'B',
  [KEY_RIGHT]: 'C',
  [KEY_LEFT]: 'D',
};

const KEY_ENTER = '\r';
/** CSI Z — back-tab. What the old dedicated "S-Tab" button sent. */
const SHIFT_TAB = '\x1b[Z';
/** ESC CR — the shift+enter sequence Claude Code's `/terminal-setup` installs. */
const SHIFT_ENTER = '\x1b\r';
/** 0x1f — Ctrl-/ has been equivalent to Ctrl-_ since the VT102. */
const UNIT_SEPARATOR = '\x1f';

/**
 * Rewrite a key about to be sent so it carries the armed modifiers.
 *
 * Extra-key bar presses go straight to the session as bytes (`writeInput`), bypassing the
 * emulator's key path — so `readControlKey()` / SwiftTerm's `controlModifier` never see them
 * and the combination has to be produced here.
 *
 * Pairs with no sequence the receiving app could read are returned unmodified rather than
 * invented: our emulator negotiates neither kitty's CSI-u nor xterm's `modifyOtherKeys`, so
 * a made-up `\x1b[9;5u` for Ctrl+Tab would just arrive as garbage.
 */
export function applyModifiers(value: string, mods: KeyModifiers): string {
  if (!mods.ctrl && !mods.shift) return value;

  const arrowFinal = ARROW_FINALS[value];
  if (arrowFinal) return `\x1b[1;${modifierParam(mods)}${arrowFinal}`;

  if (value === KEY_TAB) return mods.shift ? SHIFT_TAB : value;
  if (value === KEY_ENTER) return mods.shift ? SHIFT_ENTER : value;
  if (value === '/' || value === '_') return mods.ctrl ? UNIT_SEPARATOR : value;

  return value;
}
