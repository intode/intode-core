import { AppPolicy, DEFAULT_POLICY, LimitHandler } from './types';

let currentPolicy: AppPolicy = DEFAULT_POLICY;
let limitHandler: LimitHandler = (type, count, max) => {
  console.warn(`[Policy] Limit reached: ${type} (${count}/${max})`);
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

export function checkLimit(type: string, currentCount: number, max: number): boolean {
  if (currentCount < max) return true;
  limitHandler(type, currentCount, max);
  return false;
}
