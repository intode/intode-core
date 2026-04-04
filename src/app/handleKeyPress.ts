import { terminalManager } from '../terminal/TerminalView';
import { Ssh } from '../ssh/index';
import { encodeUtf8Base64 } from '../lib/encoding';
import { getActiveEditorApi } from '../editor/CodeEditor';
import { showSnippetPicker } from './snippet-picker';
import { KEY_UP, KEY_DOWN, KEY_LEFT, KEY_RIGHT } from '../lib/constants';
import { getNativeTerminalProvider } from '../terminal/terminal-provider';

/** Find the textarea belonging to the currently active terminal session. */
function getActiveTerminalTextarea(): HTMLTextAreaElement | null {
  const session = terminalManager.getActiveSession();
  if (!session) return null;
  return session.terminal.element?.querySelector('.xterm-helper-textarea') as HTMLTextAreaElement | null;
}

/** Get the active native terminal ID (stored on TerminalManager). */
function getActiveNativeTerminalId(): string | null {
  return (terminalManager as any).__activeNativeId ?? null;
}

function toggleKeyboard(activeTab: string) {
  if (activeTab === 'terminal') {
    const nativeProvider = getNativeTerminalProvider();
    const nativeId = getActiveNativeTerminalId();
    if (nativeProvider?.isAvailable() && nativeId) {
      nativeProvider.focusTerminal(nativeId);
      return;
    }
    const el = getActiveTerminalTextarea();
    if (!el) return;
    const shouldFocus = document.activeElement !== el;
    setTimeout(() => {
      if (shouldFocus) {
        el.focus();
        (window as any).__intodeShowKeyboard?.();
      } else {
        el.blur();
      }
    }, 50);
  } else if (activeTab === 'editor') {
    const cm = document.querySelector('.cm-content') as HTMLElement | null;
    if (!cm) return;
    const shouldFocus = document.activeElement !== cm;
    setTimeout(() => {
      if (shouldFocus) {
        cm.focus();
        (window as any).__intodeShowKeyboard?.();
      } else {
        cm.blur();
      }
    }, 50);
  }
}

export function handleKeyPress(data: string, activeTab: string) {
  if (data === 'keyboard') {
    toggleKeyboard(activeTab);
    return;
  }

  if (activeTab === 'terminal') {
    const nativeProvider = getNativeTerminalProvider();
    const nativeId = getActiveNativeTerminalId();

    if (nativeProvider?.isAvailable() && nativeId) {
      // Native terminal path
      if (data === 'snippets') {
        showSnippetPicker((cmd) => {
          nativeProvider.writeInput(nativeId, cmd);
        });
        return;
      }
      nativeProvider.writeInput(nativeId, data);
      return;
    }

    // xterm.js path
    if (data === 'snippets') {
      showSnippetPicker((cmd) => {
        const session = terminalManager.getActiveSession();
        if (session?.channelId) {
          Ssh.writeToShell({ channelId: session.channelId, data: encodeUtf8Base64(cmd) }).catch(() => {});
        }
      });
      return;
    }
    const session = terminalManager.getActiveSession();
    if (session?.channelId) {
      Ssh.writeToShell({ channelId: session.channelId, data: encodeUtf8Base64(data) }).catch(() => {});
    }
  } else if (activeTab === 'editor') {
    const editor = getActiveEditorApi();
    if (!editor) return;
    if (data === 'save') editor.save();
    else if (data === 'undo') editor.undo();
    else if (data === 'redo') editor.redo();
    else if (data === 'tab') editor.insertText('\t');
    else if (data === KEY_UP) editor.cursorUp();
    else if (data === KEY_DOWN) editor.cursorDown();
    else if (data === KEY_LEFT) editor.cursorLeft();
    else if (data === KEY_RIGHT) editor.cursorRight();
    else if (data === 'md:heading') editor.prependLine('# ');
    else if (data === 'md:bold') editor.wrapSelection('**', '**');
    else if (data === 'md:italic') editor.wrapSelection('_', '_');
    else if (data === 'md:code') editor.wrapSelection('```\n', '\n```');
    else if (data === 'md:list') editor.prependLine('- ');
    else if (data === 'md:quote') editor.prependLine('> ');
    else if (data === 'md:link') editor.wrapSelection('[', '](url)');
    else if (data === 'md:image') editor.wrapSelection('![', '](url)');
    else editor.insertText(data);
  }
}
