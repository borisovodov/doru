import { describe, expect, test } from 'vitest';
import { KeybindingService } from '../src/keybindings';

const event = (init: {
  key: string;
  code: string;
  metaKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
}): KeyboardEvent => init as unknown as KeyboardEvent;

describe('KeybindingService', () => {
  test('matches plain letter shortcuts', () => {
    const service = new KeybindingService();
    service.register('meta+z', 'tree.undo');
    expect(service.onKeydown(event({ key: 'z', code: 'KeyZ', metaKey: true }))).toEqual({
      command: 'tree.undo',
      args: [],
    });
  });

  test('matches alt-letter shortcuts regardless of the Option character', () => {
    const service = new KeybindingService();
    service.register('meta+alt+b', 'workbench.toggleAgentChat');
    // macOS US layout reports Option+B as '∫'.
    expect(
      service.onKeydown(event({ key: '∫', code: 'KeyB', metaKey: true, altKey: true })),
    ).toEqual({ command: 'workbench.toggleAgentChat', args: [] });
    expect(
      service.onKeydown(event({ key: 'b', code: 'KeyB', metaKey: true, altKey: true })),
    ).toEqual({ command: 'workbench.toggleAgentChat', args: [] });
  });

  test('matches shift combos', () => {
    const service = new KeybindingService();
    service.register('meta+shift+z', 'tree.redo');
    expect(
      service.onKeydown(event({ key: 'Z', code: 'KeyZ', metaKey: true, shiftKey: true })),
    ).toEqual({ command: 'tree.redo', args: [] });
  });

  test('matches digit keys via code when shift changes the character', () => {
    const service = new KeybindingService();
    service.register('ctrl+1', 'view.one');
    expect(service.onKeydown(event({ key: '!', code: 'Digit1', ctrlKey: true }))).toEqual({
      command: 'view.one',
      args: [],
    });
  });

  test('matches punctuation keys via code when shift changes the character', () => {
    const service = new KeybindingService();
    service.register('meta+shift+]', 'workbench.nextTab');
    // US layouts report Shift+] as '}'.
    expect(
      service.onKeydown(event({ key: '}', code: 'BracketRight', metaKey: true, shiftKey: true })),
    ).toEqual({ command: 'workbench.nextTab', args: [] });
  });

  test('passes through registered args', () => {
    const service = new KeybindingService();
    service.register('meta+2', 'workbench.switchToTab', [2]);
    expect(service.onKeydown(event({ key: '2', code: 'Digit2', metaKey: true }))).toEqual({
      command: 'workbench.switchToTab',
      args: [2],
    });
  });

  test('returns undefined for unregistered combos', () => {
    const service = new KeybindingService();
    service.register('meta+z', 'tree.undo');
    expect(service.onKeydown(event({ key: 'x', code: 'KeyX', metaKey: true }))).toBeUndefined();
    expect(service.onKeydown(event({ key: 'z', code: 'KeyZ' }))).toBeUndefined();
  });

  test('dispose unregisters a binding', () => {
    const service = new KeybindingService();
    const binding = service.register('meta+z', 'tree.undo');
    binding.dispose();
    expect(service.onKeydown(event({ key: 'z', code: 'KeyZ', metaKey: true }))).toBeUndefined();
  });
});
