# Intode Core

The open-source foundation of [Intode](https://play.google.com/store/apps/details?id=com.intode.app) — a mobile SSH IDE for Android.

Connect to your server from your phone. Browse files, edit code, run terminals, use Claude Code.

## What's in Core?

Everything you need for a fully functional mobile SSH IDE:

- **Terminal** — xterm.js with full escape sequence support, extra key bar (Esc, Tab, Ctrl combos), pinch zoom
- **File Browser** — SFTP tree view with lazy loading, drag-to-reorder tabs, file actions (rename, delete, chmod)
- **Code Editor** — CodeMirror 6 with syntax highlighting for 100+ languages, remote save
- **Markdown Preview** — GFM rendering with remark/rehype pipeline, plugin system for extensions
- **SSH Key Management** — Generate Ed25519/RSA keys on device, import existing keys
- **Extra Keys** — Customizable key bar with terminal shortcuts and snippet support
- **Pinch Zoom** — Natural gesture-based font size adjustment for terminal and editor
- **Dark/Light Themes** — Catppuccin Mocha (dark) and Latte (light)

## Architecture

Core is designed as a **headless UI library** — it provides all React components and business logic, but relies on native plugins (Capacitor) for SSH, SFTP, and terminal I/O.

```
core/src/
├── app/          # App shell, settings, tab/panel registry, DI hooks
├── terminal/     # Terminal view, selection, tab management
├── files/        # File tree, tab manager, SFTP operations
├── editor/       # CodeMirror integration, syntax detection
├── md-preview/   # Markdown rendering pipeline
├── ssh/          # SSH plugin API types, key management UI
├── extra-keys/   # Extra key bar component
├── workspace/    # Workspace management, add/edit screens
├── gestures/     # Pinch zoom handler
├── themes/       # Color schemes
├── policies/     # Feature gating (DI-based, no hard limits in core)
├── plugins/      # Plugin API for extending panels/tabs
└── lib/          # Shared constants, styles, utilities
```

### DI (Dependency Injection)

Core defines extension points that the host app injects at bootstrap:

```typescript
// Terminal provider (xterm.js fallback or native)
setNativeTerminalProvider(provider);

// Feature policies (core defaults: everything unlimited)
setPolicy(policy);
setLimitHandler(onLimitReached);

// Session persistence
setSessionSaveHook(saveFn);
setSessionLoadHook(loadFn);

// UI extensions
registerTab({ id, label, icon, order }, Component);
registerFilePanel({ id, label, component });
registerEditorPanel({ id, label, component });
registerSettingsPage({ id, label, subtitle, order }, Component);

// Markdown extensions
registerRemarkPlugin(plugin);
registerRehypePlugin(plugin);
```

This means **core has zero premium gates** — all limits and Pro features are injected from outside.

## Open Core Model

| Core (MIT) | Pro (proprietary) |
|:---:|:---:|
| SSH/SFTP, terminal, file browser, code editor | Mermaid, KaTeX, MDX rendering |
| Basic GFM markdown, extra keys, pinch zoom | Port forwarding, jump host |
| Dark/light themes | Session restore, background keep-alive |
| DI hooks + plugin API | Git integration, grep search |
| | Custom themes/keys, snippets |
| | Web preview + DevTools |
| | Billing + subscription |

> **Note on the native Android terminal:** The Termux terminal-view fork and SSHJ integration live in `pro/`, but the DI provider is registered unconditionally at bootstrap with no policy gate. The shipped app provides the native terminal to all users (free and pro alike).

Core alone is a complete, functional SSH IDE. Pro adds power-user features through the DI system.

## Usage

Core is published as an npm package consumed by the Intode app. It's not meant to be used standalone, but you can reference it for building your own SSH-based tools.

```bash
npm install intode-core
```

```typescript
import { App } from 'intode-core';
import { setWorkspaceStore } from 'intode-core';

// Provide your workspace storage implementation
setWorkspaceStore(myStore);

// Render
<App />
```

## Tech Stack

- **TypeScript** + **React 18**
- **Capacitor 8** — native bridge for SSH/SFTP plugins
- **xterm.js** — terminal emulator
- **CodeMirror 6** — code editor
- **unified** (remark + rehype) — markdown pipeline

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

[MIT](LICENSE) — Copyright (c) 2024 Intode
