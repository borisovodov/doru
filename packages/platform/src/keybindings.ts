import { createServiceId, type IDisposable } from './di';

export const IKeybindingService = createServiceId<IKeybindingService>('keybinding');

export interface IKeybindingService {
  register(key: string, command: string): IDisposable;
  onKeydown(event: KeyboardEvent): string | undefined;
}

export class KeybindingService implements IKeybindingService {
  private readonly bindings = new Map<string, string>();

  register(key: string, command: string): IDisposable {
    this.bindings.set(key, command);
    return { dispose: () => this.bindings.delete(key) };
  }

  onKeydown(event: KeyboardEvent): string | undefined {
    const parts: string[] = [];
    if (event.ctrlKey) parts.push('ctrl');
    if (event.metaKey) parts.push('meta');
    if (event.altKey) parts.push('alt');
    if (event.shiftKey) parts.push('shift');
    parts.push(event.key.toLowerCase());
    return this.bindings.get(parts.join('+'));
  }
}
