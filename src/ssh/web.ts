/**
 * Mock SSH Web Plugin — browser fallback for screenshots/development.
 * Provides fake file system, terminal output, and git data.
 */
import { WebPlugin } from '@capacitor/core';
import type { SshPlugin, SftpEntry, ConnectionStatus, PortForwardEntry, SshKey } from './plugin-api';

// --- Mock file system ---
const MOCK_FILES: Record<string, SftpEntry[]> = {
  '~/project': [
    { name: '.git', path: '~/project/.git', isDirectory: true, size: 0, modifiedAt: 1710000000000, permissions: 'drwxr-xr-x' },
    { name: 'src', path: '~/project/src', isDirectory: true, size: 0, modifiedAt: 1712000000000, permissions: 'drwxr-xr-x' },
    { name: 'docs', path: '~/project/docs', isDirectory: true, size: 0, modifiedAt: 1711000000000, permissions: 'drwxr-xr-x' },
    { name: 'node_modules', path: '~/project/node_modules', isDirectory: true, size: 0, modifiedAt: 1709000000000, permissions: 'drwxr-xr-x' },
    { name: 'package.json', path: '~/project/package.json', isDirectory: false, size: 1240, modifiedAt: 1712100000000, permissions: '-rw-r--r--' },
    { name: 'tsconfig.json', path: '~/project/tsconfig.json', isDirectory: false, size: 380, modifiedAt: 1711500000000, permissions: '-rw-r--r--' },
    { name: 'README.md', path: '~/project/README.md', isDirectory: false, size: 2840, modifiedAt: 1712200000000, permissions: '-rw-r--r--' },
    { name: '.env', path: '~/project/.env', isDirectory: false, size: 120, modifiedAt: 1710500000000, permissions: '-rw-------' },
    { name: 'Dockerfile', path: '~/project/Dockerfile', isDirectory: false, size: 450, modifiedAt: 1711800000000, permissions: '-rw-r--r--' },
  ],
  '~/project/src': [
    { name: 'components', path: '~/project/src/components', isDirectory: true, size: 0, modifiedAt: 1712000000000, permissions: 'drwxr-xr-x' },
    { name: 'hooks', path: '~/project/src/hooks', isDirectory: true, size: 0, modifiedAt: 1711800000000, permissions: 'drwxr-xr-x' },
    { name: 'utils', path: '~/project/src/utils', isDirectory: true, size: 0, modifiedAt: 1711500000000, permissions: 'drwxr-xr-x' },
    { name: 'index.ts', path: '~/project/src/index.ts', isDirectory: false, size: 520, modifiedAt: 1712100000000, permissions: '-rw-r--r--' },
    { name: 'App.tsx', path: '~/project/src/App.tsx', isDirectory: false, size: 3200, modifiedAt: 1712200000000, permissions: '-rw-r--r--' },
    { name: 'main.tsx', path: '~/project/src/main.tsx', isDirectory: false, size: 280, modifiedAt: 1711000000000, permissions: '-rw-r--r--' },
    { name: 'types.ts', path: '~/project/src/types.ts', isDirectory: false, size: 680, modifiedAt: 1711600000000, permissions: '-rw-r--r--' },
  ],
  '~/project/src/components': [
    { name: 'Header.tsx', path: '~/project/src/components/Header.tsx', isDirectory: false, size: 1400, modifiedAt: 1712000000000, permissions: '-rw-r--r--' },
    { name: 'Sidebar.tsx', path: '~/project/src/components/Sidebar.tsx', isDirectory: false, size: 2100, modifiedAt: 1712100000000, permissions: '-rw-r--r--' },
    { name: 'Dashboard.tsx', path: '~/project/src/components/Dashboard.tsx', isDirectory: false, size: 4200, modifiedAt: 1712200000000, permissions: '-rw-r--r--' },
    { name: 'Button.tsx', path: '~/project/src/components/Button.tsx', isDirectory: false, size: 890, modifiedAt: 1711500000000, permissions: '-rw-r--r--' },
    { name: 'Modal.tsx', path: '~/project/src/components/Modal.tsx', isDirectory: false, size: 1600, modifiedAt: 1711800000000, permissions: '-rw-r--r--' },
  ],
  '~/project/src/hooks': [
    { name: 'useAuth.ts', path: '~/project/src/hooks/useAuth.ts', isDirectory: false, size: 1200, modifiedAt: 1711800000000, permissions: '-rw-r--r--' },
    { name: 'useApi.ts', path: '~/project/src/hooks/useApi.ts', isDirectory: false, size: 950, modifiedAt: 1711600000000, permissions: '-rw-r--r--' },
    { name: 'useTheme.ts', path: '~/project/src/hooks/useTheme.ts', isDirectory: false, size: 640, modifiedAt: 1711000000000, permissions: '-rw-r--r--' },
  ],
  '~/project/src/utils': [
    { name: 'format.ts', path: '~/project/src/utils/format.ts', isDirectory: false, size: 780, modifiedAt: 1711500000000, permissions: '-rw-r--r--' },
    { name: 'validate.ts', path: '~/project/src/utils/validate.ts', isDirectory: false, size: 1100, modifiedAt: 1711200000000, permissions: '-rw-r--r--' },
  ],
  '~/project/docs': [
    { name: 'ARCHITECTURE.md', path: '~/project/docs/ARCHITECTURE.md', isDirectory: false, size: 5200, modifiedAt: 1711000000000, permissions: '-rw-r--r--' },
    { name: 'API.md', path: '~/project/docs/API.md', isDirectory: false, size: 3800, modifiedAt: 1710500000000, permissions: '-rw-r--r--' },
    { name: 'CHANGELOG.md', path: '~/project/docs/CHANGELOG.md', isDirectory: false, size: 2400, modifiedAt: 1712200000000, permissions: '-rw-r--r--' },
  ],
};

