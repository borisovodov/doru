import { createServiceId, type IDisposable } from './di';

export const ICommandService = createServiceId<ICommandService>('command');

export interface Command {
  id: string;
  title: string;
  handler: (...args: unknown[]) => unknown;
}

export interface ICommandService {
  register(command: Command): IDisposable;
  execute<T>(id: string, ...args: unknown[]): Promise<T>;
  all(): Command[];
  has(id: string): boolean;
}

export class CommandService implements ICommandService {
  private readonly commands = new Map<string, Command>();

  register(command: Command): IDisposable {
    this.commands.set(command.id, command);
    return { dispose: () => this.commands.delete(command.id) };
  }

  async execute<T>(id: string, ...args: unknown[]): Promise<T> {
    const command = this.commands.get(id);
    if (!command) {
      throw new Error(`Unknown command: ${id}`);
    }
    return (await command.handler(...args)) as T;
  }

  all(): Command[] {
    return [...this.commands.values()];
  }

  has(id: string): boolean {
    return this.commands.has(id);
  }
}
