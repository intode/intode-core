import type { Terminal } from '@xterm/xterm';
import { Ssh } from '../ssh/index';
import { encodeUtf8Base64 } from '../lib/encoding';

export class SshBridge {
  private dataListener: { remove: () => Promise<void> } | null = null;
  private onDataDisposable: { dispose: () => void } | null = null;
  private channelId: string | null = null;
  private compositionCleanup: (() => void) | null = null;

  constructor(private terminal: Terminal) {}

  async registerListener(): Promise<void> {
    this.dataListener = await Ssh.addListener('shellData', (event) => {
      if (!this.channelId || event.channelId !== this.channelId) return;
      try {
        const bin = atob(event.data);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        this.terminal.write(bytes);
      } catch { /* prevent propagation */ }
    });
  }

  attach(channelId: string): void {
    this.channelId = channelId;

    const send = (text: string) => {
      try {
        Ssh.writeToShell({ channelId, data: encodeUtf8Base64(text) }).catch(() => {});
      } catch { /* prevent propagation */ }
    };

    // Track IME composition to suppress intermediate jamo during Korean input.
    // This is the desktop/Android model, where the IME fires compositionstart /
    // compositionend and xterm.js's own CompositionHelper delivers the result.
    let composing = false;

    // iOS does not use that model at all, and the difference is not cosmetic.
    //
    // Measured on an iPhone 7 / iOS 15.8 with the system Korean keyboard, typing
    // "안녕" (`ios/1c-device-build`): 38 DOM events, ZERO composition events, and
    // isComposing false on every one. iOS composes by rewriting the textarea —
    //
    //   keydown 'ㅇ' -> insertText 'ㅇ'                            value "ㅇ"
    //   keydown 'ㅏ' -> deleteContentBackward -> insertText '아'    value "아"
    //   keydown 'ㄴ' -> deleteContentBackward -> insertText '안'    value "안"
    //   keydown 'ㄴ' -> insertText 'ㄴ'                            value "안ㄴ"
    //
    // xterm.js drops those insertText events: its handler runs only when
    // `!e.composed || !this._keyDownSeen`, and iOS always delivers a real keydown
    // first (xterm 5.5.0). Meanwhile that same keydown carries the *jamo* as its
    // key, which xterm does send. The shell therefore receives "ㅇㅏㄴㄴㅕㅇ"
    // instead of "안녕" — decomposed, and not what is on screen.
    //
    // So the bridge has to do two things: stop xterm from sending the jamo, and
    // translate the textarea rewrites into terminal bytes. A deleteContentBackward
    // becomes DEL (0x7f), an insertText becomes its text; the shell echoes each
    // intermediate syllable, which is what a terminal Korean IME looks like anyway.
    //
    // `imeBurst` scopes this to exactly the keys we suppressed. ASCII keydowns never
    // set it, so their input events (if a platform emits any) are left to xterm and
    // nothing is ever sent twice. `composing` keeps platforms that DO fire
    // composition events on their original path.
    let imeBurst = false;

    this.terminal.attachCustomKeyEventHandler((e) => {
      if (e.type === 'keydown') {
        const isSingleNonAscii = e.key.length === 1 && (e.key.codePointAt(0) ?? 0) > 0x7f;
        imeBurst = isSingleNonAscii && !composing;
        // Returning false tells xterm to ignore the key entirely — the text will
        // arrive through the input events below instead.
        return !imeBurst;
      }
      // keypress has to be suppressed as well, and this is not a belt-and-braces
      // second guard: xterm sends printable characters from _keyPress, not from
      // _keyDown. Measured on device — blocking only keydown left every jamo still
      // going to the shell, because keypress fires between keydown and beforeinput
      // and carries the same character.
      if (e.type === 'keypress') return !imeBurst;
      return true;
    });

    const textarea = this.terminal.element?.querySelector('.xterm-helper-textarea');
    if (textarea) {
      const onStart = () => { composing = true; imeBurst = false; };
      const onEnd = () => { composing = false; };
      const onInput = (ev: Event) => {
        if (composing || !imeBurst) return;
        const e = ev as InputEvent;
        if (e.inputType === 'deleteContentBackward') send('\x7f');
        else if (e.inputType === 'insertText' && e.data) send(e.data);
      };
      textarea.addEventListener('compositionstart', onStart);
      textarea.addEventListener('compositionend', onEnd);
      textarea.addEventListener('input', onInput);
      this.compositionCleanup = () => {
        textarea.removeEventListener('compositionstart', onStart);
        textarea.removeEventListener('compositionend', onEnd);
        textarea.removeEventListener('input', onInput);
      };
    }

    this.onDataDisposable = this.terminal.onData((data) => {
      if (composing) return;
      send(data);
    });
  }

  disconnect(): void {
    this.compositionCleanup?.();
    this.compositionCleanup = null;
    this.onDataDisposable?.dispose();
    this.onDataDisposable = null;
    this.dataListener?.remove();
    this.dataListener = null;
    this.channelId = null;
  }
}