// --- Mock file contents ---
const MOCK_CONTENTS: Record<string, string> = {
  '~/project/src/App.tsx': `import React from 'react';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { useAuth } from './hooks/useAuth';
import { useTheme } from './hooks/useTheme';

export function App() {
  const { user, isLoading } = useAuth();
  const { theme, toggleTheme } = useTheme();

  if (isLoading) {
    return <div className="loading">Loading...</div>;
  }

  if (!user) {
    return <LoginScreen />;
  }

  return (
    <div className={\`app \${theme}\`}>
      <Header
        user={user}
        onToggleTheme={toggleTheme}
      />
      <div className="layout">
        <Sidebar activeRoute={location.pathname} />
        <main className="content">
          <Dashboard userId={user.id} />
        </main>
      </div>
    </div>
  );
}`,
  '~/project/src/index.ts': `export { App } from './App';
export { useAuth } from './hooks/useAuth';
export { useApi } from './hooks/useApi';
export type { User, ApiResponse } from './types';`,
  '~/project/src/types.ts': `export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user' | 'viewer';
  avatar?: string;
  createdAt: Date;
}

export interface ApiResponse<T> {
  data: T;
  status: number;
  message?: string;
  pagination?: {
    page: number;
    total: number;
    perPage: number;
  };
}

export interface DashboardStats {
  totalUsers: number;
  activeToday: number;
  revenue: number;
  growth: number;
}`,
  '~/project/src/components/Dashboard.tsx': `import React, { useState, useEffect } from 'react';
import { useApi } from '../hooks/useApi';
import type { DashboardStats } from '../types';

interface DashboardProps {
  userId: string;
}

export function Dashboard({ userId }: DashboardProps) {
  const { data, error, loading } = useApi<DashboardStats>(
    \`/api/dashboard/\${userId}\`
  );

  if (loading) return <Skeleton />;
  if (error) return <ErrorCard message={error} />;

  return (
    <div className="dashboard">
      <h2>Dashboard</h2>
      <div className="stats-grid">
        <StatCard
          label="Total Users"
          value={data.totalUsers}
          icon="users"
        />
        <StatCard
          label="Active Today"
          value={data.activeToday}
          trend="+12%"
        />
        <StatCard
          label="Revenue"
          value={\`$\${data.revenue.toLocaleString()}\`}
          trend="+8.3%"
        />
        <StatCard
          label="Growth"
          value={\`\${data.growth}%\`}
          icon="trending-up"
        />
      </div>
    </div>
  );
}`,
  '~/project/src/hooks/useAuth.ts': `import { useState, useEffect, useCallback } from 'react';
import type { User } from '../types';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  error: string | null;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      setState({ user: null, isLoading: false, error: null });
      return;
    }

    fetch('/api/auth/me', {
      headers: { Authorization: \`Bearer \${token}\` },
    })
      .then((res) => res.json())
      .then((user) => setState({ user, isLoading: false, error: null }))
      .catch((err) => setState({ user: null, isLoading: false, error: err.message }));
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('auth_token');
    setState({ user: null, isLoading: false, error: null });
  }, []);

  return { ...state, logout };
}`,
  '~/project/package.json': `{
  "name": "my-dashboard",
  "version": "2.4.1",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "test": "vitest run",
    "lint": "eslint src/",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.22.0",
    "zustand": "^4.5.0",
    "axios": "^1.6.5"
  },
  "devDependencies": {
    "@types/react": "^18.3.0",
    "@vitejs/plugin-react": "^4.2.1",
    "typescript": "^5.4.0",
    "vite": "^5.1.0",
    "vitest": "^1.3.0",
    "eslint": "^8.56.0"
  }
}`,
  '~/project/README.md': `# My Dashboard

A modern admin dashboard built with React and TypeScript.

## Features

- **Real-time analytics** — live data updates via WebSocket
- **Role-based access** — admin, user, and viewer permissions
- **Dark/Light theme** — automatic system preference detection
- **Responsive** — mobile-first design with breakpoints

## Quick Start

\`\`\`bash
# Install dependencies
pnpm install

# Start dev server
pnpm dev

# Run tests
pnpm test
\`\`\`

## Architecture

\`\`\`
src/
\u251c\u2500\u2500 components/    # UI components
\u251c\u2500\u2500 hooks/         # Custom React hooks
\u251c\u2500\u2500 utils/         # Helper functions
\u251c\u2500\u2500 types.ts       # TypeScript types
\u2514\u2500\u2500 App.tsx        # Root component
\`\`\`

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | \`/api/auth/me\` | Current user |
| GET | \`/api/dashboard/:id\` | Dashboard stats |
| POST | \`/api/users\` | Create user |
| PUT | \`/api/users/:id\` | Update user |

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| \`VITE_API_URL\` | Backend API URL | Yes |
| \`VITE_WS_URL\` | WebSocket URL | Yes |
| \`VITE_SENTRY_DSN\` | Sentry error tracking | No |

## License

MIT
`,
  '~/project/docs/ARCHITECTURE.md': `# Architecture

## Overview

The dashboard follows a **component-driven architecture** with clear separation of concerns.

### Layers

1. **Presentation** \u2014 React components (pure UI)
2. **State** \u2014 Zustand stores (business logic)
3. **Data** \u2014 API hooks (\`useApi\`, \`useAuth\`)
4. **Transport** \u2014 Axios HTTP client + WebSocket

### Data Flow

\`\`\`mermaid
graph LR
    A[Component] -->|dispatch| B[Store]
    B -->|select| A
    B -->|call| C[API Hook]
    C -->|fetch| D[Backend]
    D -->|response| C
\`\`\`

## Key Decisions

- **Zustand over Redux** \u2014 simpler API, less boilerplate
- **Vite over Webpack** \u2014 faster HMR, ESM-native
- **Vitest over Jest** \u2014 Vite-compatible, faster execution
`,
  '~/project/docs/CHANGELOG.md': `# Changelog

## [2.4.1] - 2024-03-15

### Fixed
- Dashboard stats not refreshing after timezone change
- Modal z-index conflict with header dropdown

## [2.4.0] - 2024-03-10

### Added
- Real-time WebSocket updates for dashboard
- Export dashboard data as CSV
- User activity heatmap

### Changed
- Migrated state management from Redux to Zustand
- Updated React Router to v6

## [2.3.0] - 2024-02-28

### Added
- Dark mode support with system preference detection
- Role-based route guards
`,
  '~/project/Dockerfile': `FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]`,
  '~/project/tsconfig.json': `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "moduleResolution": "bundler",
    "outDir": "dist",
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src"]
}`,
};

