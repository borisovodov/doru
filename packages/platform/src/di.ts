export interface IDisposable {
  dispose(): void;
}

export type ServiceIdentifier<T> = { readonly id: string };

export function createServiceId<T>(id: string): ServiceIdentifier<T> {
  return { id };
}

export class ServiceCollection {
  private readonly entries = new Map<string, unknown>();

  set<T>(id: ServiceIdentifier<T>, value: T): T {
    this.entries.set(id.id, value);
    return value;
  }

  get<T>(id: ServiceIdentifier<T>): T {
    const value = this.entries.get(id.id);
    if (value === undefined) {
      throw new Error(`Service not registered: ${id.id}`);
    }
    return value as T;
  }

  has(id: ServiceIdentifier<unknown>): boolean {
    return this.entries.has(id.id);
  }
}
