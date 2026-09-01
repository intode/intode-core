import React from 'react';
import type { HostKeyPrompt } from '../plugin-api';

export interface HostKeyTrustPromptProps {
  prompt: HostKeyPrompt;
  /** Trust this key and try the connection again. */
  onTrust: () => void;
  /** Leave without trusting anything. */
  onCancel: () => void;
}

/**
 * The one place a host key decision is drawn.
 *
 * Every screen that connects ends up here, so the decision keeps one shape wherever it
 * is met — a user should not have to learn the same choice twice. An unknown host is a
 * yellow question; a host whose key changed under a fingerprint we already trusted is a
 * red warning that shows both fingerprints. Do not collapse the second into the first:
 * the difference between them is the difference between a rebuilt server and someone
 * sitting in the middle of the connection.
 */
export function HostKeyTrustPrompt({ prompt, onTrust, onCancel }: HostKeyTrustPromptProps) {
  const changed = prompt.knownFingerprint !== undefined;
  return (
    <div style={styles.container}>
      <div style={changed ? styles.errorIcon : styles.warnIcon}>{changed ? '!' : '?'}</div>
      <p style={changed ? styles.errorTitle : styles.warnTitle}>
        {changed ? 'Host Key Changed' : 'Unknown Host Key'}
      </p>
      <p style={styles.hostText}>{prompt.host.toUpperCase()} // PORT_{prompt.port}</p>
      <p style={styles.errorMsg}>
        {changed
          ? 'This server is offering a different key than the one you trusted. It may have been rebuilt — or someone may be intercepting the connection.'
          : 'This server has not been seen before. Check the fingerprint against the server itself before trusting it.'}
      </p>
      <div style={styles.fingerprintBox}>
        <p style={styles.fingerprintLabel}>{prompt.keyType}</p>
        <p style={styles.fingerprintValue}>{prompt.fingerprint}</p>
      </div>
      {changed && (
        <div style={styles.fingerprintBox}>
          <p style={styles.fingerprintLabel}>PREVIOUSLY TRUSTED</p>
          <p style={styles.fingerprintValue}>{prompt.knownFingerprint}</p>
        </div>
      )}
      <p style={styles.verifyHint}>ssh-keygen -lf /etc/ssh/ssh_host_*_key.pub</p>
      <div style={styles.buttonRow}>
        <button onClick={onCancel} style={styles.secondaryBtn}>Cancel</button>
        <button onClick={onTrust} style={changed ? styles.dangerBtn : styles.primaryBtn}>
          {changed ? 'Trust New Key' : 'Trust'}
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    height: '100%', backgroundColor: 'var(--bg-base)', gap: 12, padding: 24,
  },
  hostText: { fontSize: 11, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono' },
  errorIcon: { fontSize: 40, color: 'var(--accent-red)', fontWeight: 700, textShadow: '0 0 10px rgba(255, 51, 0, 0.4)' },
  warnIcon: { fontSize: 40, color: 'var(--accent-yellow, #ffb000)', fontWeight: 700, textShadow: '0 0 10px rgba(255, 176, 0, 0.4)' },
  warnTitle: { fontSize: 14, color: 'var(--accent-yellow, #ffb000)', fontWeight: 700, fontFamily: 'Chakra Petch', textTransform: 'uppercase' as const, letterSpacing: 1 },
  errorTitle: { fontSize: 14, color: 'var(--accent-red)', fontWeight: 700, fontFamily: 'Chakra Petch', textTransform: 'uppercase' as const, letterSpacing: 1 },
  errorMsg: { fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', wordBreak: 'break-all', maxWidth: '80%', fontFamily: 'IBM Plex Mono' },
  fingerprintBox: { border: '1px solid var(--text-muted)', borderRadius: 2, padding: '8px 12px', maxWidth: '90%' },
  fingerprintLabel: { fontSize: 9, color: 'var(--text-muted)', fontFamily: 'Chakra Petch', textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 4 },
  fingerprintValue: { fontSize: 11, color: 'var(--text-primary)', fontFamily: 'IBM Plex Mono', wordBreak: 'break-all' as const },
  verifyHint: { fontSize: 10, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono', opacity: 0.7 },
  buttonRow: { display: 'flex', gap: 12, marginTop: 24 },
  secondaryBtn: { background: 'none', border: '1px solid var(--text-muted)', borderRadius: 2, padding: '10px 20px', color: 'var(--text-muted)', fontSize: 11, fontWeight: 700, fontFamily: 'Chakra Petch', textTransform: 'uppercase' as const, cursor: 'pointer', letterSpacing: 1 },
  primaryBtn: { backgroundColor: 'transparent', border: '1px solid var(--accent-green)', color: 'var(--accent-green)', borderRadius: 2, padding: '10px 20px', fontSize: 11, fontWeight: 700, fontFamily: 'Chakra Petch', textTransform: 'uppercase' as const, cursor: 'pointer', letterSpacing: 1, boxShadow: 'var(--neon-glow)' },
  dangerBtn: { backgroundColor: 'transparent', border: '1px solid var(--accent-red)', color: 'var(--accent-red)', borderRadius: 2, padding: '10px 20px', fontSize: 11, fontWeight: 700, fontFamily: 'Chakra Petch', textTransform: 'uppercase' as const, cursor: 'pointer', letterSpacing: 1 },
};
