import { Ssh } from './index';
import type { HostKeyPrompt, KnownHostEntry } from './plugin-api';

/**
 * The host key that blocked the connect attempt that just failed, or null.
 *
 * A refused host key surfaces as a plain connect failure, so every caller of
 * `Ssh.connect` has to ask this after a failure instead of matching on the message —
 * and ask on every failure, because a jump-host chain can stop at a hop the caller
 * never named.
 *
 * Answers null where the platform does not verify host keys (the web bridge) or where
 * the running build predates the method, so a caller can read "no prompt" as "this was
 * an ordinary failure" without knowing which platform it is on.
 */
export async function getPendingHostKeyPrompt(): Promise<HostKeyPrompt | null> {
  try {
    const { prompt } = await Ssh.getPendingHostKey();
    return prompt;
  } catch {
    return null;
  }
}

/**
 * Trust the key described by `prompt` from now on.
 *
 * Takes the whole prompt so the fingerprint and the host it belongs to cannot drift
 * apart: the hop that refused may be an intermediate rather than the host the user
 * typed, and trusting a fingerprint against the wrong host trusts nothing useful while
 * looking like it worked.
 */
export function trustHostKey(prompt: HostKeyPrompt): Promise<void> {
  return Ssh.acceptHostKey({
    host: prompt.host,
    port: prompt.port,
    fingerprint: prompt.fingerprint,
    keyType: prompt.keyType,
  });
}

/**
 * Order trusted hosts the way a person scans them: by host, then by port.
 *
 * Neither store returns a meaningful order — one enumerates a preferences map, the other
 * a Keychain query — so sorting has to happen on this side or the list reshuffles between
 * visits and a user cannot find the row they were looking at.
 *
 * Ports compare numerically, so `example.com:22` sorts before `example.com:2222`.
 */
export function sortKnownHosts(hosts: KnownHostEntry[]): KnownHostEntry[] {
  return [...hosts].sort((a, b) => {
    const byHost = a.host.localeCompare(b.host);
    return byHost !== 0 ? byHost : a.port - b.port;
  });
}

/**
 * Every host key this device trusts, in display order.
 *
 * Unlike `getPendingHostKeyPrompt` this does not swallow failures. A management screen
 * that renders an empty list when the query failed tells the user they trust nothing,
 * which is the opposite of the truth and exactly the wrong thing to be wrong about.
 */
export async function listKnownHosts(): Promise<KnownHostEntry[]> {
  const { hosts } = await Ssh.listKnownHosts();
  return sortKnownHosts(hosts);
}

/** Stop trusting one entry. The next connection there asks again. */
export function forgetKnownHost(entry: { host: string; port: number }): Promise<void> {
  return Ssh.removeKnownHost({ host: entry.host, port: entry.port });
}

/** Stop trusting everything, and answer how many entries went. */
export async function forgetAllKnownHosts(): Promise<number> {
  const { removed } = await Ssh.clearKnownHosts();
  return removed;
}

/**
 * `trustedAt` for the list row.
 *
 * Local time, because the question a user asks here is "was that me, the other day?".
 * Zero and undefined both read as unknown: entries trusted before the app recorded the
 * time are real trust with no date, and printing the epoch would look like a date from
 * 1970 rather than like missing information.
 */
export function formatTrustedAt(trustedAt: number | undefined): string {
  if (!trustedAt || !Number.isFinite(trustedAt)) return 'Unknown';
  const d = new Date(trustedAt);
  if (Number.isNaN(d.getTime())) return 'Unknown';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
