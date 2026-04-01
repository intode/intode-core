type LogEntry = { time: string; msg: string };

const logs: LogEntry[] = [];
const MAX_LOGS = 200;
let onChange: (() => void) | null = null;

function timestamp(): string {
  const d = new Date();
  return `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}:${d.getSeconds().toString().padStart(2,'0')}.${d.getMilliseconds().toString().padStart(3,'0')}`;
}

export function debugLog(msg: string): void {
  console.log(`[DBG] ${msg}`);
  logs.push({ time: timestamp(), msg });
  if (logs.length > MAX_LOGS) logs.shift();
  onChange?.();
}

export function getDebugLogs(): LogEntry[] {
  return logs;
}

export function setDebugLogListener(fn: (() => void) | null): void {
  onChange = fn;
}
