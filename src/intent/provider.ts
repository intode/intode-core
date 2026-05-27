import type { IntentFile } from './types';

export type { IntentFile } from './types';

export interface IntentFilesProvider {
  isAvailable(): boolean;
  /** Drains files queued before the JS listener attached (e.g. cold-start "Open with Intode"). */
  getPending(): Promise<IntentFile[]>;
  /** Streams files delivered while the app is running. */
  addListener(cb: (file: IntentFile) => void): Promise<{ remove(): void }>;
}

let provider: IntentFilesProvider | null = null;

export function setIntentFilesProvider(p: IntentFilesProvider): void {
  provider = p;
}

export function getIntentFilesProvider(): IntentFilesProvider | null {
  return provider;
}

export function hasIntentFiles(): boolean {
  return provider?.isAvailable() ?? false;
}
