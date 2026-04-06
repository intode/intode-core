# Contributing to Intode Core

Thanks for your interest in contributing! Here's how to get started.

## Development Setup

1. Clone the repo:
   ```bash
   git clone https://github.com/intode/intode-core.git
   cd intode-core
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build:
   ```bash
   npm run build
   ```

Core is a library, not a standalone app. To see changes in action, you'll need the full Intode app (private repo) or your own Capacitor host app.

## Code Guidelines

- **Language**: All code, comments, commit messages, and documentation must be in **English**
- **TypeScript**: Strict mode, no `any` unless unavoidable
- **React**: Functional components, hooks only
- **Style**: Inline styles (no CSS modules/Tailwind) — keeps the component tree self-contained
- **No default exports**: Use named exports everywhere

## Architecture Rules

- **No premium gates in core** — core must work standalone with no feature restrictions
- **DI only** — Pro features are injected via hooks (`set*()` functions), never imported directly
- **No telemetry** — core collects nothing
- **Minimal dependencies** — think twice before adding a new package

## Pull Requests

1. Fork the repo and create a branch from `main`
2. Keep changes focused — one feature or fix per PR
3. Write clear commit messages explaining *why*, not just *what*
4. Test your changes with a Capacitor app if possible
5. Open a PR with a description of what you changed and why

## Reporting Issues

Open an issue on GitHub with:
- What you expected to happen
- What actually happened
- Steps to reproduce
- Device/OS info if relevant

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
