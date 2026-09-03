import { terminalManager } from '../terminal/TerminalView';
import { getActiveNativeTerminal } from '../terminal/active-terminal';
import { Ssh } from '../ssh/index';
import { encodeUtf8Base64 } from '../lib/encoding';
import { getActiveEditorApi } from '../editor/CodeEditor';
import { showSnippetPicker } from './snippet-picker';
import { KEY_UP, KEY_DOWN, KEY_LEFT, KEY_RIGHT } from '../lib/constants';
import { getNativeTerminalProvider } from '../terminal/terminal-provider';

export function handleKeyPress(data: string, activeTab: string) {
  if (activeTab === 'terminal') {
    const nativeProvider = getNativeTerminalProvider();
    const nativeId = getActiveNativeTerminal();

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
