import type {
  SftpDownloadOptions,
  SftpUploadOptions,
  TransferProgressEvent,
} from '../ssh/plugin-api';

export type TransferKind = 'upload' | 'download';
export type TransferPhase = TransferProgressEvent['phase'];

export interface TransferState {
  id: string;
  kind: TransferKind;
  label: string;
  phase: TransferPhase;
  bytesTransferred: number;
  totalBytes: number;
  currentFile?: string;
  filesDone?: number;
  filesTotal?: number;
  failedFiles?: string[];
  error?: string;
  startedAt: number;
}

interface StartDownloadArgs {
  sftpId: string;
  remotePath: string;
  localUri: string;
  label: string;
}

interface StartUploadArgs {
  sftpId: string;
  remoteDir: string;
  items: SftpUploadOptions['items'];
  totalBytes: number;
  label: string;
  onConflict: SftpUploadOptions['onConflict'];
}

export interface TransferManagerDeps {
  sftpDownload: (opts: SftpDownloadOptions) => Promise<void>;
  sftpUpload: (opts: SftpUploadOptions) => Promise<void>;
  sftpCancelTransfer: (opts: { transferId: string }) => Promise<void>;
  newId: () => string;
}

type Listener = (states: TransferState[]) => void;

type QueuedJob =
  | { kind: 'download'; args: StartDownloadArgs; id: string }
  | { kind: 'upload'; args: StartUploadArgs; id: string };

const MAX_CONCURRENT = 3;

export class TransferManager {
  private states = new Map<string, TransferState>();
  private listeners = new Set<Listener>();
  private queue: QueuedJob[] = [];
  private activeIds = new Set<string>();

  constructor(private deps: TransferManagerDeps) {}

  startDownload(args: StartDownloadArgs): string {
    const id = this.deps.newId();
    const state: TransferState = {
      id,
      kind: 'download',
      label: args.label,
      phase: 'start',
      bytesTransferred: 0,
      totalBytes: -1,
      startedAt: Date.now(),
    };
    this.states.set(id, state);
    this.enqueue({ kind: 'download', args, id });
    this.notify();
    return id;
  }

  startUpload(args: StartUploadArgs): string {
    const id = this.deps.newId();
    const state: TransferState = {
      id,
      kind: 'upload',
      label: args.label,
      phase: 'start',
      bytesTransferred: 0,
      totalBytes: args.totalBytes,
      filesTotal: args.items.filter((i) => !i.isDirectory).length,
      filesDone: 0,
      startedAt: Date.now(),
    };
    this.states.set(id, state);
    this.enqueue({ kind: 'upload', args, id });
    this.notify();
    return id;
  }

  async cancel(id: string): Promise<void> {
    const queuedIdx = this.queue.findIndex((j) => j.id === id);
    if (queuedIdx >= 0) {
      this.queue.splice(queuedIdx, 1);
      this.update(id, { phase: 'cancelled' });
      return;
    }
    if (this.activeIds.has(id)) {
      await this.deps.sftpCancelTransfer({ transferId: id });
    }
  }

  onProgress(ev: TransferProgressEvent): void {
    const state = this.states.get(ev.transferId);
    if (!state) return;
    // Ignore late events after terminal phase
    if (state.phase === 'done' || state.phase === 'error' || state.phase === 'cancelled') {
      return;
    }
    state.phase = ev.phase;
    state.bytesTransferred = ev.bytesTransferred;
    if (ev.totalBytes >= 0) state.totalBytes = ev.totalBytes;
    if (ev.currentFile !== undefined) state.currentFile = ev.currentFile;
    if (ev.filesDone !== undefined) state.filesDone = ev.filesDone;
    if (ev.filesTotal !== undefined) state.filesTotal = ev.filesTotal;
    if (ev.failedFiles !== undefined) state.failedFiles = ev.failedFiles;
    if (ev.error !== undefined) state.error = ev.error;

    if (ev.phase === 'done' || ev.phase === 'error' || ev.phase === 'cancelled') {
      this.activeIds.delete(ev.transferId);
      this.pumpQueue();
    }
    this.notify();
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    fn(this.snapshot());
    return () => void this.listeners.delete(fn);
  }

  getState(id: string): TransferState | undefined {
    return this.states.get(id);
  }

  getQueueLength(): number {
    return this.queue.length;
  }

  snapshot(): TransferState[] {
    return Array.from(this.states.values()).sort((a, b) => b.startedAt - a.startedAt);
  }

  private enqueue(job: QueuedJob): void {
    this.queue.push(job);
    this.pumpQueue();
  }

  private pumpQueue(): void {
    while (this.activeIds.size < MAX_CONCURRENT && this.queue.length > 0) {
      const job = this.queue.shift()!;
      this.activeIds.add(job.id);
      this.launch(job);
    }
  }

  private launch(job: QueuedJob): void {
    if (job.kind === 'download') {
      this.deps
        .sftpDownload({
          sftpId: job.args.sftpId,
          remotePath: job.args.remotePath,
          localUri: job.args.localUri,
          transferId: job.id,
        })
        .catch((err) => {
          this.onProgress({
            transferId: job.id,
            phase: 'error',
            bytesTransferred: this.states.get(job.id)?.bytesTransferred ?? 0,
            totalBytes: this.states.get(job.id)?.totalBytes ?? -1,
            error: String(err?.message ?? err),
          });
        });
    } else {
      this.deps
        .sftpUpload({
          sftpId: job.args.sftpId,
          remoteDir: job.args.remoteDir,
          items: job.args.items,
          totalBytes: job.args.totalBytes,
          onConflict: job.args.onConflict,
          transferId: job.id,
        })
        .catch((err) => {
          this.onProgress({
            transferId: job.id,
            phase: 'error',
            bytesTransferred: this.states.get(job.id)?.bytesTransferred ?? 0,
            totalBytes: this.states.get(job.id)?.totalBytes ?? -1,
            error: String(err?.message ?? err),
          });
        });
    }
  }

  private update(id: string, patch: Partial<TransferState>): void {
    const state = this.states.get(id);
    if (!state) return;
    Object.assign(state, patch);
    this.notify();
  }

  private notify(): void {
    const snap = this.snapshot();
    for (const l of this.listeners) l(snap);
  }
}