// --- Mock git data ---
const GIT_LOG = `a3f8c21|2024-03-15|Junseong Park|fix: dashboard stats timezone bug
b7e2d94|2024-03-14|Junseong Park|feat: add CSV export for dashboard
c1a9f06|2024-03-13|Junseong Park|refactor: migrate Redux to Zustand
d4b3e18|2024-03-12|Minseo Kim|feat: WebSocket real-time updates
e8c5a72|2024-03-11|Junseong Park|feat: dark mode system preference
f2d1b39|2024-03-10|Junseong Park|fix: modal z-index conflict
0a7e4c5|2024-03-09|Minseo Kim|feat: user activity heatmap
1b8f3d6|2024-03-08|Junseong Park|chore: update React Router to v6
2c9a4e7|2024-03-07|Junseong Park|feat: role-based route guards
3d0b5f8|2024-03-06|Minseo Kim|test: add Dashboard unit tests`;

const GIT_STATUS = ` M src/App.tsx
 M src/components/Dashboard.tsx
A  src/components/Modal.tsx
 D src/hooks/useTheme.ts
?? src/utils/validate.ts`;

const GIT_DIFF = `diff --git a/src/components/Dashboard.tsx b/src/components/Dashboard.tsx
index 8a3f2e1..b4c7d09 100644
--- a/src/components/Dashboard.tsx
+++ b/src/components/Dashboard.tsx
@@ -15,6 +15,7 @@ export function Dashboard({ userId }: DashboardProps) {
   if (loading) return <Skeleton />;
   if (error) return <ErrorCard message={error} />;

+  const formattedRevenue = data.revenue.toLocaleString();
   return (
     <div className="dashboard">
       <h2>Dashboard</h2>`;

