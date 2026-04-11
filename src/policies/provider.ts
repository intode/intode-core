import { AppPolicy, DEFAULT_POLICY, LimitHandler } from './types';

let currentPolicy: AppPolicy = DEFAULT_POLICY;
let limitHandler: LimitHandler = async (type, count, max) => {
  console.warn(`[Policy] Limit reached: ${type} (${count}/${max})`);
  return false;
};

export function setPolicy(policy: AppPolicy): void {
  currentPolicy = policy;
}

export function getPolicy(): AppPolicy {
  return currentPolicy;
}

export function setLimitHandler(handler: LimitHandler): void {
  limitHandler = handler;
}

export async function checkLimit(type: string, currentCount: number, max: number): Promise<boolean> {
  if (currentCount < max) return true;
  return limitHandler(type, currentCount, max);
}
