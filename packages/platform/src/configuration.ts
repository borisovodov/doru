import { parse, applyEdits, modify } from 'jsonc-parser';
import { createServiceId } from './di';
import { Emitter } from './events';

export const IConfigurationService = createServiceId<IConfigurationService>('configuration');

export interface IConfigStore {
  read(): string | undefined;
  write(content: string): Promise<void>;
}

export interface IConfigurationService {
  readonly onDidChange: Emitter<string>;
  load(): Promise<void>;
  get<T>(key: string, fallback: T): T;
  getAll(): Record<string, unknown>;
  set(key: string, value: unknown): Promise<void>;
}

export class ConfigurationService implements IConfigurationService {
  readonly onDidChange = new Emitter<string>();
  private values: Record<string, unknown> = {};

  constructor(
    private readonly store: IConfigStore,
    private readonly defaults: Record<string, unknown> = {},
  ) {}

  async load(): Promise<void> {
    const text = this.store.read();
    this.values = text !== undefined ? (parse(text) as Record<string, unknown>) : {};
  }

  getAll(): Record<string, unknown> {
    return { ...this.defaults, ...this.values };
  }

  get<T>(key: string, fallback: T): T {
    const all = this.getAll();
    const segments = key.split('.');
    let current: unknown = all;
    for (const segment of segments) {
      if (current === null || typeof current !== 'object') {
        return fallback;
      }
      current = (current as Record<string, unknown>)[segment];
    }
    return (current === undefined ? fallback : current) as T;
  }

  async set(key: string, value: unknown): Promise<void> {
    const text = this.store.read();
    const edits = modify(text ?? '{}', [key], value, { formattingOptions: { insertSpaces: true, tabSize: 2 } });
    const next = applyEdits(text ?? '{}', edits);
    await this.store.write(next);
    this.values = parse(next) as Record<string, unknown>;
    this.onDidChange.fire(key);
  }
}