// --- Terminal mock output ---

// Short prompt to avoid line-wrapping on narrow phone screens (~40 cols)
function makePrompt(cwd: string): string {
  return `\x1b[1;32mjunseong\x1b[0m@\x1b[1;34mdev\x1b[0m:\x1b[1;36m${cwd}\x1b[0m$ `;
}

const NORMAL_TERMINAL_OUTPUT = [
  makePrompt('~/project'),
  `ls\r\n`,
  `\x1b[1;34mdocs\x1b[0m   \x1b[1;34mnode_modules\x1b[0m  \x1b[1;34msrc\x1b[0m\r\n`,
  `Dockerfile   README.md\r\n`,
  `package.json tsconfig.json\r\n`,
  `\r\n`,
  makePrompt('~/project'),
  `git status\r\n`,
  `On branch main\r\n`,
  `Changes to be committed:\r\n`,
  `  \x1b[32mnew file:   src/components/Modal.tsx\x1b[0m\r\n`,
  `\r\n`,
  `Changes not staged for commit:\r\n`,
  `  \x1b[31mmodified:   src/App.tsx\x1b[0m\r\n`,
  `  \x1b[31mmodified:   src/components/Dashboard.tsx\x1b[0m\r\n`,
  `  \x1b[31mdeleted:    src/hooks/useTheme.ts\x1b[0m\r\n`,
  `\r\n`,
  `Untracked files:\r\n`,
  `  \x1b[31msrc/utils/validate.ts\x1b[0m\r\n`,
].join('');

