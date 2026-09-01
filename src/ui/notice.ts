/**
 * App-wide transient notices.
 *
 * This exists because the only way core had to tell the user that something
 * failed was `alert()`, which blocks the JS thread and shows raw internal text.
 * Anything that needs to report a failure outside its own screen posts here and
 * `Toaster` renders it.
 *
 * Not a logger: every notice is shown to a person, so the text must read as a
 * sentence. Do not put method names, stack traces or plugin identifiers in it.
 */

export type NoticeKind = 'error' | 'info';

export interface Notice {
  id: string;
  kind: NoticeKind;
  /** One line. Shown in full. */
  title: string;
  /** Optional second line — a server message, a list of failed names. */
  detail?: string;
  at: number;
}

/** Keep the list short; a burst of failures should not become a wall of text. */
const MAX_NOTICES = 3;

let notices: Notice[] = [];
const listeners = new Set<(n: Notice[]) => void>();

function emit(): void {
  const snapshot = notices;
  for (const fn of listeners) fn(snapshot);
}

export function notify(kind: NoticeKind, title: string, detail?: string): string {
  const id = `n_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
  notices = [...notices, { id, kind, title, detail, at: Date.now() }].slice(-MAX_NOTICES);
  emit();
  return id;
}

export function dismissNotice(id: string): void {
  const next = notices.filter((n) => n.id !== id);
  if (next.length === notices.length) return;
  notices = next;
  emit();
}

export function subscribeNotices(fn: (n: Notice[]) => void): () => void {
  listeners.add(fn);
  fn(notices);
  return () => {
    listeners.delete(fn);
  };
}

export function getNotices(): Notice[] {
  return notices;
}
