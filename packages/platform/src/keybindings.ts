import type { IDisposable } from './disposable';

export interface KeybindingMatch {
  command: string;
  args: unknown[];
}

export interface IKeybindingService {
  register(key: string, command: string, args?: unknown[]): IDisposable;
  onKeydown(event: KeyboardEvent): KeybindingMatch | undefined;
}

export class KeybindingService implements IKeybindingService {
  private readonly bindings = new Map<string, KeybindingMatch>();

  register(key: string, command: string, args: unknown[] = []): IDisposable {
    this.bindings.set(key, { command, args });
    return { dispose: () => this.bindings.delete(key) };
  }

  onKeydown(event: KeyboardEvent): KeybindingMatch | undefined {
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
 * Punctuation keys whose `event.key` changes when Shift is held (']' becomes
 * '}' on US layouts), mapped by `event.code` so shortcuts like meta+shift+]
 * match independent of layout and modifiers.
 */
const CODE_KEYS: Record<string, string> = {
  BracketLeft: '[',
  BracketRight: ']',
  Comma: ',',
  Period: '.',
  Slash: '/',
  Backslash: '\\',
  Quote: "'",
  Semicolon: ';',
  Equal: '=',
  Minus: '-',
  Backquote: '`',
};

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
  return CODE_KEYS[event.code] ?? event.key.toLowerCase();
}
