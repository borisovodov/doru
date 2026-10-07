import { createServiceId } from './di';

export const ILogService = createServiceId<ILogService>('log');

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error';

export interface ILogService {
  setLevel(level: LogLevel): void;
  trace(message: string, ...args: unknown[]): void;
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

const severity: Record<LogLevel, number> = {
  trace: 0,
  debug: 1,
  info: 2,
  warn: 3,
  error: 4,
};

export class ConsoleLogService implements ILogService {
  private level: LogLevel = 'info';

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  private log(level: LogLevel, message: string, args: unknown[]): void {
    if (severity[level] < severity[this.level]) {
      return;
    }
    const prefix = `[doru] ${level.toUpperCase()}`;
    if (args.length > 0) {
      console.log(prefix, message, ...args);
    } else {
      console.log(prefix, message);
    }
  }

  trace(message: string, ...args: unknown[]): void {
    this.log('trace', message, args);
  }

  debug(message: string, ...args: unknown[]): void {
    this.log('debug', message, args);
  }

  info(message: string, ...args: unknown[]): void {
    this.log('info', message, args);
  }

  warn(message: string, ...args: unknown[]): void {
    this.log('warn', message, args);
  }

  error(message: string, ...args: unknown[]): void {
    this.log('error', message, args);
  }
}