// Claude Code CLI output — matches real 2025+ format
// Box width 34 chars to fit phone terminals (~40 cols)
const CLAUDE_TERMINAL_OUTPUT = [
  `\x1b[36m\u256d\u2500 Claude Code \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u256e\x1b[0m`,
  `\x1b[36m\u2502\x1b[0m                                \x1b[36m\u2502\x1b[0m`,
  `\x1b[36m\u2502\x1b[0m     \x1b[1mWelcome back Junseong!\x1b[0m     \x1b[36m\u2502\x1b[0m`,
  `\x1b[36m\u2502\x1b[0m                                \x1b[36m\u2502\x1b[0m`,
  `\x1b[36m\u2502\x1b[0m            \u2590\u259b\u2588\u2588\u2588\u259c\u258c             \x1b[36m\u2502\x1b[0m`,
  `\x1b[36m\u2502\x1b[0m           \u259d\u259c\u2588\u2588\u2588\u2588\u2588\u259b\u259d            \x1b[36m\u2502\x1b[0m`,
  `\x1b[36m\u2502\x1b[0m             \u2598\u2598 \u259d\u259d              \x1b[36m\u2502\x1b[0m`,
  `\x1b[36m\u2502\x1b[0m                                \x1b[36m\u2502\x1b[0m`,
  `\x1b[36m\u2502\x1b[0m   \x1b[2mSonnet 4.6 \u00b7 ~/project\x1b[0m       \x1b[36m\u2502\x1b[0m`,
  `\x1b[36m\u2502\x1b[0m                                \x1b[36m\u2502\x1b[0m`,
  `\x1b[36m\u2570\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u256f\x1b[0m`,
  ``,
  `\x1b[1;35m\u276f\x1b[0m revenue \ud3ec\ub9f7\ud305 \ubc84\uadf8 \uc218\uc815\ud574\uc918`,
  ``,
  `\x1b[1;37m\u23fa\x1b[0m \ud655\uc778\ud558\uaca0\uc2b5\ub2c8\ub2e4.`,
  ``,
  `  \x1b[2mRead\x1b[0m src/components/Dashboard.tsx`,
  `  \x1b[2mRead\x1b[0m src/types.ts`,
  ``,
  `  revenue\uac00 \ud3ec\ub9f7\ud305 \uc5c6\uc774 \ud45c\uc2dc\ub429\ub2c8\ub2e4.`,
  ``,
  `  \x1b[2mEdit\x1b[0m src/components/Dashboard.tsx`,
  `  \x1b[32m+ const formattedRevenue =\x1b[0m`,
  `  \x1b[32m+   data.revenue.toLocaleString();\x1b[0m`,
  `  \x1b[31m- value={\`$\${data.revenue}\`}\x1b[0m`,
  `  \x1b[32m+ value={\`$\${formattedRevenue}\`}\x1b[0m`,
  ``,
  `\x1b[1;37m\u23fa\x1b[0m \uc644\ub8cc! $1,234,567\ub85c \ud45c\uc2dc\ub429\ub2c8\ub2e4.`,
  ``,
  `\x1b[1;35m\u276f\x1b[0m`,
].join('\r\n');

