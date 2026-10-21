import type { IDisposable } from './disposable';

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
    parts.push(normalizeKey(event));
    return this.bindings.get(parts.join('+'));
  }
}

/**
 * The physical key for letters and digits. With Alt/Option held, macOS
 * keyboard layouts report special characters in `event.key` (Option+B is
 * '∫'), so shortcuts like meta+alt+b would never match; `event.code`
 * ('KeyB') is layout-independent.
 */
function normalizeKey(event: KeyboardEvent): string {
  const letter = /^Key([A-Z])$/.exec(event.code)?.[1];
  if (letter) {
    return letter.toLowerCase();
  }
  const digit = /^Digit(\d)$/.exec(event.code)?.[1];
  if (digit) {
    return digit;
  }
  return event.key.toLowerCase();
}
