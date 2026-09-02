import React, { useState, useEffect, useCallback } from 'react';
import type { KnownHostEntry } from '../plugin-api';
import { listKnownHosts, forgetKnownHost, forgetAllKnownHosts, formatTrustedAt } from '../host-key';

/** `host:port` — unique per entry, and what the confirm state is keyed on. */
function entryId(entry: { host: string; port: number }): string {
  return `${entry.host}:${entry.port}`;
}

/**
 * The list of host keys this device trusts, with a way back out.
 *
 * Trusting a key is a one-way door everywhere else in the app: the connect prompt writes
 * to a store nothing else reads out, so a server that is legitimately rebuilt locks the
 * user out until they wipe the app's data. This screen is that store's only exit.
 *
 * **Forgetting is confirmed inline rather than through `confirm()`.** The native dialog
 * cannot say which entry it is about beyond a string, and on a phone it lands on top of
 * the row it is asking about. A row that turns into its own question keeps the
 * fingerprint on screen while the user answers it.
 *
 * Failures are shown, never swallowed. A screen that silently renders an empty list after
 * a failed query would tell the user they trust nothing — the one thing it must not be
 * wrong about.
 */
export function KnownHostList() {
  const [hosts, setHosts] = useState<KnownHostEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [confirmingAll, setConfirmingAll] = useState(false);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setHosts(await listKnownHosts());
      setError(null);
    } catch (e) {
      setHosts(null);
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const handleForget = async (entry: KnownHostEntry) => {
    setBusy(true);
    try {
      await forgetKnownHost(entry);
      setConfirmingId(null);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleForgetAll = async () => {
    setBusy(true);
    try {
      await forgetAllKnownHosts();
      setConfirmingAll(false);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <p style={styles.intro}>
        Servers whose key you accepted. Forget one to be asked again the next time you
        connect — do that when a server is rebuilt and offers a new key.
      </p>

      {error && <p style={styles.error}>Could not read trusted host keys: {error}</p>}

      {hosts === null && !error && <p style={styles.empty}>Loading...</p>}

      {hosts !== null && hosts.length === 0 && (
        <p style={styles.empty}>No trusted host keys</p>
      )}

      {hosts !== null && hosts.length > 0 && (
        <>
          {confirmingAll ? (
            <div style={styles.confirmBar}>
              <span style={styles.confirmText}>
                Forget all {hosts.length} host {hosts.length === 1 ? 'key' : 'keys'}? Every
                server will ask again on the next connection. This cannot be undone.
              </span>
              <div style={styles.confirmActions}>
                <button onClick={() => setConfirmingAll(false)} style={styles.smallBtn} disabled={busy}>
                  Cancel
                </button>
                <button onClick={handleForgetAll} style={styles.deleteBtn} disabled={busy}>
                  Forget All
                </button>
              </div>
            </div>
          ) : (
            <div style={styles.actions}>
              <button onClick={() => { setConfirmingId(null); setConfirmingAll(true); }} style={styles.dangerAction}>
                Forget All
              </button>
            </div>
          )}

          {hosts.map((entry) => {
            const id = entryId(entry);
            const confirming = confirmingId === id;
            return (
              <div key={id} style={styles.hostCard}>
                <div style={styles.hostHeader}>
                  <span style={styles.hostName}>{entry.host}:{entry.port}</span>
                  {entry.keyType && <span style={styles.keyType}>{entry.keyType}</span>}
                </div>
                <div style={styles.fingerprint}>{entry.fingerprint}</div>
                <div style={styles.trustedAt}>Trusted {formatTrustedAt(entry.trustedAt)}</div>
                {confirming ? (
                  <div style={styles.confirmRow}>
                    <span style={styles.confirmText}>
                      Forget this key? This cannot be undone.
                    </span>
                    <div style={styles.confirmActions}>
                      <button onClick={() => setConfirmingId(null)} style={styles.smallBtn} disabled={busy}>
                        Cancel
                      </button>
                      <button
                        onClick={() => handleForget(entry)}
                        style={styles.deleteBtn}
                        disabled={busy}
                        aria-label={`Confirm forget ${id}`}
                      >
                        Forget
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={styles.hostActions}>
                    <button
                      onClick={() => { setConfirmingAll(false); setConfirmingId(id); }}
                      style={styles.deleteBtn}
                      aria-label={`Forget ${id}`}
                    >
                      Forget
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  intro: { fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 12 },
  error: {
    fontSize: 12, color: 'var(--accent-red)', lineHeight: 1.5, marginBottom: 12,
    border: '1px solid var(--accent-red)', borderRadius: 8, padding: 10, wordBreak: 'break-word',
  },
  actions: { display: 'flex', gap: 8, marginBottom: 12 },
  dangerAction: {
    flex: 1, padding: '10px', backgroundColor: 'transparent', color: 'var(--accent-red)',
    border: '1px solid var(--accent-red)', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer',
  },
  empty: { fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '16px 0' },
  hostCard: {
    padding: 12, marginBottom: 8, backgroundColor: 'var(--bg-surface0)',
    borderRadius: 8, border: '1px solid var(--bg-surface1)',
  },
  hostHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 4 },
  hostName: { fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', wordBreak: 'break-all' },
  keyType: { fontSize: 11, color: 'var(--accent-blue)', fontWeight: 700, fontFamily: 'monospace', flexShrink: 0 },
  fingerprint: { fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace', wordBreak: 'break-all' },
  trustedAt: { fontSize: 11, color: 'var(--text-muted)', marginTop: 4, marginBottom: 8 },
  hostActions: { display: 'flex', gap: 8 },
  confirmRow: {
    display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8, paddingTop: 8,
    borderTop: '1px solid var(--bg-surface1)',
  },
  confirmBar: {
    display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12, padding: 12,
    border: '1px solid var(--accent-red)', borderRadius: 8,
  },
  confirmText: { fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 },
  confirmActions: { display: 'flex', gap: 8, justifyContent: 'flex-end' },
  smallBtn: {
    padding: '6px 10px', backgroundColor: 'transparent', color: 'var(--text-secondary)',
    border: '1px solid var(--bg-surface1)', borderRadius: 6, fontSize: 12, cursor: 'pointer',
  },
  deleteBtn: {
    padding: '6px 10px', backgroundColor: 'transparent', color: 'var(--accent-red)',
    border: '1px solid var(--accent-red)', borderRadius: 6, fontSize: 12, cursor: 'pointer',
  },
};
