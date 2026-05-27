// Files handed to Intode via Android's ACTION_VIEW intent ("Open with Intode" from another app).
// The Pro layer reads the bytes natively and forwards them through the IntentFilesProvider DI hook.

export interface IntentFile {
  fileName: string;
  mimeType: string;
  /** Base64-encoded file bytes. */
  content: string;
  sizeBytes: number;
}
