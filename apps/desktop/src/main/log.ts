import { app } from 'electron';
import { join } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
import electronLog from 'electron-log/main';
import type { LogLevel } from 'electron-log';

/**
 * The app-wide log: the console plus `<userData>/doru.log` (rotated at 5 MB
 * by electron-log). The console transport writes to stderr so that in MCP
 * server mode (`doru --mcp-server`) stdout stays clean for the JSON-RPC
 * protocol. The default verbosity is `warn` — quiet on user machines; `npm
 * run dev` raises it to `debug`. `DORU_LOG_LEVEL` always wins.
 */

const LEVELS: Record<string, LogLevel> = {
  trace: 'silly',
  debug: 'debug',
  info: 'info',
  warn: 'warn',
  error: 'error',
};

const DEFAULT_LEVEL: LogLevel = import.meta.env.DEV ? 'debug' : 'warn';

function envLevel(): LogLevel {
  return LEVELS[process.env['DORU_LOG_LEVEL'] ?? ''] ?? DEFAULT_LEVEL;
}

/** The log file path (`<userData>/doru.log`); shared with the settings page. */
export function logFilePath(): string {
  return join(app.getPath('userData'), 'doru.log');
}

/** Creates the log file if it does not exist yet (nothing may have been
 *  logged at the current level), so "Open log file" always has a file to
 *  open. */
export function ensureLogFile(): void {
  try {
    mkdirSync(app.getPath('userData'), { recursive: true });
    writeFileSync(logFilePath(), '', { flag: 'a' });
  } catch {
    // Ignore: openPath will fail harmlessly if the file cannot be created.
  }
}

electronLog.initialize();

// Console transport → stderr: stdout carries the MCP protocol in server mode.
electronLog.transports.console.writeFn = ({ message }) => {
  console.error(...message.data);
};

electronLog.transports.file.resolvePathFn = () => {
  try {
    return logFilePath();
  } catch {
    // electron-log resolves the path before Electron's app is ready in
    // some contexts (unit tests, headless runs): fall back to a relative
    // file name instead of surfacing an unhandled error.
    return 'doru.log';
  }
};
electronLog.transports.file.maxSize = 5 * 1024 * 1024;

electronLog.transports.console.level = envLevel();
electronLog.transports.file.level = envLevel();

export const log = electronLog;
