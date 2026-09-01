import { Ssh } from './index';
import type { HostKeyPrompt } from './plugin-api';

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
  return Ssh.acceptHostKey({ host: prompt.host, port: prompt.port, fingerprint: prompt.fingerprint });
}