// --- Helpers ---
function toBase64(str: string): string {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

// --- Web Plugin ---
export class SshWeb extends WebPlugin implements SshPlugin {
  private listeners = new Map<string, Array<(data: any) => void>>();
  private channelCount = 0;

  async connect(): Promise<{ sessionId: string }> {
    return { sessionId: 'mock-session-1' };
  }

  async disconnect(): Promise<void> {}

  async getStatus(): Promise<{ status: ConnectionStatus }> {
    return { status: 'connected' };
  }

  async openShell(options: {
    sessionId: string; cols: number; rows: number;
    term?: string; initialPath?: string; tmuxSession?: string;
  }): Promise<{ channelId: string }> {
    const channelId = `mock-channel-${++this.channelCount}`;

    // Determine which terminal output to show
    const isClaude = this.channelCount >= 2;
    const output = isClaude ? CLAUDE_TERMINAL_OUTPUT : NORMAL_TERMINAL_OUTPUT;

    // Emit shell data after a short delay
    setTimeout(() => {
      const handlers = this.listeners.get('shellData') ?? [];
      handlers.forEach((h) => h({ channelId, data: toBase64(output) }));
    }, 300);

    return { channelId };
  }

  async writeToShell(): Promise<void> {}
  async resizeShell(): Promise<void> {}
  async closeShell(): Promise<void> {}

  async exec(options: { sessionId: string; command: string; timeout?: number }): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    const cmd = options.command;

    // git log
    if (cmd.includes('git log')) {
      return { stdout: GIT_LOG, stderr: '', exitCode: 0 };
    }
    // git status --porcelain
    if (cmd.includes('git status --porcelain')) {
      return { stdout: GIT_STATUS, stderr: '', exitCode: 0 };
    }
    // git diff
    if (cmd.includes('git diff') || cmd.includes('git show')) {
      return { stdout: GIT_DIFF, stderr: '', exitCode: 0 };
    }
    // grep
    if (cmd.includes('grep')) {
      return {
        stdout: 'src/App.tsx:3:import { Dashboard } from \'./components/Dashboard\';\nsrc/types.ts:15:  revenue: number;',
        stderr: '', exitCode: 0,
      };
    }
    // find
    if (cmd.includes('find')) {
      return { stdout: '', stderr: '', exitCode: 0 };
    }

    return { stdout: '', stderr: '', exitCode: 0 };
  }

  async openSftp(): Promise<{ sftpId: string }> {
    return { sftpId: 'mock-sftp-1' };
  }

  async closeSftp(): Promise<void> {}

  async sftpLs(options: { sftpId: string; path: string }): Promise<{ entries: SftpEntry[] }> {
    const entries = MOCK_FILES[options.path] ?? [];
    return { entries };
  }

  async sftpRead(options: { sftpId: string; path: string }): Promise<{ content: string; size: number }> {
    const text = MOCK_CONTENTS[options.path] ?? `// File: ${options.path}\n`;
    const content = toBase64(text);
    return { content, size: text.length };
  }

  async sftpWrite(): Promise<void> {}

  async sftpStat(options: { sftpId: string; path: string }): Promise<{ stat: any }> {
    return {
      stat: { size: 1024, modifiedAt: Date.now(), permissions: '-rw-r--r--', isDirectory: false },
    };
  }

  async generateSshKey(): Promise<SshKey> {
    return { id: 'mock-key', name: 'mock', type: 'ed25519', fingerprint: 'SHA256:mock', publicKey: 'ssh-ed25519 AAAA...', createdAt: Date.now() };
  }
  async importSshKey(): Promise<SshKey> {
    return { id: 'mock-key', name: 'mock', type: 'ed25519', fingerprint: 'SHA256:mock', publicKey: 'ssh-ed25519 AAAA...', createdAt: Date.now() };
  }
  async listSshKeys(): Promise<{ keys: SshKey[] }> { return { keys: [] }; }
  async getPublicKey(): Promise<{ publicKey: string }> { return { publicKey: 'ssh-ed25519 AAAA...' }; }
  async deleteSshKey(): Promise<void> {}

  async addPortForward(): Promise<{ forwardId: string; bindPort: number }> {
    return { forwardId: 'mock-fwd-1', bindPort: 8080 };
  }
  async removePortForward(): Promise<void> {}
  async listPortForwards(): Promise<{ forwards: PortForwardEntry[] }> { return { forwards: [] }; }

  async addListener(eventName: string, handler: (data: any) => void): Promise<any> {
    if (!this.listeners.has(eventName)) this.listeners.set(eventName, []);
    this.listeners.get(eventName)!.push(handler);
    return {
      remove: async () => {
        const arr = this.listeners.get(eventName);
        if (arr) {
          const idx = arr.indexOf(handler);
          if (idx >= 0) arr.splice(idx, 1);
        }
      },
    };
  }
}
